import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase.js';
import { C } from '../lib/colors';
import { Topbar, useToast } from '../lib/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const Stub = ({ title, subtitle, icon, description, features = [], planBadge }) => {
  const toast = useToast();
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Topbar title={title} subtitle={subtitle} />
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, gap: 0 }}>
        <div style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>{icon}</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{ fontSize: 20, fontWeight: 600, color: C.ink }}>{title}</div>
            {planBadge && (
              <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: C.rosaPale, color: C.rosa, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{planBadge}</span>
            )}
          </div>
          <div style={{ fontSize: 14, color: C.gray, lineHeight: 1.6, marginBottom: 28 }}>{description}</div>
          {features.length > 0 && (
            <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 24px', textAlign: 'left', marginBottom: 28 }}>
              {features.map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: i < features.length - 1 ? `1px solid ${C.border}` : 'none', fontSize: 13, color: C.ink }}>
                  <span style={{ color: C.rosa, fontWeight: 600, flexShrink: 0 }}>✓</span>
                  {f}
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: C.rosaPale, color: C.rosa, borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 500 }}>
              <span>🚧</span> Coming soon — this module is on the roadmap
            </div>
            <button
              onClick={() => toast && toast('We\'ll let you know when this is ready!')}
              style={{ padding: '9px 20px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.white, color: C.ink, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
            >
              🔔 Notify me when available
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const MEAS_FIELDS = [
  { key: 'bust', label: 'Bust' }, { key: 'waist', label: 'Waist' },
  { key: 'hips', label: 'Hips' }, { key: 'height', label: 'Height' },
  { key: 'shoulder_width', label: 'Shoulder' }, { key: 'sleeve_length', label: 'Sleeve' },
  { key: 'dress_length', label: 'Dress length' }, { key: 'inseam', label: 'Inseam' },
  { key: 'neck', label: 'Neck' }, { key: 'weight', label: 'Weight (lbs)' },
];

const BLANK_FORM = { label: 'Standard', bust: '', waist: '', hips: '', height: '', weight: '', shoulder_width: '', sleeve_length: '', dress_length: '', inseam: '', neck: '', notes: '' };

export const MeasurementsScreen = () => {
  const { boutique } = useAuth();
  const [clients, setClients] = useState([]);
  const [measurements, setMeasurements] = useState([]);
  const [selClient, setSelClient] = useState(null);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(BLANK_FORM);

  useEffect(() => {
    if (!boutique?.id) return;
    supabase.from('clients').select('id,name,phone').eq('boutique_id', boutique.id).order('name')
      .then(({ data }) => { if (data) setClients(data); setLoading(false); });
  }, [boutique?.id]);

  useEffect(() => {
    if (!selClient) return;
    setMeasurements([]);
    supabase.from('client_measurements').select('*').eq('client_id', selClient.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setMeasurements(data); });
  }, [selClient?.id]);

  const filtered = clients.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.phone || '').includes(search)
  );

  async function saveMeasurements() {
    if (!selClient || !boutique?.id) return;
    setSaving(true);
    const payload = { boutique_id: boutique.id, client_id: selClient.id, label: form.label || 'Standard', notes: form.notes || null };
    MEAS_FIELDS.forEach(({ key }) => { payload[key] = form[key] !== '' ? Number(form[key]) : null; });
    const { data, error } = await supabase.from('client_measurements').insert(payload).select().single();
    setSaving(false);
    if (!error && data) { setMeasurements(ms => [data, ...ms]); setShowForm(false); setForm(BLANK_FORM); }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Topbar title="Measurements" subtitle="Client body & garment measurements" />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* LEFT: client list */}
        <div style={{ width: 240, borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', flexShrink: 0, background: C.ivory }}>
          <div style={{ padding: '10px 10px 6px' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clients…"
              style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, outline: 'none', boxSizing: 'border-box', background: C.white }} />
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading
              ? <div style={{ padding: 20, textAlign: 'center', color: C.gray, fontSize: 13 }}>Loading…</div>
              : filtered.length === 0
              ? <div style={{ padding: 20, textAlign: 'center', color: C.gray, fontSize: 13 }}>No clients found</div>
              : filtered.map(c => (
                <div key={c.id} onClick={() => { setSelClient(c); setShowForm(false); }}
                  style={{ padding: '9px 12px', cursor: 'pointer', background: selClient?.id === c.id ? C.rosaPale : 'transparent', borderLeft: `3px solid ${selClient?.id === c.id ? C.rosa : 'transparent'}`, display: 'flex', alignItems: 'center', gap: 8, transition: 'background 0.12s' }}>
                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: C.rosaPale, color: C.rosa, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
                    {c.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: C.gray }}>{c.phone || '—'}</div>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* RIGHT: measurement records */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {!selClient ? (
            <div style={{ textAlign: 'center', padding: '80px 20px' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📐</div>
              <div style={{ fontSize: 15, fontWeight: 500, color: C.ink, marginBottom: 6 }}>Select a client</div>
              <div style={{ fontSize: 13, color: C.gray }}>Choose a client to view or add measurements.</div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 600, color: C.ink }}>{selClient.name}</div>
                  <div style={{ fontSize: 12, color: C.gray, marginTop: 2 }}>{measurements.length} record{measurements.length !== 1 ? 's' : ''} on file</div>
                </div>
                <button onClick={() => setShowForm(f => !f)}
                  style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${C.rosa}`, background: showForm ? C.rosaPale : C.white, color: C.rosa, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                  {showForm ? '✕ Cancel' : '+ New record'}
                </button>
              </div>

              {showForm && (
                <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18, marginBottom: 18 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 12 }}>Add measurement record</div>
                  <div style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: 11, fontWeight: 500, color: C.gray, display: 'block', marginBottom: 4 }}>Record label</label>
                    <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="e.g. Fitting #1, Pre-alteration"
                      style={{ width: '100%', padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8, marginBottom: 10 }}>
                    {MEAS_FIELDS.map(({ key, label }) => (
                      <div key={key}>
                        <label style={{ fontSize: 10, fontWeight: 500, color: C.gray, display: 'block', marginBottom: 3 }}>{label} <span style={{ color: '#D1D5DB' }}>(in)</span></label>
                        <input type="number" step="0.25" value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} placeholder="—"
                          style={{ width: '100%', padding: '7px 8px', border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                      </div>
                    ))}
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 10, fontWeight: 500, color: C.gray, display: 'block', marginBottom: 3 }}>Notes</label>
                    <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Fitting notes, items needed…" rows={2}
                      style={{ width: '100%', padding: '7px 10px', border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
                  </div>
                  <button onClick={saveMeasurements} disabled={saving}
                    style={{ padding: '8px 18px', borderRadius: 8, background: saving ? C.gray : C.rosa, color: C.white, border: 'none', fontSize: 13, fontWeight: 500, cursor: saving ? 'default' : 'pointer' }}>
                    {saving ? 'Saving…' : 'Save record'}
                  </button>
                </div>
              )}

              {measurements.length === 0
                ? <div style={{ textAlign: 'center', padding: '36px 20px', background: C.white, borderRadius: 12, border: `1px dashed ${C.border}`, color: C.gray, fontSize: 13 }}>
                    No measurements on file yet. Click "+ New record" to add the first.
                  </div>
                : measurements.map(m => (
                  <div key={m.id} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{m.label || 'Measurements'}</div>
                      <div style={{ fontSize: 11, color: C.gray }}>{new Date(m.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 6 }}>
                      {MEAS_FIELDS.filter(f => m[f.key] != null).map(({ key, label }) => (
                        <div key={key} style={{ background: C.ivory, borderRadius: 8, padding: '7px 9px' }}>
                          <div style={{ fontSize: 10, color: C.gray, marginBottom: 2 }}>{label}</div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>{m[key]}<span style={{ fontSize: 10, fontWeight: 400, color: C.gray }}>"</span></div>
                        </div>
                      ))}
                    </div>
                    {m.notes && <div style={{ marginTop: 10, fontSize: 12, color: C.gray, fontStyle: 'italic' }}>📝 {m.notes}</div>}
                  </div>
                ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const _VendorsReal = React.lazy(() => import('./Vendors.jsx'));
export const VendorsScreen = ({ boutique, goScreen }) => (
  <React.Suspense fallback={<div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.gray, fontSize: 13 }}>Loading…</div>}>
    <_VendorsReal boutique={boutique} goScreen={goScreen} />
  </React.Suspense>
);

export const DressCatalogScreen = ({ inventory = [] }) => {
  const [filter, setFilter] = React.useState('all');
  const [search, setSearch] = React.useState('');
  
  const dresses = inventory.filter(i => i.type === 'dress');
  const brands = [...new Set(dresses.map(d => d.brand).filter(Boolean))];
  
  const filtered = dresses.filter(d => {
    if (filter !== 'all' && d.brand !== filter) return false;
    if (search && !d.name?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.grayBg }}>
      <Topbar title="Dress Catalog" subtitle="Digital lookbook for clients" />
      <div className="filter-bar" style={{ padding: '16px 24px', background: C.white, borderBottom: `1px solid ${C.border}`, display: 'flex', gap: 12, alignItems: 'center' }}>
        <input 
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search styles..." 
          style={{ width: 240, padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.border}`, outline: 'none' }}
        />
        <select value={filter} onChange={e => setFilter(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.border}`, outline: 'none' }}>
          <option value="all">All Designers</option>
          {brands.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        <div style={{ marginLeft: 'auto', fontSize: 13, color: C.gray }}>{filtered.length} styles found</div>
      </div>
      <div className="page-scroll" style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: C.gray }}>No dresses found matching your criteria.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 20 }}>
            {filtered.map(d => (
              <div key={d.id} style={{ background: C.white, borderRadius: 12, overflow: 'hidden', border: `1px solid ${C.border}`, boxShadow: '0 4px 6px rgba(0,0,0,0.02)', transition: 'transform 0.2s', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.transform='translateY(-4px)'} onMouseLeave={e => e.currentTarget.style.transform='translateY(0)'}>
                <div style={{ height: 280, background: '#f8f8f8', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                  {d.photo_url ? (
                    <img src={d.photo_url} alt={d.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: 48 }}>👗</span>
                  )}
                  {d.status === 'rented' && <div style={{ position: 'absolute', top: 10, right: 10, background: 'var(--bg-warning)', color: 'var(--color-warning)', fontSize: 10, fontWeight: 600, padding: '4px 8px', borderRadius: 999 }}>RENTED</div>}
                </div>
                <div style={{ padding: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.gray, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{d.brand || 'Unbranded'}</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: C.ink, marginBottom: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 13, color: C.ink }}>{d.size || 'OS'}</div>
                    {d.retail_price > 0 && <div style={{ fontSize: 14, fontWeight: 600, color: C.rosa }}>${(d.retail_price/100).toLocaleString('en-US',{minimumFractionDigits:2})}</div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── F&B / BEO SCREEN ────────────────────────────────────────────────────────
const EMPTY_BEO = {
  event_id: '',
  guest_count: '',
  setup_time: '',
  service_start: '',
  service_end: '',
  menu_items: [],
  timeline: [],
  dietary_notes: '',
  bar_notes: '',
  special_notes: '',
};

const inputStyle = {
  width: '100%', padding: '8px 10px', borderRadius: 8,
  border: `1px solid ${C.border}`, fontSize: 13, color: C.ink,
  background: C.white, outline: 'none', boxSizing: 'border-box',
};

const labelStyle = { fontSize: 11, fontWeight: 500, color: C.gray, marginBottom: 4, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' };

export const FBBeoScreen = () => {
  const { boutique } = useAuth();
  const [events, setEvents] = useState([]);
  const [beos, setBeos] = useState([]);
  const [form, setForm] = useState(EMPTY_BEO);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!boutique?.id) return;
    supabase.from('events').select('id,client_id,event_date,clients(name)').eq('boutique_id', boutique.id).order('event_date', { ascending: false })
      .then(({ data }) => setEvents(data || []));
    supabase.from('fb_beo').select('*,events(client_id,event_date,clients(name))').eq('boutique_id', boutique.id).order('created_at', { ascending: false })
      .then(({ data }) => setBeos(data || []));
  }, [boutique?.id]);

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const addMenuItem = () => setForm(f => ({ ...f, menu_items: [...f.menu_items, { course: '', item: '', qty: '', notes: '' }] }));
  const updateMenuItem = (i, k, v) => setForm(f => { const arr = [...f.menu_items]; arr[i] = { ...arr[i], [k]: v }; return { ...f, menu_items: arr }; });
  const removeMenuItem = (i) => setForm(f => ({ ...f, menu_items: f.menu_items.filter((_, j) => j !== i) }));

  const addTimeline = () => setForm(f => ({ ...f, timeline: [...f.timeline, { time: '', description: '' }] }));
  const updateTimeline = (i, k, v) => setForm(f => { const arr = [...f.timeline]; arr[i] = { ...arr[i], [k]: v }; return { ...f, timeline: arr }; });
  const removeTimeline = (i) => setForm(f => ({ ...f, timeline: f.timeline.filter((_, j) => j !== i) }));

  const openNew = () => { setForm(EMPTY_BEO); setEditingId(null); setShowForm(true); setSaved(false); };
  const openEdit = (b) => {
    setForm({ event_id: b.event_id || '', guest_count: b.guest_count || '', setup_time: b.setup_time || '', service_start: b.service_start || '', service_end: b.service_end || '', menu_items: b.menu_items || [], timeline: b.timeline || [], dietary_notes: b.dietary_notes || '', bar_notes: b.bar_notes || '', special_notes: b.special_notes || '' });
    setEditingId(b.id); setShowForm(true); setSaved(false);
  };

  const save = async () => {
    if (!form.event_id) return;
    setSaving(true);
    const payload = { boutique_id: boutique.id, event_id: form.event_id, guest_count: form.guest_count ? parseInt(form.guest_count) : null, setup_time: form.setup_time || null, service_start: form.service_start || null, service_end: form.service_end || null, menu_items: form.menu_items, timeline: form.timeline, dietary_notes: form.dietary_notes || null, bar_notes: form.bar_notes || null, special_notes: form.special_notes || null };
    let data;
    if (editingId) {
      ({ data } = await supabase.from('fb_beo').update(payload).eq('id', editingId).select('*,events(client_id,event_date,clients(name))').single());
      setBeos(bs => bs.map(b => b.id === editingId ? data : b));
    } else {
      ({ data } = await supabase.from('fb_beo').insert(payload).select('*,events(client_id,event_date,clients(name))').single());
      setBeos(bs => [data, ...bs]);
    }
    setSaving(false); setSaved(true);
    setTimeout(() => { setSaved(false); setShowForm(false); }, 900);
  };

  const del = async (id) => {
    if (!window.confirm('Delete this BEO?')) return;
    await supabase.from('fb_beo').delete().eq('id', id);
    setBeos(bs => bs.filter(b => b.id !== id));
  };

  const evLabel = (ev) => {
    const name = ev?.events?.clients?.name || ev?.clients?.name || '—';
    const date = ev?.events?.event_date || ev?.event_date;
    return `${name}${date ? ' · ' + new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}`;
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Topbar title="Food & Beverage / BEO" subtitle="Banquet event orders"
        actions={<button onClick={openNew} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: C.rosa, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ New BEO</button>}
      />
      <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {showForm && (
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, fontSize: 15, color: C.ink }}>{editingId ? 'Edit BEO' : 'New BEO'}</span>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: C.gray }}>×</button>
            </div>
            <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Event + basics */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Event *</label>
                  <select value={form.event_id} onChange={e => setField('event_id', e.target.value)} style={inputStyle}>
                    <option value="">— select event —</option>
                    {events.map(ev => <option key={ev.id} value={ev.id}>{ev.clients?.name || '—'}{ev.event_date ? ' · ' + new Date(ev.event_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Guest count</label>
                  <input type="number" value={form.guest_count} onChange={e => setField('guest_count', e.target.value)} placeholder="e.g. 150" style={inputStyle}/>
                </div>
                <div>
                  <label style={labelStyle}>Setup time</label>
                  <input type="time" value={form.setup_time} onChange={e => setField('setup_time', e.target.value)} style={inputStyle}/>
                </div>
                <div>
                  <label style={labelStyle}>Service start</label>
                  <input type="time" value={form.service_start} onChange={e => setField('service_start', e.target.value)} style={inputStyle}/>
                </div>
              </div>
              <div style={{ maxWidth: 200 }}>
                <label style={labelStyle}>Service end</label>
                <input type="time" value={form.service_end} onChange={e => setField('service_end', e.target.value)} style={inputStyle}/>
              </div>

              {/* Menu items */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 13, color: C.ink }}>Menu items</span>
                  <button onClick={addMenuItem} style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.ivory, color: C.ink, cursor: 'pointer' }}>+ Add item</button>
                </div>
                {form.menu_items.length === 0 && <div style={{ fontSize: 12, color: C.gray, fontStyle: 'italic' }}>No menu items yet.</div>}
                {form.menu_items.map((item, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 80px 2fr auto', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                    <input placeholder="Course" value={item.course} onChange={e => updateMenuItem(i, 'course', e.target.value)} style={inputStyle}/>
                    <input placeholder="Item name" value={item.item} onChange={e => updateMenuItem(i, 'item', e.target.value)} style={inputStyle}/>
                    <input placeholder="Qty" type="number" value={item.qty} onChange={e => updateMenuItem(i, 'qty', e.target.value)} style={inputStyle}/>
                    <input placeholder="Notes" value={item.notes} onChange={e => updateMenuItem(i, 'notes', e.target.value)} style={inputStyle}/>
                    <button onClick={() => removeMenuItem(i)} style={{ background: 'none', border: 'none', color: C.gray, cursor: 'pointer', fontSize: 16 }}>×</button>
                  </div>
                ))}
              </div>

              {/* Service timeline */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 13, color: C.ink }}>Service timeline</span>
                  <button onClick={addTimeline} style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.ivory, color: C.ink, cursor: 'pointer' }}>+ Add step</button>
                </div>
                {form.timeline.length === 0 && <div style={{ fontSize: 12, color: C.gray, fontStyle: 'italic' }}>No timeline steps yet.</div>}
                {form.timeline.map((step, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '120px 1fr auto', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                    <input type="time" value={step.time} onChange={e => updateTimeline(i, 'time', e.target.value)} style={inputStyle}/>
                    <input placeholder="Description" value={step.description} onChange={e => updateTimeline(i, 'description', e.target.value)} style={inputStyle}/>
                    <button onClick={() => removeTimeline(i)} style={{ background: 'none', border: 'none', color: C.gray, cursor: 'pointer', fontSize: 16 }}>×</button>
                  </div>
                ))}
              </div>

              {/* Notes */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                {[['dietary_notes', 'Dietary / allergies'], ['bar_notes', 'Bar notes'], ['special_notes', 'Special instructions']].map(([k, lbl]) => (
                  <div key={k}>
                    <label style={labelStyle}>{lbl}</label>
                    <textarea value={form[k]} onChange={e => setField(k, e.target.value)} rows={3} placeholder={lbl} style={{ ...inputStyle, resize: 'vertical' }}/>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ padding: '12px 18px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowForm(false)} style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'transparent', color: C.ink, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              <button onClick={save} disabled={saving || !form.event_id} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: saved ? '#16A34A' : C.rosa, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: (!form.event_id || saving) ? 0.6 : 1 }}>
                {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save BEO'}
              </button>
            </div>
          </div>
        )}

        {/* BEO list */}
        {beos.length === 0 && !showForm ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 60 }}>
            <div style={{ fontSize: 40 }}>🍽️</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.ink }}>No BEOs yet</div>
            <div style={{ fontSize: 13, color: C.gray }}>Create your first banquet event order to get started.</div>
            <button onClick={openNew} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: C.rosa, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginTop: 8 }}>+ New BEO</button>
          </div>
        ) : beos.map(b => {
          const menuCount = (b.menu_items || []).length;
          const stepCount = (b.timeline || []).length;
          return (
            <div key={b.id} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '13px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: C.ink }}>{evLabel(b)}</div>
                  <div style={{ fontSize: 12, color: C.gray, marginTop: 3, display: 'flex', gap: 12 }}>
                    {b.guest_count && <span>👥 {b.guest_count} guests</span>}
                    {b.service_start && <span>🕐 {b.service_start}{b.service_end ? ' – ' + b.service_end : ''}</span>}
                    {menuCount > 0 && <span>🍽️ {menuCount} menu item{menuCount !== 1 ? 's' : ''}</span>}
                    {stepCount > 0 && <span>📋 {stepCount} timeline step{stepCount !== 1 ? 's' : ''}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => openEdit(b)} style={{ padding: '5px 12px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.ivory, color: C.ink, fontSize: 12, cursor: 'pointer' }}>Edit</button>
                  <button onClick={() => del(b.id)} style={{ padding: '5px 12px', borderRadius: 6, border: `1px solid #FECACA`, background: '#FEF2F2', color: '#B91C1C', fontSize: 12, cursor: 'pointer' }}>Delete</button>
                </div>
              </div>
              {(b.menu_items?.length > 0 || b.timeline?.length > 0) && (
                <div style={{ padding: '0 16px 14px', display: 'flex', gap: 24 }}>
                  {b.menu_items?.length > 0 && (
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: C.gray, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Menu</div>
                      {b.menu_items.slice(0, 4).map((item, i) => (
                        <div key={i} style={{ fontSize: 12, color: C.ink, padding: '3px 0', borderBottom: i < Math.min(b.menu_items.length, 4) - 1 ? `1px solid ${C.border}` : 'none' }}>
                          {item.course && <span style={{ color: C.gray, marginRight: 6 }}>{item.course}</span>}{item.item}{item.qty ? <span style={{ color: C.gray }}> × {item.qty}</span> : ''}
                        </div>
                      ))}
                      {b.menu_items.length > 4 && <div style={{ fontSize: 11, color: C.gray, marginTop: 4 }}>+{b.menu_items.length - 4} more</div>}
                    </div>
                  )}
                  {b.timeline?.length > 0 && (
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: C.gray, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Timeline</div>
                      {b.timeline.slice(0, 4).map((step, i) => (
                        <div key={i} style={{ fontSize: 12, color: C.ink, padding: '3px 0', borderBottom: i < Math.min(b.timeline.length, 4) - 1 ? `1px solid ${C.border}` : 'none', display: 'flex', gap: 8 }}>
                          <span style={{ color: C.rosa, fontWeight: 500, flexShrink: 0 }}>{step.time}</span>
                          <span>{step.description}</span>
                        </div>
                      ))}
                      {b.timeline.length > 4 && <div style={{ fontSize: 11, color: C.gray, marginTop: 4 }}>+{b.timeline.length - 4} more</div>}
                    </div>
                  )}
                </div>
              )}
              {(b.dietary_notes || b.bar_notes || b.special_notes) && (
                <div style={{ padding: '8px 16px 12px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 16 }}>
                  {b.dietary_notes && <div style={{ fontSize: 11, color: C.gray }}><span style={{ fontWeight: 500 }}>Dietary:</span> {b.dietary_notes}</div>}
                  {b.bar_notes && <div style={{ fontSize: 11, color: C.gray }}><span style={{ fontWeight: 500 }}>Bar:</span> {b.bar_notes}</div>}
                  {b.special_notes && <div style={{ fontSize: 11, color: C.gray }}><span style={{ fontWeight: 500 }}>Special:</span> {b.special_notes}</div>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── FLOORPLAN SCREEN ────────────────────────────────────────────────────────
const COLS = 16;
const ROWS = 12;
const CELL = 46;
const TABLE_TYPES = [
  { id: 'round6',   label: 'Round 6',   seats: 6,  w: 1, h: 1, shape: 'circle',  color: '#FDF5F6' },
  { id: 'round8',   label: 'Round 8',   seats: 8,  w: 1, h: 1, shape: 'circle',  color: '#EDE9FE' },
  { id: 'rect8',    label: 'Rect 8',    seats: 8,  w: 2, h: 1, shape: 'rect',    color: '#EFF6FF' },
  { id: 'rect10',   label: 'Rect 10',   seats: 10, w: 2, h: 1, shape: 'rect',    color: '#EFF6FF' },
  { id: 'sweetheart',label:'Sweetheart',seats: 2,  w: 1, h: 1, shape: 'heart',   color: '#FEF3C7' },
  { id: 'bar',      label: 'Bar',       seats: 0,  w: 3, h: 1, shape: 'rect',    color: '#F0FDF4' },
  { id: 'dj',       label: 'DJ Booth',  seats: 0,  w: 1, h: 1, shape: 'rect',    color: '#1C1012', textColor: '#fff' },
  { id: 'dance',    label: 'Dance Floor',seats: 0, w: 3, h: 2, shape: 'rect',    color: '#FEF9C3' },
];

export const FloorplanScreen = () => {
  const { boutique } = useAuth();
  const [events, setEvents] = useState([]);
  const [selEventId, setSelEventId] = useState('');
  const [tables, setTables] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dragType, setDragType] = useState(null);
  const [selTable, setSelTable] = useState(null);
  const gridRef = useRef(null);

  useEffect(() => {
    if (!boutique?.id) return;
    supabase.from('events').select('id,client_id,type,event_date,clients(name)').eq('boutique_id', boutique.id).eq('status','active').order('event_date')
      .then(({ data }) => { if (data) setEvents(data); });
  }, [boutique?.id]);

  useEffect(() => {
    if (!selEventId) return;
    setTables([]);
    supabase.from('events').select('floorplan').eq('id', selEventId).single()
      .then(({ data }) => { if (data?.floorplan) setTables(data.floorplan); });
  }, [selEventId]);

  const placeTable = (col, row) => {
    if (!dragType) return;
    const type = TABLE_TYPES.find(t => t.id === dragType);
    if (!type) return;
    // Check no overlap
    const conflicts = tables.some(t => {
      const tr = TABLE_TYPES.find(x => x.id === t.typeId) || { w:1, h:1 };
      return col < t.col + tr.w && col + type.w > t.col && row < t.row + tr.h && row + type.h > t.row;
    });
    if (conflicts) return;
    const num = tables.filter(t => t.typeId === dragType).length + 1;
    setTables(ts => [...ts, { id: Date.now(), typeId: dragType, col, row, label: `${type.label} ${num}` }]);
    setDragType(null);
  };

  const removeTable = (id) => { setTables(ts => ts.filter(t => t.id !== id)); setSelTable(null); };

  const saveFloorplan = async () => {
    if (!selEventId) return;
    setSaving(true);
    await supabase.from('events').update({ floorplan: tables }).eq('id', selEventId);
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const totalSeats = tables.reduce((s, t) => s + (TABLE_TYPES.find(x => x.id === t.typeId)?.seats || 0), 0);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Topbar title="Floorplan builder" subtitle="Design venue table layouts per event" />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: C.white, borderBottom: `1px solid ${C.border}`, flexShrink: 0, flexWrap: 'wrap' }}>
        <select value={selEventId} onChange={e => setSelEventId(e.target.value)}
          style={{ padding: '7px 10px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, outline: 'none', color: C.ink, background: C.white, minWidth: 220 }}>
          <option value="">— Select an event —</option>
          {events.map(ev => (
            <option key={ev.id} value={ev.id}>{ev.clients?.name || 'Unknown'} · {ev.event_date ? new Date(ev.event_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</option>
          ))}
        </select>
        {selEventId && (
          <>
            <span style={{ fontSize: 12, color: C.gray }}>{tables.length} tables · {totalSeats} seats</span>
            <button onClick={() => setTables([])} style={{ padding: '5px 12px', borderRadius: 7, border: `1px solid var(--color-danger)`, background: '#fff', color: 'var(--color-danger)', fontSize: 12, cursor: 'pointer', minHeight: 'unset', minWidth: 'unset', marginLeft: 'auto' }}>Clear all</button>
            <button onClick={saveFloorplan} disabled={saving}
              style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: saved ? '#15803D' : C.rosa, color: '#fff', fontSize: 12, fontWeight: 500, cursor: 'pointer', minHeight: 'unset', minWidth: 'unset' }}>
              {saved ? '✓ Saved!' : saving ? 'Saving…' : 'Save layout'}
            </button>
          </>
        )}
      </div>

      {!selEventId ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: C.gray }}>
          <div style={{ fontSize: 40 }}>🗺️</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: C.ink }}>Select an event to start designing</div>
          <div style={{ fontSize: 12, color: C.gray }}>Choose from the dropdown above to load or create a floorplan.</div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Palette */}
          <div style={{ width: 160, borderRight: `1px solid ${C.border}`, padding: 10, overflowY: 'auto', flexShrink: 0, background: C.ivory }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.gray, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Drag to place</div>
            {TABLE_TYPES.map(t => (
              <div key={t.id}
                draggable
                onDragStart={() => setDragType(t.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', marginBottom: 4, borderRadius: 7, border: `1px solid ${C.border}`, background: dragType === t.id ? C.rosaPale : C.white, cursor: 'grab', fontSize: 11, color: C.ink, userSelect: 'none' }}>
                <div style={{ width: 20, height: 20, borderRadius: t.shape === 'circle' ? '50%' : 4, background: t.color, border: `1px solid ${C.border}`, flexShrink: 0 }}/>
                <div>
                  <div style={{ fontWeight: 500 }}>{t.label}</div>
                  {t.seats > 0 && <div style={{ color: C.gray, fontSize: 10 }}>{t.seats} seats</div>}
                </div>
              </div>
            ))}
            {selTable && (
              <div style={{ marginTop: 12, padding: 10, background: C.white, border: `1px solid ${C.border}`, borderRadius: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.ink, marginBottom: 6 }}>Selected: {selTable.label}</div>
                <input value={selTable.label} onChange={e => { const lbl = e.target.value; setSelTable(s => ({ ...s, label: lbl })); setTables(ts => ts.map(t => t.id === selTable.id ? { ...t, label: lbl } : t)); }}
                  style={{ width: '100%', padding: '5px 7px', borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 11, outline: 'none', boxSizing: 'border-box', marginBottom: 6 }} />
                <button onClick={() => removeTable(selTable.id)}
                  style={{ width: '100%', padding: '5px 0', borderRadius: 6, border: `1px solid var(--color-danger)`, background: '#fff', color: 'var(--color-danger)', fontSize: 11, cursor: 'pointer', minHeight: 'unset', minWidth: 'unset' }}>
                  🗑 Remove
                </button>
              </div>
            )}
          </div>

          {/* Grid canvas */}
          <div style={{ flex: 1, overflowAuto: 'scroll', padding: 16, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-start' }}>
            <div ref={gridRef}
              style={{ display: 'grid', gridTemplateColumns: `repeat(${COLS}, ${CELL}px)`, gridTemplateRows: `repeat(${ROWS}, ${CELL}px)`, gap: 0, border: `1px solid ${C.border}`, background: '#FAFAFA', position: 'relative', cursor: dragType ? 'crosshair' : 'default' }}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault();
                const rect = gridRef.current.getBoundingClientRect();
                const col = Math.floor((e.clientX - rect.left) / CELL);
                const row = Math.floor((e.clientY - rect.top) / CELL);
                placeTable(Math.max(0, Math.min(col, COLS - 1)), Math.max(0, Math.min(row, ROWS - 1)));
              }}>
              {/* Grid cells */}
              {Array.from({ length: ROWS * COLS }, (_, i) => (
                <div key={i} style={{ width: CELL, height: CELL, border: '0.5px solid #E5E7EB' }}/>
              ))}
              {/* Tables */}
              {tables.map(t => {
                const type = TABLE_TYPES.find(x => x.id === t.typeId) || TABLE_TYPES[0];
                const isSel = selTable?.id === t.id;
                return (
                  <div key={t.id}
                    onClick={() => setSelTable(isSel ? null : t)}
                    style={{
                      position: 'absolute',
                      left: t.col * CELL + 3, top: t.row * CELL + 3,
                      width: type.w * CELL - 6, height: type.h * CELL - 6,
                      borderRadius: type.shape === 'circle' ? '50%' : 6,
                      background: type.color || C.rosaPale,
                      border: `2px solid ${isSel ? C.rosa : C.border}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', userSelect: 'none', textAlign: 'center',
                      boxShadow: isSel ? `0 0 0 2px ${C.rosa}44` : '0 1px 3px rgba(0,0,0,0.08)',
                      transition: 'border 0.1s',
                    }}>
                    <div>
                      <div style={{ fontSize: 9, fontWeight: 600, color: type.textColor || C.ink, lineHeight: 1.2 }}>{t.label}</div>
                      {type.seats > 0 && <div style={{ fontSize: 8, color: type.textColor || C.gray, opacity: 0.8 }}>{type.seats} seats</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


// ─── POS SCREEN ────────────────────────────────────────────────────────────
const DEFAULT_ITEMS = [
  // Zone 1 — Rentals
  { id: 'dress_rental',  zone: 'rentals',   label: 'Dress Rental',   defaultPrice: 150 },
  { id: 'veil_rental',   zone: 'rentals',   label: 'Veil Rental',    defaultPrice: 25  },
  { id: 'jewelry_rental',zone: 'rentals',   label: 'Jewelry Rental', defaultPrice: 15  },
  // Zone 2 — Services
  { id: 'alterations',   zone: 'services',  label: 'Alterations',    defaultPrice: 80  },
  { id: 'fitting',       zone: 'services',  label: 'Fitting',        defaultPrice: 30  },
  { id: 'consultation',  zone: 'services',  label: 'Consultation',   defaultPrice: 0   },
  // Zone 3 — Add-ons
  { id: 'cleaning',      zone: 'addons',    label: 'Cleaning Fee',   defaultPrice: 20  },
  { id: 'late_fee',      zone: 'addons',    label: 'Late Fee',       defaultPrice: 25  },
  { id: 'deposit',       zone: 'addons',    label: 'Deposit',        defaultPrice: 100 },
  { id: 'custom',        zone: 'addons',    label: 'Custom Amount',  defaultPrice: 0   },
];

const ZONES = {
  rentals:  { label: 'Rentals',  bg: '#FDF5F6', accent: '#C9697A' },
  services: { label: 'Services', bg: '#EFF6FF', accent: '#1D4ED8' },
  addons:   { label: 'Add-ons',  bg: '#F0FDF4', accent: '#15803D' },
};

const PAYMENT_METHODS = ['Cash', 'Card', 'Zelle', 'Venmo', 'Check'];

export const POSScreen = () => {
  const { boutique } = useAuth();

  // Price overrides per button (controlled inputs)
  const [prices, setPrices] = useState(() =>
    Object.fromEntries(DEFAULT_ITEMS.map(item => [item.id, item.defaultPrice]))
  );

  // Cart: array of { uid, id, label, price }
  const [cart, setCart] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [clientName, setClientName] = useState('');

  // Custom amount modal
  const [customOpen, setCustomOpen] = useState(false);
  const [customDesc, setCustomDesc] = useState('');
  const [customAmt, setCustomAmt] = useState('');

  // Success / error state
  const [charged, setCharged] = useState(null); // null | { total, method }
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const subtotal = cart.reduce((sum, i) => sum + i.price, 0);

  function handleAddItem(item) {
    if (item.id === 'custom') {
      setCustomOpen(true);
      return;
    }
    setCart(c => [...c, { uid: Date.now() + Math.random(), id: item.id, label: item.label, price: prices[item.id] }]);
    setError('');
  }

  function handleRemoveItem(uid) {
    setCart(c => c.filter(i => i.uid !== uid));
  }

  function handleAddCustom() {
    const amt = parseFloat(customAmt);
    if (isNaN(amt) || amt <= 0) return;
    const desc = customDesc.trim() || 'Custom Amount';
    setCart(c => [...c, { uid: Date.now() + Math.random(), id: 'custom', label: desc, price: amt }]);
    setCustomOpen(false);
    setCustomDesc('');
    setCustomAmt('');
    setError('');
  }

  async function handleCharge() {
    if (cart.length === 0) {
      setError('Add items to charge');
      return;
    }
    setError('');
    setSaving(true);

    // Log to client_interactions if client name provided
    if (clientName.trim() && boutique?.id) {
      const itemsBody = cart.map(i => `• ${i.label} — $${i.price.toFixed(2)}`).join('\n');
      await supabase.from('client_interactions').insert({
        boutique_id: boutique.id,
        type: 'pos_sale',
        title: `POS Sale — $${subtotal.toFixed(2)}`,
        body: `Client: ${clientName.trim()}\nPayment: ${paymentMethod}\n\nItems:\n${itemsBody}`,
        occurred_at: new Date().toISOString(),
        author_name: 'POS Register',
        is_editable: false,
      });
    }

    setSaving(false);
    setCharged({ total: subtotal, method: paymentMethod });
  }

  function handleNewSale() {
    setCart([]);
    setClientName('');
    setPaymentMethod('Cash');
    setCharged(null);
    setError('');
  }

  // Shared button style helper
  const serviceBtn = (zone) => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 6,
    background: ZONES[zone].bg,
    border: `1.5px solid ${ZONES[zone].accent}22`,
    borderRadius: 10,
    padding: '12px 14px',
    cursor: 'pointer',
    minHeight: 72,
    transition: 'box-shadow 0.15s, transform 0.1s',
  });

  const zoneItems = (zone) => DEFAULT_ITEMS.filter(i => i.zone === zone);

  if (charged) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.grayBg }}>
        <Topbar title="Point of Sale" subtitle="In-store register" />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 16, padding: 48, textAlign: 'center', maxWidth: 420, width: '100%', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: C.greenBg, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 28 }}>✓</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.ink, marginBottom: 8 }}>Payment received</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: C.green, marginBottom: 6 }}>${charged.total.toFixed(2)}</div>
            <div style={{ fontSize: 15, color: C.gray, marginBottom: 32 }}>via {charged.method}{clientName.trim() ? ` · ${clientName.trim()}` : ''}</div>
            <button
              onClick={handleNewSale}
              style={{ background: C.rosa, color: C.white, border: 'none', borderRadius: 10, padding: '14px 36px', fontSize: 16, fontWeight: 600, cursor: 'pointer', minHeight: 52 }}
            >
              New sale
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.grayBg, overflow: 'hidden' }}>
      <Topbar title="Point of Sale" subtitle="In-store register" />

      {/* Custom amount modal */}
      {customOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: C.white, borderRadius: 14, padding: 32, width: 340, boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>
            <div style={{ fontSize: 17, fontWeight: 600, color: C.ink, marginBottom: 20 }}>Custom Amount</div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: C.gray, marginBottom: 5 }}>Description</div>
              <input
                value={customDesc}
                onChange={e => setCustomDesc(e.target.value)}
                placeholder="e.g. Accessory sale"
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 14, color: C.ink, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12, color: C.gray, marginBottom: 5 }}>Amount ($)</div>
              <input
                type="number"
                min="0"
                step="0.01"
                value={customAmt}
                onChange={e => setCustomAmt(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddCustom()}
                placeholder="0.00"
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 18, fontWeight: 600, color: C.ink, outline: 'none', boxSizing: 'border-box' }}
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setCustomOpen(false); setCustomDesc(''); setCustomAmt(''); }} style={{ flex: 1, padding: '12px 0', borderRadius: 8, border: `1px solid ${C.border}`, background: C.white, color: C.gray, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleAddCustom} style={{ flex: 1, padding: '12px 0', borderRadius: 8, border: 'none', background: C.rosa, color: C.white, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Add to cart</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* LEFT PANEL — service buttons */}
        <div style={{ flex: '0 0 60%', overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {Object.entries(ZONES).map(([zoneKey, zone]) => (
            <div key={zoneKey} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
              {/* Zone header */}
              <div style={{ padding: '12px 18px', background: zone.bg, borderBottom: `1px solid ${zone.accent}22`, display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: zone.accent }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: zone.accent, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{zone.label}</span>
              </div>
              {/* Buttons grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, padding: 16 }}>
                {zoneItems(zoneKey).map(item => (
                  <div
                    key={item.id}
                    style={serviceBtn(zoneKey)}
                    onClick={() => handleAddItem(item)}
                    onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 2px 12px ${zone.accent}33`; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)'; }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.ink, lineHeight: 1.3 }}>{item.label}</span>
                    {item.id !== 'custom' ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }} onClick={e => e.stopPropagation()}>
                        <span style={{ fontSize: 12, color: C.gray }}>$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={prices[item.id]}
                          onChange={e => setPrices(p => ({ ...p, [item.id]: parseFloat(e.target.value) || 0 }))}
                          style={{ width: 62, padding: '3px 6px', borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 13, color: C.ink, outline: 'none', background: 'rgba(255,255,255,0.8)' }}
                        />
                      </div>
                    ) : (
                      <span style={{ fontSize: 12, color: zone.accent, fontWeight: 500 }}>Tap to enter</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* RIGHT PANEL — cart + checkout */}
        <div style={{ flex: '0 0 40%', display: 'flex', flexDirection: 'column', borderLeft: `1px solid ${C.border}`, background: C.white, overflow: 'hidden' }}>

          {/* Cart header */}
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: C.ink }}>Cart</span>
            {cart.length > 0 && (
              <button
                onClick={() => setCart([])}
                style={{ fontSize: 12, color: C.gray, background: 'none', border: `1px solid ${C.border}`, borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}
              >
                Clear
              </button>
            )}
          </div>

          {/* Cart items */}
          <div style={{ flex: 1, overflowY: 'auto', padding: cart.length === 0 ? 0 : '8px 0' }}>
            {cart.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 10, color: C.gray }}>
                <div style={{ fontSize: 36 }}>🛒</div>
                <div style={{ fontSize: 13 }}>No items — tap a service to add</div>
              </div>
            ) : (
              cart.map(item => (
                <div key={item.uid} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 20px', borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ fontSize: 14, color: C.ink, flex: 1 }}>{item.label}</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: C.ink, marginRight: 12 }}>${item.price.toFixed(2)}</span>
                  <button
                    onClick={() => handleRemoveItem(item.uid)}
                    style={{ width: 28, height: 28, borderRadius: '50%', border: `1px solid ${C.border}`, background: C.white, color: C.gray, cursor: 'pointer', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, lineHeight: 1 }}
                    title="Remove"
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Checkout footer */}
          <div style={{ padding: 20, borderTop: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Subtotal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14, color: C.gray, fontWeight: 500 }}>Subtotal</span>
              <span style={{ fontSize: 22, fontWeight: 700, color: C.ink }}>${subtotal.toFixed(2)}</span>
            </div>

            {/* Payment method */}
            <div>
              <div style={{ fontSize: 12, color: C.gray, marginBottom: 8, fontWeight: 500 }}>Payment method</div>
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                {PAYMENT_METHODS.map(m => (
                  <button
                    key={m}
                    onClick={() => setPaymentMethod(m)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 999,
                      border: `1.5px solid ${paymentMethod === m ? C.rosa : C.border}`,
                      background: paymentMethod === m ? C.rosaPale : C.white,
                      color: paymentMethod === m ? C.rosa : C.gray,
                      fontSize: 13,
                      fontWeight: paymentMethod === m ? 600 : 400,
                      cursor: 'pointer',
                      minHeight: 36,
                      transition: 'all 0.15s',
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Client name */}
            <div>
              <div style={{ fontSize: 12, color: C.gray, marginBottom: 6, fontWeight: 500 }}>Client name (optional)</div>
              <input
                value={clientName}
                onChange={e => setClientName(e.target.value)}
                placeholder="e.g. Maria García"
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 14, color: C.ink, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            {/* Error */}
            {error && (
              <div style={{ fontSize: 13, color: C.red, background: C.redBg, borderRadius: 7, padding: '8px 12px', fontWeight: 500 }}>
                {error}
              </div>
            )}

            {/* Charge button */}
            <button
              onClick={handleCharge}
              disabled={saving}
              style={{
                background: C.rosa,
                color: C.white,
                border: 'none',
                borderRadius: 12,
                padding: '16px 0',
                fontSize: 17,
                fontWeight: 700,
                cursor: saving ? 'wait' : 'pointer',
                opacity: saving ? 0.7 : 1,
                minHeight: 56,
                transition: 'opacity 0.15s',
                letterSpacing: '0.01em',
              }}
            >
              {saving ? 'Processing…' : `Charge $${subtotal.toFixed(2)}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const RetailScreen = () => (
  <Stub
    title="Retail"
    subtitle="Product & accessory sales"
    icon="🛍️"
    description="Sell accessories, veils, and boutique merchandise. Track stock, set prices, and connect sales to client profiles."
    features={['Product catalog management', 'Stock level tracking', 'Sales history per client', 'Bundle & discount pricing']}
  />
);

const APPT_COLORS = {
  fitting: { bg: '#EDE9FE', col: '#7C3AED' },
  pickup: { bg: '#DCFCE7', col: '#16A34A' },
  return: { bg: '#FEE2E2', col: '#DC2626' },
  consultation: { bg: '#FEF3C7', col: '#D97706' },
  delivery: { bg: '#DBEAFE', col: '#2563EB' },
  alteration: { bg: '#FEF9C3', col: '#A16207' },
  default: { bg: '#FDF5F6', col: '#C9697A' },
};

function isoDate(d) { return d.toISOString().split('T')[0]; }

export const StaffScheduleScreen = () => {
  const { boutique } = useAuth();
  const [staff, setStaff] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [loading, setLoading] = useState(true);

  const weekDays = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + weekOffset * 7);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day; // Monday
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
      const wd = new Date(d);
      wd.setDate(d.getDate() + i);
      return wd;
    });
  }, [weekOffset]);

  useEffect(() => {
    if (!boutique?.id) return;
    supabase.from('boutique_members').select('id,name,initials,color,role').eq('boutique_id', boutique.id)
      .then(({ data }) => { if (data) setStaff(data); });
  }, [boutique?.id]);

  useEffect(() => {
    if (!boutique?.id || weekDays.length === 0) return;
    const from = isoDate(weekDays[0]);
    const to = isoDate(weekDays[6]);
    supabase.from('appointments').select('id,type,date,time,note,status,staff_id,event_id')
      .gte('date', from).lte('date', to)
      .then(({ data }) => { if (data) setAppointments(data); setLoading(false); });
  }, [boutique?.id, weekDays]);

  const today = isoDate(new Date());

  function ApptPill({ a }) {
    const key = (a.type || '').toLowerCase().replace(/\s+/g, '').slice(0, 12);
    const found = Object.keys(APPT_COLORS).find(k => key.includes(k));
    const col = APPT_COLORS[found] || APPT_COLORS.default;
    return (
      <div title={a.note || a.type} style={{ background: col.bg, color: col.col, borderRadius: 4, padding: '3px 6px', fontSize: 10, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'default' }}>
        {a.time ? a.time.slice(0, 5) + ' · ' : ''}{a.type}
      </div>
    );
  }

  const unassigned = appointments.filter(a => !a.staff_id);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Topbar title="Staff scheduling" subtitle="Weekly appointment overview" />

      {/* Week nav */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: C.white, borderBottom: `1px solid ${C.border}`, flexShrink: 0, flexWrap: 'wrap' }}>
        <button onClick={() => setWeekOffset(o => o - 1)}
          style={{ width: 30, height: 30, borderRadius: 7, border: `1px solid ${C.border}`, background: C.white, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none"><path d="M10 4L6 8l4 4" stroke={C.gray} strokeWidth="1.8" strokeLinecap="round"/></svg>
        </button>
        <button onClick={() => setWeekOffset(0)}
          style={{ padding: '5px 12px', borderRadius: 7, border: `1px solid ${weekOffset === 0 ? C.rosa : C.border}`, background: weekOffset === 0 ? C.rosaPale : C.white, color: weekOffset === 0 ? C.rosa : C.gray, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
          This week
        </button>
        <button onClick={() => setWeekOffset(o => o + 1)}
          style={{ width: 30, height: 30, borderRadius: 7, border: `1px solid ${C.border}`, background: C.white, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke={C.gray} strokeWidth="1.8" strokeLinecap="round"/></svg>
        </button>
        <span style={{ fontSize: 13, fontWeight: 500, color: C.ink }}>
          {weekDays[0]?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – {weekDays[6]?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: C.gray }}>{appointments.length} appt{appointments.length !== 1 ? 's' : ''} this week</span>
      </div>

      {/* Grid */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
        <div style={{ minWidth: 700 }}>
          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '130px repeat(7, 1fr)', background: C.white, borderBottom: `1px solid ${C.border}`, position: 'sticky', top: 0, zIndex: 2 }}>
            <div style={{ padding: '9px 12px', fontSize: 10, fontWeight: 700, color: C.gray, letterSpacing: '0.06em', borderRight: `1px solid ${C.border}` }}>STAFF</div>
            {weekDays.map((d, i) => {
              const iso = isoDate(d);
              const isToday = iso === today;
              return (
                <div key={i} style={{ padding: '6px 8px', textAlign: 'center', borderRight: i < 6 ? `1px solid ${C.border}` : 'none', background: isToday ? C.rosaPale : 'transparent' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: isToday ? C.rosa : C.gray, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{d.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: isToday ? C.rosa : C.ink, lineHeight: 1.2 }}>{d.getDate()}</div>
                </div>
              );
            })}
          </div>

          {/* Staff rows */}
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: C.gray, fontSize: 13 }}>Loading schedule…</div>
          ) : staff.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: C.gray, fontSize: 13 }}>No staff found. Invite team members in Settings → Staff.</div>
          ) : (
            <>
              {staff.map(member => (
                <div key={member.id} style={{ display: 'grid', gridTemplateColumns: '130px repeat(7, 1fr)', borderBottom: `1px solid ${C.border}`, minHeight: 64 }}>
                  <div style={{ padding: '8px 10px', borderRight: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 7, background: C.ivory }}>
                    <div style={{ width: 26, height: 26, borderRadius: '50%', background: member.color || C.rosa, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, flexShrink: 0 }}>
                      {member.initials || (member.name || '?').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 80 }}>{member.name || 'Staff'}</div>
                      <div style={{ fontSize: 10, color: C.gray, textTransform: 'capitalize' }}>{member.role}</div>
                    </div>
                  </div>
                  {weekDays.map((d, di) => {
                    const iso = isoDate(d);
                    const isToday = iso === today;
                    const dayAppts = appointments.filter(a => a.date === iso && a.staff_id === member.id);
                    return (
                      <div key={di} style={{ padding: '5px 6px', borderRight: di < 6 ? `1px solid ${C.border}` : 'none', background: isToday ? '#FFFBF5' : 'transparent', display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {dayAppts.map(a => <ApptPill key={a.id} a={a} />)}
                      </div>
                    );
                  })}
                </div>
              ))}

              {/* Unassigned row */}
              {unassigned.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '130px repeat(7, 1fr)', borderBottom: `1px solid ${C.border}`, minHeight: 52 }}>
                  <div style={{ padding: '8px 10px', borderRight: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', background: C.ivory }}>
                    <span style={{ fontSize: 11, color: C.gray, fontStyle: 'italic' }}>Unassigned</span>
                  </div>
                  {weekDays.map((d, di) => {
                    const iso = isoDate(d);
                    const isToday = iso === today;
                    const dayAppts = unassigned.filter(a => a.date === iso);
                    return (
                      <div key={di} style={{ padding: '5px 6px', borderRight: di < 6 ? `1px solid ${C.border}` : 'none', background: isToday ? '#FFFBF5' : 'transparent', display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {dayAppts.map(a => <ApptPill key={a.id} a={a} />)}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// AuditLogScreen — real implementation lazy-loaded from AuditLog.jsx
const _AuditLogPage = React.lazy(() => import('./AuditLog'));

export const AuditLogScreen = (props) => (
  <React.Suspense fallback={<div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.gray, fontSize: 13 }}>Loading…</div>}>
    <_AuditLogPage {...props} />
  </React.Suspense>
);

// WaitlistScreen — real implementation lazy-loaded from WaitlistPage.jsx
const _WaitlistPage = React.lazy(() => import('./WaitlistPage'));
export const WaitlistScreen = (props) => (
  <React.Suspense fallback={<div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',color:'#6B7280',fontSize:13}}>Loading…</div>}>
    <_WaitlistPage {...props} />
  </React.Suspense>
);

// PhotoGalleryScreen — real implementation lazy-loaded from PhotoGalleryPage.jsx
const _PhotoGalleryPage = React.lazy(() => import('./PhotoGalleryPage'));
export const PhotoGalleryScreen = (props) => (
  <React.Suspense fallback={<div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,color:'#6B7280'}}>Loading…</div>}>
    <_PhotoGalleryPage {...props} />
  </React.Suspense>
);

export const EmailMarketingScreen = () => (
  <Stub
    title="Email marketing"
    subtitle="Campaigns & newsletters"
    icon="📣"
    description="Send newsletters, promotions, and seasonal campaigns to your client list. Track open rates and manage unsubscribes."
    features={['Drag-and-drop email builder', 'Segmented client lists', 'Open & click tracking', 'Unsubscribe management']}
    planBadge="Growth"
  />
);

export const TicketingScreen = () => (
  <Stub
    title="Registration & ticketing"
    subtitle="Events, trunk shows & workshops"
    icon="🎟️"
    description="Sell tickets and manage registrations for trunk shows, bridal expos, and in-store workshops."
    features={['Ticket types & pricing', 'Online registration page', 'QR code check-in', 'Attendee management']}
    planBadge="Growth"
  />
);

// ReviewsScreen — real implementation lazy-loaded from ReviewsPage.jsx
const _ReviewsPage = React.lazy(() => import('./ReviewsPage'));
export const ReviewsScreen = (props) => (
  <React.Suspense fallback={<div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,color:'#6B7280'}}>Loading…</div>}>
    <_ReviewsPage {...props} />
  </React.Suspense>
);

// OnlinePaymentsScreen — real implementation lazy-loaded from OnlinePaymentsPage.jsx
const _OnlinePaymentsPage = React.lazy(() => import('./OnlinePaymentsPage'));
export const OnlinePaymentsScreen = (props) => (
  <React.Suspense fallback={<div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,color:'#6B7280'}}>Loading…</div>}>
    <_OnlinePaymentsPage {...props} />
  </React.Suspense>
);

// ExpensesScreen — real implementation lazy-loaded from Expenses.jsx
const _ExpensesPage = React.lazy(() => import('./Expenses'));

export const ExpensesScreen = (props) => (
  <React.Suspense fallback={<div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',color:'#6B7280',fontSize:13}}>Loading…</div>}>
    <_ExpensesPage {...props} />
  </React.Suspense>
);


export const AccountingScreen = ({ payments = [], events = [] }) => {
  const [exporting, setExporting] = React.useState(false);

  // Financial calculations
  const totalCollected = payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + Number(p.amount), 0);
  const totalPending = payments.filter(p => p.status !== 'paid').reduce((sum, p) => sum + Number(p.amount), 0);
  const overdue = payments.filter(p => p.status !== 'paid' && new Date(p.due_date) < new Date()).reduce((sum, p) => sum + Number(p.amount), 0);

  const handleExportCSV = () => {
    setExporting(true);
    setTimeout(() => {
      const headers = ['Milestone ID', 'Event', 'Client', 'Amount', 'Status', 'Due Date', 'Paid Date'];
      const rows = payments.map(p => {
        const ev = events.find(e => e.id === p.event_id);
        const clientName = ev?.client?.name || 'Unknown Client';
        return [
          p.id, ev?.type || 'Event', clientName, (p.amount/100).toFixed(2), p.status, p.due_date || '', p.paid_date || ''
        ].map(v => `"${v}"`).join(',');
      });
      const csvContent = [headers.join(','), ...rows].join('\\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', `belori_accounting_export_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setExporting(false);
    }, 600);
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.grayBg }}>
      <Topbar title="Accounting & Export" subtitle="Financial overview and data export" />
      <div className="page-scroll" style={{ flex: 1, overflowY: 'auto', padding: 32 }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          
          <div className="stat-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 32 }}>
            <div style={{ background: C.white, padding: 24, borderRadius: 12, border: `1px solid ${C.border}`, boxShadow: 'var(--card-shadow, 0 2px 4px rgba(0,0,0,0.02))' }}>
              <div style={{ fontSize: 13, color: C.gray, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Total Collected</div>
              <div style={{ fontSize: 32, fontWeight: 700, color: C.ink }}>${(totalCollected/100).toLocaleString('en-US',{minimumFractionDigits:2})}</div>
            </div>
            <div style={{ background: C.white, padding: 24, borderRadius: 12, border: `1px solid ${C.border}`, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
              <div style={{ fontSize: 13, color: C.gray, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Pending Balance</div>
              <div style={{ fontSize: 32, fontWeight: 700, color: C.ink }}>${(totalPending/100).toLocaleString('en-US',{minimumFractionDigits:2})}</div>
            </div>
            <div style={{ background: C.white, padding: 24, borderRadius: 12, border: `1px solid ${C.border}`, borderLeft: `4px solid var(--color-danger)`, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
              <div style={{ fontSize: 13, color: 'var(--color-danger)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Overdue</div>
              <div style={{ fontSize: 32, fontWeight: 700, color: C.ink }}>${(overdue/100).toLocaleString('en-US',{minimumFractionDigits:2})}</div>
            </div>
          </div>

          <div style={{ background: C.white, borderRadius: 12, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: C.ink }}>QuickBooks / Xero Export</div>
                <div style={{ fontSize: 13, color: C.gray, marginTop: 4 }}>Generate a CSV of all payments suitable for import into standard accounting software.</div>
              </div>
              <button onClick={handleExportCSV} disabled={exporting} style={{ background: C.rosa, color: C.white, border: 'none', padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: exporting?'wait':'pointer', opacity: exporting?0.7:1, display: 'flex', alignItems: 'center', gap: 8 }}>
                {exporting ? 'Generating...' : 'Download CSV'} <span>📥</span>
              </button>
            </div>
            <div style={{ padding: 24, background: '#fafafa', fontSize: 13, color: C.gray, lineHeight: 1.6 }}>
              <strong>Included fields:</strong> Milestone ID, Event Type, Client Name, Amount, Status, Due Date, and Paid Date.
              <br/><br/>
              <em>Note: To import to QuickBooks Online, map "Paid Date" to Date, "Client Name" to Description, and "Amount" to Amount.</em>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
