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
  supplier_name: string
  client_name: string
  crates_lent: number
  crates_returned: number
  is_fully_returned: boolean
  lent_date: string
}

interface Borrowing {
  id: string
  crate_type_id: string
  supplier_name: string
  borrowed_from: string
  crates_borrowed: number
  is_returned: boolean
  borrowed_date: string
}

type ModalType =
  | { type: 'setup'; crateType?: CrateType }
  | { type: 'lend'; crateType: CrateType }
  | { type: 'return_lend'; lending: Lending }
  | { type: 'borrow'; crateType: CrateType }
  | { type: 'return_borrow'; borrowing: Borrowing }
  | null

function formatDateSafe(dateStr: string): string {
  const clean = dateStr.split('T')[0]
  const [year, month, day] = clean.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-RW', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function today(): string {
  return new Date().toISOString().split('T')[0]
}

export default function Crates() {
  const { business } = useAuth()
  const lang: Language = (business as any)?.language || 'en'
  const token = localStorage.getItem('dime-depot-token')

  const [crateTypes, setCrateTypes] = useState<CrateType[]>([])
  const [lendings, setLendings] = useState<Lending[]>([])
  const [borrowings, setBorrowings] = useState<Borrowing[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<ModalType>(null)
  const [tab, setTab] = useState<'overview' | 'lendings' | 'borrowings'>('overview')

  // Form state
  const [formClientName, setFormClientName] = useState('')
  const [formCrates, setFormCrates] = useState('')
  const [formDate, setFormDate] = useState(today())
  const [formBorrowedFrom, setFormBorrowedFrom] = useState('')
  const [formTotalOwned, setFormTotalOwned] = useState('')
  const [formSupplierId, setFormSupplierId] = useState('')
  const [formReturnCrates, setFormReturnCrates] = useState('')
  const [saving, setSaving] = useState(false)

  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }

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
      setCrateTypes(typesData.crate_types || [])
      setLendings(lendingsData.lendings || [])
      setBorrowings(borrowingsData.borrowings || [])
      setSuppliers(suppliersData.suppliers || [])
    } catch {
      toast.error('Failed to load crate data')
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setFormClientName(''); setFormCrates(''); setFormDate(today())
    setFormBorrowedFrom(''); setFormTotalOwned(''); setFormSupplierId('')
    setFormReturnCrates('')
  }

  function openModal(m: ModalType) {
    resetForm()
    if (m?.type === 'setup' && m.crateType) {
      setFormTotalOwned(String(m.crateType.total_owned))
      setFormSupplierId(m.crateType.supplier_id)
    }
    setModal(m)
  }

  async function handleSetup() {
    if (!formSupplierId) { toast.error('Select a supplier'); return }
    if (!formTotalOwned || parseInt(formTotalOwned) < 0) { toast.error('Enter total owned crates'); return }
    setSaving(true)
    try {
      if (modal?.type === 'setup' && modal.crateType) {
        // Update existing
        await fetch(`${API_URL}/api/crates/types/${modal.crateType.id}`, {
          method: 'PUT', headers,
          body: JSON.stringify({ total_owned: parseInt(formTotalOwned) }),
        })
      } else {
        // Create new
        await fetch(`${API_URL}/api/crates/types`, {
          method: 'POST', headers,
          body: JSON.stringify({ supplier_id: formSupplierId, total_owned: parseInt(formTotalOwned) }),
        })
      }
      toast.success(lang === 'rw' ? 'Byabitswe!' : 'Saved!')
      setModal(null)
      loadAll()
    } catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  async function handleLend() {
    if (!formClientName.trim()) { toast.error(lang === 'rw' ? 'Andika izina' : 'Enter client name'); return }
    if (!formCrates || parseInt(formCrates) <= 0) { toast.error(lang === 'rw' ? 'Andika umubare' : 'Enter number of crates'); return }
    if (modal?.type !== 'lend') return
    setSaving(true)
    try {
      const res = await fetch(`${API_URL}/api/crates/lendings`, {
        method: 'POST', headers,
        body: JSON.stringify({
          crate_type_id: modal.crateType.id,
          client_name: formClientName,
          crates_lent: parseInt(formCrates),
          lent_date: formDate,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success(lang === 'rw' ? 'Amaziye yatanzwe!' : 'Crates lent recorded!')
      setModal(null)
      loadAll()
    } catch { toast.error('Failed to record') }
    finally { setSaving(false) }
  }

  async function handleReturnLend() {
    if (!formReturnCrates || parseInt(formReturnCrates) <= 0) {
      toast.error(lang === 'rw' ? 'Andika umubare' : 'Enter number of crates returned'); return
    }
    if (modal?.type !== 'return_lend') return
    setSaving(true)
    try {
      const res = await fetch(`${API_URL}/api/crates/lendings/${modal.lending.id}/return`, {
        method: 'PUT', headers,
        body: JSON.stringify({ crates_returned: parseInt(formReturnCrates) }),
      })
      if (!res.ok) throw new Error()
      toast.success(lang === 'rw' ? 'Amaziye yagaruwe!' : 'Return recorded!')
      setModal(null)
      loadAll()
    } catch { toast.error('Failed to record') }
    finally { setSaving(false) }
  }

  async function handleBorrow() {
    if (!formBorrowedFrom.trim()) { toast.error(lang === 'rw' ? 'Andika izina' : 'Enter name'); return }
    if (!formCrates || parseInt(formCrates) <= 0) { toast.error(lang === 'rw' ? 'Andika umubare' : 'Enter number of crates'); return }
    if (modal?.type !== 'borrow') return
    setSaving(true)
    try {
      const res = await fetch(`${API_URL}/api/crates/borrowings`, {
        method: 'POST', headers,
        body: JSON.stringify({
          crate_type_id: modal.crateType.id,
          borrowed_from: formBorrowedFrom,
          crates_borrowed: parseInt(formCrates),
          borrowed_date: formDate,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success(lang === 'rw' ? 'Amaziye yatakwe!' : 'Borrowing recorded!')
      setModal(null)
      loadAll()
    } catch { toast.error('Failed to record') }
    finally { setSaving(false) }
  }

  async function handleReturnBorrow() {
    if (modal?.type !== 'return_borrow') return
    setSaving(true)
    try {
      const res = await fetch(`${API_URL}/api/crates/borrowings/${modal.borrowing.id}/return`, {
        method: 'PUT', headers,
        body: JSON.stringify({}),
      })
      if (!res.ok) throw new Error()
      toast.success(lang === 'rw' ? 'Amaziye yasubijwe!' : 'Returned!')
      setModal(null)
      loadAll()
    } catch { toast.error('Failed to record') }
    finally { setSaving(false) }
  }

  async function deleteLending(id: string) {
    try {
      await fetch(`${API_URL}/api/crates/lendings/${id}`, { method: 'DELETE', headers })
      toast.success(lang === 'rw' ? 'Yasibwe' : 'Deleted')
      loadAll()
    } catch { toast.error('Failed to delete') }
  }

  async function deleteBorrowing(id: string) {
    try {
      await fetch(`${API_URL}/api/crates/borrowings/${id}`, { method: 'DELETE', headers })
      toast.success(lang === 'rw' ? 'Yasibwe' : 'Deleted')
      loadAll()
    } catch { toast.error('Failed to delete') }
  }

  // Suppliers that don't have a crate type yet
  const suppliersWithoutCrateType = suppliers.filter(
    s => !crateTypes.find(ct => ct.supplier_id === s.id)
  )

  const activeLendings = lendings.filter(l => !l.is_fully_returned)
  const activeBorrowings = borrowings.filter(b => !b.is_returned)

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
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">

            {/* Setup / Edit total owned */}
            {(modal.type === 'setup') && (
              <>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  {modal.crateType
                    ? (lang === 'rw' ? 'Hindura amaziye' : 'Update crates')
                    : (lang === 'rw' ? 'Shyiraho amaziye' : 'Set up crates')}
                </h2>
                {!modal.crateType && (
                  <div className="mb-4">
                    <label className="label">{lang === 'rw' ? 'Uruganda' : 'Supplier'}</label>
                    <select className="input w-full" value={formSupplierId} onChange={e => setFormSupplierId(e.target.value)}>
                      <option value="">{lang === 'rw' ? 'Hitamo...' : 'Select supplier...'}</option>
                      {suppliersWithoutCrateType.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                {modal.crateType && (
                  <p className="text-sm text-blue-600 font-medium mb-4">{modal.crateType.supplier_name}</p>
                )}
                <div className="mb-5">
                  <label className="label">{lang === 'rw' ? 'Amaziye ufite yose (ayawe)' : 'Total crates you own'}</label>
                  <input type="number" min="0" className="input w-full text-lg"
                    placeholder="e.g. 150"
                    value={formTotalOwned} onChange={e => setFormTotalOwned(e.target.value)} autoFocus />
                </div>
                <div className="flex gap-3">
                  <button onClick={handleSetup} disabled={saving} className="btn-primary flex-1">
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
                  {lang === 'rw' ? 'Tanga amaziye' : 'Lend crates'}
                </h2>
                <p className="text-sm text-blue-600 font-medium mb-4">{modal.crateType.supplier_name}</p>
                <div className="space-y-4 mb-5">
                  <div>
                    <label className="label">{lang === 'rw' ? 'Izina ry\'umukiriya' : 'Client name'}</label>
                    <input type="text" className="input w-full" placeholder={lang === 'rw' ? 'Andika izina' : 'Enter name'}
                      value={formClientName} onChange={e => setFormClientName(e.target.value)} autoFocus />
                  </div>
                  <div>
                    <label className="label">{lang === 'rw' ? 'Umubare w\'amaziye' : 'Number of crates'}</label>
                    <input type="number" min="1" className="input w-full text-lg"
                      placeholder="e.g. 4"
                      value={formCrates} onChange={e => setFormCrates(e.target.value)} />
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
                  {lang === 'rw' ? 'Amaziye yagaruye' : 'Client returned crates'}
                </h2>
                <p className="text-sm text-blue-600 font-medium mb-1">{modal.lending.client_name}</p>
                <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm">
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-500">{lang === 'rw' ? 'Yafashe' : 'Lent'}</span>
                    <span className="font-semibold">{modal.lending.crates_lent}</span>
                  </div>
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-500">{lang === 'rw' ? 'Yarasubije' : 'Already returned'}</span>
                    <span className="font-semibold text-green-600">{modal.lending.crates_returned}</span>
                  </div>
                  <div className="flex justify-between border-t pt-1 mt-1">
                    <span className="text-gray-700 font-medium">{lang === 'rw' ? 'Asigaye' : 'Remaining'}</span>
                    <span className="font-bold text-red-600">
                      {modal.lending.crates_lent - modal.lending.crates_returned}
                    </span>
                  </div>
                </div>
                <div className="mb-5">
                  <label className="label">{lang === 'rw' ? 'Amaziye agaruye ubu' : 'Crates returned now'}</label>
                  <input type="number" min="1"
                    max={modal.lending.crates_lent - modal.lending.crates_returned}
                    className="input w-full text-lg"
                    placeholder="e.g. 2"
                    value={formReturnCrates} onChange={e => setFormReturnCrates(e.target.value)} autoFocus />
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
                <div className="space-y-4 mb-5">
                  <div>
                    <label className="label">{lang === 'rw' ? 'Watakiye nde' : 'Borrowed from'}</label>
                    <input type="text" className="input w-full"
                      placeholder={lang === 'rw' ? 'Uruganda / Umuturanyi...' : 'Supplier / Neighbour...'}
                      value={formBorrowedFrom} onChange={e => setFormBorrowedFrom(e.target.value)} autoFocus />
                  </div>
                  <div>
                    <label className="label">{lang === 'rw' ? 'Umubare w\'amaziye' : 'Number of crates'}</label>
                    <input type="number" min="1" className="input w-full text-lg"
                      placeholder="e.g. 10"
                      value={formCrates} onChange={e => setFormCrates(e.target.value)} />
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

            {/* Return borrowed crates */}
            {modal.type === 'return_borrow' && (
              <>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">
                  {lang === 'rw' ? 'Subiza amaziye' : 'Return borrowed crates'}
                </h2>
                <div className="bg-gray-50 rounded-lg p-3 mb-5 text-sm">
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-500">{lang === 'rw' ? 'Watakiye kuri' : 'Borrowed from'}</span>
                    <span className="font-semibold">{modal.borrowing.borrowed_from}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">{lang === 'rw' ? 'Umubare' : 'Crates'}</span>
                    <span className="font-bold text-red-600">{modal.borrowing.crates_borrowed}</span>
                  </div>
                </div>
                <p className="text-gray-500 text-sm mb-5">
                  {lang === 'rw'
                    ? 'Emeza ko wasubije amaziye yose kuri uyu muntu.'
                    : 'Confirm you have returned all crates to this person.'}
                </p>
                <div className="flex gap-3">
                  <button onClick={handleReturnBorrow} disabled={saving} className="bg-green-600 text-white py-2.5 rounded-lg font-semibold text-sm flex-1 hover:bg-green-700">
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

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title mb-0">{lang === 'rw' ? 'Amaziye' : 'Crates'}</h1>
          <p className="text-gray-400 text-sm mt-1">
            {lang === 'rw' ? 'Kurikirana amaziye yawe' : 'Track your crates'}
          </p>
        </div>
        {suppliersWithoutCrateType.length > 0 && (
          <button onClick={() => openModal({ type: 'setup' })}
            className="btn-primary text-sm">
            + {lang === 'rw' ? 'Shyiraho' : 'Set up'}
          </button>
        )}
      </div>

      {/* No crate types yet */}
      {crateTypes.length === 0 && (
        <div className="card text-center py-10">
          <div className="text-4xl mb-3">📦</div>
          <p className="text-gray-700 font-semibold">
            {lang === 'rw' ? 'Ntago amaziye yashyizweho' : 'No crates set up yet'}
          </p>
          <p className="text-gray-400 text-sm mt-1 mb-4">
            {lang === 'rw'
              ? 'Shyiraho amaziye yawe ya Bralirwa na Skol'
              : 'Set up your Bralirwa and Skol crates to start tracking'}
          </p>
          <button onClick={() => openModal({ type: 'setup' })} className="btn-primary">
            {lang === 'rw' ? 'Tangira' : 'Get started'}
          </button>
        </div>
      )}

      {/* Crate type overview cards */}
      {crateTypes.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {crateTypes.map(ct => {
              const atDepot = ct.total_owned + ct.total_borrowed - ct.total_lent_out
              return (
                <div key={ct.id} className="card">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
                        <span className="text-blue-600 text-lg">📦</span>
                      </div>
                      <h2 className="font-bold text-gray-900">{ct.supplier_name}</h2>
                    </div>
                    <button onClick={() => openModal({ type: 'setup', crateType: ct })}
                      className="text-xs text-gray-400 hover:text-gray-600 font-medium">
                      ✏️ {lang === 'rw' ? 'Hindura' : 'Edit'}
                    </button>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                      <p className="text-xs text-gray-400 mb-1">{lang === 'rw' ? 'Ufite yose' : 'Total owned'}</p>
                      <p className="text-2xl font-bold text-gray-900">{ct.total_owned}</p>
                    </div>
                    <div className={`rounded-xl p-3 text-center ${atDepot < 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                      <p className="text-xs text-gray-400 mb-1">{lang === 'rw' ? 'Ari hano' : 'At depot'}</p>
                      <p className={`text-2xl font-bold ${atDepot < 0 ? 'text-red-600' : 'text-green-700'}`}>{atDepot}</p>
                    </div>
                    <div className="bg-red-50 rounded-xl p-3 text-center">
                      <p className="text-xs text-gray-400 mb-1">{lang === 'rw' ? 'Ku bakiriya' : 'With clients'}</p>
                      <p className="text-2xl font-bold text-red-600">{ct.total_lent_out}</p>
                    </div>
                    <div className="bg-orange-50 rounded-xl p-3 text-center">
                      <p className="text-xs text-gray-400 mb-1">{lang === 'rw' ? 'Watakiye' : 'Borrowed'}</p>
                      <p className="text-2xl font-bold text-orange-600">{ct.total_borrowed}</p>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => openModal({ type: 'lend', crateType: ct })}
                      className="bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 px-3 py-2 rounded-lg text-sm font-semibold transition-all">
                      📤 {lang === 'rw' ? 'Tanga ku mukiriya' : 'Lend to client'}
                    </button>
                    <button onClick={() => openModal({ type: 'borrow', crateType: ct })}
                      className="bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100 px-3 py-2 rounded-lg text-sm font-semibold transition-all">
                      📥 {lang === 'rw' ? 'Taka amaziye' : 'Borrow crates'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-4">
            {(['overview', 'lendings', 'borrowings'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  tab === t ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                }`}>
                {t === 'overview'
                  ? (lang === 'rw' ? 'Byose' : 'All')
                  : t === 'lendings'
                  ? `${lang === 'rw' ? 'Ku bakiriya' : 'With clients'} (${activeLendings.length})`
                  : `${lang === 'rw' ? 'Watakiye' : 'Borrowed'} (${activeBorrowings.length})`}
              </button>
            ))}
          </div>

          {/* Lendings list */}
          {(tab === 'overview' || tab === 'lendings') && (
            <div className="mb-6">
              {tab === 'overview' && (
                <h3 className="font-semibold text-gray-700 mb-3">
                  📤 {lang === 'rw' ? 'Amaziye ku bakiriya' : 'Crates with clients'}
                </h3>
              )}
              {activeLendings.length === 0 ? (
                <div className="card text-center py-6">
                  <p className="text-gray-400 text-sm">
                    {lang === 'rw' ? 'Nta mukiriya ufite amaziye yawe' : 'No crates lent to clients'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {activeLendings.map(lending => {
                    const remaining = lending.crates_lent - lending.crates_returned
                    return (
                      <div key={lending.id} className="card border border-red-100 bg-red-50/20">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-semibold text-gray-900 capitalize">{lending.client_name}</p>
                              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{lending.supplier_name}</span>
                            </div>
                            <p className="text-xs text-gray-400 mb-2">{formatDateSafe(lending.lent_date)}</p>
                            <div className="flex gap-4 text-sm">
                              <span className="text-gray-500">{lang === 'rw' ? 'Yafashe' : 'Lent'}: <strong>{lending.crates_lent}</strong></span>
                              {lending.crates_returned > 0 && (
                                <span className="text-green-600">{lang === 'rw' ? 'Yasubije' : 'Returned'}: <strong>{lending.crates_returned}</strong></span>
                              )}
                              <span className="text-red-600 font-bold">{lang === 'rw' ? 'Asigaye' : 'Remaining'}: <strong>{remaining}</strong></span>
                            </div>
                          </div>
                          <div className="flex flex-col gap-1">
                            <button onClick={() => openModal({ type: 'return_lend', lending })}
                              className="bg-green-50 text-green-700 border border-green-200 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-green-100">
                              ↩️ {lang === 'rw' ? 'Yagaruye' : 'Return'}
                            </button>
                            <button onClick={() => deleteLending(lending.id)}
                              className="text-red-400 hover:text-red-600 text-xs text-center">
                              {lang === 'rw' ? 'Siba' : 'Delete'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Fully returned lendings */}
              {tab === 'lendings' && lendings.filter(l => l.is_fully_returned).length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                    {lang === 'rw' ? 'Yarasubije yose' : 'Fully returned'}
                  </p>
                  <div className="space-y-2">
                    {lendings.filter(l => l.is_fully_returned).map(lending => (
                      <div key={lending.id} className="card bg-green-50/30 border border-green-100 opacity-70">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-700 capitalize text-sm">{lending.client_name}</p>
                            <p className="text-xs text-gray-400">{lending.crates_lent} {lang === 'rw' ? 'amaziye — yarasubije yose' : 'crates — fully returned'}</p>
                          </div>
                          <button onClick={() => deleteLending(lending.id)}
                            className="text-gray-400 hover:text-red-500 text-xs">
                            {lang === 'rw' ? 'Siba' : 'Delete'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Borrowings list */}
          {(tab === 'overview' || tab === 'borrowings') && (
            <div>
              {tab === 'overview' && (
                <h3 className="font-semibold text-gray-700 mb-3">
                  📥 {lang === 'rw' ? 'Amaziye watakiye' : 'Crates you borrowed'}
                </h3>
              )}
              {activeBorrowings.length === 0 ? (
                <div className="card text-center py-6">
                  <p className="text-gray-400 text-sm">
                    {lang === 'rw' ? 'Nta maziye watakiye' : 'No borrowed crates outstanding'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {activeBorrowings.map(borrowing => (
                    <div key={borrowing.id} className="card border border-orange-100 bg-orange-50/20">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-semibold text-gray-900">{borrowing.borrowed_from}</p>
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{borrowing.supplier_name}</span>
                          </div>
                          <p className="text-xs text-gray-400 mb-1">{formatDateSafe(borrowing.borrowed_date)}</p>
                          <p className="text-orange-600 font-bold text-sm">
                            {borrowing.crates_borrowed} {lang === 'rw' ? 'amaziye' : 'crates'}
                          </p>
                        </div>
                        <div className="flex flex-col gap-1">
                          <button onClick={() => openModal({ type: 'return_borrow', borrowing })}
                            className="bg-green-50 text-green-700 border border-green-200 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-green-100">
                            ✅ {lang === 'rw' ? 'Narasubije' : 'Returned'}
                          </button>
                          <button onClick={() => deleteBorrowing(borrowing.id)}
                            className="text-red-400 hover:text-red-600 text-xs text-center">
                            {lang === 'rw' ? 'Siba' : 'Delete'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
