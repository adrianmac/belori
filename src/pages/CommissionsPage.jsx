import React, { useState, useMemo } from 'react';
import { C, fmt } from '../lib/colors';
import { Topbar, PrimaryBtn, GhostBtn, inputSt, LBL, Avatar, useToast, ConfirmModal } from '../lib/ui.jsx';
import { useCommissions } from '../hooks/useCommissions';
import { useEvents } from '../hooks/useEvents';

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function dateLabel(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function monthKey(iso) {
  if (!iso) return '';
  return iso.slice(0, 7); // YYYY-MM
}

function currentMonthKey() {
  return new Date().toISOString().slice(0, 7);
}

// ─── STAT CARD ────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, sub, color }) => (
  <div style={{
    background: C.white, border: `1px solid ${C.border}`, borderRadius: 12,
    padding: '16px 20px', flex: 1, minWidth: 0,
  }}>
    <div style={{ fontSize: 11, color: C.gray, fontWeight: 500, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
    <div style={{ fontSize: 22, fontWeight: 600, color: color || C.ink, lineHeight: 1 }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: C.gray, marginTop: 4 }}>{sub}</div>}
  </div>
);

// ─── STATUS BADGE ─────────────────────────────────────────────────────────────
const StatusBadge = ({ paid }) => (
  <span style={{
    fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 999,
    background: paid ? C.greenBg : C.amberBg,
    color: paid ? C.green : C.amber,
  }}>
    {paid ? 'Paid' : 'Owed'}
  </span>
);

// ─── LOG COMMISSION MODAL ─────────────────────────────────────────────────────
const LogCommissionModal = ({ onClose, onCreate, staff, events }) => {
  const toast = useToast();
  const [eventId, setEventId] = useState('');
  const [memberId, setMemberId] = useState('');
  const [eventTotal, setEventTotal] = useState('');
  const [rate, setRate] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const filteredEvents = useMemo(() => {
    if (!search) return events || [];
    const q = search.toLowerCase();
    return (events || []).filter(e => {
      const clientName = e.clients?.name || '';
      const type = e.type || '';
      return clientName.toLowerCase().includes(q) || type.toLowerCase().includes(q);
    });
  }, [events, search]);

  // Auto-fill event total when event is selected
  function handleEventChange(id) {
    setEventId(id);
    const ev = (events || []).find(e => e.id === id);
    if (ev?.total) {
      const t = Number(ev.total);
      setEventTotal(t.toString());
      if (rate) setAmount(((t * Number(rate)) / 100).toFixed(2));
    }
  }

  // Auto-fill rate when staff member is selected
  function handleMemberChange(id) {
    setMemberId(id);
    const member = (staff || []).find(m => m.id === id);
    if (member?.commission_rate) {
      const r = Number(member.commission_rate);
      setRate(r.toString());
      if (eventTotal) setAmount(((Number(eventTotal) * r) / 100).toFixed(2));
    }
  }

  function handleTotalChange(val) {
    setEventTotal(val);
    if (rate && val) setAmount(((Number(val) * Number(rate)) / 100).toFixed(2));
    else setAmount('');
  }

  function handleRateChange(val) {
    setRate(val);
    if (eventTotal && val) setAmount(((Number(eventTotal) * Number(val)) / 100).toFixed(2));
    else setAmount('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!eventId || !memberId || !eventTotal || !rate) return;
    const member = (staff || []).find(m => m.id === memberId);
    setSaving(true);
    try {
      await onCreate({
        event_id: eventId,
        member_id: memberId,
        member_name: member?.name || 'Unknown',
        event_total: Number(eventTotal),
        commission_rate: Number(rate),
        commission_amount: Number(amount) || (Number(eventTotal) * Number(rate)) / 100,
        notes: notes || null,
        paid: false,
      });
      toast('Commission logged', 'success');
      onClose();
    } catch (err) {
      toast(err.message || 'Failed to log commission', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 500,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: C.white, borderRadius: 14, padding: 24, width: '100%', maxWidth: 480,
        maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: C.ink }}>Log Commission</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: C.gray, lineHeight: 1, padding: '0 4px' }}>×</button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Event search + select */}
          <div>
            <label htmlFor="comm-event-search" style={LBL}>Event</label>
            <input
              id="comm-event-search"
              style={{ ...inputSt, marginBottom: 6 }}
              placeholder="Search events by client or type…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <select
              id="comm-event-select"
              required
              value={eventId}
              onChange={e => handleEventChange(e.target.value)}
              style={inputSt}
            >
              <option value="">Select an event…</option>
              {filteredEvents.map(ev => (
                <option key={ev.id} value={ev.id}>
                  {ev.clients?.name || 'Unknown client'} — {ev.type || 'Event'} ({ev.event_date || '?'})
                </option>
              ))}
            </select>
          </div>

          {/* Staff member */}
          <div>
            <label htmlFor="comm-staff-member" style={LBL}>Staff Member</label>
            <select
              id="comm-staff-member"
              required
              value={memberId}
              onChange={e => handleMemberChange(e.target.value)}
              style={inputSt}
            >
              <option value="">Select staff member…</option>
              {(staff || []).map(m => (
                <option key={m.id} value={m.id}>
                  {m.name} {m.commission_rate ? `(${m.commission_rate}% default)` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Event total + Rate */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label htmlFor="comm-event-total" style={LBL}>Event Total ($)</label>
              <input
                id="comm-event-total"
                type="number" min="0" step="0.01" required
                style={inputSt}
                placeholder="0.00"
                value={eventTotal}
                onChange={e => handleTotalChange(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="comm-rate" style={LBL}>Commission Rate (%)</label>
              <input
                id="comm-rate"
                type="number" min="0" max="100" step="0.01" required
                style={inputSt}
                placeholder="e.g. 10"
                value={rate}
                onChange={e => handleRateChange(e.target.value)}
              />
            </div>
          </div>

          {/* Commission amount */}
          <div>
            <label htmlFor="comm-amount" style={LBL}>Commission Amount ($) — auto-calculated</label>
            <input
              id="comm-amount"
              type="number" min="0" step="0.01"
              style={inputSt}
              placeholder="0.00"
              value={amount}
              onChange={e => setAmount(e.target.value)}
            />
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="comm-notes" style={LBL}>Notes (optional)</label>
            <textarea
              id="comm-notes"
              style={{ ...inputSt, minHeight: 64, resize: 'vertical' }}
              placeholder="Any notes about this commission…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 }}>
            <GhostBtn label="Cancel" onClick={onClose} />
            <PrimaryBtn label={saving ? 'Saving…' : 'Log Commission'} disabled={saving} />
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── EDIT COMMISSION MODAL ────────────────────────────────────────────────────
const EditCommissionModal = ({ record, onClose, onSave }) => {
  const toast = useToast();
  const [eventTotal, setEventTotal] = useState(String(record.event_total || ''));
  const [rate, setRate] = useState(String(record.commission_rate || ''));
  const [amount, setAmount] = useState(String(record.commission_amount || ''));
  const [notes, setNotes] = useState(record.notes || '');
  const [saving, setSaving] = useState(false);

  function handleTotalChange(val) {
    setEventTotal(val);
    if (rate && val) setAmount(((Number(val) * Number(rate)) / 100).toFixed(2));
  }
  function handleRateChange(val) {
    setRate(val);
    if (eventTotal && val) setAmount(((Number(eventTotal) * Number(val)) / 100).toFixed(2));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(record.id, {
        event_total: Number(eventTotal),
        commission_rate: Number(rate),
        commission_amount: Number(amount),
        notes: notes || null,
      });
      toast('Commission updated', 'success');
      onClose();
    } catch (err) {
      toast(err.message || 'Failed to update', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 500,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: C.white, borderRadius: 14, padding: 24, width: '100%', maxWidth: 420,
        boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: C.ink }}>Edit Commission</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: C.gray, lineHeight: 1, padding: '0 4px' }}>×</button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label htmlFor="comm-edit-total" style={LBL}>Event Total ($)</label>
              <input id="comm-edit-total" type="number" min="0" step="0.01" required style={inputSt} value={eventTotal} onChange={e => handleTotalChange(e.target.value)} />
            </div>
            <div>
              <label htmlFor="comm-edit-rate" style={LBL}>Rate (%)</label>
              <input id="comm-edit-rate" type="number" min="0" max="100" step="0.01" required style={inputSt} value={rate} onChange={e => handleRateChange(e.target.value)} />
            </div>
          </div>
          <div>
            <label htmlFor="comm-edit-amount" style={LBL}>Commission Amount ($)</label>
            <input id="comm-edit-amount" type="number" min="0" step="0.01" style={inputSt} value={amount} onChange={e => setAmount(e.target.value)} />
          </div>
          <div>
            <label htmlFor="comm-edit-notes" style={LBL}>Notes</label>
            <textarea id="comm-edit-notes" style={{ ...inputSt, minHeight: 56, resize: 'vertical' }} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <GhostBtn label="Cancel" onClick={onClose} />
            <PrimaryBtn label={saving ? 'Saving…' : 'Save Changes'} disabled={saving} />
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── STAFF RATES PANEL ────────────────────────────────────────────────────────
const StaffRatesPanel = ({ staff, onUpdateRate }) => {
  const toast = useToast();
  const [editingId, setEditingId] = useState(null);
  const [editVal, setEditVal] = useState('');

  function startEdit(member) {
    setEditingId(member.id);
    setEditVal(String(member.commission_rate || 0));
  }

  async function saveEdit(member) {
    try {
      await onUpdateRate(member.id, Number(editVal));
      toast(`Rate updated for ${member.name}`, 'success');
      setEditingId(null);
    } catch (err) {
      toast(err.message || 'Failed to update rate', 'error');
    }
  }

  return (
    <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.gray} strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
        <span style={{ fontSize: 13, fontWeight: 500, color: C.ink }}>Staff Commission Rates</span>
        <span style={{ fontSize: 11, color: C.gray, marginLeft: 4 }}>Click a rate to edit</span>
      </div>
      {staff.length === 0 && (
        <div style={{ padding: '20px', textAlign: 'center', color: C.gray, fontSize: 13 }}>No staff members found.</div>
      )}
      {staff.map((member, i) => (
        <div key={member.id} style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px',
          borderBottom: i < staff.length - 1 ? `1px solid ${C.border}` : 'none',
        }}>
          <Avatar
            initials={member.initials || (member.name || 'S').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
            size={32}
            bg={member.color ? member.color + '22' : C.rosaPale}
            color={member.color || C.rosa}
          />
          <span style={{ flex: 1, fontSize: 13, color: C.ink, fontWeight: 500 }}>{member.name}</span>
          {editingId === member.id ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                autoFocus
                type="number" min="0" max="100" step="0.01"
                value={editVal}
                onChange={e => setEditVal(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') saveEdit(member);
                  if (e.key === 'Escape') setEditingId(null);
                }}
                style={{ ...inputSt, width: 90, padding: '5px 8px', fontSize: 13 }}
              />
              <span style={{ fontSize: 12, color: C.gray }}>%</span>
              <button onClick={() => saveEdit(member)}
                style={{ background: C.green, color: C.white, border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>
                Save
              </button>
              <button onClick={() => setEditingId(null)}
                style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer', color: C.gray }}>
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => startEdit(member)}
              style={{
                background: C.grayBg, border: `1px solid ${C.border}`, borderRadius: 6,
                padding: '5px 12px', fontSize: 13, cursor: 'pointer', color: C.ink, fontWeight: 500,
                display: 'flex', alignItems: 'center', gap: 6,
              }}
              title="Click to edit commission rate"
            >
              {member.commission_rate != null ? `${member.commission_rate}%` : '0%'}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z"/></svg>
            </button>
          )}
        </div>
      ))}
    </div>
  );
};

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function CommissionsPage() {
  const { records, staff, loading, error, createRecord, updateRecord, markPaid, deleteRecord, updateStaffRate } = useCommissions();
  const { events } = useEvents();
  const toast = useToast();

  const [showLogModal, setShowLogModal] = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const [showRates, setShowRates] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // record id | null

  // Filters
  const [filterStaff, setFilterStaff] = useState('');
  const [filterRange, setFilterRange] = useState('month'); // month | 3months | year | all
  const [filterStatus, setFilterStatus] = useState('all'); // all | unpaid | paid

  // Derived: filtered records
  const filtered = useMemo(() => {
    const now = new Date();
    return records.filter(r => {
      // Staff filter
      if (filterStaff && r.member_id !== filterStaff && r.member_name !== filterStaff) return false;
      // Date range filter
      if (filterRange !== 'all') {
        const created = new Date(r.created_at);
        if (filterRange === 'month') {
          if (created.getFullYear() !== now.getFullYear() || created.getMonth() !== now.getMonth()) return false;
        } else if (filterRange === '3months') {
          const cutoff = new Date(now); cutoff.setMonth(cutoff.getMonth() - 3);
          if (created < cutoff) return false;
        } else if (filterRange === 'year') {
          if (created.getFullYear() !== now.getFullYear()) return false;
        }
      }
      // Status filter
      if (filterStatus === 'unpaid' && r.paid) return false;
      if (filterStatus === 'paid' && !r.paid) return false;
      return true;
    });
  }, [records, filterStaff, filterRange, filterStatus]);

  // Stats
  const stats = useMemo(() => {
    const thisMonth = currentMonthKey();
    const totalOwed = records.filter(r => !r.paid).reduce((s, r) => s + Number(r.commission_amount || 0), 0);
    const totalPaid = records.filter(r => r.paid).reduce((s, r) => s + Number(r.commission_amount || 0), 0);
    const monthRecords = records.filter(r => monthKey(r.created_at) === thisMonth);
    const monthTotal = monthRecords.reduce((s, r) => s + Number(r.commission_amount || 0), 0);

    // Highest earner this month
    const earnerMap = {};
    for (const r of monthRecords) {
      if (!earnerMap[r.member_name]) earnerMap[r.member_name] = 0;
      earnerMap[r.member_name] += Number(r.commission_amount || 0);
    }
    const topEarner = Object.entries(earnerMap).sort((a, b) => b[1] - a[1])[0];

    return { totalOwed, totalPaid, monthTotal, topEarner };
  }, [records]);

  const handleDelete = (id) => setDeleteConfirm(id);
  async function confirmDelete() {
    if (!deleteConfirm) return;
    const id = deleteConfirm;
    setDeleteConfirm(null);
    try {
      await deleteRecord(id);
      toast('Record deleted', 'success');
    } catch (err) {
      toast(err.message || 'Failed to delete', 'error');
    }
  }

  async function handleMarkPaid(id) {
    try {
      await markPaid(id);
      toast('Marked as paid', 'success');
    } catch (err) {
      toast(err.message || 'Failed to mark paid', 'error');
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Topbar
        title="Commissions"
        subtitle="Track and pay staff commissions per event"
        actions={
          <PrimaryBtn label="+ Log Commission" onClick={() => setShowLogModal(true)} />
        }
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Stats */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <StatCard label="Total Owed" value={fmt(stats.totalOwed)} color={C.amber} sub="All unpaid commissions" />
          <StatCard label="Total Paid Out" value={fmt(stats.totalPaid)} color={C.green} sub="All time" />
          <StatCard label="This Month" value={fmt(stats.monthTotal)} sub="All commissions this month" />
          <StatCard
            label="Top Earner (This Month)"
            value={stats.topEarner ? stats.topEarner[0] : '—'}
            sub={stats.topEarner ? fmt(stats.topEarner[1]) : 'No data yet'}
            color={C.rosa}
          />
        </div>

        {/* Filters */}
        <div style={{
          display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center',
          background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 16px',
        }}>
          <select
            value={filterStaff}
            onChange={e => setFilterStaff(e.target.value)}
            style={{ ...inputSt, width: 'auto', minWidth: 160, padding: '6px 10px', fontSize: 13 }}
          >
            <option value="">All staff</option>
            {staff.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>

          <select
            value={filterRange}
            onChange={e => setFilterRange(e.target.value)}
            style={{ ...inputSt, width: 'auto', minWidth: 150, padding: '6px 10px', fontSize: 13 }}
          >
            <option value="month">This month</option>
            <option value="3months">Last 3 months</option>
            <option value="year">This year</option>
            <option value="all">All time</option>
          </select>

          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            style={{ ...inputSt, width: 'auto', minWidth: 130, padding: '6px 10px', fontSize: 13 }}
          >
            <option value="all">All statuses</option>
            <option value="unpaid">Unpaid</option>
            <option value="paid">Paid</option>
          </select>

          <span style={{ marginLeft: 'auto', fontSize: 12, color: C.gray }}>
            {filtered.length} record{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: C.gray, fontSize: 13 }}>Loading commissions…</div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: 40, color: C.red, fontSize: 13 }}>Error: {error.message}</div>
        ) : filtered.length === 0 ? (
          <div style={{
            background: C.white, border: `1px solid ${C.border}`, borderRadius: 12,
            padding: 40, textAlign: 'center',
          }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>💰</div>
            <div style={{ fontSize: 14, color: C.ink, fontWeight: 500, marginBottom: 6 }}>No commissions yet</div>
            <div style={{ fontSize: 13, color: C.gray }}>Log your first commission with the button above.</div>
          </div>
        ) : (
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
            {/* Table header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1.5fr 1fr 1.5fr 1fr 1fr 1fr 1fr',
              gap: 0, padding: '10px 16px',
              background: C.grayBg, borderBottom: `1px solid ${C.border}`,
              fontSize: 11, fontWeight: 600, color: C.gray, textTransform: 'uppercase', letterSpacing: '0.04em',
            }}>
              <span>Event</span>
              <span>Client</span>
              <span>Date</span>
              <span>Staff</span>
              <span>Event Total</span>
              <span>Rate %</span>
              <span>Commission</span>
              <span>Status / Actions</span>
            </div>

            {filtered.map((r, i) => {
              const eventData = r.events;
              const clientName = eventData?.clients?.name || '—';
              const eventDate = eventData?.event_date;
              const eventType = eventData?.type || '—';

              return (
                <div key={r.id} style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1.5fr 1fr 1.5fr 1fr 1fr 1fr 1fr',
                  gap: 0, padding: '12px 16px', alignItems: 'center',
                  borderBottom: i < filtered.length - 1 ? `1px solid ${C.border}` : 'none',
                  background: i % 2 === 0 ? C.white : C.grayBg,
                }}>
                  {/* Event */}
                  <span style={{ fontSize: 13, color: C.ink, fontWeight: 500 }}>
                    {eventType.charAt(0).toUpperCase() + eventType.slice(1)}
                  </span>
                  {/* Client */}
                  <span style={{ fontSize: 13, color: C.gray }}>{clientName}</span>
                  {/* Date */}
                  <span style={{ fontSize: 12, color: C.gray }}>{dateLabel(eventDate)}</span>
                  {/* Staff */}
                  <span style={{ fontSize: 13, color: C.ink }}>{r.member_name}</span>
                  {/* Event Total */}
                  <span style={{ fontSize: 13, color: C.ink }}>{fmt(r.event_total)}</span>
                  {/* Rate */}
                  <span style={{ fontSize: 13, color: C.ink }}>{r.commission_rate}%</span>
                  {/* Commission */}
                  <span style={{ fontSize: 13, fontWeight: 600, color: r.paid ? C.green : C.amber }}>
                    {fmt(r.commission_amount)}
                  </span>
                  {/* Status + Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <StatusBadge paid={r.paid} />
                    {!r.paid && (
                      <button
                        onClick={() => handleMarkPaid(r.id)}
                        title="Mark paid"
                        style={{
                          background: C.greenBg, border: 'none', borderRadius: 6,
                          padding: '4px 8px', cursor: 'pointer', fontSize: 12,
                          color: C.green, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 3,
                        }}
                      >
                        ✓ Pay
                      </button>
                    )}
                    <button
                      onClick={() => setEditRecord(r)}
                      title="Edit"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.gray, padding: 4, borderRadius: 5, fontSize: 14 }}
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDelete(r.id)}
                      title="Delete"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.red, padding: 4, borderRadius: 5, fontSize: 14 }}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Staff rates collapsible */}
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
          <button
            onClick={() => setShowRates(s => !s)}
            style={{
              width: '100%', background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px',
              fontSize: 13, fontWeight: 500, color: C.ink, textAlign: 'left',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 20V10M18 20V4M6 20v-4"/></svg>
            Staff Commission Rate Settings
            <span style={{ marginLeft: 'auto', fontSize: 12, color: C.gray, transform: showRates ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>▼</span>
          </button>
          {showRates && (
            <div style={{ borderTop: `1px solid ${C.border}` }}>
              <StaffRatesPanel staff={staff} onUpdateRate={updateStaffRate} />
            </div>
          )}
        </div>
      </div>

      {showLogModal && (
        <LogCommissionModal
          onClose={() => setShowLogModal(false)}
          onCreate={createRecord}
          staff={staff}
          events={events || []}
        />
      )}

      {editRecord && (
        <EditCommissionModal
          record={editRecord}
          onClose={() => setEditRecord(null)}
          onSave={updateRecord}
        />
      )}
      {deleteConfirm && (
        <ConfirmModal title="Delete this commission record?" message="This cannot be undone." confirmLabel="Delete"
          onConfirm={confirmDelete} onCancel={() => setDeleteConfirm(null)} />
      )}
    </div>
  );
}
