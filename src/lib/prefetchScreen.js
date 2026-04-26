// Map of screen IDs → dynamic import factories so the sidebar can prefetch
// the lazy chunk on hover, well before the user clicks.
//
// Each entry is just `() => import('./pageX')`. Calling it kicks off the
// fetch + parse — by the time the user actually clicks the nav item,
// the module is already in the browser's module cache.
//
// We use the *same* `import('…')` paths as NovelApp.jsx's React.lazy()
// calls so Vite's chunk graph hashes them to a single chunk; the
// prefetch warms the exact module React.lazy() will resolve to.
//
// Anything not in this map silently no-ops (the click still works, it
// just doesn't get the head-start).
//
// We intentionally cache the promise in a Set so a second hover doesn't
// trigger a second network request.

const seen = new Set();

const LOADERS = {
  // Authenticated hubs
  inventory_hub:  () => import('../pages/InventoryHub'),
  finance:        () => import('../pages/Finance'),
  reports_hub:    () => import('../pages/ReportsHub'),
  marketing_hub:  () => import('../pages/MarketingHub'),

  // Backwards-compat aliases — same chunks
  inventory:      () => import('../pages/InventoryHub'),
  inv_full:       () => import('../pages/InventoryHub'),
  payments:       () => import('../pages/Finance'),
  billing:        () => import('../pages/Finance'),
  online_pay:     () => import('../pages/Finance'),
  commissions:    () => import('../pages/Finance'),
  promo_codes:    () => import('../pages/Finance'),
  reports:        () => import('../pages/ReportsHub'),
  report_builder: () => import('../pages/ReportsHub'),
  accounting:     () => import('../pages/ReportsHub'),
  sms_inbox:      () => import('../pages/MarketingHub'),
  waitlist:       () => import('../pages/MarketingHub'),
  reviews:        () => import('../pages/MarketingHub'),
  photo_gallery:  () => import('../pages/MarketingHub'),
  email_mkt:      () => import('../pages/MarketingHub'),
  ticketing:      () => import('../pages/MarketingHub'),

  // Other authenticated pages worth warming
  events:         () => import('../pages/Events'),
  event_detail:   () => import('../pages/EventDetail'),
  clients:        () => import('../pages/Clients'),
  alterations:    () => import('../pages/Alterations'),
  schedule:       () => import('../pages/ScheduleScreen'),
  settings:       () => import('../pages/Settings'),
  my_tasks:       () => import('../pages/MyTasksPage'),
  expenses:       () => import('../pages/ExpensesPage'),
  vendors:        () => import('../pages/VendorsPage'),
  pos:            () => import('../pages/POSPage'),
  qr_labels:      () => import('../pages/QRCodesPage'),
  bulk_import:    () => import('../pages/ImportPage'),
  funnel:         () => import('../pages/Clients'),  // Pipeline lives in Clients now
  audit_ui:       () => import('../pages/Settings'), // Audit tools live in Settings → Data
  data_export:    () => import('../pages/Settings'),
  help:           () => import('../pages/HelpPage'),
};

/**
 * Kick off the lazy import for a screen if we have a loader for it.
 * Idempotent — repeated calls are no-ops thanks to module caching.
 */
export function prefetchScreen(screenId) {
  if (!screenId || seen.has(screenId)) return;
  const loader = LOADERS[screenId];
  if (!loader) return;
  seen.add(screenId);
  // Fire-and-forget. Errors are swallowed; if the import fails on
  // hover, the click will retry through React.lazy with proper error
  // boundary handling.
  loader().catch(() => seen.delete(screenId));
}
