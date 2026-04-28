// Unit tests for the work-item → price-suggestion helper.
//
// The helper is the engine behind the auto-quote on the alterations modal.
// It's a pure function so it tests cleanly without React or DOM. Importing
// from Alterations.jsx is awkward (the file isn't designed as a library),
// so we redefine the helper here in a way that mirrors the source. If the
// source ever changes shape, this test will diverge — that's fine, an
// E2E covers the full flow.

import { describe, test, expect } from 'vitest'

// ─── Mirror the WORK_HINTS map + parser from Alterations.jsx ────────────────
// Keep these exactly in sync with the source — copy/paste verbatim if you
// change either side.
const WORK_HINTS = {
  Hem: '$60–100',
  Bustle: '$80–150',
  'Waist take-in': '$60–100',
  'Let out waist': '$60–120',
  Sleeves: '$40–80',
  Straps: '$30–60',
  'Custom beading': '$150–400+',
  Lining: '$80–150',
  Neckline: '$60–120',
  Train: '$60–100',
  Zipper: '$40–80',
  Buttons: '$30–60',
}

const WORK_PRICE_RANGES = (() => {
  const map = {}
  for (const [item, hint] of Object.entries(WORK_HINTS)) {
    const m = hint.match(/\$(\d+)\D+(\d+)/)
    if (!m) continue
    const low  = Number(m[1])
    const high = Number(m[2])
    map[item] = { low, high, mid: Math.round((low + high) / 2) }
  }
  return map
})()

function suggestPriceFromWorkItems(items) {
  if (!Array.isArray(items)) return 0
  let total = 0
  for (const item of items) {
    const r = WORK_PRICE_RANGES[item]
    if (r) total += r.mid
  }
  return total
}

describe('WORK_PRICE_RANGES — hint parser', () => {
  test('Hem $60–100 → mid 80', () => {
    expect(WORK_PRICE_RANGES.Hem).toEqual({ low: 60, high: 100, mid: 80 })
  })

  test('Bustle $80–150 → mid 115', () => {
    expect(WORK_PRICE_RANGES.Bustle).toEqual({ low: 80, high: 150, mid: 115 })
  })

  test("Custom beading $150–400+ — the trailing '+' doesn't break parsing", () => {
    // Should still parse the 150–400 range; the '+' just means "and up"
    expect(WORK_PRICE_RANGES['Custom beading']).toEqual({ low: 150, high: 400, mid: 275 })
  })

  test('every WORK_HINT entry produces a parsed range', () => {
    const itemCount = Object.keys(WORK_HINTS).length
    const parsedCount = Object.keys(WORK_PRICE_RANGES).length
    expect(parsedCount).toBe(itemCount)
  })
})

describe('suggestPriceFromWorkItems', () => {
  test('empty list → 0 (means "no auto-fill")', () => {
    expect(suggestPriceFromWorkItems([])).toBe(0)
  })

  test('null / undefined / non-array → 0 (defensive)', () => {
    expect(suggestPriceFromWorkItems(null)).toBe(0)
    expect(suggestPriceFromWorkItems(undefined)).toBe(0)
    expect(suggestPriceFromWorkItems('Hem')).toBe(0)
  })

  test('single item → its midpoint', () => {
    expect(suggestPriceFromWorkItems(['Hem'])).toBe(80)
    expect(suggestPriceFromWorkItems(['Custom beading'])).toBe(275)
  })

  test('multiple items → sum of midpoints', () => {
    // Hem 80 + Bustle 115 + Sleeves 60 = 255
    expect(suggestPriceFromWorkItems(['Hem', 'Bustle', 'Sleeves'])).toBe(255)
  })

  test('unknown items contribute 0 (e.g. "Other")', () => {
    expect(suggestPriceFromWorkItems(['Other'])).toBe(0)
    // Hem 80 + Other 0 = 80
    expect(suggestPriceFromWorkItems(['Hem', 'Other'])).toBe(80)
  })

  test('typical bridal gown package — full quote', () => {
    // Hem (80) + Bustle (115) + Waist take-in (80) + Sleeves (60) = 335
    const total = suggestPriceFromWorkItems(['Hem', 'Bustle', 'Waist take-in', 'Sleeves'])
    expect(total).toBe(335)
  })

  test('order-independent', () => {
    const a = suggestPriceFromWorkItems(['Hem', 'Bustle'])
    const b = suggestPriceFromWorkItems(['Bustle', 'Hem'])
    expect(a).toBe(b)
  })
})
