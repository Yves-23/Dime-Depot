
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
}

interface SupplierSummary {
  name: string
  products: StockProduct[]
  totalValue: number
  totalProducts: number
  missingPrices: number
}

export default function StockValue() {
  const { business } = useAuth()

  const [products, setProducts] = useState<StockProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (business) loadStockValue()
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

    return {
      name: supplierName,
      products: supplierProducts,
      totalValue: supplierProducts.reduce(
        (sum, product) => sum + (Number(product.stock_value) || 0),
        0
      ),
      totalProducts: supplierProducts.length,
      missingPrices: supplierProducts.filter(
        product => product.stock_value === null || product.price_per_casse === null
      ).length,
    }
  }

  const bralirwa = getSupplierSummary('BRALIRWA')
  const skol = getSupplierSummary('SKOL')

  const totalValue = bralirwa.totalValue + skol.totalValue
  const missingPrices = bralirwa.missingPrices + skol.missingPrices

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
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{summary.name}</h2>
            <p className="text-xs text-gray-500 mt-1">
              {summary.totalProducts} products in stock
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500 mb-1">Stock value</p>
            <p className="text-lg font-bold text-emerald-700">
              {formatRWF(summary.totalValue)}
            </p>
          </div>
        </div>

        {summary.missingPrices > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-yellow-800">
              {summary.missingPrices} product(s) have no applicable buying price.
              Their value is excluded from this total.
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
                    <th className="py-3 px-3 font-medium">Buying price / crate</th>
                    <th className="py-3 px-3 font-medium">Last stock entry</th>
                    <th className="py-3 pl-3 font-medium text-right">Stock value</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.products.map(product => (
                    <tr key={product.product_id} className="border-b last:border-0">
                      <td className="py-3 pr-3 font-medium text-gray-900">
                        {product.product_name}
                      </td>
                      <td className="py-3 px-3 text-gray-600">
                        {formatStock(product)}
                      </td>
                      <td className="py-3 px-3 text-gray-600">
                        {product.price_per_casse !== null
                          ? formatRWF(Number(product.price_per_casse))
                          : <span className="text-yellow-600">Missing price</span>}
                      </td>
                      <td className="py-3 px-3 text-gray-500">
                        {formatEntryDate(product.entry_date)}
                      </td>
                      <td className="py-3 pl-3 text-right font-semibold text-gray-900">
                        {product.stock_value !== null
                          ? formatRWF(Number(product.stock_value))
                          : <span className="text-yellow-600">Not available</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {summary.products.map(product => (
                <div
                  key={product.product_id}
                  className="border border-gray-100 rounded-lg p-3"
                >
                  <div className="flex justify-between gap-3">
                    <p className="font-semibold text-gray-900">
                      {product.product_name}
                    </p>
                    <p className="text-sm font-bold text-gray-900 text-right">
                      {product.stock_value !== null
                        ? formatRWF(Number(product.stock_value))
                        : 'Not available'}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                    <div>
                      <p className="text-gray-400">Remaining stock</p>
                      <p className="text-gray-700 mt-1">{formatStock(product)}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Buying price / crate</p>
                      <p className="text-gray-700 mt-1">
                        {product.price_per_casse !== null
                          ? formatRWF(Number(product.price_per_casse))
                          : 'Missing price'}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-gray-400">Last stock entry</p>
                      <p className="text-gray-700 mt-1">
                        {formatEntryDate(product.entry_date)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Current Stock Value</h1>
          <p className="text-sm text-gray-500 mt-1">
            Value of your latest recorded inventory
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

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-5">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="card text-center py-12">
          <p className="text-gray-500">Calculating current stock value...</p>
        </div>
      ) : (
        <>
          <div className="card mb-5">
            <p className="text-sm text-gray-500 mb-2">Total Stock Value</p>
            <p className="text-3xl font-bold text-gray-900">
              {formatRWF(totalValue)}
            </p>
            <p className="text-xs text-gray-400 mt-2">
              Combined value of BRALIRWA and SKOL inventory
            </p>
            {missingPrices > 0 && (
              <p className="text-xs text-yellow-700 mt-3">
                {missingPrices} product(s) excluded because they have no applicable buying price.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 mb-5">
            <div className="card">
              <p className="text-xs text-gray-500 font-semibold uppercase">BRALIRWA</p>
              <p className="text-xl font-bold text-emerald-700 mt-2">
                {formatRWF(bralirwa.totalValue)}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {bralirwa.totalProducts} products
              </p>
            </div>

            <div className="card">
              <p className="text-xs text-gray-500 font-semibold uppercase">SKOL</p>
              <p className="text-xl font-bold text-blue-700 mt-2">
                {formatRWF(skol.totalValue)}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {skol.totalProducts} products
              </p>
            </div>
          </div>

          {renderSupplierSection(bralirwa)}
          {renderSupplierSection(skol)}

          <p className="text-xs text-gray-400 text-center mt-4">
            Valuation uses the latest recorded stock entry and the latest applicable buying price for each product.
          </p>
        </>
      )}
    </div>
  )
}
