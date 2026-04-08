import React, { useState } from 'react';
import { C } from '../../lib/colors';
import { Card, CardHead, GhostBtn, PrimaryBtn, inputSt, LBL } from '../../lib/ui.jsx';
import { useEventVendors } from '../../hooks/useEventVendors';

const CATEGORY_EMOJI = {
  florist: '💐', photographer: '📸', dj: '🎵', caterer: '🍽️',
  venue: '🏛️', seamstress: '🧵', transportation: '🚗', decor: '✨', other: '📌'
};

const STATUS_COLORS = {
  confirmed: { bg: '#D1FAE5', col: '#065F46' },
  pending:   { bg: '#FEF3C7', col: '#92400E' },
  cancelled: { bg: '#FEE2E2', col: '#991B1B' },
};

export default function EventVendorsCard({ eventId }) {
  const { eventVendors, allVendors, loading, addVendor, updateVendor, removeVendor } = useEventVendors(eventId);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ vendor_id: '', role: '', fee: '', notes: '', status: 'confirmed' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const assignedIds = new Set(eventVendors.map(ev => ev.vendor_id));
  const available = allVendors.filter(v => !assignedIds.has(v.id));

  const handleAdd = async () => {
    if (!form.vendor_id) return setErr('Select a vendor');
    setSaving(true); setErr('');
    const { error } = await addVendor(form);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    setShowAdd(false);
    setForm({ vendor_id: '', role: '', fee: '', notes: '', status: 'confirmed' });
  };

  const handleRemove = async (id) => {
    await removeVendor(id);
  };

  const handleStatusChange = async (id, status) => {
    await updateVendor(id, { status });
  };

  return (
    <Card>
      <CardHead title="Vendors" sub={`${eventVendors.length} assigned`}>
        <GhostBtn label="+ Add vendor" onClick={() => setShowAdd(true)}/>
      </CardHead>

      {loading && <div style={{ padding: '12px 16px', color: C.gray, fontSize: 13 }}>Loading…</div>}

      {!loading && eventVendors.length === 0 && (
        <div style={{ padding: '24px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🤝</div>
          <div style={{ fontSize: 13, color: C.gray }}>No vendors assigned to this event yet.</div>
          <div style={{ fontSize: 12, color: C.gray, marginTop: 4 }}>Add your photographer, florist, caterer and more.</div>
        </div>
      )}

      {eventVendors.length > 0 && (
        <div style={{ padding: '0 16px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {eventVendors.map(ev => {
            const v = ev.vendor || {};
            const sc = STATUS_COLORS[ev.status] || STATUS_COLORS.confirmed;
            return (
              <div key={ev.id} style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ fontSize: 22, lineHeight: 1 }}>{CATEGORY_EMOJI[v.category] || '📌'}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 2 }}>
                    <span style={{ fontWeight: 600, fontSize: 13, color: C.ink }}>{v.name}</span>
                    <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: sc.bg, color: sc.col, fontWeight: 500 }}>{ev.status}</span>
                    {ev.role && <span style={{ fontSize: 11, color: C.gray }}>· {ev.role}</span>}
                  </div>
                  {v.contact_name && <div style={{ fontSize: 12, color: C.gray }}>{v.contact_name}</div>}
                  <div style={{ display: 'flex', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
                    {v.phone && <a href={`tel:${v.phone}`} style={{ fontSize: 12, color: C.rosa, textDecoration: 'none' }}>📞 {v.phone}</a>}
                    {v.email && <a href={`mailto:${v.email}`} style={{ fontSize: 12, color: C.rosa, textDecoration: 'none' }}>✉️ {v.email}</a>}
                    {ev.fee > 0 && <span style={{ fontSize: 12, color: C.gray }}>Fee: ${Number(ev.fee).toLocaleString()}</span>}
                  </div>
                  {ev.notes && <div style={{ fontSize: 11, color: C.gray, marginTop: 4, fontStyle: 'italic' }}>{ev.notes}</div>}
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    {['confirmed','pending','cancelled'].map(s => (
                      <button key={s} onClick={() => handleStatusChange(ev.id, s)}
                        style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, border: `1px solid ${ev.status===s?'transparent':C.border}`, background: ev.status===s ? sc.bg : 'transparent', color: ev.status===s ? sc.col : C.gray, cursor: 'pointer', fontWeight: ev.status===s ? 600 : 400 }}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <button onClick={() => handleRemove(ev.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.gray, fontSize: 16, lineHeight: 1, padding: 4, flexShrink: 0 }} title="Remove vendor">×</button>
              </div>
            );
          })}
        </div>
      )}

      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 16 }}>
          <div style={{ background: C.white, borderRadius: 16, width: 420, maxHeight: '88dvh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <span style={{ fontWeight: 600, fontSize: 15, color: C.ink }}>Assign vendor</span>
              <button onClick={() => setShowAdd(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: C.gray }}>×</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {err && <div style={{ fontSize: 12, color: '#dc2626', background: '#fef2f2', padding: '8px 12px', borderRadius: 7 }}>{err}</div>}
              {available.length === 0 && (
                <div style={{ fontSize: 13, color: C.gray, textAlign: 'center', padding: '12px 0' }}>
                  All vendors already assigned, or no vendors added yet. Go to the Vendors page to add more.
                </div>
              )}
              {available.length > 0 && (
                <>
                  <div>
                    <div style={{ ...LBL }}>Vendor *</div>
                    <select value={form.vendor_id} onChange={e => setForm(f => ({ ...f, vendor_id: e.target.value }))} style={{ ...inputSt }}>
                      <option value="">Select vendor…</option>
                      {available.map(v => (
                        <option key={v.id} value={v.id}>{CATEGORY_EMOJI[v.category] || '📌'} {v.name} ({v.category})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div style={{ ...LBL }}>Role / note <span style={{ fontWeight: 400, color: C.gray }}>(optional)</span></div>
                    <input value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} placeholder="e.g. Lead photographer" style={{ ...inputSt }}/>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <div style={{ ...LBL }}>Fee</div>
                      <input type="number" value={form.fee} onChange={e => setForm(f => ({ ...f, fee: e.target.value }))} placeholder="0.00" style={{ ...inputSt }}/>
                    </div>
                    <div>
                      <div style={{ ...LBL }}>Status</div>
                      <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={{ ...inputSt }}>
                        <option value="confirmed">Confirmed</option>
                        <option value="pending">Pending</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <div style={{ ...LBL }}>Notes <span style={{ fontWeight: 400, color: C.gray }}>(optional)</span></div>
                    <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Any special instructions…" style={{ ...inputSt, resize: 'vertical', fontFamily: 'inherit' }}/>
                  </div>
                </>
              )}
            </div>
            {available.length > 0 && (
              <div style={{ padding: '12px 20px', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
                <GhostBtn label="Cancel" colorScheme="danger" onClick={() => setShowAdd(false)}/>
                <PrimaryBtn label={saving ? 'Saving…' : 'Assign vendor'} onClick={handleAdd}/>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
