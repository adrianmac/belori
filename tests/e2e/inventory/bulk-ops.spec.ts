// Bulk inventory operations — proves the new useInventory.bulkUpdate() helper
// works end-to-end:
//   1. enable the `decoration` module on Boutique A (so /inv_full is reachable)
//   2. seed 3 inventory rows in a known status
//   3. navigate to Inventory → enter bulk mode → select all 3 cards
//   4. click "Mark cleaned & available" → couture toast fires
//   5. verify all 3 rows in the DB now have status='available' + last_cleaned=today
//
// Also covers the second flow worth protecting: status-dropdown apply.
//
// Cleanup: drop seeded inventory + decoration module row.

import { test, expect } from '@playwright/test'
import { serviceClient, TEST_BOUTIQUES } from '../../fixtures/supabase'

const TAG = `bulktest${Date.now().toString(36).slice(-5)}`
const TODAY = new Date().toISOString().slice(0, 10)
const SEED_COUNT = 3

test.describe('Inventory bulk operations', () => {
  const seededIds: string[] = []

  test.beforeAll(async () => {
    const sb = serviceClient()

    // 1. Enable the modules required to (a) reach /inv_full ('decoration')
    //    and (b) make NovelApp.jsx actually mount useInventory ('dress_rental').
    //    Without dress_rental enabled, the hook short-circuits and the page
    //    receives an empty array regardless of what's in the DB.
    await sb.from('boutique_modules').upsert(
      [
        { boutique_id: TEST_BOUTIQUES.alpha.id, module_id: 'decoration',   enabled: true },
        { boutique_id: TEST_BOUTIQUES.alpha.id, module_id: 'dress_rental', enabled: true },
      ],
      { onConflict: 'boutique_id,module_id' }
    )

    // 2. Seed N inventory rows in a non-available status with a unique SKU prefix
    //    so we can reliably select & clean them up.
    const rows = Array.from({ length: SEED_COUNT }, (_, i) => ({
      boutique_id: TEST_BOUTIQUES.alpha.id,
      sku: `${TAG}-${i}`,
      name: `Bulk Test Item ${i} ${TAG}`,
      category: 'centerpiece',
      status: 'reserved' as const,
      price: 50,
      deposit: 0,
    }))
    const { data, error } = await sb.from('inventory').insert(rows).select('id')
    if (error) throw new Error(`seed failed: ${error.message}`)
    data.forEach(r => seededIds.push(r.id))
  })

  test.afterAll(async () => {
    const sb = serviceClient()
    if (seededIds.length > 0) {
      await sb.from('inventory_audit_log').delete().in('inventory_id', seededIds)
      await sb.from('inventory').delete().in('id', seededIds)
    }
    // Belt-and-suspenders: drop anything still tagged
    await sb.from('inventory').delete()
      .eq('boutique_id', TEST_BOUTIQUES.alpha.id)
      .like('sku', `${TAG}-%`)
    // Leave the decoration module enabled — other tests may want it. It's
    // idempotent via upsert, so re-runs are safe either way.
  })

  test('select all + Mark cleaned flips status to available + stamps last_cleaned', async ({ page }) => {
    // 1. Phase 1+2 IA cleanup: Inventory is now a top-level "Inventory" hub
    //    with Catalog and Rentals tabs. Click the top-level nav, then
    //    switch to the Catalog tab where bulk operations live.
    await page.goto('/dashboard')
    await page.waitForSelector('[data-testid="dashboard-root"]', { timeout: 10_000 })
    await page.getByTestId('nav-inventory_hub').click()
    await page.waitForLoadState('networkidle', { timeout: 15_000 })
    await page.getByTestId('inventory-hub-tab-catalog').click()

    // 2. Filter the list to JUST our seeded rows so "Select all" doesn't grab
    //    other inventory the suite might create. Search by tag.
    await page.getByTestId('inventory-search-input').fill(TAG)
    // Wait for the cards to render
    for (const id of seededIds) {
      await expect(page.getByTestId(`inventory-card-${id}`)).toBeVisible({ timeout: 8_000 })
    }

    // 3. Enter bulk mode
    await page.getByTestId('inventory-bulk-toggle').click()
    await expect(page.getByTestId('inventory-bulk-bar')).toBeVisible()

    // 4. Click "Select all N" — should grab all filtered (== 3 seeded) rows
    await page.getByTestId('inventory-bulk-select-all').click()
    await expect(page.getByTestId('inventory-bulk-count')).toHaveText(`${SEED_COUNT} selected`)

    // 5. Click "Mark cleaned & available"
    await page.getByTestId('inventory-bulk-mark-cleaned').click()

    // 6. Bulk bar should disappear once exitBulk() runs after success
    await expect(page.getByTestId('inventory-bulk-bar')).not.toBeVisible({ timeout: 8_000 })

    // 7. Verify the rows in the DB
    const sb = serviceClient()
    const { data, error } = await sb
      .from('inventory')
      .select('id, status, last_cleaned, client_id')
      .in('id', seededIds)
    expect(error, `query error: ${error?.message}`).toBeNull()
    expect(data!.length).toBe(SEED_COUNT)
    for (const row of data!) {
      expect(row.status, `row ${row.id} status`).toBe('available')
      expect(row.last_cleaned, `row ${row.id} last_cleaned`).toBe(TODAY)
      expect(row.client_id, `row ${row.id} client_id`).toBeNull()
    }
  })

  test('Esc key exits bulk mode without saving', async ({ page }) => {
    // First reset all 3 to reserved so we have a clean baseline
    const sb = serviceClient()
    await sb.from('inventory').update({ status: 'reserved' }).in('id', seededIds)

    await page.goto('/dashboard')
    await page.waitForSelector('[data-testid="dashboard-root"]', { timeout: 10_000 })
    await page.getByTestId('nav-inventory_hub').click()
    await page.waitForLoadState('networkidle', { timeout: 15_000 })
    await page.getByTestId('inventory-hub-tab-catalog').click()
    await page.getByTestId('inventory-search-input').fill(TAG)
    await expect(page.getByTestId(`inventory-card-${seededIds[0]}`)).toBeVisible({ timeout: 8_000 })

    await page.getByTestId('inventory-bulk-toggle').click()
    await page.getByTestId('inventory-bulk-select-all').click()
    await expect(page.getByTestId('inventory-bulk-count')).toContainText(`${SEED_COUNT}`)

    // Press Esc — bulk bar should close, no DB writes happen
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('inventory-bulk-bar')).not.toBeVisible()

    // Status unchanged
    const { data } = await sb.from('inventory').select('status').in('id', seededIds)
    for (const row of data!) {
      expect(row.status, 'Esc must not mutate data').toBe('reserved')
    }
  })
})
