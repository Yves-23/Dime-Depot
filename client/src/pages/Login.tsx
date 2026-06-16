import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { authAPI, setToken, setBusiness } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'

export default function Login() {
  const navigate = useNavigate()
  const { setBusinessState } = useAuth()
  const [phone, setPhone] = useState('')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)

  function handlePinInput(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 4)
    setPin(digits)
  }

  async function handleLogin() {
    if (!phone.trim()) { toast.error('Please enter your phone number'); return }
    if (!/^\d{4}$/.test(pin)) { toast.error('PIN must be 4 digits'); return }

    setLoading(true)
    try {
      const data = await authAPI.login({ phone: phone.trim(), pin })
      setToken(data.token)
      setBusiness(data.business)
      if (setBusinessState) setBusinessState(data.business)

      if (data.business.is_admin) {
        navigate('/admin')
      } else if (!data.business.is_active) {
        navigate('/pending')
      } else {
        navigate('/dashboard')
      }
    } catch (error: any) {
      toast.error(error.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

          {/* Top accent */}
          <div className="h-1.5 bg-gradient-to-r from-blue-500 to-blue-700" />

          <div className="px-8 py-8">

            {/* Logo */}
            <div className="flex items-center gap-2.5 mb-8">
              <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-lg">D</span>
              </div>
              <span className="text-xl font-bold text-gray-900">Dime-Depot</span>
            </div>

            {/* Title */}
            <div className="mb-7">
              <h2 className="text-2xl font-bold text-gray-900 mb-1">Welcome back!</h2>
              <p className="text-gray-400 text-sm">Enter your phone number and PIN to continue.</p>
            </div>

            {/* Form */}
            <div className="space-y-5">
              <div>
                <label className="label">Phone number</label>
                <input
                  type="tel"
                  className="input w-full"
                  placeholder="+250 7XX XXX XXX"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  autoFocus
                />
              </div>

              <div>
                <label className="label">PIN</label>
                <div className="flex gap-2.5 mb-3">
                  {[0, 1, 2, 3].map(i => (
                    <div
                      key={i}
                      className={`flex-1 h-12 rounded-xl border-2 flex items-center justify-center text-xl font-bold transition-all ${
                        pin[i] !== undefined
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-gray-200 text-gray-300'
                      }`}
                    >
                      {pin[i] ? '●' : '○'}
                    </div>
                  ))}
                </div>
                <input
                  type="number"
                  className="input w-full text-center text-2xl tracking-widest"
                  placeholder="Enter PIN"
                  value={pin}
                  onChange={e => handlePinInput(e.target.value)}
                />
              </div>

              <div className="flex justify-end">
                <Link to="/reset-pin" className="text-blue-600 text-sm font-medium hover:text-blue-700 transition-colors">
                  Forgot PIN?
                </Link>
              </div>
            </div>

            {/* Sign in button */}
            <button
              onClick={handleLogin}
              disabled={loading}
              className="btn-primary w-full py-3 mt-6"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>

            {/* Register link */}
            <p className="text-center text-gray-400 text-sm mt-5">
              Don't have an account?{' '}
              <Link to="/register" className="text-blue-600 font-medium hover:text-blue-700 transition-colors">
                Register
              </Link>
            </p>

          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          Dime-Depot by DimePlug • Made in Rwanda 🇷🇼
        </p>

      </div>
    </div>
  )
}