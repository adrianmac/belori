import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { EVT_TYPES } from '../lib/colors';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { D } from '../lib/couture.jsx';

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const RECENTS_KEY = 'belori_recent_searches';
const MAX_RECENTS = 5;

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function getRecents() {
  try { return JSON.parse(localStorage.getItem(RECENTS_KEY) || '[]'); }
  catch { return []; }
}
function saveRecent(q) {
  if (!q || q.trim().length < 2) return;
  const t = q.trim();
  const prev = getRecents().filter(r => r !== t);
  localStorage.setItem(RECENTS_KEY, JSON.stringify([t, ...prev].slice(0, MAX_RECENTS)));
}
function clearRecents() { localStorage.removeItem(RECENTS_KEY); }

function fmtDate(d) {
  if (!d) return '';
  try { return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return d; }
}
function fmtTime(t) {
  if (!t) return '';
  try {
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hr = h % 12 || 12;
    return `${hr}:${String(m).padStart(2, '0')} ${ampm}`;
  } catch { return t; }
}
function initials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}
function fuzzyScore(text, q) {
  if (!text || !q) return 0;
  const t = text.toLowerCase(); const s = q.toLowerCase();
  if (t === s) return 100;
  if (t.startsWith(s)) return 90;
  if (t.includes(s)) return 70;
  // character-sequence match
  let ti = 0;
  for (let si = 0; si < s.length; si++) {
    ti = t.indexOf(s[si], ti);
    if (ti === -1) return 0;
    ti++;
  }
  return 50;
}

const CATEGORY_ICONS = {
  bridal_gown: '👰', quince_gown: '👑', arch: '🏛️', centerpiece: '💐',
  linen: '🎀', lighting: '💡', chair: '🪑', veil: '🤍',
  headpiece: '💎', jewelry: '💍', ceremony: '🕊️', consumable: '📦', equipment: '🔧',
};
function catIcon(cat) { return CATEGORY_ICONS[cat] || '📦'; }

const STATUS_COLORS = {
  available:  { bg: D.successBg, col: D.success },
  rented:     { bg: '#DBEAFE',  col: '#1D4ED8' },
  returned:   { bg: D.borderSoft, col: D.inkLight },
  maintenance:{ bg: D.warningBg, col: D.warning },
  damaged:    { bg: D.dangerBg,  col: D.danger },
  reserved:   { bg: D.goldLight, col: D.goldDark },
};
function StatusBadge({ status }) {
  const s = STATUS_COLORS[status] || { bg: D.borderSoft, col: D.inkMid };
  return (
    <span style={{
      fontSize: 9, padding: '2px 8px',
      background: s.bg, color: s.col,
      fontWeight: 500, flexShrink: 0, whiteSpace: 'nowrap',
      textTransform: 'uppercase', letterSpacing: '0.12em',
      fontFamily: D.sans,
    }}>
      {status || '—'}
    </span>
  );
}

// ─── JUMP-TO-PAGE COMMANDS — the feature that changes how boutique owners use the app
// These always show (filtered by fuzzy match) so a user can type "pay" → Payments.
// Icons use SVG for sharp rendering at any size; kickers are small-caps meta hints.
const PAGE_COMMANDS = [
  { id: 'dashboard',    label: 'Dashboard',         hint: 'Overview',       icon: '◈', keys: ['g', 'd'] },
  { id: 'events',       label: 'Events',            hint: 'Weddings & ceremonies', icon: '♡', keys: ['g', 'e'] },
  { id: 'clients',      label: 'Clients',           hint: 'Brides & partners', icon: '◐', keys: ['g', 'c'] },
  { id: 'schedule',     label: 'Schedule',          hint: 'Appointments calendar', icon: '□' },
  { id: 'payments',     label: 'Payments',          hint: 'Milestones & receipts', icon: '◆', keys: ['g', 'p'] },
  { id: 'alterations',  label: 'Alterations',       hint: 'Tailoring workflow', icon: '✂' },
  { id: 'inventory',    label: 'Dress Rentals',     hint: 'Gown availability', icon: '◯' },
  { id: 'inv_full',     label: 'Inventory',         hint: 'Decor & equipment', icon: '▢' },
  { id: 'my_tasks',     label: 'My Tasks',          hint: 'Your personal queue', icon: '◎' },
  { id: 'billing',      label: 'Invoices',          hint: 'Billing & quotes', icon: '◈' },
  { id: 'activity_feed',label: 'Activity Feed',     hint: 'Recent history', icon: '⋯' },
  { id: 'sms_inbox',    label: 'SMS Inbox',         hint: 'Incoming messages', icon: '◁' },
  { id: 'funnel',       label: 'Sales Funnel',      hint: 'Lead pipeline', icon: '▽' },
  { id: 'reports',      label: 'Reports',           hint: 'Analytics & insights', icon: '△' },
  { id: 'expenses',     label: 'Expenses',          hint: 'Business costs', icon: '◇' },
  { id: 'settings',     label: 'Settings',          hint: 'Boutique, staff, billing', icon: '◉', keys: ['g', 's'] },
];

// ─── RESULT ROW ──────────────────────────────────────────────────────────────
const ResultRow = ({ result, isSelected, onHover, onClick, refFn }) => {
  const { type, label, sub, icon, extra } = result;

  return (
    <div
      ref={refFn}
      role="option"
      aria-selected={isSelected}
      onClick={onClick}
      onMouseEnter={onHover}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 20px', cursor: 'pointer',
        background: isSelected ? D.goldLight : 'transparent',
        borderLeft: isSelected ? `2px solid ${D.gold}` : '2px solid transparent',
        transition: 'background 0.12s cubic-bezier(.22,.61,.36,1), border-color 0.12s',
      }}
    >
      {/* Icon / avatar */}
      <div style={{
        width: 34, height: 34,
        background: isSelected ? D.card : D.bg,
        border: `1px solid ${isSelected ? D.goldBorder : D.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {type === 'Client' ? (
          <span style={{
            fontFamily: D.sans, fontSize: 11, fontWeight: 600,
            color: D.goldDark, letterSpacing: '0.06em',
          }}>
            {initials(label)}
          </span>
        ) : type === 'Page' ? (
          <span style={{
            fontFamily: D.display, fontSize: 16, color: D.goldDark, lineHeight: 1,
          }}>{icon}</span>
        ) : (
          <span style={{ fontSize: 16 }}>{icon}</span>
        )}
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: type === 'Client' || type === 'Event' ? D.serif : D.sans,
          fontStyle: type === 'Client' || type === 'Event' ? 'italic' : 'normal',
          fontSize: 14, fontWeight: 500,
          color: D.ink,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          letterSpacing: '0.005em',
        }}>{label}</div>
        <div style={{
          fontFamily: D.sans, fontSize: 11, color: D.inkLight,
          marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{sub}</div>
      </div>

      {/* Extra (status badge, etc) */}
      {extra}

      {/* Type chip — small-caps couture */}
      <span style={{
        fontFamily: D.sans, fontSize: 9,
        color: isSelected ? D.goldDark : D.inkLight,
        textTransform: 'uppercase', letterSpacing: '0.18em',
        fontWeight: 500, flexShrink: 0, marginLeft: 4,
      }}>
        {type}
      </span>
    </div>
  );
};

// ─── GROUP HEADER ────────────────────────────────────────────────────────────
const GroupHeader = ({ label }) => (
  <div style={{
    padding: '14px 20px 6px',
    fontFamily: D.sans, fontSize: 9, fontWeight: 600,
    color: D.goldDark,
    letterSpacing: '0.24em', textTransform: 'uppercase',
  }}>
    {label}
  </div>
);

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function GlobalSearch({ setScreen, setSelectedEvent, onClose, isOpen }) {
  const { boutique } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ clients: [], events: [], inventory: [], appointments: [] });
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(0);
  const [recents, setRecents] = useState(getRecents);

  const inputRef = useRef(null);
  const debounceRef = useRef(null);
  const itemRefs = useRef([]);

  // Auto-focus on open
  useEffect(() => {
    if (isOpen !== false) { setTimeout(() => inputRef.current?.focus(), 40); }
  }, [isOpen]);

  // Reset on close
  useEffect(() => {
    if (isOpen === false) {
      setQuery('');
      setResults({ clients: [], events: [], inventory: [], appointments: [] });
      setSelected(0);
    }
  }, [isOpen]);

  // Debounced Supabase search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 2) {
      setResults({ clients: [], events: [], inventory: [], appointments: [] });
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      if (!boutique?.id) { setLoading(false); return; }
      try {
        const [clientsRes, eventsRes, inventoryRes, appointmentsRes] = await Promise.all([
          supabase.from('clients').select('id, name, phone, email')
            .eq('boutique_id', boutique.id).ilike('name', `%${q}%`).limit(5),
          supabase.from('events').select('id, type, event_date, venue, client:clients(name)')
            .eq('boutique_id', boutique.id).or(`venue.ilike.%${q}%,type.ilike.%${q}%`).limit(5),
          supabase.from('inventory').select('id, name, sku, category, status')
            .eq('boutique_id', boutique.id).or(`name.ilike.%${q}%,sku.ilike.%${q}%`).limit(5),
          supabase.from('appointments').select('id, type, date, time, event:events(client:clients(name))')
            .eq('boutique_id', boutique.id).ilike('type', `%${q}%`).limit(3),
        ]);

        // Supplementary client search by phone/email
        const phoneRes = await supabase.from('clients').select('id, name, phone, email')
          .eq('boutique_id', boutique.id).or(`phone.ilike.%${q}%,email.ilike.%${q}%`).limit(3);

        const allClients = [...(clientsRes.data || []), ...(phoneRes.data || [])];
        const seenIds = new Set();
        const dedupClients = allClients.filter(c => { if (seenIds.has(c.id)) return false; seenIds.add(c.id); return true; }).slice(0, 5);

        setResults({
          clients: dedupClients,
          events: eventsRes.data || [],
          inventory: inventoryRes.data || [],
          appointments: appointmentsRes.data || [],
        });
      } catch (err) {
        console.error('GlobalSearch error:', err);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(debounceRef.current);
  }, [query, boutique?.id]);

  // Matched page commands (always filtered by fuzzy score, shown even without query)
  const matchedPages = useMemo(() => {
    const q = query.trim();
    if (!q) return PAGE_COMMANDS.slice(0, 6); // show top 6 on empty query
    return PAGE_COMMANDS
      .map(p => ({ ...p, _score: Math.max(fuzzyScore(p.label, q), fuzzyScore(p.hint, q)) }))
      .filter(p => p._score > 0)
      .sort((a, b) => b._score - a._score)
      .slice(0, 5);
  }, [query]);

  // Build the unified command list (pages first, then data results)
  const allItems = useMemo(() => {
    const q = query.trim();
    const items = [];

    // 1. Jump-to-page commands
    matchedPages.forEach(p => items.push({
      type: 'Page', label: p.label, sub: p.hint, icon: p.icon,
      action: () => { setScreen(p.id); onClose(); },
    }));

    // 2. Data results (only when query ≥ 2 chars)
    if (q.length >= 2) {
      results.clients.forEach(c => items.push({
        type: 'Client', label: c.name || '(unnamed)',
        sub: [c.phone, c.email].filter(Boolean).join(' · ') || 'No contact info',
        icon: '👤',
        action: () => {
          saveRecent(q); setRecents(getRecents());
          sessionStorage.setItem('belori_select_client', c.id);
          setScreen('clients'); onClose();
        },
      }));
      results.events.forEach(e => {
        const evtType = EVT_TYPES[e.type];
        items.push({
          type: 'Event',
          label: e.client?.name || '(no client)',
          sub: `${evtType?.label || e.type || 'Event'} · ${fmtDate(e.event_date)}${e.venue ? ' · ' + e.venue : ''}`,
          icon: evtType?.icon || '🎉',
          action: () => {
            saveRecent(q); setRecents(getRecents());
            setSelectedEvent(e.id); setScreen('event_detail'); onClose();
          },
        });
      });
      results.inventory.forEach(i => items.push({
        type: 'Inventory', label: i.name || '(unnamed)',
        sub: `${(i.category || '').replace(/_/g, ' ')}${i.sku ? ' · ' + i.sku : ''}`,
        icon: catIcon(i.category),
        extra: i.status ? <StatusBadge status={i.status} /> : null,
        action: () => {
          saveRecent(q); setRecents(getRecents());
          setScreen('inv_full'); onClose();
        },
      }));
      results.appointments.forEach(a => {
        const clientName = a.event?.client?.name || '';
        items.push({
          type: 'Appointment', label: a.type || 'Appointment',
          sub: `${clientName ? clientName + ' · ' : ''}${fmtDate(a.date)}${a.time ? ' · ' + fmtTime(a.time) : ''}`,
          icon: '📅',
          action: () => {
            saveRecent(q); setRecents(getRecents());
            setScreen('schedule'); onClose();
          },
        });
      });
    }

    return items;
  }, [matchedPages, results, query, setScreen, setSelectedEvent, onClose]);

  const totalItems = allItems.length;

  // Reset selection when list length changes
  useEffect(() => { setSelected(0); }, [totalItems, query]);

  // Scroll selected row into view
  useEffect(() => {
    itemRefs.current[selected]?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (totalItems === 0) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => (s + 1) % totalItems); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(s => (s - 1 + totalItems) % totalItems); }
      if (e.key === 'Enter')     { e.preventDefault(); allItems[selected]?.action(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [allItems, selected, totalItems, onClose]);

  const q = query.trim();
  const hasQuery = q.length >= 2;
  const hasResults = totalItems > 0;
  const noResults = hasQuery && !loading && allItems.length === matchedPages.length && results.clients.length + results.events.length + results.inventory.length + results.appointments.length === 0;

  // Build grouped display — Pages first (always), then data groups
  const groups = [];
  if (matchedPages.length > 0) {
    groups.push({ key: 'pages', label: hasQuery ? 'Go to' : 'Quick navigation', count: matchedPages.length });
  }
  if (hasQuery) {
    if (results.clients.length) groups.push({ key: 'clients', label: 'Clients', count: results.clients.length });
    if (results.events.length) groups.push({ key: 'events', label: 'Events', count: results.events.length });
    if (results.inventory.length) groups.push({ key: 'inventory', label: 'Inventory', count: results.inventory.length });
    if (results.appointments.length) groups.push({ key: 'appointments', label: 'Appointments', count: results.appointments.length });
  }

  // Assign offsets to each group for keyboard highlight alignment
  let flatIdx = 0;
  const renderedGroups = groups.map(g => {
    const startIdx = flatIdx;
    flatIdx += g.count;
    return { ...g, startIdx };
  });

  itemRefs.current = new Array(totalItems);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Global search"
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(28,17,24,0.45)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '10vh',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: D.cardWarm,
        border: `1px solid ${D.border}`,
        width: '100%', maxWidth: 640,
        boxShadow: '0 32px 80px rgba(28,17,24,0.32), 0 1px 4px rgba(28,17,24,0.08)',
        overflow: 'hidden', margin: '0 16px',
        maxHeight: '78vh', display: 'flex', flexDirection: 'column',
        fontFamily: D.sans,
      }}>
        {/* Top gold hairline */}
        <div aria-hidden="true" style={{ height: 2, background: D.gold, opacity: 0.9 }} />

        {/* Search input */}
        <div style={{
          display: 'flex', alignItems: 'center',
          padding: '18px 22px', gap: 14,
          borderBottom: `1px solid ${D.border}`,
          flexShrink: 0, background: D.cardWarm,
        }}>
          {loading ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={D.gold} strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, animation: 'gs-spin 0.8s linear infinite' }}>
              <circle cx="12" cy="12" r="10" strokeDasharray="28 12"/>
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={D.inkMid} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          )}
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search clients, events, dresses — or jump to a page…"
            aria-label="Search"
            style={{
              flex: 1, border: 'none', outline: 'none',
              fontSize: 16,
              fontFamily: D.sans,
              color: D.ink,
              background: 'transparent',
            }}
          />
          {query ? (
            <button
              onClick={() => { setQuery(''); inputRef.current?.focus(); }}
              aria-label="Clear search"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: D.inkLight, fontSize: 18, lineHeight: 1,
                padding: '2px 4px', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 24, height: 24,
              }}
              title="Clear" aria-label="Clear search"
            >×</button>
          ) : (
            <kbd style={{
              fontFamily: D.sans, fontSize: 9, color: D.inkMid,
              background: D.bg, border: `1px solid ${D.border}`,
              padding: '3px 7px',
              textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 500,
              whiteSpace: 'nowrap', flexShrink: 0,
            }}>⌘K</kbd>
          )}
        </div>

        {/* Body */}
        <div
          role="listbox"
          aria-label="Search results"
          style={{ overflowY: 'auto', flex: 1 }}
        >

          {/* Empty query — show recents + quick nav */}
          {!hasQuery && recents.length > 0 && (
            <div style={{ padding: '14px 22px 8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{
                  fontFamily: D.sans, fontSize: 9, fontWeight: 600,
                  color: D.goldDark,
                  textTransform: 'uppercase', letterSpacing: '0.24em',
                }}>Recent</span>
                <button
                  onClick={() => { clearRecents(); setRecents([]); }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: D.inkLight, fontSize: 10, padding: 0,
                    fontFamily: D.sans,
                    textTransform: 'uppercase', letterSpacing: '0.14em',
                  }}
                >Clear</button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {recents.map((r, i) => (
                  <button
                    key={i} onClick={() => setQuery(r)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '6px 12px',
                      border: `1px solid ${D.border}`,
                      background: D.card, cursor: 'pointer',
                      fontSize: 12, fontFamily: D.sans, color: D.inkMid,
                      fontWeight: 400, minHeight: 'unset', minWidth: 'unset',
                      transition: 'all 0.15s cubic-bezier(.22,.61,.36,1)',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = D.gold; e.currentTarget.style.color = D.goldDark; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = D.border; e.currentTarget.style.color = D.inkMid; }}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Loading shimmer */}
          {hasQuery && loading && results.clients.length === 0 && results.events.length === 0 && (
            <div style={{ padding: '28px 22px', textAlign: 'center' }}>
              <div className="couture-smallcaps" style={{ color: D.inkLight, letterSpacing: '0.28em' }}>
                Searching the atelier…
              </div>
            </div>
          )}

          {/* Render groups */}
          {renderedGroups.map(g => {
            const groupItems = allItems.slice(g.startIdx, g.startIdx + g.count);
            return (
              <div key={g.key}>
                <GroupHeader label={g.label} />
                {groupItems.map((item, localIdx) => {
                  const globalIdx = g.startIdx + localIdx;
                  return (
                    <ResultRow
                      key={globalIdx}
                      result={item}
                      isSelected={globalIdx === selected}
                      onHover={() => setSelected(globalIdx)}
                      onClick={item.action}
                      refFn={(el) => { itemRefs.current[globalIdx] = el; }}
                    />
                  );
                })}
              </div>
            );
          })}

          {/* No data results — still show pages */}
          {hasQuery && !loading && allItems.length === matchedPages.length && (
            <div style={{ padding: '20px 22px', textAlign: 'center', borderTop: matchedPages.length ? `1px solid ${D.border}` : 'none' }}>
              <div aria-hidden="true" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 8, marginBottom: 12, opacity: 0.65,
              }}>
                <span style={{ height: 1, width: 28, background: `linear-gradient(90deg, transparent, ${D.gold})` }} />
                <svg width="8" height="8" viewBox="0 0 10 10" fill="none"><path d="M5 0l5 5-5 5-5-5 5-5z" fill={D.gold}/></svg>
                <span style={{ height: 1, width: 28, background: `linear-gradient(270deg, transparent, ${D.gold})` }} />
              </div>
              <div className="couture-serif-i" style={{
                fontFamily: D.serif, fontStyle: 'italic',
                fontSize: 16, color: D.ink, marginBottom: 6,
              }}>
                Nothing found in the register.
              </div>
              <div style={{ fontSize: 12, color: D.inkMid }}>
                Try a different name, phone, SKU, or venue.
              </div>
            </div>
          )}

          {/* Bottom padding */}
          {hasResults && <div style={{ height: 8 }} />}
        </div>

        {/* Footer */}
        <div style={{
          padding: '10px 22px',
          borderTop: `1px solid ${D.border}`,
          display: 'flex', alignItems: 'center', gap: 16,
          fontSize: 10, color: D.inkLight,
          flexShrink: 0, background: D.bg,
          fontFamily: D.sans,
          textTransform: 'uppercase', letterSpacing: '0.14em',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <KbdKey>↑</KbdKey><KbdKey>↓</KbdKey>
            <span>navigate</span>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <KbdKey>↵</KbdKey>
            <span>open</span>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <KbdKey>esc</KbdKey>
            <span>close</span>
          </span>
          {hasQuery && hasResults && (
            <span style={{ marginLeft: 'auto', opacity: 0.7 }}>
              {totalItems} result{totalItems !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      <style>{`@keyframes gs-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// Small keyboard-key visual primitive, consistent with couture tokens
function KbdKey({ children }) {
  return (
    <kbd style={{
      background: D.card,
      border: `1px solid ${D.border}`,
      padding: '2px 6px',
      fontFamily: D.sans,
      fontSize: 9, fontWeight: 500,
      color: D.inkMid,
      textTransform: 'none',
      letterSpacing: 0,
      minWidth: 14, textAlign: 'center',
    }}>{children}</kbd>
  );
}
