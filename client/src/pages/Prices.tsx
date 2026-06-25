import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { suppliersAPI, productsAPI, pricesAPI, buyingPricesAPI } from '../lib/api'
import type { Product, Supplier, Price } from '../lib/types'
import { formatRWF, getPriceForDate, today } from '../lib/helpers'
import { t } from '../lib/i18n'
import type { Language } from '../lib/i18n'
import toast from 'react-hot-toast'

interface EditingProduct {
  product: Product
  type: 'selling' | 'buying'
}

export default function Prices() {
  const { business } = useAuth()
  const lang: Language = (business as any)?.language || 'en'

  const [products, setProducts] = useState<Product[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [prices, setPrices] = useState<Price[]>([])
  const [buyingPrices, setBuyingPrices] = useState<Price[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<EditingProduct | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [todayDate] = useState(today())

  useEffect(() => { if (business) loadData() }, [business])

  async function loadData() {
    setLoading(true)
    try {
      const [productsData, suppliersData, pricesData, buyingPricesData] = await Promise.all([
        productsAPI.getAll(), suppliersAPI.getAll(), pricesAPI.getAll(), buyingPricesAPI.getAll(),
      ])
      setProducts(productsData.products.filter((p: Product) => p.is_active))
      setSuppliers(suppliersData.suppliers)
      setPrices(pricesData.prices)
      setBuyingPrices(buyingPricesData.buying_prices)
    } catch {
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  async function savePrice() {
    if (!editing) return
    const price = parseFloat(editingValue)

    if (!price || price <= 0) {
      toast.error(lang === 'rw' ? 'Injiza igiciro nyacyo' : 'Please enter a valid price')
      return
    }

    if (editing.type === 'buying') {
      const sellingPrice = getPriceForDate(prices, editing.product.id, todayDate)
      if (sellingPrice > 0 && price >= sellingPrice) {
        toast.error(lang === 'rw'
          ? `${t('buying_ref', lang)} (${formatRWF(sellingPrice)})`
          : `Buying price must be lower than selling price (${formatRWF(sellingPrice)})`)
        return
      }
    }

    if (editing.type === 'selling') {
      const buyingPrice = getPriceForDate(buyingPrices, editing.product.id, todayDate)
      if (buyingPrice > 0 && price <= buyingPrice) {
        toast.error(lang === 'rw'
          ? `${t('selling_ref', lang)} (${formatRWF(buyingPrice)})`
          : `Selling price must be higher than buying price (${formatRWF(buyingPrice)})`)
        return
      }
    }

    try {
      if (editing.type === 'selling') {
        await pricesAPI.set({ product_id: editing.product.id, price_per_casse: price, effective_date: todayDate })
      } else {
        await buyingPricesAPI.set({ product_id: editing.product.id, price_per_casse: price, effective_date: todayDate })
      }
      toast.success(lang === 'rw' ? 'Igiciro cyabitswe!' : `${editing.type === 'selling' ? 'Selling' : 'Buying'} price saved!`)
      setEditing(null)
      setEditingValue('')
      loadData()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to save price')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="page-title mb-1">{t('prices_title', lang)}</h1>
        <p className="text-gray-500 text-sm">{t('prices_sub_text', lang)}</p>
      </div>

      {/* Edit price modal */}
      {editing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">{editing.product.name}</h2>
            <p className="text-sm text-gray-500 mb-1">
              {editing.product.pieces_per_casse} {t('pcs_casse', lang)} · 1/2 = {editing.product.pieces_per_casse / 2}
            </p>
            <p className={`text-sm font-medium mb-4 ${editing.type === 'selling' ? 'text-green-600' : 'text-red-600'}`}>
              {editing.type === 'selling' ? `💰 ${t('selling_price_label', lang)}` : `🛒 ${t('buying_price_label', lang)}`}
            </p>

            {editing.type === 'selling' && (() => {
              const bp = getPriceForDate(buyingPrices, editing.product.id, todayDate)
              return bp > 0 ? (
                <div className="bg-gray-50 rounded-lg p-2 mb-4 text-sm text-gray-500">
                  🛒 {t('buying', lang)}: <span className="font-semibold text-gray-700">{formatRWF(bp)}</span> — {t('selling_ref', lang)}
                </div>
              ) : null
            })()}
            {editing.type === 'buying' && (() => {
              const sp = getPriceForDate(prices, editing.product.id, todayDate)
              return sp > 0 ? (
                <div className="bg-gray-50 rounded-lg p-2 mb-4 text-sm text-gray-500">
                  💰 {t('selling', lang)}: <span className="font-semibold text-gray-700">{formatRWF(sp)}</span> — {t('buying_ref', lang)}
                </div>
              ) : null
            })()}

            <div className="mb-4">
              <label className="label">{t('price_per_casse', lang)}</label>
              <input type="number" className="input" placeholder="e.g. 15000"
                value={editingValue} onChange={e => setEditingValue(e.target.value)} autoFocus />
            </div>

            {editingValue && parseFloat(editingValue) > 0 && (
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="bg-gray-50 rounded-lg p-2 text-center">
                  <p className="text-xs text-gray-400">{t('half_casse', lang)}</p>
                  <p className="text-sm font-semibold text-gray-700">{formatRWF(parseFloat(editingValue) / 2)}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2 text-center">
                  <p className="text-xs text-gray-400">{t('per_piece', lang)}</p>
                  <p className="text-sm font-semibold text-gray-700">{formatRWF(Math.ceil(parseFloat(editingValue) / editing.product.pieces_per_casse / 100) * 100)}</p>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={savePrice} className="btn-primary flex-1">{t('save', lang)}</button>
              <button onClick={() => { setEditing(null); setEditingValue('') }} className="btn-secondary flex-1">{t('cancel', lang)}</button>
            </div>
          </div>
        </div>
      )}

      {products.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-gray-500">{t('no_products_prices', lang)}</p>
          <p className="text-gray-400 text-sm mt-1">{t('no_products_prices_sub', lang)}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {suppliers.map(supplier => {
            const supplierProducts = products.filter(p => p.supplier_id === supplier.id)
            if (supplierProducts.length === 0) return null
            return (
              <div key={supplier.id} className="card">
                <div className="section-title">{supplier.name}</div>
                <div className="divide-y divide-gray-100">
                  {supplierProducts.map(product => {
                    const sellingPrice = getPriceForDate(prices, product.id, todayDate)
                    const buyingPrice = getPriceForDate(buyingPrices, product.id, todayDate)
                    const margin = sellingPrice > 0 && buyingPrice > 0 ? sellingPrice - buyingPrice : null

                    return (
                      <div key={product.id} className="py-3 px-1">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="font-medium text-gray-900 text-sm">{product.name}</p>
                            <p className="text-xs text-gray-400">{product.pieces_per_casse} {t('pcs_casse', lang)}</p>
                          </div>
                          {margin !== null && (
                            <div className="text-right">
                              <p className="text-xs text-gray-400">{t('margin_casse', lang)}</p>
                              <p className="text-sm font-bold text-green-600">{formatRWF(margin)}</p>
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => { setEditing({ product, type: 'buying' }); setEditingValue(buyingPrice ? String(buyingPrice) : '') }}
                            className="flex items-center justify-between bg-white border border-red-200 rounded-lg px-3 py-2 hover:bg-red-50 transition-colors text-left">
                            <div>
                              <p className="text-xs text-red-500 font-medium">🛒 {t('buying', lang)}</p>
                              <p className={`text-sm font-semibold ${buyingPrice ? 'text-red-700' : 'text-red-300'}`}>
                                {buyingPrice ? formatRWF(buyingPrice) : t('not_set', lang)}
                              </p>
                            </div>
                            <p className="text-xs text-gray-400">{t('tap', lang)}</p>
                          </button>

                          <button
                            onClick={() => { setEditing({ product, type: 'selling' }); setEditingValue(sellingPrice ? String(sellingPrice) : '') }}
                            className="flex items-center justify-between bg-white border border-green-200 rounded-lg px-3 py-2 hover:bg-green-50 transition-colors text-left">
                            <div>
                              <p className="text-xs text-green-500 font-medium">💰 {t('selling', lang)}</p>
                              <p className={`text-sm font-semibold ${sellingPrice ? 'text-green-700' : 'text-green-300'}`}>
                                {sellingPrice ? formatRWF(sellingPrice) : t('not_set', lang)}
                              </p>
                            </div>
                            <p className="text-xs text-gray-400">{t('tap', lang)}</p>
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}