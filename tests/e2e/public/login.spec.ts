// Public-route smoke tests — NO auth required.

import { test, expect } from '@playwright/test'
import { TEST_USERS } from '../../fixtures/supabase'

test.describe('Login', () => {
  test('happy path — Owner A signs in and lands on dashboard', async ({ page }) => {
    await page.goto('/login')

    await expect(page.getByRole('heading', { level: 2 })).toContainText('Bienvenue')
    await page.getByTestId('login-email').fill(TEST_USERS.ownerA.email)
    await page.getByTestId('login-password').fill(TEST_USERS.ownerA.password)
    await page.getByTestId('login-submit').click()

    // Should land on the dashboard (authenticated) within 5s
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 5000 })
    await expect(page.getByTestId('dashboard-root')).toBeVisible()
  })

  test('wrong password — shows editorial error, stays on /login', async ({ page }) => {
    await page.goto('/login')
    await page.getByTestId('login-email').fill(TEST_USERS.ownerA.email)
    await page.getByTestId('login-password').fill('wrong-password-definitely-not-real')
    await page.getByTestId('login-submit').click()

    await expect(page.getByTestId('login-error')).toBeVisible()
    await expect(page).toHaveURL(/\/login/)
  })

  test('page renders couture masthead and ornament', async ({ page }) => {
    await page.goto('/login')
    // Italiana "Belori" wordmark
    await expect(page.getByText('Belori').first()).toBeVisible()
    // "Enter the Atelier" CTA
    await expect(page.getByTestId('login-submit')).toContainText(/Enter the Atelier/i)
  })
})
