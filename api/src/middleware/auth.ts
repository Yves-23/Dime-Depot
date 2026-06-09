import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { query } from '../db'

export interface AuthRequest extends Request {
  business?: {
    id: string
    email: string
    is_admin: boolean
    is_active: boolean
  }
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' })
    }

    const token = authHeader.split(' ')[1]
    const secret = process.env.JWT_SECRET!

    const decoded = jwt.verify(token, secret) as {
      id: string
      email: string
      is_admin: boolean
    }

    // Verify business still exists and is active
    const result = await query(
      'SELECT id, email, is_admin, is_active FROM businesses WHERE id = $1',
      [decoded.id]
    )

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Business not found' })
    }

    const business = result.rows[0]

    if (!business.is_active && !business.is_admin) {
      return res.status(403).json({ error: 'Account not activated' })
    }

    req.business = business
    next()
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' })
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.business?.is_admin) {
    return res.status(403).json({ error: 'Admin access required' })
  }
  next()
}