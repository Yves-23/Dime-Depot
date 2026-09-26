import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { buyingPricesAPI } from '../lib/api'
import { formatRWF, today } from '../lib/helpers'
import { t } from '../lib/i18n'
import type { Language } from '../lib/i18n'
import toast from 'react-hot-toast'

type PeriodType = 'week' | 'month' | 'custom'

interface DailySummary {
  date: string
  revenue: number
  buying_cost: number
  collected: number
  surplus: number
  deficit: number
  gross_profit: number
  profit: number
}

interface ProductPerformance {
  product_id: string
  product_name: string
  supplier_id: string | null
  supplier_name: string
  pieces_per_casse: number
  quantity_sold_pieces: number
  equivalent_casses: number
  revenue: number
  buying_cost: number
  gross_profit: number
}

interface Summary {
  start_date: string
  end_date: string
  total_revenue: number
  total_buying_cost: number
  total_surplus: number
  total_deficit: number
  total_gross_profit: number
  total_profit: number
  daily: DailySummary[]
  products: ProductPerformance[]
}

interface SupplierPerformance {
  supplier_id: string | null
  supplier_name: string
  products_count: number
  revenue: number
  buying_cost: number
  gross_profit: number
}

export default function Profit() {
  const { business } = useAuth()
  const lang: Language = (business as any)?.language || 'en'

  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [period, setPeriod] = useState<PeriodType>('week')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  useEffect(() => {
    if (business) loadSummary()
  }, [business, period])

  function getDateRange(): { start: string; end: string } {
    const todayStr = today()

    if (period === 'week') {
      const [y, m, d] = todayStr.split('-').map(Number)
      const localNow = new Date(y, m - 1, d)
      const day = localNow.getDay()
      const diffToMonday = day === 0 ? -6 : 1 - day
      const monday = new Date(y, m - 1, d + diffToMonday)
      const year = monday.getFullYear()
      const month = String(monday.getMonth() + 1).padStart(2, '0')
      const date = String(monday.getDate()).padStart(2, '0')
      return { start: `${year}-${month}-${date}`, end: todayStr }
    }

    if (period === 'month') {
      const [y, m] = todayStr.split('-')
      return { start: `${y}-${m}-01`, end: todayStr }
    }

    return { start: customStart, end: customEnd }
  }

  async function loadSummary() {
    if (period === 'custom' && (!customStart || !customEnd)) return
    setLoading(true)
    try {
      const { start, end } = getDateRange()
      const data = await buyingPricesAPI.getSummary(start, end)
      setSummary(data.summary)
    } catch {
      toast.error('Failed to load profit summary')
    } finally {
      setLoading(false)
    }
  }

  function getProfitColor(profit: number): string {
    if (profit > 0) return 'text-green-600'
    if (profit < 0) return 'text-red-600'
    return 'text-gray-600'
  }

  function getProfitBg(profit: number): string {
    if (profit > 0) return 'bg-green-50 border-green-200'
    if (profit < 0) return 'bg-red-50 border-red-200'
    return 'bg-gray-50 border-gray-200'
  }

  function formatAmount(amount: number): string {
    return Math.round(amount).toLocaleString()
  }

  function formatDateSafe(dateStr: string): string {
    const clean = dateStr.split('T')[0]
    const [year, month, day] = clean.split('-').map(Number)
    return new Date(year, month - 1, day).toLocaleDateString('en-RW', {
      weekday: 'short', day: 'numeric', month: 'short',
    })
  }

  const periodLabels: Record<PeriodType, string> = {
    week: t('this_week', lang),
    month: t('this_month', lang),
    custom: t('custom_range', lang),
  }

  const noDataBlock = (
    <div className="card text-center py-8">
      <p className="text-gray-500">{t('no_data', lang)}</p>
      <p className="text-gray-400 text-sm mt-1">{t('no_data_sub', lang)}</p>
    </div>
  )
  
  const formatSoldQuantity = (
  pieces: number,
  piecesPerCase: number
) => {
  if (!piecesPerCase) return `${pieces} pcs`

  const fullCases = Math.floor(pieces / piecesPerCase)
  let remainingPieces = pieces % piecesPerCase
  const halfCase = piecesPerCase / 2

  let hasHalf = false

  if (remainingPieces >= halfCase) {
    hasHalf = true
    remainingPieces -= halfCase
  }

  const parts: string[] = []

    if (fullCases > 0) {
      parts.push(`${fullCases} ${fullCases === 1 ? 'case' : 'cases'}`)
    }

    if (hasHalf) {
      parts.push('1/2')
    }

    if (remainingPieces > 0) {
      parts.push(`${remainingPieces} pcs`)
    }

    return parts.join(' + ')
  }

  const supplierPerformance: SupplierPerformance[] = summary
  ? Object.values(
      summary.products.reduce<Record<string, SupplierPerformance>>(
        (suppliers, product) => {
          const key = product.supplier_id || product.supplier_name

          if (!suppliers[key]) {
            suppliers[key] = {
              supplier_id: product.supplier_id,
              supplier_name: product.supplier_name,
              products_count: 0,
              revenue: 0,
              buying_cost: 0,
              gross_profit: 0,
            }
          }

          suppliers[key].products_count += 1
          suppliers[key].revenue += product.revenue
          suppliers[key].buying_cost += product.buying_cost
          suppliers[key].gross_profit += product.gross_profit

          return suppliers
        },
        {}
      )
    ).sort((a, b) => b.gross_profit - a.gross_profit)
  : []

  return (
    <div>
      <div className="mb-6">
        <h1 className="page-title mb-1">{t('profit_title', lang)}</h1>
        {/* <p className="text-gray-500 text-sm">{t('profit_formula', lang)}</p> */}
      </div>

      {/* Period selector */}
      <div className="card mb-6">
        <div className="flex gap-2 mb-4 flex-wrap">
          {(['week', 'month', 'custom'] as PeriodType[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                period === p ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {periodLabels[p]}
            </button>
          ))}
        </div>

        {period === 'custom' && (
          <div className="flex gap-3 items-end flex-wrap">
            <div>
              <label className="label text-xs">{lang === 'rw' ? 'Kuva' : 'From'}</label>
              <input type="date" className="input text-base" value={customStart}
                onChange={e => setCustomStart(e.target.value)} max={today()} />
            </div>
            <div>
              <label className="label text-xs">{lang === 'rw' ? 'Kugeza' : 'To'}</label>
              <input type="date" className="input text-base" value={customEnd}
                onChange={e => setCustomEnd(e.target.value)} max={today()} />
            </div>
            <button onClick={loadSummary} className="btn-primary" disabled={!customStart || !customEnd}>
              {lang === 'rw' ? 'Reba' : 'Show'}
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="card animate-pulse h-20">
              <div className="h-3 bg-gray-200 rounded mb-2 w-2/3"></div>
              <div className="h-6 bg-gray-200 rounded w-full"></div>
            </div>
          ))}
        </div>
      ) : summary ? (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="card border-l-4 border-l-blue-500 p-3">
              <p className="text-xs text-gray-500 mb-1">{t('revenue', lang)}</p>
              <p className="text-base font-bold text-gray-900">{formatAmount(summary.total_revenue)}</p>
            </div>
            <div className="card border-l-4 border-l-red-400 p-3">
              <p className="text-xs text-gray-500 mb-1">{t('buying_cost', lang)}</p>
              <p className="text-base font-bold text-red-600">{formatAmount(summary.total_buying_cost)}</p>
            </div>
            <div className={`card border-2 p-3 ${getProfitBg(summary.total_profit)}`}>
              <p className="text-xs text-gray-500 mb-1">{t('real_profit', lang)}</p>
              <p className={`text-base font-bold ${getProfitColor(summary.total_profit)}`}>
                {summary.total_profit >= 0 ? '+' : ''}{formatAmount(summary.total_profit)}
              </p>
            </div>
          </div>

          {/* Daily breakdown */}
          {summary.daily.length > 0 ? (
            <div className="card mb-6">
              <div className="section-title">{t('daily_breakdown', lang)}</div>

              <div className="grid grid-cols-3 gap-2 px-1 mb-2">
                <p className="text-xs font-semibold text-gray-400 uppercase">
                  {lang === 'rw' ? 'Itariki' : 'Date'}
                </p>
                <p className="text-xs font-semibold text-gray-400 uppercase text-right">{t('revenue', lang)}</p>
                <p className="text-xs font-semibold text-gray-400 uppercase text-right">{t('real_profit', lang)}</p>
              </div>

              <div className="space-y-1">
                {summary.daily.map(day => (
                  <div key={day.date} className="grid grid-cols-3 gap-2 items-center py-2 border-b border-gray-100 last:border-0 px-1">
                    <div>
                      <p className="text-sm text-gray-800 font-medium">{formatDateSafe(day.date)}</p>
                      <div className="space-y-0.5">
                        {day.buying_cost > 0 && (
                          <p className="text-xs text-red-400">−{formatAmount(day.buying_cost)} {lang === 'rw' ? 'ikiranguzo' : 'cost'}</p>
                        )}
                        {day.surplus > 0 && (
                          <p className="text-xs text-green-500">+{formatAmount(day.surplus)} {t('surplus', lang)}</p>
                        )}
                        {day.deficit > 0 && (
                          <p className="text-xs text-orange-500">−{formatAmount(day.deficit)} {t('deficit', lang)}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-700">
                        {day.revenue > 0 ? formatAmount(day.revenue) : '—'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${getProfitColor(day.profit)}`}>
                        {day.profit !== 0
                          ? `${day.profit >= 0 ? '+' : ''}${formatAmount(day.profit)}`
                          : '—'}
                      </p>
                    </div>
                  </div>
                ))}

                <div className="grid grid-cols-3 gap-2 items-center pt-2 bg-gray-50 rounded-lg px-2 py-2 mt-1">
                  <p className="font-semibold text-gray-700 text-sm">{t('total', lang)}</p>
                  <p className="text-right font-semibold text-gray-900 text-sm">
                    {formatAmount(summary.total_revenue)}
                  </p>
                  <p className={`text-right font-bold text-sm ${getProfitColor(summary.total_profit)}`}>
                    {summary.total_profit >= 0 ? '+' : ''}{formatAmount(summary.total_profit)}
                  </p>
                </div>
              </div>
            </div>
          ) : noDataBlock}

          {/* Product Performance */}
          <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Product Performance
            </h2>

            {summary.products.length === 0 ? (
              <p className="text-gray-500 text-sm">
                No product sales found for this period.
              </p>
            ) : (
              <>
                {/* Desktop / Tablet */}
                <div className="hidden sm:block">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-gray-600">
                        <th className="py-3 pr-3">Product</th>
                        <th className="py-3 px-3">Supplier</th>
                        <th className="py-3 px-3 text-right">Sold</th>
                        <th className="py-3 pl-3 text-right">Gross Profit</th>
                      </tr>
                    </thead>

                    <tbody>
                      {summary.products.map((product) => (
                        <tr
                          key={product.product_id}
                          className="border-b last:border-b-0"
                        >
                          <td className="py-3 pr-3 font-medium text-gray-900">
                            {product.product_name}
                          </td>

                          <td className="py-3 px-3 text-gray-600">
                            {product.supplier_name}
                          </td>

                          <td className="py-3 px-3 text-right whitespace-nowrap">
                            {formatSoldQuantity(
                              product.quantity_sold_pieces,
                              product.pieces_per_casse
                            )}
                          </td>

                          <td className="py-3 pl-3 text-right font-medium whitespace-nowrap">
                            {formatRWF(product.gross_profit)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile */}
                <div className="sm:hidden divide-y">
                  {summary.products.map((product) => (
                    <div key={product.product_id} className="py-4 first:pt-0">
                      <div className="flex justify-between gap-3 mb-2">
                        <div>
                          <p className="font-medium text-gray-900">
                            {product.product_name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {product.supplier_name}
                          </p>
                        </div>

                        <p className="font-semibold text-gray-900 whitespace-nowrap">
                          {formatRWF(product.gross_profit)}
                        </p>
                      </div>

                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Sold</span>
                        <span className="font-medium text-gray-700">
                          {formatSoldQuantity(
                            product.quantity_sold_pieces,
                            product.pieces_per_casse
                          )}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Supplier Performance */}
          {supplierPerformance.length > 0 && (
            <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Supplier Performance
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {supplierPerformance.map((supplier) => (
                  <div
                    key={supplier.supplier_id || supplier.supplier_name}
                    className="border border-gray-200 rounded-lg p-4"
                  >
                    <div className="flex justify-between items-start gap-3 mb-3">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {supplier.supplier_name}
                        </p>

                        <p className="text-xs text-gray-500 mt-0.5">
                          {supplier.products_count}{' '}
                          {supplier.products_count === 1 ? 'product' : 'products'} sold
                        </p>
                      </div> 

                      <div className="text-right">
                        <p className="text-xs text-gray-500 mb-0.5">
                          Gross Profit
                        </p>
                        <p className="font-bold text-green-600">
                          {formatRWF(supplier.gross_profit)}
                        </p>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-gray-100 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Revenue</span>
                        <span className="font-medium text-gray-700">
                          {formatRWF(supplier.revenue)}
                        </span>
                      </div>

                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Buying Cost</span>
                        <span className="font-medium text-gray-700">
                          {formatRWF(supplier.buying_cost)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </>
      ) : noDataBlock}
    </div>
  )
}