import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Login from './pages/Login'
import Register from './pages/Register'
import ResetPin from './pages/ResetPin'
import Pending from './pages/Pending'
import Dashboard from './pages/Dashboard'
import DailyEntry from './pages/DailyEntry'
import Reports from './pages/Reports'
import Products from './pages/Products'
import Prices from './pages/Prices'
import Profit from './pages/Profit'
import Layout from './components/Layout'
import AdminLayout from './components/AdminLayout'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminBusinesses from './pages/admin/AdminBusinesses'
import AdminSettings from './pages/admin/AdminSettings'
import UnpaidDebts from './pages/UnpaidDebts'


function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { business, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-xl font-bold">D</span>
          </div>
          <p className="text-gray-500">Loading Dime-Depot...</p>
        </div>
      </div>
    )
  }

  if (!business) return <Navigate to="/login" replace />
  if (!business.is_active && !business.is_admin) return <Navigate to="/pending" replace />

  return <Layout>{children}</Layout>
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { business, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-purple-50">
        <div className="text-center">
          <div className="w-12 h-12 bg-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-xl font-bold">D</span>
          </div>
          <p className="text-purple-500">Loading Admin Panel...</p>
        </div>
      </div>
    )
  }

  if (!business) return <Navigate to="/login" replace />
  if (!business.is_admin) return <Navigate to="/dashboard" replace />

  return <AdminLayout>{children}</AdminLayout>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { business, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-xl font-bold">D</span>
          </div>
          <p className="text-gray-500">Loading Dime-Depot...</p>
        </div>
      </div>
    )
  }

  if (business?.is_admin) return <Navigate to="/admin" replace />
  if (business?.is_active) return <Navigate to="/dashboard" replace />
  if (business && !business.is_active) return <Navigate to="/pending" replace />

  return <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
      <Route path="/reset-pin" element={<PublicRoute><ResetPin /></PublicRoute>} />
      <Route path="/pending" element={<Pending />} />

      {/* Admin routes — purple theme */}
      <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
      <Route path="/admin/businesses" element={<AdminRoute><AdminBusinesses /></AdminRoute>} />
      <Route path="/admin/settings" element={<AdminRoute><AdminSettings /></AdminRoute>} />
      {/* User routes — blue theme */}
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/daily-entry" element={<ProtectedRoute><DailyEntry /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
      <Route path="/products" element={<ProtectedRoute><Products /></ProtectedRoute>} />
      <Route path="/prices" element={<ProtectedRoute><Prices /></ProtectedRoute>} />
      <Route path="/profit" element={<ProtectedRoute><Profit /></ProtectedRoute>} />
      <Route path="/unpaid-debts" element={<ProtectedRoute><UnpaidDebts /></ProtectedRoute>} />

      {/* Default redirects */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              borderRadius: '10px',
              background: '#333',
              color: '#fff',
            },
          }}
        />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}