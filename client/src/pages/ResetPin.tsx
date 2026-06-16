import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { authAPI } from '../lib/api'
import toast from 'react-hot-toast'

type Step = 'phone' | 'choose' | 'answer' | 'email' | 'new_pin' | 'done'

function PinKeypad({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const keys = ['1','2','3','4','5','6','7','8','9','','0','⌫']

  function press(key: string) {
    if (key === '⌫') onChange(value.slice(0, -1))
    else if (key === '') return
    else if (value.length < 4) onChange(value + key)
  }

  return (
    <div>
      <div className="flex justify-center gap-4 mb-6">
        {[0,1,2,3].map(i => (
          <div key={i} className={`w-14 h-14 rounded-2xl border-2 flex items-center justify-center text-3xl transition-all ${
            value[i] !== undefined
              ? 'border-blue-600 bg-blue-600 text-white'
              : 'border-gray-200 bg-gray-50 text-gray-200'
          }`}>
            {value[i] ? '●' : '○'}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {keys.map((key, i) => (
          <button
            key={i}
            onClick={() => press(key)}
            disabled={key === ''}
            className={`h-14 rounded-xl text-xl font-semibold transition-all ${
              key === ''
                ? 'invisible'
                : key === '⌫'
                ? 'bg-gray-100 text-gray-600 hover:bg-gray-200 active:scale-95'
                : 'bg-gray-50 text-gray-900 hover:bg-gray-100 active:scale-95 border border-gray-200'
            }`}
          >
            {key}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function ResetPin() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('phone')
  const [loading, setLoading] = useState(false)

  const [phone, setPhone] = useState('')
  const [securityQuestion, setSecurityQuestion] = useState('')
  const [hasEmail, setHasEmail] = useState(false)
  const [securityAnswer, setSecurityAnswer] = useState('')
  const [email, setEmail] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')

  async function handlePhoneSubmit() {
    if (!phone.trim()) { toast.error('Please enter your phone number'); return }
    setLoading(true)
    try {
      const data = await authAPI.resetPinQuestion(phone.trim())
      setSecurityQuestion(data.security_question)
      setHasEmail(data.has_email)
      setStep('choose')
    } catch (error: any) {
      toast.error(error.message || 'Phone number not found')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerify(method: 'answer' | 'email') {
    setLoading(true)
    try {
      const data = await authAPI.resetPinVerify({
        phone: phone.trim(),
        security_answer: method === 'answer' ? securityAnswer.trim() : undefined,
        email: method === 'email' ? email.trim() : undefined,
      })
      setResetToken(data.reset_token)
      setNewPin('')
      setConfirmPin('')
      setStep('new_pin')
    } catch (error: any) {
      toast.error(error.message || 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleSetPin() {
    if (!/^\d{4}$/.test(newPin)) { toast.error('Please enter a 4-digit PIN'); return }
    if (newPin !== confirmPin) { toast.error('PINs do not match'); return }
    setLoading(true)
    try {
      await authAPI.resetPinSet(resetToken, newPin)
      setStep('done')
    } catch (error: any) {
      toast.error(error.message || 'Failed to reset PIN')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-blue-500 to-blue-700" />

          <div className="px-8 py-8">

            {/* Logo */}
            <div className="flex items-center gap-2.5 mb-6">
              <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-lg">D</span>
              </div>
              <span className="text-xl font-bold text-gray-900">Dime-Depot</span>
            </div>

            {/* Back to login */}
            {step !== 'done' && (
              <Link to="/login" className="flex items-center gap-1 text-gray-400 text-sm mb-6 hover:text-gray-600 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to login
              </Link>
            )}

            {/* Step: Phone */}
            {step === 'phone' && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">Forgot your PIN?</h2>
                <p className="text-gray-400 text-sm mb-6">Enter the phone number linked to your account.</p>
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
                <button onClick={handlePhoneSubmit} disabled={loading} className="btn-primary w-full py-3 mt-6">
                  {loading ? 'Looking up...' : 'Continue'}
                </button>
              </div>
            )}

            {/* Step: Choose method */}
            {step === 'choose' && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">How do you want to verify?</h2>
                <p className="text-gray-400 text-sm mb-6">Choose one of the options below to confirm your identity.</p>
                <div className="space-y-3">
                  <button
                    onClick={() => setStep('answer')}
                    className="w-full text-left p-4 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-orange-100 rounded-xl flex items-center justify-center shrink-0">
                        <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">Answer security question</p>
                        <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[220px]">{securityQuestion}</p>
                      </div>
                    </div>
                  </button>
                  {hasEmail && (
                    <button
                      onClick={() => setStep('email')}
                      className="w-full text-left p-4 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-green-100 rounded-xl flex items-center justify-center shrink-0">
                          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 text-sm">Verify with email</p>
                          <p className="text-xs text-gray-400 mt-0.5">Enter the email linked to your account</p>
                        </div>
                      </div>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Step: Security answer */}
            {step === 'answer' && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">Security question</h2>
                <p className="text-gray-400 text-sm mb-5">Answer your security question to continue.</p>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-5">
                  <p className="text-blue-800 text-sm font-medium">{securityQuestion}</p>
                </div>
                <div>
                  <label className="label">Your answer</label>
                  <input type="text" className="input w-full" placeholder="Enter your answer"
                    value={securityAnswer} onChange={e => setSecurityAnswer(e.target.value)} autoFocus />
                </div>
                <button onClick={() => handleVerify('answer')} disabled={loading} className="btn-primary w-full py-3 mt-6">
                  {loading ? 'Verifying...' : 'Continue'}
                </button>
              </div>
            )}

            {/* Step: Email verify */}
            {step === 'email' && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">Verify with email</h2>
                <p className="text-gray-400 text-sm mb-6">Enter the email address linked to your account.</p>
                <div>
                  <label className="label">Email address</label>
                  <input type="email" className="input w-full" placeholder="your@email.com"
                    value={email} onChange={e => setEmail(e.target.value)} autoFocus />
                </div>
                <button onClick={() => handleVerify('email')} disabled={loading} className="btn-primary w-full py-3 mt-6">
                  {loading ? 'Verifying...' : 'Continue'}
                </button>
              </div>
            )}

            {/* Step: New PIN */}
            {step === 'new_pin' && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">Set your new PIN</h2>
                <p className="text-gray-400 text-sm mb-6">
                  {confirmPin.length === 0 && newPin.length < 4 ? 'Enter a new 4-digit PIN.' : newPin.length === 4 && confirmPin.length === 0 ? 'Now confirm your new PIN.' : ''}
                </p>

                {newPin.length < 4 ? (
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide text-center mb-4">New PIN</p>
                    <PinKeypad value={newPin} onChange={setNewPin} />
                  </div>
                ) : (
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide text-center mb-4">Confirm PIN</p>
                    <PinKeypad value={confirmPin} onChange={setConfirmPin} />
                    {confirmPin.length === 4 && confirmPin !== newPin && (
                      <p className="text-red-500 text-sm text-center mt-3">PINs do not match — try again</p>
                    )}
                    {confirmPin.length === 4 && confirmPin === newPin && (
                      <p className="text-green-600 text-sm text-center mt-3">✓ PINs match!</p>
                    )}
                    {confirmPin.length === 4 && confirmPin === newPin && (
                      <button onClick={handleSetPin} disabled={loading} className="btn-primary w-full py-3 mt-4">
                        {loading ? 'Saving...' : 'Set new PIN'}
                      </button>
                    )}
                    {confirmPin.length > 0 && confirmPin !== newPin.slice(0, confirmPin.length) && (
                      <button onClick={() => setConfirmPin('')} className="w-full text-center text-gray-400 text-sm mt-3 hover:text-gray-600">
                        Clear and try again
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Step: Done */}
            {step === 'done' && (
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">PIN reset!</h2>
                <p className="text-gray-400 text-sm mb-8">You can now sign in with your new PIN.</p>
                <button onClick={() => navigate('/login')} className="btn-primary w-full py-3">
                  Go to sign in
                </button>
              </div>
            )}

          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">Dime-Depot by DimePlug • Made in Rwanda 🇷🇼</p>
      </div>
    </div>
  )
}