import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'

export default function Pending() {
  const { business, signOut, refreshBusiness } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (business?.is_active) {
      navigate('/dashboard')
    }
  }, [business])

  useEffect(() => {
    // Keep checking every 5 seconds if account got activated
    const interval = setInterval(async () => {
      await refreshBusiness()
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  function handleSignOut() {
    signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4 shadow-lg">
            <span className="text-white text-2xl font-bold">D</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Dime-Depot</h1>
        </div>

        <div className="card text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-100 rounded-full mb-4">
            <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>

          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Account pending activation
          </h2>

          <p className="text-gray-500 mb-4">
            Thank you for registering <strong>{business?.business_name}</strong>!
            Your account is waiting for activation.
          </p>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
            <p className="text-sm text-blue-800 font-medium mb-1">How to activate:</p>
            <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
              <li>Contact us to make your one-time payment</li>
              <li>Your account will be activated within 24 hours</li>
              <li>You will be able to start using Dime-Depot</li>
            </ol>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-600 font-medium mb-1">Contact us:</p>
            <p className="text-sm text-gray-700">📞 +250 789 128 345</p>
            <p className="text-sm text-gray-700">📧 support@dimedepot.rw</p>
          </div>

          <button
            onClick={handleSignOut}
            className="btn-secondary w-full"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}