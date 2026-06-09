import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { adminAPI } from '../lib/api'
import type { Business } from '../lib/types'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'

export default function Admin() {
  const { business } = useAuth()
  const navigate = useNavigate()
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ total: 0, active: 0, pending: 0 })

  useEffect(() => {
    if (!business?.is_admin) {
      navigate('/dashboard')
      return
    }
    loadData()
  }, [business])

  async function loadData() {
    setLoading(true)
    try {
      const [businessesData, statsData] = await Promise.all([
        adminAPI.getBusinesses(),
        adminAPI.getStats(),
      ])
      setBusinesses(businessesData.businesses)
      setStats(statsData.stats)
    } catch (error) {
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  async function toggleActivation(b: Business) {
    try {
      await adminAPI.activateBusiness(b.id, !b.is_active)
      toast.success(b.is_active ? `${b.business_name} deactivated` : `${b.business_name} activated!`)
      loadData()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to update business')
    }
  }

  async function toggleAdmin(b: Business) {
    try {
      await adminAPI.toggleAdmin(b.id, !b.is_admin)
      toast.success(b.is_admin ? 'Admin removed' : 'Admin granted')
      loadData()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to update admin')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="page-title mb-1">Admin Dashboard</h1>
        <p className="text-gray-500 text-sm">Manage all businesses registered on Dime-Depot</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card text-center">
          <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
          <p className="text-sm text-gray-500 mt-1">Total</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-green-600">{stats.active}</p>
          <p className="text-sm text-gray-500 mt-1">Active</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-red-500">{stats.pending}</p>
          <p className="text-sm text-gray-500 mt-1">Pending</p>
        </div>
      </div>

      {/* Pending */}
      {businesses.filter(b => !b.is_active).length > 0 && (
        <div className="mb-6">
          <div className="section-title text-orange-600">
            ⚠️ Pending activation ({businesses.filter(b => !b.is_active).length})
          </div>
          <div className="space-y-3">
            {businesses.filter(b => !b.is_active).map(b => (
              <div key={b.id} className="card border-l-4 border-l-orange-400 flex items-center justify-between flex-wrap gap-4">
                <div>
                  <p className="font-semibold text-gray-900">{b.business_name}</p>
                  <p className="text-sm text-gray-500">{b.owner_name}</p>
                  <p className="text-sm text-gray-500">{b.email}</p>
                  {b.phone && <p className="text-sm text-gray-500">📞 {b.phone}</p>}
                  {b.location && <p className="text-sm text-gray-500">📍 {b.location}</p>}
                  <p className="text-xs text-gray-400 mt-1">Registered: {new Date(b.created_at).toLocaleDateString()}</p>
                </div>
                <button onClick={() => toggleActivation(b)} className="btn-primary text-sm">
                  ✅ Activate
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All businesses */}
      <div className="section-title">All businesses</div>
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="table-header text-left">Business</th>
              <th className="table-header text-left">Owner</th>
              <th className="table-header text-left">Contact</th>
              <th className="table-header text-center">Status</th>
              <th className="table-header text-center">Admin</th>
              <th className="table-header text-left">Registered</th>
              <th className="table-header text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {businesses.map(b => (
              <tr key={b.id} className="border-b border-gray-100 last:border-0">
                <td className="table-cell">
                  <p className="font-medium">{b.business_name}</p>
                  {b.location && <p className="text-xs text-gray-400">{b.location}</p>}
                </td>
                <td className="table-cell">{b.owner_name}</td>
                <td className="table-cell">
                  <p className="text-sm">{b.email}</p>
                  {b.phone && <p className="text-xs text-gray-400">{b.phone}</p>}
                </td>
                <td className="table-cell text-center">
                  {b.is_active
                    ? <span className="badge-active">Active</span>
                    : <span className="badge-inactive">Pending</span>}
                </td>
                <td className="table-cell text-center">
                  {b.is_admin
                    ? <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">Admin</span>
                    : <span className="text-gray-400 text-xs">—</span>}
                </td>
                <td className="table-cell text-sm text-gray-500">
                  {new Date(b.created_at).toLocaleDateString()}
                  {b.payment_date && <p className="text-xs text-green-600">Paid: {new Date(b.payment_date).toLocaleDateString()}</p>}
                </td>
                <td className="table-cell text-center">
                  <div className="flex gap-2 justify-center flex-wrap">
                    <button
                      onClick={() => toggleActivation(b)}
                      className={`text-xs font-medium px-2 py-1 rounded ${b.is_active ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`}
                    >
                      {b.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => toggleAdmin(b)}
                      className="text-xs font-medium px-2 py-1 rounded text-purple-600 hover:bg-purple-50"
                    >
                      {b.is_admin ? 'Remove admin' : 'Make admin'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}