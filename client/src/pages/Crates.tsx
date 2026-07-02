import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { suppliersAPI } from '../lib/api'
import type { Supplier } from '../lib/types'
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
  is_returned: boolean
  borrowed_date: string
}

type ModalType =
  | { type: 'add_owned'; crateType: CrateType }
  | { type: 'lend'; crateType: CrateType }
  | { type: 'return_lend'; lending: Lending }
  | { type: 'borrow'; crateType: CrateType }
  | { type: 'return_borrow'; borrowing: Borrowing }
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
    bg: isBralirwa ? '#1B5E20' : '#F9A825',
    text: isBralirwa ? '#ffffff' : '#1a1a1a',
    subText: isBralirwa ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.5)',
    badgeBg: isBralirwa ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
    badgeText: isBralirwa ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.65)',
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
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<ModalType>(null)
  const [selectedCrateType, setSelectedCrateType] = useState<CrateType | null>(null)

  const [formValue, setFormValue] = useState('')
  const [formName, setFormName] = useState('')
  const [formDate, setFormDate] = useState(today())
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (business) loadAll() }, [business])

  async function loadAll() {
    setLoading(true)
    try {
      const [typesRes, lendingsRes, borrowingsRes, suppliersData] = await Promise.all([
        fetch(`${API_URL}/api/crates/types`, { headers }),
        fetch(`${API_URL}/api/crates/lendings`, { headers }),
        fetch(`${API_URL}/api/crates/borrowings`, { headers }),
        suppliersAPI.getAll(),
      ])
      const typesData = await typesRes.json()
      const lendingsData = await lendingsRes.json()
      const borrowingsData = await borrowingsRes.json()
      const suppList: Supplier[] = suppliersData.suppliers || []
      const existingTypes: CrateType[] = typesData.crate_types || []

      for (const supplier of suppList) {
        const exists = existingTypes.find(ct => ct.supplier_id === supplier.id)
        if (!exists) {
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
    setFormValue(''); setFormName(''); setFormDate(today())
  }

  function openModal(m: ModalType) { resetForm(); setModal(m) }

  const selected = selectedCrateType
    ? crateTypes.find(ct => ct.id === selectedCrateType.id) || selectedCrateType
    : null

  const selectedLendings = selected ? lendings.filter(l => l.crate_type_id === selected.id) : []
  const selectedBorrowings = selected ? borrowings.filter(b => b.crate_type_id === selected.id) : []
  const activeLendings = selectedLendings.filter(l => !l.is_fully_returned)
  const activeBorrowings = selectedBorrowings.filter(b => !b.is_returned)

  async function handleAddOwned() {
    if (!formValue || num(formValue) <= 0) { toast.error(lang === 'rw' ? 'Andika umubare' : 'Enter a number'); return }
    if (!modal || modal.type !== 'add_owned') return
    setSaving(true)
    try {
      const isFirstTime = modal.crateType.total_owned === 0
      const newTotal = isFirstTime ? num(formValue) : modal.crateType.total_owned + num(formValue)
      const res = await fetch(`${API_URL}/api/crates/types/${modal.crateType.id}`, {
        method: 'PUT', headers,
        body: JSON.stringify({ total_owned: newTotal }),
      })
      if (!res.ok) throw new Error()
      toast.success(lang === 'rw' ? 'Byabitswe!' : 'Saved!')
      setModal(null)
      loadAll()
    } catch { toast.error('Failed') }
    finally { setSaving(false) }
  }

  async function handleLend() {
    if (!formName.trim()) { toast.error(lang === 'rw' ? 'Andika izina' : 'Enter client name'); return }
    if (!formValue || num(formValue) <= 0) { toast.error(lang === 'rw' ? 'Andika umubare' : 'Enter number'); return }
    if (!modal || modal.type !== 'lend') return
    setSaving(true)
    try {
      await fetch(`${API_URL}/api/crates/lendings`, {
        method: 'POST', headers,
        body: JSON.stringify({ crate_type_id: modal.crateType.id, client_name: formName, crates_lent: num(formValue), lent_date: formDate }),
      })
      toast.success(lang === 'rw' ? 'Amaziye yatanzwe!' : 'Crates lent recorded!')
      setModal(null); loadAll()
    } catch { toast.error('Failed') }
    finally { setSaving(false) }
  }

  async function handleReturnLend() {
    if (!formValue || num(formValue) <= 0) { toast.error(lang === 'rw' ? 'Andika umubare' : 'Enter number'); return }
    if (!modal || modal.type !== 'return_lend') return
    setSaving(true)
    try {
      await fetch(`${API_URL}/api/crates/lendings/${modal.lending.id}/return`, {
        method: 'PUT', headers,
        body: JSON.stringify({ crates_returned: num(formValue) }),
      })
      toast.success(lang === 'rw' ? 'Byabitswe!' : 'Return recorded!')
      setModal(null); loadAll()
    } catch { toast.error('Failed') }
    finally { setSaving(false) }
  }

  async function handleBorrow() {
    if (!formName.trim()) { toast.error(lang === 'rw' ? 'Andika izina' : 'Enter name'); return }
    if (!formValue || num(formValue) <= 0) { toast.error(lang === 'rw' ? 'Andika umubare' : 'Enter number'); return }
    if (!modal || modal.type !== 'borrow') return
    setSaving(true)
    try {
      await fetch(`${API_URL}/api/crates/borrowings`, {
        method: 'POST', headers,
        body: JSON.stringify({ crate_type_id: modal.crateType.id, borrowed_from: formName, crates_borrowed: num(formValue), borrowed_date: formDate }),
      })
      toast.success(lang === 'rw' ? 'Amaziye yatakiwe!' : 'Borrowing recorded!')
      setModal(null); loadAll()
    } catch { toast.error('Failed') }
    finally { setSaving(false) }
  }

  async function handleReturnBorrow() {
    if (!modal || modal.type !== 'return_borrow') return
    setSaving(true)
    try {
      await fetch(`${API_URL}/api/crates/borrowings/${modal.borrowing.id}/return`, {
        method: 'PUT', headers, body: JSON.stringify({}),
      })
      toast.success(lang === 'rw' ? 'Byasubijwe!' : 'Returned!')
      setModal(null); loadAll()
    } catch { toast.error('Failed') }
    finally { setSaving(false) }
  }

  async function deleteLending(id: string) {
    await fetch(`${API_URL}/api/crates/lendings/${id}`, { method: 'DELETE', headers })
    toast.success(lang === 'rw' ? 'Yasibwe' : 'Deleted'); loadAll()
  }

  async function deleteBorrowing(id: string) {
    await fetch(`${API_URL}/api/crates/borrowings/${id}`, { method: 'DELETE', headers })
    toast.success(lang === 'rw' ? 'Yasibwe' : 'Deleted'); loadAll()
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

            {modal.type === 'add_owned' && (
              <>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">
                  {modal.crateType.total_owned === 0
                    ? (lang === 'rw' ? 'Injiza amaziye yawe yose' : 'Set your total owned crates')
                    : (lang === 'rw' ? 'Ongeraho amaziye washyuje' : 'Add newly bought crates')}
                </h2>
                <p className="text-sm font-medium mb-1" style={{ color: getBrandColors(modal.crateType.supplier_name).bg }}>
                  {modal.crateType.supplier_name}
                </p>
                {modal.crateType.total_owned > 0 && (
                  <p className="text-xs text-gray-400 mb-4">
                    {lang === 'rw' ? 'Ufite ubu:' : 'Currently owned:'} <strong>{modal.crateType.total_owned}</strong>
                    {' → '}{lang === 'rw' ? 'Bizaba:' : 'New total:'} <strong>{modal.crateType.total_owned + (num(formValue) || 0)}</strong>
                  </p>
                )}
                <label className="label">
                  {modal.crateType.total_owned === 0
                    ? (lang === 'rw' ? 'Amaziye ufite yose' : 'Total crates you own')
                    : (lang === 'rw' ? 'Amaziye washyuje' : 'Crates just bought')}
                </label>
                <input type="number" min="1" className="input w-full text-2xl text-center py-4 mb-5"
                  placeholder="0" value={formValue} onChange={e => setFormValue(e.target.value)} autoFocus />
                <div className="flex gap-3">
                  <button onClick={handleAddOwned} disabled={saving} className="btn-primary flex-1">
                    {saving ? '...' : (lang === 'rw' ? 'Bika' : 'Save')}
                  </button>
                  <button onClick={() => setModal(null)} className="btn-secondary flex-1">
                    {lang === 'rw' ? 'Oya' : 'Cancel'}
                  </button>
                </div>
              </>
            )}

            {modal.type === 'lend' && (
              <>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">
                  {lang === 'rw' ? 'Tanga amaziye ku mukiriya' : 'Lend crates to client'}
                </h2>
                <p className="text-sm font-medium mb-4" style={{ color: getBrandColors(modal.crateType.supplier_name).bg }}>
                  {modal.crateType.supplier_name}
                </p>
                <div className="space-y-3 mb-5">
                  <div>
                    <label className="label">{lang === 'rw' ? "Izina ry'umukiriya" : 'Client name'}</label>
                    <input type="text" className="input w-full" placeholder={lang === 'rw' ? 'Andika izina' : 'Enter name'}
                      value={formName} onChange={e => setFormName(e.target.value)} autoFocus />
                  </div>
                  <div>
                    <label className="label">{lang === 'rw' ? "Umubare w'amaziye" : 'Number of crates'}</label>
                    <input type="number" min="1" className="input w-full text-xl text-center py-3"
                      placeholder="0" value={formValue} onChange={e => setFormValue(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">{lang === 'rw' ? 'Itariki' : 'Date'}</label>
                    <input type="date" className="input w-full" value={formDate} onChange={e => setFormDate(e.target.value)} max={today()} />
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={handleLend} disabled={saving} className="btn-primary flex-1">
                    {saving ? '...' : (lang === 'rw' ? 'Bika' : 'Save')}
                  </button>
                  <button onClick={() => setModal(null)} className="btn-secondary flex-1">{lang === 'rw' ? 'Oya' : 'Cancel'}</button>
                </div>
              </>
            )}

            {modal.type === 'return_lend' && (
              <>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">
                  {lang === 'rw' ? 'Amaziye yagaruwe' : 'Client returned crates'}
                </h2>
                <p className="text-sm text-blue-600 font-medium mb-3 capitalize">{modal.lending.client_name}</p>
                <div className="bg-gray-50 rounded-xl p-3 mb-4 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">{lang === 'rw' ? 'Yafashe' : 'Borrowed'}</span>
                    <span className="font-bold">{modal.lending.crates_lent}</span>
                  </div>
                  {num(modal.lending.crates_returned) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">{lang === 'rw' ? 'Yarasubije' : 'Already returned'}</span>
                      <span className="font-medium text-green-600">{modal.lending.crates_returned}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-1 mt-1">
                    <span className="text-gray-700 font-medium">{lang === 'rw' ? 'Asigaye' : 'Still owes'}</span>
                    <span className="font-bold text-red-600">{num(modal.lending.crates_lent) - num(modal.lending.crates_returned)}</span>
                  </div>
                </div>
                <label className="label">{lang === 'rw' ? 'Agaruye ubu' : 'Returning now'}</label>
                <input type="number" min="1" max={num(modal.lending.crates_lent) - num(modal.lending.crates_returned)}
                  className="input w-full text-xl text-center py-3 mb-5"
                  placeholder="0" value={formValue} onChange={e => setFormValue(e.target.value)} autoFocus />
                <div className="flex gap-3">
                  <button onClick={handleReturnLend} disabled={saving} className="btn-primary flex-1">
                    {saving ? '...' : (lang === 'rw' ? 'Bika' : 'Save')}
                  </button>
                  <button onClick={() => setModal(null)} className="btn-secondary flex-1">{lang === 'rw' ? 'Oya' : 'Cancel'}</button>
                </div>
              </>
            )}

            {modal.type === 'borrow' && (
              <>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">
                  {lang === 'rw' ? 'Taka amaziye' : 'Borrow crates'}
                </h2>
                <p className="text-sm font-medium mb-4" style={{ color: getBrandColors(modal.crateType.supplier_name).bg }}>
                  {modal.crateType.supplier_name}
                </p>
                <div className="space-y-3 mb-5">
                  <div>
                    <label className="label">{lang === 'rw' ? 'Watakiye nde' : 'Borrowed from'}</label>
                    <input type="text" className="input w-full"
                      placeholder={lang === 'rw' ? 'Uruganda / Umuturanyi' : 'Supplier / Neighbour'}
                      value={formName} onChange={e => setFormName(e.target.value)} autoFocus />
                  </div>
                  <div>
                    <label className="label">{lang === 'rw' ? "Umubare w'amaziye" : 'Number of crates'}</label>
                    <input type="number" min="1" className="input w-full text-xl text-center py-3"
                      placeholder="0" value={formValue} onChange={e => setFormValue(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">{lang === 'rw' ? 'Itariki' : 'Date'}</label>
                    <input type="date" className="input w-full" value={formDate} onChange={e => setFormDate(e.target.value)} max={today()} />
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={handleBorrow} disabled={saving} className="btn-primary flex-1">
                    {saving ? '...' : (lang === 'rw' ? 'Bika' : 'Save')}
                  </button>
                  <button onClick={() => setModal(null)} className="btn-secondary flex-1">{lang === 'rw' ? 'Oya' : 'Cancel'}</button>
                </div>
              </>
            )}

            {modal.type === 'return_borrow' && (
              <>
                <h2 className="text-lg font-semibold text-gray-900 mb-3">
                  {lang === 'rw' ? 'Subiza amaziye' : 'Return borrowed crates'}
                </h2>
                <div className="bg-gray-50 rounded-xl p-3 mb-4 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">{lang === 'rw' ? 'Watakiye kuri' : 'Borrowed from'}</span>
                    <span className="font-bold">{modal.borrowing.borrowed_from}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">{lang === 'rw' ? 'Umubare' : 'Crates'}</span>
                    <span className="font-bold text-orange-600">{modal.borrowing.crates_borrowed}</span>
                  </div>
                </div>
                <p className="text-sm text-gray-500 mb-5">
                  {lang === 'rw' ? 'Emeza ko wasubije amaziye yose kuri uyu muntu.' : 'Confirm you returned all crates to this person.'}
                </p>
                <div className="flex gap-3">
                  <button onClick={handleReturnBorrow} disabled={saving}
                    className="flex-1 bg-green-600 text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-green-700">
                    {saving ? '...' : (lang === 'rw' ? 'Yego, narasubije' : 'Yes, returned all')}
                  </button>
                  <button onClick={() => setModal(null)} className="btn-secondary flex-1">{lang === 'rw' ? 'Oya' : 'Cancel'}</button>
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
              {lang === 'rw' ? 'Subira inyuma' : 'Back'}
            </button>

            {/* Brand header card */}
            <div className="rounded-2xl shadow-lg p-5 mb-5" style={{ background: colors.bg }}>
              <p style={{ color: colors.subText }} className="text-xs font-semibold uppercase tracking-widest mb-3">
                {selected.supplier_name}
              </p>

              {/* Total owned row */}
              <div className="flex items-center justify-between mb-4 pb-4" style={{ borderBottom: `1px solid ${colors.badgeBg}` }}>
                <div>
                  <p style={{ color: colors.subText }} className="text-xs mb-0.5">
                    {lang === 'rw' ? 'Amaziye ufite yose' : 'Total owned'}
                  </p>
                  <p style={{ color: colors.text }} className="text-3xl font-black">{owned}</p>
                </div>
                <button onClick={() => openModal({ type: 'add_owned', crateType: selected })}
                  style={{ background: colors.badgeBg, color: colors.text }}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold hover:opacity-80 transition-opacity">
                  <span className="text-lg leading-none">+</span>
                  {lang === 'rw' ? 'Ongeraho' : 'Add more'}
                </button>
              </div>

              {/* 3 stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <p style={{ color: colors.subText }} className="text-[10px] mb-1">
                    {lang === 'rw' ? 'Ari hano' : 'At depot'}
                  </p>
                  <p style={{ color: colors.text }} className={`text-2xl font-black ${atDepot < 0 ? 'opacity-60' : ''}`}>{atDepot}</p>
                </div>
                <div className="text-center">
                  <p style={{ color: colors.subText }} className="text-[10px] mb-1">
                    {lang === 'rw' ? 'Ku bakiriya' : 'With clients'}
                  </p>
                  <p style={{ color: colors.text }} className="text-2xl font-black">{lentOut}</p>
                </div>
                <div className="text-center">
                  <p style={{ color: colors.subText }} className="text-[10px] mb-1">
                    {lang === 'rw' ? 'Watakiye' : 'You borrowed'}
                  </p>
                  <p style={{ color: colors.text }} className="text-2xl font-black">{borrowed}</p>
                </div>
              </div>
            </div>

            {/* First time prompt */}
            {owned === 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5 flex items-center justify-between gap-3">
                <p className="text-amber-800 text-sm font-medium">
                  {lang === 'rw' ? 'Banza injiza amaziye yawe yose ufite' : 'Start by entering how many crates you own'}
                </p>
                <button onClick={() => openModal({ type: 'add_owned', crateType: selected })}
                  className="bg-amber-600 text-white px-3 py-2 rounded-lg text-sm font-semibold shrink-0 hover:bg-amber-700">
                  {lang === 'rw' ? 'Injiza' : 'Enter'}
                </button>
              </div>
            )}

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <button onClick={() => openModal({ type: 'lend', crateType: selected })}
                className="bg-white border-2 border-red-200 text-red-700 hover:bg-red-50 px-4 py-3.5 rounded-xl text-sm font-semibold transition-all">
                🤝 {lang === 'rw' ? 'Tanga ku mukiriya' : 'Lend to client'}
              </button>
              <button onClick={() => openModal({ type: 'borrow', crateType: selected })}
                className="bg-white border-2 border-orange-200 text-orange-700 hover:bg-orange-50 px-4 py-3.5 rounded-xl text-sm font-semibold transition-all">
                🔄 {lang === 'rw' ? 'Taka amaziye' : 'Borrow crates'}
              </button>
            </div>

            {/* Active lendings */}
            {activeLendings.length > 0 && (
              <div className="mb-5">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  {lang === 'rw' ? 'Amaziye ku bakiriya' : 'Crates with clients'} ({activeLendings.length})
                </p>
                <div className="space-y-2">
                  {activeLendings.map(lending => {
                    const remaining = num(lending.crates_lent) - num(lending.crates_returned)
                    return (
                      <div key={lending.id} className="bg-white border border-gray-200 rounded-xl p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <p className="font-semibold text-gray-900 capitalize">{lending.client_name}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{formatDateSafe(lending.lent_date)}</p>
                            <div className="flex gap-4 mt-1.5 text-sm flex-wrap">
                              <span className="text-gray-500">{lang === 'rw' ? 'Yafashe' : 'Lent'}: <strong>{lending.crates_lent}</strong></span>
                              {num(lending.crates_returned) > 0 && (
                                <span className="text-green-600">{lang === 'rw' ? 'Yasubije' : 'Returned'}: <strong>{lending.crates_returned}</strong></span>
                              )}
                            </div>
                            <p className="text-red-600 font-bold text-base mt-1">
                              {lang === 'rw' ? 'Asigaye' : 'Still owes'}: {remaining}
                            </p>
                          </div>
                          <div className="flex flex-col gap-1.5 shrink-0">
                            <button onClick={() => openModal({ type: 'return_lend', lending })}
                              className="bg-green-600 text-white px-3 py-2 rounded-lg text-xs font-semibold hover:bg-green-700">
                              ↩ {lang === 'rw' ? 'Yagaruye' : 'Return'}
                            </button>
                            <button onClick={() => deleteLending(lending.id)}
                              className="text-gray-400 hover:text-red-500 text-xs text-center py-1">
                              {lang === 'rw' ? 'Siba' : 'Delete'}
                            </button>
                          </div>
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
                  {lang === 'rw' ? 'Amaziye watakiye' : 'Crates you borrowed'} ({activeBorrowings.length})
                </p>
                <div className="space-y-2">
                  {activeBorrowings.map(borrowing => (
                    <div key={borrowing.id} className="bg-white border border-gray-200 rounded-xl p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900">{borrowing.borrowed_from}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{formatDateSafe(borrowing.borrowed_date)}</p>
                          <p className="text-orange-600 font-bold text-base mt-1">
                            {borrowing.crates_borrowed} {lang === 'rw' ? 'amaziye' : 'crates'}
                          </p>
                        </div>
                        <div className="flex flex-col gap-1.5 shrink-0">
                          <button onClick={() => openModal({ type: 'return_borrow', borrowing })}
                            className="bg-green-600 text-white px-3 py-2 rounded-lg text-xs font-semibold hover:bg-green-700">
                            ✓ {lang === 'rw' ? 'Narasubije' : 'Returned'}
                          </button>
                          <button onClick={() => deleteBorrowing(borrowing.id)}
                            className="text-gray-400 hover:text-red-500 text-xs text-center py-1">
                            {lang === 'rw' ? 'Siba' : 'Delete'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Fully returned history */}
            {selectedLendings.filter(l => l.is_fully_returned).length > 0 && (
              <div className="mb-5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  {lang === 'rw' ? 'Yarasubije yose' : 'Fully returned'}
                </p>
                <div className="space-y-1">
                  {selectedLendings.filter(l => l.is_fully_returned).map(lending => (
                    <div key={lending.id} className="bg-gray-50 border border-gray-100 rounded-xl p-3 flex items-center justify-between opacity-60">
                      <div>
                        <p className="text-sm font-medium text-gray-700 capitalize">{lending.client_name}</p>
                        <p className="text-xs text-gray-400">{lending.crates_lent} {lang === 'rw' ? 'amaziye — yose yarasubije' : 'crates — all returned'}</p>
                      </div>
                      <button onClick={() => deleteLending(lending.id)} className="text-gray-400 hover:text-red-500 text-xs">
                        {lang === 'rw' ? 'Siba' : 'Delete'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeLendings.length === 0 && activeBorrowings.length === 0 && owned > 0 && (
              <div className="text-center py-8 text-gray-400">
                <p className="text-sm font-medium">
                  ✅ {lang === 'rw' ? 'Amaziye yose ari hano — nta kibazo' : 'All crates accounted for'}
                </p>
              </div>
            )}
          </div>
        )
      })()}

      {/* ── MAIN LIST VIEW ── */}
      {!selected && (
        <div>
          <div className="mb-6">
            <h1 className="page-title mb-0">{lang === 'rw' ? 'Amaziye' : 'Crates'}</h1>
            <p className="text-gray-400 text-sm mt-1">
              {lang === 'rw' ? 'Kurikirana amaziye yawe' : 'Track your crates'}
            </p>
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
                        {lang === 'rw' ? 'Ntago washyizeho' : 'Not set up'}
                      </p>
                      <p style={{ color: colors.subText }} className="text-xs">
                        {lang === 'rw' ? 'Kanda utangire' : 'Tap to get started'}
                      </p>
                    </div>
                  ) : (
                    <>
                      <p style={{ color: colors.text }} className="text-5xl font-black leading-none mb-1">
                        {atDepot}
                      </p>
                      <p style={{ color: colors.subText }} className="text-[10px] mb-4">
                        {lang === 'rw' ? `ari hano · ${owned} ufite` : `at depot · ${owned} owned`}
                      </p>

                      <div className="space-y-1.5">
                        {activeLendingsCount > 0 && (
                          <div style={{ background: colors.badgeBg }} className="rounded-lg px-2.5 py-1.5">
                            <p style={{ color: colors.badgeText }} className="text-xs font-semibold">
                              {activeLendingsCount} {lang === 'rw' ? 'bakiriya bafite amaziye' : 'clients holding crates'}
                            </p>
                          </div>
                        )}
                        {activeBorrowingsCount > 0 && (
                          <div style={{ background: colors.badgeBg }} className="rounded-lg px-2.5 py-1.5">
                            <p style={{ color: colors.badgeText }} className="text-xs font-semibold">
                              {lang === 'rw' ? 'Ufite watakiye' : 'You have borrowed crates'}
                            </p>
                          </div>
                        )}
                        {activeLendingsCount === 0 && activeBorrowingsCount === 0 && (
                          <div style={{ background: colors.badgeBg }} className="rounded-lg px-2.5 py-1.5">
                            <p style={{ color: colors.badgeText }} className="text-xs font-semibold">
                              {lang === 'rw' ? 'Byose bihari' : 'All accounted for'}
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