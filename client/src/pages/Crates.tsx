import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { suppliersAPI } from '../lib/api'
import type { Supplier } from '../lib/types'
import { t } from '../lib/i18n'
import type { Language } from '../lib/i18n'
import toast from 'react-hot-toast'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

interface CrateType {
  id: string
  supplier_id: string
  supplier_name: string
  total_owned: number
  total_lent_out: number
  total_borrowed: number
}

interface Lending {
  id: string
  crate_type_id: string
  client_name: string
  phone: string | null
  crates_lent: number
  crates_returned: number
  is_fully_returned: boolean
  lent_date: string
}

interface Borrowing {
  id: string
  crate_type_id: string
  borrowed_from: string
  crates_borrowed: number
  crates_returned: number
  is_returned: boolean
  borrowed_date: string
}

interface ReturnHistory {
  id: string
  crate_type_id: string
  lending_id: string | null
  borrowing_id: string | null
  return_type: 'client_return' | 'borrowed_return'
  quantity: number
  return_date: string
  created_at: string
  supplier_name: string
  client_name: string | null
  borrowed_from: string | null
}

type ModalType =
  | { type: 'adjust_owned'; crateType: CrateType; mode: 'add' | 'remove' }
  | { type: 'lend'; crateType: CrateType }
  | { type: 'return_lend'; lending: Lending; mode: 'partial' | 'full' }
  | { type: 'borrow'; crateType: CrateType }
  | { type: 'return_borrow'; borrowing: Borrowing; mode: 'partial' | 'full' }
  | null

function today(): string {
  return new Date().toISOString().split('T')[0]
}

function formatDateSafe(dateStr: string): string {
  const clean = dateStr.split('T')[0]
  const [year, month, day] = clean.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-RW', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function num(val: any): number {
  return parseInt(String(val)) || 0
}

function getBrandColors(supplierName: string) {
  const isBralirwa = supplierName.toLowerCase().includes('bral')
  return {
    // Summary card colors
    bg: isBralirwa ? '#0E5A36' : '#FEDA1B',
    text: isBralirwa ? '#FFFFFF' : '#D0262B',
    subText: isBralirwa ? 'rgba(255,255,255,0.65)' : 'rgba(208,38,43,0.65)',
    badgeBg: isBralirwa ? 'rgba(255,255,255,0.15)' : 'rgba(208,38,43,0.12)',
    badgeText: isBralirwa ? 'rgba(255,255,255,0.9)' : '#D0262B',
    // Borrow card colors — same gray for both suppliers
    borrowBg: '#7a7d7c',
    borrowText: '#FFFFFF',
  }
}

export default function Crates() {
  const { business } = useAuth()
  const lang: Language = (business as any)?.language || 'en'
  const token = localStorage.getItem('dime-depot-token')
  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }

  const [crateTypes, setCrateTypes] = useState<CrateType[]>([])
  const [lendings, setLendings] = useState<Lending[]>([])
  const [borrowings, setBorrowings] = useState<Borrowing[]>([])
  const [returnHistory, setReturnHistory] = useState<ReturnHistory[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyLimit, setHistoryLimit] = useState(10)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<ModalType>(null)
  const [selectedCrateType, setSelectedCrateType] = useState<CrateType | null>(null)

  const [formValue, setFormValue] = useState('')
  const [formName, setFormName] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formDate, setFormDate] = useState(today())
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (business) loadAll() }, [business])

  async function loadAll() {
    setLoading(true)
    try {
      const [typesRes, lendingsRes, borrowingsRes, historyRes, suppliersData] = await Promise.all([
        fetch(`${API_URL}/api/crates/types`, { headers }),
        fetch(`${API_URL}/api/crates/lendings`, { headers }),
        fetch(`${API_URL}/api/crates/borrowings`, { headers }),
        fetch(`${API_URL}/api/crates/return-history`, { headers }),
        suppliersAPI.getAll(),
      ])
      const typesData = await typesRes.json()
      const lendingsData = await lendingsRes.json()
      const borrowingsData = await borrowingsRes.json()
      const historyData = await historyRes.json()
      const suppList: Supplier[] = suppliersData.suppliers || []
      const existingTypes: CrateType[] = typesData.crate_types || []

      for (const supplier of suppList) {
        if (!existingTypes.find(ct => ct.supplier_id === supplier.id)) {
          await fetch(`${API_URL}/api/crates/types`, {
            method: 'POST', headers,
            body: JSON.stringify({ supplier_id: supplier.id, total_owned: 0 }),
          })
        }
      }

      const freshRes = await fetch(`${API_URL}/api/crates/types`, { headers })
      const freshData = await freshRes.json()
      const parsedTypes = (freshData.crate_types || []).map((ct: any) => ({
        ...ct,
        total_owned: num(ct.total_owned),
        total_lent_out: num(ct.total_lent_out),
        total_borrowed: num(ct.total_borrowed),
      }))

      setCrateTypes(parsedTypes)
      setLendings(lendingsData.lendings || [])
      setBorrowings(borrowingsData.borrowings || [])
      setReturnHistory(historyData.return_history || [])

      if (selectedCrateType) {
        const updated = parsedTypes.find((ct: CrateType) => ct.id === selectedCrateType.id)
        if (updated) setSelectedCrateType(updated)
      }
    } catch {
      toast.error('Failed to load crate data')
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setFormValue(''); setFormName(''); setFormPhone(''); setFormDate(today())
  }
  function openModal(m: ModalType) { resetForm(); setModal(m) }

  const selected = selectedCrateType
    ? crateTypes.find(ct => ct.id === selectedCrateType.id) || selectedCrateType
    : null

  const selectedLendings = selected ? lendings.filter(l => l.crate_type_id === selected.id) : []
  const selectedBorrowings = selected ? borrowings.filter(b => b.crate_type_id === selected.id) : []
  const activeLendings = selectedLendings.filter(l => !l.is_fully_returned)
  const activeBorrowings = selectedBorrowings.filter(b => !b.is_returned)
  const selectedReturnHistory = selected ? returnHistory.filter(h => h.crate_type_id === selected.id) : []

  async function handleAdjustOwned() {
    if (!formValue || num(formValue) <= 0) { toast.error(lang === 'rw' ? 'Andika umubare' : 'Enter a number'); return }
    if (!modal || modal.type !== 'adjust_owned') return
    setSaving(true)
    try {
      const current = modal.crateType.total_owned
      const newTotal = modal.mode === 'add'
        ? current + num(formValue)
        : Math.max(0, current - num(formValue))
      const res = await fetch(`${API_URL}/api/crates/types/${modal.crateType.id}`, {
        method: 'PUT', headers, body: JSON.stringify({ total_owned: newTotal }),
      })
      if (!res.ok) throw new Error()
      toast.success(lang === 'rw' ? 'Byabitswe!' : 'Updated!')
      setModal(null); loadAll()
    } catch { toast.error('Failed') }
    finally { setSaving(false) }
  }

  async function handleLend() {
    if (!formName.trim()) { toast.error(lang === 'rw' ? 'Andika izina' : 'Enter client name'); return }
    if (!formValue || num(formValue) <= 0) { toast.error(lang === 'rw' ? 'Kaziye zingahe' : 'Enter number of crates'); return }
    if (!modal || modal.type !== 'lend') return
    setSaving(true)
    try {
      await fetch(`${API_URL}/api/crates/lendings`, {
        method: 'POST', headers,
        body: JSON.stringify({
          crate_type_id: modal.crateType.id,
          client_name: formName,
          phone: formPhone || null,
          crates_lent: num(formValue),
          lent_date: formDate,
        }),
      })
      toast.success(lang === 'rw' ? 'Byabitswe!' : 'Recorded!')
      setModal(null); loadAll()
    } catch { toast.error('Failed') }
    finally { setSaving(false) }
  }

  async function handleReturnLend() {
    if (!modal || modal.type !== 'return_lend') return
    if (modal.mode === 'partial' && (!formValue || num(formValue) <= 0)) {
      toast.error(lang === 'rw' ? 'Andika umubare' : 'Enter number'); return
    }
    setSaving(true)
    try {
      await fetch(`${API_URL}/api/crates/lendings/${modal.lending.id}/return`, {
        method: 'PUT', headers,
        body: JSON.stringify(
          modal.mode === 'full'
            ? { full: true }
            : { crates_returned: num(formValue), full: false }
        ),
      })
      toast.success(lang === 'rw' ? 'Byabitswe!' : 'Return recorded!')
      setModal(null); loadAll()
    } catch { toast.error('Failed') }
    finally { setSaving(false) }
  }

  async function handleBorrow() {
    if (!formName.trim()) { toast.error(lang === 'rw' ? 'Andika izina' : 'Enter name'); return }
    if (!formValue || num(formValue) <= 0) { toast.error(lang === 'rw' ? 'Kaziye zingahe' : 'Enter number of crates'); return }
    if (!modal || modal.type !== 'borrow') return
    setSaving(true)
    try {
      await fetch(`${API_URL}/api/crates/borrowings`, {
        method: 'POST', headers,
        body: JSON.stringify({
          crate_type_id: modal.crateType.id,
          borrowed_from: formName,
          crates_borrowed: num(formValue),
          borrowed_date: formDate,
        }),
      })
      toast.success(lang === 'rw' ? 'Byabitswe!' : 'Recorded!')
      setModal(null); loadAll()
    } catch { toast.error('Failed') }
    finally { setSaving(false) }
  }

  async function handleReturnBorrow() {
    if (!modal || modal.type !== 'return_borrow') return
    if (modal.mode === 'partial' && (!formValue || num(formValue) <= 0)) {
      toast.error(lang === 'rw' ? 'Andika umubare' : 'Enter number'); return
    }
    setSaving(true)
    try {
      await fetch(`${API_URL}/api/crates/borrowings/${modal.borrowing.id}/return`, {
        method: 'PUT', headers,
        body: JSON.stringify(
          modal.mode === 'full'
            ? { full: true }
            : { crates_returned: num(formValue), full: false }
        ),
      })
      toast.success(lang === 'rw' ? 'Byabitswe!' : 'Returned!')
      setModal(null); loadAll()
    } catch { toast.error('Failed') }
    finally { setSaving(false) }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-gray-500">Loading...</div>
    </div>
  )

  return (
    <div>

      {/* ── MODAL ── */}
      {modal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">

            {/* Adjust owned — add or remove */}
            {modal.type === 'adjust_owned' && (
              <>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">
                  {modal.mode === 'add'
                    ? (modal.crateType.total_owned === 0
                      ? (lang === 'rw' ? t('crates_set_owned_title', lang) : 'Set your total owned crates')
                      : (lang === 'rw' ? t('crates_add_bought_title', lang) : 'Add newly bought crates'))
                    : (lang === 'rw' ? 'Kura Kaziye zabuze/zibwe' : 'Remove lost / stolen crates')}
                </h2>
                <p className="text-sm font-medium mb-1" style={{ color: getBrandColors(modal.crateType.supplier_name).bg }}>
                  {modal.crateType.supplier_name}
                </p>
                {modal.crateType.total_owned > 0 && (
                  <div className="bg-gray-50 rounded-xl p-3 mb-4 text-sm flex justify-between">
                    <span className="text-gray-500">{lang === 'rw' ? t('crates_currently_owned', lang) : 'Currently:'}</span>
                    <span className="font-bold">{modal.crateType.total_owned}</span>
                    {formValue && num(formValue) > 0 && (
                      <>
                        <span className="text-gray-400">→</span>
                        <span className={`font-bold ${modal.mode === 'add' ? 'text-green-600' : 'text-red-600'}`}>
                          {modal.mode === 'add'
                            ? modal.crateType.total_owned + num(formValue)
                            : Math.max(0, modal.crateType.total_owned - num(formValue))}
                        </span>
                      </>
                    )}
                  </div>
                )}
                <label className="label">
                  {modal.mode === 'add'
                    ? (modal.crateType.total_owned === 0
                      ? (lang === 'rw' ? t('crates_total_own_label', lang) : 'Total crates you own')
                      : (lang === 'rw' ? t('crates_just_bought_label', lang) : 'Crates just bought'))
                    : (lang === 'rw' ? 'Kaziye zabuze / zibwe' : 'Crates lost / stolen')}
                </label>
                <input type="number" min="1" className="input w-full text-2xl text-center py-4 mb-5"
                  placeholder="0" value={formValue} onChange={e => setFormValue(e.target.value)} autoFocus />
                <div className="flex gap-3">
                  <button onClick={handleAdjustOwned} disabled={saving}
                    className={`flex-1 py-2.5 rounded-xl font-semibold text-sm text-white transition-colors ${modal.mode === 'add' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
                    {saving ? '...' : (lang === 'rw' ? t('save', lang) : 'Save')}
                  </button>
                  <button onClick={() => setModal(null)} className="btn-secondary flex-1">{lang === 'rw' ? t('cancel', lang) : 'Cancel'}</button>
                </div>
              </>
            )}

            {/* Lend to client */}
            {modal.type === 'lend' && (
              <>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">
                  {lang === 'rw' ? t('crates_lend_modal_title', lang) : 'Lend crates to client'}
                </h2>
                <p className="text-sm font-medium mb-4" style={{ color: getBrandColors(modal.crateType.supplier_name).bg }}>
                  {modal.crateType.supplier_name}
                </p>
                <div className="space-y-3 mb-5">
                  <div>
                    <label className="label">{lang === 'rw' ? t('crates_client_name', lang) : 'Client name'}</label>
                    <input type="text" className="input w-full"
                      placeholder={lang === 'rw' ? t('crates_enter_name', lang) : 'Enter name'}
                      value={formName} onChange={e => setFormName(e.target.value)} autoFocus />
                  </div>
                  <div>
                    <label className="label">
                      {lang === 'rw' ? 'Telefone' : 'Phone number'}
                      <span className="text-gray-400 font-normal text-xs ml-1">({lang === 'rw' ? 'Sitegekan' : 'optional'})</span>
                    </label>
                    <input type="tel" className="input w-full"
                      placeholder={lang === 'rw' ? 'urugero: 078xxxxxxx' : 'e.g. 078xxxxxxx'}
                      value={formPhone} onChange={e => setFormPhone(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">{lang === 'rw' ? t('crates_num_crates', lang) : 'Number of crates'}</label>
                    <input type="number" min="1" className="input w-full text-xl text-center py-3"
                      placeholder="0" value={formValue} onChange={e => setFormValue(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">{lang === 'rw' ? t('crates_date', lang) : 'Date'}</label>
                    <input type="date" className="input w-full" value={formDate}
                      onChange={e => setFormDate(e.target.value)} max={today()} />
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={handleLend} disabled={saving} className="btn-primary flex-1">
                    {saving ? '...' : (lang === 'rw' ? t('save', lang) : 'Save')}
                  </button>
                  <button onClick={() => setModal(null)} className="btn-secondary flex-1">
                    {lang === 'rw' ? t('cancel', lang) : 'Cancel'}
                  </button>
                </div>
              </>
            )}

            {/* Return from client — partial or full */}
            {modal.type === 'return_lend' && (
              <>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">
                  {modal.mode === 'full'
                    ? (lang === 'rw' ? 'Yatiruye Kaziye zose' : 'Client returned all crates')
                    : (lang === 'rw' ? t('crates_client_returned_title', lang) : 'Partial crate return')}
                </h2>
                <p className="text-sm text-blue-600 font-medium mb-3 capitalize">{modal.lending.client_name}</p>
                {modal.lending.phone && (
                  <p className="text-xs text-gray-400 mb-3">📞 {modal.lending.phone}</p>
                )}
                <div className="bg-gray-50 rounded-xl p-3 mb-4 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">{lang === 'rw' ? t('crates_borrowed_label', lang) : 'Lent'}</span>
                    <span className="font-bold">{modal.lending.crates_lent}</span>
                  </div>
                  {num(modal.lending.crates_returned) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">{lang === 'rw' ? t('crates_already_returned', lang) : 'Already returned'}</span>
                      <span className="font-medium text-green-600">{modal.lending.crates_returned}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-1 mt-1">
                    <span className="text-gray-700 font-medium">{lang === 'rw' ? t('crates_still_owes', lang) : 'Still owes'}</span>
                    <span className="font-bold text-red-600">
                      {num(modal.lending.crates_lent) - num(modal.lending.crates_returned)}
                    </span>
                  </div>
                </div>
                {modal.mode === 'full' ? (
                  <p className="text-sm text-gray-500 mb-5">
                    {lang === 'rw'
                      ? 'Emeza ko yatiruye Kaziye zose zibasigaye.'
                      : 'Confirm this client has returned all remaining crates.'}
                  </p>
                ) : (
                  <>
                    <label className="label">{lang === 'rw' ? t('crates_returning_now', lang) : 'Returning now'}</label>
                    <input type="number" min="1"
                      max={num(modal.lending.crates_lent) - num(modal.lending.crates_returned)}
                      className="input w-full text-xl text-center py-3 mb-5"
                      placeholder="0" value={formValue} onChange={e => setFormValue(e.target.value)} autoFocus />
                  </>
                )}
                <div className="flex gap-3">
                  <button onClick={handleReturnLend} disabled={saving}
                    className="flex-1 bg-green-600 text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-green-700">
                    {saving ? '...' : (lang === 'rw' ? 'Emeza' : 'Confirm')}
                  </button>
                  <button onClick={() => setModal(null)} className="btn-secondary flex-1">
                    {lang === 'rw' ? t('cancel', lang) : 'Cancel'}
                  </button>
                </div>
              </>
            )}

            {/* Borrow crates */}
            {modal.type === 'borrow' && (
              <>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">
                  {lang === 'rw' ? t('crates_borrow_modal_title', lang) : 'Borrow crates'}
                </h2>
                <p className="text-sm font-medium mb-4" style={{ color: getBrandColors(modal.crateType.supplier_name).bg }}>
                  {modal.crateType.supplier_name}
                </p>
                <div className="space-y-3 mb-5">
                  <div>
                    <label className="label">{lang === 'rw' ? t('crates_borrowed_from', lang) : 'Borrowed from'}</label>
                    <input type="text" className="input w-full"
                      placeholder={lang === 'rw' ? t('crates_supplier_neighbour', lang) : 'Supplier / Neighbour'}
                      value={formName} onChange={e => setFormName(e.target.value)} autoFocus />
                  </div>
                  <div>
                    <label className="label">{lang === 'rw' ? t('crates_num_crates', lang) : 'Number of crates'}</label>
                    <input type="number" min="1" className="input w-full text-xl text-center py-3"
                      placeholder="0" value={formValue} onChange={e => setFormValue(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">{lang === 'rw' ? t('crates_date', lang) : 'Date'}</label>
                    <input type="date" className="input w-full" value={formDate}
                      onChange={e => setFormDate(e.target.value)} max={today()} />
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={handleBorrow} disabled={saving} className="btn-primary flex-1">
                    {saving ? '...' : (lang === 'rw' ? t('save', lang) : 'Save')}
                  </button>
                  <button onClick={() => setModal(null)} className="btn-secondary flex-1">
                    {lang === 'rw' ? t('cancel', lang) : 'Cancel'}
                  </button>
                </div>
              </>
            )}

            {/* Return borrowed — partial or full */}
            {modal.type === 'return_borrow' && (
              <>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">
                  {modal.mode === 'full'
                    ? (lang === 'rw' ? 'Nasubije Kaziye zose' : 'Returned all borrowed crates')
                    : (lang === 'rw' ? 'Subiza igice' : 'Partial return of borrowed crates')}
                </h2>
                <div className="bg-gray-50 rounded-xl p-3 mb-4 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">{lang === 'rw' ? t('crates_borrowed_from', lang) : 'Borrowed from'}</span>
                    <span className="font-bold">{modal.borrowing.borrowed_from}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">{lang === 'rw' ? 'Watakiye' : 'Total borrowed'}</span>
                    <span className="font-bold">{modal.borrowing.crates_borrowed}</span>
                  </div>
                  {num(modal.borrowing.crates_returned) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">{lang === 'rw' ? 'Wasubije' : 'Already returned'}</span>
                      <span className="font-medium text-green-600">{modal.borrowing.crates_returned}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-1 mt-1">
                    <span className="text-gray-700 font-medium">{lang === 'rw' ? 'Asigaye' : 'Still owe'}</span>
                    <span className="font-bold text-orange-600">
                      {num(modal.borrowing.crates_borrowed) - num(modal.borrowing.crates_returned)}
                    </span>
                  </div>
                </div>
                {modal.mode === 'full' ? (
                  <p className="text-sm text-gray-500 mb-5">
                    {lang === 'rw'
                      ? 'Emeza ko wasubije Kaziye zose kuri uyu muntu.'
                      : 'Confirm you have returned all crates to this person.'}
                  </p>
                ) : (
                  <>
                    <label className="label">{lang === 'rw' ? 'Umubare usubiza ubu' : 'Returning now'}</label>
                    <input type="number" min="1"
                      max={num(modal.borrowing.crates_borrowed) - num(modal.borrowing.crates_returned)}
                      className="input w-full text-xl text-center py-3 mb-5"
                      placeholder="0" value={formValue} onChange={e => setFormValue(e.target.value)} autoFocus />
                  </>
                )}
                <div className="flex gap-3">
                  <button onClick={handleReturnBorrow} disabled={saving}
                    className="flex-1 bg-green-600 text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-green-700">
                    {saving ? '...' : (lang === 'rw' ? 'Emeza' : 'Confirm')}
                  </button>
                  <button onClick={() => setModal(null)} className="btn-secondary flex-1">
                    {lang === 'rw' ? t('cancel', lang) : 'Cancel'}
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      )}

      {/* ── DETAIL VIEW ── */}
      {selected && (() => {
        const colors = getBrandColors(selected.supplier_name)
        const owned = num(selected.total_owned)
        const lentOut = num(selected.total_lent_out)
        const borrowed = num(selected.total_borrowed)
        const atDepot = owned + borrowed - lentOut

        return (
          <div>
            <button onClick={() => setSelectedCrateType(null)}
              className="flex items-center gap-1 text-gray-400 text-sm mb-5 hover:text-gray-600 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              {lang === 'rw' ? t('crates_back', lang) : 'Back'}
            </button>

            {/* Brand header */}
            <div className="rounded-2xl shadow-lg p-5 mb-5" style={{ background: colors.bg }}>
              <p style={{ color: colors.subText }} className="text-[10px] font-semibold uppercase tracking-widest mb-3">
                {selected.supplier_name}
              </p>

              {/* Total owned row with + and - */}
              <div className="flex items-center justify-between mb-4 pb-4" style={{ borderBottom: `1px solid ${colors.badgeBg}` }}>
                <div>
                  <p style={{ color: colors.subText }} className="text-xs mb-0.5">
                    {lang === 'rw' ? t('crates_total_owned', lang) : 'Total owned'}
                  </p>
                  <p style={{ color: colors.text }} className="text-3xl font-black">{owned}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openModal({ type: 'adjust_owned', crateType: selected, mode: 'add' })}
                    style={{ background: colors.badgeBg, color: colors.text }}
                    className="w-10 h-10 rounded-xl text-xl font-bold hover:opacity-80 transition-opacity flex items-center justify-center">
                    +
                  </button>
                  <button onClick={() => openModal({ type: 'adjust_owned', crateType: selected, mode: 'remove' })}
                    style={{ background: colors.badgeBg, color: colors.text }}
                    className="w-10 h-10 rounded-xl text-xl font-bold hover:opacity-80 transition-opacity flex items-center justify-center">
                    −
                  </button>
                </div>
              </div>

              {/* 3 stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <p style={{ color: colors.subText }} className="text-[10px] mb-1">
                    {lang === 'rw' ? t('crates_at_depot', lang) : 'At depot'}
                  </p>
                  <p style={{ color: colors.text }} className="text-2xl font-black">{atDepot}</p>
                </div>
                <div className="text-center">
                  <p style={{ color: colors.subText }} className="text-[10px] mb-1">
                    {lang === 'rw' ? t('crates_with_clients', lang) : 'With clients'}
                  </p>
                  <p style={{ color: colors.text }} className="text-2xl font-black">{lentOut}</p>
                </div>
                <div className="text-center">
                  <p style={{ color: colors.subText }} className="text-[10px] mb-1">
                    {lang === 'rw' ? t('crates_you_borrowed', lang) : 'You borrowed'}
                  </p>
                  <p style={{ color: colors.text }} className="text-2xl font-black">{borrowed}</p>
                </div>
              </div>
            </div>

            {/* First time */}
            {owned === 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5 flex items-center justify-between gap-3">
                <p className="text-amber-800 text-sm font-medium">
                  {lang === 'rw' ? t('crates_first_time_msg', lang) : 'Start by entering how many crates you own'}
                </p>
                <button onClick={() => openModal({ type: 'adjust_owned', crateType: selected, mode: 'add' })}
                  className="bg-amber-600 text-white px-3 py-2 rounded-lg text-sm font-semibold shrink-0 hover:bg-amber-700">
                  {lang === 'rw' ? t('crates_enter', lang) : 'Enter'}
                </button>
              </div>
            )}

            {/* Action buttons — distinct colors so user can tell the difference */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <button onClick={() => openModal({ type: 'lend', crateType: selected })}
                style={{ background: colors.bg, color: colors.text }}
                className="px-4 py-3.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90">
                {lang === 'rw' ? t('crates_lend_btn', lang) : 'Lend to client'}
              </button>
              <button onClick={() => openModal({ type: 'borrow', crateType: selected })}
                style={{ background: colors.borrowBg, color: colors.borrowText }}
                className="px-4 py-3.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90">
                {lang === 'rw' ? t('crates_borrow_btn', lang) : 'Borrow crates'}
              </button>
            </div>

            {/* Active lendings */}
            {activeLendings.length > 0 && (
              <div className="mb-5">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  {lang === 'rw' ? t('crates_lendings_title', lang) : 'Crates with clients'} ({activeLendings.length})
                </p>
                <div className="space-y-2">
                  {activeLendings.map(lending => {
                    const remaining = num(lending.crates_lent) - num(lending.crates_returned)
                    return (
                      <div key={lending.id} className="bg-white border border-gray-200 rounded-xl p-4">
                        <div className="mb-3">
                          <p className="font-semibold text-gray-900 capitalize">{lending.client_name}</p>
                          {lending.phone && <p className="text-xs text-gray-400 mt-0.5">📞 {lending.phone}</p>}
                          <p className="text-xs text-gray-400 mt-0.5">{formatDateSafe(lending.lent_date)}</p>
                          <div className="flex gap-4 mt-1.5 text-sm flex-wrap">
                            <span className="text-gray-500">{lang === 'rw' ? t('crates_lent', lang) : 'Lent'}: <strong>{lending.crates_lent}</strong></span>
                            {num(lending.crates_returned) > 0 && (
                              <span className="text-green-600">{lang === 'rw' ? t('crates_returned', lang) : 'Returned'}: <strong>{lending.crates_returned}</strong></span>
                            )}
                          </div>
                          <p className="text-red-600 font-bold text-base mt-1">
                            {lang === 'rw' ? t('crates_still_owes', lang) : 'Still owes'}: {remaining}
                          </p>
                        </div>
                        {/* Two buttons — partial and full */}
                        <div className="grid grid-cols-2 gap-2">
                          <button onClick={() => openModal({ type: 'return_lend', lending, mode: 'partial' })}
                            className="bg-blue-50 text-blue-700 border border-blue-200 py-2 rounded-lg text-xs font-semibold hover:bg-blue-100">
                            {lang === 'rw' ? 'Atiruye igice' : 'Partial return'}
                          </button>
                          <button onClick={() => openModal({ type: 'return_lend', lending, mode: 'full' })}
                            className="bg-green-50 text-green-700 border border-green-200 py-2 rounded-lg text-xs font-semibold hover:bg-green-100">
                            {lang === 'rw' ? t('crates_fully_returned_title', lang) : 'Fully returned'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Active borrowings */}
            {activeBorrowings.length > 0 && (
              <div className="mb-5">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  {lang === 'rw' ? t('crates_borrowings_title', lang) : 'Crates you borrowed'} ({activeBorrowings.length})
                </p>
                <div className="space-y-2">
                  {activeBorrowings.map(borrowing => {
                    const remaining = num(borrowing.crates_borrowed) - num(borrowing.crates_returned)
                    return (
                      <div key={borrowing.id} className="rounded-xl p-4" style={{ background: '#7a7d7c', border: '1px solid #7a7d7c' }}>
                        <div className="mb-3">
                          <p className="font-semibold" style={{ color: '#FFFFFF' }}>{borrowing.borrowed_from}</p>
                          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.7)' }}>{formatDateSafe(borrowing.borrowed_date)}</p>
                          <div className="flex gap-4 mt-1.5 text-sm flex-wrap">
                            <span style={{ color: 'rgba(255,255,255,0.8)' }}>{lang === 'rw' ? 'Watakiye' : 'Borrowed'}: <strong>{borrowing.crates_borrowed}</strong></span>
                            {num(borrowing.crates_returned) > 0 && (
                              <span style={{ color: 'rgba(255,255,255,0.9)' }}>{lang === 'rw' ? 'Wasubije' : 'Returned'}: <strong>{borrowing.crates_returned}</strong></span>
                            )}
                          </div>
                          <p className="font-bold text-base mt-1" style={{ color: '#FFFFFF' }}>
                            {lang === 'rw' ? 'Asigaye' : 'Still owe'}: {remaining}
                          </p>
                        </div>
                        {/* Two buttons — partial and full */}
                        <div className="grid grid-cols-2 gap-2">
                          <button onClick={() => openModal({ type: 'return_borrow', borrowing, mode: 'partial' })}
                            className="bg-blue-50 text-blue-700 border border-blue-200 py-2 rounded-lg text-xs font-semibold hover:bg-blue-100">
                            {lang === 'rw' ? 'Subiza igice' : 'Partial return'}
                          </button>
                          <button onClick={() => openModal({ type: 'return_borrow', borrowing, mode: 'full' })}
                            className="bg-green-50 text-green-700 border border-green-200 py-2 rounded-lg text-xs font-semibold hover:bg-green-100">
                            {lang === 'rw' ? t('crates_returned_btn', lang) : 'Fully returned'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Return history — actual actions grouped by the date they were recorded */}
            {selectedReturnHistory.length > 0 && (
              <div className="mb-5 border border-gray-200 rounded-xl bg-white overflow-hidden">

                {/* Collapsed / expanded header */}
                <button
                  type="button"
                  onClick={() => {
                    setHistoryOpen(!historyOpen)
                    if (historyOpen) setHistoryLimit(10)
                  }}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                      {t('crates_return_history', lang)}
                    </p>

                    <p className="text-xs text-gray-400 mt-1">
                      {selectedReturnHistory.length} {t('crates_return_actions', lang)}
                    </p>
                  </div>

                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform ${
                      historyOpen ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                {/* History content */}
                {historyOpen && (
                  <div className="border-t border-gray-100 px-4 pb-4">

                    {(() => {
                      const visibleHistory = selectedReturnHistory.slice(0, historyLimit)

                      const grouped: Record<string, ReturnHistory[]> = {}

                      visibleHistory.forEach(item => {
                        const date = item.return_date.split('T')[0]

                        if (!grouped[date]) {
                          grouped[date] = []
                        }

                        grouped[date].push(item)
                      })

                      return (
                        <>
                          {Object.entries(grouped)
                            .sort(([a], [b]) => b.localeCompare(a))
                            .map(([date, items]) => (
                              <div key={date} className="pt-4">

                                {/* Action date */}
                                <p className="text-xs font-bold text-gray-500 mb-2">
                                  {formatDateSafe(date)}
                                </p>

                                <div className="space-y-2">
                                  {items.map(item => (
                                    <div
                                      key={item.id}
                                      className="bg-gray-50 rounded-lg px-3 py-2.5"
                                    >
                                      {item.return_type === 'client_return' ? (
                                        <>
                                          <p className="text-sm font-semibold text-gray-800 capitalize">
                                            {item.client_name}
                                          </p>

                                          <p className="text-xs text-gray-500 mt-0.5">
                                            {t('crates_returned_action', lang)} {item.quantity} {t('crates_unit', lang)}
                                          </p>
                                        </>
                                      ) : (
                                        <>
                                          <p className="text-sm font-semibold text-gray-800 capitalize">
                                            {item.borrowed_from}
                                          </p>

                                          <p className="text-xs text-gray-500 mt-0.5">
                                            {t('crates_you_returned_action', lang)} {item.quantity} {t('crates_unit', lang)}
                                          </p>
                                        </>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}

                          {/* Show more */}
                          {historyLimit < selectedReturnHistory.length && (
                            <button
                              type="button"
                              onClick={() => setHistoryLimit(prev => prev + 10)}
                              className="w-full mt-4 py-2.5 text-sm font-semibold text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                            >
                              {t('crates_show_more', lang)}
                            </button>
                          )}

                          {/* End of history */}
                          {historyLimit >= selectedReturnHistory.length &&
                            selectedReturnHistory.length > 10 && (
                              <p className="text-center text-xs text-gray-400 mt-4">
                                {t('crates_all_history_shown', lang)}
                              </p>
                            )}
                        </>
                      )
                    })()}

                  </div>
                )}
              </div>
            )}

            {activeLendings.length === 0 && activeBorrowings.length === 0 && owned > 0 && (
              <div className="text-center py-8 text-gray-400">
                <p className="text-sm font-medium">✅ {lang === 'rw' ? t('crates_all_accounted_detail', lang) : 'All crates accounted for'}</p>
              </div>
            )}
          </div>
        )
      })()}

      {/* ── MAIN LIST VIEW ── */}
      {!selected && (
        <div>
          <div className="mb-6">
            <h1 className="page-title mb-0">{lang === 'rw' ? t('crates_title', lang) : 'Crates'}</h1>
            <p className="text-gray-400 text-sm mt-1">{lang === 'rw' ? t('crates_sub', lang) : 'Track your crates'}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {crateTypes.map(ct => {
              const colors = getBrandColors(ct.supplier_name)
              const owned = num(ct.total_owned)
              const lentOut = num(ct.total_lent_out)
              const borrowed = num(ct.total_borrowed)
              const atDepot = owned + borrowed - lentOut
              const activeLendingsCount = lendings.filter(l => l.crate_type_id === ct.id && !l.is_fully_returned).length
              const activeBorrowingsCount = borrowings.filter(b => b.crate_type_id === ct.id && !b.is_returned).length

              return (
                <button key={ct.id}
                  onClick={() => setSelectedCrateType(ct)}
                  style={{ background: colors.bg }}
                  className="rounded-2xl shadow-lg p-5 text-left transition-all active:scale-95 hover:shadow-xl hover:brightness-110">

                  <p style={{ color: colors.subText }} className="text-[10px] font-semibold uppercase tracking-widest mb-2">
                    {ct.supplier_name}
                  </p>

                  {owned === 0 ? (
                    <div className="py-3">
                      <p style={{ color: colors.text }} className="text-lg font-bold mb-1">
                        {lang === 'rw' ? t('crates_not_set', lang) : 'Not set up'}
                      </p>
                      <p style={{ color: colors.subText }} className="text-xs">
                        {lang === 'rw' ? t('crates_tap_start', lang) : 'Tap to get started'}
                      </p>
                    </div>
                  ) : (
                    <>
                      <p style={{ color: colors.text }} className="text-5xl font-black leading-none mb-1">{atDepot}</p>
                      <p style={{ color: colors.subText }} className="text-[10px] mb-4">
                        {lang === 'rw' ? t('crates_at_depot_of', lang) : 'at depot ·'} {owned} {lang === 'rw' ? t('crates_owned_suffix', lang) : 'owned'}
                      </p>
                      <div className="space-y-1.5">
                        {activeLendingsCount > 0 && (
                          <div style={{ background: colors.badgeBg }} className="rounded-lg px-2.5 py-1.5">
                            <p style={{ color: colors.badgeText }} className="text-xs font-semibold">
                              {activeLendingsCount} {lang === 'rw' ? t('crates_clients_holding', lang) : 'clients holding crates'}
                            </p>
                          </div>
                        )}
                        {activeBorrowingsCount > 0 && (
                          <div style={{ background: colors.borrowBg + '33' }} className="rounded-lg px-2.5 py-1.5">
                            <p style={{ color: colors.borrowText, fontWeight: 600 }} className="text-xs">
                              {lang === 'rw' ? t('crates_you_borrowed_badge', lang) : 'You have borrowed crates'}
                            </p>
                          </div>
                        )}
                        {activeLendingsCount === 0 && activeBorrowingsCount === 0 && (
                          <div style={{ background: colors.badgeBg }} className="rounded-lg px-2.5 py-1.5">
                            <p style={{ color: colors.badgeText }} className="text-xs font-semibold">
                              {lang === 'rw' ? t('crates_all_accounted', lang) : 'All accounted for'}
                            </p>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

    </div>
  )
}