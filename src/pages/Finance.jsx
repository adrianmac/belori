// Finance hub — single top-level entry point for all money-in surfaces.
//
// Replaces five separate nav items (Payments / Invoices / Payment Links /
// Commissions / Promo Codes) with one menu entry that exposes each as a
// tab. The mental model is "where do I go to deal with money this week?"
// — the answer is now always Finance, then pick the tab you need.
//
// Underlying screens are kept verbatim — the hub is just the wrapper.
//
// Backwards compat (handled by the parent screen-router):
//   payments       → finance#milestones    (default)
//   billing        → finance#invoices
//   online_pay     → finance#paylinks
//   commissions    → finance#commissions
//   promo_codes    → finance#promo

import React, { useState, lazy, Suspense } from 'react';
import { C } from '../lib/colors';
import { analytics } from '../lib/analytics';
import Payments from './Payments';
// OnlinePaymentsScreen is a stub from ModuleStubs.jsx (not its own file).
// Keep it eager-imported since it's tiny.
import { OnlinePaymentsScreen } from './ModuleStubs.jsx';
const BillingScreen           = lazy(() => import('./BillingScreen'));
const CommissionsPage         = lazy(() => import('./CommissionsPage'));
const PromoCodesPage          = lazy(() => import('./PromoCodesPage'));

const TAB_LS_KEY = 'belori_finance_tab';

const TABS = [
  { key: 'milestones',  label: 'Milestones',     sub: 'Per-event payment plans' },
  { key: 'invoices',    label: 'Invoices',       sub: 'Standalone billing' },
  { key: 'paylinks',    label: 'Payment Links',  sub: 'One-time Stripe links' },
  { key: 'commissions', label: 'Commissions',    sub: 'Staff payouts' },
  { key: 'promo',       label: 'Promo Codes',    sub: 'Discount codes' },
];

export default function Finance({ initialTab, ...rest }) {
  const [tab, setTab] = useState(() => {
    if (initialTab && TABS.some(t => t.key === initialTab)) return initialTab;
    try {
      const saved = localStorage.getItem(TAB_LS_KEY);
      if (saved && TABS.some(t => t.key === saved)) return saved;
    } catch { /* ignore */ }
    return 'milestones';
  });

  const switchTab = (k) => {
    setTab(k);
    try { localStorage.setItem(TAB_LS_KEY, k); } catch { /* ignore */ }
    analytics.hubTabSwitch({ hub: 'finance', tab: k });
  };

  return (
    <div style={{flex:1, display:'flex', flexDirection:'column', overflow:'hidden'}}>
      <div role="tablist" aria-label="Finance views" style={{
        display:'flex',
        gap:0,
        padding:'0 20px',
        background: C.white,
        borderBottom: `1px solid ${C.border}`,
        flexShrink: 0,
        overflowX: 'auto',
      }}>
        {TABS.map(t => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={active}
              data-testid={`finance-tab-${t.key}`}
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
                whiteSpace: 'nowrap',
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
        {tab === 'milestones'  && <Payments {...rest} />}
        {tab === 'invoices'    && (
          <Suspense fallback={<TabFallback label="Loading invoices…"/>}><BillingScreen {...rest}/></Suspense>
        )}
        {tab === 'paylinks'    && <OnlinePaymentsScreen {...rest}/>}
        {tab === 'commissions' && (
          <Suspense fallback={<TabFallback label="Loading commissions…"/>}><CommissionsPage {...rest}/></Suspense>
        )}
        {tab === 'promo'       && (
          <Suspense fallback={<TabFallback label="Loading promo codes…"/>}><PromoCodesPage {...rest}/></Suspense>
        )}
      </div>
    </div>
  );
}

function TabFallback({ label }) {
  return (
    <div style={{padding: 32, textAlign: 'center', color: C.gray, fontSize: 13}}>
      {label}
    </div>
  );
}
