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

  // Old login fallback
  const [showOldLogin, setShowOldLogin] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  function handlePinInput(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 4)
    setPin(digits)
  }

  async function handleLogin() {
    if (!showOldLogin) {
      if (!phone.trim()) { toast.error('Please enter your phone number'); return }
      if (!/^\d{4}$/.test(pin)) { toast.error('PIN must be 4 digits'); return }
    } else {
      if (!email.trim() || !password.trim()) { toast.error('Please fill in all fields'); return }
    }

    setLoading(true)
    try {
      const data = await authAPI.login(
        showOldLogin
          ? { email: email.trim(), password }
          : { phone: phone.trim(), pin }
      )

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
    <div className="min-h-screen bg-white flex flex-col">

      {/* Header */}
      <div className="px-6 pt-12 pb-4">
        <div className="flex items-center gap-2 mb-12">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
            <span className="text-white font-bold text-lg">D</span>
          </div>
          <span className="text-xl font-bold text-gray-900">Dime-Depot</span>
        </div>

        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {showOldLogin ? 'Sign in with email' : 'Welcome back!'}
        </h2>
        <p className="text-gray-400 text-sm">
          {showOldLogin ? 'Use your email and password to sign in.' : 'Enter your phone number and PIN to continue.'}
        </p>
      </div>

      {/* Form */}
      <div className="flex-1 px-6 pt-4">
        {!showOldLogin ? (
          <div className="space-y-6">
            <div>
              <label className="label">Phone number</label>
              <input
                type="tel"
                className="input text-lg py-4 w-full tracking-wider"
                placeholder="+250 7XX XXX XXX"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                autoFocus
              />
            </div>

            <div>
              <label className="label">PIN</label>
              <div className="flex justify-between gap-3 mb-3">
                {[0, 1, 2, 3].map(i => (
                  <div
                    key={i}
                    className={`flex-1 h-14 rounded-xl border-2 flex items-center justify-center text-2xl font-bold transition-all ${
                      pin[i] !== undefined
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-gray-200 text-gray-300'
                    }`}
                  >
                    {pin[i] ? '●' : '○'}
                  </div>
                ))}
              </div>
              <input
                type="number"
                className="input text-center text-3xl py-4 w-full tracking-widest"
                placeholder="••••"
                value={pin}
                onChange={e => handlePinInput(e.target.value)}
                maxLength={4}
              />
            </div>

            <div className="text-right">
              <Link to="/reset-pin" className="text-blue-600 text-sm font-medium">
                Forgot PIN?
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className="input text-lg py-3 w-full"
                placeholder="your@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                type="password"
                className="input text-lg py-3 w-full"
                placeholder="••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Bottom */}
      <div className="px-6 pb-8 pt-4">
        <button
          onClick={handleLogin}
          disabled={loading}
          className="btn-primary w-full py-4 text-base mb-4"
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </button>

        <button
          onClick={() => { setShowOldLogin(!showOldLogin); setPin(''); setPassword('') }}
          className="w-full text-center text-gray-400 text-sm hover:text-gray-600 mb-4"
        >
          {showOldLogin ? 'Sign in with phone + PIN instead' : 'Sign in with email + password instead'}
        </button>

        <p className="text-center text-gray-400 text-sm">
          Don't have an account?{' '}
          <Link to="/register" className="text-blue-600 font-medium">Register</Link>
        </p>
      </div>
    </div>
  )
}