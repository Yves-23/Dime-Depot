import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { business, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  function handleSignOut() {
    signOut()
    toast.success('Signed out successfully')
    navigate('/login')
  }

  const navItems = [
    {
      path: '/admin',
      label: 'Dashboard',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      path: '/admin/businesses',
      label: 'Businesses',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    },
    {
      path: '/admin/settings',
      label: 'Settings',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ]

  return (
    <div className="min-h-screen bg-purple-50 flex">
      {/* Sidebar - desktop */}
      <aside className="hidden md:flex md:flex-col md:w-64 bg-purple-900 fixed h-full">
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-purple-800">
          <div className="w-9 h-9 bg-purple-500 rounded-xl flex items-center justify-center">
            <span className="text-white font-bold text-lg">D</span>
          </div>
          <div>
            <span className="text-xl font-bold text-white">Dime-Depot</span>
            <p className="text-xs text-purple-300">Admin Panel</p>
          </div>
        </div>

        {/* Admin info */}
        <div className="px-6 py-4 border-b border-purple-800">
          <p className="text-sm font-medium text-white truncate">{business?.owner_name}</p>
          <p className="text-xs text-purple-300 truncate">{business?.email}</p>
          <span className="inline-block mt-1 px-2 py-0.5 bg-purple-500 text-white text-xs rounded-full">Super Admin</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-4 py-4 space-y-1">
          {navItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                location.pathname === item.path
                  ? 'bg-purple-700 text-white'
                  : 'text-purple-200 hover:bg-purple-800 hover:text-white'
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Sign out */}
        <div className="px-4 py-4 border-t border-purple-800">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-purple-200 hover:bg-purple-800 hover:text-white w-full transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 bg-purple-900 z-10">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">D</span>
            </div>
            <div>
              <span className="font-bold text-white text-sm">Dime-Depot</span>
              <span className="text-purple-300 text-xs ml-1">Admin</span>
            </div>
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg text-purple-200 hover:bg-purple-800"
          >
            {mobileMenuOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="bg-purple-900 border-t border-purple-800 px-4 py-3 space-y-1">
            {navItems.map(item => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === item.path
                    ? 'bg-purple-700 text-white'
                    : 'text-purple-200 hover:bg-purple-800 hover:text-white'
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
            <button
              onClick={handleSignOut}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-purple-200 hover:bg-purple-800 w-full"
            >
              Sign out
            </button>
          </div>
        )}
      </div>

      {/* Main content */}
      <main className="flex-1 md:ml-64 pt-16 md:pt-0">
        <div className="p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}