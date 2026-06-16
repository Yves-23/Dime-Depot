import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { authAPI, setToken, setBusiness } from '../lib/api'
import toast from 'react-hot-toast'

const COUNTRIES = [
  { name: 'Rwanda', flag: '🇷🇼', code: '+250' },
  { name: 'Uganda', flag: '🇺🇬', code: '+256' },
  { name: 'Kenya', flag: '🇰🇪', code: '+254' },
  { name: 'Tanzania', flag: '🇹🇿', code: '+255' },
  { name: 'Burundi', flag: '🇧🇮', code: '+257' },
  { name: 'DRC', flag: '🇨🇩', code: '+243' },
  { name: 'Nigeria', flag: '🇳🇬', code: '+234' },
  { name: 'Ghana', flag: '🇬🇭', code: '+233' },
  { name: 'South Africa', flag: '🇿🇦', code: '+27' },
  { name: 'Ethiopia', flag: '🇪🇹', code: '+251' },
]

const SECURITY_QUESTIONS = [
  'What is your business location?',
  'What is the name of your first employee?',
  'What is the name of the street your business is on?',
  'What was your first product you ever sold?',
  "What is your mother's first name?",
]

// Steps: 1=Name+Business, 2=Country, 3=Phone, 4=PIN, 5=ConfirmPIN, 6=SecurityQ, 7=Email, 8=Done
type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
const TOTAL_STEPS = 7

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
            value[i] !== undefined ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-200 bg-gray-50 text-gray-200'
          }`}>
            {value[i] ? '●' : '○'}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {keys.map((key, i) => (
          <button key={i} onClick={() => press(key)} disabled={key === ''}
            className={`h-14 rounded-xl text-xl font-semibold transition-all ${
              key === '' ? 'invisible'
              : key === '⌫' ? 'bg-gray-100 text-gray-600 hover:bg-gray-200 active:scale-95'
              : 'bg-gray-50 text-gray-900 hover:bg-gray-100 active:scale-95 border border-gray-200'
            }`}>
            {key}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function Register() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>(1)
  const [loading, setLoading] = useState(false)

  const [ownerName, setOwnerName] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [country, setCountry] = useState<typeof COUNTRIES[0] | null>(null)
  const [phoneCode, setPhoneCode] = useState('+250')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [securityQuestion, setSecurityQuestion] = useState('')
  const [securityAnswer, setSecurityAnswer] = useState('')
  const [email, setEmail] = useState('')

  function selectCountry(c: typeof COUNTRIES[0]) {
    setCountry(c)
    setPhoneCode(c.code)
  }

  function fullPhone() {
    return `${phoneCode}${phoneNumber.replace(/\s/g, '')}`
  }

  function next() {
    if (step === 1) {
      if (!ownerName.trim()) { toast.error('Please enter your name'); return }
      if (!businessName.trim()) { toast.error('Please enter your business name'); return }
    }
    if (step === 2) {
      if (!country) { toast.error('Please select your country'); return }
    }
    if (step === 3) {
      if (!phoneNumber.replace(/\s/g, '') || phoneNumber.replace(/\s/g, '').length < 7) {
        toast.error('Please enter a valid phone number'); return
      }
    }
    if (step === 4) {
      if (!/^\d{4}$/.test(pin)) { toast.error('Please enter a 4-digit PIN'); return }
    }
    if (step === 5) {
      if (pin !== confirmPin) { toast.error('PINs do not match'); return }
    }
    if (step === 6) {
      if (!securityQuestion) { toast.error('Please select a security question'); return }
      if (!securityAnswer.trim() || securityAnswer.trim().length < 2) { toast.error('Please enter your answer'); return }
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
        phone: fullPhone(),
        pin,
        security_question: securityQuestion,
        security_answer: securityAnswer.trim(),
        email: email.trim() || undefined,
        country: country?.name || 'Rwanda',
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

  const progress = ((step - 1) / TOTAL_STEPS) * 100

  const stepInfo: Record<number, { title: string; subtitle: string }> = {
    1: { title: 'Create your account', subtitle: 'Enter your name and your business name to get started.' },
    2: { title: 'Where are you based?', subtitle: 'Select your country. This sets your currency automatically.' },
    3: { title: 'Your phone number', subtitle: 'This will be your login identifier. Keep it one you always have access to.' },
    4: { title: 'Create your PIN', subtitle: 'Choose a 4-digit PIN to secure your account.' },
    5: { title: 'Confirm your PIN', subtitle: 'Enter your PIN again to make sure it is correct.' },
    6: { title: 'Security question', subtitle: 'Used to recover your PIN if you ever forget it.' },
    7: { title: 'Add your email', subtitle: 'Optional — gives you an extra way to recover your PIN.' },
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Success */}
        {step === 8 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">You are all set!</h2>
            <p className="text-gray-500 mb-1">Welcome to Dime-Depot, <span className="font-semibold text-gray-800">{ownerName}</span>!</p>
            <p className="text-gray-400 text-sm mb-8">Your account is pending activation. We will notify you once it is approved.</p>
            <button onClick={() => navigate('/pending')} className="btn-primary w-full py-3">Continue</button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-gray-50">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-sm">D</span>
                  </div>
                  <span className="font-bold text-gray-900">Dime-Depot</span>
                </div>
                <span className="text-xs font-medium text-gray-400 bg-gray-50 px-3 py-1 rounded-full">
                  {step} / {TOTAL_STEPS}
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5">
                <div className="bg-blue-600 h-1.5 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>
            </div>

            <div className="px-6 py-6">

              {/* Back */}
              {step > 1 && (
                <button onClick={() => setStep(prev => (prev - 1) as Step)}
                  className="flex items-center gap-1 text-gray-400 text-sm mb-4 hover:text-gray-600 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>
              )}

              <h2 className="text-xl font-bold text-gray-900 mb-1">{stepInfo[step]?.title}</h2>
              <p className="text-gray-400 text-sm mb-5">{stepInfo[step]?.subtitle}</p>

              {/* Step 1 — Name + Business */}
              {step === 1 && (
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

              {/* Step 2 — Country */}
              {step === 2 && (
                <div className="grid grid-cols-2 gap-2">
                  {COUNTRIES.map(c => (
                    <button key={c.name} onClick={() => selectCountry(c)}
                      className={`py-2.5 px-3 rounded-xl border-2 text-sm font-medium transition-all text-left flex items-center gap-2 ${
                        country?.name === c.name
                          ? 'border-blue-600 bg-blue-50 text-blue-700'
                          : 'border-gray-200 text-gray-700 hover:border-gray-300 bg-white'
                      }`}>
                      <span className="text-lg">{c.flag}</span>
                      {c.name}
                    </button>
                  ))}
                </div>
              )}

              {/* Step 3 — Phone */}
              {step === 3 && (
                <div>
                  <label className="label">Phone number</label>
                  <div className="flex gap-2">
                    <div className="relative">
                      <select
                        className="input appearance-none pr-7 pl-3 cursor-pointer font-medium text-gray-800 bg-gray-50"
                        value={phoneCode}
                        onChange={e => setPhoneCode(e.target.value)}
                        style={{ minWidth: '95px' }}
                      >
                        {COUNTRIES.map(c => (
                          <option key={c.name} value={c.code}>{c.flag} {c.code}</option>
                        ))}
                      </select>
                      <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                    <input
                      type="tel"
                      className="input flex-1"
                      placeholder="7XX XXX XXX"
                      value={phoneNumber}
                      onChange={e => setPhoneNumber(e.target.value)}
                      autoFocus
                    />
                  </div>
                  {phoneNumber && (
                    <p className="text-xs text-gray-400 mt-2">
                      Full number: <span className="font-medium text-gray-700">{phoneCode}{phoneNumber.replace(/\s/g, '')}</span>
                    </p>
                  )}
                </div>
              )}

              {/* Step 4 — PIN */}
              {step === 4 && <PinKeypad value={pin} onChange={setPin} />}

              {/* Step 5 — Confirm PIN */}
              {step === 5 && (
                <div>
                  <PinKeypad value={confirmPin} onChange={setConfirmPin} />
                  {confirmPin.length === 4 && confirmPin !== pin && (
                    <p className="text-red-500 text-sm text-center mt-3">PINs do not match — try again</p>
                  )}
                  {confirmPin.length === 4 && confirmPin === pin && (
                    <p className="text-green-600 text-sm text-center mt-3">✓ PINs match!</p>
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
                  <label className="label">Email address <span className="text-gray-300 font-normal">(optional)</span></label>
                  <input type="email" className="input w-full" placeholder="e.g. yourname@gmail.com"
                    value={email} onChange={e => setEmail(e.target.value)} autoFocus />
                  <p className="text-xs text-gray-400 mt-2">You can skip this — it is completely optional.</p>
                </div>
              )}

            </div>

            {/* Footer */}
            <div className="px-6 pb-6 space-y-3">
              {step !== 4 && step !== 5 && (
                <button onClick={next} disabled={loading} className="btn-primary w-full py-3">
                  {loading ? 'Creating account...' : step === 7 ? 'Finish' : 'Continue'}
                </button>
              )}
              {step === 4 && (
                <button onClick={next} disabled={pin.length !== 4}
                  className={`btn-primary w-full py-3 ${pin.length !== 4 ? 'opacity-40 cursor-not-allowed' : ''}`}>
                  Continue
                </button>
              )}
              {step === 5 && (
                <button onClick={next} disabled={confirmPin.length !== 4 || confirmPin !== pin}
                  className={`btn-primary w-full py-3 ${(confirmPin.length !== 4 || confirmPin !== pin) ? 'opacity-40 cursor-not-allowed' : ''}`}>
                  Continue
                </button>
              )}
              {step === 7 && (
                <button onClick={() => { setEmail(''); handleSubmit() }}
                  className="w-full text-center text-gray-400 text-sm hover:text-gray-600 transition-colors py-1">
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

        <p className="text-center text-xs text-gray-400 mt-4">Dime-Depot by DimePlug • Made in Rwanda 🇷🇼</p>
      </div>
    </div>
  )
}