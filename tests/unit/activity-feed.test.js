// Pure-function unit tests for buildActivityStream() — the helper that
// merges every event-scoped data source into a single chronological feed.
//
// We test the helper in isolation (not the React component) so we can
// cheaply hammer edge cases that would be tedious in E2E:
//   - empty inputs
//   - missing timestamps
//   - cancelled appointments hidden
//   - tasks emit two rows (created + done)
//   - milestones emit one to three rows depending on state
//   - sort order is strictly DESC by timestamp
//   - DATE-only fields (paid_date, appointment date) get treated as midday
//   - per-source field defaults don't crash

import { describe, test, expect } from 'vitest'
import { buildActivityStream } from '../../src/pages/event-detail/EventActivityFeed.jsx'

const ISO_LATEST   = '2026-04-26T18:00:00Z'
const ISO_MID      = '2026-04-26T12:00:00Z'
const ISO_EARLIEST = '2026-04-25T08:00:00Z'

describe('buildActivityStream — empty inputs', () => {
  test('all empty arrays returns empty array', () => {
    expect(buildActivityStream({})).toEqual([])
    expect(buildActivityStream({
      notes: [], tasks: [], milestones: [],
      appointments: [], alterations: [], interactions: [],
    })).toEqual([])
  })

  test('rows without timestamps are filtered out', () => {
    const out = buildActivityStream({
      notes: [{ id: 'n1', text: 'no created_at' }],   // no created_at → dropped
      tasks: [{ id: 't1', text: 'no created_at' }],   // no created_at → dropped
    })
    expect(out).toEqual([])
  })
})

describe('buildActivityStream — sort order', () => {
  test('newest first across mixed kinds', () => {
    const out = buildActivityStream({
      notes:        [{ id: 'n1', text: 'mid',     created_at: ISO_MID }],
      milestones:   [{ id: 'm1', label: 'late', amount: 100, created_at: ISO_LATEST }],
      appointments: [{ id: 'a1', type: 'fitting', created_at: ISO_EARLIEST }],
    })
    // Filter out the appointment "scheduled" row (no .date set, so only the
    // "booked" row appears). Same for milestone — only the "created" row.
    expect(out.map(o => o.id)).toEqual(['ms-add-m1', 'note-n1', 'appt-book-a1'])
  })
})

describe('buildActivityStream — notes', () => {
  test('one row per note with author fallback', () => {
    const out = buildActivityStream({
      notes: [
        { id: 'n1', created_at: ISO_LATEST, text: 'with author', author: { name: 'Sarah' } },
        { id: 'n2', created_at: ISO_MID,    text: 'with name',   author_name: 'Bob' },
        { id: 'n3', created_at: ISO_EARLIEST, text: 'no author' },
      ],
    })
    expect(out).toHaveLength(3)
    expect(out[0]).toMatchObject({ kind: 'note', actor: 'Sarah', body: 'with author' })
    expect(out[1]).toMatchObject({ kind: 'note', actor: 'Bob' })
    expect(out[2]).toMatchObject({ kind: 'note', actor: 'Staff' })
  })
})

describe('buildActivityStream — tasks emit created + done', () => {
  test('open task: 1 row (created)', () => {
    const out = buildActivityStream({
      tasks: [{ id: 't1', text: 'do thing', created_at: ISO_MID, done: false }],
    })
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ kind: 'task', headline: 'Task added' })
  })

  test('completed task: 2 rows (created + done)', () => {
    const out = buildActivityStream({
      tasks: [{
        id: 't1', text: 'finished', created_at: ISO_EARLIEST,
        done: true, done_at: ISO_LATEST, done_by_name: 'Maria',
      }],
    })
    expect(out).toHaveLength(2)
    expect(out[0]).toMatchObject({ id: 'task-done-t1', headline: 'Task completed', actor: 'Maria' })
    expect(out[1]).toMatchObject({ id: 'task-add-t1',  headline: 'Task added' })
  })

  test('alert flag is reflected in headline', () => {
    const out = buildActivityStream({
      tasks: [{ id: 't1', created_at: ISO_MID, alert: true, text: 'urgent' }],
    })
    expect(out[0].headline).toBe('Alert task created')
  })

  test('done=true but no done_at → only created row (no fake timestamp)', () => {
    const out = buildActivityStream({
      tasks: [{ id: 't1', created_at: ISO_MID, done: true, done_at: null }],
    })
    expect(out).toHaveLength(1)
    expect(out[0].id).toBe('task-add-t1')
  })
})

describe('buildActivityStream — milestones', () => {
  test('unpaid + un-reminded: 1 row (created)', () => {
    const out = buildActivityStream({
      milestones: [{ id: 'm1', label: 'Deposit', amount: 500, created_at: ISO_MID }],
    })
    expect(out).toHaveLength(1)
    expect(out[0].headline).toMatch(/Milestone created/)
  })

  test('paid milestone: 2 rows (created + paid)', () => {
    const out = buildActivityStream({
      milestones: [{
        id: 'm1', label: 'Deposit', amount: 500,
        created_at: ISO_EARLIEST,
        status: 'paid', paid_date: '2026-04-26',
      }],
    })
    expect(out).toHaveLength(2)
    expect(out.find(o => o.id === 'ms-paid-m1')).toMatchObject({
      headline: 'Deposit paid', amount: 500,
    })
  })

  test('paid_date treated as midday for sortable timestamp', () => {
    const out = buildActivityStream({
      milestones: [{
        id: 'm1', label: 'X', amount: 1, created_at: ISO_MID,
        status: 'paid', paid_date: '2026-04-26',
      }],
    })
    const paidRow = out.find(o => o.id === 'ms-paid-m1')
    expect(paidRow.at).toMatch(/2026-04-26T12:00:00/)
  })

  test('reminder fired: includes a reminder row', () => {
    const out = buildActivityStream({
      milestones: [{
        id: 'm1', label: 'Final', amount: 1000,
        created_at: ISO_EARLIEST, last_reminded_at: ISO_LATEST,
      }],
    })
    expect(out).toHaveLength(2)
    expect(out[0]).toMatchObject({ kind: 'reminder', headline: 'Reminder sent · Final' })
  })

  test('amount=0 ms still surfaces but renders without amount badge', () => {
    const out = buildActivityStream({
      milestones: [{ id: 'm1', label: 'Free', amount: 0, created_at: ISO_MID }],
    })
    expect(out[0].amount).toBe(0)
  })
})

describe('buildActivityStream — appointments', () => {
  test('booked + scheduled rows for non-cancelled appointment', () => {
    const out = buildActivityStream({
      appointments: [{
        id: 'a1', type: 'final_fitting',
        created_at: ISO_EARLIEST,
        date: '2026-05-10', time: '14:00',
        status: 'scheduled',
        staff: { name: 'Alpha Coordinator' },
      }],
    })
    expect(out).toHaveLength(2)
    const booked = out.find(o => o.id === 'appt-book-a1')
    const sched  = out.find(o => o.id === 'appt-when-a1')
    expect(booked.headline).toMatch(/Appointment booked.*final fitting/)
    expect(sched.headline).toMatch(/final fitting scheduled/)
    expect(booked.actor).toBe('Alpha Coordinator')
  })

  test('cancelled appointment: only the booking row, not the appointment-itself row', () => {
    const out = buildActivityStream({
      appointments: [{
        id: 'a1', type: 'fitting',
        created_at: ISO_EARLIEST,
        date: '2026-05-10', time: '14:00',
        status: 'cancelled',
      }],
    })
    expect(out).toHaveLength(1)
    expect(out[0].id).toBe('appt-book-a1')
  })

  test('done appointment uses "completed" headline', () => {
    const out = buildActivityStream({
      appointments: [{
        id: 'a1', type: 'pickup',
        created_at: ISO_EARLIEST,
        date: '2026-04-20', time: '10:00',
        status: 'done',
      }],
    })
    const sched = out.find(o => o.id === 'appt-when-a1')
    expect(sched.headline).toMatch(/pickup completed/)
  })

  test('missing appointment uses "missed" headline', () => {
    const out = buildActivityStream({
      appointments: [{
        id: 'a1', type: 'fitting',
        created_at: ISO_EARLIEST,
        date: '2026-04-15', time: '11:00',
        status: 'missing',
      }],
    })
    const sched = out.find(o => o.id === 'appt-when-a1')
    expect(sched.headline).toMatch(/fitting missed/)
  })

  test('no time defaults to midday (12:00) for sort stability', () => {
    const out = buildActivityStream({
      appointments: [{
        id: 'a1', type: 'consult', created_at: ISO_EARLIEST,
        date: '2026-05-10', time: null, status: 'scheduled',
      }],
    })
    const sched = out.find(o => o.id === 'appt-when-a1')
    expect(sched.at).toMatch(/2026-05-10T12:00:00/)
  })
})

describe('buildActivityStream — alterations', () => {
  test('emits a single "started" row using created_at', () => {
    const out = buildActivityStream({
      alterations: [{
        id: 'j1', garment: 'Mermaid gown',
        created_at: ISO_MID, deadline: '2026-05-15', price: 250,
      }],
    })
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({
      kind: 'alteration',
      headline: expect.stringMatching(/Alteration started.*Mermaid gown/),
      amount: 250,
      body: 'Deadline 2026-05-15',
    })
  })

  test('row without created_at is dropped (no fabricated timestamp)', () => {
    const out = buildActivityStream({
      alterations: [{ id: 'j1', garment: 'X' }],
    })
    expect(out).toEqual([])
  })
})

describe('buildActivityStream — client interactions', () => {
  test('SMS / email / call get pretty titles', () => {
    const out = buildActivityStream({
      interactions: [
        { id: 'i1', type: 'sms',   occurred_at: ISO_LATEST, title: 'reminder', author_name: 'Sarah' },
        { id: 'i2', type: 'email', occurred_at: ISO_MID,    title: 'invoice' },
        { id: 'i3', type: 'call',  occurred_at: ISO_EARLIEST },
      ],
    })
    expect(out).toHaveLength(3)
    expect(out[0].headline).toMatch(/SMS sent.*reminder/)
    expect(out[1].headline).toMatch(/Email sent.*invoice/)
    expect(out[2].headline).toMatch(/Call logged/)
  })

  test('uses occurred_at when present, falls back to created_at', () => {
    const out = buildActivityStream({
      interactions: [
        { id: 'i1', type: 'sms', occurred_at: null, created_at: ISO_LATEST },
      ],
    })
    expect(out[0].at).toBe(ISO_LATEST)
  })

  test('unknown type uses generic title', () => {
    const out = buildActivityStream({
      interactions: [{ id: 'i1', type: 'mystery', occurred_at: ISO_MID, title: 'thing' }],
    })
    expect(out[0].headline).toBe('thing')
  })
})

describe('buildActivityStream — robustness', () => {
  test('does not crash on null/undefined source arrays', () => {
    expect(() => buildActivityStream({
      notes: null, tasks: undefined, milestones: null,
      appointments: undefined, alterations: null, interactions: undefined,
    })).not.toThrow()
  })

  test('mixed real-world payload returns stable id-prefixed rows', () => {
    const out = buildActivityStream({
      notes:        [{ id: 'n1', created_at: ISO_LATEST,   text: 'x' }],
      tasks:        [{ id: 't1', created_at: ISO_EARLIEST, done: true, done_at: ISO_MID, text: 'y' }],
      milestones:   [{ id: 'm1', created_at: ISO_LATEST, amount: 100, label: 'Z',
                       status: 'paid', paid_date: '2026-04-26',
                       last_reminded_at: ISO_MID }],
      appointments: [{ id: 'a1', created_at: ISO_EARLIEST, type: 'fitting',
                       date: '2026-05-01', time: '15:00', status: 'scheduled' }],
      alterations:  [{ id: 'j1', created_at: ISO_MID, garment: 'gown' }],
      interactions: [{ id: 'i1', occurred_at: ISO_EARLIEST, type: 'sms', title: 'hi' }],
    })
    const ids = out.map(o => o.id)
    expect(ids).toEqual(expect.arrayContaining([
      'note-n1', 'task-add-t1', 'task-done-t1',
      'ms-add-m1', 'ms-paid-m1', 'ms-rem-m1',
      'appt-book-a1', 'appt-when-a1',
      'alt-add-j1',
      'int-i1',
    ]))
    // Strictly descending by timestamp
    for (let i = 1; i < out.length; i++) {
      expect(new Date(out[i - 1].at).getTime()).toBeGreaterThanOrEqual(new Date(out[i].at).getTime())
    }
  })
})
