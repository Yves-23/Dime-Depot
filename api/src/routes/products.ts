import { Router, Response } from 'express'
import { query } from '../db'
import { authenticate, AuthRequest } from '../middleware/auth'

const router = Router()

// Get all products
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT p.*, s.name as supplier_name 
       FROM products p
       LEFT JOIN suppliers s ON p.supplier_id = s.id
       WHERE p.business_id = $1
       ORDER BY p.created_at ASC`,
      [req.business!.id]
    )
    return res.json({ products: result.rows })
  } catch (error) {
    console.error('Get products error:', error)
    return res.status(500).json({ error: 'Something went wrong' })
  }
})

// Create product
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { supplier_id, name, pieces_per_casse } = req.body

    if (!supplier_id || !name?.trim() || !pieces_per_casse) {
      return res.status(400).json({ error: 'Please fill in all fields' })
    }

    // Verify supplier belongs to this business
    const supplier = await query(
      'SELECT id FROM suppliers WHERE id = $1 AND business_id = $2',
      [supplier_id, req.business!.id]
    )

    if (supplier.rows.length === 0) {
      return res.status(404).json({ error: 'Supplier not found' })
    }

    const result = await query(
      `INSERT INTO products (business_id, supplier_id, name, pieces_per_casse, is_active)
       VALUES ($1, $2, $3, $4, true)
       RETURNING *`,
      [req.business!.id, supplier_id, name.trim(), parseInt(pieces_per_casse)]
    )

    return res.status(201).json({ product: result.rows[0] })
  } catch (error) {
    console.error('Create product error:', error)
    return res.status(500).json({ error: 'Something went wrong' })
  }
})

// Toggle product active status
router.put('/:id/toggle', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const result = await query(
      `UPDATE products 
       SET is_active = NOT is_active 
       WHERE id = $1 AND business_id = $2
       RETURNING *`,
      [id, req.business!.id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' })
    }

    return res.json({ product: result.rows[0] })
  } catch (error) {
    console.error('Toggle product error:', error)
    return res.status(500).json({ error: 'Something went wrong' })
  }
})

export default router