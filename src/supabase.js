import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || 'https://prwsbukoicqkjrscnxyv.supabase.co',
  import.meta.env.VITE_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InByd3NidWtvaWNxa2pyc2NueHl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5MTQ5MzQsImV4cCI6MjA5NzQ5MDkzNH0.mC97mVVF7HoJIFNXuvl162HH-EM_d6VGJ8AvmaThvec'
)