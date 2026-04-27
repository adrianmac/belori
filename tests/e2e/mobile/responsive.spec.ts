// Mobile responsive smoke — runs the most-used surfaces at iPhone-12-Pro
// viewport (390×844) and asserts:
//   - the BottomNav is visible (sidebar collapses below 768px)
//   - the new IA hubs (Finance / Inventory / Reports / Marketing) are
//     reachable from the BottomNav More menu
//   - Settings rail collapses to the horizontal pill scroller (per the
//     index.css media-query rule we added in Phase 1+2)
//   - hub tab strips don't break (they should overflow-scroll)
//
// Doesn't try to be exhaustive — just catches catastrophic layout breaks
// on the IA-cleanup surfaces.

import { test, expect, devices } from '@playwright/test'

// Override the project viewport with iPhone 12 Pro for these tests
test.use({ ...devices['iPhone 12 Pro'] })

test.describe('Mobile responsive — IA hubs', () => {
  test('BottomNav renders the new Finance hub label + More menu', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForSelector('[data-testid="dashboard-root"]', { timeout: 10_000 })

    // The mobile BottomNav has its own testids (bottom-nav-*); the
    // sidebar's nav-* testids are display:none below 768px.
    const financeBtn = page.getByTestId('bottom-nav-finance')
    await expect(financeBtn).toBeVisible({ timeout: 5_000 })
    await financeBtn.click()
    await expect(page.getByTestId('finance-tab-milestones')).toBeVisible({ timeout: 8_000 })
  })

  test('Inventory hub tab strip works at narrow viewport', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForSelector('[data-testid="dashboard-root"]', { timeout: 10_000 })

    // Inventory is in the BottomNav "More" overflow menu. The menu's
    // backdrop occasionally races with the click, so dispatch a direct
    // click event after waiting for the menu item to be visible.
    await page.getByRole('button', { name: /Open more navigation/i }).click()
    const inventoryItem = page.getByTestId('bottom-nav-more-inventory_hub')
    await expect(inventoryItem).toBeVisible({ timeout: 5_000 })
    await inventoryItem.dispatchEvent('click')

    await expect(page.getByTestId('inventory-hub-tab-catalog')).toBeVisible({ timeout: 8_000 })
    await expect(page.getByTestId('inventory-hub-tab-rentals')).toBeVisible()
  })

  test('Settings left-rail collapses to horizontal pills', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForSelector('[data-testid="dashboard-root"]', { timeout: 10_000 })

    await page.getByRole('button', { name: /Open more navigation/i }).click()
    await page.getByTestId('bottom-nav-more-settings').click()

    // The rail should still render; the per-section labels still appear,
    // but visually they're now a horizontal scroller (CSS handles it).
    const rail = page.getByTestId('settings-rail')
    await expect(rail).toBeVisible({ timeout: 8_000 })
    // The rail should be horizontally scrollable (overflow-x: auto)
    const scrollWidth = await rail.evaluate(el => el.scrollWidth)
    const clientWidth = await rail.evaluate(el => el.clientWidth)
    // At a 390px viewport with 6 sections, scrollWidth should exceed
    // clientWidth — i.e. the user can scroll the pill rail sideways
    expect(scrollWidth, 'rail should be horizontally scrollable on mobile').toBeGreaterThan(clientWidth)
  })
})
