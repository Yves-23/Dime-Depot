import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { authAPI, setToken, removeToken, setBusiness, getStoredBusiness } from '../lib/api'
import type { Business } from '../lib/types'

interface AuthContextType {
  business: Business | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<any>
  signOut: () => void
  refreshBusiness: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [business, setBusiness2] = useState<Business | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // On app load check if we have a stored business
    const stored = getStoredBusiness()
    if (stored) {
      setBusiness2(stored)
      // Verify token is still valid by calling /me
      authAPI.me()
        .then(data => {
          setBusiness2(data.business)
          setBusiness(data.business)
        })
        .catch(() => {
          // Token expired — clear everything
          removeToken()
          setBusiness2(null)
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  async function signIn(email: string, password: string) {
    const data = await authAPI.login(email, password)
    setToken(data.token)
    setBusiness(data.business)
    setBusiness2(data.business)
    return data.business
  }

  function signOut() {
    removeToken()
    setBusiness2(null)
  }

  async function refreshBusiness() {
    try {
      const data = await authAPI.me()
      setBusiness2(data.business)
      setBusiness(data.business)
    } catch {
      signOut()
    }
  }

  return (
    <AuthContext.Provider value={{ business, loading, signIn, signOut, refreshBusiness }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}