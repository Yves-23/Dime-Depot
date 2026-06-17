import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { authAPI } from '../lib/api'
import toast from 'react-hot-toast'
import { t } from '../lib/i18n'
import type { Language } from '../lib/i18n'

const SECURITY_QUESTIONS = [
  'What is your business location?',
  'What is the name of your first employee?',
  'What is the name of the street your business is on?',
  'What was your first product you ever sold?',
  "What is your mother's first name?",
]

type Section = 'main' | 'change_pin' | 'security_question' | 'email'

function PinDots({ value, match }: { value: string; match?: string }) {
  return (
    <div className="flex justify-between gap-3 mb-3">
      {[0, 1, 2, 3].map(i => {
        const filled = value[i] !== undefined
        const isConfirm = match !== undefined
        const correct = isConfirm && filled && value === match?.slice(0, value.length)
        const wrong = isConfirm && filled && value !== match?.slice(0, value.length)
        return (
          <div
            key={i}
            className={`flex-1 h-14 rounded-xl border-2 flex items-center justify-center text-2xl font-bold transition-all ${
              filled
                ? wrong
                  ? 'border-red-400 bg-red-50 text-red-600'
                  : correct
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-blue-600 bg-blue-50 text-blue-700'
                : 'border-gray-200 text-gray-300'
            }`}
          >
            {filled ? '●' : '○'}
          </div>
        )
      })}
    </div>
  )
}

export default function Settings() {
  const { business, refreshBusiness, signOut, setBusinessState } = useAuth()
  const navigate = useNavigate()
  const [section, setSection] = useState<Section>('main')
  const [loading, setLoading] = useState(false)
  const [signOutConfirm, setSignOutConfirm] = useState(false)
  const [langLoading, setLangLoading] = useState(false)

  const lang: Language = (business as any)?.language || 'en'

  // Change PIN
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')

  // Security question
  const [currentAnswer, setCurrentAnswer] = useState('')
  const [newQuestion, setNewQuestion] = useState('')
  const [newAnswer, setNewAnswer] = useState('')

  // Email
  const [email, setEmail] = useState(business?.email || '')

  function handlePinInput(value: string, setter: (v: string) => void) {
    const digits = value.replace(/\D/g, '').slice(0, 4)
    setter(digits)
  }

  function resetForms() {
    setCurrentPin('')
    setNewPin('')
    setConfirmPin('')
    setCurrentAnswer('')
    setNewQuestion('')
    setNewAnswer('')
    setEmail(business?.email || '')
  }

  function handleSignOut() {
    signOut()
    toast.success(lang === 'rw' ? 'Wasohowe neza!' : 'Signed out successfully')
    navigate('/login')
  }

  async function handleChangePin() {
    if (!/^\d{4}$/.test(currentPin)) { toast.error('Current PIN must be 4 digits'); return }
    if (!/^\d{4}$/.test(newPin)) { toast.error('New PIN must be 4 digits'); return }
    if (newPin !== confirmPin) { toast.error('New PINs do not match'); return }
    if (currentPin === newPin) { toast.error('New PIN must be different from current PIN'); return }

    setLoading(true)
    try {
      await authAPI.changePin(currentPin, newPin)
      toast.success('PIN changed successfully!')
      resetForms()
      setSection('main')
    } catch (error: any) {
      toast.error(error.message || 'Failed to change PIN')
    } finally {
      setLoading(false)
    }
  }

  async function handleUpdateSecurityQuestion() {
    if (!currentAnswer.trim()) { toast.error('Please enter your current security answer'); return }
    if (!newQuestion) { toast.error('Please select a new security question'); return }
    if (!newAnswer.trim() || newAnswer.trim().length < 2) { toast.error('Please enter your new answer'); return }

    setLoading(true)
    try {
      await authAPI.resetPinVerify({
        phone: business?.phone || '',
        security_answer: currentAnswer.trim(),
      })
      toast.success('Security question updated!')
      resetForms()
      setSection('main')
      refreshBusiness()
    } catch (error: any) {
      toast.error(error.message || 'Current answer is incorrect')
    } finally {
      setLoading(false)
    }
  }

  async function handleUpdateEmail() {
    if (email && !email.includes('@')) { toast.error('Please enter a valid email'); return }
    setLoading(true)
    try {
      toast.success('Email updated successfully!')
      resetForms()
      setSection('main')
      refreshBusiness()
    } catch (error: any) {
      toast.error(error.message || 'Failed to update email')
    } finally {
      setLoading(false)
    }
  }

  async function handleLanguageChange(newLang: Language) {
    if (newLang === lang) return
    setLangLoading(true)
    try {
      await authAPI.updateLanguage(newLang)
      // Update business state immediately so UI reflects change
      if (setBusinessState && business) {
        setBusinessState({ ...business, language: newLang } as any)
      }
      toast.success(newLang === 'rw' ? 'Ururimi rwahinduwe!' : 'Language updated!')
    } catch (error: any) {
      toast.error(error.message || 'Failed to update language')
    } finally {
      setLangLoading(false)
    }
  }

  return (
    <div>

      {/* Sign out confirmation popup */}
      {signOutConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900">{t('sign_out_confirm', lang)}</h2>
            </div>
            <p className="text-gray-500 text-sm mb-6">
              {t('sign_out_confirm_msg', lang)} <span className="font-semibold text-gray-800">{business?.business_name}</span>?
            </p>
            <div className="flex gap-3">
              <button onClick={handleSignOut} className="flex-1 bg-red-600 text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-red-700 transition-colors">
                {t('yes_sign_out', lang)}
              </button>
              <button onClick={() => setSignOutConfirm(false)} className="btn-secondary flex-1">
                {t('cancel', lang)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Back button when in sub-section */}
      {section !== 'main' && (
        <button
          onClick={() => { setSection('main'); resetForms() }}
          className="flex items-center gap-1 text-gray-400 text-sm mb-6 hover:text-gray-600"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {lang === 'rw' ? 'Subira inyuma' : 'Back to Settings'}
        </button>
      )}

      {/* MAIN SETTINGS */}
      {section === 'main' && (
        <div>
          <h1 className="page-title">{t('settings_title', lang)}</h1>

          {/* Account info */}
          <div className="card mb-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">{t('account', lang)}</p>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">{t('owner_name', lang)}</span>
                <span className="text-sm font-medium text-gray-900">{business?.owner_name}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">{t('business_name', lang)}</span>
                <span className="text-sm font-medium text-gray-900">{business?.business_name}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">{t('phone', lang)}</span>
                <span className="text-sm font-medium text-gray-900">{business?.phone}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">{t('country', lang)}</span>
                <span className="text-sm font-medium text-gray-900">{business?.country || 'Rwanda'}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-gray-500">{t('currency', lang)}</span>
                <span className="text-sm font-medium text-gray-900">{(business as any)?.currency || 'RWF'}</span>
              </div>
            </div>
          </div>

          {/* Language toggle */}
          <div className="card mb-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">{t('language', lang)}</p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">{t('language', lang)}</p>
                <p className="text-xs text-gray-400">{t('language_sub', lang)}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleLanguageChange('en')}
                  disabled={langLoading}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${
                    lang === 'en'
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  🇬🇧 EN
                </button>
                <button
                  onClick={() => handleLanguageChange('rw')}
                  disabled={langLoading}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${
                    lang === 'rw'
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  🇷🇼 RW
                </button>
              </div>
            </div>
          </div>

          {/* Security options */}
          <div className="card mb-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">{t('security', lang)}</p>
            <div className="space-y-1">

              <button
                onClick={() => setSection('change_pin')}
                className="w-full flex items-center justify-between py-3 px-1 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-gray-900">{t('change_pin', lang)}</p>
                    <p className="text-xs text-gray-400">{t('change_pin_sub', lang)}</p>
                  </div>
                </div>
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              <button
                onClick={() => setSection('security_question')}
                className="w-full flex items-center justify-between py-3 px-1 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-orange-100 rounded-xl flex items-center justify-center">
                    <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-gray-900">{t('security_question', lang)}</p>
                    <p className="text-xs text-gray-400 truncate max-w-[180px]">{business?.security_question || t('security_question_sub', lang)}</p>
                  </div>
                </div>
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              <button
                onClick={() => setSection('email')}
                className="w-full flex items-center justify-between py-3 px-1 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-green-100 rounded-xl flex items-center justify-center">
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-gray-900">{t('email_address', lang)}</p>
                    <p className="text-xs text-gray-400">{business?.email || t('email_not_set', lang)}</p>
                  </div>
                </div>
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

            </div>
          </div>

          {/* About */}
          <div className="card mb-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">{t('about', lang)}</p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shrink-0">
                <span className="text-white font-bold">D</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Dime-Depot</p>
                <p className="text-xs text-gray-400">by DimePlug • Made in Rwanda 🇷🇼</p>
              </div>
            </div>
          </div>

          {/* Sign out */}
          <div className="card border border-red-100">
            <button
              onClick={() => setSignOutConfirm(true)}
              className="flex items-center gap-3 w-full text-red-600 font-medium text-sm py-1 px-1 hover:bg-red-50 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              {t('sign_out', lang)}
            </button>
          </div>
        </div>
      )}

      {/* CHANGE PIN */}
      {section === 'change_pin' && (
        <div>
          <h1 className="page-title">{t('change_pin', lang)}</h1>
          <div className="card space-y-6">
            <div>
              <label className="label">{lang === 'rw' ? 'PIN ya none' : 'Current PIN'}</label>
              <PinDots value={currentPin} />
              <input type="number" className="input text-center text-3xl py-4 w-full tracking-widest"
                placeholder="••••" value={currentPin}
                onChange={e => handlePinInput(e.target.value, setCurrentPin)} autoFocus />
            </div>
            <div>
              <label className="label">{lang === 'rw' ? 'PIN nshya' : 'New PIN'}</label>
              <PinDots value={newPin} />
              <input type="number" className="input text-center text-3xl py-4 w-full tracking-widest"
                placeholder="••••" value={newPin}
                onChange={e => handlePinInput(e.target.value, setNewPin)} />
            </div>
            <div>
              <label className="label">{lang === 'rw' ? 'Emeza PIN nshya' : 'Confirm new PIN'}</label>
              <PinDots value={confirmPin} match={newPin} />
              <input type="number" className="input text-center text-3xl py-4 w-full tracking-widest"
                placeholder="••••" value={confirmPin}
                onChange={e => handlePinInput(e.target.value, setConfirmPin)} />
              {confirmPin.length === 4 && confirmPin !== newPin && (
                <p className="text-red-500 text-sm text-center mt-2">
                  {lang === 'rw' ? 'PIN ntizihura' : 'PINs do not match'}
                </p>
              )}
            </div>
            <button onClick={handleChangePin} disabled={loading} className="btn-primary w-full py-3">
              {loading ? (lang === 'rw' ? 'Birabikwa...' : 'Saving...') : (lang === 'rw' ? 'Hindura PIN' : 'Change PIN')}
            </button>
          </div>
        </div>
      )}

      {/* SECURITY QUESTION */}
      {section === 'security_question' && (
        <div>
          <h1 className="page-title">{t('security_question', lang)}</h1>
          <div className="card space-y-4">
            {business?.security_question && (
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-1">{lang === 'rw' ? 'Ikibazo cy\'ubu' : 'Current question'}</p>
                <p className="text-sm font-medium text-gray-800">{business.security_question}</p>
              </div>
            )}
            <div>
              <label className="label">{lang === 'rw' ? 'Banza emeza igisubizo cy\'ubu' : 'Verify current answer first'}</label>
              <input type="text" className="input w-full"
                placeholder={lang === 'rw' ? 'Igisubizo cy\'ubu' : 'Your current answer'}
                value={currentAnswer} onChange={e => setCurrentAnswer(e.target.value)} autoFocus />
            </div>
            <div>
              <label className="label">{lang === 'rw' ? 'Ikibazo gishya' : 'New security question'}</label>
              <select className="input w-full" value={newQuestion} onChange={e => setNewQuestion(e.target.value)}>
                <option value="">{lang === 'rw' ? 'Hitamo ikibazo...' : 'Select a question...'}</option>
                {SECURITY_QUESTIONS.map(q => (
                  <option key={q} value={q}>{q}</option>
                ))}
              </select>
            </div>
            {newQuestion && (
              <div>
                <label className="label">{lang === 'rw' ? 'Igisubizo gishya' : 'New answer'}</label>
                <input type="text" className="input w-full"
                  placeholder={lang === 'rw' ? 'Igisubizo cyawe gishya' : 'Your new answer'}
                  value={newAnswer} onChange={e => setNewAnswer(e.target.value)} />
                <p className="text-xs text-gray-400 mt-1">
                  {lang === 'rw' ? 'Ibuka igisubizo nkuko ubitsemo.' : 'Remember this answer exactly as you type it.'}
                </p>
              </div>
            )}
            <button onClick={handleUpdateSecurityQuestion} disabled={loading} className="btn-primary w-full py-3">
              {loading
                ? (lang === 'rw' ? 'Birabikwa...' : 'Saving...')
                : (lang === 'rw' ? 'Vugurura ikibazo' : 'Update security question')}
            </button>
          </div>
        </div>
      )}

      {/* EMAIL */}
      {section === 'email' && (
        <div>
          <h1 className="page-title">{t('email_address', lang)}</h1>
          <div className="card space-y-4">
            <p className="text-sm text-gray-500">
              {business?.email
                ? (lang === 'rw' ? 'Vugurura imeyili yawe.' : 'Update your email address. This is used as an extra way to reset your PIN.')
                : (lang === 'rw' ? 'Ongeraho imeyili kugirango uzabashe gusubiramo PIN.' : 'Add an email address as an extra way to reset your PIN if you forget it.')}
            </p>
            <div>
              <label className="label">{t('email_address', lang)}</label>
              <input type="email" className="input w-full text-lg py-3" placeholder="your@email.com"
                value={email} onChange={e => setEmail(e.target.value)} autoFocus />
            </div>
            <button onClick={handleUpdateEmail} disabled={loading} className="btn-primary w-full py-3">
              {loading
                ? (lang === 'rw' ? 'Birikubikwa...' : 'Saving...')
                : business?.email
                  ? (lang === 'rw' ? 'Vugurura imeli' : 'Update email')
                  : (lang === 'rw' ? 'Ongeraho imeli' : 'Add email')}
            </button>
          </div>
        </div>
      )}

    </div>
  )
}