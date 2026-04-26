#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
// scripts/seed-test-users.mjs
//
// Creates the 4 test users via Supabase's admin API (auth.admin.createUser).
//
// Why this exists:
//   Manually INSERT-ing into auth.users via raw SQL fails GoTrue's sign-in
//   queries with "Database error querying schema" because GoTrue expects
//   users to have internal metadata that only admin.createUser sets up
//   correctly (encrypted_password format, identity provider records, etc.)
//
// Idempotent: if a user already exists, deletes and recreates them so the
// password and confirmed status are guaranteed.
//
// Usage:
//   node scripts/seed-test-users.mjs
//
// Requires .env.test with TEST_SUPABASE_URL + TEST_SUPABASE_SERVICE_ROLE_KEY.
// ════════════════════════════════════════════════════════════════════════════

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

// ─── Load .env.test ──────────────────────────────────────────────────────
const env = {}
let raw = readFileSync(resolve(ROOT, '.env.test'), 'utf8')
if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1)
raw.split(/\r?\n/).forEach(line => {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim()
})

const URL = env.TEST_SUPABASE_URL || env.VITE_SUPABASE_URL
const SERVICE_KEY = env.TEST_SUPABASE_SERVICE_ROLE_KEY

if (!URL || !SERVICE_KEY) {
  console.error('Missing TEST_SUPABASE_URL or TEST_SUPABASE_SERVICE_ROLE_KEY in .env.test')
  process.exitCode = 1
} else if (URL.includes('bohdabdgqgfeatpxyvbz')) {
  console.error('REFUSING — TEST_SUPABASE_URL points at PRODUCTION.')
  process.exitCode = 1
} else {

  const sb = createClient(URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const TEST_USERS = [
    { id: '11111111-aaaa-1111-aaaa-111111111111', email: 'owner-a@belori-test.local',        password: 'TestPassword123!', meta: { full_name: 'Alpha Owner' } },
    { id: '22222222-aaaa-2222-aaaa-222222222222', email: 'coordinator-a@belori-test.local',  password: 'TestPassword123!', meta: { full_name: 'Alpha Coordinator' } },
    { id: '33333333-bbbb-3333-bbbb-333333333333', email: 'owner-b@belori-test.local',        password: 'TestPassword123!', meta: { full_name: 'Beta Owner' } },
    { id: '44444444-bbbb-4444-bbbb-444444444444', email: 'seamstress-b@belori-test.local',   password: 'TestPassword123!', meta: { full_name: 'Beta Seamstress' } },
  ]

  const C = { green: s => `\x1b[32m${s}\x1b[0m`, red: s => `\x1b[31m${s}\x1b[0m`, gray: s => `\x1b[90m${s}\x1b[0m` }

  console.log('\n  Seeding 4 test users via Supabase admin API…\n')

  let created = 0, failed = 0
  for (const u of TEST_USERS) {
    // Delete if exists (idempotent)
    await sb.auth.admin.deleteUser(u.id).catch(() => {})

    const { data, error } = await sb.auth.admin.createUser({
      id: u.id,
      email: u.email,
      password: u.password,
      email_confirm: true,        // pre-confirmed — no email click required
      user_metadata: u.meta,
    })

    if (error) {
      console.log(`  ${C.red('✗')} ${u.email} — ${error.message}`)
      failed++
    } else {
      console.log(`  ${C.green('✓')} ${u.email} ${C.gray(`(${data.user.id})`)}`)
      created++
    }
  }

  console.log(`\n  ${C.green(`${created} created`)}${failed ? ', ' + C.red(`${failed} failed`) : ''}\n`)
  process.exitCode = failed === 0 ? 0 : 1
}
