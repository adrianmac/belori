// Accessibility smoke test — runs axe on every critical page and fails on
// any WCAG AA (or A) violation. Complements the manual a11y review from the
// Couture Atelier design pass.

import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

async function runAxe(page: any, url: string) {
  await page.goto(url)
  // Wait until the page has mounted its main content anchor
  await page.waitForSelector('[id="main-content"], [data-testid="dashboard-root"], form, main', { timeout: 5000 })
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze()
  return results
}

test.describe('Accessibility (axe · WCAG 2.1 A + AA)', () => {
  test('Dashboard has no violations', async ({ page }) => {
    const results = await runAxe(page, '/dashboard')
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([])
  })

  test('Events list has no violations', async ({ page }) => {
    const results = await runAxe(page, '/dashboard')   // goto dashboard first (authed)
    await page.getByTestId('nav-events').click()
    await page.waitForTimeout(400)  // allow lazy route to mount
    const afterNav = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
    expect(afterNav.violations, JSON.stringify(afterNav.violations, null, 2)).toEqual([])
  })

  test('Clients list has no violations', async ({ page }) => {
    await page.goto('/dashboard')
    await page.getByTestId('nav-clients').click()
    await page.waitForTimeout(400)
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([])
  })

  test('Payments list has no violations', async ({ page }) => {
    await page.goto('/dashboard')
    await page.getByTestId('nav-payments').click()
    await page.waitForTimeout(400)
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([])
  })
})
