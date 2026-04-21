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

  test('command palette opens via ⌘K', async ({ page }) => {
    await page.goto('/dashboard')
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+K' : 'Control+K')
    await expect(page.getByRole('dialog', { name: /global search/i })).toBeVisible()
    // Esc closes
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: /global search/i })).not.toBeVisible()
  })
})
