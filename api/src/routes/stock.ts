import { Router, Response } from 'express'
import { query } from '../db'
import { authenticate, AuthRequest } from '../middleware/auth'

const router = Router()

// Get stock entries for a date
router.get('/entries/:date', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { date } = req.params
    const result = await query(
      'SELECT * FROM stock_entries WHERE business_id = $1 AND entry_date = $2',
      [req.business!.id, date]
    )
    return res.json({ entries: result.rows })
  } catch (error) {
    console.error('Get stock entries error:', error)
    return res.status(500).json({ error: 'Something went wrong' })
  }
})

// Upsert stock entry
router.post('/entries', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { product_id, entry_date, casses, halves, pieces } = req.body

    if (!product_id || !entry_date) {
      return res.status(400).json({ error: 'Product and date are required' })
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
      `INSERT INTO stock_entries (business_id, product_id, entry_date, casses, halves, pieces)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (business_id, product_id, entry_date)
       DO UPDATE SET casses = $4, halves = $5, pieces = $6
       RETURNING *`,
      [req.business!.id, product_id, entry_date, casses || 0, halves || 0, pieces || 0]
    )

    return res.json({ entry: result.rows[0] })
  } catch (error) {
    console.error('Upsert stock entry error:', error)
    return res.status(500).json({ error: 'Something went wrong' })
  }
})

// Bulk upsert stock entries (save all at once)
router.post('/entries/bulk', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { entries, date } = req.body

    if (!entries || !date) {
      return res.status(400).json({ error: 'Entries and date are required' })
    }

    const results = []

    for (const entry of entries) {
      const result = await query(
        `INSERT INTO stock_entries (business_id, product_id, entry_date, casses, halves, pieces)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (business_id, product_id, entry_date)
         DO UPDATE SET casses = $4, halves = $5, pieces = $6
         RETURNING *`,
        [req.business!.id, entry.product_id, date, entry.casses || 0, entry.halves || 0, entry.pieces || 0]
      )
      results.push(result.rows[0])
    }

    return res.json({ entries: results })
  } catch (error) {
    console.error('Bulk upsert error:', error)
    return res.status(500).json({ error: 'Something went wrong' })
  }
})

// Get stock received for a date
router.get('/received/:date', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { date } = req.params
    const result = await query(
      'SELECT * FROM stock_received WHERE business_id = $1 AND received_date = $2',
      [req.business!.id, date]
    )
    return res.json({ received: result.rows })
  } catch (error) {
    console.error('Get stock received error:', error)
    return res.status(500).json({ error: 'Something went wrong' })
  }
})

// Bulk upsert stock received
router.post('/received/bulk', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { received, date } = req.body

    if (!received || !date) {
      return res.status(400).json({ error: 'Received and date are required' })
    }

    const results = []

    for (const item of received) {
      const result = await query(
        `INSERT INTO stock_received 
          (business_id, product_id, received_date, supplier_casses, return_casses, return_halves, return_pieces)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (business_id, product_id, received_date)
         DO UPDATE SET 
           supplier_casses = $4,
           return_casses = $5,
           return_halves = $6,
           return_pieces = $7
         RETURNING *`,
        [
          req.business!.id,
          item.product_id,
          date,
          item.supplier_casses || 0,
          item.return_casses || 0,
          item.return_halves || 0,
          item.return_pieces || 0,
        ]
      )
      results.push(result.rows[0])
    }

    return res.json({ received: results })
  } catch (error) {
    console.error('Bulk upsert received error:', error)
    return res.status(500).json({ error: 'Something went wrong' })
  }
})

export default router