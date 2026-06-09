import { Router, Response } from 'express'
import { query } from '../db'
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth'

const router = Router()

// Get all businesses
router.get('/businesses', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT id, owner_name, business_name, email, phone, location, 
              is_active, is_admin, payment_date, created_at 
       FROM businesses
       WHERE is_admin = false 
       ORDER BY created_at DESC`
    )
    return res.json({ businesses: result.rows })
  } catch (error) {
    console.error('Get businesses error:', error)
    return res.status(500).json({ error: 'Something went wrong' })
  }
})

// Activate or deactivate a business
router.put('/businesses/:id/activate', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { is_active } = req.body

    const result = await query(
      `UPDATE businesses 
       SET is_active = $1, payment_date = $2
       WHERE id = $3
       RETURNING id, owner_name, business_name, email, is_active, is_admin`,
      [is_active, is_active ? new Date() : null, id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Business not found' })
    }

    return res.json({
      message: is_active ? 'Business activated' : 'Business deactivated',
      business: result.rows[0],
    })
  } catch (error) {
    console.error('Activate business error:', error)
    return res.status(500).json({ error: 'Something went wrong' })
  }
})

// Toggle admin privileges
router.put('/businesses/:id/admin', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { is_admin } = req.body

    // Prevent removing admin from yourself
    if (id === req.business!.id && !is_admin) {
      return res.status(400).json({ error: 'You cannot remove your own admin privileges' })
    }

    const result = await query(
      `UPDATE businesses SET is_admin = $1 WHERE id = $2
       RETURNING id, owner_name, business_name, email, is_active, is_admin`,
      [is_admin, id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Business not found' })
    }

    return res.json({
      message: is_admin ? 'Admin privileges granted' : 'Admin privileges removed',
      business: result.rows[0],
    })
  } catch (error) {
    console.error('Toggle admin error:', error)
    return res.status(500).json({ error: 'Something went wrong' })
  }
})

// Get admin stats
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
    console.error('Stats error:', error)
    return res.status(500).json({ error: 'Something went wrong' })
  }
})

// Delete a business
router.delete('/businesses/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    // Prevent deleting admin accounts
    const business = await query(
      'SELECT is_admin FROM businesses WHERE id = $1',
      [id]
    )

    if (business.rows.length === 0) {
      return res.status(404).json({ error: 'Business not found' })
    }

    if (business.rows[0].is_admin) {
      return res.status(400).json({ error: 'Cannot delete an admin account' })
    }

    await query('DELETE FROM businesses WHERE id = $1', [id])

    return res.json({ message: 'Business deleted successfully' })
  } catch (error) {
    console.error('Delete business error:', error)
    return res.status(500).json({ error: 'Something went wrong' })
  }
})

export default router