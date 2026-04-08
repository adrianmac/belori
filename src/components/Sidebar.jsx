import React, { useState, useRef, useEffect, useCallback } from 'react';
import { C } from '../lib/colors';
import { icons, Avatar } from '../lib/ui.jsx';
import { useModules } from '../hooks/useModules.jsx';
import { canAccess, ROLE_LABELS } from '../lib/permissions.js';
import { useI18n } from '../lib/i18n/index.jsx';
// Nav items shown in Focus Mode (core workflow only)
const FOCUS_IDS = new Set(['dashboard', 'events', 'inventory', 'alterations', 'clients']);

// ─── NAV STRUCTURE ──────────────────────────────────────────────────────────
// Returns { topLevel, sections, allFlat }
// topLevel: always-visible items
// sections: array of { key, label, items[] }
// allFlat: all nav items (no dividers) — used by IconRail
function buildNavStructure(badges = {}, modules = {}, t = (k) => k) {
  const en = (k) => modules[k] === true;
  const enDefault = (k) => modules[k] !== false;

  // ── Always-visible top-level items ──────────────────────────────────────
  const topLevel = [
    { id: 'dashboard',     label: t('nav_dashboard'), icon: 'overview' },
    // ── Core workflows (items 2-4) — visually grouped ──
    { id: 'events',        label: t('nav_events'),     icon: 'events',   core: true,
      ...(badges.events    ? { badge: badges.events }    : {}),
      ...(badges.tasks     ? { tasksBadge: badges.tasks } : {}) },
    enDefault('dress_rental') && { id: 'inventory',   label: 'Dress rentals',          icon: 'rentals',    core: true },
    enDefault('alterations')  && { id: 'alterations', label: t('nav_alterations'),     icon: 'alterations', core: true,
      ...(badges.alterations ? { badge: badges.alterations, badgeColor: 'var(--color-danger)' } : {}) },
    // ── Secondary items ──
    { id: 'clients',       label: t('nav_clients'),    icon: 'clients' },
    { id: 'my_tasks',      label: 'My Tasks',          icon: 'mytasks',
      ...(badges.myTasks ? { badge: badges.myTasks, badgeColor: 'var(--color-danger)' } : {}) },
    { id: 'staff_calendar',label: t('nav_staff_calendar'), icon: 'calendar' },
    { id: 'payments',      label: t('nav_payments'),   icon: 'payments',
      ...(badges.payments  ? { badge: badges.payments, badgeColor: 'var(--color-danger)' } : {}) },
    { id: 'activity_feed', label: 'Activity',           icon: 'activity' },
    { id: 'settings',      label: t('nav_settings'),   icon: 'settings' },
  ].filter(Boolean);

  // ── Collapsible: Operations ──────────────────────────────────────────────
  const opsItems = [
    enDefault('decoration') && { id: 'inv_full',     label: t('nav_inventory'),   icon: 'inventory',
      ...(badges.inv_full ? { badge: badges.inv_full, badgeColor: '#D97706' } : {}) },
    // alterations is now a top-level core workflow item — not listed here
    en('vendors')            && { id: 'vendors',      label: t('nav_vendors'),     icon: 'vendors' },
    // event_planning removed — merged into EventDetail coordinator role
    en('floorplan')          && { id: 'floorplan',    label: 'Floorplan',          icon: 'floorplan' },
    en('pos')                && { id: 'pos',           label: 'Point of sale',      icon: 'pos' },
    en('retail')             && { id: 'retail',        label: 'Retail',             icon: 'retail' },
    en('staff_sched')        && { id: 'staff_sched',   label: 'Staff schedule',     icon: 'staffsched' },
    en('purchase_orders')    && { id: 'purchase_orders', label: 'Purchase Orders',  icon: 'purchase_orders' },
    en('fb_beo')             && { id: 'fb_beo',        label: 'F&B / BEO',          icon: 'fbbeo' },
    en('audit_ui')           && { id: 'audit_ui',      label: 'Audit log',          icon: 'auditlog' },
    en('data_export')        && { id: 'data_export',   label: 'Data export',        icon: 'export' },
    en('dress_catalog')      && { id: 'dress_catalog', label: 'Dress catalog',      icon: 'catalog' },
    en('measurements')       && { id: 'measurements',  label: 'Measurements',       icon: 'measures' },
  ].filter(Boolean);

  // ── Collapsible: Finance ─────────────────────────────────────────────────
  const financeItems = [
    en('expenses')           && { id: 'expenses',     label: t('nav_expenses'),    icon: 'expenses' },
    { id: 'commissions',       label: 'Commissions',                               icon: 'commissions' },
    en('online_payments')    && { id: 'online_pay',   label: 'Payment links',      icon: 'paylinks' },
    { id: 'promo_codes',       label: 'Promo Codes',                               icon: 'promo' },
    { id: 'quote_builder',     label: 'Quotes',                                    icon: 'quote' },
    en('reports')            && { id: 'reports',      label: t('nav_reports'),     icon: 'reports' },
    en('accounting')         && { id: 'accounting',   label: 'Accounting',         icon: 'accounting' },
  ].filter(Boolean);

  // ── Collapsible: Marketing ───────────────────────────────────────────────
  const marketingItems = [
    en('waitlist')           && { id: 'waitlist',     label: 'Waitlist',           icon: 'waitlist' },
    { id: 'sms_inbox',         label: 'SMS Inbox',                                 icon: 'sms' },
    en('reviews')            && { id: 'reviews',      label: 'Reviews',            icon: 'reviews' },
    { id: 'funnel',            label: 'Sales Funnel',                              icon: 'funnel' },
    en('photo_gallery')      && { id: 'photo_gallery', label: 'Photo gallery',     icon: 'gallery' },
    en('email_marketing')    && { id: 'email_mkt',    label: 'Email marketing',    icon: 'emailmkt' },
    en('ticketing')          && { id: 'ticketing',    label: 'Ticketing',          icon: 'ticketing' },
  ].filter(Boolean);

  const sections = [];
  if (opsItems.length)       sections.push({ key: 'operations', label: 'Operations', items: opsItems });
  if (financeItems.length)   sections.push({ key: 'finance',    label: 'Finance',    items: financeItems });
  if (marketingItems.length) sections.push({ key: 'marketing',  label: 'Marketing',  items: marketingItems });

  // allFlat: for IconRail — top-level + section items, no dividers
  const allFlat = [
    ...topLevel,
    ...sections.flatMap(s => s.items),
    { id: 'roadmap', label: "What's new", icon: 'roadmap' },
    { id: 'help', label: 'Help', icon: 'help' },
  ];

  return { topLevel, sections, allFlat };
}

// Filter nav items array by role (used for top-level and section items separately)
function filterItemsByRole(items, myRole) {
  if (!myRole || myRole === 'owner') return items;
  return items.filter(item => canAccess(myRole, item.id));
}

// Filter the entire structure by role
function filterStructureByRole({ topLevel, sections, allFlat }, myRole) {
  if (!myRole || myRole === 'owner') return { topLevel, sections, allFlat };
  return {
    topLevel: filterItemsByRole(topLevel, myRole),
    sections: sections
      .map(s => ({ ...s, items: filterItemsByRole(s.items, myRole) }))
      .filter(s => s.items.length > 0),
    allFlat: filterItemsByRole(allFlat, myRole),
  };
}

// ─── SECTION OPEN/CLOSED STATE ──────────────────────────────────────────────
const LS_KEY = 'belori_nav_sections';

function loadSectionState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) { /* ignore */ }
  return { operations: false, finance: false, marketing: false };
}

function saveSectionState(state) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (_) { /* ignore */ }
}

// ─── BOUTIQUE SWITCHER DROPDOWN ──────────────────────────────────────────────
const BoutiqueSwitcher = ({ boutique, boutiques = [], onSwitch }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (boutiques.length <= 1) {
    return (
      <div>
        <div style={{ fontSize: 14, fontWeight: 500, color: C.ink }}>Belori</div>
        <div style={{ fontSize: 11, color: C.gray, maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {boutique?.name || 'Your Boutique'}
        </div>
      </div>
    );
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: C.ink }}>Belori</div>
        <div style={{ fontSize: 11, color: 'var(--brand-primary, #C9697A)', display: 'flex', alignItems: 'center', gap: 3, maxWidth: 130 }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{boutique?.name || 'Your Boutique'}</span>
          <span style={{ fontSize: 9, opacity: 0.7, flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
        </div>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, background: C.white, border: `1px solid ${C.border}`, borderRadius: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 180, zIndex: 500, overflow: 'hidden' }}>
          <div style={{ padding: '8px 12px 6px', fontSize: 10, fontWeight: 500, color: C.gray, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Switch boutique
          </div>
          {boutiques.map(b => (
            <button key={b.id} onClick={() => { onSwitch(b.id); setOpen(false); }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 12px',
                background: b.id === boutique?.id ? 'var(--brand-pale, #FDF5F6)' : 'transparent',
                border: 'none', cursor: 'pointer', textAlign: 'left', borderTop: `1px solid ${C.border}` }}>
              <Avatar initials={(b.name || 'B').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()} size={26} bg={'var(--brand-pale, #FDF5F6)'} color={'var(--brand-primary, #C9697A)'} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: b.id === boutique?.id ? 'var(--brand-primary, #C9697A)' : C.ink,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</div>
                {b.id === boutique?.id && <div style={{ fontSize: 10, color: 'var(--brand-primary, #C9697A)' }}>Active</div>}
              </div>
              {b.id === boutique?.id && <span style={{ fontSize: 12, color: 'var(--brand-primary, #C9697A)' }}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── NAV ITEM ────────────────────────────────────────────────────────────────
const NavItem = ({ item, active, onClick, indented = false }) => {
  // Core workflow items get a subtle rosa tint + left accent border when inactive
  const isCoreInactive = item.core && !active;
  const isCoreActive   = item.core && active;
  return (
  <div
    onClick={onClick}
    style={{
      display: 'flex', alignItems: 'center', gap: 8,
      // Shift padding-left to accommodate the left border for core items without shifting text
      paddingTop: 8, paddingBottom: 8,
      paddingRight: indented ? 10 : 10,
      paddingLeft: item.core ? (indented ? 17 : 7) : (indented ? 20 : 10),
      borderRadius: 8, cursor: 'pointer', marginBottom: 1,
      background: active
        ? 'var(--brand-pale, #FDF5F6)'
        : isCoreInactive
          ? 'rgba(200,100,120,0.06)'
          : 'transparent',
      borderLeft: isCoreActive
        ? `3px solid var(--brand-primary, #C9697A)`
        : isCoreInactive
          ? `3px solid rgba(201,105,122,0.35)`
          : '3px solid transparent',
      color: active ? 'var(--brand-primary, #C9697A)' : C.gray,
      fontWeight: active ? 500 : 400,
      fontSize: 'var(--text-body)',
      minHeight: 'var(--nav-item-height)',
      transition: 'all 0.15s',
    }}
    onMouseEnter={e => {
      if (!active) {
        e.currentTarget.style.background = isCoreInactive ? 'rgba(200,100,120,0.1)' : C.ivory;
      }
    }}
    onMouseLeave={e => {
      if (!active) {
        e.currentTarget.style.background = isCoreInactive ? 'rgba(200,100,120,0.06)' : 'transparent';
      }
    }}
  >
    <span style={{ opacity: active ? 1 : 0.6 }}>{icons[item.icon]}</span>
    <span style={{ flex: 1 }}>{item.label}</span>
    {item.tasksBadge && (
      <span style={{ fontSize: 'var(--text-badge)', padding: '1px 6px', borderRadius: 999, background: '#DC2626', color: C.white, fontWeight: 500 }}
        title="Alert tasks">{item.tasksBadge}</span>
    )}
    {item.badge && (
      <span style={{ fontSize: 'var(--text-badge)', padding: '1px 6px', borderRadius: 999,
        background: item.badgeColor || 'var(--bg-accent)', color: item.badgeColor ? C.white : 'var(--color-accent)', fontWeight: 500 }}>{item.badge}</span>
    )}
  </div>
  );
};

// ─── COLLAPSIBLE SECTION ─────────────────────────────────────────────────────
const CollapsibleSection = ({ sectionKey, label, items, screen, setScreen, open, onToggle }) => {
  const hasActive = items.some(item => item.id === screen);

  return (
    <div style={{ marginBottom: 2 }}>
      {/* Section header */}
      <div
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          paddingTop: 8, paddingBottom: 4, paddingLeft: 10, paddingRight: 10,
          cursor: 'pointer', userSelect: 'none',
        }}
      >
        <span style={{
          fontSize: 10, fontWeight: 600, color: hasActive ? 'var(--brand-primary, #C9697A)' : C.gray,
          letterSpacing: '0.07em', textTransform: 'uppercase',
        }}>
          {label}
        </span>
        <span style={{
          fontSize: 10, color: hasActive ? 'var(--brand-primary, #C9697A)' : C.gray,
          display: 'inline-block',
          transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s ease',
          lineHeight: 1,
        }}>
          ▶
        </span>
      </div>

      {/* Section items */}
      {open && (
        <div>
          {items.map(item => (
            <NavItem
              key={item.id}
              item={item}
              active={screen === item.id}
              onClick={() => setScreen(item.id)}
              indented
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ─── SIDEBAR (full desktop) ───────────────────────────────────────────────────
const Sidebar = ({ screen, setScreen, boutique, boutiques = [], onSwitchBoutique, onSignOut, badges = {}, onSearch, alertCount = 0, onAlerts, myRole = 'owner', focusMode = false, onToggleFocus, onShortcuts }) => {
  const { isEnabled } = useModules();
  const { t } = useI18n();
  const toggleFocus = onToggleFocus;

  const modules = {
    alterations: isEnabled('alterations'), dress_rental: isEnabled('dress_rental'),
    decoration: isEnabled('decoration'), event_planning: isEnabled('event_planning'),
    measurements: isEnabled('measurements'), vendors: isEnabled('vendors'),
    dress_catalog: isEnabled('dress_catalog'), fb_beo: isEnabled('fb_beo'),
    floorplan: isEnabled('floorplan'), pos: isEnabled('pos'),
    retail: isEnabled('retail'), staff_sched: isEnabled('staff_sched'),
    audit_ui: isEnabled('audit_ui'), data_export: isEnabled('data_export'),
    waitlist: isEnabled('waitlist'), photo_gallery: isEnabled('photo_gallery'),
    email_marketing: isEnabled('email_marketing'), ticketing: isEnabled('ticketing'),
    reviews: isEnabled('reviews'), online_payments: isEnabled('online_payments'),
    expenses: isEnabled('expenses'), accounting: isEnabled('accounting'),
    reports: isEnabled('reports'), purchase_orders: isEnabled('purchase_orders'),
  };

  const rawStructure = buildNavStructure(badges, modules, t);
  const { topLevel, sections } = filterStructureByRole(rawStructure, myRole);

  // Section open/closed state
  const [sectionOpen, setSectionOpen] = useState(() => {
    const saved = loadSectionState();
    // Auto-expand any section that contains the active screen
    const result = { ...saved };
    for (const s of rawStructure.sections) {
      if (s.items.some(item => item.id === screen)) {
        result[s.key] = true;
      }
    }
    return result;
  });

  // Auto-expand section when active screen changes into a section
  useEffect(() => {
    for (const s of sections) {
      if (s.items.some(item => item.id === screen)) {
        setSectionOpen(prev => {
          if (prev[s.key]) return prev; // already open, skip update
          const next = { ...prev, [s.key]: true };
          saveSectionState(next);
          return next;
        });
        break;
      }
    }
  }, [screen, sections]);

  const toggleSection = useCallback((key) => {
    setSectionOpen(prev => {
      const next = { ...prev, [key]: !prev[key] };
      saveSectionState(next);
      return next;
    });
  }, []);

  return (
    <div className="sidebar-full" style={{ width: 'var(--sidebar-width)', background: 'var(--bg-sidebar, #FFFFFF)', borderRight: `1px solid var(--border-color, ${C.border})`, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      {/* Logo + boutique */}
      <div style={{ padding: '16px 16px 12px', borderBottom: `1px solid var(--border-color, ${C.border})` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, background: C.ink, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg viewBox="0 0 32 32" fill="none" style={{ width: 20, height: 20 }}><path d="M7 25V7l18 18V7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <BoutiqueSwitcher boutique={boutique} boutiques={boutiques} onSwitch={onSwitchBoutique} />
        </div>
      </div>

      {/* Search bar */}
      <div style={{ padding: '8px 10px', borderBottom: `1px solid ${C.border}` }}>
        <button onClick={onSearch}
          style={{ display: 'flex', alignItems: 'center', gap: 7, width: '100%', padding: '7px 10px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.ivory, cursor: 'pointer', color: C.gray, fontSize: 12, minHeight: 'unset', minWidth: 'unset', transition: 'all 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = C.rosa; e.currentTarget.style.color = C.rosa; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.gray; }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <span style={{ flex: 1, textAlign: 'left' }}>Search…</span>
          <span style={{ fontSize: 9, background: C.white, border: `1px solid ${C.border}`, borderRadius: 4, padding: '1px 5px', opacity: 0.7 }}>⌘K</span>
        </button>
      </div>

      {/* Focus mode banner */}
      {focusMode && (
        <div style={{ margin: '6px 8px 0', background: 'rgba(201,105,122,0.08)', border: '1px solid rgba(201,105,122,0.25)', borderRadius: 8, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13 }}>⚡</span>
          <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--brand-primary, #C9697A)', flex: 1 }}>Focus Mode</span>
          <span style={{ fontSize: 10, color: C.gray }}>Core only</span>
        </div>
      )}

      {/* Nav */}
      <nav style={{ padding: 8, flex: 1, overflowY: 'auto' }}>
        {/* In focus mode: show only 5 core items; otherwise show full top-level */}
        {(focusMode ? topLevel.filter(item => FOCUS_IDS.has(item.id)) : topLevel).map(item => (
          <NavItem
            key={item.id}
            item={item}
            active={screen === item.id}
            onClick={() => setScreen(item.id)}
            indented={false}
          />
        ))}

        {/* Collapsible sections — hidden in focus mode */}
        {!focusMode && sections.map(section => (
          <CollapsibleSection
            key={section.key}
            sectionKey={section.key}
            label={section.label}
            items={section.items}
            screen={screen}
            setScreen={setScreen}
            open={!!sectionOpen[section.key]}
            onToggle={() => toggleSection(section.key)}
          />
        ))}

        {/* What's new + Help — hidden in focus mode */}
        {!focusMode && <>
          <NavItem
            item={{ id: 'roadmap', label: "What's new", icon: 'roadmap' }}
            active={screen === 'roadmap'}
            onClick={() => setScreen('roadmap')}
            indented={false}
          />
          <NavItem
            item={{ id: 'help', label: 'Help', icon: 'help' }}
            active={screen === 'help'}
            onClick={() => setScreen('help')}
            indented={false}
          />
        </>}
      </nav>

      {/* Footer */}
      <div style={{ padding: '10px 12px', borderTop: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Focus Mode toggle */}
        <button
          onClick={toggleFocus}
          title={focusMode ? 'Exit Focus Mode' : 'Enter Focus Mode — show only core workflows'}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            width: '100%', padding: '7px 10px', borderRadius: 8,
            border: `1px solid ${focusMode ? 'rgba(201,105,122,0.4)' : C.border}`,
            background: focusMode ? 'rgba(201,105,122,0.08)' : C.ivory,
            cursor: 'pointer', fontSize: 12, minHeight: 'unset', minWidth: 'unset',
            color: focusMode ? 'var(--brand-primary, #C9697A)' : C.gray,
            fontWeight: focusMode ? 500 : 400,
            transition: 'all 0.15s',
          }}
        >
          <span style={{ fontSize: 14 }}>{focusMode ? '⚡' : '◎'}</span>
          <span style={{ flex: 1, textAlign: 'left' }}>{focusMode ? 'Exit Focus Mode' : 'Focus Mode'}</span>
          <span style={{ fontSize: 9, opacity: 0.5 }}>{focusMode ? 'ON' : 'OFF'}</span>
        </button>

        {/* Keyboard shortcuts help button */}
        <button
          onClick={() => onShortcuts && onShortcuts()}
          style={{background:'none',border:'none',cursor:'pointer',color:C.gray,fontSize:13,padding:'4px 6px',borderRadius:6,display:'flex',alignItems:'center',gap:6,width:'100%',minHeight:'unset',minWidth:'unset'}}
          title="Keyboard shortcuts (?)"
          onMouseEnter={e=>{e.currentTarget.style.background=C.grayBg;e.currentTarget.style.color=C.ink;}}
          onMouseLeave={e=>{e.currentTarget.style.background='none';e.currentTarget.style.color=C.gray;}}
        >
          <span style={{width:18,height:18,borderRadius:'50%',border:`1.5px solid currentColor`,display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,flexShrink:0}}>?</span>
          <span style={{fontSize:11}}>Keyboard shortcuts</span>
        </button>

        {/* Account row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Avatar initials={(boutique?.name || 'B').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()} size={28} bg={'var(--brand-pale, #FDF5F6)'} color={'var(--brand-primary, #C9697A)'} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: C.ink }}>My account</div>
            <div style={{ fontSize: 11, color: C.gray }}>{ROLE_LABELS[myRole] || 'Staff'}</div>
          </div>
          {/* Bell icon */}
          <button onClick={onAlerts} title="Alerts"
            style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', color: alertCount > 0 ? 'var(--brand-primary, #C9697A)' : C.gray, padding: '4px', minHeight: 'unset', minWidth: 'unset', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
            {alertCount > 0 && <span style={{ position: 'absolute', top: 0, right: 0, width: 14, height: 14, borderRadius: '50%', background: '#DC2626', color: '#fff', fontSize: 8, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>{alertCount > 9 ? '9+' : alertCount}</span>}
          </button>
          <span onClick={onSignOut} title="Sign out" style={{ cursor: 'pointer', color: C.gray, fontSize: 11 }}>↩</span>
        </div>
      </div>
    </div>
  );
};

// ─── BOTTOM NAV (mobile) ──────────────────────────────────────────────────────
let _bnStyleInjected = false;
function ensureBottomNavStyle() {
  if (_bnStyleInjected || typeof document === 'undefined') return;
  _bnStyleInjected = true;
  const s = document.createElement('style');
  s.textContent = `.bottom-nav { display: none; } @media(max-width:768px){ .bottom-nav { display: flex !important; } }`;
  document.head.appendChild(s);
}

const BottomNav = ({ screen, setScreen, badges = {} }) => {
  const { t } = useI18n();
  ensureBottomNavStyle();
  const [showMore, setShowMore] = useState(false);

  const BOTTOM_NAV_ITEMS = [
    { id: 'dashboard',   label: t('nav_dashboard'),   icon: 'overview' },
    { id: 'events',      label: t('nav_events'),      icon: 'events',      badge: badges.events      || 0 },
    { id: 'alterations', label: t('nav_alterations'), icon: 'alterations', badge: badges.alterations || 0, badgeColor: '#DC2626' },
    { id: 'payments',    label: t('nav_payments'),    icon: 'payments',    badge: badges.payments    || 0, badgeColor: '#DC2626' },
  ];

  const MORE_ITEMS = [
    { id: 'clients',    label: t('nav_clients'),  icon: 'clients'  },
    { id: 'inventory',  label: 'Dress Rentals',   icon: 'rentals'  },
    { id: 'inv_full',   label: 'Inventory',       icon: 'inventory' },
    { id: 'settings',   label: t('nav_settings'), icon: 'settings' },
  ];

  const moreActive = MORE_ITEMS.some(i => i.id === screen);

  return (
    <>
      {/* More menu popover */}
      {showMore && (
        <>
          <div onClick={() => setShowMore(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 98 }} />
          <div style={{ position: 'fixed', bottom: 'calc(60px + env(safe-area-inset-bottom, 0px))', left: '50%', transform: 'translateX(-50%)',
            background: C.white, border: `1px solid ${C.border}`, borderRadius: 14,
            boxShadow: '0 -4px 20px rgba(0,0,0,0.12)', zIndex: 99, minWidth: 220, overflow: 'hidden' }}>
            {MORE_ITEMS.map(item => {
              const act = screen === item.id;
              return (
                <button key={item.id} onClick={() => { setScreen(item.id); setShowMore(false); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '13px 18px',
                    background: act ? 'var(--brand-pale, #FDF5F6)' : 'transparent',
                    border: 'none', borderBottom: `1px solid ${C.border}`, cursor: 'pointer',
                    color: act ? 'var(--brand-primary, #C9697A)' : C.ink, fontWeight: act ? 600 : 400, fontSize: 14,
                    WebkitTapHighlightColor: 'transparent' }}>
                  <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{icons[item.icon]}</span>
                  {item.label}
                </button>
              );
            })}
          </div>
        </>
      )}

      <div className="bottom-nav" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#FFFFFF', borderTop: `1px solid ${C.border}`, zIndex: 100, justifyContent: 'space-around', alignItems: 'stretch', paddingBottom: 'env(safe-area-inset-bottom, 0px)', height: 'calc(60px + env(safe-area-inset-bottom, 0px))' }}>
        {BOTTOM_NAV_ITEMS.map(item => {
          const active = screen === item.id;
          return (
            <button key={item.id} onClick={() => { setShowMore(false); setScreen(item.id); }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, border: 'none', background: 'transparent',
                color: active ? 'var(--brand-primary, #C9697A)' : '#9CA3AF', fontSize: 9, fontWeight: active ? 600 : 400, cursor: 'pointer', flex: 1,
                height: 60, padding: '0', transition: 'color 0.15s', WebkitTapHighlightColor: 'transparent', position: 'relative' }}>
              <span style={{ fontSize: 20, lineHeight: 1, opacity: active ? 1 : 0.55, transition: 'opacity 0.15s' }}>{icons[item.icon]}</span>
              <span style={{ maxWidth: 56, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
              {item.badge > 0 && (
                <span style={{ position: 'absolute', top: 6, right: 'calc(50% - 16px)', minWidth: 16, height: 16, borderRadius: 8, fontSize: 9, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
                  background: item.badgeColor || C.rosa, color: C.white }}>{item.badge > 99 ? '99+' : item.badge}</span>
              )}
            </button>
          );
        })}
        {/* More button */}
        <button onClick={() => setShowMore(s => !s)}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, border: 'none', background: 'transparent',
            color: (moreActive || showMore) ? 'var(--brand-primary, #C9697A)' : '#9CA3AF', fontSize: 9, fontWeight: (moreActive || showMore) ? 600 : 400,
            cursor: 'pointer', flex: 1, height: 60, padding: '0', transition: 'color 0.15s', WebkitTapHighlightColor: 'transparent' }}>
          <span style={{ fontSize: 20, lineHeight: 1, opacity: (moreActive || showMore) ? 1 : 0.55, transition: 'opacity 0.15s', display:'flex', alignItems:'center', justifyContent:'center', width:22, height:22 }}>
            <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor"><circle cx="3" cy="8" r="1.4"/><circle cx="8" cy="8" r="1.4"/><circle cx="13" cy="8" r="1.4"/></svg>
          </span>
          <span>More</span>
        </button>
      </div>
    </>
  );
};

// ─── ICON RAIL (tablet / compact mode) ───────────────────────────────────────
const IconRail = ({ screen, setScreen, onSignOut, boutique, boutiques = [], onSwitchBoutique, badges = {}, myRole = 'owner' }) => {
  const { isEnabled } = useModules();
  const { t } = useI18n();

  const modules = {
    alterations: isEnabled('alterations'), dress_rental: isEnabled('dress_rental'),
    decoration: isEnabled('decoration'), event_planning: isEnabled('event_planning'),
    measurements: isEnabled('measurements'), vendors: isEnabled('vendors'),
    dress_catalog: isEnabled('dress_catalog'), fb_beo: isEnabled('fb_beo'),
    floorplan: isEnabled('floorplan'), pos: isEnabled('pos'),
    retail: isEnabled('retail'), staff_sched: isEnabled('staff_sched'),
    audit_ui: isEnabled('audit_ui'), data_export: isEnabled('data_export'),
    waitlist: isEnabled('waitlist'), photo_gallery: isEnabled('photo_gallery'),
    email_marketing: isEnabled('email_marketing'), ticketing: isEnabled('ticketing'),
    reviews: isEnabled('reviews'), online_payments: isEnabled('online_payments'),
    expenses: isEnabled('expenses'), accounting: isEnabled('accounting'),
    reports: isEnabled('reports'), purchase_orders: isEnabled('purchase_orders'),
  };

  const rawStructure = buildNavStructure(badges, modules, t);
  const { allFlat } = filterStructureByRole(rawStructure, myRole);

  return (
    <div className="sidebar-icons" style={{ width: 72, background: C.white, borderRight: `1px solid ${C.border}`, flexDirection: 'column', flexShrink: 0, alignItems: 'center' }}>
      {/* Logo */}
      <div style={{ width: '100%', padding: '14px 0 10px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: 36, height: 36, background: C.ink, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg viewBox="0 0 32 32" fill="none" style={{ width: 18, height: 18 }}><path d="M7 25V7l18 18V7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
      </div>

      {/* Nav items — flat, no grouping */}
      <div style={{ padding: '8px 6px', flex: 1, display: 'flex', flexDirection: 'column', gap: 2, width: '100%', overflowY: 'auto' }}>
        {allFlat.map(item => {
          const active = screen === item.id;
          return (
            <button key={item.id} onClick={() => setScreen(item.id)}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 4, padding: '10px 4px', borderRadius: 12, cursor: 'pointer', width: '100%',
                position: 'relative', transition: 'all 0.14s', border: 'none',
                background: active ? 'var(--brand-pale, #FDF5F6)' : 'transparent',
                color: active ? 'var(--brand-primary, #C9697A)' : '#9CA3AF',
                minHeight: 'unset', minWidth: 'unset' }}>
              <span style={{ width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {icons[item.icon]}
              </span>
              <span style={{ fontSize: 9, color: active ? 'var(--brand-primary, #C9697A)' : '#9CA3AF', textAlign: 'center', lineHeight: 1.2, fontWeight: active ? 500 : 400 }}>
                {item.label}
              </span>
              {item.tasksBadge && (
                <span style={{ position: 'absolute', top: 6, left: 5, minWidth: 17, height: 17, borderRadius: 9, fontSize: 9, fontWeight: 500,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
                  background: '#DC2626', color: C.white }} title="Alert tasks">{item.tasksBadge}</span>
              )}
              {item.badge && (
                <span style={{ position: 'absolute', top: 6, right: 5, minWidth: 17, height: 17, borderRadius: 9, fontSize: 9, fontWeight: 500,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
                  background: item.badgeColor || C.purple, color: C.white }}>{item.badge}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* User avatar / boutique switcher footer */}
      <div style={{ padding: '10px 6px 14px', borderTop: `1px solid ${C.border}`, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        {boutiques.length > 1 && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center' }}>
            {boutiques.map(b => (
              <button key={b.id} onClick={() => onSwitchBoutique?.(b.id)}
                title={b.name}
                style={{ width: 32, height: 32, borderRadius: '50%', border: `2px solid ${b.id === boutique?.id ? C.rosa : C.border}`,
                  background: b.id === boutique?.id ? C.rosaPale : C.ivory,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 500, color: b.id === boutique?.id ? C.rosa : C.gray, cursor: 'pointer' }}>
                {(b.name || 'B').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
              </button>
            ))}
          </div>
        )}
        <div onClick={onSignOut} title="Sign out"
          style={{ width: 40, height: 40, borderRadius: '50%', background: C.rosaPale, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 500, color: C.rosa, cursor: 'pointer' }}>
          {(boutique?.name || 'B').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
export { BottomNav, IconRail };
