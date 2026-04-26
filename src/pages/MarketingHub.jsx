// MarketingHub — single top-level entry point for client-engagement &
// outbound surfaces.
//
// Replaces six separate nav items (SMS Inbox, Waitlist, Reviews, Photo
// Gallery, Email Marketing, Ticketing) with one menu entry that exposes
// each as a tab. Each tab is gated by its module; tabs whose module is
// off don't render at all so a boutique on the starter plan only sees
// what they have.
//
// All underlying screens are kept verbatim — the hub is just the wrapper.
//
// Backwards compat (handled by the parent screen-router):
//   sms_inbox       → marketing_hub#sms          (default if available)
//   waitlist        → marketing_hub#waitlist
//   reviews         → marketing_hub#reviews
//   photo_gallery   → marketing_hub#gallery
//   email_mkt       → marketing_hub#email
//   ticketing       → marketing_hub#tickets

import React, { useState, useMemo, lazy, Suspense } from 'react';
import { C } from '../lib/colors';
import { useModules } from '../hooks/useModules.jsx';
const SmsInboxPage          = lazy(() => import('./SmsInboxPage'));
import {
  WaitlistScreen, ReviewsScreen, PhotoGalleryScreen,
  EmailMarketingScreen, TicketingScreen,
} from './ModuleStubs.jsx';

const TAB_LS_KEY = 'belori_marketing_hub_tab';

// Each tab has a `module` (the registry id) so we can gate visibility.
// A null module means the tab is always available.
const TABS_DEF = [
  { key: 'sms',      label: 'SMS Inbox',       sub: 'Inbound + replies',         module: null },
  { key: 'waitlist', label: 'Waitlist',        sub: 'Sign-ups & callbacks',      module: 'waitlist' },
  { key: 'reviews',  label: 'Reviews',         sub: 'Google / Yelp etc.',        module: 'reviews' },
  { key: 'gallery',  label: 'Photo Gallery',   sub: 'Public showcase',           module: 'photo_gallery' },
  { key: 'email',    label: 'Email Marketing', sub: 'Broadcasts & sequences',    module: 'email_marketing' },
  { key: 'tickets',  label: 'Ticketing',       sub: 'Event admissions',          module: 'ticketing' },
];

export default function MarketingHub({ initialTab, ...rest }) {
  const { isEnabled } = useModules();

  // Filter tabs by module gate. SMS always shows.
  const tabs = useMemo(
    () => TABS_DEF.filter(t => !t.module || isEnabled(t.module)),
    [isEnabled]
  );

  const [tab, setTab] = useState(() => {
    if (initialTab && tabs.some(t => t.key === initialTab)) return initialTab;
    try {
      const saved = localStorage.getItem(TAB_LS_KEY);
      if (saved && tabs.some(t => t.key === saved)) return saved;
    } catch { /* ignore */ }
    return tabs[0]?.key || 'sms';
  });

  // If the active tab is no longer available (module disabled while user
  // was elsewhere), fall back to the first available tab.
  const activeTab = tabs.some(t => t.key === tab) ? tab : tabs[0]?.key;

  const switchTab = (k) => {
    setTab(k);
    try { localStorage.setItem(TAB_LS_KEY, k); } catch { /* ignore */ }
  };

  // Empty-fall-through if EVERY module is disabled — shouldn't happen since
  // SMS is always available, but defensive anyway.
  if (!activeTab) {
    return (
      <div style={{padding:32, textAlign:'center', color: C.gray, fontSize:13}}>
        No marketing modules enabled. Visit Settings → Modules to turn one on.
      </div>
    );
  }

  return (
    <div style={{flex:1, display:'flex', flexDirection:'column', overflow:'hidden'}}>
      <div role="tablist" aria-label="Marketing views" style={{
        display:'flex',
        gap:0,
        padding:'0 20px',
        background: C.white,
        borderBottom: `1px solid ${C.border}`,
        flexShrink: 0,
        overflowX: 'auto',
      }}>
        {tabs.map(t => {
          const active = activeTab === t.key;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={active}
              data-testid={`marketing-tab-${t.key}`}
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
        {activeTab === 'sms' && (
          <Suspense fallback={<TabFallback label="Loading SMS inbox…"/>}><SmsInboxPage {...rest}/></Suspense>
        )}
        {activeTab === 'waitlist' && <WaitlistScreen {...rest}/>}
        {activeTab === 'reviews'  && <ReviewsScreen {...rest}/>}
        {activeTab === 'gallery'  && <PhotoGalleryScreen {...rest}/>}
        {activeTab === 'email'    && <EmailMarketingScreen {...rest}/>}
        {activeTab === 'tickets'  && <TicketingScreen {...rest}/>}
      </div>
    </div>
  );
}

function TabFallback({ label }) {
  return <div style={{padding:32, textAlign:'center', color: C.gray, fontSize:13}}>{label}</div>;
}
