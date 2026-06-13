import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { authAPI } from '../lib/api'
import toast from 'react-hot-toast'

type Step = 'phone' | 'choose' | 'answer' | 'email' | 'new_pin' | 'done'

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

  function handlePinInput(value: string, setter: (v: string) => void) {
    const digits = value.replace(/\D/g, '').slice(0, 4)
    setter(digits)
  }

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
      setStep('new_pin')
    } catch (error: any) {
      toast.error(error.message || 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleSetPin() {
    if (!/^\d{4}$/.test(newPin)) { toast.error('PIN must be 4 digits'); return }
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
    <div className="min-h-screen bg-white flex flex-col">

      {/* Header */}
      <div className="px-6 pt-12 pb-4">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
            <span className="text-white font-bold text-lg">D</span>
          </div>
          <span className="text-xl font-bold text-gray-900">Dime-Depot</span>
        </div>

        {step !== 'done' && (
          <Link to="/login" className="flex items-center gap-1 text-gray-400 text-sm mb-6 hover:text-gray-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to login
          </Link>
        )}
      </div>

      <div className="flex-1 px-6">

        {/* Step: Phone */}
        {step === 'phone' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Reset your PIN</h2>
            <p className="text-gray-400 text-sm mb-8">Enter the phone number linked to your account.</p>
            <input
              type="tel"
              className="input text-lg py-4 w-full"
              placeholder="+250 7XX XXX XXX"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              autoFocus
            />
          </div>
        )}

        {/* Step: Choose method */}
        {step === 'choose' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">How do you want to verify?</h2>
            <p className="text-gray-400 text-sm mb-8">Choose how you want to prove it's you.</p>
            <div className="space-y-3">
              <button
                onClick={() => setStep('answer')}
                className="w-full text-left p-4 border-2 border-gray-200 rounded-xl hover:border-blue-400 transition-all"
              >
                <p className="font-semibold text-gray-900">Answer security question</p>
                <p className="text-sm text-gray-400 mt-0.5">{securityQuestion}</p>
              </button>
              {hasEmail && (
                <button
                  onClick={() => setStep('email')}
                  className="w-full text-left p-4 border-2 border-gray-200 rounded-xl hover:border-blue-400 transition-all"
                >
                  <p className="font-semibold text-gray-900">Verify with email</p>
                  <p className="text-sm text-gray-400 mt-0.5">Enter the email linked to your account</p>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Step: Security answer */}
        {step === 'answer' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Security question</h2>
            <p className="text-gray-600 text-sm font-medium mb-6 p-3 bg-gray-50 rounded-lg">{securityQuestion}</p>
            <label className="label">Your answer</label>
            <input
              type="text"
              className="input text-lg py-3 w-full"
              placeholder="Enter your answer"
              value={securityAnswer}
              onChange={e => setSecurityAnswer(e.target.value)}
              autoFocus
            />
          </div>
        )}

        {/* Step: Email verify */}
        {step === 'email' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Verify with email</h2>
            <p className="text-gray-400 text-sm mb-8">Enter the email address linked to your account.</p>
            <input
              type="email"
              className="input text-lg py-3 w-full"
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoFocus
            />
          </div>
        )}

        {/* Step: New PIN */}
        {step === 'new_pin' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Set your new PIN</h2>
            <p className="text-gray-400 text-sm mb-6">Choose a new 4-digit PIN.</p>

            <label className="label">New PIN</label>
            <div className="flex justify-between gap-3 mb-3">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className={`flex-1 h-14 rounded-xl border-2 flex items-center justify-center text-2xl font-bold transition-all ${
                  newPin[i] !== undefined ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-300'
                }`}>
                  {newPin[i] ? '●' : '○'}
                </div>
              ))}
            </div>
            <input
              type="number"
              className="input text-center text-3xl py-4 w-full tracking-widest mb-6"
              placeholder="••••"
              value={newPin}
              onChange={e => handlePinInput(e.target.value, setNewPin)}
              autoFocus
            />

            <label className="label">Confirm new PIN</label>
            <div className="flex justify-between gap-3 mb-3">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className={`flex-1 h-14 rounded-xl border-2 flex items-center justify-center text-2xl font-bold transition-all ${
                  confirmPin[i] !== undefined
                    ? confirmPin === newPin.slice(0, confirmPin.length)
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-red-400 bg-red-50 text-red-600'
                    : 'border-gray-200 text-gray-300'
                }`}>
                  {confirmPin[i] ? '●' : '○'}
                </div>
              ))}
            </div>
            <input
              type="number"
              className="input text-center text-3xl py-4 w-full tracking-widest"
              placeholder="••••"
              value={confirmPin}
              onChange={e => handlePinInput(e.target.value, setConfirmPin)}
            />
            {confirmPin.length === 4 && confirmPin !== newPin && (
              <p className="text-red-500 text-sm text-center mt-2">PINs do not match</p>
            )}
          </div>
        )}

        {/* Step: Done */}
        {step === 'done' && (
          <div className="text-center pt-8">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">PIN reset successfully!</h2>
            <p className="text-gray-400 text-sm mb-8">You can now log in with your new PIN.</p>
            <button onClick={() => navigate('/login')} className="btn-primary px-8 py-3 text-base">
              Go to login
            </button>
          </div>
        )}
      </div>

      {/* Bottom button */}
      {step !== 'done' && step !== 'choose' && (
        <div className="px-6 pb-8 pt-4">
          <button
            onClick={() => {
              if (step === 'phone') handlePhoneSubmit()
              else if (step === 'answer') handleVerify('answer')
              else if (step === 'email') handleVerify('email')
              else if (step === 'new_pin') handleSetPin()
            }}
            disabled={loading}
            className="btn-primary w-full py-4 text-base"
          >
            {loading ? 'Please wait...' : 'Continue'}
          </button>
        </div>
      )}
    </div>
  )
}