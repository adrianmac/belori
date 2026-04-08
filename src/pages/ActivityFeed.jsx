import React, { useState, useEffect, useCallback } from 'react';
import { C } from '../lib/colors';
import { Topbar, GhostBtn, inputSt } from '../lib/ui.jsx';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

const TYPE_CONFIG = {
  // client_interactions types
  call:           { icon: '📞', label: 'Call logged',         color: C.rosa },
  note:           { icon: '📝', label: 'Note added',          color: '#6366F1' },
  email:          { icon: '✉️',  label: 'Email sent',          color: '#3B82F6' },
  sms:            { icon: '💬', label: 'SMS sent',            color: '#10B981' },
  appointment:    { icon: '📅', label: 'Appointment',         color: '#F59E0B' },
  payment:        { icon: '💰', label: 'Payment logged',      color: '#10B981' },
  rating:         { icon: '⭐', label: 'Rating received',     color: '#F59E0B' },
  pipeline_move:  { icon: '🔀', label: 'Pipeline moved',      color: '#8B5CF6' },
  loyalty:        { icon: '🎁', label: 'Loyalty points',      color: C.rosa },
  system:         { icon: '🔔', label: 'System event',        color: C.gray },
};

const FILTERS = [
  { key: 'all',           label: 'All' },
  { key: 'payment',       label: '💰 Payments' },
  { key: 'appointment',   label: '📅 Appointments' },
  { key: 'note',          label: '📝 Notes' },
  { key: 'call',          label: '📞 Calls' },
  { key: 'sms',           label: '💬 SMS' },
  { key: 'email',         label: '✉️ Email' },
  { key: 'pipeline_move', label: '🔀 Pipeline' },
];

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const PAGE_SIZE = 40;

export default function ActivityFeed({ setScreen }) {
  const { boutique } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  const fetchItems = useCallback(async (pg = 1, currentFilter = filter, currentSearch = search) => {
    if (!boutique?.id) return;
    setLoading(true);
    let q = supabase
      .from('client_interactions')
      .select('*, client:clients(id, name)', { count: 'exact' })
      .eq('boutique_id', boutique.id)
      .order('occurred_at', { ascending: false })
      .range((pg - 1) * PAGE_SIZE, pg * PAGE_SIZE - 1);

    if (currentFilter !== 'all') q = q.eq('type', currentFilter);
    if (currentSearch.trim()) q = q.ilike('title', `%${currentSearch.trim()}%`);

    const { data, count, error } = await q;
    setLoading(false);
    if (error) return;

    if (pg === 1) {
      setItems(data || []);
    } else {
      setItems(prev => [...prev, ...(data || [])]);
    }
    setTotalCount(count || 0);
    setHasMore((data || []).length === PAGE_SIZE);
  }, [boutique?.id, filter, search]);

  useEffect(() => {
    setPage(1);
    fetchItems(1, filter, search);
  }, [boutique?.id, filter, search]);

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchItems(next, filter, search);
  };

  const cfg = (type) => TYPE_CONFIG[type] || TYPE_CONFIG.system;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: C.bg }}>
      <Topbar
        title="Activity Feed"
        subtitle={totalCount ? `${totalCount.toLocaleString()} events` : ''}
        actions={<GhostBtn label="← Back" onClick={() => setScreen('dashboard')}/>}
      />

      {/* Search */}
      <div style={{ padding: '12px 16px 0', flexShrink: 0 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search activity…"
          style={{ ...inputSt, fontSize: 13 }}
        />
      </div>

      {/* Filter chips */}
      <div style={{ padding: '10px 16px 0', display: 'flex', gap: 6, flexWrap: 'wrap', flexShrink: 0 }}>
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              fontSize: 12, padding: '4px 12px', borderRadius: 20,
              border: `1px solid ${filter === f.key ? C.rosa : C.border}`,
              background: filter === f.key ? C.rosaPale : C.white,
              color: filter === f.key ? C.rosa : C.inkMid,
              cursor: 'pointer', fontWeight: filter === f.key ? 600 : 400,
              transition: 'all 0.15s',
            }}
          >{f.label}</button>
        ))}
      </div>

      {/* Feed */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 24px' }}>
        {loading && page === 1 && (
          <div style={{ textAlign: 'center', padding: 40, color: C.gray, fontSize: 13 }}>Loading activity…</div>
        )}

        {!loading && items.length === 0 && (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 14, color: C.ink, fontWeight: 500 }}>No activity yet</div>
            <div style={{ fontSize: 12, color: C.gray, marginTop: 4 }}>
              {filter !== 'all' ? 'Try a different filter' : 'Activity from client interactions will appear here'}
            </div>
          </div>
        )}

        {items.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {items.map((item, idx) => {
              const c = cfg(item.type);
              const clientName = item.client?.name || null;
              return (
                <div key={item.id} style={{
                  display: 'flex', gap: 12, padding: '11px 14px',
                  borderRadius: 10, background: idx % 2 === 0 ? C.white : '#FAFAFA',
                  border: `1px solid ${C.border}`,
                  marginBottom: 4,
                  transition: 'background 0.1s',
                }}
                  onMouseEnter={e => e.currentTarget.style.background = C.rosaPale}
                  onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? C.white : '#FAFAFA'}
                >
                  {/* Icon */}
                  <div style={{
                    width: 34, height: 34, borderRadius: '50%',
                    background: c.color + '18',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, flexShrink: 0,
                  }}>{c.icon}</div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: C.ink }}>{item.title || c.label}</span>
                      {clientName && (
                        <span style={{ fontSize: 12, color: C.rosa, fontWeight: 500 }}>· {clientName}</span>
                      )}
                    </div>
                    {item.body && (
                      <div style={{ fontSize: 12, color: C.gray, marginTop: 2, lineHeight: 1.4,
                        overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box',
                        WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {item.body}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 10, marginTop: 4, alignItems: 'center' }}>
                      {item.author_name && (
                        <span style={{ fontSize: 11, color: C.gray }}>{item.author_name}</span>
                      )}
                      {item.points_awarded > 0 && (
                        <span style={{ fontSize: 11, color: C.rosa }}>+{item.points_awarded} pts</span>
                      )}
                    </div>
                  </div>

                  {/* Time */}
                  <div style={{ fontSize: 11, color: C.gray, flexShrink: 0, whiteSpace: 'nowrap', paddingTop: 2 }}>
                    {timeAgo(item.occurred_at)}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {hasMore && (
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <GhostBtn label={loading ? 'Loading…' : 'Load more'} onClick={loadMore}/>
          </div>
        )}
      </div>
    </div>
  );
}
