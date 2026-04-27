// Lightweight wrapper around Vercel Analytics' track() with a typed-ish
// catalog of every custom event fired in the app. Centralizing this:
//   - keeps event names consistent (no `finance.tab` here, `finance_tab`
//     there, `finance.tabSwitch` somewhere else)
//   - makes the surface obvious — anyone can grep this file to see what
//     we measure
//   - lets us no-op safely in dev / test where window.va isn't installed
//
// All payload values are normalized to strings (Vercel Analytics doesn't
// allow nested objects).

import { track as vercelTrack } from '@vercel/analytics';

const isDev = typeof window !== 'undefined' && window.location?.hostname === 'localhost';

function track(name, props = {}) {
  // Normalize payload — coerce booleans / numbers / nulls to strings so
  // we never throw on a bad type at the analytics endpoint.
  const safeProps = Object.fromEntries(
    Object.entries(props).map(([k, v]) => [k, v == null ? 'null' : String(v)])
  );
  try {
    vercelTrack(name, safeProps);
    if (isDev) {
      // eslint-disable-next-line no-console
      console.debug('[analytics]', name, safeProps);
    }
  } catch {
    // Silently no-op if the SDK isn't loaded (dev mode, ad blockers, etc.)
  }
}

// ─── Event catalog ─────────────────────────────────────────────────────────
// Add new events HERE so the call sites can stay clean. Names use snake_case
// `domain.action_subject` for grep-ability in the Vercel dashboard.

export const analytics = {
  // ── IA hub adoption ─────────────────────────────────────────────────
  // Measures whether boutique owners are actually using the new hubs
  // (Finance, Inventory, Reports, Marketing) introduced in the IA cleanup.
  hubTabSwitch: ({ hub, tab }) => track('hub.tab_switch', { hub, tab }),

  // ── Activity feed quick-add ─────────────────────────────────────────
  // Friction-free capture surface introduced on EventDetail. Fires when
  // the user successfully posts a Note or Task from the feed header.
  activityQuickAdd: ({ kind }) => track('activity.quick_add', { kind }),

  // ── Inventory bulk operations ───────────────────────────────────────
  inventoryBulkAction: ({ action, count }) =>
    track('inventory.bulk_action', { action, count }),

  // ── Appointment double-book override ────────────────────────────────
  // Measures how often the conflict-warning safety rail is overridden.
  // High override rate may indicate the conflict-detection threshold is
  // too aggressive (e.g., flagging non-conflicts).
  appointmentBookAnyway: ({ surface, conflictCount }) =>
    track('appointment.book_anyway', { surface, conflictCount }),

  // ── CSV import ──────────────────────────────────────────────────────
  csvImport: ({ entity, rows, status }) =>
    track('csv.import', { entity, rows, status }),
};

export default analytics;
