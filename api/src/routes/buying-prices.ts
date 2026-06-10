import { Router, Response } from 'express'
import { query } from '../db'
import { authenticate, AuthRequest } from '../middleware/auth'

const router = Router()

// Get all buying prices
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT * FROM buying_prices 
       WHERE business_id = $1 
       ORDER BY effective_date DESC`,
      [req.business!.id]
    )
    return res.json({ buying_prices: result.rows })
  } catch (error) {
    console.error('Get buying prices error:', error)
    return res.status(500).json({ error: 'Something went wrong' })
  }
})

// Set buying price for a product
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
      `INSERT INTO buying_prices (product_id, business_id, price_per_casse, effective_date)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [product_id, req.business!.id, parseFloat(price_per_casse), effective_date]
    )

    return res.status(201).json({ buying_price: result.rows[0] })
  } catch (error) {
    console.error('Set buying price error:', error)
    return res.status(500).json({ error: 'Something went wrong' })
  }
})

// Get profit summary for a date range
router.get('/summary', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { start_date, end_date } = req.query

    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'Start date and end date are required' })
    }

    // Fetch one day before start_date so the first day has a "yesterday"
    const startDateObj = new Date(start_date as string)
    startDateObj.setDate(startDateObj.getDate() - 1)
    const year = startDateObj.getFullYear()
    const month = String(startDateObj.getMonth() + 1).padStart(2, '0')
    const day = String(startDateObj.getDate()).padStart(2, '0')
    const dayBeforeStart = `${year}-${month}-${day}`

    // Get all stock entries from day before start to end
    const entries = await query(
      `SELECT se.*, p.pieces_per_casse, p.id as prod_id
       FROM stock_entries se
       JOIN products p ON se.product_id = p.id
       WHERE se.business_id = $1 
       AND se.entry_date BETWEEN $2 AND $3
       ORDER BY se.entry_date ASC`,
      [req.business!.id, dayBeforeStart, end_date]
    )

    // Get all selling prices
    const sellingPrices = await query(
      'SELECT * FROM prices WHERE business_id = $1 ORDER BY effective_date DESC',
      [req.business!.id]
    )

    // Get all buying prices
    const buyingPrices = await query(
      'SELECT * FROM buying_prices WHERE business_id = $1 ORDER BY effective_date DESC',
      [req.business!.id]
    )

    // Get received stock only within requested range
    const received = await query(
      `SELECT * FROM stock_received 
       WHERE business_id = $1 
       AND received_date BETWEEN $2 AND $3`,
      [req.business!.id, start_date, end_date]
    )

    // Get expenses only within requested range
    const expenses = await query(
      `SELECT * FROM daily_expenses 
       WHERE business_id = $1 
       AND entry_date BETWEEN $2 AND $3`,
      [req.business!.id, start_date, end_date]
    )

    // Helper: get price for a product on a specific date
    function getPriceForDate(prices: any[], productId: string, date: string): number {
      const filtered = prices
        .filter(p => {
          const effectiveDate = p.effective_date.toISOString
            ? p.effective_date.toISOString().split('T')[0]
            : String(p.effective_date).split('T')[0]
          return p.product_id === productId && effectiveDate <= date
        })
        .sort((a, b) => {
          const dateA = a.effective_date.toISOString
            ? a.effective_date.toISOString().split('T')[0]
            : String(a.effective_date).split('T')[0]
          const dateB = b.effective_date.toISOString
            ? b.effective_date.toISOString().split('T')[0]
            : String(b.effective_date).split('T')[0]
          return dateB.localeCompare(dateA)
        })
      return filtered.length > 0 ? parseFloat(filtered[0].price_per_casse) : 0
    }

    // Helper: normalize date from DB to YYYY-MM-DD string
    function toDateStr(val: any): string {
      if (!val) return ''
      if (typeof val === 'string') return val.split('T')[0]
      if (val.toISOString) return val.toISOString().split('T')[0]
      return String(val).split('T')[0]
    }

    // Group entries by date
    const entriesByDate: Record<string, any[]> = {}
    entries.rows.forEach((entry: any) => {
      const date = toDateStr(entry.entry_date)
      if (!entriesByDate[date]) entriesByDate[date] = []
      entriesByDate[date].push(entry)
    })

    const allDates = Object.keys(entriesByDate).sort()
    let totalRevenue = 0
    let totalBuyingCost = 0
    let totalExpenses = 0
    const dailySummaries: any[] = []

    for (let i = 0; i < allDates.length; i++) {
      const date = allDates[i]

      // Only process dates within the requested range — skip day before
      if (date < (start_date as string) || date > (end_date as string)) continue

      const prevDate = allDates[i - 1]
      const todayEntries = entriesByDate[date]
      const yesterdayEntries = prevDate ? (entriesByDate[prevDate] || []) : []

      let dayRevenue = 0
      let dayBuyingCost = 0

      todayEntries.forEach((todayEntry: any) => {
        const yesterdayEntry = yesterdayEntries.find(
          (e: any) => e.product_id === todayEntry.product_id
        )
        if (!yesterdayEntry) return

        const receivedToday = received.rows.find((r: any) =>
          r.product_id === todayEntry.product_id &&
          toDateStr(r.received_date) === date
        )

        const ppc = todayEntry.pieces_per_casse
        const todayPieces =
          todayEntry.casses * ppc +
          todayEntry.halves * (ppc / 2) +
          todayEntry.pieces

        const yesterdayPieces =
          yesterdayEntry.casses * ppc +
          yesterdayEntry.halves * (ppc / 2) +
          yesterdayEntry.pieces

        const receivedPieces = receivedToday
          ? (receivedToday.supplier_casses + receivedToday.return_casses) * ppc +
            receivedToday.return_halves * (ppc / 2) +
            receivedToday.return_pieces
          : 0

        const soldPieces = yesterdayPieces + receivedPieces - todayPieces
        if (soldPieces <= 0) return

        const sellingPrice = getPriceForDate(sellingPrices.rows, todayEntry.product_id, date)
        const buyingPrice = getPriceForDate(buyingPrices.rows, todayEntry.product_id, date)

        dayRevenue += (soldPieces / ppc) * sellingPrice
        dayBuyingCost += (soldPieces / ppc) * buyingPrice
      })

      const dayExpenses = expenses.rows
        .filter((e: any) => toDateStr(e.entry_date) === date)
        .reduce((sum: number, e: any) => sum + parseFloat(e.amount), 0)

      totalRevenue += dayRevenue
      totalBuyingCost += dayBuyingCost
      totalExpenses += dayExpenses

      // Profit = Revenue - Buying Cost only (no expenses)
      dailySummaries.push({
        date,
        revenue: dayRevenue,
        buying_cost: dayBuyingCost,
        expenses: dayExpenses,
        profit: dayRevenue - dayBuyingCost,
      })
    }

    return res.json({
      summary: {
        start_date,
        end_date,
        total_revenue: totalRevenue,
        total_buying_cost: totalBuyingCost,
        total_expenses: totalExpenses,
        total_profit: totalRevenue - totalBuyingCost,
        daily: dailySummaries,
      }
    })
  } catch (error) {
    console.error('Profit summary error:', error)
    return res.status(500).json({ error: 'Something went wrong' })
  }
})

export default router