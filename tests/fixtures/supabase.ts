// Test-only Supabase client factories. NEVER imported by production code.
//
// Uses the TEST project's URL + service-role key from .env.test. Guards
// against production misconfiguration at import time.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const PROD_REF = 'bohdabdgqgfeatpxyvbz'

function must(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing ${name} in .env.test`)
  if (v.includes(PROD_REF)) throw new Error(`${name} points at PRODUCTION — refusing to run tests.`)
  return v
}

export const TEST_USERS = {
  ownerA: {
    id: '11111111-aaaa-1111-aaaa-111111111111',
    email: 'owner-a@belori-test.local',
    password: 'TestPassword123!',
    boutiqueId: 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa',
    role: 'owner' as const,
  },
  staffA: {
    id: '22222222-aaaa-2222-aaaa-222222222222',
    email: 'coordinator-a@belori-test.local',
    password: 'TestPassword123!',
    boutiqueId: 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa',
    role: 'coordinator' as const,
  },
  ownerB: {
    id: '33333333-bbbb-3333-bbbb-333333333333',
    email: 'owner-b@belori-test.local',
    password: 'TestPassword123!',
    boutiqueId: 'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb',
    role: 'owner' as const,
  },
  staffB: {
    id: '44444444-bbbb-4444-bbbb-444444444444',
    email: 'seamstress-b@belori-test.local',
    password: 'TestPassword123!',
    boutiqueId: 'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb',
    role: 'seamstress' as const,
  },
} as const

export const TEST_BOUTIQUES = {
  alpha: { id: 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa', name: 'Maison Alpha' },
  beta:  { id: 'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb', name: 'Atelier Beta'  },
} as const

/** Anon client — what the browser app uses. Subject to RLS. */
export function anonClient(): SupabaseClient {
  return createClient(must('VITE_SUPABASE_URL'), must('VITE_SUPABASE_ANON_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** Service-role client — bypasses RLS. ONLY for test seeding and teardown. */
export function serviceClient(): SupabaseClient {
  return createClient(must('TEST_SUPABASE_URL'), must('TEST_SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** Sign a test user in and return an authenticated anon client. */
export async function signInAs(user: keyof typeof TEST_USERS): Promise<SupabaseClient> {
  const creds = TEST_USERS[user]
  const sb = anonClient()
  const { error } = await sb.auth.signInWithPassword({
    email: creds.email,
    password: creds.password,
  })
  if (error) throw new Error(`signInAs(${user}) failed: ${error.message}`)
  return sb
}
