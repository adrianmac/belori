// Playwright global setup — runs once before all test projects.
// Responsibilities:
//   1. Re-verify env safety (even though npm script already did)
//   2. Sign in each test user via Supabase and persist their session to
//      tests/.auth/<user>.json so subsequent tests start authenticated.

import { test as setup, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { anonClient, TEST_USERS } from '../fixtures/supabase'

// ESM-safe __dirname equivalent.
const __dirname = dirname(fileURLToPath(import.meta.url))
const AUTH_DIR = resolve(__dirname, '../.auth')

setup('verify test environment is safe', async () => {
  const url = process.env.VITE_SUPABASE_URL ?? ''
  expect(url, 'VITE_SUPABASE_URL missing').not.toBe('')
  expect(url, 'VITE_SUPABASE_URL must not be production')
    .not.toContain('bohdabdgqgfeatpxyvbz')
})

setup('seed auth storage for each test user', async ({ page }) => {
  mkdirSync(AUTH_DIR, { recursive: true })

  for (const [key, creds] of Object.entries(TEST_USERS)) {
    const sb = anonClient()
    const { data, error } = await sb.auth.signInWithPassword({
      email: creds.email,
      password: creds.password,
    })
    if (error) {
      throw new Error(
        `Failed to sign in ${key} (${creds.email}): ${error.message}\n` +
        `Did you run supabase/seed.test.sql?`
      )
    }

    // Persist the Supabase session into localStorage under the key the
    // app uses — `sb-<project-ref>-auth-token`.
    const projectRef = new URL(process.env.VITE_SUPABASE_URL!).hostname.split('.')[0]
    const storageKey = `sb-${projectRef}-auth-token`

    // Navigate once so we can set localStorage on the app's origin.
    await page.goto(process.env.VITE_APP_URL ?? 'http://localhost:5173')
    await page.evaluate(
      ([k, session]) => {
        localStorage.setItem(k, JSON.stringify(session))
      },
      [storageKey, data.session],
    )

    // Capture storage state to a per-user file
    const filename = key.replace(/([A-Z])/g, '-$1').toLowerCase() // ownerA → owner-a
    await page.context().storageState({ path: resolve(AUTH_DIR, `${filename}.json`) })

    // Clean up for next user
    await page.evaluate(k => localStorage.removeItem(k), storageKey)
  }
})
