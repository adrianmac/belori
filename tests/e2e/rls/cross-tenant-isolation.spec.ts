// The most important test in the suite. Proves that RLS correctly prevents
// Boutique A's users from seeing ANY of Boutique B's data.
//
// Strategy: use the anon client (subject to RLS) directly — no UI needed.
// This tests the Postgres policies themselves, not any frontend filtering.

import { test, expect } from '@playwright/test'
import { signInAs, TEST_USERS, TEST_BOUTIQUES } from '../../fixtures/supabase'

test.describe('RLS — cross-tenant isolation (CRITICAL)', () => {
  test('Owner A cannot SELECT any clients from Boutique B', async () => {
    const sb = await signInAs('ownerA')
    const { data, error } = await sb
      .from('clients')
      .select('id, boutique_id, name')
      .eq('boutique_id', TEST_BOUTIQUES.beta.id)

    // RLS should filter to zero rows (not error, just empty)
    expect(error, 'Expected no error, RLS should filter silently').toBeNull()
    expect(data).toEqual([])
  })

  test('Owner A cannot SELECT any events from Boutique B', async () => {
    const sb = await signInAs('ownerA')
    const { data, error } = await sb
      .from('events')
      .select('id, boutique_id')
      .eq('boutique_id', TEST_BOUTIQUES.beta.id)
    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  test('Owner A cannot SELECT any payment_milestones from Boutique B', async () => {
    const sb = await signInAs('ownerA')
    const { data, error } = await sb
      .from('payment_milestones')
      .select('id, boutique_id, amount')
      .eq('boutique_id', TEST_BOUTIQUES.beta.id)
    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  test('Owner A CAN see their own Boutique A clients', async () => {
    const sb = await signInAs('ownerA')
    const { data, error } = await sb
      .from('clients')
      .select('id, boutique_id, name')
      .eq('boutique_id', TEST_BOUTIQUES.alpha.id)
    expect(error).toBeNull()
    expect(data?.length).toBeGreaterThanOrEqual(3)  // seed has 3 Alpha clients
    // Every row must be scoped to Alpha
    for (const row of data ?? []) {
      expect(row.boutique_id).toBe(TEST_BOUTIQUES.alpha.id)
    }
  })

  test('Owner A cannot INSERT into Boutique B (should error, not silently drop)', async () => {
    const sb = await signInAs('ownerA')
    const { error } = await sb.from('clients').insert({
      boutique_id: TEST_BOUTIQUES.beta.id,   // forging boutique_id
      name: 'CROSS-TENANT ATTACK ATTEMPT',
      phone: '+15005550006',
      email: 'attack@test.local',
    })
    // RLS should reject with 42501 (permission denied) or similar
    expect(error, 'Cross-tenant INSERT must be blocked').not.toBeNull()
  })

  test('Owner A cannot UPDATE Boutique B data (0 rows affected)', async () => {
    const sb = await signInAs('ownerA')
    const { data, error } = await sb
      .from('clients')
      .update({ name: 'HIJACKED' })
      .eq('boutique_id', TEST_BOUTIQUES.beta.id)
      .select('id')
    expect(error).toBeNull()
    expect(data).toEqual([])   // RLS hid the rows — 0 matched, 0 updated
  })

  test('Owner A cannot DELETE Boutique B data (0 rows affected)', async () => {
    const sb = await signInAs('ownerA')
    const { data, error } = await sb
      .from('clients')
      .delete()
      .eq('boutique_id', TEST_BOUTIQUES.beta.id)
      .select('id')
    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  test('Seamstress B (lower role) cannot SELECT Boutique A events', async () => {
    const sb = await signInAs('staffB')
    const { data, error } = await sb
      .from('events')
      .select('id, boutique_id')
      .eq('boutique_id', TEST_BOUTIQUES.alpha.id)
    expect(error).toBeNull()
    expect(data).toEqual([])
  })
})
