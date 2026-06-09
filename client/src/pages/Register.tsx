import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authAPI, setToken, setBusiness } from '../lib/api'
import toast from 'react-hot-toast'

export default function Register() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    owner_name: '',
    business_name: '',
    email: '',
    phone: '',
    location: '',
    password: '',
    confirm_password: '',
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()

    if (form.password !== form.confirm_password) {
      toast.error('Passwords do not match')
      return
    }

    if (form.password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }

    setLoading(true)

    try {
      const data = await authAPI.register({
        owner_name: form.owner_name,
        business_name: form.business_name,
        email: form.email,
        password: form.password,
        phone: form.phone || undefined,
        location: form.location || undefined,
      })

      setToken(data.token)
      setBusiness(data.business)

      if (data.business.is_active) {
        toast.success('Account created! Welcome to Dime-Depot!')
        navigate('/dashboard')
      } else {
        toast.success('Account created! Please wait for activation.')
        navigate('/pending')
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4 shadow-lg">
            <span className="text-white text-2xl font-bold">D</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Dime-Depot</h1>
          <p className="text-gray-500 mt-1">Stock & Revenue Manager</p>
        </div>

        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Create your account</h2>

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="label">Your full name</label>
              <input
                type="text"
                name="owner_name"
                className="input"
                placeholder="Jean Pierre Habimana"
                value={form.owner_name}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <label className="label">Business / Depot name</label>
              <input
                type="text"
                name="business_name"
                className="input"
                placeholder="My Depot"
                value={form.business_name}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <label className="label">Email address</label>
              <input
                type="email"
                name="email"
                className="input"
                placeholder="you@example.com"
                value={form.email}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <label className="label">Phone number (optional)</label>
              <input
                type="tel"
                name="phone"
                className="input"
                placeholder="+250 7XX XXX XXX"
                value={form.phone}
                onChange={handleChange}
              />
            </div>

            <div>
              <label className="label">Location (optional)</label>
              <input
                type="text"
                name="location"
                className="input"
                placeholder="Kigali, Gasabo"
                value={form.location}
                onChange={handleChange}
              />
            </div>

            <div>
              <label className="label">Password</label>
              <input
                type="password"
                name="password"
                className="input"
                placeholder="At least 6 characters"
                value={form.password}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <label className="label">Confirm password</label>
              <input
                type="password"
                name="confirm_password"
                className="input"
                placeholder="Repeat your password"
                value={form.confirm_password}
                onChange={handleChange}
                required
              />
            </div>

            <button
              type="submit"
              className="btn-primary w-full mt-2"
              disabled={loading}
            >
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-600 font-medium hover:underline">
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}