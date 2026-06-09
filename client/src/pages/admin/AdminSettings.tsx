import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { authAPI } from '../../lib/api'
import toast from 'react-hot-toast'

export default function AdminSettings() {
  const { business } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()

    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match')
      return
    }

    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }

    setSaving(true)
    try {
      await authAPI.changePassword(currentPassword, newPassword)
      toast.success('Password changed successfully!')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to change password')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">Manage your admin account</p>
      </div>

      {/* Account info */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Account information</h2>
        <div className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b border-gray-50">
            <span className="text-sm text-gray-500">Name</span>
            <span className="text-sm font-medium text-gray-900">{business?.owner_name}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-50">
            <span className="text-sm text-gray-500">Email</span>
            <span className="text-sm font-medium text-gray-900">{business?.email}</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-sm text-gray-500">Role</span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">Super Admin</span>
          </div>
        </div>
      </div>

      {/* Change password */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Change password</h2>
        <form onSubmit={changePassword} className="space-y-4 max-w-md">
          <div>
            <label className="label">Current password</label>
            <input
              type="password"
              className="input"
              placeholder="••••••••"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">New password</label>
            <input
              type="password"
              className="input"
              placeholder="At least 6 characters"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">Confirm new password</label>
            <input
              type="password"
              className="input"
              placeholder="Repeat new password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="bg-purple-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-purple-700 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Change password'}
          </button>
        </form>
      </div>
    </div>
  )
}