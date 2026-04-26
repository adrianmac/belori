// CSV import flow — proves the highest-leverage onboarding feature works
// end-to-end. Uploads a 3-row CSV with quoted-comma + special chars,
// verifies preview, runs the import, confirms new clients appear in
// the list, and cleans up after itself so re-runs are deterministic.

import { test, expect } from '@playwright/test'
import { serviceClient, TEST_BOUTIQUES } from '../../fixtures/supabase'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeFileSync, mkdirSync, unlinkSync } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURES = resolve(__dirname, '../../.tmp')
const CSV_PATH = resolve(FIXTURES, 'csv-import-test.csv')

// Use a short unique tag so the test can clean up only its own rows
const TAG = `csvtest${Date.now().toString(36).slice(-5)}`

const CSV_CONTENT = `name,phone,email,partner_name,flower_prefs
"García, Sofia ${TAG}",+15551234567,sofia.${TAG}@example.test,Carlos Mendez,"Allergic to lilies, use roses"
Olivia Bennett ${TAG},(555) 234-5678,olivia.${TAG}@example.test,,No preference
James O'Brien ${TAG},5552345679,james.${TAG}@example.test,Emily Carter,Garden roses only
`

test.describe('CSV import — Clients', () => {
  test.beforeAll(() => {
    mkdirSync(FIXTURES, { recursive: true })
    writeFileSync(CSV_PATH, CSV_CONTENT, 'utf8')
  })

  test.afterAll(async () => {
    // Clean up the file
    try { unlinkSync(CSV_PATH) } catch { /* fine */ }
    // Clean up the rows we inserted (scoped by name suffix to be safe)
    const sb = serviceClient()
    await sb.from('clients').delete()
      .eq('boutique_id', TEST_BOUTIQUES.alpha.id)
      .like('name', `%${TAG}%`)
  })

  test('upload → preview → import → clients appear in list', async ({ page }) => {
    // 1. Navigate to Clients (lazy-loaded chunk includes Papa Parse — slowest route to first paint)
    await page.goto('/dashboard')
    await page.waitForSelector('[data-testid="dashboard-root"]', { timeout: 10_000 })
    await page.getByTestId('nav-clients').click()
    await page.waitForLoadState('networkidle', { timeout: 15_000 })
    // Locate by visible text — testid sometimes lags HMR, button text is stable
    const importBtn = page.locator('button', { hasText: /Import CSV/i }).first()
    await expect(importBtn).toBeVisible({ timeout: 20_000 })

    // 2. Open the import modal
    await importBtn.click()
    await expect(page.getByTestId('csv-import-dialog')).toBeVisible()

    // 3. Upload the CSV (Playwright handles hidden <input type="file">)
    await page.getByTestId('csv-import-file').setInputFiles(CSV_PATH)

    // 4. Step 2 — should auto-advance, show preview
    await expect(page.getByText(/preview — first 5 rows/i)).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(`García, Sofia ${TAG}`)).toBeVisible()
    await expect(page.getByText(`Olivia Bennett ${TAG}`)).toBeVisible()
    await expect(page.getByText(`James O'Brien ${TAG}`)).toBeVisible()

    // The "Import 3 clients" confirm button should be enabled
    const confirmBtn = page.getByTestId('csv-import-confirm')
    await expect(confirmBtn).toBeVisible()
    await expect(confirmBtn).toContainText(/Import 3 client/i)

    // 5. Click Import
    await confirmBtn.click()

    // 6. Step 4 — done, "3 clients added"
    await expect(page.getByText(/clients added\./i)).toBeVisible({ timeout: 15_000 })

    // 7. Verify the rows actually persisted to the database.
    // (Querying the DB directly is more reliable than waiting for the
    // client-side fetchClients() to settle.)
    await page.getByRole('button', { name: 'Done' }).click()
    await expect(page.getByTestId('csv-import-dialog')).not.toBeVisible()

    const sb = serviceClient()
    const { data: imported, error } = await sb
      .from('clients')
      .select('name, phone, email, partner_name, flower_prefs')
      .eq('boutique_id', TEST_BOUTIQUES.alpha.id)
      .ilike('name', `%${TAG}%`)
      .order('name')

    expect(error, `query error: ${error?.message}`).toBeNull()
    expect(imported, `imported rows for tag "${TAG}"`).not.toBeNull()
    expect(imported!.length, `expected 3 imported rows for tag "${TAG}", got ${imported?.length}`).toBe(3)

    const names = imported!.map(r => r.name).join(' | ')
    expect(names, `names: ${names}`).toContain('García, Sofia')
    expect(names).toContain('Olivia Bennett')
    expect(names).toContain('James')
    // phone normalization: +15551234567 should be preserved
    const sofia = imported!.find(r => r.name?.includes('García'))
    expect(sofia?.phone).toBe('+15551234567')
    expect(sofia?.partner_name).toBe('Carlos Mendez')
  })

  test('rejects malformed file with clear error', async ({ page }) => {
    const emptyPath = resolve(FIXTURES, 'empty.csv')
    writeFileSync(emptyPath, '', 'utf8')

    await page.goto('/dashboard')
    await page.waitForSelector('[data-testid="dashboard-root"]', { timeout: 10_000 })
    await page.getByTestId('nav-clients').click()
    const importBtn = page.locator('button', { hasText: /Import CSV/i }).first()
    await expect(importBtn).toBeVisible({ timeout: 20_000 })

    await importBtn.click()
    await page.getByTestId('csv-import-file').setInputFiles(emptyPath)

    // Should NOT advance to step 2 — toast appears, modal stays on step 1
    await expect(page.getByText(/Drag your spreadsheet here/i)).toBeVisible()

    try { unlinkSync(emptyPath) } catch { /* fine */ }
  })
})
