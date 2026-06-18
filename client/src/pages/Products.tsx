import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { suppliersAPI, productsAPI } from '../lib/api'
import type { Product, Supplier } from '../lib/types'
import toast from 'react-hot-toast'

export default function Products() {
  const { business } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddProduct, setShowAddProduct] = useState<string | null>(null)
  const [showAddSupplier, setShowAddSupplier] = useState(false)
  const [newSupplierName, setNewSupplierName] = useState('')
  const [newProduct, setNewProduct] = useState({
    name: '',
    supplier_id: '',
    pieces_per_casse: '',
  })
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [confirmToggle, setConfirmToggle] = useState<Product | null>(null)

  useEffect(() => {
    if (business) loadData()
  }, [business])

  async function loadData() {
    setLoading(true)
    try {
      const [productsData, suppliersData] = await Promise.all([
        productsAPI.getAll(),
        suppliersAPI.getAll(),
      ])
      setProducts(productsData.products)
      setSuppliers(suppliersData.suppliers)
    } catch (error) {
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  async function addSupplier() {
    if (!newSupplierName.trim()) return
    try {
      await suppliersAPI.create(newSupplierName.trim())
      toast.success('Supplier added!')
      setNewSupplierName('')
      setShowAddSupplier(false)
      loadData()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to add supplier')
    }
  }

  async function addProduct() {
    if (!newProduct.name.trim() || !newProduct.supplier_id || !newProduct.pieces_per_casse) {
      toast.error('Please fill in all fields')
      return
    }
    try {
      await productsAPI.create({
        supplier_id: newProduct.supplier_id,
        name: newProduct.name.trim(),
        pieces_per_casse: parseInt(newProduct.pieces_per_casse),
      })
      toast.success('Product added!')
      setNewProduct({ name: '', supplier_id: '', pieces_per_casse: '' })
      setShowAddProduct(null)
      loadData()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to add product')
    }
  }

  async function confirmToggleProduct() {
    if (!confirmToggle) return
    try {
      await productsAPI.toggle(confirmToggle.id)
      toast.success(confirmToggle.is_active ? 'Product deactivated' : 'Product activated')
      loadData()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to update product')
    }
    setConfirmToggle(null)
  }

  async function confirmDeleteSupplier() {
    if (!confirmDelete) return
    try {
      await suppliersAPI.delete(confirmDelete)
      toast.success('Supplier deleted')
      loadData()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete supplier')
    }
    setConfirmDelete(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading products...</div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="page-title mb-0">Products</h1>
      </div>

      {/* Add supplier modal */}
      {showAddSupplier && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-semibold mb-4">Add supplier</h2>
            <div className="mb-4">
              <label className="label">Supplier name</label>
              <input
                type="text"
                className="input"
                placeholder="e.g. Skol, Bralirwa"
                value={newSupplierName}
                onChange={e => setNewSupplierName(e.target.value)}
              />
            </div>
            <div className="flex gap-3">
              <button onClick={addSupplier} className="btn-primary flex-1">Add supplier</button>
              <button onClick={() => setShowAddSupplier(false)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Add product modal */}
      {showAddProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-semibold mb-1">Add product</h2>
            <p className="text-sm text-gray-500 mb-4">
              Adding to: <span className="font-medium text-gray-700">{suppliers.find(s => s.id === showAddProduct)?.name}</span>
            </p>
            <div className="space-y-4">
              <div>
                <label className="label">Product name</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Skol nini"
                  value={newProduct.name}
                  onChange={e => setNewProduct({ ...newProduct, name: e.target.value, supplier_id: showAddProduct })}
                />
              </div>
              <div>
                <label className="label">Pieces per full casse</label>
                <input
                  type="number"
                  className="input"
                  placeholder="e.g. 12, 20, 24"
                  value={newProduct.pieces_per_casse}
                  onChange={e => setNewProduct({ ...newProduct, pieces_per_casse: e.target.value })}
                />
                <p className="text-xs text-gray-500 mt-1">
                  1/2 casse will automatically be {newProduct.pieces_per_casse ? parseInt(newProduct.pieces_per_casse) / 2 : '?'} pieces
                </p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={addProduct} className="btn-primary flex-1">Add product</button>
              <button onClick={() => { setShowAddProduct(null); setNewProduct({ name: '', supplier_id: '', pieces_per_casse: '' }) }} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete supplier modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Delete supplier?</h2>
            </div>
            <p className="text-gray-500 text-sm mb-6">
              This will permanently delete this supplier. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={confirmDeleteSupplier} className="btn-danger flex-1">Yes, delete</button>
              <button onClick={() => setConfirmDelete(null)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm toggle product modal */}
      {confirmToggle && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${confirmToggle.is_active ? 'bg-red-100' : 'bg-green-100'}`}>
                <svg className={`w-5 h-5 ${confirmToggle.is_active ? 'text-red-600' : 'text-green-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900">
                {confirmToggle.is_active ? 'Deactivate' : 'Activate'} {confirmToggle.name}?
              </h2>
            </div>
            <p className="text-gray-500 text-sm mb-6">
              {confirmToggle.is_active
                ? 'Deactivating this product will hide it from daily entry and reports.'
                : 'Activating this product will make it visible again in daily entry and reports.'}
            </p>
            <div className="flex gap-3">
              <button
                onClick={confirmToggleProduct}
                className={confirmToggle.is_active ? 'btn-danger flex-1' : 'btn-primary flex-1'}
              >
                Yes, {confirmToggle.is_active ? 'deactivate' : 'activate'}
              </button>
              <button onClick={() => setConfirmToggle(null)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Suppliers section */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-800">Suppliers ({suppliers.length})</h3>
          <button
            onClick={() => setShowAddSupplier(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors text-sm"
          >
            + Add supplier
          </button>
        </div>
        {suppliers.length === 0 ? (
          <div className="card text-center py-6">
            <p className="text-gray-500 text-sm">No suppliers yet.</p>
            <button onClick={() => setShowAddSupplier(true)} className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors text-sm mt-3">
              Add your first supplier
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {suppliers.map(supplier => (
              <div key={supplier.id} className="flex items-center justify-between py-3 px-4 bg-white border border-gray-200 rounded-xl shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{supplier.name}</p>
                    <p className="text-xs text-gray-500">{products.filter(p => p.supplier_id === supplier.id).length} products</p>
                  </div>
                </div>
                <button onClick={() => setConfirmDelete(supplier.id)} className="text-red-400 hover:text-red-600 text-sm font-medium transition-colors">
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Products by supplier */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {suppliers.map(supplier => {
          const supplierProducts = products.filter(p => p.supplier_id === supplier.id)
          return (
            <div key={supplier.id} className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">{supplier.name}</h3>
                <button
                  onClick={() => { setShowAddProduct(supplier.id); setNewProduct({ name: '', supplier_id: supplier.id, pieces_per_casse: '' }) }}
                  className="btn-primary text-sm"
                >
                  + Add product
                </button>
              </div>
              {supplierProducts.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">No products yet for this supplier.</p>
              ) : (
                <div className="space-y-2">
                  {supplierProducts.map(product => (
                    <div key={product.id} className="flex items-center justify-between py-3 px-3 bg-gray-50 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{product.name}</p>
                        <p className="text-xs text-gray-500">{product.pieces_per_casse} pcs/casse · 1/2 = {product.pieces_per_casse / 2} pcs</p>
                      </div>
                      <div className="flex items-center gap-3 ml-3 shrink-0">
                        {product.is_active ? (
                          <span className="badge-active">Active</span>
                        ) : (
                          <span className="badge-inactive">Inactive</span>
                        )}
                        <button
                          onClick={() => setConfirmToggle(product)}
                          className={`text-sm font-medium ${product.is_active ? 'text-red-600 hover:text-red-800' : 'text-green-600 hover:text-green-800'}`}
                        >
                          {product.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {suppliers.length === 0 && (
        <div className="card text-center py-8">
          <p className="text-gray-500">No suppliers yet.</p>
          <p className="text-gray-400 text-sm mt-1">Add a supplier first, then add products under it.</p>
          <button onClick={() => setShowAddSupplier(true)} className="btn-primary mt-3 text-sm">
            Add your first supplier
          </button>
        </div>
      )}
    </div>
  )
}