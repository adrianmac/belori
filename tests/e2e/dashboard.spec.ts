// Authenticated dashboard smoke — runs as Owner A via storageState.

import { test, expect } from '@playwright/test'

test.describe('Dashboard', () => {
  test('renders for Owner A without crashing', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.getByTestId('dashboard-root')).toBeVisible()
    // The PageErrorBoundary text should NEVER appear on a healthy render
    await expect(page.getByText(/A stitch has come loose/i)).not.toBeVisible()
  })

  test('sidebar navigation links work', async ({ page }) => {
    await page.goto('/dashboard')
    await page.getByTestId('nav-events').click()
    await expect(page.getByTestId('events-new-button')).toBeVisible()

    await page.getByTestId('nav-clients').click()
    await expect(page.getByTestId('clients-new-button')).toBeVisible()

    await page.getByTestId('nav-payments').click()
    await expect(page.getByTestId('payments-create-milestone')).toBeVisible()
  })

  test('command palette opens and closes', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForSelector('[data-testid="dashboard-root"]', { timeout: 5000 })
    await page.waitForTimeout(300)

    // Click the sidebar "Search…" button (the visible entry point most users
    // actually use). The same dialog opens via ⌘K too — testing it via the
    // button is more reliable across browsers/platforms that may intercept
    // Ctrl+K at the chrome level.
    await page.locator('button:has-text("Search…")').first().click()
    await expect(page.getByRole('dialog', { name: /global search/i })).toBeVisible()

    // Esc closes
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: /global search/i })).not.toBeVisible()
  })
})
