import { useEffect, useState } from 'react'
import { adminAPI } from '../../lib/api'
import type { Business } from '../../lib/types'
import toast from 'react-hot-toast'

type ConfirmAction =
  | { type: 'delete'; business: Business }
  | { type: 'deactivate'; business: Business }
  | null

export default function AdminBusinesses() {
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'pending'>('all')
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const data = await adminAPI.getBusinesses()
      setBusinesses(data.businesses)
    } catch {
      toast.error('Failed to load businesses')
    } finally {
      setLoading(false)
    }
  }

  async function executeConfirm() {
    if (!confirmAction) return

    try {
      if (confirmAction.type === 'delete') {
        await adminAPI.deleteBusiness(confirmAction.business.id)
        toast.success(`${confirmAction.business.business_name} deleted`)
      } else if (confirmAction.type === 'deactivate') {
        await adminAPI.activateBusiness(confirmAction.business.id, false)
        toast.success(`${confirmAction.business.business_name} deactivated`)
      }
      loadData()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed')
    }

    setConfirmAction(null)
  }

  async function activate(b: Business) {
    try {
      await adminAPI.activateBusiness(b.id, true)
      toast.success(`${b.business_name} activated! ✅`)
      loadData()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed')
    }
  }

  const filtered = businesses.filter(b => {
    const matchesSearch =
      b.business_name.toLowerCase().includes(search.toLowerCase()) ||
      b.owner_name.toLowerCase().includes(search.toLowerCase()) ||
      b.email.toLowerCase().includes(search.toLowerCase())
    const matchesFilter =
      filter === 'all' ||
      (filter === 'active' ? b.is_active : !b.is_active)
    return matchesSearch && matchesFilter
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-purple-500">Loading...</div>
      </div>
    )
  }

  return (
    <div>
      {/* Confirm popup */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900">
                {confirmAction.type === 'delete' ? 'Delete business?' : 'Deactivate business?'}
              </h2>
            </div>
            <p className="text-gray-500 text-sm mb-2">
              <span className="font-medium text-gray-700">{confirmAction.business.business_name}</span>
              {' '}— {confirmAction.business.owner_name}
            </p>
            <p className="text-gray-400 text-sm mb-6">
              {confirmAction.type === 'delete'
                ? 'This will permanently delete this business and all its data. This cannot be undone!'
                : 'This will deactivate this business. They will not be able to log in.'}
            </p>
            <div className="flex gap-3">
              <button
                onClick={executeConfirm}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700 transition-colors"
              >
                {confirmAction.type === 'delete' ? 'Yes, delete' : 'Yes, deactivate'}
              </button>
              <button
                onClick={() => setConfirmAction(null)}
                className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Businesses</h1>
        <p className="text-gray-500 mt-1">Manage all registered businesses</p>
      </div>

      {/* Search and filter */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <input
          type="text"
          className="input flex-1 min-w-48"
          placeholder="Search by name, owner or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="flex gap-2">
          {(['all', 'active', 'pending'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                filter === f
                  ? 'bg-purple-600 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Business cards */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center">
            <p className="text-gray-400">No businesses found</p>
          </div>
        ) : (
          filtered.map(b => (
            <div
              key={b.id}
              className={`bg-white rounded-xl border shadow-sm p-4 ${
                !b.is_active ? 'border-orange-200' : 'border-gray-100'
              }`}
            >
              <div className="flex items-start justify-between flex-wrap gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className="font-semibold text-gray-900">{b.business_name}</p>
                    {b.is_active ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Active</span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">Pending</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">{b.owner_name}</p>
                  <p className="text-sm text-gray-400">{b.email}</p>
                  {b.phone && <p className="text-sm text-gray-400">📞 {b.phone}</p>}
                  {b.location && <p className="text-sm text-gray-400">📍 {b.location}</p>}
                  <p className="text-xs text-gray-300 mt-1">
                    Registered: {new Date(b.created_at).toLocaleDateString()}
                  </p>
                  {b.payment_date && (
                    <p className="text-xs text-green-500">
                      Paid: {new Date(b.payment_date).toLocaleDateString()}
                    </p>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 flex-wrap">
                  {!b.is_active ? (
                    <button
                      onClick={() => activate(b)}
                      className="text-sm font-medium px-3 py-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
                    >
                      ✅ Activate
                    </button>
                  ) : (
                    <button
                      onClick={() => setConfirmAction({ type: 'deactivate', business: b })}
                      className="text-sm font-medium px-3 py-1.5 rounded-lg bg-orange-50 text-orange-600 hover:bg-orange-100 transition-colors"
                    >
                      Deactivate
                    </button>
                  )}
                  <button
                    onClick={() => setConfirmAction({ type: 'delete', business: b })}
                    className="text-sm font-medium px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}