export interface Business {
  id: string
  owner_name: string
  business_name: string
  email: string | null
  phone: string | null
  location: string | null
  country: string | null
  currency: string | null
  security_question: string | null
  has_pin: boolean
  has_email: boolean
  is_active: boolean
  is_admin: boolean
  payment_date: string | null
  created_at: string
}

export interface Supplier {
  id: string
  business_id: string
  name: string
  created_at: string
}

export interface Product {
  id: string
  business_id: string
  supplier_id: string
  name: string
  pieces_per_casse: number
  is_active: boolean
  created_at: string
  supplier_name?: string
}

export interface Price {
  id: string
  product_id: string
  business_id: string
  price_per_casse: number
  effective_date: string
  created_at: string
}

export interface StockEntry {
  id: string
  business_id: string
  product_id: string
  entry_date: string
  casses: number
  halves: number
  pieces: number
  created_at: string
}

export interface StockReceived {
  id: string
  business_id: string
  product_id: string
  received_date: string
  supplier_casses: number
  return_casses: number
  return_halves: number
  return_pieces: number
  created_at: string
}

export interface DailySale {
  product: Product
  supplier: Supplier
  sold_pieces: number
  sold_casses: number
  sold_halves: number
  sold_remaining_pieces: number
  price_per_casse: number
  revenue: number
}

export interface DailyFinance {
  id: string
  business_id: string
  entry_date: string
  momo: number
  cash: number
  created_at: string
}

export interface DailyDebt {
  id: string
  business_id: string
  entry_date: string
  client_name: string
  amount: number
  is_paid: boolean
  created_at: string
}

export interface DailyExpense {
  id: string
  business_id: string
  entry_date: string
  description: string
  amount: number
  created_at: string
}