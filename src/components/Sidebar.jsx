import React, { useState, useRef, useEffect, useCallback } from 'react';
import { C } from '../lib/colors';
import { icons, Avatar } from '../lib/ui.jsx';
import { useModules } from '../hooks/useModules.jsx';
import { canAccess, ROLE_LABELS } from '../lib/permissions.js';
import { useI18n } from '../lib/i18n/index.jsx';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { injectCoutureFonts, D as Dtokens } from '../lib/couture.jsx';
// Nav items shown in Focus Mode (core workflow only).
// Updated for Phase 1+2 IA cleanup — now points at the unified hubs.
const FOCUS_IDS = new Set(['dashboard', 'events', 'inventory_hub', 'alterations', 'clients', 'finance', 'schedule']);

// ─── NAV STRUCTURE ──────────────────────────────────────────────────────────
// Returns { topLevel, sections, allFlat }
// topLevel: always-visible items (kept to ≤8 for clarity)
// sections: array of { key, label, items[] }
// allFlat: all nav items — used by IconRail
function buildNavStructure(badges = {}, modules = {}, t = (k) => k) {
  const en = (k) => modules[k] === true;

  // ── Core top-level items ─────────────────────────────────────────────────
  // Phase 1+2 IA cleanup:
  //   - "Dress Rentals" + "Inventory" → single "Inventory" hub (Catalog/Rentals tabs)
  //   - "Payments" + Invoices/Pay Links/Commissions/Promo Codes → single "Finance" hub
  //   - "Reports" + Report Builder + Accounting → single "Reports" hub
  //   - "Activity Feed" (global) removed — covered by per-event journal
  //   - "Sales Funnel" → Pipeline tab in Clients
  const topLevel = [
    { id: 'dashboard',     label: t('nav_dashboard'),    icon: 'overview' },
    { id: 'events',        label: t('nav_events'),        icon: 'events',   core: true,
      ...(badges.events ? { badge: badges.events } : {}),
      ...(badges.tasks  ? { tasksBadge: badges.tasks } : {}) },
    (en('dress_rental') || en('decoration')) && { id: 'inventory_hub', label: 'Inventory', icon: 'rentals', core: true,
      ...(badges.inv_full ? { badge: badges.inv_full, badgeColor: '#D97706' } : {}) },
    en('alterations')  && { id: 'alterations', label: t('nav_alterations'), icon: 'alterations', core: true,
      ...(badges.alterations ? { badge: badges.alterations, badgeColor: 'var(--color-danger)' } : {}) },
    { id: 'clients',       label: t('nav_clients'),       icon: 'clients' },
    { id: 'schedule',      label: 'Schedule',             icon: 'calendar' },
    { id: 'finance',       label: 'Finance',              icon: 'payments',
      ...(badges.payments ? { badge: badges.payments, badgeColor: 'var(--color-danger)' } : {}) },
    en('reports')      && { id: 'reports_hub', label: t('nav_reports'),    icon: 'reports' },
    { id: 'my_tasks',      label: 'My Tasks',             icon: 'mytasks',
      ...(badges.myTasks ? { badge: badges.myTasks, badgeColor: 'var(--color-danger)' } : {}) },
    { id: 'settings',      label: t('nav_settings'),      icon: 'settings' },
  ].filter(Boolean);

  // ── Collapsible: Operations ──────────────────────────────────────────────
  // Pruned in the Phase 1+2 IA cleanup:
  //   - 'inv_full' merged into the unified Inventory hub at top-level
  //   - 'staff_sched' is already a tab inside the top-level Schedule page
  //   - 'audit_ui' / 'data_export' moved to Settings → Admin tab
  const opsItems = [
    en('vendors')            && { id: 'vendors',        label: t('nav_vendors'),      icon: 'vendors' },
    en('floorplan')          && { id: 'floorplan',      label: 'Floorplan',           icon: 'floorplan' },
    en('pos')                && { id: 'pos',             label: 'Point of Sale',       icon: 'pos' },
    en('retail')             && { id: 'retail',          label: 'Retail',              icon: 'retail' },
    en('purchase_orders')    && { id: 'purchase_orders', label: 'Purchase Orders',     icon: 'purchase_orders' },
    en('fb_beo')             && { id: 'fb_beo',          label: 'F&B / BEO',           icon: 'fbbeo' },
    en('dress_catalog')      && { id: 'dress_catalog',   label: 'Dress Catalog',       icon: 'catalog' },
    en('measurements')       && { id: 'measurements',    label: 'Measurements',        icon: 'measures' },
  ].filter(Boolean);

  // ── Collapsible: Finance ─────────────────────────────────────────────────
  // Phase 1+2 IA cleanup: Payments / Invoices / Payment Links / Commissions /
  // Promo Codes are all collapsed into a single top-level "Finance" hub with
  // tabs (see top-level array below). Reports / Report Builder / Accounting
  // collapsed into "Reports". Only Expenses remains as a standalone screen
  // here because it's a daily-entry workflow distinct from receivables.
  const financeItems = [
    en('expenses')           && { id: 'expenses',           label: t('nav_expenses'),     icon: 'expenses' },
  ].filter(Boolean);

  // ── Collapsible: Marketing & Tools ───────────────────────────────────────
  // Phase 1+2 IA cleanup:
  //   - 'activity_feed' (global) removed — per-event activity lives on EventDetail
  //   - 'funnel' (Sales Funnel) removed — Pipeline now renders as a tab in Clients
  const marketingItems = [
    { id: 'sms_inbox',        label: 'SMS Inbox',                                        icon: 'sms' },
    en('waitlist')           && { id: 'waitlist',           label: 'Waitlist',            icon: 'waitlist' },
    en('reviews')            && { id: 'reviews',            label: 'Reviews',             icon: 'reviews' },
    en('photo_gallery')      && { id: 'photo_gallery',      label: 'Photo Gallery',       icon: 'gallery' },
    en('email_marketing')    && { id: 'email_mkt',          label: 'Email Marketing',     icon: 'emailmkt' },
    en('ticketing')          && { id: 'ticketing',          label: 'Ticketing',           icon: 'ticketing' },
  ].filter(Boolean);

  const sections = [];
  if (opsItems.length)       sections.push({ key: 'operations', label: 'Operations',         items: opsItems });
  if (financeItems.length)   sections.push({ key: 'finance',    label: 'Finance',            items: financeItems });
  if (marketingItems.length) sections.push({ key: 'marketing',  label: 'Marketing & Tools',  items: marketingItems });

  // allFlat: for IconRail — top-level + section items, no dividers
  const allFlat = [
    ...topLevel,
    ...sections.flatMap(s => s.items),
    { id: 'roadmap', label: "What's New", icon: 'roadmap' },
    { id: 'help',    label: 'Help',        icon: 'help' },
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
    const clickHandler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const keyHandler = e => { if (e.key === 'Escape') { setOpen(false); } };
    document.addEventListener('mousedown', clickHandler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', clickHandler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [open]);

  if (boutiques.length <= 1) {
    return (
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{
          fontFamily: Dtokens.display, fontSize: 22, color: Dtokens.ink, lineHeight: 1,
          letterSpacing: '0.005em',
        }}>Belori</div>
        <div style={{
          fontFamily: Dtokens.sans, fontSize: 10, color: Dtokens.gold,
          textTransform: 'uppercase', letterSpacing: '0.22em',
          marginTop: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {boutique?.name || 'Atelier'}
        </div>
      </div>
    );
  }

  const menuId = 'boutique-switcher-menu';
  return (
    <div ref={ref} style={{ position: 'relative', minWidth: 0, flex: 1 }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`Switch boutique. Current: ${boutique?.name || 'Atelier'}`}
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer',
          textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
        <div style={{
          fontFamily: Dtokens.display, fontSize: 22, color: Dtokens.ink, lineHeight: 1,
          letterSpacing: '0.005em',
        }}>Belori</div>
        <div style={{
          fontFamily: Dtokens.sans, fontSize: 10, color: Dtokens.gold,
          textTransform: 'uppercase', letterSpacing: '0.22em',
          display: 'flex', alignItems: 'center', gap: 4,
          overflow: 'hidden',
        }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{boutique?.name || 'Atelier'}</span>
          <span aria-hidden="true" style={{ fontSize: 8, opacity: 0.8, flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
        </div>
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Switch boutique"
          style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, background: C.white, border: `1px solid ${C.border}`, borderRadius: 2,
            boxShadow: '0 8px 24px rgba(28,17,24,0.12)', minWidth: 200, zIndex: 500, overflow: 'hidden' }}>
          <div style={{ padding: '10px 12px 8px', fontFamily: Dtokens.sans, fontSize: 9, fontWeight: 600, color: Dtokens.inkLight, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
            Switch boutique
          </div>
          {boutiques.map(b => (
            <button
              key={b.id}
              role="menuitemradio"
              aria-checked={b.id === boutique?.id}
              onClick={() => { onSwitch(b.id); setOpen(false); }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 12px',
                background: b.id === boutique?.id ? Dtokens.goldLight : 'transparent',
                border: 'none', cursor: 'pointer', textAlign: 'left', borderTop: `1px solid ${C.border}` }}>
              <Avatar initials={(b.name || 'B').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()} size={26} bg={Dtokens.goldLight} color={Dtokens.goldDark} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: b.id === boutique?.id ? Dtokens.goldDark : C.ink,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</div>
                {b.id === boutique?.id && <div style={{ fontSize: 10, color: Dtokens.goldDark }}>Active</div>}
              </div>
              {b.id === boutique?.id && <span aria-hidden="true" style={{ fontSize: 12, color: Dtokens.goldDark }}>✓</span>}
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
  <button
    type="button"
    onClick={onClick}
    onKeyDown={e => { if (e.key === ' ') { e.preventDefault(); onClick?.(); } }}
    aria-current={active ? 'page' : undefined}
    data-testid={`nav-${item.id}`}
    style={{
      display: 'flex', alignItems: 'center', gap: 8,
      width: '100%', textAlign: 'left',
      // Shift padding-left to accommodate the left border for core items without shifting text
      paddingTop: 8, paddingBottom: 8,
      paddingRight: indented ? 10 : 10,
      paddingLeft: item.core ? (indented ? 17 : 7) : (indented ? 20 : 10),
      borderRadius: 2, cursor: 'pointer', marginBottom: 1,
      border: 'none',
      background: active
        ? Dtokens.goldLight
        : isCoreInactive
          ? 'rgba(176,138,78,0.05)'
          : 'transparent',
      borderLeft: isCoreActive
        ? `2px solid ${Dtokens.gold}`
        : isCoreInactive
          ? `2px solid ${Dtokens.goldBorder}`
          : '2px solid transparent',
      color: active ? Dtokens.goldDark : Dtokens.inkMid,
      fontWeight: active ? 500 : 400,
      fontSize: 'var(--text-body)',
      fontFamily: Dtokens.sans,
      minHeight: 'var(--nav-item-height)',
      transition: 'all 0.2s cubic-bezier(.22,.61,.36,1)',
      letterSpacing: active ? '0.005em' : '0',
    }}
    onMouseEnter={e => {
      if (!active) {
        e.currentTarget.style.background = isCoreInactive ? 'rgba(176,138,78,0.09)' : '#F8F4F0';
        e.currentTarget.style.color = Dtokens.ink;
      }
    }}
    onMouseLeave={e => {
      if (!active) {
        e.currentTarget.style.background = isCoreInactive ? 'rgba(176,138,78,0.05)' : 'transparent';
        e.currentTarget.style.color = Dtokens.inkMid;
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
        background: item.badgeColor || 'var(--bg-accent)', color: item.badgeColor ? C.white : 'var(--text-accent)', fontWeight: 500 }}>{item.badge}</span>
    )}
  </button>
  );
};

// ─── COLLAPSIBLE SECTION ─────────────────────────────────────────────────────
const CollapsibleSection = ({ sectionKey, label, items, screen, setScreen, open, onToggle }) => {
  const hasActive = items.some(item => item.id === screen);

  return (
    <div style={{ marginBottom: 2 }}>
      {/* Section header */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`nav-section-${sectionKey}`}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', textAlign: 'left',
          paddingTop: 8, paddingBottom: 4, paddingLeft: 10, paddingRight: 10,
          border: 'none', background: 'none',
          cursor: 'pointer', userSelect: 'none',
        }}
      >
        <span style={{
          fontFamily: Dtokens.sans, fontSize: 10, fontWeight: 600,
          color: hasActive ? Dtokens.gold : Dtokens.inkLight,
          letterSpacing: '0.16em', textTransform: 'uppercase',
        }}>
          {label}
        </span>
        <span style={{
          fontSize: 9, color: hasActive ? Dtokens.gold : Dtokens.inkLight,
          display: 'inline-block',
          transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s ease',
          lineHeight: 1,
        }}>
          ▶
        </span>
      </button>

      {/* Section items */}
      {open && (
        <div id={`nav-section-${sectionKey}`}>
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
  const [outstandingInvoices, setOutstandingInvoices] = useState(0);
  useEffect(() => {
    if (!boutique?.id) return;
    supabase.from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('boutique_id', boutique.id)
      .in('status', ['sent', 'partially_paid'])
      .then(({ count }) => setOutstandingInvoices(count || 0));
  }, [boutique?.id]);
  const mergedBadges = { ...badges, invoices: outstandingInvoices || undefined };

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

  const rawStructure = buildNavStructure(mergedBadges, modules, t);
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

  // Load couture fonts once when the sidebar mounts (first authenticated surface)
  useEffect(() => { injectCoutureFonts(); }, []);

  return (
    <div className="sidebar-full" style={{ width: 'var(--sidebar-width)', background: 'var(--bg-sidebar, #FFFFFF)', borderRight: `1px solid var(--border-color, ${C.border})`, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      {/* Editorial wordmark */}
      <div style={{
        padding: '20px 16px 14px',
        borderBottom: `1px solid var(--border-color, ${C.border})`,
        position: 'relative',
      }}>
        <BoutiqueSwitcher boutique={boutique} boutiques={boutiques} onSwitch={onSwitchBoutique} />
        {/* hairline gold rule — subtle editorial touch */}
        <div aria-hidden="true" style={{
          position: 'absolute', left: 16, right: 16, bottom: -1, height: 1,
          background: `linear-gradient(90deg, transparent, ${Dtokens.gold} 50%, transparent)`,
          opacity: 0.4,
        }} />
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
        <div style={{ margin: '6px 8px 0', background: Dtokens.goldLight, border: `1px solid ${Dtokens.goldBorder}`, borderRadius: 2, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13 }}>⚡</span>
          <span style={{ fontSize: 10, fontWeight: 600, color: Dtokens.goldDark, flex: 1, textTransform: 'uppercase', letterSpacing: '0.14em' }}>Focus Mode</span>
          <span style={{ fontSize: 9, color: Dtokens.inkMid, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Core only</span>
        </div>
      )}

      {/* Nav */}
      <nav aria-label="Main navigation" style={{ padding: 8, flex: 1, overflowY: 'auto' }}>
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
            width: '100%', padding: '7px 10px', borderRadius: 2,
            border: `1px solid ${focusMode ? Dtokens.goldBorder : Dtokens.border}`,
            background: focusMode ? Dtokens.goldLight : '#F8F4F0',
            cursor: 'pointer', fontSize: 11, minHeight: 'unset', minWidth: 'unset',
            color: focusMode ? Dtokens.goldDark : Dtokens.inkMid,
            fontWeight: focusMode ? 500 : 400,
            fontFamily: Dtokens.sans,
            textTransform: 'uppercase', letterSpacing: '0.14em',
            transition: 'all 0.2s cubic-bezier(.22,.61,.36,1)',
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
          <Avatar initials={(boutique?.name || 'B').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()} size={28} bg={Dtokens.goldLight} color={Dtokens.goldDark} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: C.ink }}>My account</div>
            <div style={{ fontSize: 11, color: C.gray }}>{ROLE_LABELS[myRole] || 'Staff'}</div>
          </div>
          {/* Bell icon */}
          <button onClick={onAlerts} title="Alerts"
            aria-label={alertCount > 0 ? `Alerts — ${alertCount} unread` : 'Alerts'}
            style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', color: alertCount > 0 ? Dtokens.goldDark : C.gray, padding: '4px', minHeight: 'unset', minWidth: 'unset', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
            {alertCount > 0 && <span style={{ position: 'absolute', top: 0, right: 0, width: 16, height: 16, borderRadius: '50%', background: '#DC2626', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>{alertCount > 9 ? '9+' : alertCount}</span>}
          </button>
          <button type="button" onClick={onSignOut} title="Sign out" aria-label="Sign out" style={{ cursor: 'pointer', color: C.gray, fontSize: 11, border: 'none', background: 'none', padding: 0 }}><span aria-hidden="true">↩</span></button>
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
  const moreMenuRef = useRef(null);
  const moreTriggerRef = useRef(null);

  // A11y: Escape closes, focus trap inside menu, return focus to trigger on close
  useEffect(() => {
    if (!showMore) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') { setShowMore(false); return; }
      if (e.key !== 'Tab') return;
      const menu = moreMenuRef.current;
      if (!menu) return;
      const focusable = [...menu.querySelectorAll('button:not([disabled])')];
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    // Focus first item on open
    requestAnimationFrame(() => {
      const first = moreMenuRef.current?.querySelector('button');
      first?.focus();
    });
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      // Return focus to the More button when closing
      moreTriggerRef.current?.focus();
    };
  }, [showMore]);

  const BOTTOM_NAV_ITEMS = [
    { id: 'dashboard',   label: t('nav_dashboard'),   icon: 'overview' },
    { id: 'events',      label: t('nav_events'),      icon: 'events',      badge: badges.events      || 0 },
    { id: 'clients',     label: t('nav_clients'),     icon: 'clients' },
    { id: 'payments',    label: t('nav_payments'),    icon: 'payments',    badge: badges.payments    || 0, badgeColor: '#DC2626' },
  ];

  const MORE_ITEMS = [
    { id: 'alterations', label: t('nav_alterations'), icon: 'alterations', badge: badges.alterations || 0, badgeColor: '#DC2626' },
    { id: 'inventory',   label: 'Dress Rentals',      icon: 'rentals'  },
    { id: 'schedule',    label: 'Schedule',            icon: 'calendar' },
    { id: 'billing',     label: 'Invoices',            icon: 'payments' },
    { id: 'my_tasks',    label: 'My Tasks',            icon: 'mytasks',  badge: badges.myTasks || 0, badgeColor: '#DC2626' },
    { id: 'settings',    label: t('nav_settings'),     icon: 'settings' },
  ];

  const moreActive = MORE_ITEMS.some(i => i.id === screen);

  return (
    <>
      {/* More menu popover */}
      {showMore && (
        <>
          <div
            onClick={() => setShowMore(false)}
            aria-hidden="true"
            style={{ position: 'fixed', inset: 0, background: 'rgba(28,17,24,0.08)', zIndex: 98 }}
          />
          <div
            ref={moreMenuRef}
            role="menu"
            aria-label="More navigation options"
            aria-modal="true"
            style={{ position: 'fixed', bottom: 'calc(60px + env(safe-area-inset-bottom, 0px))', left: '50%', transform: 'translateX(-50%)',
              background: C.white, border: `1px solid ${C.border}`, borderRadius: 4,
              boxShadow: '0 -8px 32px rgba(28,17,24,0.18)', zIndex: 99, minWidth: 220, overflow: 'hidden' }}>
            {MORE_ITEMS.map(item => {
              const act = screen === item.id;
              return (
                <button
                  key={item.id}
                  role="menuitem"
                  aria-current={act ? 'page' : undefined}
                  onClick={() => { setScreen(item.id); setShowMore(false); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '13px 18px',
                    background: act ? Dtokens.goldLight : 'transparent',
                    border: 'none', borderBottom: `1px solid ${C.border}`, cursor: 'pointer',
                    color: act ? Dtokens.goldDark : C.ink, fontWeight: act ? 600 : 400, fontSize: 14,
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
                color: active ? Dtokens.goldDark : '#7A6670', fontSize: 10, fontWeight: active ? 600 : 400, cursor: 'pointer', flex: 1,
                height: 60, padding: '0', transition: 'color 0.15s', WebkitTapHighlightColor: 'transparent', position: 'relative' }}>
              <span style={{ fontSize: 20, lineHeight: 1, opacity: active ? 1 : 0.55, transition: 'opacity 0.15s' }}>{icons[item.icon]}</span>
              <span style={{ maxWidth: 56, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
              {item.badge > 0 && (
                <span style={{ position: 'absolute', top: 6, right: 'calc(50% - 16px)', minWidth: 16, height: 16, borderRadius: 8, fontSize: 10, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
                  background: item.badgeColor || C.rosa, color: C.white }}>{item.badge > 99 ? '99+' : item.badge}</span>
              )}
            </button>
          );
        })}
        {/* More button */}
        <button
          ref={moreTriggerRef}
          onClick={() => setShowMore(s => !s)}
          aria-haspopup="menu"
          aria-expanded={showMore}
          aria-label={showMore ? 'Close more navigation' : 'Open more navigation'}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, border: 'none', background: 'transparent',
            color: (moreActive || showMore) ? Dtokens.goldDark : '#7A6670', fontSize: 10, fontWeight: (moreActive || showMore) ? 600 : 400,
            cursor: 'pointer', flex: 1, height: 60, padding: '0', transition: 'color 0.15s', WebkitTapHighlightColor: 'transparent' }}>
          <span aria-hidden="true" style={{ fontSize: 20, lineHeight: 1, opacity: (moreActive || showMore) ? 1 : 0.55, transition: 'opacity 0.15s', display:'flex', alignItems:'center', justifyContent:'center', width:22, height:22 }}>
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
                background: active ? Dtokens.goldLight : 'transparent',
                color: active ? C.rosaText : '#7A6670',
                minHeight: 'unset', minWidth: 'unset' }}>
              <span style={{ width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {icons[item.icon]}
              </span>
              <span style={{ fontSize: 10, color: active ? C.rosaText : '#7A6670', textAlign: 'center', lineHeight: 1.2, fontWeight: active ? 500 : 400 }}>
                {item.label}
              </span>
              {item.tasksBadge && (
                <span style={{ position: 'absolute', top: 6, left: 5, minWidth: 17, height: 17, borderRadius: 9, fontSize: 10, fontWeight: 500,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
                  background: '#DC2626', color: C.white }} title="Alert tasks">{item.tasksBadge}</span>
              )}
              {item.badge && (
                <span style={{ position: 'absolute', top: 6, right: 5, minWidth: 17, height: 17, borderRadius: 9, fontSize: 10, fontWeight: 500,
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
                  fontSize: 10, fontWeight: 500, color: b.id === boutique?.id ? C.rosaText : C.gray, cursor: 'pointer' }}>
                {(b.name || 'B').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
              </button>
            ))}
          </div>
        )}
        <button type="button" onClick={onSignOut} title="Sign out"
          style={{ width: 40, height: 40, borderRadius: '50%', background: C.rosaPale, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 500, color: C.rosaText, cursor: 'pointer', border: 'none' }}>
          {(boutique?.name || 'B').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
export { BottomNav, IconRail };
