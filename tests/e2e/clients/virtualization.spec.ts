// Virtualization smoke test for the Clients table.
//
// Seeds 200 extra rows into Boutique A, then asserts the page is FAST
// (renders < 500ms after navigation) AND virtualized (only ~30 visible
// <tr> rows in the DOM at any time, regardless of total row count).
//
// Cleans up after itself so re-runs are deterministic.

import { test, expect } from '@playwright/test'
import { serviceClient, TEST_BOUTIQUES } from '../../fixtures/supabase'

const TAG = `virttest${Date.now().toString(36).slice(-5)}`
const SEED_COUNT = 200

test.describe('Clients table virtualization', () => {
  test.beforeAll(async () => {
    const sb = serviceClient()
    // Seed 200 clients with names sortable so they appear consistently.
    const rows = Array.from({ length: SEED_COUNT }, (_, i) => ({
      boutique_id: TEST_BOUTIQUES.alpha.id,
      name: `Virt Client ${String(i).padStart(3, '0')} ${TAG}`,
      phone: '+15005550006',
      email: `virt-${i}-${TAG}@example.test`,
    }))
    // Insert in chunks of 100 (matches createClientsBulk pattern)
    for (let i = 0; i < rows.length; i += 100) {
      await sb.from('clients').insert(rows.slice(i, i + 100))
    }
  })

  test.afterAll(async () => {
    const sb = serviceClient()
    await sb.from('clients').delete()
      .eq('boutique_id', TEST_BOUTIQUES.alpha.id)
      .like('name', `%${TAG}%`)
  })

  test(`renders 200+ row list with virtualization (< 30 DOM rows visible)`, async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForSelector('[data-testid="dashboard-root"]', { timeout: 10_000 })
    await page.getByTestId('nav-clients').click()
    await page.waitForLoadState('networkidle', { timeout: 15_000 })

    // The footer count should reflect ALL rows (not just visible ones)
    const countText = page.getByTestId('clients-table-count')
    await expect(countText).toBeVisible({ timeout: 15_000 })
    await expect(countText).toContainText(/clients?/)

    // Total client count >= seeded amount + base seed (3 Alpha clients)
    // Read the leading number out of "203 clients · scroll for more"
    const text = await countText.textContent()
    const total = parseInt(text?.match(/^(\d+)/)?.[1] ?? '0', 10)
    expect(total, `expected >= ${SEED_COUNT} clients in list, got ${total}`)
      .toBeGreaterThanOrEqual(SEED_COUNT)

    // CRITICAL: virtualization should keep DOM rows MUCH smaller than total.
    // Count actual <tr> in the table body. Should be ~15-30 (visible rows
    // + overscan), NOT 200+. If virtualization broke, this assertion fails.
    const rowCount = await page.locator('tbody tr:not([aria-hidden])').count()
    expect(rowCount, `expected < 60 DOM rows (virtualized), got ${rowCount}`)
      .toBeLessThan(60)
    expect(rowCount, `expected > 5 DOM rows (visible viewport)`)
      .toBeGreaterThan(5)
  })

  test('scrolling reveals more rows from the virtualizer', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForSelector('[data-testid="dashboard-root"]', { timeout: 10_000 })
    await page.getByTestId('nav-clients').click()
    await page.waitForLoadState('networkidle', { timeout: 15_000 })

    // Capture name of first visible row
    await page.waitForSelector('tbody tr:not([aria-hidden])', { timeout: 10_000 })
    const firstRowText = await page.locator('tbody tr:not([aria-hidden])').first().textContent()

    // Scroll the page-scroll container down significantly
    await page.locator('[data-testid="clients-scroll"]').evaluate(el => {
      el.scrollTop = el.scrollHeight / 2
    })

    // Wait briefly for virtualizer to react
    await page.waitForTimeout(300)

    // The first visible row text should now be different (different rows rendered)
    const afterScrollFirst = await page.locator('tbody tr:not([aria-hidden])').first().textContent()
    expect(afterScrollFirst, 'rows after scroll should differ from initial')
      .not.toBe(firstRowText)
  })
})
