import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://bohdabdgqgfeatpxyvbz.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvaGRhYmRncWdmZWF0cHh5dmJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NDgxMjksImV4cCI6MjA4OTQyNDEyOX0.kBq0m-D6oLmol9i57v9TLrMIqFWdFRigCtJLSCsJD8I'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
