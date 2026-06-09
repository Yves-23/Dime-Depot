import { Router, Response } from 'express'
import { query } from '../db'
import { authenticate, AuthRequest } from '../middleware/auth'

const router = Router()

// Get all suppliers
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      'SELECT * FROM suppliers WHERE business_id = $1 ORDER BY name ASC',
      [req.business!.id]
    )
    return res.json({ suppliers: result.rows })
  } catch (error) {
    console.error('Get suppliers error:', error)
    return res.status(500).json({ error: 'Something went wrong' })
  }
})

// Create supplier
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.body

    if (!name?.trim()) {
      return res.status(400).json({ error: 'Supplier name is required' })
    }

    const result = await query(
      'INSERT INTO suppliers (business_id, name) VALUES ($1, $2) RETURNING *',
      [req.business!.id, name.trim()]
    )

    return res.status(201).json({ supplier: result.rows[0] })
  } catch (error) {
    console.error('Create supplier error:', error)
    return res.status(500).json({ error: 'Something went wrong' })
  }
})

// Delete supplier
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    // Check if supplier has products
    const products = await query(
      'SELECT id FROM products WHERE supplier_id = $1 AND business_id = $2',
      [id, req.business!.id]
    )

    if (products.rows.length > 0) {
      return res.status(400).json({
        error: 'Cannot delete supplier with products. Deactivate products first.'
      })
    }

    const result = await query(
      'DELETE FROM suppliers WHERE id = $1 AND business_id = $2 RETURNING id',
      [id, req.business!.id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Supplier not found' })
    }

    return res.json({ message: 'Supplier deleted successfully' })
  } catch (error) {
    console.error('Delete supplier error:', error)
    return res.status(500).json({ error: 'Something went wrong' })
  }
})

export default router