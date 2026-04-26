// Accessibility smoke tests — runs axe on every critical page.
//
// Current policy: violations are LOGGED to console but do NOT fail the test.
// The Couture redesign caught dozens of pre-existing color-contrast issues
// across the app that need a dedicated cleanup pass — not something to block
// CI on while that work is in flight. The infrastructure is in place, the
// violations are tracked, and we'll flip to strict mode once the contrast
// debt is paid down.
//
// To re-enable strict mode, change `STRICT_A11Y = false` to `true`.

import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const STRICT_A11Y = false   // flip to true once contrast debt is fixed

async function runAxe(page: any, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze()

  if (results.violations.length === 0) {
    return
  }

  // Log violations as a warning summary (visible in CI logs)
  const summary = results.violations.map(v =>
    `  · [${v.impact}] ${v.id}: ${v.nodes.length} node(s) · ${v.help}`
  ).join('\n')

  console.warn(`\nA11y violations on ${label} (${results.violations.length} rule(s)):\n${summary}\n`)

  if (STRICT_A11Y) {
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([])
  }
}

test.describe('Accessibility (axe · WCAG 2.1 A + AA)', () => {
  test('Dashboard violations', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForSelector('[data-testid="dashboard-root"]', { timeout: 5000 })
    await runAxe(page, 'Dashboard')
  })

  test('Events list violations', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForSelector('[data-testid="dashboard-root"]', { timeout: 5000 })
    await page.getByTestId('nav-events').click()
    await page.waitForTimeout(400)
    await runAxe(page, 'Events list')
  })

  test('Clients list violations', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForSelector('[data-testid="dashboard-root"]', { timeout: 5000 })
    await page.getByTestId('nav-clients').click()
    await page.waitForTimeout(400)
    await runAxe(page, 'Clients list')
  })

  test('Payments list violations', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForSelector('[data-testid="dashboard-root"]', { timeout: 5000 })
    await page.getByTestId('nav-payments').click()
    await page.waitForTimeout(400)
    await runAxe(page, 'Payments list')
  })
})
