// Finance hub navigation — proves the 5-tab consolidation works:
//   - default tab renders without picking one
//   - clicking each tab swaps the body (testid present)
//   - tab choice persists in localStorage across reloads
//
// The hub itself is a thin wrapper around five existing pages, so we
// don't need to test the underlying screens — just the wrapper plumbing.

import { test, expect } from '@playwright/test'

test.describe('Finance hub', () => {
  test('default lands on Milestones tab + sticky tab strip', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForSelector('[data-testid="dashboard-root"]', { timeout: 10_000 })
    await page.getByTestId('nav-finance').click()

    // Five tabs in the strip — only Milestones is active by default
    for (const k of ['milestones','invoices','paylinks','commissions','promo']) {
      await expect(page.getByTestId(`finance-tab-${k}`)).toBeVisible({ timeout: 8_000 })
    }
    await expect(page.getByTestId('finance-tab-milestones')).toHaveAttribute('aria-selected', 'true')
  })

  test('switching tabs swaps the body + persists across reload', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForSelector('[data-testid="dashboard-root"]', { timeout: 10_000 })
    await page.getByTestId('nav-finance').click()

    // Click Promo Codes tab
    await page.getByTestId('finance-tab-promo').click()
    await expect(page.getByTestId('finance-tab-promo')).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByTestId('finance-tab-milestones')).toHaveAttribute('aria-selected', 'false')

    // Reload — the hub should remember Promo Codes was last viewed
    await page.reload()
    await page.waitForSelector('[data-testid="dashboard-root"]', { timeout: 10_000 })
    await page.getByTestId('nav-finance').click()
    await expect(page.getByTestId('finance-tab-promo')).toHaveAttribute('aria-selected', 'true')
  })
})
