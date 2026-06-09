import { useEffect, useState } from 'react'
import { adminAPI } from '../../lib/api'
import { formatDate } from '../../lib/helpers'
import toast from 'react-hot-toast'
import type { Business } from '../../lib/types'

export default function AdminDashboard() {
  const [stats, setStats] = useState({ total: 0, active: 0, pending: 0 })
  const [recent, setRecent] = useState<Business[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [statsData, businessesData] = await Promise.all([
        adminAPI.getStats(),
        adminAPI.getBusinesses(),
      ])
      setStats(statsData.stats)
      setRecent(businessesData.businesses.slice(0, 5))
    } catch {
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-purple-500">Loading...</div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-500 mt-1">Overview of all businesses on Dime-Depot</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-purple-100 p-6 text-center">
          <p className="text-4xl font-bold text-purple-600">{stats.total}</p>
          <p className="text-sm text-gray-500 mt-2">Total businesses</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-green-100 p-6 text-center">
          <p className="text-4xl font-bold text-green-600">{stats.active}</p>
          <p className="text-sm text-gray-500 mt-2">Active</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-orange-100 p-6 text-center">
          <p className="text-4xl font-bold text-orange-500">{stats.pending}</p>
          <p className="text-sm text-gray-500 mt-2">Pending</p>
        </div>
      </div>

      {/* Pending activation alert */}
      {stats.pending > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6 flex items-center justify-between">
          <div>
            <p className="font-semibold text-orange-800">⚠️ {stats.pending} business{stats.pending > 1 ? 'es' : ''} waiting for activation</p>
            <p className="text-sm text-orange-600 mt-1">Go to Businesses to activate them</p>
          </div>
          <a href="/admin/businesses" className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors">
            View now
          </a>
        </div>
      )}

      {/* Recent registrations */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent registrations</h2>
        {recent.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-4">No businesses yet</p>
        ) : (
          <div className="space-y-3">
            {recent.map(b => (
              <div key={b.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="font-medium text-gray-900">{b.business_name}</p>
                  <p className="text-xs text-gray-400">{b.owner_name} · {b.email}</p>
                </div>
                <div className="text-right">
                  {b.is_active ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Active</span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">Pending</span>
                  )}
                  <p className="text-xs text-gray-400 mt-1">{new Date(b.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}