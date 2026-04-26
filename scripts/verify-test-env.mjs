#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
// verify-test-env.mjs — Pre-test safety rail
// ════════════════════════════════════════════════════════════════════════════
// Refuses to exit 0 unless the current environment is DEFINITIVELY pointed at
// the Belori test Supabase project (not production). Run this before every
// test command. Wire into `test` and `test:e2e` npm scripts as a dependency.
//
// Usage:
//   node scripts/verify-test-env.mjs
//   node scripts/verify-test-env.mjs --skip-ping    # for CI without network
//
// Exit codes:
//   0   — safe to run tests
//   1   — any check failed; tests must not run
// ════════════════════════════════════════════════════════════════════════════

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const PROD_PROJECT_REF = 'bohdabdgqgfeatpxyvbz' // Belori production — NEVER test target
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// ─── Colors ──────────────────────────────────────────────────────────────
const C = {
  red:    (s) => `\x1b[31m${s}\x1b[0m`,
  green:  (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  gray:   (s) => `\x1b[90m${s}\x1b[0m`,
  bold:   (s) => `\x1b[1m${s}\x1b[0m`,
  dim:    (s) => `\x1b[2m${s}\x1b[0m`,
}

const checks = []
const log = (msg) => console.log(msg)
const pass = (msg) => { checks.push({ ok: true,  msg }); log(`  ${C.green('✓')} ${msg}`) }
const fail = (msg) => { checks.push({ ok: false, msg }); log(`  ${C.red('✗')} ${C.red(msg)}`) }
const note = (msg) => log(`    ${C.gray(msg)}`)

log('')
log(C.bold('  Belori — Test Environment Safety Check'))
log(C.dim('  ───────────────────────────────────────────────────'))

// ─── Load .env.test ──────────────────────────────────────────────────────
let env = {}
try {
  let raw = readFileSync(resolve(ROOT, '.env.test'), 'utf8')
  // Strip UTF-8 BOM (Notepad on Windows likes to add one)
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1)
  raw.split(/\r?\n/).forEach(line => {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim()
  })
  pass('.env.test file found')
} catch (e) {
  fail('.env.test file not found')
  note('Copy .env.test.example to .env.test and fill in test project credentials.')
  note('See docs/TESTING_SUPABASE_SETUP.md.')
  process.exit(1)
}

// ─── CHECK 1: VITE_SUPABASE_URL must NOT contain production ref ──────────
const viteUrl = env.VITE_SUPABASE_URL || ''
if (!viteUrl) {
  fail('VITE_SUPABASE_URL is empty in .env.test')
} else if (viteUrl.includes(PROD_PROJECT_REF)) {
  fail(`VITE_SUPABASE_URL points at PRODUCTION (${PROD_PROJECT_REF})`)
  note('This would run tests against real customer data. Absolutely not.')
} else if (!viteUrl.match(/^https:\/\/[a-z0-9]{20}\.supabase\.co\/?$/i)) {
  fail(`VITE_SUPABASE_URL format looks wrong: ${viteUrl}`)
  note('Expected: https://<20-char-ref>.supabase.co')
} else {
  pass(`VITE_SUPABASE_URL points at test project`)
  note(viteUrl)
}

// ─── CHECK 2: TEST_SUPABASE_URL must match VITE_SUPABASE_URL ─────────────
const testUrl = env.TEST_SUPABASE_URL || ''
if (!testUrl) {
  fail('TEST_SUPABASE_URL is empty in .env.test')
} else if (testUrl !== viteUrl) {
  fail('TEST_SUPABASE_URL and VITE_SUPABASE_URL disagree')
  note(`  VITE_SUPABASE_URL: ${viteUrl}`)
  note(`  TEST_SUPABASE_URL: ${testUrl}`)
  note('These must be identical — setting only one is a misconfiguration.')
} else {
  pass('TEST_SUPABASE_URL matches VITE_SUPABASE_URL')
}

// ─── CHECK 3: Keys exist and are plausible ──────────────────────────────
// Supabase has two key formats:
//   Legacy JWT:  starts with "eyJ", 200+ chars
//   New format:  starts with "sb_publishable_" / "sb_secret_", ~40-60 chars
function looksLikeKey(k) {
  if (!k) return false
  if (k.startsWith('eyJ') && k.length >= 100) return true
  if (k.startsWith('sb_publishable_') && k.length >= 30) return true
  if (k.startsWith('sb_secret_') && k.length >= 30) return true
  return false
}

const anonKey = env.VITE_SUPABASE_ANON_KEY || ''
if (!anonKey) {
  fail('VITE_SUPABASE_ANON_KEY is missing')
} else if (!looksLikeKey(anonKey)) {
  fail('VITE_SUPABASE_ANON_KEY format unrecognised')
  note('Expected formats: "eyJ..." (legacy JWT) or "sb_publishable_..." (new).')
} else {
  pass('VITE_SUPABASE_ANON_KEY is present and well-formed')
}

const serviceKey = env.TEST_SUPABASE_SERVICE_ROLE_KEY || ''
if (!serviceKey) {
  fail('TEST_SUPABASE_SERVICE_ROLE_KEY is missing')
  note('The service_role / sb_secret_ key is required for test seed/teardown.')
} else if (serviceKey === anonKey) {
  fail('TEST_SUPABASE_SERVICE_ROLE_KEY equals the anon key — wrong key copied')
} else if (!looksLikeKey(serviceKey)) {
  fail('TEST_SUPABASE_SERVICE_ROLE_KEY format unrecognised')
  note('Expected formats: "eyJ..." (legacy JWT) or "sb_secret_..." (new).')
} else if (anonKey.startsWith('sb_publishable_') && !serviceKey.startsWith('sb_secret_')) {
  fail('Anon key is new-format but service-role is not — paste a sb_secret_ key.')
} else {
  pass('TEST_SUPABASE_SERVICE_ROLE_KEY is present and distinct from anon')
}

// ─── CHECK 4: NODE_ENV sanity ────────────────────────────────────────────
if (env.NODE_ENV && env.NODE_ENV !== 'test') {
  fail(`NODE_ENV in .env.test is "${env.NODE_ENV}" — expected "test"`)
} else {
  pass(`NODE_ENV=${env.NODE_ENV || 'test'}`)
}

// ─── CHECK 5: Test user credentials present ─────────────────────────────
const testAccounts = ['OWNER_A', 'STAFF_A', 'OWNER_B', 'STAFF_B']
let credsOk = true
for (const acct of testAccounts) {
  if (!env[`TEST_${acct}_EMAIL`] || !env[`TEST_${acct}_PASSWORD`]) {
    fail(`Missing TEST_${acct}_EMAIL or TEST_${acct}_PASSWORD`)
    credsOk = false
  }
}
if (credsOk) pass('All 4 test user credentials present (Owner/Staff × A/B)')

// ─── CHECK 6: Live-ping the test project + confirm seed data ────────────
const skipPing = process.argv.includes('--skip-ping') || env.SKIP_SUPABASE_PING === '1'
if (skipPing) {
  log(`  ${C.yellow('⏭')}  Skipping live ping (--skip-ping)`)
} else if (checks.some(c => !c.ok)) {
  log(`  ${C.yellow('⏭')}  Skipping live ping (earlier checks failed)`)
} else {
  try {
    const url = `${viteUrl.replace(/\/$/, '')}/rest/v1/boutiques?select=id,name&name=in.(Maison%20Alpha,Atelier%20Beta)`
    const res = await fetch(url, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    })
    if (!res.ok) {
      fail(`Test project REST API returned ${res.status}`)
      note(await res.text())
    } else {
      const rows = await res.json()
      if (!Array.isArray(rows)) {
        fail(`Unexpected response from /rest/v1/boutiques`)
      } else if (rows.length !== 2) {
        fail(`Expected 2 seed boutiques, found ${rows.length}`)
        note('Run: supabase db execute --file supabase/seed.test.sql')
      } else {
        pass(`Test project reachable and seeded (${rows.map(r => r.name).join(', ')})`)
      }
    }
  } catch (e) {
    fail(`Could not reach test project: ${e.message}`)
    note('Is the test project paused? Is your network blocking supabase.co?')
  }
}

// ─── Final verdict ───────────────────────────────────────────────────────
log('')
log(C.dim('  ───────────────────────────────────────────────────'))
const failures = checks.filter(c => !c.ok).length
if (failures === 0) {
  log(`  ${C.green('●')} ${C.bold(C.green('SAFE'))} — ${checks.length} checks passed`)
  log(`    ${C.gray('Test environment verified. OK to run tests.')}`)
  log('')
} else {
  log(`  ${C.red('●')} ${C.bold(C.red('UNSAFE'))} — ${failures} of ${checks.length} checks failed`)
  log(`    ${C.red('Tests MUST NOT run against this configuration.')}`)
  log(`    ${C.gray('Fix the issues above. See docs/TESTING_SUPABASE_SETUP.md.')}`)
  log('')
}
// Set exitCode but let the event loop drain naturally — avoids the libuv
// cleanup assertion on Windows that fires when process.exit() races with
// the still-closing fetch handle.
process.exitCode = failures === 0 ? 0 : 1
