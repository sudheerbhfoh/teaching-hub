import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  'https://prwsbukoicqkjrscnxyv.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InByd3NidWtvaWNxa2pyc2NueHl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk5NzI0NTIsImV4cCI6MjA2NTU0ODQ1Mn0.Nxi0d8WtvahoDl4iymhoo_hJpvtj7L29IH-vm1OGNzE'
)