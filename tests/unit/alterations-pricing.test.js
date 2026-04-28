// Unit tests for the work-item → price-suggestion helper.
//
// The helper drives the auto-quote in BOTH alteration-creation surfaces:
// the standalone Alterations page modal and the EventDetail inline modal.
// Pure functions only — no React or DOM, tests cleanly in isolation.

import { describe, test, expect } from 'vitest'
import { WORK_HINTS, WORK_PRICE_RANGES, suggestPriceFromWorkItems } from '../../src/lib/alterationPricing.js'

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
