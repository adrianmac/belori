// InventoryHub — verifies the Catalog/Rentals tab plumbing.
//
// We don't reseed inventory here (the existing bulk-ops tests already
// exercise the underlying screens). This test focuses on hub mechanics.

import { test, expect } from '@playwright/test'
import { serviceClient, TEST_BOUTIQUES } from '../../fixtures/supabase'

test.describe('InventoryHub', () => {
  test.beforeAll(async () => {
    const sb = serviceClient()
    // Ensure both modules that gate the hub are enabled
    await sb.from('boutique_modules').upsert(
      [
        { boutique_id: TEST_BOUTIQUES.alpha.id, module_id: 'decoration',   enabled: true },
        { boutique_id: TEST_BOUTIQUES.alpha.id, module_id: 'dress_rental', enabled: true },
      ],
      { onConflict: 'boutique_id,module_id' }
    )
  })

  test('Catalog ↔ Rentals tab switching', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForSelector('[data-testid="dashboard-root"]', { timeout: 10_000 })
    await page.getByTestId('nav-inventory_hub').click()

    // Both tabs visible
    await expect(page.getByTestId('inventory-hub-tab-catalog')).toBeVisible({ timeout: 8_000 })
    await expect(page.getByTestId('inventory-hub-tab-rentals')).toBeVisible()

    // Click Rentals
    await page.getByTestId('inventory-hub-tab-rentals').click()
    await expect(page.getByTestId('inventory-hub-tab-rentals')).toHaveAttribute('aria-selected', 'true')

    // Click Catalog → search input should appear (it's the Inventory.jsx body)
    await page.getByTestId('inventory-hub-tab-catalog').click()
    await expect(page.getByTestId('inventory-search-input')).toBeVisible({ timeout: 8_000 })
  })
})
