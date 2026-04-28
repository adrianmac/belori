// Shared work-item pricing helpers — used by both alteration-creation
// surfaces:
//   • src/pages/Alterations.jsx (NewAlterationModal + EditAlterationModal)
//   • src/pages/EventDetail.jsx (the inline "Create alteration" modal
//                                from an event's Alterations card)
//
// Both modals previously had to recompute "what should the price field
// say given the user's work-item picks?" — this lib is the canonical
// answer. Pure functions only; no React, no DOM. Testable in isolation.

// Single source of truth for the per-item price-range hints rendered
// next to each work-item chip. The boutique-facing strings are kept in
// the original WORK_HINTS map in Alterations.jsx; this lib parses those
// to numeric ranges so both files stay in sync without a circular
// import (Alterations.jsx imports from here, not the other way around).

export const WORK_HINTS = {
  Hem:               '$60–100',
  Bustle:            '$80–150',
  'Waist take-in':   '$60–100',
  'Let out waist':   '$60–120',
  Sleeves:           '$40–80',
  Straps:            '$30–60',
  'Custom beading':  '$150–400+',
  Lining:            '$80–150',
  Neckline:          '$60–120',
  Train:             '$60–100',
  Zipper:            '$40–80',
  Buttons:           '$30–60',
};

// Parse each hint to a {low, high, mid} tuple. Computed once at module
// load — these never change at runtime. Items missing from this map
// (e.g. 'Other') contribute 0 to a quote so the form can ignore them.
export const WORK_PRICE_RANGES = (() => {
  const map = {};
  for (const [item, hint] of Object.entries(WORK_HINTS)) {
    // Match $LOW–HIGH or $LOW–HIGH+ (em-dash). 1–4 digit numbers.
    const m = hint.match(/\$(\d+)\D+(\d+)/);
    if (!m) continue;
    const low  = Number(m[1]);
    const high = Number(m[2]);
    map[item] = { low, high, mid: Math.round((low + high) / 2) };
  }
  return map;
})();

/**
 * Suggest a price from a list of selected work item names. Returns the
 * sum of midpoints — a conservative-ish estimate the boutique can
 * adjust either way. Returns 0 when nothing recognizable is selected
 * (the form treats 0 as "don't auto-fill" so the input stays empty).
 *
 * @param {string[]} items
 * @returns {number}
 */
export function suggestPriceFromWorkItems(items) {
  if (!Array.isArray(items)) return 0;
  let total = 0;
  for (const item of items) {
    const r = WORK_PRICE_RANGES[item];
    if (r) total += r.mid;
  }
  return total;
}
