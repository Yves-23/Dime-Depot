import { Router, Request, Response } from 'express'
import { query } from '../db'
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { Resend } from 'resend'

const router = Router()
const resend = new Resend(process.env.RESEND_API_KEY)

// In-memory 2FA store
const twoFACodes: Record<string, { code: string; expires: number }> = {}

// ─── ADMIN AUTH ───────────────────────────────────────────────────────────────

// Check if admin password is set
router.get('/auth/status', async (req: Request, res: Response) => {
  try {
    const result = await query(
      'SELECT password_hash FROM businesses WHERE is_admin = true LIMIT 1'
    )
    const hasPassword = !!(result.rows[0]?.password_hash)
    return res.json({ hasPassword })
  } catch (error) {
    return res.status(500).json({ error: 'Something went wrong' })
  }
})

// First-time setup — set admin password using setup secret
router.post('/auth/setup', async (req: Request, res: Response) => {
  try {
    const { email, new_password, secret } = req.body

    if (secret !== process.env.ADMIN_SETUP_SECRET) {
      return res.status(401).json({ error: 'Invalid setup secret' })
    }

    if (!new_password || new_password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' })
    }

    // Check password not already set
    const result = await query(
      'SELECT id, password_hash FROM businesses WHERE is_admin = true LIMIT 1'
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Admin account not found' })
    }

    const hash = await bcrypt.hash(new_password, 12)

    await query(
      'UPDATE businesses SET password_hash = $1, email = $2 WHERE is_admin = true',
      [hash, email.toLowerCase().trim()]
    )

    return res.json({ message: 'Admin password set successfully! You can now log in.' })
  } catch (error) {
    console.error('Admin setup error:', error)
    return res.status(500).json({ error: 'Something went wrong' })
  }
})

// Step 1: Login with email + password → send 2FA code
router.post('/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }

    const result = await query(
      'SELECT * FROM businesses WHERE email = $1 AND is_admin = true',
      [email.toLowerCase().trim()]
    )

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    const admin = result.rows[0]

    if (!admin.password_hash) {
      return res.status(401).json({ error: 'Password not set. Please complete setup first.' })
    }

    const validPassword = await bcrypt.compare(password, admin.password_hash)
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    // Generate 6-digit 2FA code
    const code = Math.floor(100000 + Math.random() * 900000).toString()
    const expires = Date.now() + 10 * 60 * 1000 // 10 minutes
    twoFACodes[email.toLowerCase()] = { code, expires }

    // Send via Resend
    await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: email.toLowerCase(),
      subject: 'Dime-Depot Admin — Verification Code',
      html: `
        <div style="font-family: sans-serif; max-width: 420px; margin: 0 auto; padding: 24px;">
          <div style="background: #7c3aed; color: white; padding: 16px 24px; border-radius: 12px 12px 0 0;">
            <h2 style="margin: 0; font-size: 20px;">🔐 Dime-Depot Admin</h2>
          </div>
          <div style="background: #f8fafc; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0;">
            <p style="color: #475569; margin-top: 0;">Your verification code is:</p>
            <div style="background: white; border: 2px solid #7c3aed; border-radius: 12px; padding: 20px; text-align: center; margin: 16px 0;">
              <span style="font-size: 40px; font-weight: bold; letter-spacing: 10px; color: #7c3aed;">${code}</span>
            </div>
            <p style="color: #94a3b8; font-size: 13px; margin-bottom: 0;">
              This code expires in <strong>10 minutes</strong>. Do not share it with anyone.
            </p>
          </div>
        </div>
      `,
    })

    return res.json({ message: '2FA code sent to your email' })
  } catch (error) {
    console.error('Admin login error:', error)
    return res.status(500).json({ error: 'Something went wrong' })
  }
})

// Step 2: Verify 2FA code → return token
router.post('/auth/verify', async (req: Request, res: Response) => {
  try {
    const { email, code } = req.body

    if (!email || !code) {
      return res.status(400).json({ error: 'Email and code are required' })
    }

    const stored = twoFACodes[email.toLowerCase()]

    if (!stored) {
      return res.status(401).json({ error: 'No code found. Please log in again.' })
    }

    if (Date.now() > stored.expires) {
      delete twoFACodes[email.toLowerCase()]
      return res.status(401).json({ error: 'Code has expired. Please log in again.' })
    }

    if (stored.code !== code.trim()) {
      return res.status(401).json({ error: 'Incorrect code. Please try again.' })
    }

    delete twoFACodes[email.toLowerCase()]

    const result = await query(
      `SELECT id, owner_name, business_name, email, phone, is_active, is_admin, language
       FROM businesses WHERE email = $1 AND is_admin = true`,
      [email.toLowerCase()]
    )

    const admin = result.rows[0]
    const token = jwt.sign(
      { id: admin.id, email: admin.email, is_admin: true },
      process.env.JWT_SECRET!,
      { expiresIn: '365d' }
    )

    return res.json({ message: 'Login successful', token, business: admin })
  } catch (error) {
    console.error('Admin verify error:', error)
    return res.status(500).json({ error: 'Something went wrong' })
  }
})

// Change admin password (when logged in)
router.put('/auth/change-password', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { current_password, new_password } = req.body

    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Both passwords are required' })
    }

    if (new_password.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' })
    }

    const result = await query(
      'SELECT password_hash FROM businesses WHERE id = $1 AND is_admin = true',
      [req.business!.id]
    )

    const valid = await bcrypt.compare(current_password, result.rows[0].password_hash)
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect' })
    }

    const hash = await bcrypt.hash(new_password, 12)
    await query('UPDATE businesses SET password_hash = $1 WHERE id = $2', [hash, req.business!.id])

    return res.json({ message: 'Password changed successfully' })
  } catch (error) {
    console.error('Change admin password error:', error)
    return res.status(500).json({ error: 'Something went wrong' })
  }
})

// ─── ADMIN ROUTES ─────────────────────────────────────────────────────────────

router.get('/businesses', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT id, owner_name, business_name, email, phone, location,
              is_active, is_admin, payment_date, created_at
       FROM businesses WHERE is_admin = false ORDER BY created_at DESC`
    )
    return res.json({ businesses: result.rows })
  } catch (error) {
    return res.status(500).json({ error: 'Something went wrong' })
  }
})

router.put('/businesses/:id/activate', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { is_active } = req.body
    const result = await query(
      `UPDATE businesses SET is_active = $1, payment_date = $2 WHERE id = $3
       RETURNING id, owner_name, business_name, email, is_active, is_admin`,
      [is_active, is_active ? new Date() : null, id]
    )
    if (result.rows.length === 0) return res.status(404).json({ error: 'Business not found' })
    return res.json({ message: is_active ? 'Business activated' : 'Business deactivated', business: result.rows[0] })
  } catch (error) {
    return res.status(500).json({ error: 'Something went wrong' })
  }
})

router.put('/businesses/:id/admin', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { is_admin } = req.body
    if (id === req.business!.id && !is_admin) {
      return res.status(400).json({ error: 'You cannot remove your own admin privileges' })
    }
    const result = await query(
      `UPDATE businesses SET is_admin = $1 WHERE id = $2
       RETURNING id, owner_name, business_name, email, is_active, is_admin`,
      [is_admin, id]
    )
    if (result.rows.length === 0) return res.status(404).json({ error: 'Business not found' })
    return res.json({ message: is_admin ? 'Admin granted' : 'Admin removed', business: result.rows[0] })
  } catch (error) {
    return res.status(500).json({ error: 'Something went wrong' })
  }
})

router.get('/stats', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const total = await query('SELECT COUNT(*) FROM businesses')
    const active = await query('SELECT COUNT(*) FROM businesses WHERE is_active = true')
    const pending = await query('SELECT COUNT(*) FROM businesses WHERE is_active = false')
    return res.json({
      stats: {
        total: parseInt(total.rows[0].count),
        active: parseInt(active.rows[0].count),
        pending: parseInt(pending.rows[0].count),
      }
    })
  } catch (error) {
    return res.status(500).json({ error: 'Something went wrong' })
  }
})

router.delete('/businesses/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const business = await query('SELECT is_admin FROM businesses WHERE id = $1', [id])
    if (business.rows.length === 0) return res.status(404).json({ error: 'Business not found' })
    if (business.rows[0].is_admin) return res.status(400).json({ error: 'Cannot delete an admin account' })
    await query('DELETE FROM businesses WHERE id = $1', [id])
    return res.json({ message: 'Business deleted successfully' })
  } catch (error) {
    return res.status(500).json({ error: 'Something went wrong' })
  }
})

export default router