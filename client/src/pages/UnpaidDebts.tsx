import { useEffect, useState } from 'react'
import { financesAPI } from '../lib/api'
import { formatRWF } from '../lib/helpers'
import toast from 'react-hot-toast'

interface UnpaidDebt {
  id: string
  client_name: string
  amount: number
  entry_date: string
  is_paid: boolean
}

export default function UnpaidDebts() {
  const [debts, setDebts] = useState<UnpaidDebt[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [markingPaid, setMarkingPaid] = useState<string | null>(null)
  const [confirmDebt, setConfirmDebt] = useState<UnpaidDebt | null>(null)

  useEffect(() => {
    loadDebts()
  }, [])

  async function loadDebts() {
    setLoading(true)
    try {
      const data = await financesAPI.getUnpaidDebts()
      setDebts(data.debts)
    } catch (error) {
      toast.error('Failed to load unpaid debts')
    } finally {
      setLoading(false)
    }
  }

  async function markAsPaid(debt: UnpaidDebt) {
    setMarkingPaid(debt.id)
    try {
      await financesAPI.updateDebtPaid(debt.id, true)
      setDebts(prev => prev.filter(d => d.id !== debt.id))
      toast.success(`${debt.client_name} marked as paid!`)
    } catch (error) {
      toast.error('Failed to mark as paid')
    } finally {
      setMarkingPaid(null)
      setConfirmDebt(null)
    }
  }

  function formatDateSafe(dateStr: string): string {
    const clean = dateStr.split('T')[0]
    const [year, month, day] = clean.split('-').map(Number)
    return new Date(year, month - 1, day).toLocaleDateString('en-RW', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }

  const filtered = debts.filter(d =>
    d.client_name.toLowerCase().includes(search.toLowerCase())
  )

  const totalUnpaid = debts.reduce((sum, d) => sum + Number(d.amount), 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  return (
    <div>
      {/* Confirm popup */}
      {confirmDebt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Mark as paid?</h2>
            </div>
            <p className="text-gray-500 text-sm mb-6">
              Confirm that <span className="font-semibold text-gray-800">{confirmDebt.client_name}</span> paid{' '}
              <span className="font-semibold text-gray-800">{formatRWF(Number(confirmDebt.amount))}</span>{' '}
              taken on {formatDateSafe(confirmDebt.entry_date)}?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => markAsPaid(confirmDebt)}
                disabled={markingPaid === confirmDebt.id}
                className="btn-primary flex-1"
              >
                {markingPaid === confirmDebt.id ? 'Saving...' : 'Yes, mark paid'}
              </button>
              <button
                onClick={() => setConfirmDebt(null)}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="page-title mb-0">Unpaid Debts</h1>
          {totalUnpaid > 0 && (
            <p className="text-red-500 font-semibold text-sm mt-1">
              {debts.length} unpaid — Total: {formatRWF(totalUnpaid)}
            </p>
          )}
        </div>
      </div>

      {/* Search bar */}
      <div className="relative mb-6">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search by client name..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input pl-9 w-full"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xl font-bold"
          >
            x
          </button>
        )}
      </div>

      {/* Content */}
      {debts.length === 0 ? (
        <div className="card text-center py-12">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-gray-700 font-semibold text-lg">All debts are paid!</p>
          <p className="text-gray-400 text-sm mt-1">No outstanding debts at the moment.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-gray-500">No client found matching "{search}"</p>
          <button onClick={() => setSearch('')} className="text-blue-600 text-sm mt-2 font-medium">
            Clear search
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(debt => (
            <div key={debt.id} className="card border border-red-100 bg-red-50/30">
              {/* Date */}
              <p className="text-xs text-gray-400 font-medium mb-2 uppercase tracking-wide">
                {formatDateSafe(debt.entry_date)}
              </p>

              {/* Name + Amount + Button */}
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-gray-900 text-base capitalize">{debt.client_name}</p>
                  <p className="text-red-600 font-bold text-lg">{formatRWF(Number(debt.amount))}</p>
                </div>
                <button
                  onClick={() => setConfirmDebt(debt)}
                  className="shrink-0 bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                >
                  Mark paid
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
