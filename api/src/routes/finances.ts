import { Router, Response } from 'express'
import { query } from '../db'
import { authenticate, AuthRequest } from '../middleware/auth'

const router = Router()

// Get finances for a date
router.get('/:date', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { date } = req.params

    const [finances, debts, expenses] = await Promise.all([
      query(
        'SELECT * FROM daily_finances WHERE business_id = $1 AND entry_date = $2',
        [req.business!.id, date]
      ),
      query(
        'SELECT * FROM daily_debts WHERE business_id = $1 AND entry_date = $2 ORDER BY created_at ASC',
        [req.business!.id, date]
      ),
      query(
        'SELECT * FROM daily_expenses WHERE business_id = $1 AND entry_date = $2 ORDER BY created_at ASC',
        [req.business!.id, date]
      ),
    ])

    return res.json({
      finances: finances.rows[0] || null,
      debts: debts.rows,
      expenses: expenses.rows,
    })
  } catch (error) {
    console.error('Get finances error:', error)
    return res.status(500).json({ error: 'Something went wrong' })
  }
})

// Save finances for a date
router.post('/:date', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { date } = req.params
    const { momo, cash, debts, expenses } = req.body

    // Upsert momo and cash
    await query(
      `INSERT INTO daily_finances (business_id, entry_date, momo, cash)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (business_id, entry_date)
       DO UPDATE SET momo = $3, cash = $4`,
      [req.business!.id, date, parseFloat(momo) || 0, parseFloat(cash) || 0]
    )

    // Delete old debts and re-insert
    await query(
      'DELETE FROM daily_debts WHERE business_id = $1 AND entry_date = $2',
      [req.business!.id, date]
    )

    if (debts && debts.length > 0) {
      const validDebts = debts.filter((d: any) => d.client_name?.trim() && parseFloat(d.amount) > 0)
      for (const debt of validDebts) {
        await query(
          `INSERT INTO daily_debts (business_id, entry_date, client_name, amount, is_paid)
           VALUES ($1, $2, $3, $4, $5)`,
          [req.business!.id, date, debt.client_name.trim(), parseFloat(debt.amount), debt.is_paid || false]
        )
      }
    }

    // Delete old expenses and re-insert
    await query(
      'DELETE FROM daily_expenses WHERE business_id = $1 AND entry_date = $2',
      [req.business!.id, date]
    )

    if (expenses && expenses.length > 0) {
      const validExpenses = expenses.filter((e: any) => e.description?.trim() && parseFloat(e.amount) > 0)
      for (const expense of validExpenses) {
        await query(
          `INSERT INTO daily_expenses (business_id, entry_date, description, amount)
           VALUES ($1, $2, $3, $4)`,
          [req.business!.id, date, expense.description.trim(), parseFloat(expense.amount)]
        )
      }
    }

    // Return updated data
    const [financesData, debtsData, expensesData] = await Promise.all([
      query('SELECT * FROM daily_finances WHERE business_id = $1 AND entry_date = $2', [req.business!.id, date]),
      query('SELECT * FROM daily_debts WHERE business_id = $1 AND entry_date = $2 ORDER BY created_at ASC', [req.business!.id, date]),
      query('SELECT * FROM daily_expenses WHERE business_id = $1 AND entry_date = $2 ORDER BY created_at ASC', [req.business!.id, date]),
    ])

    return res.json({
      message: 'Finances saved successfully',
      finances: financesData.rows[0] || null,
      debts: debtsData.rows,
      expenses: expensesData.rows,
    })
  } catch (error) {
    console.error('Save finances error:', error)
    return res.status(500).json({ error: 'Something went wrong' })
  }
})

// Update debt paid status
router.put('/debts/:id/paid', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { is_paid } = req.body

    const result = await query(
      `UPDATE daily_debts SET is_paid = $1
       WHERE id = $2 AND business_id = $3
       RETURNING *`,
      [is_paid, id, req.business!.id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Debt not found' })
    }

    return res.json({ debt: result.rows[0] })
  } catch (error) {
    console.error('Update debt error:', error)
    return res.status(500).json({ error: 'Something went wrong' })
  }
})

export default router