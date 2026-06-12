import { query } from './index'

export async function createTables() {

  // Businesses table
  await query(`
    CREATE TABLE IF NOT EXISTS businesses (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      owner_name TEXT NOT NULL,
      business_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      location TEXT,
      password_hash TEXT NOT NULL,
      is_active BOOLEAN DEFAULT FALSE,
      is_admin BOOLEAN DEFAULT FALSE,
      payment_date TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  // Suppliers table
  await query(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  // Products table
  await query(`
    CREATE TABLE IF NOT EXISTS products (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
      supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      pieces_per_casse INTEGER NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  // Prices table
  await query(`
    CREATE TABLE IF NOT EXISTS prices (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      product_id UUID REFERENCES products(id) ON DELETE CASCADE,
      business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
      price_per_casse NUMERIC NOT NULL,
      effective_date DATE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  // Stock entries table
  await query(`
    CREATE TABLE IF NOT EXISTS stock_entries (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
      product_id UUID REFERENCES products(id) ON DELETE CASCADE,
      entry_date DATE NOT NULL,
      casses INTEGER DEFAULT 0,
      halves INTEGER DEFAULT 0,
      pieces INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(business_id, product_id, entry_date)
    )
  `)

  // Stock received table
  await query(`
    CREATE TABLE IF NOT EXISTS stock_received (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
      product_id UUID REFERENCES products(id) ON DELETE CASCADE,
      received_date DATE NOT NULL,
      supplier_casses INTEGER DEFAULT 0,
      return_casses INTEGER DEFAULT 0,
      return_halves INTEGER DEFAULT 0,
      return_pieces INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(business_id, product_id, received_date)
    )
  `)

  // Daily finances table
  await query(`
    CREATE TABLE IF NOT EXISTS daily_finances (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
      entry_date DATE NOT NULL,
      momo NUMERIC DEFAULT 0,
      cash NUMERIC DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(business_id, entry_date)
    )
  `)

  // Daily debts table
  await query(`
    CREATE TABLE IF NOT EXISTS daily_debts (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
      entry_date DATE NOT NULL,
      client_name TEXT NOT NULL,
      amount NUMERIC NOT NULL,
      amount_paid NUMERIC DEFAULT 0,
      is_paid BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  // Migrate: add amount_paid to existing daily_debts table if not exists
  await query(`
    ALTER TABLE daily_debts ADD COLUMN IF NOT EXISTS amount_paid NUMERIC DEFAULT 0
  `)

  // Daily expenses table
  await query(`
    CREATE TABLE IF NOT EXISTS daily_expenses (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
      entry_date DATE NOT NULL,
      description TEXT NOT NULL,
      amount NUMERIC NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  // Buying prices table
  await query(`
    CREATE TABLE IF NOT EXISTS buying_prices (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      product_id UUID REFERENCES products(id) ON DELETE CASCADE,
      business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
      price_per_casse NUMERIC NOT NULL,
      effective_date DATE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  // tables ready
}