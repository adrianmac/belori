// InventoryHub — single top-level entry point for everything inventory.
//
// Replaces the previously-split "Dress Rentals" (rental workflow) and
// "Inventory" (catalog) nav items with one menu entry that exposes both
// flows behind tabs:
//
//   Catalog tab → Inventory.jsx (add/edit/bulk/archive — every category)
//   Rentals tab → DressRentals.jsx (catalog | active | returns | history)
//
// Both source pages are kept verbatim — this hub is just the wrapper.
// That keeps the diff small and lets us roll back the IA change without
// touching the underlying screens.
//
// Backwards compat:
//   - Old screen ID `inventory`  → hub with `rentals` tab pre-selected
//   - Old screen ID `inv_full`   → hub with `catalog` tab pre-selected
//   - New screen ID `inventory_hub` → hub with default tab (catalog)
//
// localStorage remembers the last-viewed tab so the user lands where
// they left off on subsequent visits.

import React, { useState, lazy, Suspense } from 'react';
import { C } from '../lib/colors';
import { Topbar } from '../lib/ui.jsx';
import { analytics } from '../lib/analytics';
import { usePageTitle } from '../hooks/usePageTitle';
import Inventory from './Inventory';
const DressRentals = lazy(() => import('./DressRentals'));

const TAB_LS_KEY = 'belori_inventory_hub_tab';

const TABS = [
  { key: 'catalog', label: 'Catalog',   sub: 'Add, edit, bulk-update inventory' },
  { key: 'rentals', label: 'Rentals',   sub: 'Pickups, returns, rental history' },
];

export default function InventoryHub({ initialTab, ...rest }) {
  usePageTitle('Inventory');
  // initialTab can come from a screen-ID alias (the parent maps inv_full →
  // 'catalog' and inventory → 'rentals'). Falls back to localStorage, then
  // 'catalog' as the safe default — most users start by browsing catalog.
  const [tab, setTab] = useState(() => {
    if (initialTab && TABS.some(t => t.key === initialTab)) return initialTab;
    try {
      const saved = localStorage.getItem(TAB_LS_KEY);
      if (saved && TABS.some(t => t.key === saved)) return saved;
    } catch { /* ignore */ }
    return 'catalog';
  });

  const switchTab = (k) => {
    setTab(k);
    try { localStorage.setItem(TAB_LS_KEY, k); } catch { /* ignore */ }
    analytics.hubTabSwitch({ hub: 'inventory', tab: k });
  };

  return (
    <div style={{flex:1, display:'flex', flexDirection:'column', overflow:'hidden'}}>
      {/* Tab strip */}
      <div role="tablist" aria-label="Inventory views" style={{
        display:'flex',
        gap:0,
        padding:'0 20px',
        background: C.white,
        borderBottom: `1px solid ${C.border}`,
        flexShrink: 0,
      }}>
        {TABS.map(t => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={active}
              data-testid={`inventory-hub-tab-${t.key}`}
              onClick={() => switchTab(t.key)}
              style={{
                padding: '14px 18px',
                border: 'none',
                background: 'transparent',
                color: active ? '#5C3A0F' : '#7A6670',
                borderBottom: `2px solid ${active ? '#B08A4E' : 'transparent'}`,
                marginBottom: -1,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                letterSpacing: '0.02em',
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1,
              }}
            >
              <span>{t.label}</span>
              <span style={{fontSize: 10.5, color: active ? '#8E6B34' : '#9E9590', fontWeight: 400}}>
                {t.sub}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active tab body */}
      <div style={{flex:1, display:'flex', flexDirection:'column', overflow:'hidden'}}>
        {tab === 'catalog' && <Inventory {...rest} />}
        {tab === 'rentals' && (
          <Suspense fallback={
            <div style={{padding:32, textAlign:'center', color: C.gray, fontSize:13}}>
              Loading rental workflow…
            </div>
          }>
            <DressRentals {...rest} />
          </Suspense>
        )}
      </div>
    </div>
  );
}
