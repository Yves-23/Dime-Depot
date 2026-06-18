import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { financesAPI } from '../lib/api'
import { formatRWF } from '../lib/helpers'
import { t } from '../lib/i18n'
import type { Language } from '../lib/i18n'
import toast from 'react-hot-toast'

interface UnpaidDebt {
  id: string
  client_name: string
  amount: number
  amount_paid: number
  entry_date: string
  is_paid: boolean
}

type PopupType =
  | { type: 'mark_paid'; debt: UnpaidDebt }
  | { type: 'partial_pay'; debt: UnpaidDebt }
  | null

export default function UnpaidDebts() {
  const { business } = useAuth()
  const lang: Language = (business as any)?.language || 'en'

  const [debts, setDebts] = useState<UnpaidDebt[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [popup, setPopup] = useState<PopupType>(null)
  const [saving, setSaving] = useState(false)
  const [partialAmount, setPartialAmount] = useState('')

  useEffect(() => { loadDebts() }, [])

  async function loadDebts() {
    setLoading(true)
    try {
      const data = await financesAPI.getUnpaidDebts()
      setDebts(data.debts)
    } catch {
      toast.error('Failed to load unpaid debts')
    } finally {
      setLoading(false)
    }
  }

  async function markAsPaid(debt: UnpaidDebt) {
    setSaving(true)
    try {
      await financesAPI.updateDebtPaid(debt.id, true)
      setDebts(prev => prev.filter(d => d.id !== debt.id))
      toast.success(`${debt.client_name} — ${t('yes_fully_paid', lang)}!`)
      setPopup(null)
    } catch {
      toast.error('Failed to mark as paid')
    } finally {
      setSaving(false)
    }
  }

  async function submitPartialPayment(debt: UnpaidDebt) {
    const amount = parseFloat(partialAmount.replace(/,/g, ''))
    if (!amount || amount <= 0) { toast.error('Please enter a valid amount'); return }

    const remaining = Number(debt.amount) - Number(debt.amount_paid || 0)
    if (amount > remaining) { toast.error(`Amount cannot exceed remaining balance of ${formatRWF(remaining)}`); return }

    setSaving(true)
    try {
      const data = await financesAPI.partialPayDebt(debt.id, amount)
      const updatedDebt = data.debt

      if (updatedDebt.is_paid) {
        setDebts(prev => prev.filter(d => d.id !== debt.id))
        toast.success(`${debt.client_name} — ${t('yes_fully_paid', lang)}!`)
      } else {
        setDebts(prev => prev.map(d => d.id === debt.id ? {
          ...d, amount_paid: updatedDebt.amount_paid, is_paid: updatedDebt.is_paid,
        } : d))
        const newRemaining = Number(updatedDebt.amount) - Number(updatedDebt.amount_paid)
        toast.success(`${t('record_payment', lang)}! ${t('remaining', lang)}: ${formatRWF(newRemaining)}`)
      }

      setPopup(null)
      setPartialAmount('')
    } catch {
      toast.error('Failed to record payment')
    } finally {
      setSaving(false)
    }
  }

  function formatDateSafe(dateStr: string): string {
    const clean = dateStr.split('T')[0]
    const [year, month, day] = clean.split('-').map(Number)
    return new Date(year, month - 1, day).toLocaleDateString('en-RW', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    })
  }

  function formatNumberInput(value: string): string {
    if (!value) return ''
    const num = value.replace(/,/g, '')
    if (isNaN(Number(num))) return value
    return Number(num).toLocaleString()
  }

  const filtered = debts.filter(d =>
    d.client_name.toLowerCase().includes(search.toLowerCase())
  )

  const totalRemaining = debts.reduce((sum, d) =>
    sum + (Number(d.amount) - Number(d.amount_paid || 0)), 0
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  return (
    <div>

      {/* Mark as paid popup */}
      {popup?.type === 'mark_paid' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900">{t('mark_fully_paid', lang)}</h2>
            </div>
            <p className="text-gray-500 text-sm mb-2">
              <span className="font-semibold text-gray-800">{popup.debt.client_name}</span>
            </p>
            <div className="bg-gray-50 rounded-lg p-3 mb-6 text-sm">
              <div className="flex justify-between mb-1">
                <span className="text-gray-500">{t('original_amount', lang)}</span>
                <span className="font-medium">{formatRWF(Number(popup.debt.amount))}</span>
              </div>
              {Number(popup.debt.amount_paid) > 0 && (
                <div className="flex justify-between mb-1">
                  <span className="text-gray-500">{t('already_paid', lang)}</span>
                  <span className="font-medium text-green-600">{formatRWF(Number(popup.debt.amount_paid))}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-gray-200 pt-1 mt-1">
                <span className="text-gray-700 font-medium">{t('remaining', lang)}</span>
                <span className="font-bold text-red-600">
                  {formatRWF(Number(popup.debt.amount) - Number(popup.debt.amount_paid || 0))}
                </span>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => markAsPaid(popup.debt)} disabled={saving} className="btn-primary flex-1">
                {saving ? t('saving', lang) : t('yes_fully_paid', lang)}
              </button>
              <button onClick={() => setPopup(null)} className="btn-secondary flex-1">{t('cancel', lang)}</button>
            </div>
          </div>
        </div>
      )}

      {/* Partial payment popup */}
      {popup?.type === 'partial_pay' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900">{t('partial_pay', lang)}</h2>
            </div>

            <p className="text-gray-700 font-medium mb-3 capitalize">{popup.debt.client_name}</p>

            <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">{t('original_amount', lang)}</span>
                <span className="font-medium">{formatRWF(Number(popup.debt.amount))}</span>
              </div>
              {Number(popup.debt.amount_paid) > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('already_paid', lang)}</span>
                  <span className="font-medium text-green-600">− {formatRWF(Number(popup.debt.amount_paid))}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-gray-200 pt-1 mt-1">
                <span className="text-gray-700 font-semibold">{t('remaining_balance', lang)}</span>
                <span className="font-bold text-red-600">
                  {formatRWF(Number(popup.debt.amount) - Number(popup.debt.amount_paid || 0))}
                </span>
              </div>
            </div>

            <div className="mb-5">
              <label className="label text-sm mb-1">{t('amount_paid_now', lang)}</label>
              <input
                type="text" inputMode="numeric"
                className="input w-full text-lg font-semibold"
                placeholder="e.g. 10,000"
                value={formatNumberInput(partialAmount)}
                onChange={e => setPartialAmount(e.target.value.replace(/,/g, ''))}
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <button onClick={() => submitPartialPayment(popup.debt)} disabled={saving || !partialAmount} className="btn-primary flex-1">
                {saving ? t('saving', lang) : t('record_payment', lang)}
              </button>
              <button onClick={() => { setPopup(null); setPartialAmount('') }} className="btn-secondary flex-1">
                {t('cancel', lang)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <h1 className="page-title mb-0">{t('unpaid_debts_title', lang)}</h1>
        {totalRemaining > 0 && (
          <p className="text-red-500 font-semibold text-sm mt-1">
            {debts.length} — {t('remaining', lang)}: {formatRWF(totalRemaining)}
          </p>
        )}
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder={t('search_client', lang)}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input pl-9 w-full"
        />
        {search && (
          <button onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xl font-bold">
            ×
          </button>
        )}
      </div>

      {/* Content */}
      {debts.length === 0 ? (
        <div className="card text-center py-12">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-gray-700 font-semibold text-lg">{t('all_paid', lang)}</p>
          <p className="text-gray-400 text-sm mt-1">{t('all_paid_sub', lang)}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-gray-500">{t('no_client_found', lang)} "{search}"</p>
          <button onClick={() => setSearch('')} className="text-blue-600 text-sm mt-2 font-medium">
            {t('clear_search', lang)}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(debt => {
            const remaining = Number(debt.amount) - Number(debt.amount_paid || 0)
            const hasPartialPayment = Number(debt.amount_paid) > 0

            return (
              <div key={debt.id} className="card border border-red-100 bg-red-50/30">
                <p className="text-xs text-gray-400 font-medium mb-2 uppercase tracking-wide">
                  {formatDateSafe(debt.entry_date)}
                </p>

                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="font-semibold text-gray-900 text-base capitalize">{debt.client_name}</p>
                    {hasPartialPayment ? (
                      <div className="mt-1 space-y-0.5">
                        <p className="text-xs text-gray-400 line-through">{formatRWF(Number(debt.amount))}</p>
                        <p className="text-xs text-green-600 font-medium">{t('already_paid', lang)}: {formatRWF(Number(debt.amount_paid))}</p>
                        <p className="text-red-600 font-bold text-base">{t('remaining', lang)}: {formatRWF(remaining)}</p>
                      </div>
                    ) : (
                      <p className="text-red-600 font-bold text-lg">{formatRWF(Number(debt.amount))}</p>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => { setPartialAmount(''); setPopup({ type: 'partial_pay', debt }) }}
                    className="flex-1 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 px-3 py-2 rounded-lg text-sm font-semibold transition-all"
                  >
                    {t('partial_pay', lang)}
                  </button>
                  <button
                    onClick={() => setPopup({ type: 'mark_paid', debt })}
                    className="flex-1 bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 px-3 py-2 rounded-lg text-sm font-semibold transition-all"
                  >
                    {t('fully_paid', lang)}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}