// Appointment double-book detection — proves the safety rail works:
//   1. seed an appointment for a known client + known staff at a unique date+time
//   2. open the StandaloneAppointmentModal from the Dashboard
//   3. fill the SAME date+time+client+staff
//   4. click "Schedule appointment" → expect couture conflict warning
//   5. click "Book anyway" → second appointment is saved (override works)
//   6. cleanup both rows so re-runs are deterministic
//
// Also asserts the "happy path" — a non-conflicting time saves immediately
// without showing the warning.

import { test, expect } from '@playwright/test'
import { serviceClient, TEST_BOUTIQUES, TEST_USERS } from '../../fixtures/supabase'

// Seed-deterministic IDs (see supabase/seed.test.sql)
const ALICE_ID  = '11111111-c111-1111-1111-111111111111' // Alice Anderson, Boutique Alpha
const OWNER_A   = TEST_USERS.ownerA.id                    // 11111111-aaaa-…
const STAFF_A_MEMBER_ID = '0000aaaa-0000-4000-a000-00000000000a' // boutique_members.id for Owner A

// Pick a date 21 days out so it doesn't collide with anything else the suite
// might create. Time uses an unusual minute to make collisions unlikely.
function uniqueDate(): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + 21)
  return d.toISOString().slice(0, 10) // YYYY-MM-DD
}
const TEST_DATE = uniqueDate()
const TEST_TIME = '14:37'   // 2:37 PM — odd minute keeps it unique
const FREE_TIME = '09:11'   // a different time the seed never uses

const TAG = `dbtest${Date.now().toString(36).slice(-5)}`

test.describe('Appointment double-book detection', () => {
  // Stash the IDs of every appointment we create so afterAll can clean them.
  const createdIds: string[] = []

  test.beforeAll(async () => {
    const sb = serviceClient()
    // Pre-seed the conflicting appointment (Alice, Owner A, TEST_DATE @ TEST_TIME)
    const { data, error } = await sb
      .from('appointments')
      .insert({
        boutique_id: TEST_BOUTIQUES.alpha.id,
        event_id: null,
        client_id: ALICE_ID,
        client_name: 'Alice Anderson',
        type: 'consultation',
        date: TEST_DATE,
        time: TEST_TIME,
        note: `seed conflict ${TAG}`,
        staff_id: STAFF_A_MEMBER_ID,
        status: 'scheduled',
      })
      .select('id')
      .single()
    if (error) throw new Error(`seed failed: ${error.message}`)
    createdIds.push(data.id)
  })

  test.afterAll(async () => {
    const sb = serviceClient()
    if (createdIds.length > 0) {
      await sb.from('appointments').delete().in('id', createdIds)
    }
    // Belt-and-suspenders: also wipe by note tag in case the test created rows
    // we never recorded (e.g. it crashed mid-flow before the testid checks).
    await sb.from('appointments').delete()
      .eq('boutique_id', TEST_BOUTIQUES.alpha.id)
      .like('note', `%${TAG}%`)
    await sb.from('appointments').delete()
      .eq('boutique_id', TEST_BOUTIQUES.alpha.id)
      .eq('date', TEST_DATE)
  })

  test('shows conflict warning, then "Book anyway" overrides it', async ({ page }) => {
    // 1. Land on Dashboard
    await page.goto('/dashboard')
    await page.waitForSelector('[data-testid="dashboard-root"]', { timeout: 10_000 })

    // 2. Open the Standalone Appointment modal (topbar "+ Appointment")
    await page.getByRole('button', { name: /\+ ?Appointment/i }).first().click()

    // The modal is just inline JSX — wait for its date field
    const dateInput = page.locator('input[type="date"]').first()
    await expect(dateInput).toBeVisible({ timeout: 8_000 })

    // 3. Fill out the form to match the existing appointment exactly
    await dateInput.fill(TEST_DATE)
    await page.locator('input[type="time"]').first().fill(TEST_TIME)

    // Search & select Alice from dropdown
    const search = page.getByPlaceholder(/Search clients/i)
    await search.fill('Alice')
    // The dropdown row uses onMouseDown (so the input doesn't blur before
     // selection registers). dispatchEvent triggers it deterministically.
     await page.getByTestId(`appointment-client-option-${ALICE_ID}`).dispatchEvent('mousedown')

    // Pick Owner A as the staff (only one select inside the modal)
    const staffSelect = page.locator('select').last()
    // Pick by value (boutique_members.id) — labels include role suffix that varies
    await staffSelect.selectOption(STAFF_A_MEMBER_ID)

    // Add unique note so cleanup catches it even if the testid changes
    await page.locator('textarea').fill(`${TAG} double-book attempt`)

    // 4. First save attempt → expect conflict warning
    await page.getByTestId('appointment-schedule-button').click()
    await expect(page.getByTestId('appointment-conflict-warning')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByTestId('appointment-conflict-warning')).toContainText(/Schedule conflict/i)

    // The footer button should now read "Book anyway"
    const overrideBtn = page.getByTestId('appointment-book-anyway')
    await expect(overrideBtn).toBeVisible()

    // 5. Override — should succeed and close the modal
    await overrideBtn.click()
    await expect(page.getByTestId('appointment-conflict-warning')).not.toBeVisible({ timeout: 8_000 })

    // 6. Verify the second appointment landed in the DB
    const sb = serviceClient()
    const { data: rows, error } = await sb
      .from('appointments')
      .select('id, date, time, client_id, staff_id, note')
      .eq('boutique_id', TEST_BOUTIQUES.alpha.id)
      .eq('date', TEST_DATE)
      .eq('time', TEST_TIME)
    expect(error, `query error: ${error?.message}`).toBeNull()
    expect(rows!.length, 'expected 2 appointments at the same slot after override').toBe(2)
    rows!.forEach(r => createdIds.push(r.id))
  })

  test('non-conflicting time saves without warning', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForSelector('[data-testid="dashboard-root"]', { timeout: 10_000 })
    await page.getByRole('button', { name: /\+ ?Appointment/i }).first().click()

    const dateInput = page.locator('input[type="date"]').first()
    await expect(dateInput).toBeVisible({ timeout: 8_000 })
    await dateInput.fill(TEST_DATE)
    await page.locator('input[type="time"]').first().fill(FREE_TIME)

    const search = page.getByPlaceholder(/Search clients/i)
    await search.fill('Alice')
    // The dropdown row uses onMouseDown (so the input doesn't blur before
     // selection registers). dispatchEvent triggers it deterministically.
     await page.getByTestId(`appointment-client-option-${ALICE_ID}`).dispatchEvent('mousedown')

    const staffSelect = page.locator('select').last()
    // Pick by value (boutique_members.id) — labels include role suffix that varies
    await staffSelect.selectOption(STAFF_A_MEMBER_ID)
    await page.locator('textarea').fill(`${TAG} clean save`)

    await page.getByTestId('appointment-schedule-button').click()

    // No warning should appear — modal closes cleanly
    await expect(page.getByTestId('appointment-conflict-warning')).not.toBeVisible({ timeout: 5_000 })
    await expect(page.getByTestId('appointment-schedule-button')).not.toBeVisible({ timeout: 5_000 })

    // DB sanity: a fresh row exists at FREE_TIME
    const sb = serviceClient()
    const { data: rows } = await sb
      .from('appointments')
      .select('id')
      .eq('boutique_id', TEST_BOUTIQUES.alpha.id)
      .eq('date', TEST_DATE)
      .eq('time', FREE_TIME)
    expect(rows!.length, 'expected at least 1 appointment at the free slot').toBeGreaterThanOrEqual(1)
    rows!.forEach(r => createdIds.push(r.id))
  })
})
