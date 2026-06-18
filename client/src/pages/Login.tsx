import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { authAPI, setToken, setBusiness } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
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
      <div className="flex justify-center gap-3 mb-4">
        {[0,1,2,3].map(i => (
          <div key={i} className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center text-2xl font-bold transition-all ${
            value[i] !== undefined ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-200 text-gray-300'
          }`}>
            {value[i] ? '●' : '○'}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {keys.map((key, i) => (
          <button key={i} onClick={() => press(key)} disabled={key === ''}
            className={`h-12 rounded-xl text-xl font-semibold transition-all ${
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

export default function Login() {
  const navigate = useNavigate()
  const { setBusinessState } = useAuth()
  const [phoneCode, setPhoneCode] = useState('+250')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [lang, setLang] = useState<Language>(getInitialLang())

  function fullPhone() {
    return `${phoneCode}${phoneNumber.replace(/\s/g, '')}`
  }

  function toggleLang() {
    const newLang = lang === 'en' ? 'rw' : 'en'
    setLang(newLang)
    localStorage.setItem('dime-depot-lang', newLang)
  }

  async function handleLogin() {
    if (!phoneNumber.trim()) { toast.error(lang === 'rw' ? 'Andika nomero ya telefone' : 'Please enter your phone number'); return }
    if (!/^\d{4}$/.test(pin)) { toast.error(lang === 'rw' ? "Umubare w'ibanga ni imibare 4" : 'PIN must be 4 digits'); return }

    setLoading(true)
    try {
      const data = await authAPI.login({ phone: fullPhone(), pin })
      setToken(data.token)
      setBusiness(data.business)
      if (setBusinessState) setBusinessState(data.business)
      if (data.business?.language) {
        localStorage.setItem('dime-depot-lang', data.business.language)
      }
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
          <div className="h-1.5 bg-gradient-to-r from-blue-500 to-blue-700" />

          <div className="px-8 py-8">

            {/* Logo + lang toggle */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
                  <span className="text-white font-bold text-lg">D</span>
                </div>
                <span className="text-xl font-bold text-gray-900">Dime-Depot</span>
              </div>
              <button onClick={toggleLang}
                className="text-xs font-semibold border border-gray-200 rounded-lg px-3 py-1.5 text-gray-500 hover:bg-gray-50 transition-colors">
                {lang === 'en' ? '🇷🇼 RW' : '🇬🇧 EN'}
              </button>
            </div>

            {/* Title */}
            <div className="mb-7">
              <h2 className="text-2xl font-bold text-gray-900 mb-1">{t('welcome_back', lang)}</h2>
              <p className="text-gray-400 text-sm">{t('enter_phone_pin', lang)}</p>
            </div>

            {/* Phone */}
            <div className="mb-5">
              <label className="label">{t('phone_number', lang)}</label>
              <div className="flex gap-2">
                <div className="relative">
                  <select
                    className="input appearance-none pr-7 pl-3 cursor-pointer font-medium text-gray-800 bg-gray-50"
                    value={phoneCode}
                    onChange={e => setPhoneCode(e.target.value)}
                    style={{ minWidth: '95px' }}>
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
            </div>

            {/* PIN — keypad, fully masked */}
            <div className="mb-2">
              <label className="label">{t('pin', lang)}</label>
              <PinKeypad value={pin} onChange={setPin} />
            </div>

            <div className="flex justify-end mb-2">
              <Link to="/reset-pin" className="text-blue-600 text-sm font-medium hover:text-blue-700 transition-colors">
                {t('forgot_pin', lang)}
              </Link>
            </div>

            <button
              onClick={handleLogin}
              disabled={loading || pin.length !== 4}
              className={`btn-primary w-full py-3 mt-4 ${pin.length !== 4 ? 'opacity-50 cursor-not-allowed' : ''}`}>
              {loading ? t('signing_in', lang) : t('sign_in', lang)}
            </button>

            <p className="text-center text-gray-400 text-sm mt-5">
              {t('no_account', lang)}{' '}
              <Link to="/register" className="text-blue-600 font-medium hover:text-blue-700 transition-colors">
                {t('register', lang)}
              </Link>
            </p>

          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">Dime-Depot by DimePlug • Made in Rwanda 🇷🇼</p>
      </div>
    </div>
  )
}