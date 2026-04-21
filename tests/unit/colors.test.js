// Pure-function unit tests for the utilities in src/lib/colors.js.
// Designed to be the canary for Vitest wiring — if these fail, the test
// infrastructure is broken, not the app.

import { describe, test, expect, beforeEach } from 'vitest'
import { fmt, pct, SVC_LABELS, EVT_TYPES } from '../../src/lib/colors.js'

describe('fmt()', () => {
  beforeEach(() => {
    // Reset currency symbol (fmt reads from localStorage)
    localStorage.removeItem('belori_currency_symbol')
  })

  test('zero → $0', () => {
    expect(fmt(0)).toBe('$0')
  })

  test('null/undefined → $0', () => {
    expect(fmt(null)).toBe('$0')
    expect(fmt(undefined)).toBe('$0')
  })

  test('integer → thousands-separated $', () => {
    expect(fmt(1500)).toBe('$1,500')
    expect(fmt(22500)).toBe('$22,500')
  })

  test('rounds to no fractional digits', () => {
    expect(fmt(1234.56)).toBe('$1,235')
  })

  test('respects custom currency symbol from localStorage', () => {
    localStorage.setItem('belori_currency_symbol', '€')
    expect(fmt(1000)).toBe('€1,000')
  })
})

describe('pct()', () => {
  test('0/x → 0', () => {
    expect(pct(0, 100)).toBe(0)
  })

  test('full payment → 100', () => {
    expect(pct(500, 500)).toBe(100)
  })

  test('half payment → 50', () => {
    expect(pct(500, 1000)).toBe(50)
  })

  test('zero total → 0 (no divide-by-zero)', () => {
    expect(pct(500, 0)).toBe(0)
  })

  test('rounds to integer', () => {
    expect(pct(1, 3)).toBe(33)
  })
})

describe('SVC_LABELS', () => {
  test('includes every service used by event wizards', () => {
    for (const key of ['dress_rental','alterations','planning','decoration','photography','dj','photobooth','custom_sneakers']) {
      expect(SVC_LABELS[key]).toBeTruthy()
      expect(typeof SVC_LABELS[key]).toBe('string')
    }
  })
})

describe('EVT_TYPES', () => {
  test('every entry has label + bg + col', () => {
    for (const [key, cfg] of Object.entries(EVT_TYPES)) {
      expect(cfg.label, `${key}.label`).toBeTruthy()
      expect(cfg.bg,    `${key}.bg`).toBeTruthy()
      expect(cfg.col,   `${key}.col`).toBeTruthy()
    }
  })
})
