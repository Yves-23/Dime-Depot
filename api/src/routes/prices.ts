import { Router, Response } from 'express'
import { query } from '../db'
import { authenticate, AuthRequest } from '../middleware/auth'

const router = Router()

// Get all prices
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT * FROM prices 
       WHERE business_id = $1 
       ORDER BY effective_date DESC`,
      [req.business!.id]
    )
    return res.json({ prices: result.rows })
  } catch (error) {
    console.error('Get prices error:', error)
    return res.status(500).json({ error: 'Something went wrong' })
  }
})

// Set price for a product
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { product_id, price_per_casse, effective_date } = req.body

    if (!product_id || !price_per_casse || !effective_date) {
      return res.status(400).json({ error: 'Please fill in all fields' })
    }

    if (parseFloat(price_per_casse) <= 0) {
      return res.status(400).json({ error: 'Price must be greater than 0' })
    }

    // Verify product belongs to this business
    const product = await query(
      'SELECT id FROM products WHERE id = $1 AND business_id = $2',
      [product_id, req.business!.id]
    )

    if (product.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' })
    }

    const result = await query(
      `INSERT INTO prices (product_id, business_id, price_per_casse, effective_date)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [product_id, req.business!.id, parseFloat(price_per_casse), effective_date]
    )

    return res.status(201).json({ price: result.rows[0] })
  } catch (error) {
    console.error('Set price error:', error)
    return res.status(500).json({ error: 'Something went wrong' })
  }
})

export default router