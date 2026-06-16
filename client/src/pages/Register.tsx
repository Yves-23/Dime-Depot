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
  "What is your mother's first name?",
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
      if (!cleaned || cleaned.length < 9) { toast.error('Please enter a valid phone number'); return }
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
      if (!securityAnswer.trim() || securityAnswer.trim().length < 2) { toast.error('Please enter your security answer'); return }
    }
    if (step === 7) {
      if (email && !email.includes('@')) { toast.error('Please enter a valid email'); return }
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

  const stepTitles: Record<number, { title: string; subtitle: string }> = {
    1: { title: "What's your phone number?", subtitle: "This will be your login identifier. Make sure it's a number you always have access to." },
    2: { title: "Tell us about you", subtitle: "Enter your name and your business name." },
    3: { title: "Where are you based?", subtitle: "Select your country. This sets your currency automatically." },
    4: { title: "Create your PIN", subtitle: "Choose a 4-digit PIN. You will use this every time you log in." },
    5: { title: "Confirm your PIN", subtitle: "Enter your PIN again to make sure it's correct." },
    6: { title: "Security question", subtitle: "This helps you recover your PIN if you forget it." },
    7: { title: "Add your email", subtitle: "Optional — gives you an extra way to recover your PIN." },
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Success screen */}
        {step === 8 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">You are all set!</h2>
            <p className="text-gray-500 mb-1">Welcome to Dime-Depot, <span className="font-semibold text-gray-800">{ownerName}</span>!</p>
            <p className="text-gray-400 text-sm mb-8">Your account is pending activation. We will notify you once it's approved.</p>
            <button onClick={() => navigate('/pending')} className="btn-primary w-full py-3">
              Continue
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

            {/* Top bar */}
            <div className="px-6 pt-6 pb-4 border-b border-gray-50">
              {/* Logo + step counter */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-sm">D</span>
                  </div>
                  <span className="font-bold text-gray-900">Dime-Depot</span>
                </div>
                <span className="text-xs font-medium text-gray-400 bg-gray-50 px-3 py-1 rounded-full">
                  Step {step} of 7
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-gray-100 rounded-full h-1.5">
                <div
                  className="bg-blue-600 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-6">

              {/* Back button */}
              {step > 1 && (
                <button
                  onClick={() => setStep(prev => (prev - 1) as Step)}
                  className="flex items-center gap-1 text-gray-400 text-sm mb-5 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>
              )}

              {/* Title */}
              <h2 className="text-xl font-bold text-gray-900 mb-1">{stepTitles[step]?.title}</h2>
              <p className="text-gray-400 text-sm mb-6">{stepTitles[step]?.subtitle}</p>

              {/* Step 1 — Phone */}
              {step === 1 && (
                <input
                  type="tel"
                  className="input w-full"
                  placeholder="+250 7XX XXX XXX"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  autoFocus
                />
              )}

              {/* Step 2 — Name + Business */}
              {step === 2 && (
                <div className="space-y-4">
                  <div>
                    <label className="label">Your full name</label>
                    <input type="text" className="input w-full" placeholder="e.g. Umutesi Clemence"
                      value={ownerName} onChange={e => setOwnerName(e.target.value)} autoFocus />
                  </div>
                  <div>
                    <label className="label">Business name</label>
                    <input type="text" className="input w-full" placeholder="e.g. National Depot"
                      value={businessName} onChange={e => setBusinessName(e.target.value)} />
                  </div>
                </div>
              )}

              {/* Step 3 — Country */}
              {step === 3 && (
                <div className="grid grid-cols-2 gap-2">
                  {COUNTRIES.map(c => (
                    <button
                      key={c}
                      onClick={() => setCountry(c)}
                      className={`py-2.5 px-3 rounded-xl border-2 text-sm font-medium transition-all text-left ${
                        country === c
                          ? 'border-blue-600 bg-blue-50 text-blue-700'
                          : 'border-gray-200 text-gray-700 hover:border-gray-300 bg-white'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}

              {/* Step 4 — Create PIN */}
              {step === 4 && (
                <div>
                  <div className="flex justify-center gap-3 mb-4">
                    {[0, 1, 2, 3].map(i => (
                      <div key={i} className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center text-xl font-bold transition-all ${
                        pin[i] !== undefined ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-300'
                      }`}>
                        {pin[i] ? '●' : '○'}
                      </div>
                    ))}
                  </div>
                  <input
                    type="number"
                    className="input w-full text-center text-2xl tracking-widest"
                    placeholder="••••"
                    value={pin}
                    onChange={e => handlePinInput(e.target.value, setPin)}
                    autoFocus
                  />
                </div>
              )}

              {/* Step 5 — Confirm PIN */}
              {step === 5 && (
                <div>
                  <div className="flex justify-center gap-3 mb-4">
                    {[0, 1, 2, 3].map(i => (
                      <div key={i} className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center text-xl font-bold transition-all ${
                        confirmPin[i] !== undefined
                          ? confirmPin === pin.slice(0, confirmPin.length)
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
                    className="input w-full text-center text-2xl tracking-widest"
                    placeholder="••••"
                    value={confirmPin}
                    onChange={e => handlePinInput(e.target.value, setConfirmPin)}
                    autoFocus
                  />
                  {confirmPin.length === 4 && confirmPin !== pin && (
                    <p className="text-red-500 text-sm text-center mt-2">PINs do not match</p>
                  )}
                </div>
              )}

              {/* Step 6 — Security question */}
              {step === 6 && (
                <div className="space-y-4">
                  <div>
                    <label className="label">Choose a question</label>
                    <select className="input w-full" value={securityQuestion} onChange={e => setSecurityQuestion(e.target.value)}>
                      <option value="">Select a question...</option>
                      {SECURITY_QUESTIONS.map(q => (
                        <option key={q} value={q}>{q}</option>
                      ))}
                    </select>
                  </div>
                  {securityQuestion && (
                    <div>
                      <label className="label">Your answer</label>
                      <input type="text" className="input w-full" placeholder="Enter your answer"
                        value={securityAnswer} onChange={e => setSecurityAnswer(e.target.value)} autoFocus />
                      <p className="text-xs text-gray-400 mt-1">Remember this answer exactly as you type it.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Step 7 — Email */}
              {step === 7 && (
                <div>
                  <input type="email" className="input w-full" placeholder="e.g. yourname@gmail.com"
                    value={email} onChange={e => setEmail(e.target.value)} autoFocus />
                  <p className="text-xs text-gray-400 mt-2">You can skip this — it's completely optional.</p>
                </div>
              )}

            </div>

            {/* Footer */}
            <div className="px-6 pb-6 space-y-3">
              <button
                onClick={next}
                disabled={loading}
                className="btn-primary w-full py-3"
              >
                {loading ? 'Creating account...' : step === 7 ? 'Finish' : 'Continue'}
              </button>

              {step === 7 && (
                <button
                  onClick={() => { setEmail(''); handleSubmit() }}
                  className="w-full text-center text-gray-400 text-sm hover:text-gray-600 transition-colors py-1"
                >
                  Skip for now
                </button>
              )}

              {step === 1 && (
                <p className="text-center text-gray-400 text-sm">
                  Already have an account?{' '}
                  <Link to="/login" className="text-blue-600 font-medium hover:text-blue-700">Sign in</Link>
                </p>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  )
}