import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { authAPI, setToken, setBusiness } from '../lib/api'
import toast from 'react-hot-toast'

const COUNTRIES = [
  'Rwanda', 'Uganda', 'Kenya', 'Tanzania', 'Burundi',
  'DRC', 'Nigeria', 'Ghana', 'South Africa', 'Ethiopia',
]

const SECURITY_QUESTIONS = [
  'What is your business location?',
  'What is the name of your first employee?',
  'What is the name of the street your business is on?',
  'What was your first product you ever sold?',
  'What is your mother\'s first name?',
]

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

export default function Register() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>(1)
  const [loading, setLoading] = useState(false)

  const [phone, setPhone] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [country, setCountry] = useState('')
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [securityQuestion, setSecurityQuestion] = useState('')
  const [securityAnswer, setSecurityAnswer] = useState('')
  const [email, setEmail] = useState('')

  function next() {
    if (step === 1) {
      const cleaned = phone.replace(/\s/g, '')
      if (!cleaned || cleaned.length < 9) {
        toast.error('Please enter a valid phone number')
        return
      }
    }
    if (step === 2) {
      if (!ownerName.trim()) { toast.error('Please enter your name'); return }
      if (!businessName.trim()) { toast.error('Please enter your business name'); return }
    }
    if (step === 3) {
      if (!country) { toast.error('Please select your country'); return }
    }
    if (step === 4) {
      if (!/^\d{4}$/.test(pin)) { toast.error('PIN must be exactly 4 digits'); return }
    }
    if (step === 5) {
      if (pin !== confirmPin) { toast.error('PINs do not match'); return }
    }
    if (step === 6) {
      if (!securityQuestion) { toast.error('Please select a security question'); return }
      if (!securityAnswer.trim() || securityAnswer.trim().length < 2) {
        toast.error('Please enter your security answer')
        return
      }
    }
    if (step === 7) {
      // email is optional — can skip
      if (email && !email.includes('@')) {
        toast.error('Please enter a valid email')
        return
      }
      handleSubmit()
      return
    }
    setStep(prev => (prev + 1) as Step)
  }

  async function handleSubmit() {
    setLoading(true)
    try {
      const data = await authAPI.register({
        owner_name: ownerName.trim(),
        business_name: businessName.trim(),
        phone: phone.replace(/\s/g, ''),
        pin,
        security_question: securityQuestion,
        security_answer: securityAnswer.trim(),
        email: email.trim() || undefined,
        country,
      })
      setToken(data.token)
      setBusiness(data.business)
      setStep(8)
    } catch (error: any) {
      toast.error(error.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  function handlePinInput(value: string, setter: (v: string) => void) {
    const digits = value.replace(/\D/g, '').slice(0, 4)
    setter(digits)
  }

  const progress = ((step - 1) / 7) * 100

  return (
    <div className="min-h-screen bg-white flex flex-col">

      {/* Step 8 — Success */}
      {step === 8 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">You are all set!</h1>
          <p className="text-gray-500 mb-2">Welcome to Dime-Depot, <span className="font-semibold text-gray-800">{ownerName}</span>!</p>
          <p className="text-gray-400 text-sm mb-8">Your account is pending activation. We will notify you once it's approved.</p>
          <button
            onClick={() => navigate('/pending')}
            className="btn-primary px-8 py-3 text-base"
          >
            Continue
          </button>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="px-6 pt-12 pb-4">
            {/* Progress bar */}
            <div className="w-full bg-gray-100 rounded-full h-1 mb-8">
              <div
                className="bg-blue-600 h-1 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* Back button */}
            {step > 1 && (
              <button
                onClick={() => setStep(prev => (prev - 1) as Step)}
                className="flex items-center gap-1 text-gray-400 text-sm mb-6 hover:text-gray-600"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>
            )}

            {/* Logo */}
            <div className="flex items-center gap-2 mb-8">
              <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-lg">D</span>
              </div>
              <span className="text-xl font-bold text-gray-900">Dime-Depot</span>
            </div>
          </div>

          {/* Step content */}
          <div className="flex-1 px-6">

            {/* Step 1 — Phone */}
            {step === 1 && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">What's your phone number?</h2>
                <p className="text-gray-400 text-sm mb-8">This will be your login identifier. Make sure it's a number you always have access to.</p>
                <input
                  type="tel"
                  className="input text-xl py-4 w-full tracking-wider"
                  placeholder="+250 7XX XXX XXX"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  autoFocus
                />
              </div>
            )}

            {/* Step 2 — Name + Business */}
            {step === 2 && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Tell us about you</h2>
                <p className="text-gray-400 text-sm mb-8">Enter your name and your business name.</p>
                <div className="space-y-4">
                  <div>
                    <label className="label">Your full name</label>
                    <input
                      type="text"
                      className="input text-lg py-3 w-full"
                      placeholder="e.g. Umutesi Clemence"
                      value={ownerName}
                      onChange={e => setOwnerName(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="label">Business name</label>
                    <input
                      type="text"
                      className="input text-lg py-3 w-full"
                      placeholder="e.g. National Depot"
                      value={businessName}
                      onChange={e => setBusinessName(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 3 — Country */}
            {step === 3 && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Where are you based?</h2>
                <p className="text-gray-400 text-sm mb-8">Select your country. This sets your currency automatically.</p>
                <div className="grid grid-cols-2 gap-3">
                  {COUNTRIES.map(c => (
                    <button
                      key={c}
                      onClick={() => setCountry(c)}
                      className={`py-3 px-4 rounded-xl border-2 text-sm font-medium transition-all text-left ${
                        country === c
                          ? 'border-blue-600 bg-blue-50 text-blue-700'
                          : 'border-gray-200 text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 4 — Create PIN */}
            {step === 4 && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Create your PIN</h2>
                <p className="text-gray-400 text-sm mb-8">Choose a 4-digit PIN. You will use this every time you log in.</p>
                <div className="flex justify-center gap-4 mb-4">
                  {[0, 1, 2, 3].map(i => (
                    <div
                      key={i}
                      className={`w-14 h-14 rounded-xl border-2 flex items-center justify-center text-2xl font-bold transition-all ${
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
                  onChange={e => handlePinInput(e.target.value, setPin)}
                  maxLength={4}
                  autoFocus
                />
              </div>
            )}

            {/* Step 5 — Confirm PIN */}
            {step === 5 && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Confirm your PIN</h2>
                <p className="text-gray-400 text-sm mb-8">Enter your PIN again to confirm.</p>
                <div className="flex justify-center gap-4 mb-4">
                  {[0, 1, 2, 3].map(i => (
                    <div
                      key={i}
                      className={`w-14 h-14 rounded-xl border-2 flex items-center justify-center text-2xl font-bold transition-all ${
                        confirmPin[i] !== undefined
                          ? confirmPin === pin.slice(0, confirmPin.length)
                            ? 'border-green-500 bg-green-50 text-green-700'
                            : 'border-red-400 bg-red-50 text-red-600'
                          : 'border-gray-200 text-gray-300'
                      }`}
                    >
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
                  maxLength={4}
                  autoFocus
                />
                {confirmPin.length === 4 && confirmPin !== pin && (
                  <p className="text-red-500 text-sm text-center mt-3">PINs do not match</p>
                )}
              </div>
            )}

            {/* Step 6 — Security question */}
            {step === 6 && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Security question</h2>
                <p className="text-gray-400 text-sm mb-6">This helps you recover your PIN if you forget it.</p>
                <div className="space-y-4">
                  <div>
                    <label className="label">Choose a question</label>
                    <select
                      className="input w-full text-sm py-3"
                      value={securityQuestion}
                      onChange={e => setSecurityQuestion(e.target.value)}
                    >
                      <option value="">Select a question...</option>
                      {SECURITY_QUESTIONS.map(q => (
                        <option key={q} value={q}>{q}</option>
                      ))}
                    </select>
                  </div>
                  {securityQuestion && (
                    <div>
                      <label className="label">Your answer</label>
                      <input
                        type="text"
                        className="input w-full py-3"
                        placeholder="Enter your answer"
                        value={securityAnswer}
                        onChange={e => setSecurityAnswer(e.target.value)}
                        autoFocus
                      />
                      <p className="text-xs text-gray-400 mt-1">Remember this answer exactly as you type it.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 7 — Email (optional) */}
            {step === 7 && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Add your email <span className="text-gray-400 font-normal text-lg">(optional)</span></h2>
                <p className="text-gray-400 text-sm mb-8">Adding an email gives you an extra way to recover your PIN. You can skip this.</p>
                <input
                  type="email"
                  className="input text-lg py-3 w-full"
                  placeholder="e.g. yourname@gmail.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoFocus
                />
              </div>
            )}

          </div>

          {/* Bottom actions */}
          <div className="px-6 pb-8 pt-4">
            <button
              onClick={next}
              disabled={loading}
              className="btn-primary w-full py-4 text-base"
            >
              {loading ? 'Creating account...' : step === 7 ? 'Finish' : 'Continue'}
            </button>

            {step === 7 && (
              <button
                onClick={() => { setEmail(''); handleSubmit() }}
                className="w-full text-center text-gray-400 text-sm mt-4 hover:text-gray-600"
              >
                Skip — I don't want to add email
              </button>
            )}

            {step === 1 && (
              <p className="text-center text-gray-400 text-sm mt-4">
                Already have an account?{' '}
                <Link to="/login" className="text-blue-600 font-medium">Sign in</Link>
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}