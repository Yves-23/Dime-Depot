import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { stockAPI, suppliersAPI, productsAPI, pricesAPI, financesAPI } from '../lib/api'
import type { Product, Supplier, Price } from '../lib/types'
import {
  stockToPieces,
  piecesToStock,
  formatStock,
  formatRWF,
  getPriceForDate,
  today,
  yesterday,
  formatDate,
} from '../lib/helpers'
import toast from 'react-hot-toast'

interface SaleRow {
  product: Product
  supplier: Supplier
  soldPieces: number
  soldCasses: number
  soldHalves: number
  soldRemainingPieces: number
  pricePerCasse: number
  revenue: number
}

interface DebtEntry {
  id?: string
  client_name: string
  amount: string
  is_paid: boolean
}

interface ExpenseEntry {
  id?: string
  description: string
  amount: string
}

type ConfirmAction =
  | { type: 'delete_debt'; index: number }
  | { type: 'delete_expense'; index: number }
  | { type: 'toggle_debt'; index: number }
  | null

export default function Reports() {
  const { business } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [prices, setPrices] = useState<Price[]>([])
  const [saleRows, setSaleRows] = useState<SaleRow[]>([])
  const [loading, setLoading] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [reportDate, setReportDate] = useState(today())
  const [hasData, setHasData] = useState(false)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null)

  const [momo, setMomo] = useState('')
  const [cash, setCash] = useState('')
  const [debts, setDebts] = useState<DebtEntry[]>([{ client_name: '', amount: '', is_paid: false }])
  const [expenses, setExpenses] = useState<ExpenseEntry[]>([{ description: '', amount: '' }])
  const [savedSnapshot, setSavedSnapshot] = useState<string>('')

  const currentSnapshot = JSON.stringify({ momo, cash, debts, expenses })
  const hasUnsavedChanges = savedSnapshot !== currentSnapshot

  useEffect(() => {
    if (business) loadBaseData()
  }, [business])

  useEffect(() => {
    if (business && products.length > 0) loadReport()
  }, [reportDate, products])

  async function loadBaseData() {
    if (!business) return
    try {
      const [productsData, suppliersData, pricesData] = await Promise.all([
        productsAPI.getAll(),
        suppliersAPI.getAll(),
        pricesAPI.getAll(),
      ])
      setProducts(productsData.products.filter((p: Product) => p.is_active))
      setSuppliers(suppliersData.suppliers)
      setPrices(pricesData.prices)
    } catch (error) {
      toast.error('Failed to load data')
    }
  }

  async function loadReport() {
    if (!business) return
    setLoading(true)

    try {
      const [todayEntries, yesterdayEntries, receivedToday, financesData] = await Promise.all([
        stockAPI.getEntries(reportDate),
        stockAPI.getEntries(yesterday(reportDate)),
        stockAPI.getReceived(reportDate),
        financesAPI.get(reportDate),
      ])

      const newMomo = financesData.finances?.momo > 0 ? String(financesData.finances.momo) : ''
      const newCash = financesData.finances?.cash > 0 ? String(financesData.finances.cash) : ''
      const newDebts = financesData.debts?.length > 0
        ? financesData.debts.map((d: any) => ({ id: d.id, client_name: d.client_name, amount: String(d.amount), is_paid: d.is_paid ?? false }))
        : [{ client_name: '', amount: '', is_paid: false }]
      const newExpenses = financesData.expenses?.length > 0
        ? financesData.expenses.map((e: any) => ({ id: e.id, description: e.description, amount: String(e.amount) }))
        : [{ description: '', amount: '' }]

      setMomo(newMomo)
      setCash(newCash)
      setDebts(newDebts)
      setExpenses(newExpenses)
      setSavedSnapshot(JSON.stringify({ momo: newMomo, cash: newCash, debts: newDebts, expenses: newExpenses }))
      setSaveStatus('saved')

      const todayEntriesList = todayEntries.entries
      const yesterdayEntriesList = yesterdayEntries.entries
      const receivedList = receivedToday.received

      if (!todayEntriesList?.length) {
        setSaleRows([])
        setHasData(false)
        setLoading(false)
        return
      }

      setHasData(true)
      const rows: SaleRow[] = []

      products.forEach(product => {
        const supplier = suppliers.find(s => s.id === product.supplier_id)
        if (!supplier) return

        const todayEntry = todayEntriesList.find((e: any) => e.product_id === product.id)
        const yesterdayEntry = yesterdayEntriesList?.find((e: any) => e.product_id === product.id)
        const received = receivedList?.find((r: any) => r.product_id === product.id)

        if (!todayEntry) return

        const todayPieces = stockToPieces(todayEntry.casses, todayEntry.halves, todayEntry.pieces, product.pieces_per_casse)
        const yesterdayPieces = yesterdayEntry ? stockToPieces(yesterdayEntry.casses, yesterdayEntry.halves, yesterdayEntry.pieces, product.pieces_per_casse) : 0
        const receivedPieces = received ? stockToPieces(received.supplier_casses + received.return_casses, received.return_halves, received.return_pieces, product.pieces_per_casse) : 0

        const soldPieces = yesterdayPieces + receivedPieces - todayPieces
        if (soldPieces <= 0) return

        const sold = piecesToStock(soldPieces, product.pieces_per_casse)
        const pricePerCasse = getPriceForDate(prices, product.id, reportDate)
        const revenue = pricePerCasse ? (soldPieces / product.pieces_per_casse) * pricePerCasse : 0

        rows.push({
          product, supplier, soldPieces,
          soldCasses: sold.casses,
          soldHalves: sold.halves,
          soldRemainingPieces: sold.pieces,
          pricePerCasse, revenue,
        })
      })

      setSaleRows(rows)
    } catch (error) {
      toast.error('Failed to load report')
    } finally {
      setLoading(false)
    }
  }

  function formatNumberInput(value: string): string {
    if (!value) return ''
    const num = value.replace(/,/g, '')
    if (isNaN(Number(num))) return value
    return Number(num).toLocaleString()
  }

  function parseNumberInput(value: string): string {
    return value.replace(/,/g, '')
  }

  // Format amount without RWF suffix
  function formatAmount(amount: number): string {
    return Math.round(amount).toLocaleString()
  }

  async function executeConfirmAction() {
    if (!confirmAction) return

    if (confirmAction.type === 'delete_debt') {
      setDebts(debts.filter((_, idx) => idx !== confirmAction.index))
      setSaveStatus('idle')
    }

    if (confirmAction.type === 'delete_expense') {
      setExpenses(expenses.filter((_, idx) => idx !== confirmAction.index))
      setSaveStatus('idle')
    }

    if (confirmAction.type === 'toggle_debt') {
      const i = confirmAction.index
      const debt = debts[i]
      const updated = [...debts]
      updated[i] = { ...updated[i], is_paid: !updated[i].is_paid }
      setDebts(updated)

      if (debt.id) {
        try {
          await financesAPI.updateDebtPaid(debt.id, !debt.is_paid)
          setSavedSnapshot(prev => {
            const parsed = JSON.parse(prev)
            parsed.debts = parsed.debts.map((d: DebtEntry, idx: number) =>
              idx === i ? { ...d, is_paid: !d.is_paid } : d
            )
            return JSON.stringify(parsed)
          })
          toast.success(debt.is_paid ? 'Marked as unpaid' : 'Marked as paid ✅')
        } catch {
          toast.error('Failed to update debt')
        }
      }
    }

    setConfirmAction(null)
  }

  async function saveFinances() {
    if (!business) return
    setSaveStatus('saving')

    try {
      await financesAPI.save(reportDate, {
        momo: parseFloat(parseNumberInput(momo)) || 0,
        cash: parseFloat(parseNumberInput(cash)) || 0,
        debts: debts.map(d => ({
          client_name: d.client_name,
          amount: parseFloat(parseNumberInput(d.amount)) || 0,
          is_paid: d.is_paid,
        })),
        expenses: expenses.map(e => ({
          description: e.description,
          amount: parseFloat(parseNumberInput(e.amount)) || 0,
        })),
      })

      setSaveStatus('saved')
      setSavedSnapshot(currentSnapshot)
      toast.success('Finances saved!')
      loadReport()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong')
      setSaveStatus('idle')
    }
  }

  const totalRevenue = saleRows.reduce((sum, r) => sum + r.revenue, 0)
  const totalMomo = parseFloat(parseNumberInput(momo)) || 0
  const totalCash = parseFloat(parseNumberInput(cash)) || 0
  const totalDebts = debts.reduce((sum, d) => sum + (parseFloat(parseNumberInput(d.amount)) || 0), 0)
  const totalExpenses = expenses.reduce((sum, e) => sum + (parseFloat(parseNumberInput(e.amount)) || 0), 0)
  const totalCollected = totalMomo + totalCash + totalDebts + totalExpenses
  const difference = totalCollected - totalRevenue
  const hasFinances = totalMomo > 0 || totalCash > 0 || totalDebts > 0 || totalExpenses > 0
  const isSaveDisabled = saveStatus === 'saving' || (saveStatus === 'saved' && !hasUnsavedChanges)

  const supplierRevenues = suppliers.map(supplier => ({
    supplier,
    revenue: saleRows.filter(r => r.supplier.id === supplier.id).reduce((sum, r) => sum + r.revenue, 0),
  }))

  function getConfirmMessage(): { title: string; message: string; confirmLabel: string; danger: boolean } {
    if (!confirmAction) return { title: '', message: '', confirmLabel: '', danger: false }
    if (confirmAction.type === 'delete_debt') {
      const debt = debts[confirmAction.index]
      return { title: 'Remove debt?', message: `Remove ${debt.client_name || 'this debt'} (${formatNumberInput(debt.amount)} RWF)?`, confirmLabel: 'Yes, remove', danger: true }
    }
    if (confirmAction.type === 'delete_expense') {
      const expense = expenses[confirmAction.index]
      return { title: 'Remove expense?', message: `Remove "${expense.description || 'this expense'}" (${formatNumberInput(expense.amount)} RWF)?`, confirmLabel: 'Yes, remove', danger: true }
    }
    if (confirmAction.type === 'toggle_debt') {
      const debt = debts[confirmAction.index]
      return {
        title: debt.is_paid ? 'Mark as unpaid?' : 'Mark as paid?',
        message: debt.is_paid ? `Mark ${debt.client_name} as unpaid again?` : `Confirm ${debt.client_name} paid ${formatNumberInput(debt.amount)} RWF?`,
        confirmLabel: debt.is_paid ? 'Yes, mark unpaid' : 'Yes, mark paid',
        danger: false,
      }
    }
    return { title: '', message: '', confirmLabel: '', danger: false }
  }

  const confirmMsg = getConfirmMessage()

  return (
    <div>
      {/* Confirm popup */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${confirmMsg.danger ? 'bg-red-100' : 'bg-green-100'}`}>
                {confirmMsg.danger ? (
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <h2 className="text-lg font-semibold text-gray-900">{confirmMsg.title}</h2>
            </div>
            <p className="text-gray-500 text-sm mb-6">{confirmMsg.message}</p>
            <div className="flex gap-3">
              <button onClick={executeConfirmAction} className={confirmMsg.danger ? 'btn-danger flex-1' : 'btn-primary flex-1'}>
                {confirmMsg.confirmLabel}
              </button>
              <button onClick={() => setConfirmAction(null)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <h1 className="page-title mb-0">Reports</h1>
        <div>
          <label className="label text-xs">Report date</label>
          <input
            type="date"
            className="input w-auto text-base"
            value={reportDate}
            onChange={e => { setReportDate(e.target.value); setSaveStatus('idle') }}
            max={today()}
          />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {[1, 2].map(i => (
            <div key={i} className="card animate-pulse h-48">
              <div className="h-4 bg-gray-200 rounded mb-3 w-2/3"></div>
              <div className="h-8 bg-gray-200 rounded w-full"></div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* LEFT — Revenue */}
            <div className="card">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Revenue</p>
              {!hasData ? (
                <p className="text-gray-400 text-sm text-center py-4">No stock entry for {formatDate(reportDate)}</p>
              ) : (
                <div className="space-y-2">
                  {supplierRevenues.map(({ supplier, revenue }) => (
                    <div key={supplier.id} className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="text-sm text-gray-700">{supplier.name} Revenue</span>
                      <span className="font-semibold text-gray-900">{formatRWF(revenue)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-2 border-t-2 border-gray-800">
                    <span className="font-bold text-gray-900">Total Revenue</span>
                    <span className="font-bold text-xl text-gray-900">{formatRWF(totalRevenue)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT — Money collected */}
            <div className="card">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Money collected</p>

              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-gray-700">MoMo</label>
                <input type="text" inputMode="numeric" className="input text-right w-40 text-sm" placeholder="0"
                  value={formatNumberInput(momo)}
                  onChange={e => { setMomo(parseNumberInput(e.target.value)); setSaveStatus('idle') }} />
              </div>

              <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-100">
                <label className="text-sm text-gray-700">Cash</label>
                <input type="text" inputMode="numeric" className="input text-right w-40 text-sm" placeholder="0"
                  value={formatNumberInput(cash)}
                  onChange={e => { setCash(parseNumberInput(e.target.value)); setSaveStatus('idle') }} />
              </div>

              {/* Debts */}
              <div className="mb-3 pb-3 border-b border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-700">Debts given</p>
                  <button onClick={() => { setDebts([...debts, { client_name: '', amount: '', is_paid: false }]); setSaveStatus('idle') }}
                    className="text-xs text-blue-600 font-medium hover:text-blue-800">+ Add client</button>
                </div>
                {debts.map((debt, i) => (
                  <div key={i} className="mb-2">
                    <div className="flex gap-2 items-center">
                      <button
                        onClick={() => setConfirmAction({ type: 'toggle_debt', index: i })}
                        className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                          debt.is_paid ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 hover:border-green-400'
                        }`}
                      >
                        {debt.is_paid && (
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                      <input type="text"
                        className={`input flex-1 text-sm ${debt.is_paid ? 'line-through bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}
                        placeholder="Client name" value={debt.client_name}
                        onChange={e => { const u = [...debts]; u[i] = { ...u[i], client_name: e.target.value }; setDebts(u); setSaveStatus('idle') }} />
                      <input type="text" inputMode="numeric"
                        className={`input w-28 text-right text-sm ${debt.is_paid ? 'line-through bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}
                        placeholder="Amount" value={formatNumberInput(debt.amount)}
                        onChange={e => { const u = [...debts]; u[i] = { ...u[i], amount: parseNumberInput(e.target.value) }; setDebts(u); setSaveStatus('idle') }} />
                      <button onClick={() => setConfirmAction({ type: 'delete_debt', index: i })}
                        className="text-red-400 hover:text-red-600 font-bold text-lg shrink-0">×</button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Expenses */}
              <div className="mb-3 pb-3 border-b border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-700">Expenses</p>
                  <button onClick={() => { setExpenses([...expenses, { description: '', amount: '' }]); setSaveStatus('idle') }}
                    className="text-xs text-blue-600 font-medium hover:text-blue-800">+ Add expense</button>
                </div>
                {expenses.map((expense, i) => (
                  <div key={i} className="flex gap-2 items-center mb-1.5">
                    <input type="text" className="input flex-1 text-sm" placeholder="e.g. Transport"
                      value={expense.description}
                      onChange={e => { const u = [...expenses]; u[i] = { ...u[i], description: e.target.value }; setExpenses(u); setSaveStatus('idle') }} />
                    <input type="text" inputMode="numeric" className="input w-32 text-right text-sm" placeholder="Amount"
                      value={formatNumberInput(expense.amount)}
                      onChange={e => { const u = [...expenses]; u[i] = { ...u[i], amount: parseNumberInput(e.target.value) }; setExpenses(u); setSaveStatus('idle') }} />
                    {expenses.length > 1 && (
                      <button onClick={() => setConfirmAction({ type: 'delete_expense', index: i })}
                        className="text-red-400 hover:text-red-600 font-bold text-lg shrink-0">×</button>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center pt-1 border-t-2 border-gray-800 mb-4">
                <span className="font-bold text-gray-900">Total</span>
                <span className="font-bold text-xl text-gray-900">{formatRWF(totalCollected)}</span>
              </div>

              <button
                onClick={saveFinances}
                disabled={isSaveDisabled}
                className={`w-full text-sm font-medium px-4 py-2 rounded-lg transition-all ${
                  saveStatus === 'saved' && !hasUnsavedChanges
                    ? 'bg-green-100 text-green-700 border border-green-300 cursor-not-allowed'
                    : saveStatus === 'saving'
                    ? 'bg-blue-400 text-white cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' && !hasUnsavedChanges ? '✅ Saved' : 'Save finances'}
              </button>
            </div>
          </div>

          {/* Balance result */}
          {hasFinances && hasData && (
            <div className={`card mb-6 border-2 ${difference === 0 ? 'border-green-400 bg-green-50' : difference > 0 ? 'border-blue-400 bg-blue-50' : 'border-red-400 bg-red-50'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide mb-1 text-gray-500">
                    {difference === 0 ? 'Net' : difference > 0 ? 'Surplus' : 'Deficit'}
                  </p>
                  <p className={`text-2xl font-bold ${difference === 0 ? 'text-green-700' : difference > 0 ? 'text-blue-700' : 'text-red-700'}`}>
                    {difference === 0 ? 'Balanced — 0 RWF' : difference > 0 ? `+${formatRWF(difference)}` : `-${formatRWF(Math.abs(difference))}`}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Collected {formatRWF(totalCollected)} · Revenue {formatRWF(totalRevenue)}</p>
                </div>
                <div className="text-4xl">{difference === 0 ? '⚖️' : difference > 0 ? '📈' : '📉'}</div>
              </div>
            </div>
          )}

          {/* Sales table */}
          {!hasData ? (
            <div className="card text-center py-12">
              <p className="text-gray-500 text-lg">No entry found for {formatDate(reportDate)}</p>
              <p className="text-gray-400 text-sm mt-2">Make sure you have saved a daily entry for this date.</p>
            </div>
          ) : (
            <>
              {suppliers.map(supplier => {
                const supplierRows = saleRows.filter(r => r.supplier.id === supplier.id)
                if (supplierRows.length === 0) return null
                return (
                  <div key={supplier.id} className="card mb-4">
                    <div className="section-title">{supplier.name}</div>
                    <div className="space-y-1">
                      {supplierRows.map(row => (
                        <div key={row.product.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0 gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 text-sm truncate">{row.product.name}</p>
                            <p className="text-xs text-gray-400">{formatStock(row.soldCasses, row.soldHalves, row.soldRemainingPieces)} sold</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-semibold text-green-700 text-sm">
                              {row.revenue > 0 ? formatAmount(row.revenue) : '—'}
                            </p>
                            <p className="text-xs text-gray-400">
                              {row.pricePerCasse ? `${formatAmount(row.pricePerCasse)}/casse` : <span className="text-red-500">No price</span>}
                            </p>
                          </div>
                        </div>
                      ))}
                      <div className="flex justify-between items-center pt-2 bg-gray-50 rounded-lg px-3 py-2 mt-1">
                        <span className="font-semibold text-gray-700 text-sm">{supplier.name} subtotal</span>
                        <span className="font-bold text-gray-900">
                          {formatAmount(supplierRows.reduce((sum, r) => sum + r.revenue, 0))}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
              <div className="card bg-gray-900 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm">Grand total for {formatDate(reportDate)}</p>
                    <p className="text-3xl font-bold mt-1">{formatRWF(totalRevenue)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-400 text-sm">Products sold</p>
                    <p className="text-3xl font-bold mt-1">{saleRows.length}</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}