import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { authAPI, setToken, removeToken, setBusiness, getStoredBusiness } from '../lib/api'
import type { Business } from '../lib/types'

interface AuthContextType {
  business: Business | null
  loading: boolean
  signIn: (data: { phone?: string; pin?: string; email?: string; password?: string }) => Promise<any>
  signOut: () => void
  refreshBusiness: () => Promise<void>
  setBusinessState: (business: Business) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  // Initialize state directly from storage — no need to set it in effect
  const [business, setBusiness2] = useState<Business | null>(() => getStoredBusiness())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
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
  }, [])

  async function signIn(loginData: { phone?: string; pin?: string; email?: string; password?: string }) {
    const data = await authAPI.login(loginData)
    setToken(data.token)
    setBusiness(data.business)
    setBusiness2(data.business)
    return data.business
  }

  function signOut() {
    removeToken()
    setBusiness2(null)
  }

  function setBusinessState(b: Business) {
    setBusiness2(b)
    setBusiness(b)
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
    <AuthContext.Provider value={{ business, loading, signIn, signOut, refreshBusiness, setBusinessState }}>
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