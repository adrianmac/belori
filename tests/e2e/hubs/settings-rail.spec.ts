// Settings left-rail — verifies the section headers and per-tab nav
// after the 12-horizontal-tab → 6-grouped-section refactor.

import { test, expect } from '@playwright/test'

test.describe('Settings left-rail', () => {
  test('rail renders with grouped sections + per-tab testids', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForSelector('[data-testid="dashboard-root"]', { timeout: 10_000 })
    await page.getByTestId('nav-settings').click()

    const rail = page.getByTestId('settings-rail')
    await expect(rail).toBeVisible({ timeout: 8_000 })

    // Section headers present (they're rendered as text labels)
    await expect(rail).toContainText(/General/i)
    await expect(rail).toContainText(/Team & access/i)
    await expect(rail).toContainText(/Money/i)
    await expect(rail).toContainText(/Content & automation/i)
    await expect(rail).toContainText(/Public surfaces/i)
    await expect(rail).toContainText(/Data & admin/i)

    // Specific tab buttons reachable by testid (an owner sees all of them)
    for (const id of ['profile','staff','billing','automations','data']) {
      await expect(page.getByTestId(`settings-tab-${id}`)).toBeVisible()
    }
  })

  test('clicking a rail tab swaps the body', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForSelector('[data-testid="dashboard-root"]', { timeout: 10_000 })
    await page.getByTestId('nav-settings').click()

    // Default lands on Profile (Boutique profile card)
    await expect(page.getByText(/Boutique profile/i).first()).toBeVisible({ timeout: 8_000 })

    // Click Data tab — body shows Import / Export / Audit buttons.
    // The card header repeats the strings, so anchor on the button roles.
    await page.getByTestId('settings-tab-data').click()
    await expect(page.getByRole('button', { name: /Import data/i })).toBeVisible({ timeout: 8_000 })
    await expect(page.getByRole('button', { name: /Export data/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Open audit log/i })).toBeVisible()
  })
})
