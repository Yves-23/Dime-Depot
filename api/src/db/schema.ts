import { query } from './index'

export async function createTables() {

  // Businesses table
  await query(`
    CREATE TABLE IF NOT EXISTS businesses (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      owner_name TEXT NOT NULL,
      business_name TEXT NOT NULL,
      email TEXT UNIQUE,
      phone TEXT,
      location TEXT,
      country TEXT DEFAULT 'Rwanda',
      currency TEXT DEFAULT 'RWF',
      language TEXT DEFAULT 'en',
      password_hash TEXT,
      pin_hash TEXT,
      security_question TEXT,
      security_answer_hash TEXT,
      is_active BOOLEAN DEFAULT FALSE,
      is_admin BOOLEAN DEFAULT FALSE,
      payment_date TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  // Migrate existing businesses table — add new columns if not exist
  await query(`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS pin_hash TEXT`)
  await query(`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS security_question TEXT`)
  await query(`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS security_answer_hash TEXT`)
  await query(`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'Rwanda'`)
  await query(`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'RWF'`)
  await query(`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en'`)

  // Make email and password_hash optional for existing accounts
  await query(`ALTER TABLE businesses ALTER COLUMN email DROP NOT NULL`)
  await query(`ALTER TABLE businesses ALTER COLUMN password_hash DROP NOT NULL`)

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
  await query(`ALTER TABLE daily_debts ADD COLUMN IF NOT EXISTS amount_paid NUMERIC DEFAULT 0`)

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

  // Crate types table (Bralirwa, Skol, etc.)
  await query(`
    CREATE TABLE IF NOT EXISTS crate_types (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
      supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE,
      total_owned INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(business_id, supplier_id)
    )
  `)

  // Crate lendings — crates lent to clients
  await query(`
    CREATE TABLE IF NOT EXISTS crate_lendings (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
      crate_type_id UUID REFERENCES crate_types(id) ON DELETE CASCADE,
      client_name TEXT NOT NULL,
      crates_lent INTEGER NOT NULL,
      crates_returned INTEGER DEFAULT 0,
      is_fully_returned BOOLEAN DEFAULT FALSE,
      lent_date DATE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  // Crate borrowings — crates borrowed from supplier or neighbours
  await query(`
    CREATE TABLE IF NOT EXISTS crate_borrowings (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
      crate_type_id UUID REFERENCES crate_types(id) ON DELETE CASCADE,
      borrowed_from TEXT NOT NULL,
      crates_borrowed INTEGER NOT NULL,
      is_returned BOOLEAN DEFAULT FALSE,
      borrowed_date DATE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  // tables ready
}