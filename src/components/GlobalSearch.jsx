import React, { useState, useEffect, useRef, useCallback } from 'react';
import { C, EVT_TYPES } from '../lib/colors';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

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

function clearRecents() {
  localStorage.removeItem(RECENTS_KEY);
}

function fmtDate(d) {
  if (!d) return '';
  try {
    return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return d; }
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

const CATEGORY_ICONS = {
  bridal_gown: '👰',
  quince_gown: '👑',
  arch: '🏛️',
  centerpiece: '💐',
  linen: '🎀',
  lighting: '💡',
  chair: '🪑',
  veil: '🤍',
  headpiece: '💎',
  jewelry: '💍',
  ceremony: '🕊️',
  consumable: '📦',
  equipment: '🔧',
};

function catIcon(cat) {
  return CATEGORY_ICONS[cat] || '📦';
}

const STATUS_COLORS = {
  available: { bg: '#DCFCE7', col: '#15803D' },
  rented: { bg: '#DBEAFE', col: '#1D4ED8' },
  returned: { bg: '#F3F4F6', col: '#6B7280' },
  maintenance: { bg: '#FEF3C7', col: '#B45309' },
  damaged: { bg: '#FEE2E2', col: '#B91C1C' },
  reserved: { bg: '#EDE9FE', col: '#7C3AED' },
};

function StatusBadge({ status }) {
  const s = STATUS_COLORS[status] || { bg: C.grayBg, col: C.gray };
  return (
    <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 999, background: s.bg, color: s.col, fontWeight: 500, flexShrink: 0, whiteSpace: 'nowrap' }}>
      {status || '—'}
    </span>
  );
}

// ─── RESULT ROW ──────────────────────────────────────────────────────────────
const ResultRow = ({ result, isSelected, onHover, onClick }) => {
  const { type, label, sub, icon, extra } = result;

  const bg = isSelected ? C.rosaPale : 'transparent';

  return (
    <div
      onClick={onClick}
      onMouseEnter={onHover}
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px', cursor: 'pointer', background: bg, transition: 'background 0.08s' }}
    >
      {/* Icon / Avatar */}
      <div style={{ width: 34, height: 34, borderRadius: 9, background: isSelected ? C.rosa + '22' : C.ivory, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {type === 'Client' ? (
          <div style={{ width: 34, height: 34, borderRadius: 9, background: isSelected ? C.rosa + '33' : C.rosaPale, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: C.rosa }}>
            {initials(label)}
          </div>
        ) : (
          <span style={{ fontSize: 16 }}>{icon}</span>
        )}
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
        <div style={{ fontSize: 11, color: C.gray, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>
      </div>

      {/* Extra badge / status */}
      {extra}

      {/* Type chip */}
      <span style={{ fontSize: 10, color: isSelected ? C.rosa : C.gray, background: isSelected ? C.white : C.grayBg, borderRadius: 4, padding: '2px 7px', flexShrink: 0, fontWeight: 500, marginLeft: 4 }}>
        {type}
      </span>
    </div>
  );
};

// ─── GROUP HEADER ─────────────────────────────────────────────────────────────
const GroupHeader = ({ label }) => (
  <div style={{ padding: '8px 16px 4px', fontSize: 10, fontWeight: 700, color: C.gray, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
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

  // Auto-focus on open
  useEffect(() => {
    if (isOpen !== false) {
      setTimeout(() => inputRef.current?.focus(), 40);
    }
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
          supabase.from('clients')
            .select('id, name, phone, email')
            .eq('boutique_id', boutique.id)
            .ilike('name', `%${q}%`)
            .limit(5),
          supabase.from('events')
            .select('id, type, event_date, venue, client:clients(name)')
            .eq('boutique_id', boutique.id)
            .or(`venue.ilike.%${q}%,type.ilike.%${q}%`)
            .limit(5),
          supabase.from('inventory')
            .select('id, name, sku, category, status')
            .eq('boutique_id', boutique.id)
            .or(`name.ilike.%${q}%,sku.ilike.%${q}%`)
            .limit(5),
          supabase.from('appointments')
            .select('id, type, date, time, event:events(client:clients(name))')
            .eq('boutique_id', boutique.id)
            .ilike('type', `%${q}%`)
            .limit(3),
        ]);

        // Also search clients by phone/email client-side supplement via a second query
        const phoneRes = await supabase.from('clients')
          .select('id, name, phone, email')
          .eq('boutique_id', boutique.id)
          .or(`phone.ilike.%${q}%,email.ilike.%${q}%`)
          .limit(3);

        // Merge client results, dedup by id
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

  // Build flat list for keyboard navigation
  const flatList = useCallback(() => {
    const q = query.trim();
    if (q.length < 2) return [];
    const items = [];

    results.clients.forEach(c => items.push({
      type: 'Client', label: c.name || '(unnamed)',
      sub: [c.phone, c.email].filter(Boolean).join(' · ') || 'No contact info',
      icon: '👤',
      action: () => {
        saveRecent(q);
        setRecents(getRecents());
        sessionStorage.setItem('belori_select_client', c.id);
        setScreen('clients');
        onClose();
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
          saveRecent(q);
          setRecents(getRecents());
          setSelectedEvent(e.id);
          setScreen('event_detail');
          onClose();
        },
      });
    });

    results.inventory.forEach(i => items.push({
      type: 'Inventory',
      label: i.name || '(unnamed)',
      sub: `${(i.category || '').replace(/_/g, ' ')}${i.sku ? ' · ' + i.sku : ''}`,
      icon: catIcon(i.category),
      extra: i.status ? <StatusBadge status={i.status} /> : null,
      action: () => {
        saveRecent(q);
        setRecents(getRecents());
        setScreen('inv_full');
        onClose();
      },
    }));

    results.appointments.forEach(a => {
      const clientName = a.event?.client?.name || '';
      items.push({
        type: 'Appointment',
        label: a.type || 'Appointment',
        sub: `${clientName ? clientName + ' · ' : ''}${fmtDate(a.date)}${a.time ? ' · ' + fmtTime(a.time) : ''}`,
        icon: '📅',
        action: () => {
          saveRecent(q);
          setRecents(getRecents());
          setScreen('calendar');
          onClose();
        },
      });
    });

    return items;
  }, [results, query, setScreen, setSelectedEvent, onClose]);

  const allItems = flatList();
  const totalItems = allItems.length;

  // Reset selected when results change
  useEffect(() => { setSelected(0); }, [totalItems, query]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (totalItems === 0) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelected(s => (s + 1) % totalItems);
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelected(s => (s - 1 + totalItems) % totalItems);
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        allItems[selected]?.action();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [allItems, selected, totalItems, onClose]);

  const q = query.trim();
  const hasQuery = q.length >= 2;
  const hasResults = totalItems > 0;
  const noResults = hasQuery && !loading && !hasResults;

  // Build grouped display
  const groups = hasQuery ? [
    { key: 'clients', label: 'CLIENTS', data: results.clients },
    { key: 'events', label: 'EVENTS', data: results.events },
    { key: 'inventory', label: 'INVENTORY', data: results.inventory },
    { key: 'appointments', label: 'APPOINTMENTS', data: results.appointments },
  ].filter(g => g.data.length > 0) : [];

  // Map grouped results back to flat index for keyboard highlight
  let flatIdx = 0;
  const groupedWithIndex = groups.map(g => {
    const typeMap = { clients: 'Client', events: 'Event', inventory: 'Inventory', appointments: 'Appointment' };
    const type = typeMap[g.key];
    const items = allItems.slice(flatIdx, flatIdx + g.data.length);
    const startIdx = flatIdx;
    flatIdx += g.data.length;
    return { ...g, items, startIdx };
  });

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.48)', zIndex: 9999, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '10vh' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: C.white, borderRadius: 16, width: '100%', maxWidth: 580, boxShadow: '0 32px 80px rgba(0,0,0,0.24)', overflow: 'hidden', margin: '0 16px', maxHeight: '78vh', display: 'flex', flexDirection: 'column' }}>

        {/* ── Search input ── */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', gap: 10, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          {loading ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.rosa} strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0, animation: 'gs-spin 0.75s linear infinite' }}>
              <circle cx="12" cy="12" r="10" strokeDasharray="28 12"/>
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.gray} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          )}
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search clients, events, inventory…"
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 16, color: C.ink, background: 'transparent', fontFamily: 'inherit' }}
          />
          {query ? (
            <button
              onClick={() => { setQuery(''); inputRef.current?.focus(); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.gray, fontSize: 18, lineHeight: 1, padding: '2px 4px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '50%' }}
              title="Clear"
            >×</button>
          ) : (
            <kbd style={{ fontSize: 10, color: C.gray, background: C.ivory, border: `1px solid ${C.border}`, borderRadius: 4, padding: '2px 6px', whiteSpace: 'nowrap', flexShrink: 0, fontFamily: 'inherit' }}>⌘K</kbd>
          )}
        </div>

        {/* ── Body ── */}
        <div style={{ overflowY: 'auto', flex: 1 }}>

          {/* Empty query → recent searches */}
          {!hasQuery && (
            <div style={{ padding: '14px 16px' }}>
              {recents.length > 0 ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: C.gray, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Recent</span>
                    <button
                      onClick={() => { clearRecents(); setRecents([]); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.gray, fontSize: 11, padding: 0, fontFamily: 'inherit' }}
                    >Clear</button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {recents.map((r, i) => (
                      <button key={i} onClick={() => setQuery(r)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 999, border: `1px solid ${C.border}`, background: C.white, cursor: 'pointer', fontSize: 12, color: C.gray, fontWeight: 400, minHeight: 'unset', minWidth: 'unset', fontFamily: 'inherit', transition: 'all 0.12s' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = C.rosa; e.currentTarget.style.color = C.rosa; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.gray; }}
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        {r}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ padding: '24px 0', textAlign: 'center' }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>🔍</div>
                  <div style={{ fontSize: 13, color: C.gray }}>Start typing to search clients, events, inventory and more.</div>
                  <div style={{ fontSize: 11, color: C.gray, marginTop: 6, opacity: 0.7 }}>Minimum 2 characters</div>
                </div>
              )}
            </div>
          )}

          {/* Loading state */}
          {hasQuery && loading && totalItems === 0 && (
            <div style={{ padding: '32px 20px', textAlign: 'center', color: C.gray, fontSize: 13 }}>
              Searching…
            </div>
          )}

          {/* No results */}
          {noResults && (
            <div style={{ padding: '32px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>🔍</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: C.ink, marginBottom: 4 }}>No results for "{query}"</div>
              <div style={{ fontSize: 12, color: C.gray }}>Try a client name, venue, phone, SKU, or appointment type.</div>
            </div>
          )}

          {/* Grouped results */}
          {groupedWithIndex.map(({ label, items, startIdx }) => (
            <div key={label}>
              <GroupHeader label={label} />
              {items.map((item, localIdx) => {
                const globalIdx = startIdx + localIdx;
                return (
                  <ResultRow
                    key={globalIdx}
                    result={item}
                    isSelected={globalIdx === selected}
                    onHover={() => setSelected(globalIdx)}
                    onClick={item.action}
                  />
                );
              })}
            </div>
          ))}

          {/* Divider between groups */}
          {hasQuery && hasResults && <div style={{ height: 6 }} />}
        </div>

        {/* ── Footer ── */}
        <div style={{ padding: '8px 16px', borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 14, fontSize: 10, color: C.gray, flexShrink: 0, background: C.white }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <kbd style={{ background: C.ivory, border: `1px solid ${C.border}`, borderRadius: 3, padding: '1px 5px', fontFamily: 'inherit' }}>↑</kbd>
            <kbd style={{ background: C.ivory, border: `1px solid ${C.border}`, borderRadius: 3, padding: '1px 5px', fontFamily: 'inherit' }}>↓</kbd>
            navigate
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <kbd style={{ background: C.ivory, border: `1px solid ${C.border}`, borderRadius: 3, padding: '1px 5px', fontFamily: 'inherit' }}>↵</kbd>
            open
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <kbd style={{ background: C.ivory, border: `1px solid ${C.border}`, borderRadius: 3, padding: '1px 5px', fontFamily: 'inherit' }}>esc</kbd>
            close
          </span>
          {hasQuery && hasResults && (
            <span style={{ marginLeft: 'auto', opacity: 0.6 }}>{totalItems} result{totalItems !== 1 ? 's' : ''}</span>
          )}
        </div>
      </div>

      {/* Spinner keyframe */}
      <style>{`@keyframes gs-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
