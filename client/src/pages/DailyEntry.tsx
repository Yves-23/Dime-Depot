import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { stockAPI, suppliersAPI, productsAPI } from '../lib/api'
import type { Product, Supplier, StockEntry } from '../lib/types'
import { stockToPieces, formatStock, today, yesterday } from '../lib/helpers'
import toast from 'react-hot-toast'

interface StockInputRow {
  product: Product
  supplier: Supplier
  casses: string
  halves: string
  pieces: string
  supplier_casses: string
  return_casses: string
  return_halves: string
  return_pieces: string
}

interface ReceivedPopup {
  productIndex: number
  productName: string
  supplier_casses: string
  return_casses: string
  return_halves: string
  return_pieces: string
}

interface OverstockWarning {
  productName: string
  todayPieces: number
  maxAllowedPieces: number
  yesterdayPieces: number
  receivedPieces: number
  piecesPerCasse: number
}

export default function DailyEntry() {
  const { business } = useAuth()
  const [rows, setRows] = useState<StockInputRow[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [entryDate, setEntryDate] = useState(today())
  const [yesterdayEntries, setYesterdayEntries] = useState<StockEntry[]>([])
  const [existingEntries, setExistingEntries] = useState<StockEntry[]>([])
  const [receivedPopup, setReceivedPopup] = useState<ReceivedPopup | null>(null)
  const [overstockWarning, setOverstockWarning] = useState<OverstockWarning | null>(null)

  useEffect(() => {
    if (business) loadData()
  }, [business, entryDate])

  async function loadData() {
    setLoading(true)
    try {
      const [productsData, suppliersData, yesterdayData, existingData, existingReceivedData] =
        await Promise.all([
          productsAPI.getAll(),
          suppliersAPI.getAll(),
          stockAPI.getEntries(yesterday(entryDate)),
          stockAPI.getEntries(entryDate),
          stockAPI.getReceived(entryDate),
        ])

      const products: Product[] = productsData.products.filter((p: Product) => p.is_active)
      const suppliersData2: Supplier[] = suppliersData.suppliers
      const existing = existingData.entries
      const existingRec = existingReceivedData.received

      setSuppliers(suppliersData2)
      setYesterdayEntries(yesterdayData.entries)
      setExistingEntries(existing)

      const newRows: StockInputRow[] = products.map(product => {
        const supplier = suppliersData2.find(s => s.id === product.supplier_id) as Supplier
        const existingEntry = existing.find((e: StockEntry) => e.product_id === product.id)
        const existingRec_ = existingRec.find((r: any) => r.product_id === product.id)
        const hasReceived = existingRec_ && (
          existingRec_.supplier_casses > 0 ||
          existingRec_.return_casses > 0 ||
          existingRec_.return_halves > 0 ||
          existingRec_.return_pieces > 0
        )

        return {
          product,
          supplier,
          casses: existingEntry ? String(existingEntry.casses) : '',
          halves: existingEntry ? String(existingEntry.halves) : '0',
          pieces: existingEntry ? String(existingEntry.pieces) : '',
          supplier_casses: hasReceived ? String(existingRec_.supplier_casses) : '0',
          return_casses: hasReceived ? String(existingRec_.return_casses) : '0',
          return_halves: hasReceived ? String(existingRec_.return_halves) : '0',
          return_pieces: hasReceived ? String(existingRec_.return_pieces) : '0',
        }
      })

      setRows(newRows)
    } catch (error) {
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  function updateRow(index: number, field: keyof StockInputRow, value: string) {
    const updated = [...rows]
    updated[index] = { ...updated[index], [field]: value }
    setRows(updated)
  }

  function getYesterdayStock(productId: string): string {
    const entry = yesterdayEntries.find(e => e.product_id === productId)
    if (!entry) return '—'
    return formatStock(entry.casses, entry.halves, entry.pieces)
  }

  function hasReceivedStock(row: StockInputRow): boolean {
    return (
      parseInt(row.supplier_casses) > 0 ||
      parseInt(row.return_casses) > 0 ||
      parseInt(row.return_halves) > 0 ||
      parseInt(row.return_pieces) > 0
    )
  }

  function openReceivedPopup(index: number) {
    const row = rows[index]
    setReceivedPopup({
      productIndex: index,
      productName: row.product.name,
      supplier_casses: row.supplier_casses,
      return_casses: row.return_casses,
      return_halves: row.return_halves,
      return_pieces: row.return_pieces,
    })
  }

  function saveReceivedPopup() {
    if (!receivedPopup) return
    const index = receivedPopup.productIndex
    const updated = [...rows]
    updated[index] = {
      ...updated[index],
      supplier_casses: receivedPopup.supplier_casses,
      return_casses: receivedPopup.return_casses,
      return_halves: receivedPopup.return_halves,
      return_pieces: receivedPopup.return_pieces,
    }
    setRows(updated)
    setReceivedPopup(null)
    toast.success('Received stock added! Click Save to confirm.')
  }

  function validateStock(): OverstockWarning | null {
    // Only validate if we have yesterday's entries
    if (yesterdayEntries.length === 0) return null

    for (const row of rows) {
      const yesterdayEntry = yesterdayEntries.find(e => e.product_id === row.product.id)
      if (!yesterdayEntry) continue

      const ppc = row.product.pieces_per_casse

      const yesterdayPieces = stockToPieces(
        yesterdayEntry.casses,
        yesterdayEntry.halves,
        yesterdayEntry.pieces,
        ppc
      )

      const receivedPieces = stockToPieces(
        parseInt(row.supplier_casses) + parseInt(row.return_casses),
        parseInt(row.return_halves),
        parseInt(row.return_pieces),
        ppc
      )

      const todayPieces = stockToPieces(
        parseInt(row.casses) || 0,
        parseInt(row.halves) || 0,
        parseInt(row.pieces) || 0,
        ppc
      )

      const maxAllowed = yesterdayPieces + receivedPieces

      if (todayPieces > maxAllowed) {
        return {
          productName: row.product.name,
          todayPieces,
          maxAllowedPieces: maxAllowed,
          yesterdayPieces,
          receivedPieces,
          piecesPerCasse: ppc,
        }
      }
    }

    return null
  }

  async function saveEntry() {
    // Validate stock before saving
    const warning = validateStock()
    if (warning) {
      setOverstockWarning(warning)
      return
    }

    setSaving(true)
    try {
      const entries = rows.map(row => ({
        product_id: row.product.id,
        casses: parseInt(row.casses) || 0,
        halves: parseInt(row.halves) || 0,
        pieces: parseInt(row.pieces) || 0,
      }))

      const received = rows.map(row => ({
        product_id: row.product.id,
        supplier_casses: parseInt(row.supplier_casses) || 0,
        return_casses: parseInt(row.return_casses) || 0,
        return_halves: parseInt(row.return_halves) || 0,
        return_pieces: parseInt(row.return_pieces) || 0,
      }))

      await Promise.all([
        stockAPI.bulkSaveEntries(entries, entryDate),
        stockAPI.bulkSaveReceived(received, entryDate),
      ])

      toast.success('Entry saved successfully!')
      loadData()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div>
        <h1 className="page-title">Daily Entry</h1>
        <div className="card text-center py-8">
          <p className="text-gray-500">No active products found.</p>
          <p className="text-gray-400 text-sm mt-1">Add products first before entering stock.</p>
        </div>
      </div>
    )
  }

  const supplierGroups = suppliers.map(supplier => ({
    supplier,
    rows: rows.filter(r => r.supplier?.id === supplier.id),
  })).filter(g => g.rows.length > 0)

  return (
    <div>
      {/* Overstock warning popup */}
      {overstockWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Stock too high!</h2>
            </div>

            <p className="text-gray-700 font-medium mb-2">{overstockWarning.productName}</p>

            <div className="bg-orange-50 rounded-lg p-3 mb-4 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Yesterday's closing</span>
                <span className="font-medium">{formatStock(
                  Math.floor(overstockWarning.yesterdayPieces / overstockWarning.piecesPerCasse),
                  0,
                  overstockWarning.yesterdayPieces % overstockWarning.piecesPerCasse
                )}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Received today</span>
                <span className="font-medium text-blue-600">{formatStock(
                  Math.floor(overstockWarning.receivedPieces / overstockWarning.piecesPerCasse),
                  0,
                  overstockWarning.receivedPieces % overstockWarning.piecesPerCasse
                )}</span>
              </div>
              <div className="flex justify-between border-t border-orange-200 pt-1">
                <span className="text-gray-500">Max allowed today</span>
                <span className="font-semibold text-gray-900">{formatStock(
                  Math.floor(overstockWarning.maxAllowedPieces / overstockWarning.piecesPerCasse),
                  0,
                  overstockWarning.maxAllowedPieces % overstockWarning.piecesPerCasse
                )}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">You entered</span>
                <span className="font-semibold text-red-600">{formatStock(
                  Math.floor(overstockWarning.todayPieces / overstockWarning.piecesPerCasse),
                  0,
                  overstockWarning.todayPieces % overstockWarning.piecesPerCasse
                )}</span>
              </div>
            </div>

            <p className="text-sm text-gray-500 mb-5">
              Today's stock cannot be higher than yesterday's closing stock plus what you received today. If you received new stock, please tap the <span className="font-bold text-blue-600">+</span> button next to the product first.
            </p>

            <button
              onClick={() => setOverstockWarning(null)}
              className="btn-primary w-full"
            >
              Go back and fix it
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="page-title mb-0">Daily Entry</h1>
        <div className="flex items-center gap-2">
          <input
            type="date"
            className="input w-auto text-base"
            value={entryDate}
            onChange={e => setEntryDate(e.target.value)}
            max={today()}
          />
          <button onClick={saveEntry} disabled={saving} className="btn-primary">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {existingEntries.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4 text-sm text-green-800">
          ✅ Entry already saved for {entryDate}. You can update it below.
        </div>
      )}
      {yesterdayEntries.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-4 text-sm text-yellow-800">
          ⚠️ No entry for yesterday. Stock validation will not be available.
        </div>
      )}

      {/* Received stock popup */}
      {receivedPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-5 w-full max-w-sm shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Stock received</h2>
            <p className="text-sm text-blue-600 font-medium mb-4">{receivedPopup.productName}</p>
            <div className="bg-blue-50 rounded-xl p-3 mb-3">
              <p className="text-xs font-semibold text-blue-700 mb-2">📦 From supplier (full casses only)</p>
              <input
                type="number" min="0"
                className="input text-center text-base py-3 bg-white border-blue-200"
                placeholder="0"
                value={receivedPopup.supplier_casses === '0' ? '' : receivedPopup.supplier_casses}
                onChange={e => setReceivedPopup({ ...receivedPopup, supplier_casses: e.target.value || '0' })}
                autoFocus
              />
            </div>
            <div className="bg-orange-50 rounded-xl p-3 mb-4">
              <p className="text-xs font-semibold text-orange-700 mb-2">↩️ Customer returns</p>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-orange-500 block mb-1">Casses</label>
                  <input type="number" min="0" className="input text-center py-3 bg-white border-orange-200" placeholder="0"
                    value={receivedPopup.return_casses === '0' ? '' : receivedPopup.return_casses}
                    onChange={e => setReceivedPopup({ ...receivedPopup, return_casses: e.target.value || '0' })} />
                </div>
                <div>
                  <label className="text-xs text-orange-500 block mb-1">1/2</label>
                  <select className="input text-center py-3 bg-white border-orange-200"
                    value={receivedPopup.return_halves}
                    onChange={e => setReceivedPopup({ ...receivedPopup, return_halves: e.target.value })}>
                    <option value="0">0</option>
                    <option value="1">1/2</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-orange-500 block mb-1">Pieces</label>
                  <input type="number" min="0" className="input text-center py-3 bg-white border-orange-200" placeholder="0"
                    value={receivedPopup.return_pieces === '0' ? '' : receivedPopup.return_pieces}
                    onChange={e => setReceivedPopup({ ...receivedPopup, return_pieces: e.target.value || '0' })} />
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={saveReceivedPopup} className="btn-primary flex-1">Confirm</button>
              <button onClick={() => setReceivedPopup(null)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {supplierGroups.map(({ supplier, rows: supplierRows }) => (
          <div key={supplier.id} className="bg-white border border-gray-200 rounded-xl shadow-sm p-3">
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-100">
              <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
                <span className="text-white font-bold text-sm">{supplier.name.charAt(0)}</span>
              </div>
              <h2 className="font-semibold text-gray-800">{supplier.name}</h2>
            </div>

            <div className="grid grid-cols-10 gap-1 mb-1 px-1">
              <div className="col-span-3 text-xs text-gray-400 font-medium">Product</div>
              <div className="col-span-2 text-xs text-gray-400 font-medium text-center">Casses</div>
              <div className="col-span-2 text-xs text-gray-400 font-medium text-center">1/2</div>
              <div className="col-span-2 text-xs text-gray-400 font-medium text-center">Pcs</div>
              <div className="col-span-1 text-xs text-gray-400 font-medium text-center">+</div>
            </div>

            <div className="space-y-1">
              {supplierRows.map(row => {
                const globalIndex = rows.indexOf(row)
                const hasReceived = hasReceivedStock(row)

                // Highlight row red if overstock
                const yesterdayEntry = yesterdayEntries.find(e => e.product_id === row.product.id)
                const ppc = row.product.pieces_per_casse
                const yesterdayPieces = yesterdayEntry ? stockToPieces(yesterdayEntry.casses, yesterdayEntry.halves, yesterdayEntry.pieces, ppc) : null
                const receivedPieces = stockToPieces(
                  parseInt(row.supplier_casses) + parseInt(row.return_casses),
                  parseInt(row.return_halves),
                  parseInt(row.return_pieces),
                  ppc
                )
                const todayPieces = stockToPieces(parseInt(row.casses) || 0, parseInt(row.halves) || 0, parseInt(row.pieces) || 0, ppc)
                const isOverstock = yesterdayPieces !== null && todayPieces > (yesterdayPieces + receivedPieces)

                return (
                  <div key={row.product.id}>
                    <div className={`grid grid-cols-10 gap-1 items-center px-1 py-1 rounded-lg ${isOverstock ? 'bg-red-50' : ''}`}>
                      <div className="col-span-3">
                        <p className={`text-xs font-semibold leading-tight truncate ${isOverstock ? 'text-red-700' : 'text-gray-800'}`}>{row.product.name}</p>
                        <p className="text-xs text-gray-400 leading-tight">{getYesterdayStock(row.product.id)}</p>
                      </div>
                      <div className="col-span-2">
                        <input type="number" min="0"
                          className={`input text-center text-sm py-2 px-0.5 ${isOverstock ? 'border-red-400 bg-red-50' : ''}`}
                          placeholder="0"
                          value={row.casses} onChange={e => updateRow(globalIndex, 'casses', e.target.value)} />
                      </div>
                      <div className="col-span-2">
                        <select
                          className={`input text-center text-sm py-2 px-0.5 ${isOverstock ? 'border-red-400 bg-red-50' : ''}`}
                          value={row.halves} onChange={e => updateRow(globalIndex, 'halves', e.target.value)}>
                          <option value="0">0</option>
                          <option value="1">½</option>
                        </select>
                      </div>
                      <div className="col-span-2">
                        <input type="number" min="0"
                          className={`input text-center text-sm py-2 px-0.5 ${isOverstock ? 'border-red-400 bg-red-50' : ''}`}
                          placeholder="0"
                          value={row.pieces} onChange={e => updateRow(globalIndex, 'pieces', e.target.value)} />
                      </div>
                      <div className="col-span-1 flex justify-center">
                        <button
                          onClick={() => openReceivedPopup(globalIndex)}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold transition-colors ${
                            hasReceived ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-blue-100 hover:text-blue-600'
                          }`}
                        >+</button>
                      </div>
                    </div>
                    {isOverstock && (
                      <div className="px-1 pb-1">
                        <span className="text-xs text-red-500 font-medium">
                          ⚠️ Too high! Use + to add received stock first
                        </span>
                      </div>
                    )}
                    {hasReceived && !isOverstock && (
                      <div className="px-1 pb-1">
                        <span className="text-xs text-blue-500 font-medium">
                          {parseInt(row.supplier_casses) > 0 && `📦 +${row.supplier_casses} from supplier `}
                          {(parseInt(row.return_casses) > 0 || parseInt(row.return_halves) > 0 || parseInt(row.return_pieces) > 0) && `↩️ return`}
                        </span>
                      </div>
                    )}
                    <div className="h-px bg-gray-100"></div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="sticky bottom-4 flex justify-end mt-4">
        <button onClick={saveEntry} disabled={saving} className="btn-primary px-8 shadow-lg">
          {saving ? 'Saving...' : '💾 Save entry'}
        </button>
      </div>
    </div>
  )
}