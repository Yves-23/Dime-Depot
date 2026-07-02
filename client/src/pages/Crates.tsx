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
    day: 'numeric', month: 'short',
  })
}

export default function Crates() {
  const { business } = useAuth()
  const lang: Language = (business as any)?.language || 'en'
  const token = localStorage.getItem('dime-depot-token')
  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }

  const [crateTypes, setCrateTypes] = useState<CrateType[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [lendings, setLendings] = useState<Lending[]>([])
  const [borrowings, setBorrowings] = useState<Borrowing[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<ModalType>(null)
  const [selectedSupplier, setSelectedSupplier] = useState<CrateType | null>(null)

  // Form state
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

      setSuppliers(suppList)
      setLendings(lendingsData.lendings || [])
      setBorrowings(borrowingsData.borrowings || [])

      // Auto-create crate types for suppliers that don't have one yet
      const existingTypes: CrateType[] = typesData.crate_types || []
      const newTypes = [...existingTypes]

      for (const supplier of suppList) {
        const exists = existingTypes.find(ct => ct.supplier_id === supplier.id)
        if (!exists) {
          // Auto-create with 0 owned
          const res = await fetch(`${API_URL}/api/crates/types`, {
            method: 'POST', headers,
            body: JSON.stringify({ supplier_id: supplier.id, total_owned: 0 }),
          })
          if (res.ok) {
            const data = await res.json()
            newTypes.push({ ...data.crate_type, supplier_name: supplier.name, total_lent_out: 0, total_borrowed: 0 })
          }
        }
      }

      // Reload to get fresh data with counts
      const freshRes = await fetch(`${API_URL}/api/crates/types`, { headers })
      const freshData = await freshRes.json()
      setCrateTypes(freshData.crate_types || [])

    } catch {
      toast.error('Failed to load crate data')
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setFormValue('')
    setFormName('')
    setFormDate(today())
  }

  function openModal(m: ModalType) {
    resetForm()
    setModal(m)
  }

  // Get crate type for selected supplier
  const selected = selectedSupplier
    ? crateTypes.find(ct => ct.id === selectedSupplier.id) || selectedSupplier
    : null

  const selectedLendings = selected
    ? lendings.filter(l => l.crate_type_id === selected.id)
    : []
  const selectedBorrowings = selected
    ? borrowings.filter(b => b.crate_type_id === selected.id)
    : []

  const activeLendings = selectedLendings.filter(l => !l.is_fully_returned)
  const activeBorrowings = selectedBorrowings.filter(b => !b.is_returned)

  async function handleAddOwned() {
    if (!formValue || parseInt(formValue) <= 0) { toast.error(lang === 'rw' ? 'Andika umubare' : 'Enter a number'); return }
    if (!modal || modal.type !== 'add_owned') return
    setSaving(true)
    try {
      const newTotal = modal.crateType.total_owned + parseInt(formValue)
      await fetch(`${API_URL}/api/crates/types/${modal.crateType.id}`, {
        method: 'PUT', headers,
        body: JSON.stringify({ total_owned: newTotal }),
      })
      toast.success(lang === 'rw' ? 'Byavuguruwe!' : 'Updated!')
      setModal(null)
      await loadAll()
      // Update selected
      if (selectedSupplier?.id === modal.crateType.id) {
        setSelectedSupplier(prev => prev ? { ...prev, total_owned: newTotal } : prev)
      }
    } catch { toast.error('Failed') }
    finally { setSaving(false) }
  }

  async function handleSetOwned(crateType: CrateType, value: number) {
    setSaving(true)
    try {
      await fetch(`${API_URL}/api/crates/types/${crateType.id}`, {
        method: 'PUT', headers,
        body: JSON.stringify({ total_owned: value }),
      })
      toast.success(lang === 'rw' ? 'Byabitswe!' : 'Saved!')
      setModal(null)
      await loadAll()
    } catch { toast.error('Failed') }
    finally { setSaving(false) }
  }

  async function handleLend() {
    if (!formName.trim()) { toast.error(lang === 'rw' ? 'Andika izina' : 'Enter client name'); return }
    if (!formValue || parseInt(formValue) <= 0) { toast.error(lang === 'rw' ? 'Andika umubare' : 'Enter number of crates'); return }
    if (!modal || modal.type !== 'lend') return
    setSaving(true)
    try {
      await fetch(`${API_URL}/api/crates/lendings`, {
        method: 'POST', headers,
        body: JSON.stringify({
          crate_type_id: modal.crateType.id,
          client_name: formName,
          crates_lent: parseInt(formValue),
          lent_date: formDate,
        }),
      })
      toast.success(lang === 'rw' ? 'Amaziye yatanzwe!' : 'Crates lent!')
      setModal(null)
      loadAll()
    } catch { toast.error('Failed') }
    finally { setSaving(false) }
  }

  async function handleReturnLend() {
    if (!formValue || parseInt(formValue) <= 0) { toast.error(lang === 'rw' ? 'Andika umubare' : 'Enter number'); return }
    if (!modal || modal.type !== 'return_lend') return
    setSaving(true)
    try {
      await fetch(`${API_URL}/api/crates/lendings/${modal.lending.id}/return`, {
        method: 'PUT', headers,
        body: JSON.stringify({ crates_returned: parseInt(formValue) }),
      })
      toast.success(lang === 'rw' ? 'Byabitswe!' : 'Return recorded!')
      setModal(null)
      loadAll()
    } catch { toast.error('Failed') }
    finally { setSaving(false) }
  }

  async function handleBorrow() {
    if (!formName.trim()) { toast.error(lang === 'rw' ? 'Andika izina' : 'Enter name'); return }
    if (!formValue || parseInt(formValue) <= 0) { toast.error(lang === 'rw' ? 'Andika umubare' : 'Enter number of crates'); return }
    if (!modal || modal.type !== 'borrow') return
    setSaving(true)
    try {
      await fetch(`${API_URL}/api/crates/borrowings`, {
        method: 'POST', headers,
        body: JSON.stringify({
          crate_type_id: modal.crateType.id,
          borrowed_from: formName,
          crates_borrowed: parseInt(formValue),
          borrowed_date: formDate,
        }),
      })
      toast.success(lang === 'rw' ? 'Byabitswe!' : 'Borrowing recorded!')
      setModal(null)
      loadAll()
    } catch { toast.error('Failed') }
    finally { setSaving(false) }
  }

  async function handleReturnBorrow() {
    if (!modal || modal.type !== 'return_borrow') return
    setSaving(true)
    try {
      await fetch(`${API_URL}/api/crates/borrowings/${modal.borrowing.id}/return`, {
        method: 'PUT', headers,
        body: JSON.stringify({}),
      })
      toast.success(lang === 'rw' ? 'Byasubijwe!' : 'Returned!')
      setModal(null)
      loadAll()
    } catch { toast.error('Failed') }
    finally { setSaving(false) }
  }

  async function deleteLending(id: string) {
    await fetch(`${API_URL}/api/crates/lendings/${id}`, { method: 'DELETE', headers })
    toast.success(lang === 'rw' ? 'Yasibwe' : 'Deleted')
    loadAll()
  }

  async function deleteBorrowing(id: string) {
    await fetch(`${API_URL}/api/crates/borrowings/${id}`, { method: 'DELETE', headers })
    toast.success(lang === 'rw' ? 'Yasibwe' : 'Deleted')
    loadAll()
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-gray-500">Loading...</div>
    </div>
  )

  return (
    <div>
      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">

            {/* Add / update total owned */}
            {modal.type === 'add_owned' && (
              <>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">
                  {modal.crateType.total_owned === 0
                    ? (lang === 'rw' ? 'Shyiraho amaziye yawe' : 'Set your crates')
                    : (lang === 'rw' ? 'Ongeraho amaziye washyuje' : 'Add newly bought crates')}
                </h2>
                <p className="text-sm text-blue-600 font-medium mb-1">{modal.crateType.supplier_name}</p>
                {modal.crateType.total_owned > 0 && (
                  <p className="text-xs text-gray-400 mb-4">
                    {lang === 'rw' ? 'Ufite ubu' : 'Currently owned'}: <strong>{modal.crateType.total_owned}</strong>
                  </p>
                )}
                <div className="mb-5">
                  <label className="label">
                    {modal.crateType.total_owned === 0
                      ? (lang === 'rw' ? 'Amaziye ufite yose' : 'Total crates you own')
                      : (lang === 'rw' ? 'Amaziye ongeye' : 'Crates added')}
                  </label>
                  <input type="number" min="1" className="input w-full text-2xl text-center py-4"
                    placeholder="0" value={formValue}
                    onChange={e => setFormValue(e.target.value)} autoFocus />
                </div>
                <div className="flex gap-3">
                  <button onClick={modal.crateType.total_owned === 0
                    ? () => handleSetOwned(modal.crateType, parseInt(formValue) || 0)
                    : handleAddOwned}
                    disabled={saving}
                    className="btn-primary flex-1">
                    {saving ? '...' : (lang === 'rw' ? 'Bika' : 'Save')}
                  </button>
                  <button onClick={() => setModal(null)} className="btn-secondary flex-1">
                    {lang === 'rw' ? 'Oya' : 'Cancel'}
                  </button>
                </div>
              </>
            )}

            {/* Lend to client */}
            {modal.type === 'lend' && (
              <>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">
                  {lang === 'rw' ? 'Tanga amaziye ku mukiriya' : 'Lend crates to client'}
                </h2>
                <p className="text-sm text-blue-600 font-medium mb-4">{modal.crateType.supplier_name}</p>
                <div className="space-y-3 mb-5">
                  <div>
                    <label className="label">{lang === 'rw' ? 'Izina ry\'umukiriya' : 'Client name'}</label>
                    <input type="text" className="input w-full"
                      placeholder={lang === 'rw' ? 'Andika izina' : 'Enter name'}
                      value={formName} onChange={e => setFormName(e.target.value)} autoFocus />
                  </div>
                  <div>
                    <label className="label">{lang === 'rw' ? 'Umubare w\'amaziye' : 'Number of crates'}</label>
                    <input type="number" min="1" className="input w-full text-xl text-center py-3"
                      placeholder="0" value={formValue} onChange={e => setFormValue(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">{lang === 'rw' ? 'Itariki' : 'Date'}</label>
                    <input type="date" className="input w-full" value={formDate}
                      onChange={e => setFormDate(e.target.value)} max={today()} />
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={handleLend} disabled={saving} className="btn-primary flex-1">
                    {saving ? '...' : (lang === 'rw' ? 'Bika' : 'Save')}
                  </button>
                  <button onClick={() => setModal(null)} className="btn-secondary flex-1">
                    {lang === 'rw' ? 'Oya' : 'Cancel'}
                  </button>
                </div>
              </>
            )}

            {/* Return from client */}
            {modal.type === 'return_lend' && (
              <>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">
                  {lang === 'rw' ? 'Amaziye yagaruwe' : 'Crates returned'}
                </h2>
                <p className="text-sm text-blue-600 font-medium mb-3 capitalize">{modal.lending.client_name}</p>
                <div className="bg-gray-50 rounded-xl p-3 mb-4 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-500">{lang === 'rw' ? 'Yafashe' : 'Lent'}</span>
                    <span className="font-bold">{modal.lending.crates_lent}</span>
                  </div>
                  {modal.lending.crates_returned > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">{lang === 'rw' ? 'Yarasubije' : 'Already returned'}</span>
                      <span className="font-medium text-green-600">{modal.lending.crates_returned}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-1">
                    <span className="text-gray-700 font-medium">{lang === 'rw' ? 'Asigaye' : 'Still owes'}</span>
                    <span className="font-bold text-red-600">{modal.lending.crates_lent - modal.lending.crates_returned}</span>
                  </div>
                </div>
                <div className="mb-5">
                  <label className="label">{lang === 'rw' ? 'Agaruye ubu' : 'Returning now'}</label>
                  <input type="number" min="1"
                    max={modal.lending.crates_lent - modal.lending.crates_returned}
                    className="input w-full text-xl text-center py-3"
                    placeholder="0" value={formValue}
                    onChange={e => setFormValue(e.target.value)} autoFocus />
                </div>
                <div className="flex gap-3">
                  <button onClick={handleReturnLend} disabled={saving} className="btn-primary flex-1">
                    {saving ? '...' : (lang === 'rw' ? 'Bika' : 'Save')}
                  </button>
                  <button onClick={() => setModal(null)} className="btn-secondary flex-1">
                    {lang === 'rw' ? 'Oya' : 'Cancel'}
                  </button>
                </div>
              </>
            )}

            {/* Borrow crates */}
            {modal.type === 'borrow' && (
              <>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">
                  {lang === 'rw' ? 'Taka amaziye' : 'Borrow crates'}
                </h2>
                <p className="text-sm text-blue-600 font-medium mb-4">{modal.crateType.supplier_name}</p>
                <div className="space-y-3 mb-5">
                  <div>
                    <label className="label">{lang === 'rw' ? 'Watakiye nde' : 'Borrowed from'}</label>
                    <input type="text" className="input w-full"
                      placeholder={lang === 'rw' ? 'Uruganda / Umuturanyi' : 'Supplier / Neighbour'}
                      value={formName} onChange={e => setFormName(e.target.value)} autoFocus />
                  </div>
                  <div>
                    <label className="label">{lang === 'rw' ? 'Umubare w\'amaziye' : 'Number of crates'}</label>
                    <input type="number" min="1" className="input w-full text-xl text-center py-3"
                      placeholder="0" value={formValue} onChange={e => setFormValue(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">{lang === 'rw' ? 'Itariki' : 'Date'}</label>
                    <input type="date" className="input w-full" value={formDate}
                      onChange={e => setFormDate(e.target.value)} max={today()} />
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={handleBorrow} disabled={saving} className="btn-primary flex-1">
                    {saving ? '...' : (lang === 'rw' ? 'Bika' : 'Save')}
                  </button>
                  <button onClick={() => setModal(null)} className="btn-secondary flex-1">
                    {lang === 'rw' ? 'Oya' : 'Cancel'}
                  </button>
                </div>
              </>
            )}

            {/* Return borrowed */}
            {modal.type === 'return_borrow' && (
              <>
                <h2 className="text-lg font-semibold text-gray-900 mb-3">
                  {lang === 'rw' ? 'Subiza amaziye' : 'Return borrowed crates'}
                </h2>
                <div className="bg-gray-50 rounded-xl p-3 mb-5 text-sm space-y-1">
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
                  {lang === 'rw'
                    ? 'Emeza ko wasubije amaziye yose.'
                    : 'Confirm you returned all crates to this person.'}
                </p>
                <div className="flex gap-3">
                  <button onClick={handleReturnBorrow} disabled={saving}
                    className="flex-1 bg-green-600 text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-green-700">
                    {saving ? '...' : (lang === 'rw' ? 'Yego, narasubije' : 'Yes, returned')}
                  </button>
                  <button onClick={() => setModal(null)} className="btn-secondary flex-1">
                    {lang === 'rw' ? 'Oya' : 'Cancel'}
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      )}

      {/* ── DETAIL VIEW ── */}
      {selected && (
        <div>
          {/* Back button */}
          <button onClick={() => setSelectedSupplier(null)}
            className="flex items-center gap-1 text-gray-400 text-sm mb-4 hover:text-gray-600 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {lang === 'rw' ? 'Subira inyuma' : 'Back'}
          </button>

          {/* Compact header */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-gray-900">{selected.supplier_name}</h2>
              <button onClick={() => openModal({ type: 'add_owned', crateType: selected })}
                className="flex items-center gap-1 text-xs font-semibold bg-blue-50 text-blue-600 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors">
                <span className="text-base leading-none">+</span>
                {lang === 'rw' ? 'Ongeraho' : 'Add owned'}
              </button>
            </div>

            {/* Stats row — compact */}
            <div className="grid grid-cols-4 gap-2">
              <div className="text-center">
                <p className="text-[10px] text-gray-400 mb-0.5">{lang === 'rw' ? 'Ufite' : 'Owned'}</p>
                <p className="text-lg font-bold text-gray-900">{selected.total_owned}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-gray-400 mb-0.5">{lang === 'rw' ? 'Hano' : 'At depot'}</p>
                <p className={`text-lg font-bold ${(selected.total_owned + selected.total_borrowed - selected.total_lent_out) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {selected.total_owned + selected.total_borrowed - selected.total_lent_out}
                </p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-gray-400 mb-0.5">{lang === 'rw' ? 'Ku bakiriya' : 'With clients'}</p>
                <p className="text-lg font-bold text-red-500">{selected.total_lent_out}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-gray-400 mb-0.5">{lang === 'rw' ? 'Watakiye' : 'Borrowed'}</p>
                <p className="text-lg font-bold text-orange-500">{selected.total_borrowed}</p>
              </div>
            </div>
          </div>

          {/* First time — no owned set */}
          {selected.total_owned === 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-4 flex items-center justify-between gap-3">
              <p className="text-yellow-800 text-sm font-medium">
                {lang === 'rw' ? 'Shyiraho amaziye yawe ya mbere' : 'Set your total owned crates to get started'}
              </p>
              <button onClick={() => openModal({ type: 'add_owned', crateType: selected })}
                className="btn-primary text-sm shrink-0">
                {lang === 'rw' ? 'Shyiraho' : 'Set up'}
              </button>
            </div>
          )}

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <button onClick={() => openModal({ type: 'lend', crateType: selected })}
              className="bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 px-4 py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2">
              📤 {lang === 'rw' ? 'Tanga ku mukiriya' : 'Lend to client'}
            </button>
            <button onClick={() => openModal({ type: 'borrow', crateType: selected })}
              className="bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100 px-4 py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2">
              📥 {lang === 'rw' ? 'Taka amaziye' : 'Borrow crates'}
            </button>
          </div>

          {/* Active lendings */}
          {activeLendings.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                📤 {lang === 'rw' ? 'Amaziye ku bakiriya' : 'Crates with clients'} ({activeLendings.length})
              </p>
              <div className="space-y-2">
                {activeLendings.map(lending => {
                  const remaining = lending.crates_lent - lending.crates_returned
                  return (
                    <div key={lending.id} className="bg-white border border-red-100 rounded-xl p-3 flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm capitalize truncate">{lending.client_name}</p>
                        <p className="text-xs text-gray-400">{formatDateSafe(lending.lent_date)}</p>
                        <div className="flex gap-3 mt-1 text-xs">
                          <span className="text-gray-500">{lang === 'rw' ? 'Yafashe' : 'Lent'}: <strong>{lending.crates_lent}</strong></span>
                          {lending.crates_returned > 0 && <span className="text-green-600">{lang === 'rw' ? 'Yasubije' : 'Back'}: <strong>{lending.crates_returned}</strong></span>}
                          <span className="text-red-600 font-bold">{lang === 'rw' ? 'Asigaye' : 'Owes'}: <strong>{remaining}</strong></span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        <button onClick={() => openModal({ type: 'return_lend', lending })}
                          className="bg-green-50 text-green-700 border border-green-200 px-2.5 py-1.5 rounded-lg text-xs font-semibold hover:bg-green-100">
                          ↩️ {lang === 'rw' ? 'Yagaruye' : 'Return'}
                        </button>
                        <button onClick={() => deleteLending(lending.id)}
                          className="text-gray-400 hover:text-red-500 text-xs text-center">
                          {lang === 'rw' ? 'Siba' : 'Delete'}
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
            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                📥 {lang === 'rw' ? 'Amaziye watakiye' : 'Crates you borrowed'} ({activeBorrowings.length})
              </p>
              <div className="space-y-2">
                {activeBorrowings.map(borrowing => (
                  <div key={borrowing.id} className="bg-white border border-orange-100 rounded-xl p-3 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate">{borrowing.borrowed_from}</p>
                      <p className="text-xs text-gray-400">{formatDateSafe(borrowing.borrowed_date)}</p>
                      <p className="text-orange-600 font-bold text-sm mt-1">{borrowing.crates_borrowed} {lang === 'rw' ? 'amaziye' : 'crates'}</p>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <button onClick={() => openModal({ type: 'return_borrow', borrowing })}
                        className="bg-green-50 text-green-700 border border-green-200 px-2.5 py-1.5 rounded-lg text-xs font-semibold hover:bg-green-100">
                        ✅ {lang === 'rw' ? 'Narasubije' : 'Returned'}
                      </button>
                      <button onClick={() => deleteBorrowing(borrowing.id)}
                        className="text-gray-400 hover:text-red-500 text-xs text-center">
                        {lang === 'rw' ? 'Siba' : 'Delete'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fully returned history */}
          {selectedLendings.filter(l => l.is_fully_returned).length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                ✅ {lang === 'rw' ? 'Yarasubije yose' : 'Fully returned'}
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
        </div>
      )}

      {/* ── MAIN LIST VIEW ── */}
      {!selected && (
        <div>
          <div className="mb-5">
            <h1 className="page-title mb-0">{lang === 'rw' ? 'Amaziye' : 'Crates'}</h1>
            <p className="text-gray-400 text-sm">{lang === 'rw' ? 'Kurikirana amaziye yawe' : 'Track your crates'}</p>
          </div>

          {crateTypes.length === 0 ? (
            <div className="card text-center py-10">
              <p className="text-gray-400">Loading...</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {crateTypes.map(ct => {
                const atDepot = ct.total_owned + ct.total_borrowed - ct.total_lent_out
                const activeLendingsCount = lendings.filter(l => l.crate_type_id === ct.id && !l.is_fully_returned).length
                const activeBorrowingsCount = borrowings.filter(b => b.crate_type_id === ct.id && !b.is_returned).length

                return (
                  <button key={ct.id}
                    onClick={() => setSelectedSupplier(ct)}
                    className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4 text-left hover:shadow-md hover:border-blue-200 transition-all active:scale-95">

                    {/* Supplier name */}
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
                        <span className="text-white font-bold text-sm">{ct.supplier_name.charAt(0)}</span>
                      </div>
                      <p className="font-bold text-gray-900 text-sm truncate">{ct.supplier_name}</p>
                    </div>

                    {/* First time prompt */}
                    {ct.total_owned === 0 ? (
                      <div className="text-center py-2">
                        <p className="text-xs text-gray-400 mb-1">{lang === 'rw' ? 'Ntago washyizeho' : 'Not set up yet'}</p>
                        <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
                          {lang === 'rw' ? 'Tap guteranya' : 'Tap to set up'}
                        </span>
                      </div>
                    ) : (
                      <>
                        {/* Main stat */}
                        <div className="mb-3">
                          <p className="text-[10px] text-gray-400">{lang === 'rw' ? 'Ari hano' : 'At depot'}</p>
                          <p className={`text-3xl font-bold ${atDepot < 0 ? 'text-red-600' : 'text-gray-900'}`}>{atDepot}</p>
                          <p className="text-[10px] text-gray-400">{lang === 'rw' ? `ku ya ${ct.total_owned} ufite` : `of ${ct.total_owned} owned`}</p>
                        </div>

                        {/* Small badges */}
                        <div className="flex gap-1 flex-wrap">
                          {activeLendingsCount > 0 && (
                            <span className="text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded-md font-medium">
                              📤 {activeLendingsCount} {lang === 'rw' ? 'client' : 'clients'}
                            </span>
                          )}
                          {activeBorrowingsCount > 0 && (
                            <span className="text-[10px] bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded-md font-medium">
                              📥 {activeBorrowingsCount} {lang === 'rw' ? 'watakiye' : 'borrowed'}
                            </span>
                          )}
                          {activeLendingsCount === 0 && activeBorrowingsCount === 0 && (
                            <span className="text-[10px] bg-green-50 text-green-600 px-1.5 py-0.5 rounded-md font-medium">
                              ✅ {lang === 'rw' ? 'Byose hano' : 'All here'}
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}