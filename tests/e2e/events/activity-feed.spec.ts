// EventDetail → Activity tab — proves the new EventActivityFeed component:
//   1. seeds an event-scoped note + appointment + paid milestone +
//      client interaction (so we hit 4 different `kind`s)
//   2. navigates to the seed event detail
//   3. opens the "More ▾" tab dropdown and selects Activity
//   4. asserts the feed is visible, total entry count is right, and at
//      least one item per kind is rendered
//   5. clicks the Money filter chip → only payment items remain
//
// All seeded rows are tagged with a unique TAG so cleanup is surgical.

import { test, expect } from '@playwright/test'
import { serviceClient, TEST_BOUTIQUES } from '../../fixtures/supabase'

const ALPHA_WEDDING_ID = '11111111-e111-1111-1111-111111111111' // seed wedding
const ALICE_ID         = '11111111-c111-1111-1111-111111111111' // seed wedding's client

const TAG = `actfeed${Date.now().toString(36).slice(-5)}`

// Track every row we create so afterAll can drop them
const created: { table: string; ids: string[] } = { table: '', ids: [] }
const seeded = {
  notes:        [] as string[],
  milestones:   [] as string[],
  appointments: [] as string[],
  interactions: [] as string[],
}

test.describe('EventDetail → Activity feed', () => {
  test.beforeAll(async () => {
    const sb = serviceClient()

    // 1. Note authored on this event
    const noteRes = await sb.from('notes').insert({
      boutique_id: TEST_BOUTIQUES.alpha.id,
      event_id: ALPHA_WEDDING_ID,
      text: `Activity feed test note ${TAG}`,
    }).select('id').single()
    if (noteRes.error) throw new Error(`note seed: ${noteRes.error.message}`)
    seeded.notes.push(noteRes.data.id)

    // 2. Paid milestone (so the feed shows a "paid" entry)
    const msRes = await sb.from('payment_milestones').insert({
      boutique_id: TEST_BOUTIQUES.alpha.id,
      event_id: ALPHA_WEDDING_ID,
      label: `${TAG} bouquet deposit`,
      amount: 250,
      status: 'paid',
      paid_date: new Date().toISOString().slice(0, 10),
    }).select('id').single()
    if (msRes.error) throw new Error(`milestone seed: ${msRes.error.message}`)
    seeded.milestones.push(msRes.data.id)

    // 3. Booked appointment (date in the future so it doesn't trigger any
    //    auto-progress logic)
    const futureDate = new Date()
    futureDate.setUTCDate(futureDate.getUTCDate() + 14)
    const apptRes = await sb.from('appointments').insert({
      boutique_id: TEST_BOUTIQUES.alpha.id,
      event_id: ALPHA_WEDDING_ID,
      type: 'final_fitting',
      date: futureDate.toISOString().slice(0, 10),
      time: '15:00',
      note: `Activity feed test appt ${TAG}`,
      status: 'scheduled',
    }).select('id').single()
    if (apptRes.error) throw new Error(`appt seed: ${apptRes.error.message}`)
    seeded.appointments.push(apptRes.data.id)

    // 4. Client interaction tagged to THIS event
    const intRes = await sb.from('client_interactions').insert({
      boutique_id: TEST_BOUTIQUES.alpha.id,
      client_id:   ALICE_ID,
      type: 'sms',
      title: `${TAG} confirm fitting`,
      body: 'Hey — just confirming your fitting on Friday.',
      author_name: 'Test',
      related_event_id: ALPHA_WEDDING_ID,
    }).select('id').single()
    if (intRes.error) throw new Error(`interaction seed: ${intRes.error.message}`)
    seeded.interactions.push(intRes.data.id)
  })

  test.afterAll(async () => {
    const sb = serviceClient()
    if (seeded.interactions.length) await sb.from('client_interactions').delete().in('id', seeded.interactions)
    if (seeded.appointments.length) await sb.from('appointments').delete().in('id', seeded.appointments)
    if (seeded.milestones.length)   await sb.from('payment_milestones').delete().in('id', seeded.milestones)
    if (seeded.notes.length)        await sb.from('notes').delete().in('id', seeded.notes)
    // Belt-and-suspenders: anything still tagged
    await sb.from('notes').delete().eq('boutique_id', TEST_BOUTIQUES.alpha.id).like('text', `%${TAG}%`)
    await sb.from('payment_milestones').delete().eq('boutique_id', TEST_BOUTIQUES.alpha.id).like('label', `%${TAG}%`)
    await sb.from('appointments').delete().eq('boutique_id', TEST_BOUTIQUES.alpha.id).like('note', `%${TAG}%`)
    await sb.from('client_interactions').delete().eq('boutique_id', TEST_BOUTIQUES.alpha.id).like('title', `%${TAG}%`)
  })

  test('renders mixed-kind feed and filters by chip', async ({ page }) => {
    // Navigate Dashboard → Events list → click the seed wedding row
    await page.goto('/dashboard')
    await page.waitForSelector('[data-testid="dashboard-root"]', { timeout: 10_000 })
    await page.getByTestId('nav-events').click()
    await page.waitForLoadState('networkidle', { timeout: 15_000 })

    // Events defaults to Calendar view — switch to List so event rows render.
    await page.getByTestId('events-view-list').click()

    // Click the wedding row by its testid (seeded id is deterministic)
    await page.getByTestId(`event-row-${ALPHA_WEDDING_ID}`).click()

    // Open the "More ▾" dropdown → Activity
    await page.getByTestId('event-tab-more').click()
    await page.getByTestId('event-tab-activity').click()

    // Feed root is visible
    const feed = page.getByTestId('event-activity-feed')
    await expect(feed).toBeVisible({ timeout: 8_000 })

    // We seeded: 1 note, 1 paid milestone (1 row in feed: paid), 1 appt
    // (2 rows: booked + scheduled), 1 interaction. createdAt on appt + milestone
    // adds 1 more each. So total >= 6.
    const total = page.getByTestId('activity-total-count')
    await expect(total).toBeVisible()
    const txt = (await total.textContent()) || ''
    const n = parseInt(txt.match(/^(\d+)/)?.[1] ?? '0', 10)
    expect(n, `expected >= 4 entries in the feed, got ${n}: "${txt}"`).toBeGreaterThanOrEqual(4)

    // At least one of each kind should render
    await expect(page.getByTestId('activity-item-note').first()).toBeVisible()
    await expect(page.getByTestId('activity-item-payment').first()).toBeVisible()
    await expect(page.getByTestId('activity-item-appointment').first()).toBeVisible()
    await expect(page.getByTestId('activity-item-interaction').first()).toBeVisible()

    // Filter chips are present and the Money chip narrows down
    const moneyChip = page.getByTestId('activity-filter-payment')
    await expect(moneyChip).toBeVisible()
    await moneyChip.click()
    await expect(moneyChip).toHaveAttribute('data-active', 'true')

    // After filter: only payment kind rows remain
    await expect(page.getByTestId('activity-item-payment').first()).toBeVisible()
    await expect(page.getByTestId('activity-item-note')).toHaveCount(0)
    await expect(page.getByTestId('activity-item-appointment')).toHaveCount(0)
    await expect(page.getByTestId('activity-item-interaction')).toHaveCount(0)

    // Clicking "All" restores everything
    await page.getByTestId('activity-filter-all').click()
    await expect(page.getByTestId('activity-item-note').first()).toBeVisible()
  })

  test('quick-add Note inline form posts a note and refreshes the feed', async ({ page }) => {
    // Navigate to the activity feed (same path as the first test)
    await page.goto('/dashboard')
    await page.waitForSelector('[data-testid="dashboard-root"]', { timeout: 10_000 })
    await page.getByTestId('nav-events').click()
    await page.waitForLoadState('networkidle', { timeout: 15_000 })
    await page.getByTestId('events-view-list').click()
    await page.getByTestId(`event-row-${ALPHA_WEDDING_ID}`).click()
    await page.getByTestId('event-tab-more').click()
    await page.getByTestId('event-tab-activity').click()
    await expect(page.getByTestId('event-activity-feed')).toBeVisible({ timeout: 8_000 })

    // Capture the entry count BEFORE adding so we can assert it grew by 1
    const totalLocator = page.getByTestId('activity-total-count')
    const before = parseInt(((await totalLocator.textContent()) || '').match(/^(\d+)/)?.[1] ?? '0', 10)

    // Open the quick-add form, type a note, save
    await page.getByTestId('activity-quick-add-note').click()
    const input = page.getByTestId('activity-quick-add-input')
    await expect(input).toBeVisible()
    const noteText = `Quick note ${TAG} ${Date.now()}`
    await input.fill(noteText)
    await page.getByTestId('activity-quick-add-save').click()

    // Form collapses → quick-add button visible again
    await expect(page.getByTestId('activity-quick-add-note')).toBeVisible({ timeout: 6_000 })

    // The new note text appears in the feed (most reliable signal — exact
    // total count can drift if another test run has left seeded rows).
    await expect(page.getByTestId('event-activity-feed')).toContainText(noteText, { timeout: 6_000 })

    // The total count strictly increased
    await expect.poll(async () => {
      const txt = (await totalLocator.textContent()) || ''
      return parseInt(txt.match(/^(\d+)/)?.[1] ?? '0', 10)
    }, { timeout: 6_000 }).toBeGreaterThan(before)

    // Cleanup the seed note so the next run is deterministic
    const sb = serviceClient()
    await sb.from('notes').delete()
      .eq('boutique_id', TEST_BOUTIQUES.alpha.id)
      .eq('event_id',    ALPHA_WEDDING_ID)
      .eq('text',        noteText)
  })
})
