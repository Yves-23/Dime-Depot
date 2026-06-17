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

// Get all unpaid debts
router.get('/debts/unpaid', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT id, client_name, amount, amount_paid, entry_date, is_paid
       FROM daily_debts
       WHERE business_id = $1 AND is_paid = false
       ORDER BY entry_date DESC, created_at ASC`,
      [req.business!.id]
    )
    return res.json({ debts: result.rows })
  } catch (error) {
    console.error('Get unpaid debts error:', error)
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

    // STEP 1: Fetch ALL existing debts BEFORE deleting
    const existingResult = await query(
      'SELECT id, amount_paid, is_paid FROM daily_debts WHERE business_id = $1 AND entry_date = $2',
      [req.business!.id, date]
    )

    const existingMap: Record<string, { amount_paid: number; is_paid: boolean }> = {}
    for (const row of existingResult.rows) {
      existingMap[row.id] = {
        amount_paid: parseFloat(row.amount_paid || 0),
        is_paid: row.is_paid === true,
      }
    }

    // STEP 2: Delete old debts
    await query(
      'DELETE FROM daily_debts WHERE business_id = $1 AND entry_date = $2',
      [req.business!.id, date]
    )

    // STEP 3: Reinsert with preserved amount_paid and accurate is_paid
    if (debts && debts.length > 0) {
      const validDebts = debts.filter((d: any) => d.client_name?.trim() && parseFloat(d.amount) > 0)
      for (const debt of validDebts) {
        const newAmount = parseFloat(debt.amount)

        // Restore amount_paid from before deletion
        let amountPaid = 0
        if (debt.id && existingMap[debt.id]) {
          amountPaid = existingMap[debt.id].amount_paid
        }

        // Accurate is_paid: always based on whether amount_paid covers the new amount
        // This handles ALL cases:
        // - No payments yet → not paid
        // - Partial payments → check if they cover new amount
        // - Fully paid before → check if amount_paid still covers new amount
        // - Corrected to higher amount → reopens with remaining balance
        // - Corrected to lower amount → stays paid if amount_paid >= new amount
        const isPaid = amountPaid >= newAmount

        await query(
          `INSERT INTO daily_debts (business_id, entry_date, client_name, amount, amount_paid, is_paid)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [req.business!.id, date, debt.client_name.trim(), newAmount, amountPaid, isPaid]
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

// Partial payment on a debt
router.patch('/debts/:id/partial-pay', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { amount } = req.body

    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Payment amount must be greater than 0' })
    }

    const current = await query(
      'SELECT * FROM daily_debts WHERE id = $1 AND business_id = $2',
      [id, req.business!.id]
    )

    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'Debt not found' })
    }

    const debt = current.rows[0]
    const totalAmount = parseFloat(debt.amount)
    const alreadyPaid = parseFloat(debt.amount_paid || 0)
    const newPayment = parseFloat(amount)
    const newAmountPaid = alreadyPaid + newPayment

    const finalAmountPaid = Math.min(newAmountPaid, totalAmount)
    const isPaid = finalAmountPaid >= totalAmount

    const result = await query(
      `UPDATE daily_debts
       SET amount_paid = $1, is_paid = $2
       WHERE id = $3 AND business_id = $4
       RETURNING *`,
      [finalAmountPaid, isPaid, id, req.business!.id]
    )

    return res.json({ debt: result.rows[0] })
  } catch (error) {
    console.error('Partial pay error:', error)
    return res.status(500).json({ error: 'Something went wrong' })
  }
})

export default router