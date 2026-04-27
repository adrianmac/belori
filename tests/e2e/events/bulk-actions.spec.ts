// Events list bulk actions — proves the multi-select status flip works
// end-to-end. The functionality already exists; this is regression
// coverage for future refactors.
//
// Flow:
//   1. seed two extra events on Boutique A so we have ≥ 3 events to
//      multi-select (the seed already has 2 events on Alpha)
//   2. navigate to Events → List view
//   3. tick the row checkboxes for the 2 seeded events
//   4. assert the bulk action bar shows "✓ 2 selected"
//   5. open Change status menu → click Cancelled
//   6. verify both seeded events are now status='cancelled' in the DB

import { test, expect } from '@playwright/test'
import { serviceClient, TEST_BOUTIQUES } from '../../fixtures/supabase'

const TAG = `evbulk${Date.now().toString(36).slice(-5)}`

test.describe('Events list bulk actions', () => {
  const seededIds: string[] = []

  test.beforeAll(async () => {
    const sb = serviceClient()
    const ALPHA_CLIENT = '11111111-c111-1111-1111-111111111111' // Alice from seed
    const ALPHA_COORDINATOR = '0000aaaa-0000-4000-a000-00000000000b'

    const futureA = new Date(); futureA.setUTCDate(futureA.getUTCDate() + 100)
    const futureB = new Date(); futureB.setUTCDate(futureB.getUTCDate() + 110)
    const rows = [
      {
        boutique_id: TEST_BOUTIQUES.alpha.id,
        client_id:   ALPHA_CLIENT,
        coordinator_id: ALPHA_COORDINATOR,
        type: 'wedding',
        event_date: futureA.toISOString().slice(0, 10),
        venue: `Bulk Test Venue A ${TAG}`,
        guests: 50,
        status: 'active',
        total: 1000,
        paid: 0,
      },
      {
        boutique_id: TEST_BOUTIQUES.alpha.id,
        client_id:   ALPHA_CLIENT,
        coordinator_id: ALPHA_COORDINATOR,
        type: 'wedding',
        event_date: futureB.toISOString().slice(0, 10),
        venue: `Bulk Test Venue B ${TAG}`,
        guests: 60,
        status: 'active',
        total: 1500,
        paid: 0,
      },
    ]
    const { data, error } = await sb.from('events').insert(rows).select('id')
    if (error) throw new Error(`seed: ${error.message}`)
    data.forEach(r => seededIds.push(r.id))
  })

  test.afterAll(async () => {
    const sb = serviceClient()
    if (seededIds.length) {
      // Clean up all per-event children before deleting the events themselves
      await sb.from('appointments').delete().in('event_id', seededIds)
      await sb.from('payment_milestones').delete().in('event_id', seededIds)
      await sb.from('tasks').delete().in('event_id', seededIds)
      await sb.from('notes').delete().in('event_id', seededIds)
      await sb.from('events').delete().in('id', seededIds)
    }
  })

  test('multi-select 2 events + bulk-mark them cancelled', async ({ page }) => {
    // Navigate Dashboard → Events → List view
    await page.goto('/dashboard')
    await page.waitForSelector('[data-testid="dashboard-root"]', { timeout: 10_000 })
    await page.getByTestId('nav-events').click()
    await page.waitForLoadState('networkidle', { timeout: 15_000 })
    await page.getByTestId('events-view-list').click()

    // The 2 seeded rows should be present
    for (const id of seededIds) {
      await expect(page.getByTestId(`event-row-${id}`)).toBeVisible({ timeout: 8_000 })
    }

    // Tick the row-level checkboxes (use force:true because the checkboxes
    // sit inside a column whose opacity transitions to 1 only after a row
    // is selected — Playwright's actionability check sometimes flags the
    // initial 0-opacity state)
    for (const id of seededIds) {
      await page.getByTestId(`event-row-select-${id}`).check({ force: true })
    }

    // Bulk action bar should appear with "✓ 2 selected"
    const bulkBar = page.getByTestId('events-bulk-bar')
    await expect(bulkBar).toBeVisible({ timeout: 5_000 })
    await expect(page.getByTestId('events-bulk-count')).toContainText(/2 selected/i)

    // Open the status menu and click Cancelled
    await page.getByTestId('events-bulk-status-toggle').click()
    await page.getByTestId('events-bulk-status-cancelled').click()

    // Bar should clear after success
    await expect(bulkBar).not.toBeVisible({ timeout: 8_000 })

    // Verify in DB — both seeded rows are now status='cancelled'
    const sb = serviceClient()
    const { data, error } = await sb
      .from('events')
      .select('id, status')
      .in('id', seededIds)
    expect(error, `query: ${error?.message}`).toBeNull()
    expect(data!.length).toBe(2)
    for (const r of data!) {
      expect(r.status, `event ${r.id} should be cancelled`).toBe('cancelled')
    }
  })
})
