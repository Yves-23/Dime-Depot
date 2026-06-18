import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { setToken, setBusiness } from '../../lib/api'
import { useAuth } from '../../contexts/AuthContext'
import toast from 'react-hot-toast'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

type Step = 'loading' | 'setup' | 'credentials' | 'verify'

export default function AdminLogin() {
  const navigate = useNavigate()
  const { setBusinessState } = useAuth()
  const [step, setStep] = useState<Step>('loading')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Credentials step
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // 2FA step
  const [code, setCode] = useState('')

  // Setup step
  const [setupEmail, setSetupEmail] = useState('')
  const [setupSecret, setSetupSecret] = useState('')
  const [setupPassword, setSetupPassword] = useState('')
  const [setupConfirm, setSetupConfirm] = useState('')

  useEffect(() => {
    async function checkStatus() {
      try {
        const res = await fetch(`${API_URL}/api/admin/auth/status`)
        const data = await res.json()
        setStep(data.hasPassword ? 'credentials' : 'setup')
      } catch {
        setStep('credentials')
      }
    }
    checkStatus()
  }, [])

  async function handleSetup() {
    if (!setupEmail.trim()) { toast.error('Enter your email'); return }
    if (!setupSecret.trim()) { toast.error('Enter the setup secret'); return }
    if (setupPassword.length < 8) { toast.error('Password must be at least 8 characters'); return }
    if (setupPassword !== setupConfirm) { toast.error('Passwords do not match'); return }

    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/admin/auth/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: setupEmail.trim(),
          new_password: setupPassword,
          secret: setupSecret.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('Password set! You can now log in.')
      setEmail(setupEmail)
      setStep('credentials')
    } catch (error: any) {
      toast.error(error.message || 'Setup failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleLogin() {
    if (!email.trim()) { toast.error('Enter your email'); return }
    if (!password.trim()) { toast.error('Enter your password'); return }

    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/admin/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('Verification code sent!')
      setStep('verify')
    } catch (error: any) {
      toast.error(error.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerify() {
    if (code.length !== 6) { toast.error('Enter the 6-digit code'); return }

    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/admin/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), code: code.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setToken(data.token)
      setBusiness(data.business)
      if (setBusinessState) setBusinessState(data.business)
      navigate('/admin')
    } catch (error: any) {
      toast.error(error.message || 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

  function handleCodeInput(value: string) {
    setCode(value.replace(/\D/g, '').slice(0, 6))
  }

  const eyeSvg = showPassword ? (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  )

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-purple-600 to-blue-600" />

          <div className="px-8 py-8">

            {/* Logo */}
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <p className="font-bold text-gray-900 text-lg">Dime-Depot</p>
                <p className="text-xs text-purple-600 font-semibold uppercase tracking-wide">Admin Portal</p>
              </div>
            </div>

            {/* Loading */}
            {step === 'loading' && (
              <div className="text-center py-8 text-gray-400">Checking status...</div>
            )}

            {/* Step: First-time Setup */}
            {step === 'setup' && (
              <div>
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6">
                  <p className="text-orange-800 font-semibold text-sm">⚙️ First-time setup</p>
                  <p className="text-orange-600 text-xs mt-1">
                    No admin password has been set yet. Enter the setup secret from your Vercel environment variables to create one.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="label">Admin email</label>
                    <input type="email" className="input w-full" placeholder="your@email.com"
                      value={setupEmail} onChange={e => setSetupEmail(e.target.value)} autoFocus />
                  </div>
                  <div>
                    <label className="label">
                      Setup secret <span className="text-gray-400 font-normal">(ADMIN_SETUP_SECRET from Vercel)</span>
                    </label>
                    <input type="password" className="input w-full" placeholder="••••••••"
                      value={setupSecret} onChange={e => setSetupSecret(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">
                      New password <span className="text-gray-400 font-normal">(min 8 characters)</span>
                    </label>
                    <div className="relative">
                      <input type={showPassword ? 'text' : 'password'} className="input w-full pr-10"
                        placeholder="••••••••"
                        value={setupPassword} onChange={e => setSetupPassword(e.target.value)} />
                      <button type="button" onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {eyeSvg}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="label">Confirm password</label>
                    <input type="password" className="input w-full" placeholder="••••••••"
                      value={setupConfirm} onChange={e => setSetupConfirm(e.target.value)} />
                    {setupConfirm && setupConfirm !== setupPassword && (
                      <p className="text-red-500 text-xs mt-1">Passwords do not match</p>
                    )}
                  </div>
                </div>

                <button onClick={handleSetup} disabled={loading}
                  className="w-full py-3 mt-6 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-colors">
                  {loading ? 'Setting up...' : 'Set up admin password'}
                </button>
              </div>
            )}

            {/* Step: Credentials */}
            {step === 'credentials' && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">Admin Sign In</h2>
                <p className="text-gray-400 text-sm mb-7">Enter your credentials to continue.</p>

                <div className="space-y-4">
                  <div>
                    <label className="label">Email address</label>
                    <input type="email" className="input w-full" placeholder="admin@example.com"
                      value={email} onChange={e => setEmail(e.target.value)} autoFocus />
                  </div>
                  <div>
                    <label className="label">Password</label>
                    <div className="relative">
                      <input type={showPassword ? 'text' : 'password'} className="input w-full pr-10"
                        placeholder="••••••••"
                        value={password} onChange={e => setPassword(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleLogin()} />
                      <button type="button" onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {eyeSvg}
                      </button>
                    </div>
                  </div>
                </div>

                <button onClick={handleLogin} disabled={loading}
                  className="w-full py-3 mt-6 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-colors">
                  {loading ? 'Sending code...' : 'Continue'}
                </button>
              </div>
            )}

            {/* Step: 2FA Verify */}
            {step === 'verify' && (
              <div>
                <div className="w-14 h-14 bg-purple-100 rounded-2xl flex items-center justify-center mb-5">
                  <svg className="w-7 h-7 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">Check your email</h2>
                <p className="text-gray-400 text-sm mb-1">We sent a 6-digit code to:</p>
                <p className="text-purple-600 font-semibold text-sm mb-7">{email}</p>

                <div>
                  <label className="label">Verification code</label>
                  <div className="flex gap-2 mb-3">
                    {[0,1,2,3,4,5].map(i => (
                      <div key={i} className={`flex-1 h-12 rounded-xl border-2 flex items-center justify-center text-lg font-bold transition-all ${
                        code[i] !== undefined
                          ? 'border-purple-600 bg-purple-50 text-purple-700'
                          : 'border-gray-200 text-gray-300'
                      }`}>
                        {code[i] || '○'}
                      </div>
                    ))}
                  </div>
                  <input type="number" className="input w-full text-center text-2xl tracking-widest"
                    placeholder="Enter 6-digit code"
                    value={code} onChange={e => handleCodeInput(e.target.value)} autoFocus />
                </div>

                <button onClick={handleVerify} disabled={loading || code.length !== 6}
                  className={`w-full py-3 mt-6 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-colors ${code.length !== 6 ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  {loading ? 'Verifying...' : 'Verify & Sign in'}
                </button>

                <button onClick={() => { setStep('credentials'); setCode('') }}
                  className="w-full text-center text-gray-400 text-sm mt-3 hover:text-gray-600">
                  ← Back to login
                </button>

                <p className="text-xs text-gray-400 text-center mt-3">
                  Code expires in 10 minutes. Check spam if not received.
                </p>
              </div>
            )}

          </div>
        </div>

        <p className="text-center text-xs text-gray-500 mt-4">
          Dime-Depot Admin Portal • Secure Access Only
        </p>
      </div>
    </div>
  )
}