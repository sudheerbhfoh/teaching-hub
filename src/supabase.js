import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || 'https://prwsbukoicqkjrscnxyv.supabase.co',
  import.meta.env.VITE_SUPABASE_KEY || 'your-full-anon-key-here'
)