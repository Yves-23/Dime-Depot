import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { query } from '../db'
import { authenticate, AuthRequest } from '../middleware/auth'

const router = Router()

// Register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { owner_name, business_name, email, password, phone, location } = req.body

    if (!owner_name || !business_name || !email || !password) {
      return res.status(400).json({ error: 'Please fill in all required fields' })
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' })
    }

    // Check if email already exists
    const existing = await query('SELECT id FROM businesses WHERE email = $1', [email.toLowerCase()])
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' })
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 12)

    // Check if this email is the admin email
    const adminEmail = process.env.ADMIN_EMAIL
    const is_admin = email.toLowerCase() === adminEmail?.toLowerCase()
    const is_active = is_admin // Admin is automatically active

    // Create business
    const result = await query(
      `INSERT INTO businesses 
        (owner_name, business_name, email, phone, location, password_hash, is_active, is_admin)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, owner_name, business_name, email, phone, location, is_active, is_admin, created_at`,
      [owner_name, business_name, email.toLowerCase(), phone || null, location || null, password_hash, is_active, is_admin]
    )

    const business = result.rows[0]

    // Generate token
    const token = jwt.sign(
      { id: business.id, email: business.email, is_admin: business.is_admin },
      process.env.JWT_SECRET!,
      { expiresIn: '30d' }
    )

    return res.status(201).json({
      message: is_admin ? 'Admin account created' : 'Account created successfully',
      token,
      business,
    })
  } catch (error) {
    console.error('Register error:', error)
    return res.status(500).json({ error: 'Something went wrong' })
  }
})

// Login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }

    // Find business
    const result = await query(
      'SELECT * FROM businesses WHERE email = $1',
      [email.toLowerCase()]
    )

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    const business = result.rows[0]

    // Check password
    const validPassword = await bcrypt.compare(password, business.password_hash)
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    // Generate token
    const token = jwt.sign(
      { id: business.id, email: business.email, is_admin: business.is_admin },
      process.env.JWT_SECRET!,
      { expiresIn: '30d' }
    )

    // Return business without password
    const { password_hash, ...businessData } = business

    return res.json({
      message: 'Login successful',
      token,
      business: businessData,
    })
  } catch (error) {
    console.error('Login error:', error)
    return res.status(500).json({ error: 'Something went wrong' })
  }
})

// Get current user
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      'SELECT id, owner_name, business_name, email, phone, location, is_active, is_admin, payment_date, created_at FROM businesses WHERE id = $1',
      [req.business!.id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Business not found' })
    }

    return res.json({ business: result.rows[0] })
  } catch (error) {
    console.error('Me error:', error)
    return res.status(500).json({ error: 'Something went wrong' })
  }
})

// Change password
router.put('/change-password', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { current_password, new_password } = req.body

    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Please provide current and new password' })
    }

    if (new_password.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' })
    }

    const result = await query(
      'SELECT password_hash FROM businesses WHERE id = $1',
      [req.business!.id]
    )

    const validPassword = await bcrypt.compare(current_password, result.rows[0].password_hash)
    if (!validPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' })
    }

    const new_hash = await bcrypt.hash(new_password, 12)
    await query('UPDATE businesses SET password_hash = $1 WHERE id = $2', [new_hash, req.business!.id])

    return res.json({ message: 'Password changed successfully' })
  } catch (error) {
    console.error('Change password error:', error)
    return res.status(500).json({ error: 'Something went wrong' })
  }
})

export default router