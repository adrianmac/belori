// Mirror of double-book.spec.ts but exercises the EventDetail "Add date"
// modal instead of the StandaloneAppointmentModal. Both call the same
// shared findAppointmentConflicts() helper but through different React
// trees and different state machines, so they need their own E2E.
//
// Flow:
//   1. seed an appointment for the Alpha wedding's coordinator at a
//      specific date+time
//   2. open the wedding via Events → List → row
//   3. click "+ Add date" / open the Add Date modal
//   4. fill in the SAME date+time+staff
//   5. click "Add date" → expect the couture conflict warning to appear
//      and the button to flip to "Book anyway"
//   6. click "Book anyway" → row persists in DB

import { test, expect } from '@playwright/test'
import { serviceClient, TEST_BOUTIQUES } from '../../fixtures/supabase'

const ALPHA_WEDDING_ID  = '11111111-e111-1111-1111-111111111111'
const ALPHA_COORDINATOR = '0000aaaa-0000-4000-a000-00000000000b' // Alpha Coordinator member id

function uniqueDate(): string {
  // 28 days out — far enough not to collide with anything else the suite seeds
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + 28)
  return d.toISOString().slice(0, 10)
}
const TEST_DATE  = uniqueDate()
const TEST_TIME  = '13:23'   // odd minute for collision-resistance
const TAG = `evdetbook${Date.now().toString(36).slice(-5)}`

test.describe('EventDetail → Add Date conflict detection', () => {
  const createdIds: string[] = []

  test.beforeAll(async () => {
    const sb = serviceClient()
    const seed = await sb.from('appointments').insert({
      boutique_id: TEST_BOUTIQUES.alpha.id,
      event_id: ALPHA_WEDDING_ID,
      type: 'measurement',
      date: TEST_DATE,
      time: TEST_TIME,
      note: `seed conflict ${TAG}`,
      staff_id: ALPHA_COORDINATOR,
      status: 'scheduled',
    }).select('id').single()
    if (seed.error) throw new Error(`seed: ${seed.error.message}`)
    createdIds.push(seed.data.id)
  })

  test.afterAll(async () => {
    const sb = serviceClient()
    if (createdIds.length) {
      await sb.from('appointments').delete().in('id', createdIds)
    }
    // belt-and-suspenders: any rows for this date/event the test created
    await sb.from('appointments').delete()
      .eq('boutique_id', TEST_BOUTIQUES.alpha.id)
      .eq('event_id',    ALPHA_WEDDING_ID)
      .eq('date',        TEST_DATE)
  })

  test('inline conflict warning + Book anyway override', async ({ page }) => {
    // Navigate Dashboard → Events → List → wedding row
    await page.goto('/dashboard')
    await page.waitForSelector('[data-testid="dashboard-root"]', { timeout: 10_000 })
    await page.getByTestId('nav-events').click()
    await page.waitForLoadState('networkidle', { timeout: 15_000 })
    await page.getByTestId('events-view-list').click()
    await page.getByTestId(`event-row-${ALPHA_WEDDING_ID}`).click()

    // The "+ Add date" trigger is rendered inside the Appointments tab body.
    // Switch to the Appointments primary tab first.
    await page.getByRole('button', { name: /Appointments/i }).first().click()
    await page.getByTestId('event-add-date-btn').first().click()

    const dateInput = page.locator('#appt-date')
    await expect(dateInput).toBeVisible({ timeout: 8_000 })

    // Fill the form to match the seed appointment exactly
    await dateInput.fill(TEST_DATE)
    await page.locator('#appt-time').fill(TEST_TIME)
    await page.locator('#appt-staff').selectOption(ALPHA_COORDINATOR)
    await page.locator('#appt-notes').fill(`${TAG} double-book attempt`)

    // First click → expect the couture DB conflict warning to render
    const submit = page.getByTestId('add-date-submit')
    await submit.click()

    const warning = page.getByTestId('add-date-conflict-warning')
    await expect(warning).toBeVisible({ timeout: 6_000 })
    await expect(warning).toContainText(/Schedule conflict/i)

    // Submit button text flips to "Book anyway" + warning color
    await expect(submit).toHaveText(/Book anyway/i)

    // Click "Book anyway" → second appointment persists
    await submit.click()

    // Modal should close on success — check warning is gone
    await expect(warning).not.toBeVisible({ timeout: 8_000 })

    // Verify two rows now exist at this slot
    const sb = serviceClient()
    const { data, error } = await sb
      .from('appointments')
      .select('id')
      .eq('boutique_id', TEST_BOUTIQUES.alpha.id)
      .eq('event_id',    ALPHA_WEDDING_ID)
      .eq('date',        TEST_DATE)
      .eq('time',        TEST_TIME)
    expect(error, `query: ${error?.message}`).toBeNull()
    expect(data!.length, 'expected 2 appointments at the same slot after override').toBe(2)
    data!.forEach(r => createdIds.push(r.id))
  })
})
