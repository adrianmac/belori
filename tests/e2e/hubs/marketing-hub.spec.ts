// Marketing hub — verifies module gating and tab switching.
//
// The hub renders only the tabs whose module is enabled. SMS Inbox is
// always available (no module gate). We seed the test boutique with a
// few modules enabled so we can assert the corresponding tabs render
// and the disabled-module tabs are HIDDEN, not just disabled.

import { test, expect } from '@playwright/test'
import { serviceClient, TEST_BOUTIQUES } from '../../fixtures/supabase'

test.describe('Marketing hub', () => {
  test.beforeAll(async () => {
    const sb = serviceClient()
    // Make Reviews + Waitlist available for the test, leave the others off
    await sb.from('boutique_modules').upsert(
      [
        { boutique_id: TEST_BOUTIQUES.alpha.id, module_id: 'reviews',  enabled: true  },
        { boutique_id: TEST_BOUTIQUES.alpha.id, module_id: 'waitlist', enabled: true  },
        // Explicitly disable the rest to make assertions deterministic
        { boutique_id: TEST_BOUTIQUES.alpha.id, module_id: 'photo_gallery',   enabled: false },
        { boutique_id: TEST_BOUTIQUES.alpha.id, module_id: 'email_marketing', enabled: false },
        { boutique_id: TEST_BOUTIQUES.alpha.id, module_id: 'ticketing',       enabled: false },
      ],
      { onConflict: 'boutique_id,module_id' }
    )
  })

  test('only enabled-module tabs are rendered', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForSelector('[data-testid="dashboard-root"]', { timeout: 10_000 })
    await page.getByTestId('nav-marketing_hub').click()

    // SMS always shows; reviews + waitlist were enabled
    await expect(page.getByTestId('marketing-tab-sms')).toBeVisible()
    await expect(page.getByTestId('marketing-tab-reviews')).toBeVisible()
    await expect(page.getByTestId('marketing-tab-waitlist')).toBeVisible()

    // Disabled-module tabs should not be in the DOM at all
    await expect(page.getByTestId('marketing-tab-gallery')).toHaveCount(0)
    await expect(page.getByTestId('marketing-tab-email')).toHaveCount(0)
    await expect(page.getByTestId('marketing-tab-tickets')).toHaveCount(0)
  })

  test('switching tabs swaps the body', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForSelector('[data-testid="dashboard-root"]', { timeout: 10_000 })
    await page.getByTestId('nav-marketing_hub').click()

    await page.getByTestId('marketing-tab-reviews').click()
    await expect(page.getByTestId('marketing-tab-reviews')).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByTestId('marketing-tab-sms')).toHaveAttribute('aria-selected', 'false')
  })
})
