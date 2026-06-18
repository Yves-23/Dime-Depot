import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { authAPI, setToken, setBusiness } from '../lib/api'
import { t } from '../lib/i18n'
import type { Language } from '../lib/i18n'
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

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
const TOTAL_STEPS = 7

function getInitialLang(): Language {
  const stored = localStorage.getItem('dime-depot-lang')
  if (stored === 'rw' || stored === 'en') return stored
  return 'en'
}

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
  const [lang, setLang] = useState<Language>(getInitialLang())

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

  function toggleLang() {
    const newLang = lang === 'en' ? 'rw' : 'en'
    setLang(newLang)
    localStorage.setItem('dime-depot-lang', newLang)
  }

  function selectCountry(c: typeof COUNTRIES[0]) {
    setCountry(c)
    setPhoneCode(c.code)
  }

  function fullPhone() {
    return `${phoneCode}${phoneNumber.replace(/\s/g, '')}`
  }

  function next() {
    if (step === 1) {
      if (!ownerName.trim()) { toast.error(lang === 'rw' ? 'Andika izina ryawe' : 'Please enter your name'); return }
      if (!businessName.trim()) { toast.error(lang === 'rw' ? "Andika izina ry'ubucuruzi" : 'Please enter your business name'); return }
    }
    if (step === 2) {
      if (!country) { toast.error(lang === 'rw' ? 'Hitamo igihugu' : 'Please select your country'); return }
    }
    if (step === 3) {
      if (!phoneNumber.replace(/\s/g, '') || phoneNumber.replace(/\s/g, '').length < 7) {
        toast.error(lang === 'rw' ? 'Andika nomero ya telefone' : 'Please enter a valid phone number'); return
      }
    }
    if (step === 4) {
      if (!/^\d{4}$/.test(pin)) { toast.error(lang === 'rw' ? 'Shiramo imibare 4' : 'Please enter a 4-digit PIN'); return }
    }
    if (step === 5) {
      if (pin !== confirmPin) { toast.error(lang === 'rw' ? "Imibare y'ibanga ntihura" : 'PINs do not match'); return }
    }
    if (step === 6) {
      if (!securityQuestion) { toast.error(lang === 'rw' ? 'Hitamo ikibazo' : 'Please select a security question'); return }
      if (!securityAnswer.trim() || securityAnswer.trim().length < 2) {
        toast.error(lang === 'rw' ? 'Andika igisubizo' : 'Please enter your answer'); return
      }
    }
    if (step === 7) {
      if (email && !email.includes('@')) { toast.error(lang === 'rw' ? 'Andika imeyili yuzuye' : 'Please enter a valid email'); return }
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
    1: { title: t('create_account', lang), subtitle: t('create_account_sub', lang) },
    2: { title: t('where_based', lang), subtitle: t('where_based_sub', lang) },
    3: { title: t('your_phone', lang), subtitle: t('your_phone_sub', lang) },
    4: { title: t('create_pin', lang), subtitle: t('create_pin_sub', lang) },
    5: { title: t('confirm_pin', lang), subtitle: t('confirm_pin_sub', lang) },
    6: { title: t('security_q', lang), subtitle: t('security_q_sub', lang) },
    7: { title: t('add_email', lang), subtitle: t('add_email_sub', lang) },
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
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('all_set', lang)}</h2>
            <p className="text-gray-500 mb-1">
              {t('welcome_to', lang)}, <span className="font-semibold text-gray-800">{ownerName}</span>!
            </p>
            <p className="text-gray-400 text-sm mb-8">{t('pending_msg', lang)}</p>
            <button onClick={() => navigate('/pending')} className="btn-primary w-full py-3">
              {t('continue_btn', lang)}
            </button>
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
                <div className="flex items-center gap-2">
                  <button onClick={toggleLang}
                    className="text-xs font-semibold border border-gray-200 rounded-lg px-2.5 py-1 text-gray-500 hover:bg-gray-50 transition-colors">
                    {lang === 'en' ? '🇷🇼 RW' : '🇬🇧 EN'}
                  </button>
                  <span className="text-xs font-medium text-gray-400 bg-gray-50 px-3 py-1 rounded-full">
                    {step} / {TOTAL_STEPS}
                  </span>
                </div>
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
                  {lang === 'rw' ? 'Subira inyuma' : 'Back'}
                </button>
              )}

              <h2 className="text-xl font-bold text-gray-900 mb-1">{stepInfo[step]?.title}</h2>
              <p className="text-gray-400 text-sm mb-5">{stepInfo[step]?.subtitle}</p>

              {/* Step 1 — Name + Business */}
              {step === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="label">{t('owner_name', lang)}</label>
                    <input type="text" className="input w-full"
                      placeholder={lang === 'rw' ? 'Andika amazina yawe yose' : 'Enter your full name'}
                      value={ownerName} onChange={e => setOwnerName(e.target.value)} autoFocus />
                  </div>
                  <div>
                    <label className="label">{t('business_name', lang)}</label>
                    <input type="text" className="input w-full"
                      placeholder={lang === 'rw' ? "Andika izina ry'ubucuruzi" : 'Enter your business/company name'}
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
                  <label className="label">{t('phone_number', lang)}</label>
                  <div className="flex gap-2">
                    <div className="relative">
                      <select
                        className="input appearance-none pr-7 pl-3 cursor-pointer font-medium text-gray-800 bg-gray-50"
                        value={phoneCode} onChange={e => setPhoneCode(e.target.value)}
                        style={{ minWidth: '95px' }}>
                        {COUNTRIES.map(c => (
                          <option key={c.name} value={c.code}>{c.flag} {c.code}</option>
                        ))}
                      </select>
                      <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                    <input type="tel" className="input flex-1" placeholder="7XX XXX XXX"
                      value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} autoFocus />
                  </div>
                  {phoneNumber && (
                    <p className="text-xs text-gray-400 mt-2">
                      {lang === 'rw' ? 'Nomero yose' : 'Full number'}: <span className="font-medium text-gray-700">{phoneCode}{phoneNumber.replace(/\s/g, '')}</span>
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
                    <p className="text-red-500 text-sm text-center mt-3">
                      {lang === 'rw' ? "Imibare y'ibanga ntihura — ongera ugerageze" : 'PINs do not match — try again'}
                    </p>
                  )}
                  {confirmPin.length === 4 && confirmPin === pin && (
                    <p className="text-green-600 text-sm text-center mt-3">
                      {lang === 'rw' ? '✓ Imibare ihura!' : '✓ PINs match!'}
                    </p>
                  )}
                </div>
              )}

              {/* Step 6 — Security question */}
              {step === 6 && (
                <div className="space-y-4">
                  <div>
                    <label className="label">{lang === 'rw' ? 'Hitamo ikibazo' : 'Choose a question'}</label>
                    <select className="input w-full" value={securityQuestion} onChange={e => setSecurityQuestion(e.target.value)}>
                      <option value="">{lang === 'rw' ? 'Hitamo ikibazo...' : 'Select a question...'}</option>
                      {SECURITY_QUESTIONS.map(q => (
                        <option key={q} value={q}>{q}</option>
                      ))}
                    </select>
                  </div>
                  {securityQuestion && (
                    <div>
                      <label className="label">{t('your_answer', lang)}</label>
                      <input type="text" className="input w-full"
                        placeholder={lang === 'rw' ? 'Andika igisubizo cyawe' : 'Enter your answer'}
                        value={securityAnswer} onChange={e => setSecurityAnswer(e.target.value)} autoFocus />
                      <p className="text-xs text-gray-400 mt-1">
                        {lang === 'rw' ? 'Ibuka igisubizo nkuko ubitsemo.' : 'Remember this answer exactly as you type it.'}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Step 7 — Email */}
              {step === 7 && (
                <div>
                  <label className="label">
                    {t('email_address', lang)} <span className="text-gray-300 font-normal">({lang === 'rw' ? 'Sitegeko' : 'optional'})</span>
                  </label>
                  <input type="email" className="input w-full" placeholder="e.g. yourname@gmail.com"
                    value={email} onChange={e => setEmail(e.target.value)} autoFocus />
                  <p className="text-xs text-gray-400 mt-2">{t('add_email_sub', lang)}</p>
                </div>
              )}

            </div>

            {/* Footer */}
            <div className="px-6 pb-6 space-y-3">
              {step !== 4 && step !== 5 && (
                <button onClick={next} disabled={loading} className="btn-primary w-full py-3">
                  {loading
                    ? (lang === 'rw' ? 'Birimo byandikwa...' : 'Creating account...')
                    : step === 7 ? t('finish_btn', lang) : t('continue_btn', lang)}
                </button>
              )}
              {step === 4 && (
                <button onClick={next} disabled={pin.length !== 4}
                  className={`btn-primary w-full py-3 ${pin.length !== 4 ? 'opacity-40 cursor-not-allowed' : ''}`}>
                  {t('continue_btn', lang)}
                </button>
              )}
              {step === 5 && (
                <button onClick={next} disabled={confirmPin.length !== 4 || confirmPin !== pin}
                  className={`btn-primary w-full py-3 ${(confirmPin.length !== 4 || confirmPin !== pin) ? 'opacity-40 cursor-not-allowed' : ''}`}>
                  {t('continue_btn', lang)}
                </button>
              )}
              {step === 7 && (
                <button onClick={() => { setEmail(''); handleSubmit() }}
                  className="w-full text-center text-gray-400 text-sm hover:text-gray-600 transition-colors py-1">
                  {t('skip_now', lang)}
                </button>
              )}
              {step === 1 && (
                <p className="text-center text-gray-400 text-sm">
                  {t('already_account', lang)}{' '}
                  <Link to="/login" className="text-blue-600 font-medium hover:text-blue-700">{t('sign_in', lang)}</Link>
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