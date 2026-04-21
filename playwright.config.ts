import { defineConfig, devices } from '@playwright/test'
import { config as loadEnv } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// ESM-safe __dirname equivalent.
const __dirname = dirname(fileURLToPath(import.meta.url))

// Load .env.test — throws at boot if missing.
loadEnv({ path: resolve(__dirname, '.env.test') })

const BASE_URL = process.env.VITE_APP_URL ?? 'http://localhost:5173'

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './test-results',
  // One worker locally keeps Playwright-triggered Supabase writes deterministic.
  // CI can override via env.
  workers: process.env.CI ? 2 : 1,
  fullyParallel: false,     // cross-tenant tests must not overlap
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  timeout: 30_000,
  expect: { timeout: 8_000 },

  reporter: process.env.CI
    ? [['html', { open: 'never' }], ['github'], ['line']]
    : [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 8_000,
    navigationTimeout: 12_000,
  },

  projects: [
    // Global setup — runs once before all projects. Verifies env safety and
    // creates pre-authenticated session state files for each test user.
    { name: 'setup', testMatch: /.*\.setup\.ts/ },

    // Authenticated flows — use Owner A by default (most tests run as owner)
    {
      name: 'chromium',
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/.auth/owner-a.json',
      },
    },

    // Public / unauthenticated surfaces (Login, Signup, JoinInvite, 404)
    {
      name: 'public',
      dependencies: ['setup'],
      testMatch: /public\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    // Boot Vite in test mode so it auto-loads .env.test
    command: 'npm run dev -- --mode test --port 5173',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
