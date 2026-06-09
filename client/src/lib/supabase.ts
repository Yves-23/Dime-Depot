import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ksncdshqxtpvacmtgizh.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtzbmNkc2hxeHRwdmFjbXRnaXpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMjU3MjIsImV4cCI6MjA5NTkwMTcyMn0.kjPFzgIg_3RUzJkeKalkxs9sx_O3trUMEigjZ1CbnFQ'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storageKey: 'dime-depot-auth',
    storage: window.localStorage,
    flowType: 'implicit',
  }
})