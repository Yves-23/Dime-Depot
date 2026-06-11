import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { buyingPricesAPI } from '../lib/api'
import { formatRWF, today } from '../lib/helpers'
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
}

export default function Profit() {
  const { business } = useAuth()
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
    } catch (error) {
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

  function formatDateRangeSafe(dateStr: string): string {
    const clean = dateStr.split('T')[0]
    const [year, month, day] = clean.split('-').map(Number)
    return new Date(year, month - 1, day).toLocaleDateString('en-RW', {
      day: 'numeric', month: 'short', year: 'numeric',
    })
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="page-title mb-1">Profit Report</h1>
        <p className="text-gray-500 text-sm">
          Real profit = (Revenue − Buying cost) + Surplus − Deficit
        </p>
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
              {p === 'week' ? 'This week' : p === 'month' ? 'This month' : 'Custom range'}
            </button>
          ))}
        </div>

        {period === 'custom' && (
          <div className="flex gap-3 items-end flex-wrap">
            <div>
              <label className="label text-xs">From</label>
              <input type="date" className="input text-base" value={customStart}
                onChange={e => setCustomStart(e.target.value)} max={today()} />
            </div>
            <div>
              <label className="label text-xs">To</label>
              <input type="date" className="input text-base" value={customEnd}
                onChange={e => setCustomEnd(e.target.value)} max={today()} />
            </div>
            <button onClick={loadSummary} className="btn-primary"
              disabled={!customStart || !customEnd}>
              Show
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
              <p className="text-xs text-gray-500 mb-1">Revenue</p>
              <p className="text-base font-bold text-gray-900">{formatAmount(summary.total_revenue)}</p>
            </div>
            <div className="card border-l-4 border-l-red-400 p-3">
              <p className="text-xs text-gray-500 mb-1">Buying Cost</p>
              <p className="text-base font-bold text-red-600">{formatAmount(summary.total_buying_cost)}</p>
            </div>
            <div className={`card border-2 p-3 ${getProfitBg(summary.total_profit)}`}>
              <p className="text-xs text-gray-500 mb-1">Real Profit</p>
              <p className={`text-base font-bold ${getProfitColor(summary.total_profit)}`}>
                {summary.total_profit >= 0 ? '+' : ''}{formatAmount(summary.total_profit)}
              </p>
            </div>
          </div>         

          {/* Daily breakdown */}
          {summary.daily.length > 0 ? (
            <div className="card">
              <div className="section-title">Daily breakdown</div>

              <div className="grid grid-cols-3 gap-2 px-1 mb-2">
                <p className="text-xs font-semibold text-gray-400 uppercase">Date</p>
                <p className="text-xs font-semibold text-gray-400 uppercase text-right">Revenue</p>
                <p className="text-xs font-semibold text-gray-400 uppercase text-right">Profit</p>
              </div>

              <div className="space-y-1">
                {summary.daily.map(day => (
                  <div key={day.date} className="grid grid-cols-3 gap-2 items-center py-2 border-b border-gray-100 last:border-0 px-1">
                    <div>
                      <p className="text-sm text-gray-800 font-medium">{formatDateSafe(day.date)}</p>
                      <div className="space-y-0.5">
                        {day.buying_cost > 0 && (
                          <p className="text-xs text-red-400">−{formatAmount(day.buying_cost)} cost</p>
                        )}
                        {day.surplus > 0 && (
                          <p className="text-xs text-green-500">+{formatAmount(day.surplus)} surplus</p>
                        )}
                        {day.deficit > 0 && (
                          <p className="text-xs text-orange-500">−{formatAmount(day.deficit)} deficit</p>
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
                  <p className="font-semibold text-gray-700 text-sm">Total</p>
                  <p className="text-right font-semibold text-gray-900 text-sm">
                    {formatAmount(summary.total_revenue)}
                  </p>
                  <p className={`text-right font-bold text-sm ${getProfitColor(summary.total_profit)}`}>
                    {summary.total_profit >= 0 ? '+' : ''}{formatAmount(summary.total_profit)}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="card text-center py-8">
              <p className="text-gray-500">No data found for this period.</p>
              <p className="text-gray-400 text-sm mt-1">Make sure you have daily entries and buying prices set.</p>
            </div>
          )}
        </>
      ) : (
        <div className="card text-center py-8">
          <p className="text-gray-500">No data found for this period.</p>
          <p className="text-gray-400 text-sm mt-1">Make sure you have daily entries and buying prices set.</p>
        </div>
      )}
    </div>
  )
}