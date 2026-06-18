const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

// Get token from localStorage
function getToken(): string | null {
  return localStorage.getItem('dime-depot-token')
}

// Save token to localStorage
export function setToken(token: string): void {
  localStorage.setItem('dime-depot-token', token)
}

// Remove token from localStorage
export function removeToken(): void {
  localStorage.removeItem('dime-depot-token')
  localStorage.removeItem('dime-depot-business')
}

// Save business to localStorage
export function setBusiness(business: any): void {
  localStorage.setItem('dime-depot-business', JSON.stringify(business))
}

// Get business from localStorage
export function getStoredBusiness(): any | null {
  const b = localStorage.getItem('dime-depot-business')
  return b ? JSON.parse(b) : null
}

// Main API request function
async function request(
  method: string,
  path: string,
  body?: any,
  requiresAuth = true
): Promise<any> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (requiresAuth) {
    const token = getToken()
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
  }

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error || 'Something went wrong')
  }

  return data
}

// Auth API
export const authAPI = {
  register: (data: {
    owner_name: string
    business_name: string
    phone: string
    pin: string
    security_question: string
    security_answer: string
    email?: string
    location?: string
    country: string
  }) => request('POST', '/api/auth/register', data, false),

  login: (data: { phone?: string; pin?: string; email?: string; password?: string }) =>
    request('POST', '/api/auth/login', data, false),

  me: () => request('GET', '/api/auth/me'),

  changePassword: (current_password: string, new_password: string) =>
    request('PUT', '/api/auth/change-password', { current_password, new_password }),

  changePin: (current_pin: string, new_pin: string) =>
    request('PUT', '/api/auth/change-pin', { current_pin, new_pin }),

  resetPinQuestion: (phone: string) =>
    request('POST', '/api/auth/reset-pin/question', { phone }, false),

  resetPinVerify: (data: { phone: string; security_answer?: string; email?: string }) =>
    request('POST', '/api/auth/reset-pin/verify', data, false),

  resetPinSet: (reset_token: string, new_pin: string) =>
    request('POST', '/api/auth/reset-pin/set', { reset_token, new_pin }, false),

  updateLanguage: (language: string) =>
  request('PUT', '/api/auth/language', { language }),
}

// Admin API
export const adminAPI = {
  login: (email: string, password: string) =>
    request('POST', '/api/admin/auth/login', { email, password }, false),
  verify2FA: (email: string, code: string) =>
    request('POST', '/api/admin/auth/verify', { email, code }, false),
  getBusinesses: () => request('GET', '/api/admin/businesses'),
  getStats: () => request('GET', '/api/admin/stats'),
  activateBusiness: (id: string, is_active: boolean) =>
    request('PUT', `/api/admin/businesses/${id}/activate`, { is_active }),
  deleteBusiness: (id: string) =>
    request('DELETE', `/api/admin/businesses/${id}`),
}

// Suppliers API
export const suppliersAPI = {
  getAll: () => request('GET', '/api/suppliers'),
  create: (name: string) => request('POST', '/api/suppliers', { name }),
  delete: (id: string) => request('DELETE', `/api/suppliers/${id}`),
}

// Products API
export const productsAPI = {
  getAll: () => request('GET', '/api/products'),
  create: (data: { supplier_id: string; name: string; pieces_per_casse: number }) =>
    request('POST', '/api/products', data),
  toggle: (id: string) => request('PUT', `/api/products/${id}/toggle`),
}

// Prices API
export const pricesAPI = {
  getAll: () => request('GET', '/api/prices'),
  set: (data: { product_id: string; price_per_casse: number; effective_date: string }) =>
    request('POST', '/api/prices', data),
}

// Buying Prices API
export const buyingPricesAPI = {
  getAll: () => request('GET', '/api/buying-prices'),
  set: (data: { product_id: string; price_per_casse: number; effective_date: string }) =>
    request('POST', '/api/buying-prices', data),
  getSummary: (start_date: string, end_date: string) =>
    request('GET', `/api/buying-prices/summary?start_date=${start_date}&end_date=${end_date}`),
}

// Stock API
export const stockAPI = {
  getEntries: (date: string) => request('GET', `/api/stock/entries/${date}`),
  getReceived: (date: string) => request('GET', `/api/stock/received/${date}`),
  bulkSaveEntries: (entries: any[], date: string) =>
    request('POST', '/api/stock/entries/bulk', { entries, date }),
  bulkSaveReceived: (received: any[], date: string) =>
    request('POST', '/api/stock/received/bulk', { received, date }),
}

// Finances API
export const financesAPI = {
  get: (date: string) => request('GET', `/api/finances/${date}`),
  save: (date: string, data: any) => request('POST', `/api/finances/${date}`, data),
  updateDebtPaid: (id: string, is_paid: boolean) => request('PUT', `/api/finances/debts/${id}/paid`, { is_paid }),
  getUnpaidDebts: () => request('GET', '/api/finances/debts/unpaid'),
  partialPayDebt: (id: string, amount: number) => request('PATCH', `/api/finances/debts/${id}/partial-pay`, { amount }),
}