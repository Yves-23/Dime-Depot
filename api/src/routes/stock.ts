// api/src/routes/stock.ts

import { Router, Response } from 'express'
import { query } from '../db'
import { authenticate, AuthRequest } from '../middleware/auth'

const router = Router()

// Helper: check if a date is older than 24 hours
function isOlderThan24Hours(dateStr: string): boolean {
  const [year, month, day] = dateStr.split('-').map(Number)
  const entryDate = new Date(year, month - 1, day)
  // Set to end of that day (23:59:59)
  entryDate.setHours(23, 59, 59, 999)
  const now = new Date()
  const diffMs = now.getTime() - entryDate.getTime()
  const diffHours = diffMs / (1000 * 60 * 60)
  return diffHours > 24
}

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

    // 24-hour lock check
    if (isOlderThan24Hours(entry_date)) {
      return res.status(403).json({ error: 'This entry is locked. Entries cannot be edited after 24 hours.' })
    }

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

// Bulk upsert stock entries
router.post('/entries/bulk', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { entries, date } = req.body

    if (!entries || !date) {
      return res.status(400).json({ error: 'Entries and date are required' })
    }

    // 24-hour lock check
    if (isOlderThan24Hours(date)) {
      return res.status(403).json({ error: 'This entry is locked. Entries cannot be edited after 24 hours.' })
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

    // 24-hour lock check
    if (isOlderThan24Hours(date)) {
      return res.status(403).json({ error: 'This entry is locked. Entries cannot be edited after 24 hours.' })
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

router.get('/entries/last-before/:date', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { date } = req.params
    const lastDateResult = await query(
      `SELECT entry_date FROM stock_entries 
       WHERE business_id = $1 AND entry_date < $2
       ORDER BY entry_date DESC LIMIT 1`,
      [req.business!.id, date]
    )
    if (lastDateResult.rows.length === 0) {
      return res.json({ entries: [], last_date: null })
    }
    const lastDate = lastDateResult.rows[0].entry_date.toISOString().split('T')[0]
    const result = await query(
      'SELECT * FROM stock_entries WHERE business_id = $1 AND entry_date = $2',
      [req.business!.id, lastDate]
    )
    return res.json({ entries: result.rows, last_date: lastDate })
  } catch (error) {
    console.error('Get last stock entries error:', error)
    return res.status(500).json({ error: 'Something went wrong' })
  }
})


// Get current stock value and expected profit using the latest recorded stock entry for each product
router.get('/current-value', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT
         p.id AS product_id,
         p.name AS product_name,
         p.pieces_per_casse,
         s.name AS supplier_name,

         latest_stock.entry_date,
         latest_stock.casses,
         latest_stock.halves,
         latest_stock.pieces,

         stock_calc.stock_pieces,

         bp.price_per_casse,
         sp.selling_price,

         -- Stock value rounded up to the next 50 RWF
         CASE
           WHEN bp.price_per_casse IS NOT NULL
                AND p.pieces_per_casse > 0
           THEN CEIL(
             (
               (stock_calc.stock_pieces / p.pieces_per_casse::numeric)
               * bp.price_per_casse
             ) / 50.0
           ) * 50
           ELSE NULL
         END AS stock_value,

         -- Expected revenue rounded up to the next 50 RWF
         CASE
           WHEN sp.selling_price IS NOT NULL
                AND p.pieces_per_casse > 0
           THEN CEIL(
             (
               (stock_calc.stock_pieces / p.pieces_per_casse::numeric)
               * sp.selling_price
             ) / 50.0
           ) * 50
           ELSE NULL
         END AS expected_revenue,

         -- Expected gross profit = expected revenue - stock value
         CASE
           WHEN bp.price_per_casse IS NOT NULL
                AND sp.selling_price IS NOT NULL
                AND p.pieces_per_casse > 0
           THEN
             (
               CEIL(
                 (
                   (stock_calc.stock_pieces / p.pieces_per_casse::numeric)
                   * sp.selling_price
                 ) / 50.0
               ) * 50
             )
             -
             (
               CEIL(
                 (
                   (stock_calc.stock_pieces / p.pieces_per_casse::numeric)
                   * bp.price_per_casse
                 ) / 50.0
               ) * 50
             )
           ELSE NULL
         END AS expected_profit

       FROM products p

       LEFT JOIN suppliers s
         ON s.id = p.supplier_id

       JOIN LATERAL (
         SELECT
           se.entry_date,
           se.casses,
           se.halves,
           se.pieces
         FROM stock_entries se
         WHERE se.product_id = p.id
           AND se.business_id = p.business_id
         ORDER BY se.entry_date DESC, se.created_at DESC
         LIMIT 1
       ) latest_stock ON true

       -- Convert remaining stock into individual pieces
       CROSS JOIN LATERAL (
         SELECT
           (
             latest_stock.casses * p.pieces_per_casse +
             latest_stock.halves * (p.pieces_per_casse / 2.0) +
             latest_stock.pieces
           ) AS stock_pieces
       ) stock_calc

       -- Latest applicable buying price
       LEFT JOIN LATERAL (
         SELECT bp.price_per_casse
         FROM buying_prices bp
         WHERE bp.product_id = p.id
           AND bp.business_id = p.business_id
           AND bp.effective_date <= CURRENT_DATE
         ORDER BY bp.effective_date DESC, bp.created_at DESC
         LIMIT 1
       ) bp ON true

       -- Latest applicable selling price
       LEFT JOIN LATERAL (
         SELECT prices.price_per_casse AS selling_price
         FROM prices
         WHERE prices.product_id = p.id
           AND prices.business_id = p.business_id
           AND prices.effective_date <= CURRENT_DATE
         ORDER BY prices.effective_date DESC, prices.created_at DESC
         LIMIT 1
       ) sp ON true

       WHERE p.business_id = $1
       ORDER BY s.name, p.name`,
      [req.business!.id]
    )

    return res.json({ products: result.rows })
  } catch (error) {
    console.error('Get current stock value error:', error)
    return res.status(500).json({ error: 'Something went wrong' })
  }
})


export default router