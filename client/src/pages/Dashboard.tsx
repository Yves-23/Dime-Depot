import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { stockAPI, suppliersAPI, productsAPI, pricesAPI } from '../lib/api'
import type { Product, Supplier, Price } from '../lib/types'
import { stockToPieces, formatRWF, getPriceForDate, today, yesterday } from '../lib/helpers'
import { Link } from 'react-router-dom'

interface DailySummary {
  totalRevenue: number
  supplierRevenues: { supplier: Supplier; revenue: number }[]
  totalProductsSold: number
}

export default function Dashboard() {
  const { business } = useAuth()
  const [summary, setSummary] = useState<DailySummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [todayDate] = useState(today())
  const [hasEntryToday, setHasEntryToday] = useState(false)

  useEffect(() => {
    if (business) loadSummary()
  }, [business])

  async function loadSummary() {
    if (!business) return
    setLoading(true)

    try {
      const [
        productsData,
        suppliersData,
        pricesData,
        todayEntries,
        yesterdayEntries,
        receivedToday,
      ] = await Promise.all([
        productsAPI.getAll(),
        suppliersAPI.getAll(),
        pricesAPI.getAll(),
        stockAPI.getEntries(todayDate),
        stockAPI.getEntries(yesterday(todayDate)),
        stockAPI.getReceived(todayDate),
      ])

      const products: Product[] = productsData.products
      const suppliers: Supplier[] = suppliersData.suppliers
      const prices: Price[] = pricesData.prices
      const todayEntriesList = todayEntries.entries
      const yesterdayEntriesList = yesterdayEntries.entries
      const receivedList = receivedToday.received

      setHasEntryToday(todayEntriesList.length > 0)

      if (!todayEntriesList.length || !yesterdayEntriesList.length) {
        setSummary(null)
        setLoading(false)
        return
      }

      let totalRevenue = 0
      let totalProductsSold = 0
      const supplierRevenueMap: Record<string, number> = {}

      products.forEach(product => {
        const supplier = suppliers.find(s => s.id === product.supplier_id)
        const todayEntry = todayEntriesList.find((e: any) => e.product_id === product.id)
        const yesterdayEntry = yesterdayEntriesList.find((e: any) => e.product_id === product.id)
        const received = receivedList.find((r: any) => r.product_id === product.id)

        if (!todayEntry || !yesterdayEntry) return

        const yesterdayPieces = stockToPieces(yesterdayEntry.casses, yesterdayEntry.halves, yesterdayEntry.pieces, product.pieces_per_casse)
        const todayPieces = stockToPieces(todayEntry.casses, todayEntry.halves, todayEntry.pieces, product.pieces_per_casse)
        const receivedPieces = received
          ? stockToPieces(received.supplier_casses + received.return_casses, received.return_halves, received.return_pieces, product.pieces_per_casse)
          : 0

        const soldPieces = yesterdayPieces + receivedPieces - todayPieces
        if (soldPieces <= 0) return

        const price = getPriceForDate(prices, product.id, todayDate)
        const revenue = (soldPieces / product.pieces_per_casse) * price

        totalRevenue += revenue
        totalProductsSold++

        if (supplier) {
          supplierRevenueMap[supplier.id] = (supplierRevenueMap[supplier.id] || 0) + revenue
        }
      })

      const supplierRevenues = suppliers
        .filter(s => supplierRevenueMap[s.id] !== undefined)
        .map(s => ({ supplier: s, revenue: supplierRevenueMap[s.id] }))

      setSummary({ totalRevenue, supplierRevenues, totalProductsSold })
    } catch (error) {
      console.error('Dashboard error:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Good {getTimeOfDay()}, {business?.owner_name?.split(' ')[0]}! 👋
        </h1>
        <p className="text-gray-500 mt-1">{formatDate(todayDate)} — {business?.business_name}</p>
      </div>

      {!business?.is_active && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
          <p className="text-yellow-800 font-medium">⚠️ Your account is pending activation</p>
          <p className="text-yellow-700 text-sm mt-1">Contact us to activate your account.</p>
        </div>
      )}

      {/* No entry today warning */}
      {!loading && !hasEntryToday && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-orange-800 font-medium text-sm">📋 No entry for today yet</p>
            <p className="text-orange-600 text-xs mt-0.5">Don't forget to enter your closing stock this evening.</p>
          </div>
          <Link to="/daily-entry" className="btn-primary text-sm shrink-0">
            Enter now
          </Link>
        </div>
      )}

      {/* Today's summary */}
      {summary && (
        <div className="card mb-6 bg-gradient-to-br from-blue-600 to-blue-700 text-white">
          <p className="text-blue-100 text-xs font-semibold uppercase tracking-wide mb-3">Today's Revenue</p>
          <p className="text-3xl font-bold mb-3">{formatRWF(summary.totalRevenue)}</p>
          <div className="flex flex-wrap gap-3">
            {summary.supplierRevenues.map(({ supplier, revenue }) => (
              <div key={supplier.id} className="bg-white/15 rounded-lg px-3 py-1.5">
                <p className="text-xs text-blue-100">{supplier.name}</p>
                <p className="text-sm font-semibold">{formatRWF(revenue)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="section-title">Quick actions</div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">

        <Link to="/daily-entry" className="card hover:shadow-md transition-shadow cursor-pointer text-center">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-3">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-900">Daily Entry</p>
          <p className="text-xs text-gray-500 mt-1">Enter tonight's stock</p>
        </Link>

        <Link to="/reports" className="card hover:shadow-md transition-shadow cursor-pointer text-center">
          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-3">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-900">Reports</p>
          <p className="text-xs text-gray-500 mt-1">View sales & revenue</p>
        </Link>

        <Link to="/profit" className="card hover:shadow-md transition-shadow cursor-pointer text-center">
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center mx-auto mb-3">
            <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-900">Profit</p>
          <p className="text-xs text-gray-500 mt-1">View profit reports</p>
        </Link>

        <Link to="/products" className="card hover:shadow-md transition-shadow cursor-pointer text-center">
          <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-3">
            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-900">Products</p>
          <p className="text-xs text-gray-500 mt-1">Manage your products</p>
        </Link>

        <Link to="/prices" className="card hover:shadow-md transition-shadow cursor-pointer text-center">
          <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center mx-auto mb-3">
            <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-900">Prices</p>
          <p className="text-xs text-gray-500 mt-1">Update product prices</p>
        </Link>

        <Link to="/unpaid-debts" className="card hover:shadow-md transition-shadow cursor-pointer text-center">
          <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center mx-auto mb-3">
            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-900">Unpaid Debts</p>
          <p className="text-xs text-gray-500 mt-1">Track outstanding debts</p>
        </Link>

      </div>
    </div>
  )
}

function getTimeOfDay(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'morning'
  if (hour < 17) return 'afternoon'
  return 'evening'
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-RW', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}