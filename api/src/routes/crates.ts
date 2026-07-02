import { Router, Response } from 'express'
import { query } from '../db'
import { authenticate, AuthRequest } from '../middleware/auth'

const router = Router()

// ─── CRATE TYPES ─────────────────────────────────────────────────────────────

router.get('/types', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT ct.*, s.name as supplier_name,
        COALESCE((
          SELECT SUM(crates_lent - crates_returned)
          FROM crate_lendings
          WHERE crate_type_id = ct.id AND is_fully_returned = false
        ), 0) as total_lent_out,
        COALESCE((
          SELECT SUM(crates_borrowed - COALESCE(crates_returned, 0))
          FROM crate_borrowings
          WHERE crate_type_id = ct.id AND is_returned = false
        ), 0) as total_borrowed
       FROM crate_types ct
       JOIN suppliers s ON ct.supplier_id = s.id
       WHERE ct.business_id = $1
       ORDER BY s.name ASC`,
      [req.business!.id]
    )
    return res.json({ crate_types: result.rows })
  } catch (error) {
    console.error('Get crate types error:', error)
    return res.status(500).json({ error: 'Something went wrong' })
  }
})

router.post('/types', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { supplier_id, total_owned } = req.body
    if (!supplier_id || total_owned === undefined) {
      return res.status(400).json({ error: 'Supplier and total owned are required' })
    }
    const result = await query(
      `INSERT INTO crate_types (business_id, supplier_id, total_owned)
       VALUES ($1, $2, $3)
       ON CONFLICT (business_id, supplier_id)
       DO UPDATE SET total_owned = $3
       RETURNING *`,
      [req.business!.id, supplier_id, parseInt(total_owned)]
    )
    return res.json({ crate_type: result.rows[0] })
  } catch (error) {
    console.error('Create crate type error:', error)
    return res.status(500).json({ error: 'Something went wrong' })
  }
})

// Update total owned — supports both + (add) and - (remove/lost)
router.put('/types/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { total_owned } = req.body
    const result = await query(
      `UPDATE crate_types SET total_owned = $1
       WHERE id = $2 AND business_id = $3
       RETURNING *`,
      [Math.max(0, parseInt(total_owned)), id, req.business!.id]
    )
    if (result.rows.length === 0) return res.status(404).json({ error: 'Crate type not found' })
    return res.json({ crate_type: result.rows[0] })
  } catch (error) {
    console.error('Update crate type error:', error)
    return res.status(500).json({ error: 'Something went wrong' })
  }
})

// ─── CRATE LENDINGS ───────────────────────────────────────────────────────────

router.get('/lendings', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT cl.*, ct.supplier_id, s.name as supplier_name
       FROM crate_lendings cl
       JOIN crate_types ct ON cl.crate_type_id = ct.id
       JOIN suppliers s ON ct.supplier_id = s.id
       WHERE cl.business_id = $1
       ORDER BY cl.is_fully_returned ASC, cl.lent_date DESC`,
      [req.business!.id]
    )
    return res.json({ lendings: result.rows })
  } catch (error) {
    console.error('Get lendings error:', error)
    return res.status(500).json({ error: 'Something went wrong' })
  }
})

router.post('/lendings', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { crate_type_id, client_name, phone, crates_lent, lent_date } = req.body
    if (!crate_type_id || !client_name || !crates_lent || !lent_date) {
      return res.status(400).json({ error: 'All required fields must be filled' })
    }
    const result = await query(
      `INSERT INTO crate_lendings
        (business_id, crate_type_id, client_name, phone, crates_lent, crates_returned, is_fully_returned, lent_date)
       VALUES ($1, $2, $3, $4, $5, 0, false, $6)
       RETURNING *`,
      [req.business!.id, crate_type_id, client_name.trim(), phone?.trim() || null, parseInt(crates_lent), lent_date]
    )
    return res.status(201).json({ lending: result.rows[0] })
  } catch (error) {
    console.error('Lend crates error:', error)
    return res.status(500).json({ error: 'Something went wrong' })
  }
})

// Partial or full return from client
router.put('/lendings/:id/return', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { crates_returned, full } = req.body

    const current = await query(
      'SELECT * FROM crate_lendings WHERE id = $1 AND business_id = $2',
      [id, req.business!.id]
    )
    if (current.rows.length === 0) return res.status(404).json({ error: 'Lending not found' })

    const lending = current.rows[0]
    const totalLent = parseInt(lending.crates_lent)

    let newReturned: number
    let isFullyReturned: boolean

    if (full) {
      newReturned = totalLent
      isFullyReturned = true
    } else {
      newReturned = Math.min(parseInt(lending.crates_returned) + parseInt(crates_returned), totalLent)
      isFullyReturned = newReturned >= totalLent
    }

    const result = await query(
      `UPDATE crate_lendings
       SET crates_returned = $1, is_fully_returned = $2
       WHERE id = $3 AND business_id = $4
       RETURNING *`,
      [newReturned, isFullyReturned, id, req.business!.id]
    )
    return res.json({ lending: result.rows[0] })
  } catch (error) {
    console.error('Return crates error:', error)
    return res.status(500).json({ error: 'Something went wrong' })
  }
})

router.delete('/lendings/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    await query('DELETE FROM crate_lendings WHERE id = $1 AND business_id = $2', [id, req.business!.id])
    return res.json({ message: 'Lending deleted' })
  } catch (error) {
    console.error('Delete lending error:', error)
    return res.status(500).json({ error: 'Something went wrong' })
  }
})

// ─── CRATE BORROWINGS ─────────────────────────────────────────────────────────

router.get('/borrowings', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT cb.*, ct.supplier_id, s.name as supplier_name
       FROM crate_borrowings cb
       JOIN crate_types ct ON cb.crate_type_id = ct.id
       JOIN suppliers s ON ct.supplier_id = s.id
       WHERE cb.business_id = $1
       ORDER BY cb.is_returned ASC, cb.borrowed_date DESC`,
      [req.business!.id]
    )
    return res.json({ borrowings: result.rows })
  } catch (error) {
    console.error('Get borrowings error:', error)
    return res.status(500).json({ error: 'Something went wrong' })
  }
})

router.post('/borrowings', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { crate_type_id, borrowed_from, crates_borrowed, borrowed_date } = req.body
    if (!crate_type_id || !borrowed_from || !crates_borrowed || !borrowed_date) {
      return res.status(400).json({ error: 'All fields are required' })
    }
    const result = await query(
      `INSERT INTO crate_borrowings
        (business_id, crate_type_id, borrowed_from, crates_borrowed, crates_returned, is_returned, borrowed_date)
       VALUES ($1, $2, $3, $4, 0, false, $5)
       RETURNING *`,
      [req.business!.id, crate_type_id, borrowed_from.trim(), parseInt(crates_borrowed), borrowed_date]
    )
    return res.status(201).json({ borrowing: result.rows[0] })
  } catch (error) {
    console.error('Borrow crates error:', error)
    return res.status(500).json({ error: 'Something went wrong' })
  }
})

// Partial or full return of borrowed crates
router.put('/borrowings/:id/return', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { crates_returned, full } = req.body

    const current = await query(
      'SELECT * FROM crate_borrowings WHERE id = $1 AND business_id = $2',
      [id, req.business!.id]
    )
    if (current.rows.length === 0) return res.status(404).json({ error: 'Borrowing not found' })

    const borrowing = current.rows[0]
    const totalBorrowed = parseInt(borrowing.crates_borrowed)

    let newReturned: number
    let isFullyReturned: boolean

    if (full) {
      newReturned = totalBorrowed
      isFullyReturned = true
    } else {
      newReturned = Math.min(parseInt(borrowing.crates_returned || 0) + parseInt(crates_returned), totalBorrowed)
      isFullyReturned = newReturned >= totalBorrowed
    }

    const result = await query(
      `UPDATE crate_borrowings
       SET crates_returned = $1, is_returned = $2
       WHERE id = $3 AND business_id = $4
       RETURNING *`,
      [newReturned, isFullyReturned, id, req.business!.id]
    )
    return res.json({ borrowing: result.rows[0] })
  } catch (error) {
    console.error('Return borrowing error:', error)
    return res.status(500).json({ error: 'Something went wrong' })
  }
})

router.delete('/borrowings/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    await query('DELETE FROM crate_borrowings WHERE id = $1 AND business_id = $2', [id, req.business!.id])
    return res.json({ message: 'Borrowing deleted' })
  } catch (error) {
    console.error('Delete borrowing error:', error)
    return res.status(500).json({ error: 'Something went wrong' })
  }
})

export default router
