import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Service-role client for background jobs — bypasses RLS so we can query
// across all boutiques. Only use in Edge Functions, never expose to the browser.
export const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } }
)
