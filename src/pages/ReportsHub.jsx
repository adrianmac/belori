// ReportsHub — single top-level entry for everything reporting & analytics.
//
// Replaces three nav items (Reports, Report Builder, Accounting) with one
// menu entry that exposes each as a tab. Same wrapper pattern as the
// Inventory and Finance hubs.
//
// Backwards compat (handled by the parent screen-router):
//   reports         → reports_hub#dashboards   (default)
//   report_builder  → reports_hub#builder
//   accounting      → reports_hub#accounting

import React, { useState, lazy, Suspense } from 'react';
import { C } from '../lib/colors';
import Reports from './Reports';
// AccountingScreen is a stub from ModuleStubs.jsx, not a standalone file.
import { AccountingScreen } from './ModuleStubs.jsx';
const ReportBuilder    = lazy(() => import('./ReportBuilder'));

const TAB_LS_KEY = 'belori_reports_hub_tab';

const TABS = [
  { key: 'dashboards', label: 'Dashboards',     sub: 'Built-in reports' },
  { key: 'builder',    label: 'Report Builder', sub: 'Custom queries' },
  { key: 'accounting', label: 'Accounting',     sub: 'P&L, GL, exports' },
];

export default function ReportsHub({ initialTab, ...rest }) {
  const [tab, setTab] = useState(() => {
    if (initialTab && TABS.some(t => t.key === initialTab)) return initialTab;
    try {
      const saved = localStorage.getItem(TAB_LS_KEY);
      if (saved && TABS.some(t => t.key === saved)) return saved;
    } catch { /* ignore */ }
    return 'dashboards';
  });

  const switchTab = (k) => {
    setTab(k);
    try { localStorage.setItem(TAB_LS_KEY, k); } catch { /* ignore */ }
  };

  return (
    <div style={{flex:1, display:'flex', flexDirection:'column', overflow:'hidden'}}>
      <div role="tablist" aria-label="Reports views" style={{
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
              data-testid={`reports-tab-${t.key}`}
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

      <div style={{flex:1, display:'flex', flexDirection:'column', overflow:'hidden'}}>
        {tab === 'dashboards' && <Reports {...rest}/>}
        {tab === 'builder'    && (
          <Suspense fallback={<TabFallback label="Loading report builder…"/>}><ReportBuilder {...rest}/></Suspense>
        )}
        {tab === 'accounting' && <AccountingScreen {...rest}/>}
      </div>
    </div>
  );
}

function TabFallback({ label }) {
  return <div style={{padding:32, textAlign:'center', color: C.gray, fontSize:13}}>{label}</div>;
}
