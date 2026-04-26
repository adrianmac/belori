// Bulk archive — proves the new "Archive" action:
//   1. seeds 2 inventory rows
//   2. enables Inventory page modules
//   3. selects them, clicks "Archive"
//   4. verifies status='archived' in the DB
//   5. confirms the archived items are HIDDEN from the default view
//   6. confirms switching the status filter to "Archived" reveals them
//
// Skips itself with a clear note if the database hasn't had the
// 20260426_inventory_archive_status.sql migration applied yet — the
// constraint will reject the value at insert time.

import { test, expect } from '@playwright/test'
import { serviceClient, TEST_BOUTIQUES } from '../../fixtures/supabase'

const TAG = `archtest${Date.now().toString(36).slice(-5)}`
const SEED_COUNT = 2
let migrationApplied = true

test.describe('Inventory bulk archive', () => {
  const seededIds: string[] = []

  test.beforeAll(async () => {
    const sb = serviceClient()

    // Pre-flight: probe the constraint. If 'archived' is rejected, mark the
    // suite to skip gracefully so this E2E doesn't block the rest of the run
    // when the migration hasn't been applied to test yet.
    const probe = await sb.from('inventory').insert({
      boutique_id: TEST_BOUTIQUES.alpha.id,
      sku: `${TAG}-probe`,
      name: 'archive probe',
      category: 'centerpiece',
      status: 'archived',
      price: 0,
      deposit: 0,
    }).select('id').single()
    if (probe.error) {
      // CHECK constraint rejects 'archived' → migration not applied
      migrationApplied = false
      return
    }
    // Probe succeeded — clean it up immediately, we'll seed the real rows below
    await sb.from('inventory').delete().eq('id', probe.data.id)

    // Modules required for the inventory page to render
    await sb.from('boutique_modules').upsert(
      [
        { boutique_id: TEST_BOUTIQUES.alpha.id, module_id: 'decoration',   enabled: true },
        { boutique_id: TEST_BOUTIQUES.alpha.id, module_id: 'dress_rental', enabled: true },
      ],
      { onConflict: 'boutique_id,module_id' }
    )

    const rows = Array.from({ length: SEED_COUNT }, (_, i) => ({
      boutique_id: TEST_BOUTIQUES.alpha.id,
      sku: `${TAG}-${i}`,
      name: `Archive Test Item ${i} ${TAG}`,
      category: 'centerpiece',
      status: 'available' as const,
      price: 50,
      deposit: 0,
    }))
    const { data, error } = await sb.from('inventory').insert(rows).select('id')
    if (error) throw new Error(`seed: ${error.message}`)
    data.forEach(r => seededIds.push(r.id))
  })

  test.afterAll(async () => {
    const sb = serviceClient()
    if (seededIds.length) {
      await sb.from('inventory_audit_log').delete().in('inventory_id', seededIds)
      await sb.from('inventory').delete().in('id', seededIds)
    }
    await sb.from('inventory').delete()
      .eq('boutique_id', TEST_BOUTIQUES.alpha.id)
      .like('sku', `${TAG}-%`)
  })

  test('select + Archive flips status, hides from default view, reveals via filter', async ({ page }) => {
    test.skip(
      !migrationApplied,
      'Migration 20260426_inventory_archive_status.sql not applied to this database yet. Apply it via the Supabase SQL editor and re-run.'
    )

    // Phase 1+2 IA cleanup: Inventory is a top-level hub. Click the nav
    // item and select the Catalog tab where bulk archive lives.
    await page.goto('/dashboard')
    await page.waitForSelector('[data-testid="dashboard-root"]', { timeout: 10_000 })
    await page.getByTestId('nav-inventory_hub').click()
    await page.waitForLoadState('networkidle', { timeout: 15_000 })
    await page.getByTestId('inventory-hub-tab-catalog').click()

    // Filter by tag so only our 2 rows show
    await page.getByTestId('inventory-search-input').fill(TAG)
    for (const id of seededIds) {
      await expect(page.getByTestId(`inventory-card-${id}`)).toBeVisible({ timeout: 8_000 })
    }

    // Bulk select + archive
    await page.getByTestId('inventory-bulk-toggle').click()
    await page.getByTestId('inventory-bulk-select-all').click()
    await expect(page.getByTestId('inventory-bulk-count')).toHaveText(`${SEED_COUNT} selected`)
    await page.getByTestId('inventory-bulk-archive').click()
    await expect(page.getByTestId('inventory-bulk-bar')).not.toBeVisible({ timeout: 8_000 })

    // DB: status flipped to 'archived'
    const sb = serviceClient()
    const { data: rows } = await sb
      .from('inventory')
      .select('id, status, client_id')
      .in('id', seededIds)
    expect(rows!.length).toBe(SEED_COUNT)
    for (const r of rows!) {
      expect(r.status, `row ${r.id}`).toBe('archived')
      expect(r.client_id, `row ${r.id} client_id`).toBeNull()
    }

    // The archived rows should now be HIDDEN from the default view (search
    // is still applied, but matchesArchive filter excludes them).
    await expect(page.getByTestId(`inventory-card-${seededIds[0]}`))
      .not.toBeVisible({ timeout: 5_000 })

    // Switch the status filter to "Archived" → they reappear
    await page.getByTestId('inventory-status-filter').selectOption('archived')
    for (const id of seededIds) {
      await expect(page.getByTestId(`inventory-card-${id}`)).toBeVisible({ timeout: 8_000 })
    }
  })
})
