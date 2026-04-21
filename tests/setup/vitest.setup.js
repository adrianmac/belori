// Vitest global setup — runs once before every unit/component test.
// - Adds jest-dom matchers (toBeInTheDocument, toHaveClass, etc.)
// - Mocks out matchMedia and IntersectionObserver so components that use them
//   in useEffects don't crash in jsdom.

import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Auto-cleanup React trees between tests so <body> stays clean.
afterEach(() => { cleanup() })

// ─── jsdom polyfills ─────────────────────────────────────────────────────

if (typeof window.matchMedia === 'undefined') {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},      // deprecated API some libs still use
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })
}

if (typeof window.IntersectionObserver === 'undefined') {
  class MockIntersectionObserver {
    observe()   {}
    unobserve() {}
    disconnect(){}
    takeRecords() { return [] }
  }
  window.IntersectionObserver = MockIntersectionObserver
}

if (typeof window.ResizeObserver === 'undefined') {
  class MockResizeObserver {
    observe()   {}
    unobserve() {}
    disconnect(){}
  }
  window.ResizeObserver = MockResizeObserver
}

// scrollIntoView is used by GlobalSearch — jsdom doesn't implement it
if (typeof Element.prototype.scrollIntoView === 'undefined') {
  Element.prototype.scrollIntoView = () => {}
}
