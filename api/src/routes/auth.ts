import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { query } from '../db'
import { authenticate, AuthRequest } from '../middleware/auth'

const router = Router()

// Currency map by country
const currencyMap: Record<string, string> = {
  'Rwanda': 'RWF',
  'Uganda': 'UGX',
  'Kenya': 'KES',
  'Tanzania': 'TZS',
  'Burundi': 'BIF',
  'DRC': 'CDF',
  'Nigeria': 'NGN',
  'Ghana': 'GHS',
  'South Africa': 'ZAR',
  'Ethiopia': 'ETB',
}

// Register — phone + PIN + security question + optional email + country
router.post('/register', async (req: Request, res: Response) => {
  try {
    const {
      owner_name,
      business_name,
      phone,
      pin,
      security_question,
      security_answer,
      email,
      location,
      country,
    } = req.body

    if (!owner_name || !business_name || !phone || !pin || !security_question || !security_answer) {
      return res.status(400).json({ error: 'Please fill in all required fields' })
    }

    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      return res.status(400).json({ error: 'PIN must be exactly 4 digits' })
    }

    if (security_answer.trim().length < 2) {
      return res.status(400).json({ error: 'Security answer is too short' })
    }

    // Check if phone already exists
    const existingPhone = await query(
      'SELECT id FROM businesses WHERE phone = $1',
      [phone.trim()]
    )
    if (existingPhone.rows.length > 0) {
      return res.status(400).json({ error: 'Phone number already registered' })
    }

    // Check if email already exists (if provided)
    if (email) {
      const existingEmail = await query(
        'SELECT id FROM businesses WHERE email = $1',
        [email.toLowerCase()]
      )
      if (existingEmail.rows.length > 0) {
        return res.status(400).json({ error: 'Email already registered' })
      }
    }

    // Hash PIN and security answer
    const pin_hash = await bcrypt.hash(pin, 12)
    const security_answer_hash = await bcrypt.hash(security_answer.trim().toLowerCase(), 12)

    // Set country and currency
    const selectedCountry = country || 'Rwanda'
    const currency = currencyMap[selectedCountry] || 'RWF'

    // Check if admin
    const adminEmail = process.env.ADMIN_EMAIL
    const adminPhone = process.env.ADMIN_PHONE
    const is_admin =
      (email && email.toLowerCase() === adminEmail?.toLowerCase()) ||
      phone.trim() === adminPhone?.trim()
    const is_active = is_admin

    // Create business
    const result = await query(
      `INSERT INTO businesses 
        (owner_name, business_name, phone, email, location, country, currency, pin_hash, security_question, security_answer_hash, is_active, is_admin)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id, owner_name, business_name, phone, email, location, country, currency, is_active, is_admin, created_at`,
      [
        owner_name,
        business_name,
        phone.trim(),
        email ? email.toLowerCase() : null,
        location || null,
        selectedCountry,
        currency,
        pin_hash,
        security_question,
        security_answer_hash,
        is_active,
        is_admin,
      ]
    )

    const business = result.rows[0]

    const token = jwt.sign(
      { id: business.id, phone: business.phone, is_admin: business.is_admin },
      process.env.JWT_SECRET!,
      { expiresIn: '365d' }
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

// Login — supports phone+PIN (new) and email+password (old transition)
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { phone, pin, email, password } = req.body

    // New login: phone + PIN
    if (phone && pin) {
      const result = await query(
        'SELECT * FROM businesses WHERE phone = $1',
        [phone.trim()]
      )

      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Phone number not found' })
      }

      const business = result.rows[0]

      if (!business.pin_hash) {
        return res.status(401).json({ error: 'This account uses email and password. Please use the old login.' })
      }

      const validPin = await bcrypt.compare(pin, business.pin_hash)
      if (!validPin) {
        return res.status(401).json({ error: 'Incorrect PIN' })
      }

      const token = jwt.sign(
        { id: business.id, phone: business.phone, is_admin: business.is_admin },
        process.env.JWT_SECRET!,
        { expiresIn: '365d' }
      )

      const { pin_hash, password_hash, security_answer_hash, ...businessData } = business
      return res.json({ message: 'Login successful', token, business: businessData })
    }

    // Old login: email + password (transition support)
    if (email && password) {
      const result = await query(
        'SELECT * FROM businesses WHERE email = $1',
        [email.toLowerCase()]
      )

      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid email or password' })
      }

      const business = result.rows[0]

      if (!business.password_hash) {
        return res.status(401).json({ error: 'This account uses phone and PIN. Please use the new login.' })
      }

      const validPassword = await bcrypt.compare(password, business.password_hash)
      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid email or password' })
      }

      const token = jwt.sign(
        { id: business.id, email: business.email, is_admin: business.is_admin },
        process.env.JWT_SECRET!,
        { expiresIn: '365d' }
      )

      const { pin_hash, password_hash, security_answer_hash, ...businessData } = business
      return res.json({ message: 'Login successful', token, business: businessData })
    }

    return res.status(400).json({ error: 'Please provide phone + PIN or email + password' })
  } catch (error) {
    console.error('Login error:', error)
    return res.status(500).json({ error: 'Something went wrong' })
  }
})

// Get current user
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT id, owner_name, business_name, phone, email, location,
       country, currency, is_active, is_admin, payment_date, created_at,
       security_question,
       CASE WHEN pin_hash IS NOT NULL THEN true ELSE false END as has_pin,
       CASE WHEN email IS NOT NULL THEN true ELSE false END as has_email
       FROM businesses WHERE id = $1`,
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

// Change PIN (when logged in)
router.put('/change-pin', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { current_pin, new_pin } = req.body

    if (!current_pin || !new_pin) {
      return res.status(400).json({ error: 'Please provide current and new PIN' })
    }

    if (!/^\d{4}$/.test(new_pin)) {
      return res.status(400).json({ error: 'New PIN must be exactly 4 digits' })
    }

    const result = await query(
      'SELECT pin_hash FROM businesses WHERE id = $1',
      [req.business!.id]
    )

    if (!result.rows[0].pin_hash) {
      return res.status(400).json({ error: 'This account does not use PIN' })
    }

    const validPin = await bcrypt.compare(current_pin, result.rows[0].pin_hash)
    if (!validPin) {
      return res.status(401).json({ error: 'Current PIN is incorrect' })
    }

    const new_pin_hash = await bcrypt.hash(new_pin, 12)
    await query('UPDATE businesses SET pin_hash = $1 WHERE id = $2', [new_pin_hash, req.business!.id])

    return res.json({ message: 'PIN changed successfully' })
  } catch (error) {
    console.error('Change PIN error:', error)
    return res.status(500).json({ error: 'Something went wrong' })
  }
})

// Get security question for a phone number (for PIN reset)
router.post('/reset-pin/question', async (req: Request, res: Response) => {
  try {
    const { phone } = req.body

    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' })
    }

    const result = await query(
      'SELECT security_question, email FROM businesses WHERE phone = $1',
      [phone.trim()]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Phone number not found' })
    }

    const { security_question, email } = result.rows[0]

    return res.json({
      security_question,
      has_email: !!email,
    })
  } catch (error) {
    console.error('Get question error:', error)
    return res.status(500).json({ error: 'Something went wrong' })
  }
})

// Verify security answer or email for PIN reset
router.post('/reset-pin/verify', async (req: Request, res: Response) => {
  try {
    const { phone, security_answer, email } = req.body

    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' })
    }

    if (!security_answer && !email) {
      return res.status(400).json({ error: 'Security answer or email is required' })
    }

    const result = await query(
      'SELECT id, security_answer_hash, email FROM businesses WHERE phone = $1',
      [phone.trim()]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Phone number not found' })
    }

    const business = result.rows[0]

    // Verify via email
    if (email) {
      if (!business.email) {
        return res.status(400).json({ error: 'This account has no email registered' })
      }
      if (email.toLowerCase() !== business.email.toLowerCase()) {
        return res.status(401).json({ error: 'Email does not match our records' })
      }
    }

    // Verify via security answer
    if (security_answer) {
      const validAnswer = await bcrypt.compare(
        security_answer.trim().toLowerCase(),
        business.security_answer_hash
      )
      if (!validAnswer) {
        return res.status(401).json({ error: 'Security answer is incorrect' })
      }
    }

    // Generate a short-lived reset token (15 minutes)
    const reset_token = jwt.sign(
      { id: business.id, purpose: 'pin_reset' },
      process.env.JWT_SECRET!,
      { expiresIn: '15m' }
    )

    return res.json({ reset_token })
  } catch (error) {
    console.error('Verify error:', error)
    return res.status(500).json({ error: 'Something went wrong' })
  }
})

// Set new PIN after verification
router.post('/reset-pin/set', async (req: Request, res: Response) => {
  try {
    const { reset_token, new_pin } = req.body

    if (!reset_token || !new_pin) {
      return res.status(400).json({ error: 'Reset token and new PIN are required' })
    }

    if (!/^\d{4}$/.test(new_pin)) {
      return res.status(400).json({ error: 'PIN must be exactly 4 digits' })
    }

    let decoded: any
    try {
      decoded = jwt.verify(reset_token, process.env.JWT_SECRET!)
    } catch {
      return res.status(401).json({ error: 'Reset link has expired. Please start again.' })
    }

    if (decoded.purpose !== 'pin_reset') {
      return res.status(401).json({ error: 'Invalid reset token' })
    }

    const new_pin_hash = await bcrypt.hash(new_pin, 12)
    await query('UPDATE businesses SET pin_hash = $1 WHERE id = $2', [new_pin_hash, decoded.id])

    return res.json({ message: 'PIN reset successfully! You can now log in.' })
  } catch (error) {
    console.error('Set PIN error:', error)
    return res.status(500).json({ error: 'Something went wrong' })
  }
})

// Change password (old accounts - transition support)
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