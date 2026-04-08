import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';
import { C } from '../lib/colors';
import { Topbar } from '../lib/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';

// ─── Helpers ────────────────────────────────────────────────────────────────

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

function absoluteTime(dateStr) {
  return new Date(dateStr).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const ACTION_STYLE = {
  INSERT: { bg: C.greenBg, color: C.green, label: 'INSERT' },
  UPDATE: { bg: C.amberBg, color: C.amber, label: 'UPDATE' },
  DELETE: { bg: C.redBg,   color: C.red,   label: 'DELETE' },
};

const TABLE_LABELS = {
  events:            'Events',
  payment_milestones:'Payments',
  clients:           'Clients',
  contracts:         'Contracts',
};

const TABLE_FILTERS = [
  { value: 'all',               label: 'All' },
  { value: 'events',            label: 'Events' },
  { value: 'payment_milestones',label: 'Payments' },
  { value: 'clients',           label: 'Clients' },
  { value: 'contracts',         label: 'Contracts' },
];

/** Pull a human-readable summary field out of the row data */
function rowSummary(tableName, data) {
  if (!data) return null;
  if (tableName === 'clients')            return data.name   || null;
  if (tableName === 'events')             return data.client_name || data.venue || data.type || null;
  if (tableName === 'payment_milestones') return data.label  || null;
  if (tableName === 'contracts')          return data.title  || data.event_id || null;
  return null;
}

/** Return keys that differ between before and after */
function diffKeys(before, after) {
  const allKeys = new Set([
    ...Object.keys(before || {}),
    ...Object.keys(after  || {}),
  ]);
  // Skip noisy / internal fields
  const SKIP = new Set(['updated_at', 'created_at', 'boutique_id']);
  const changed = [];
  const unchanged = [];
  allKeys.forEach(k => {
    if (SKIP.has(k)) return;
    const bVal = JSON.stringify((before || {})[k]);
    const aVal = JSON.stringify((after  || {})[k]);
    if (bVal !== aVal) changed.push(k);
    else unchanged.push(k);
  });
  return { changed, unchanged };
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ActionBadge({ action }) {
  const st = ACTION_STYLE[action] || { bg: C.grayBg, color: C.gray, label: action };
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 7px',
      borderRadius: 4,
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '0.04em',
      background: st.bg,
      color: st.color,
    }}>
      {st.label}
    </span>
  );
}

function TableBadge({ tableName }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 7px',
      borderRadius: 4,
      fontSize: 11,
      fontWeight: 500,
      background: C.grayBg,
      color: C.gray,
      border: `1px solid ${C.border}`,
    }}>
      {TABLE_LABELS[tableName] || tableName}
    </span>
  );
}

function DiffView({ before, after }) {
  const { changed, unchanged } = diffKeys(before, after);
  const allKeys = [...changed, ...unchanged];

  if (allKeys.length === 0) {
    return <div style={{ color: C.gray, fontSize: 12, fontStyle: 'italic' }}>No data available.</div>;
  }

  return (
    <div style={{ fontSize: 12, fontFamily: 'monospace', display: 'flex', flexDirection: 'column', gap: 3 }}>
      {changed.map(k => {
        const bVal = (before || {})[k];
        const aVal = (after  || {})[k];
        return (
          <div key={k} style={{
            display: 'grid',
            gridTemplateColumns: '160px 1fr 1fr',
            gap: 8,
            padding: '4px 8px',
            borderRadius: 4,
            background: C.amberBg,
            border: `1px solid #FDE68A`,
          }}>
            <span style={{ color: C.amber, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k}</span>
            <span style={{ color: C.red, wordBreak: 'break-all' }}>
              {bVal === undefined ? <em style={{ opacity: 0.5 }}>—</em> : JSON.stringify(bVal)}
            </span>
            <span style={{ color: C.green, wordBreak: 'break-all' }}>
              {aVal === undefined ? <em style={{ opacity: 0.5 }}>—</em> : JSON.stringify(aVal)}
            </span>
          </div>
        );
      })}
      {unchanged.map(k => {
        const val = ((after || before) || {})[k];
        return (
          <div key={k} style={{
            display: 'grid',
            gridTemplateColumns: '160px 1fr',
            gap: 8,
            padding: '4px 8px',
            borderRadius: 4,
            color: C.gray,
          }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k}</span>
            <span style={{ wordBreak: 'break-all', opacity: 0.7 }}>{JSON.stringify(val)}</span>
          </div>
        );
      })}
    </div>
  );
}

function DiffHeader() {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '160px 1fr 1fr',
      gap: 8,
      padding: '3px 8px',
      fontSize: 11,
      fontWeight: 600,
      color: C.gray,
      borderBottom: `1px solid ${C.border}`,
      marginBottom: 4,
      fontFamily: 'monospace',
    }}>
      <span>Field</span>
      <span style={{ color: C.red }}>Before</span>
      <span style={{ color: C.green }}>After</span>
    </div>
  );
}

function AuditRow({ entry }) {
  const [expanded, setExpanded] = useState(false);
  const summary = rowSummary(entry.table_name, entry.after_data || entry.before_data);
  const hasDetail = entry.before_data || entry.after_data;

  return (
    <div style={{
      borderBottom: `1px solid ${C.border}`,
      background: C.white,
    }}>
      {/* Main row */}
      <div
        onClick={() => hasDetail && setExpanded(e => !e)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 16px',
          cursor: hasDetail ? 'pointer' : 'default',
          transition: 'background 0.1s',
        }}
        onMouseEnter={e => { if (hasDetail) e.currentTarget.style.background = C.grayBg; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
      >
        {/* Expand chevron */}
        <div style={{ width: 16, flexShrink: 0, color: C.gray, fontSize: 10 }}>
          {hasDetail ? (expanded ? '▼' : '▶') : ''}
        </div>

        {/* Action badge */}
        <div style={{ flexShrink: 0 }}>
          <ActionBadge action={entry.action} />
        </div>

        {/* Table badge */}
        <div style={{ flexShrink: 0 }}>
          <TableBadge tableName={entry.table_name} />
        </div>

        {/* Summary */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {summary ? (
            <span style={{ fontSize: 13, color: C.ink, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
              {summary}
            </span>
          ) : (
            <span style={{ fontSize: 12, color: C.gray, fontStyle: 'italic' }}>
              row {entry.row_id ? entry.row_id.slice(0, 8) + '…' : '—'}
            </span>
          )}
        </div>

        {/* Actor */}
        <div style={{ flexShrink: 0, fontSize: 12, color: C.inkLight, minWidth: 90, textAlign: 'right' }}>
          {entry.actor_name || 'System'}
        </div>

        {/* Timestamp */}
        <div
          style={{ flexShrink: 0, fontSize: 12, color: C.gray, minWidth: 80, textAlign: 'right' }}
          title={absoluteTime(entry.created_at)}
        >
          {timeAgo(entry.created_at)}
        </div>
      </div>

      {/* Expanded diff */}
      {expanded && hasDetail && (
        <div style={{
          padding: '8px 16px 12px 42px',
          background: '#FAFAFA',
          borderTop: `1px solid ${C.border}`,
        }}>
          {entry.action === 'UPDATE' && <DiffHeader />}
          <DiffView before={entry.before_data} after={entry.after_data} />
        </div>
      )}
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

export default function AuditLog() {
  const { boutique } = useAuth();
  const [entries, setEntries]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore]     = useState(false);
  const [tableFilter, setTableFilter] = useState('all');
  const [actorSearch, setActorSearch] = useState('');
  const [offset, setOffset]       = useState(0);

  const fetchEntries = useCallback(async ({ replace = true, currentOffset = 0 } = {}) => {
    if (!boutique?.id) return;
    replace ? setLoading(true) : setLoadingMore(true);

    let q = supabase
      .from('boutique_audit_log')
      .select('id, actor_id, actor_name, action, table_name, row_id, before_data, after_data, created_at')
      .eq('boutique_id', boutique.id)
      .order('created_at', { ascending: false })
      .range(currentOffset, currentOffset + PAGE_SIZE - 1);

    if (tableFilter !== 'all') q = q.eq('table_name', tableFilter);
    if (actorSearch.trim())    q = q.ilike('actor_name', `%${actorSearch.trim()}%`);

    const { data, error } = await q;

    if (!error) {
      const rows = data || [];
      setEntries(prev => replace ? rows : [...prev, ...rows]);
      setHasMore(rows.length === PAGE_SIZE);
      setOffset(currentOffset + rows.length);
    }

    replace ? setLoading(false) : setLoadingMore(false);
  }, [boutique?.id, tableFilter, actorSearch]);

  // Refetch when filters change
  useEffect(() => {
    setOffset(0);
    fetchEntries({ replace: true, currentOffset: 0 });
  }, [fetchEntries]);

  const handleLoadMore = () => {
    fetchEntries({ replace: false, currentOffset: offset });
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Topbar title="Audit log" subtitle="Activity history across your boutique" />

      {/* Filter bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 16px',
        borderBottom: `1px solid ${C.border}`,
        background: C.white,
        flexWrap: 'wrap',
      }}>
        {/* Table filter pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {TABLE_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setTableFilter(f.value)}
              style={{
                padding: '4px 12px',
                borderRadius: 20,
                border: `1px solid ${tableFilter === f.value ? C.rosa : C.border}`,
                background: tableFilter === f.value ? C.rosaPale : C.white,
                color: tableFilter === f.value ? C.rosa : C.gray,
                fontSize: 12,
                fontWeight: tableFilter === f.value ? 600 : 400,
                cursor: 'pointer',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Actor search */}
        <input
          type="text"
          placeholder="Search by actor name…"
          value={actorSearch}
          onChange={e => setActorSearch(e.target.value)}
          style={{
            marginLeft: 'auto',
            padding: '5px 10px',
            borderRadius: 6,
            border: `1px solid ${C.border}`,
            fontSize: 13,
            color: C.ink,
            outline: 'none',
            width: 210,
          }}
        />
      </div>

      {/* Log list */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {/* Column headers */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '7px 16px 7px 42px',
          background: C.grayBg,
          borderBottom: `1px solid ${C.border}`,
          fontSize: 11,
          fontWeight: 600,
          color: C.gray,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          position: 'sticky',
          top: 0,
          zIndex: 1,
        }}>
          <span style={{ width: 60 }}>Action</span>
          <span style={{ width: 80 }}>Table</span>
          <span style={{ flex: 1 }}>Summary</span>
          <span style={{ width: 90, textAlign: 'right' }}>Actor</span>
          <span style={{ width: 80, textAlign: 'right' }}>When</span>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: C.gray, fontSize: 14 }}>
            Loading…
          </div>
        ) : entries.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: 60, gap: 12,
          }}>
            <div style={{ fontSize: 36 }}>🔍</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.ink }}>No audit events recorded yet</div>
            <div style={{ fontSize: 13, color: C.gray, textAlign: 'center', maxWidth: 320 }}>
              Changes to events, clients, payments, and contracts will appear here automatically.
            </div>
          </div>
        ) : (
          <>
            {entries.map(entry => (
              <AuditRow key={entry.id} entry={entry} />
            ))}

            {hasMore && (
              <div style={{ padding: '16px', textAlign: 'center' }}>
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  style={{
                    padding: '8px 24px',
                    borderRadius: 6,
                    border: `1px solid ${C.border}`,
                    background: C.white,
                    color: C.ink,
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: loadingMore ? 'default' : 'pointer',
                    opacity: loadingMore ? 0.6 : 1,
                  }}
                >
                  {loadingMore ? 'Loading…' : 'Load more'}
                </button>
              </div>
            )}

            {!hasMore && entries.length > 0 && (
              <div style={{ padding: '14px', textAlign: 'center', fontSize: 12, color: C.gray }}>
                All {entries.length} event{entries.length !== 1 ? 's' : ''} shown
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
