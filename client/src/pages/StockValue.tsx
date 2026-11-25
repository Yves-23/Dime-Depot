
import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { stockAPI } from '../lib/api'
import { formatRWF } from '../lib/helpers'

interface StockProduct {
  product_id: string
  product_name: string
  supplier_name: string | null
  pieces_per_casse: number
  entry_date: string
  casses: number
  halves: number
  pieces: number
  stock_pieces: number
  price_per_casse: number | null
  stock_value: number | null
  selling_price: number | null
  expected_revenue: number | null
  expected_profit: number | null
}

interface SupplierSummary {
  name: string
  products: StockProduct[]
  totalValue: number
  totalProducts: number
  missingPrices: number
  totalExpectedRevenue: number
  totalExpectedProfit: number
  missingSellingPrices: number
  missingProfitPrices: number
}

// Round calculated RWF amounts up to the next 50.
function roundRWF(amount: number): number {
  return Math.ceil(amount / 50) * 50
}

function getRoundedStockValue(product: StockProduct): number | null {
  if (product.price_per_casse === null || product.stock_value === null) {
    return null
  }

  return roundRWF(Number(product.stock_value))
}

function getRoundedExpectedRevenue(product: StockProduct): number | null {
  if (product.selling_price === null || product.expected_revenue === null) {
    return null
  }

  return roundRWF(Number(product.expected_revenue))
}

function getExpectedProfit(product: StockProduct): number | null {
  const stockValue = getRoundedStockValue(product)
  const expectedRevenue = getRoundedExpectedRevenue(product)

  if (stockValue === null || expectedRevenue === null) {
    return null
  }

  return expectedRevenue - stockValue
}

export default function StockValue() {
  const { business } = useAuth()

  const [products, setProducts] = useState<StockProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (business) {
      loadStockValue()
    }
  }, [business])

  async function loadStockValue() {
    setLoading(true)
    setError('')

    try {
      const data = await stockAPI.getCurrentValue()
      setProducts(data.products || [])
    } catch (err) {
      console.error('Stock value error:', err)
      setError('Unable to load current stock value. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const getSupplierSummary = (supplierName: string): SupplierSummary => {
    const supplierProducts = products.filter(
      product => product.supplier_name?.trim().toUpperCase() === supplierName
    )

    const totalValue = supplierProducts.reduce(
      (sum, product) => sum + (getRoundedStockValue(product) ?? 0),
      0
    )

    const totalExpectedRevenue = supplierProducts.reduce(
      (sum, product) => sum + (getRoundedExpectedRevenue(product) ?? 0),
      0
    )

    const totalExpectedProfit = supplierProducts.reduce(
      (sum, product) => sum + (getExpectedProfit(product) ?? 0),
      0
    )

    return {
      name: supplierName,
      products: supplierProducts,
      totalValue,
      totalProducts: supplierProducts.length,

      missingPrices: supplierProducts.filter(
        product =>
          product.price_per_casse === null ||
          product.stock_value === null
      ).length,

      totalExpectedRevenue,
      totalExpectedProfit,

      missingSellingPrices: supplierProducts.filter(
        product =>
          product.selling_price === null ||
          product.expected_revenue === null
      ).length,

      missingProfitPrices: supplierProducts.filter(
        product => getExpectedProfit(product) === null
      ).length,
    }
  }

  const bralirwa = getSupplierSummary('BRALIRWA')
  const skol = getSupplierSummary('SKOL')

  const totalValue = bralirwa.totalValue + skol.totalValue
  const totalExpectedRevenue =
    bralirwa.totalExpectedRevenue + skol.totalExpectedRevenue
  const totalExpectedProfit =
    bralirwa.totalExpectedProfit + skol.totalExpectedProfit

  const missingPrices = bralirwa.missingPrices + skol.missingPrices
  const missingSellingPrices =
    bralirwa.missingSellingPrices + skol.missingSellingPrices
  const missingProfitPrices =
    bralirwa.missingProfitPrices + skol.missingProfitPrices

  function formatStock(product: StockProduct) {
    const crates = Number(product.casses) || 0
    const halves = Number(product.halves) || 0
    const pieces = Number(product.pieces) || 0

    return [
      crates > 0 ? `${crates} crates` : '',
      halves > 0 ? `${halves} halves` : '',
      pieces > 0 ? `${pieces} pieces` : '',
    ].filter(Boolean).join(', ') || '0'
  }

  function formatEntryDate(date: string) {
    return new Date(date).toLocaleDateString('en-RW', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  function renderSupplierSection(summary: SupplierSummary) {
    return (
      <div className="card mb-5">
        {/* Supplier heading and summary */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {summary.name}
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              {summary.totalProducts} products in stock
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:gap-6">
            <div className="text-left sm:text-right">
              <p className="text-xs text-gray-500 mb-1">Stock value</p>
              <p className="text-lg font-bold text-gray-900">
                {formatRWF(summary.totalValue)}
              </p>
            </div>

            <div className="text-left sm:text-right">
              <p className="text-xs text-gray-500 mb-1">Expected profit</p>
              <p className="text-lg font-bold text-emerald-700">
                {formatRWF(summary.totalExpectedProfit)}
              </p>
            </div>
          </div>
        </div>

        {/* Missing buying price warning */}
        {summary.missingPrices > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-3">
            <p className="text-sm text-yellow-800">
              {summary.missingPrices} product(s) have no applicable buying
              price. Their stock value is excluded from the total.
            </p>
          </div>
        )}

        {/* Missing selling price warning */}
        {summary.missingSellingPrices > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-3">
            <p className="text-sm text-yellow-800">
              {summary.missingSellingPrices} product(s) have no applicable
              selling price. Their expected revenue cannot be calculated.
            </p>
          </div>
        )}

        {/* Expected profit warning */}
        {summary.missingProfitPrices > 0 && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-gray-600">
              Expected profit is unavailable for {summary.missingProfitPrices}
              {' '}product(s) because a buying or selling price is missing.
            </p>
          </div>
        )}

        {summary.products.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">
            No recorded stock for this supplier.
          </p>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-gray-500 text-left">
                    <th className="py-3 pr-3 font-medium">Product</th>
                    <th className="py-3 px-3 font-medium">Remaining stock</th>
                    <th className="py-3 px-3 font-medium">Buying / crate</th>
                    <th className="py-3 px-3 font-medium">Selling / crate</th>
                    <th className="py-3 px-3 font-medium">Last stock entry</th>
                    <th className="py-3 px-3 font-medium text-right">Stock value</th>
                    <th className="py-3 pl-3 font-medium text-right">Expected revenue</th>
                    <th className="py-3 pl-3 font-medium text-right">Expected profit</th>
                  </tr>
                </thead>

                <tbody>
                  {summary.products.map(product => {
                    const stockValue = getRoundedStockValue(product)
                    const expectedRevenue = getRoundedExpectedRevenue(product)
                    const expectedProfit = getExpectedProfit(product)

                    return (
                      <tr
                        key={product.product_id}
                        className="border-b last:border-0"
                      >
                        <td className="py-3 pr-3 font-medium text-gray-900">
                          {product.product_name}
                        </td>

                        <td className="py-3 px-3 text-gray-600">
                          {formatStock(product)}
                        </td>

                        <td className="py-3 px-3 text-gray-600">
                          {product.price_per_casse !== null
                            ? formatRWF(Number(product.price_per_casse))
                            : <span className="text-yellow-600">Missing</span>}
                        </td>

                        <td className="py-3 px-3 text-gray-600">
                          {product.selling_price !== null
                            ? formatRWF(Number(product.selling_price))
                            : <span className="text-yellow-600">Missing</span>}
                        </td>

                        <td className="py-3 px-3 text-gray-500 whitespace-nowrap">
                          {formatEntryDate(product.entry_date)}
                        </td>

                        <td className="py-3 px-3 text-right font-semibold text-gray-900 whitespace-nowrap">
                          {stockValue !== null
                            ? formatRWF(stockValue)
                            : <span className="text-yellow-600">N/A</span>}
                        </td>

                        <td className="py-3 pl-3 text-right font-semibold text-gray-900 whitespace-nowrap">
                          {expectedRevenue !== null
                            ? formatRWF(expectedRevenue)
                            : <span className="text-yellow-600">N/A</span>}
                        </td>

                        <td className="py-3 pl-3 text-right font-semibold text-emerald-700 whitespace-nowrap">
                          {expectedProfit !== null
                            ? formatRWF(expectedProfit)
                            : <span className="text-yellow-600">N/A</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile product cards */}
            <div className="md:hidden space-y-3">
              {summary.products.map(product => {
                const stockValue = getRoundedStockValue(product)
                const expectedRevenue = getRoundedExpectedRevenue(product)
                const expectedProfit = getExpectedProfit(product)

                return (
                  <div
                    key={product.product_id}
                    className="border border-gray-100 rounded-lg p-3"
                  >
                    <div className="flex justify-between gap-3">
                      <p className="font-semibold text-gray-900">
                        {product.product_name}
                      </p>

                      <p className="text-sm font-bold text-gray-900 text-right">
                        {stockValue !== null
                          ? formatRWF(stockValue)
                          : 'N/A'}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-3 text-xs">
                      <div>
                        <p className="text-gray-400">Remaining stock</p>
                        <p className="text-gray-700 mt-1">
                          {formatStock(product)}
                        </p>
                      </div>

                      <div>
                        <p className="text-gray-400">Buying price / crate</p>
                        <p className="text-gray-700 mt-1">
                          {product.price_per_casse !== null
                            ? formatRWF(Number(product.price_per_casse))
                            : 'Missing'}
                        </p>
                      </div>

                      <div>
                        <p className="text-gray-400">Selling price / crate</p>
                        <p className="text-gray-700 mt-1">
                          {product.selling_price !== null
                            ? formatRWF(Number(product.selling_price))
                            : 'Missing'}
                        </p>
                      </div>

                      <div>
                        <p className="text-gray-400">Expected revenue</p>
                        <p className="text-gray-700 mt-1 font-medium">
                          {expectedRevenue !== null
                            ? formatRWF(expectedRevenue)
                            : 'N/A'}
                        </p>
                      </div>

                      <div>
                        <p className="text-gray-400">Expected profit</p>
                        <p className="text-emerald-700 mt-1 font-semibold">
                          {expectedProfit !== null
                            ? formatRWF(expectedProfit)
                            : 'N/A'}
                        </p>
                      </div>

                      <div>
                        <p className="text-gray-400">Last stock entry</p>
                        <p className="text-gray-700 mt-1">
                          {formatEntryDate(product.entry_date)}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div>
      {/* Page heading */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Current Stock Value
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Value and expected returns from your remaining inventory
          </p>
        </div>

        <button
          onClick={loadStockValue}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-5">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="card text-center py-12">
          <p className="text-gray-500">
            Calculating current stock value...
          </p>
        </div>
      ) : (
        <>
          {/* Overall summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
            <div className="card">
              <p className="text-sm text-gray-500 mb-2">
                Current Stock Value
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {formatRWF(totalValue)}
              </p>
              <p className="text-xs text-gray-400 mt-2">
                Cost of remaining inventory
              </p>
            </div>

            <div className="card">
              <p className="text-sm text-gray-500 mb-2">
                Expected Revenue
              </p>
              <p className="text-2xl font-bold text-blue-700">
                {formatRWF(totalExpectedRevenue)}
              </p>
              <p className="text-xs text-gray-400 mt-2">
                If all recorded stock is sold
              </p>
            </div>

            <div className="card">
              <p className="text-sm text-gray-500 mb-2">
                Expected Gross Profit
              </p>
              <p className="text-2xl font-bold text-emerald-700">
                {formatRWF(totalExpectedProfit)}
              </p>
              <p className="text-xs text-gray-400 mt-2">
                Expected revenue minus stock value
              </p>
            </div>
          </div>

          {/* Missing price overview */}
          {(missingPrices > 0 || missingSellingPrices > 0) && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-5">
              <p className="text-sm text-yellow-800">
                Some product values may be excluded because of missing prices.
                {missingPrices > 0 && (
                  <> {missingPrices} product(s) have no applicable buying price.</>
                )}
                {missingSellingPrices > 0 && (
                  <> {missingSellingPrices} product(s) have no applicable selling price.</>
                )}
              </p>
            </div>
          )}

          {/* Supplier summaries */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            <div className="card">
              <p className="text-xs text-gray-500 font-semibold uppercase">
                BRALIRWA
              </p>

              <p className="text-xl font-bold text-gray-900 mt-2">
                {formatRWF(bralirwa.totalValue)}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Stock value · {bralirwa.totalProducts} products
              </p>

              <div className="border-t border-gray-100 mt-3 pt-3">
                <p className="text-xs text-gray-500">
                  Expected gross profit
                </p>
                <p className="text-lg font-bold text-emerald-700 mt-1">
                  {formatRWF(bralirwa.totalExpectedProfit)}
                </p>
              </div>
            </div>

            <div className="card">
              <p className="text-xs text-gray-500 font-semibold uppercase">
                SKOL
              </p>

              <p className="text-xl font-bold text-gray-900 mt-2">
                {formatRWF(skol.totalValue)}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Stock value · {skol.totalProducts} products
              </p>

              <div className="border-t border-gray-100 mt-3 pt-3">
                <p className="text-xs text-gray-500">
                  Expected gross profit
                </p>
                <p className="text-lg font-bold text-emerald-700 mt-1">
                  {formatRWF(skol.totalExpectedProfit)}
                </p>
              </div>
            </div>
          </div>

          {/* Product breakdowns */}
          {renderSupplierSection(bralirwa)}
          {renderSupplierSection(skol)}

          {/* Explanation */}
          <div className="text-xs text-gray-400 text-center mt-4 space-y-1">
            <p>
              Valuation uses the latest recorded stock entry and the latest
              applicable buying and selling prices for each product.
            </p>
            <p>
              Expected gross profit assumes all remaining stock is sold at
              the current applicable selling price. It does not include
              operating expenses or other business costs.
            </p>
            <p>
              Calculated RWF amounts are rounded up to the next 50 RWF.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
