import React, { useState, useMemo } from 'react';
import { C, fmt } from '../lib/colors';
import { Topbar, GhostBtn, PrimaryBtn, inputSt } from '../lib/ui.jsx';
import { useAuth } from '../context/AuthContext';
import { useWeddingPlan } from '../hooks/useWeddingPlan';
import { DEFAULT_BUDGET_CATEGORIES } from '../lib/weddingDefaults';

// ─── Colors ────────────────────────────────────────────────────────────────
const rosa   = '#C9697A';
const rp     = '#FDF5F6';
const ink    = '#1C1012';
const gray   = '#7A6A6C';
const border = '#EDE0E2';
const white  = '#FFFFFF';
const green  = '#4CAF50';
const amber  = '#F59E0B';
const red    = '#EF4444';

// ─── Phase labels ──────────────────────────────────────────────────────────
const PHASE_LABELS = {
  '12_months':     '12 Months Before',
  '11_10_months':  '11–10 Months Before',
  '9_8_months':    '9–8 Months Before',
  '6_5_months':    '6–5 Months Before',
  '3_2_months':    '3–2 Months Before',
  'month_of':      'Month Of',
  'week_of':       'Week Of',
};

const ROS_PHASE_LABELS = {
  morning: 'Morning / Getting Ready',
  ceremony: 'Ceremony',
  cocktail: 'Cocktail Hour',
  reception: 'Reception',
  end_of_night: 'End of Night',
};

const MUSIC_MOMENT_LABELS = {
  processional:        'Processional',
  bridal_processional: 'Bridal Processional',
  recessional:         'Recessional',
  entrance:            'Grand Entrance',
  first_dance:         'First Dance',
  father_daughter:     'Father / Daughter Dance',
  mother_son:          'Mother / Son Dance',
  party_starter:       'Party Starter',
  bouquet_toss:        'Bouquet Toss',
  cake_cutting:        'Cake Cutting',
  last_song:           'Last Song',
};

const VENDOR_CATEGORIES = [
  'Venue','Catering','Photography','Videography','Florist','DJ','Band',
  'Officiant','Hair & Makeup','Transportation','Cake','Lighting','Rentals','Other',
];

const TABS = [
  { id: 'overview',   label: 'Overview',      icon: '💍' },
  { id: 'checklist',  label: 'Checklist',     icon: '✅' },
  { id: 'budget',     label: 'Budget',        icon: '💰' },
  { id: 'guests',     label: 'Guests',        icon: '👥' },
  { id: 'vendors',    label: 'Vendors',       icon: '🤝' },
  { id: 'runofshow',  label: 'Run of Show',   icon: '📋' },
  { id: 'music',      label: 'Music',         icon: '🎵' },
  { id: 'gifts',      label: 'Gifts',         icon: '🎁' },
  { id: 'legal',      label: 'Legal',         icon: '⚖️' },
];

// ─── Helpers ───────────────────────────────────────────────────────────────
function Card({ children, style }) {
  return (
    <div style={{ background: white, border: `1px solid ${border}`, borderRadius: 12, padding: 20, ...style }}>
      {children}
    </div>
  );
}

function SectionHead({ title, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: ink }}>{title}</div>
      {action}
    </div>
  );
}

function Chip({ label, color = rosa }) {
  return (
    <span style={{ display: 'inline-block', background: `${color}18`, color, border: `1px solid ${color}40`,
      borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 500 }}>
      {label}
    </span>
  );
}

function Checkbox({ checked, onChange, label, sub }) {
  return (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', padding: '8px 0',
      borderBottom: `1px solid ${border}` }}>
      <div onClick={onChange} style={{
        width: 18, height: 18, borderRadius: 4, flexShrink: 0, marginTop: 1,
        background: checked ? rosa : white,
        border: `2px solid ${checked ? rosa : border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
      }}>
        {checked && <span style={{ color: white, fontSize: 11, fontWeight: 700 }}>✓</span>}
      </div>
      <div>
        <div style={{ fontSize: 13, color: checked ? gray : ink, textDecoration: checked ? 'line-through' : 'none' }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: gray, marginTop: 2 }}>{sub}</div>}
      </div>
    </label>
  );
}

function Inp({ value, onChange, placeholder, type = 'text', style }) {
  return (
    <input value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      type={type} style={{ ...inputSt, fontSize: 13, ...style }} />
  );
}

// ─── Overview Tab ──────────────────────────────────────────────────────────
function OverviewTab({ plan, updatePlan, event }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});

  const eventDate = event?.event_date ? new Date(event.event_date) : null;
  const daysUntil = eventDate ? Math.ceil((eventDate - new Date()) / 86400000) : null;

  function startEdit() { setForm({ ...plan }); setEditing(true); }
  async function save() {
    await updatePlan({
      partner_1_name: form.partner_1_name,
      partner_2_name: form.partner_2_name,
      wedding_motto: form.wedding_motto,
      nuclear_option: form.nuclear_option,
      total_budget: Number(form.total_budget) || 0,
      guest_count: Number(form.guest_count) || 0,
      partner_1_priorities: form.partner_1_priorities,
      partner_2_priorities: form.partner_2_priorities,
      partner_1_not_important: form.partner_1_not_important,
      partner_2_not_important: form.partner_2_not_important,
    });
    setEditing(false);
  }

  function parseList(str) { return str.split(',').map(s => s.trim()).filter(Boolean); }
  function joinList(arr) { return (arr || []).join(', '); }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Countdown */}
      {daysUntil !== null && (
        <Card style={{ background: `linear-gradient(135deg, ${rosa}18 0%, ${rp} 100%)`, textAlign: 'center' }}>
          <div style={{ fontSize: 48, fontWeight: 700, color: rosa, lineHeight: 1 }}>{Math.max(0, daysUntil)}</div>
          <div style={{ fontSize: 14, color: gray, marginTop: 4 }}>
            {daysUntil <= 0 ? 'The big day has arrived!' : `days until the wedding`}
          </div>
          {eventDate && (
            <div style={{ fontSize: 12, color: gray, marginTop: 4 }}>
              {eventDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
          )}
        </Card>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Couple Info */}
        <Card>
          <SectionHead title="Couple" action={
            !editing
              ? <GhostBtn onClick={startEdit} style={{ fontSize: 12, padding: '4px 10px' }}>Edit</GhostBtn>
              : <div style={{ display: 'flex', gap: 8 }}>
                  <GhostBtn onClick={() => setEditing(false)} style={{ fontSize: 12, padding: '4px 10px' }}>Cancel</GhostBtn>
                  <PrimaryBtn onClick={save} style={{ fontSize: 12, padding: '4px 12px' }}>Save</PrimaryBtn>
                </div>
          } />
          {editing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Inp value={form.partner_1_name} onChange={v => setForm(f => ({ ...f, partner_1_name: v }))} placeholder="Partner 1 name" />
              <Inp value={form.partner_2_name} onChange={v => setForm(f => ({ ...f, partner_2_name: v }))} placeholder="Partner 2 name" />
              <Inp value={form.wedding_motto} onChange={v => setForm(f => ({ ...f, wedding_motto: v }))} placeholder="Wedding motto / vision" />
              <Inp value={form.nuclear_option} onChange={v => setForm(f => ({ ...f, nuclear_option: v }))} placeholder="Nuclear option (elope plan B)" />
              <Inp value={form.total_budget} onChange={v => setForm(f => ({ ...f, total_budget: v }))} placeholder="Total budget" type="number" />
              <Inp value={form.guest_count} onChange={v => setForm(f => ({ ...f, guest_count: v }))} placeholder="Guest count" type="number" />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 20, fontWeight: 600, color: ink }}>{plan.partner_1_name || '—'} & {plan.partner_2_name || '—'}</div>
              {plan.wedding_motto && <div style={{ fontSize: 13, color: gray, fontStyle: 'italic' }}>"{plan.wedding_motto}"</div>}
              <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
                <div><div style={{ fontSize: 11, color: gray }}>Budget</div><div style={{ fontSize: 14, fontWeight: 600, color: ink }}>{fmt(plan.total_budget)}</div></div>
                <div><div style={{ fontSize: 11, color: gray }}>Guests</div><div style={{ fontSize: 14, fontWeight: 600, color: ink }}>{plan.guest_count}</div></div>
              </div>
              {plan.nuclear_option && (
                <div style={{ background: `${amber}15`, border: `1px solid ${amber}40`, borderRadius: 8, padding: '8px 12px', fontSize: 12, color: gray }}>
                  <span style={{ fontWeight: 600, color: amber }}>Nuclear option: </span>{plan.nuclear_option}
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Priorities */}
        <Card>
          <SectionHead title="Priorities" action={
            editing
              ? null
              : <GhostBtn onClick={startEdit} style={{ fontSize: 12, padding: '4px 10px' }}>Edit</GhostBtn>
          } />
          {editing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 12, color: gray }}>Partner 1 priorities (comma separated)</div>
              <Inp value={joinList(form.partner_1_priorities)} onChange={v => setForm(f => ({ ...f, partner_1_priorities: parseList(v) }))} placeholder="e.g. food, photos, flowers" />
              <div style={{ fontSize: 12, color: gray }}>Partner 1 not important</div>
              <Inp value={joinList(form.partner_1_not_important)} onChange={v => setForm(f => ({ ...f, partner_1_not_important: parseList(v) }))} placeholder="e.g. cake, DJ" />
              <div style={{ fontSize: 12, color: gray }}>Partner 2 priorities</div>
              <Inp value={joinList(form.partner_2_priorities)} onChange={v => setForm(f => ({ ...f, partner_2_priorities: parseList(v) }))} placeholder="e.g. venue, music" />
              <div style={{ fontSize: 12, color: gray }}>Partner 2 not important</div>
              <Inp value={joinList(form.partner_2_not_important)} onChange={v => setForm(f => ({ ...f, partner_2_not_important: parseList(v) }))} placeholder="e.g. flowers, cake" />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { name: plan.partner_1_name || 'Partner 1', yes: plan.partner_1_priorities, no: plan.partner_1_not_important },
                { name: plan.partner_2_name || 'Partner 2', yes: plan.partner_2_priorities, no: plan.partner_2_not_important },
              ].map(p => (
                <div key={p.name}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: ink, marginBottom: 6 }}>{p.name}</div>
                  {(p.yes || []).length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: gray, marginRight: 4 }}>Matters:</span>
                      {p.yes.map(item => <Chip key={item} label={item} color={green} />)}
                    </div>
                  )}
                  {(p.no || []).length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      <span style={{ fontSize: 11, color: gray, marginRight: 4 }}>Not important:</span>
                      {p.no.map(item => <Chip key={item} label={item} color={gray} />)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ─── Checklist Tab ─────────────────────────────────────────────────────────
function ChecklistTab({ checklist, toggleChecklist }) {
  const grouped = useMemo(() => {
    const map = {};
    for (const item of checklist) {
      if (!map[item.phase]) map[item.phase] = [];
      map[item.phase].push(item);
    }
    return Object.entries(map).sort((a, b) => {
      const order = Object.keys(PHASE_LABELS);
      return order.indexOf(a[0]) - order.indexOf(b[0]);
    });
  }, [checklist]);

  const total = checklist.length;
  const done  = checklist.filter(i => i.done).length;
  const pct   = total ? Math.round((done / total) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ flex: 1, height: 8, background: border, borderRadius: 4 }}>
            <div style={{ height: '100%', width: `${pct}%`, background: rosa, borderRadius: 4, transition: 'width 0.3s' }} />
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: rosa, whiteSpace: 'nowrap' }}>{done}/{total} ({pct}%)</div>
        </div>
      </Card>

      {grouped.map(([phase, items]) => {
        const phaseDone = items.filter(i => i.done).length;
        return (
          <Card key={phase}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: ink }}>{PHASE_LABELS[phase] || phase}</div>
              <div style={{ fontSize: 12, color: gray }}>{phaseDone}/{items.length}</div>
            </div>
            {items.sort((a, b) => a.sort_order - b.sort_order).map(item => (
              <Checkbox
                key={item.id}
                checked={item.done}
                onChange={() => toggleChecklist(item.id, !item.done)}
                label={item.task}
              />
            ))}
          </Card>
        );
      })}
    </div>
  );
}

// ─── Budget row with local state so typing isn't interrupted by DB saves ──
function BudgetRow({ item, updateBudgetItem, deleteBudgetItem }) {
  const toStr = v => (v === null || v === undefined || v === 0) ? '' : String(v);
  const [est, setEst] = useState(toStr(item.estimated_cost));
  const [act, setAct] = useState(toStr(item.actual_cost));

  // Sync only when DB value changes to something meaningful
  React.useEffect(() => { setEst(toStr(item.estimated_cost)); }, [item.estimated_cost]);
  React.useEffect(() => { setAct(toStr(item.actual_cost)); }, [item.actual_cost]);

  return (
    <tr style={{ borderBottom: `1px solid ${border}` }}>
      <td style={{ padding: '8px 8px', color: ink }}>{item.item_name}</td>
      <td style={{ padding: '8px 8px' }}>
        <input value={est} type="number" onChange={e => setEst(e.target.value)}
          onBlur={() => updateBudgetItem(item.id, { estimated_cost: Number(est) || 0 })}
          onKeyDown={e => e.key === 'Enter' && e.target.blur()}
          style={{ ...inputSt, padding: '3px 6px', fontSize: 12, width: 90 }} />
      </td>
      <td style={{ padding: '8px 8px' }}>
        <input value={act} type="number" onChange={e => setAct(e.target.value)}
          onBlur={() => updateBudgetItem(item.id, { actual_cost: act === '' ? null : Number(act) })}
          onKeyDown={e => e.key === 'Enter' && e.target.blur()}
          style={{ ...inputSt, padding: '3px 6px', fontSize: 12, width: 90 }} />
      </td>
      <td style={{ padding: '8px 8px' }}>
        <button onClick={() => deleteBudgetItem(item.id)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: gray, fontSize: 14 }}>×</button>
      </td>
    </tr>
  );
}

// ─── Budget Tab ────────────────────────────────────────────────────────────
function BudgetTab({ plan, budget, updateBudgetItem, addBudgetItem, deleteBudgetItem, updatePlan }) {
  const [addingCat, setAddingCat] = useState(null);
  const [newItem, setNewItem] = useState({ item_name: '', estimated_cost: '' });
  const [editBudget, setEditBudget] = useState(false);
  const [totalInput, setTotalInput] = useState('');

  const totalBudget = plan?.total_budget || 0;
  const totalEstimated = budget.reduce((s, i) => s + Number(i.estimated_cost || 0), 0);
  const totalActual    = budget.reduce((s, i) => s + Number(i.actual_cost || 0), 0);

  const grouped = useMemo(() => {
    const map = {};
    for (const item of budget) {
      if (!map[item.category]) map[item.category] = [];
      map[item.category].push(item);
    }
    return map;
  }, [budget]);

  const cats = DEFAULT_BUDGET_CATEGORIES;

  async function handleAdd(category) {
    if (!newItem.item_name.trim()) return;
    await addBudgetItem({ category, item_name: newItem.item_name, estimated_cost: Number(newItem.estimated_cost) || 0, sort_order: (grouped[category]?.length || 0) + 1 });
    setNewItem({ item_name: '', estimated_cost: '' });
    setAddingCat(null);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {/* Total budget card */}
        <Card style={{ textAlign: 'center', padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: ink }}>{fmt(totalBudget)}</div>
            {!editBudget && <GhostBtn onClick={() => { setTotalInput(String(totalBudget)); setEditBudget(true); }} style={{ fontSize: 11, padding: '2px 8px' }}>Edit</GhostBtn>}
          </div>
          <div style={{ fontSize: 11, color: gray }}>Total budget</div>
          {editBudget && (
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <input value={totalInput} onChange={e => setTotalInput(e.target.value)} type="number"
                onKeyDown={e => e.key === 'Enter' && (async () => { await updatePlan({ total_budget: Number(totalInput) }); setEditBudget(false); })()}
                style={{ ...inputSt, fontSize: 13, flex: 1, padding: '4px 8px' }} />
              <PrimaryBtn onClick={async () => { await updatePlan({ total_budget: Number(totalInput) }); setEditBudget(false); }}
                style={{ fontSize: 12, padding: '4px 10px' }}>OK</PrimaryBtn>
            </div>
          )}
        </Card>
        {/* Allocated */}
        <Card style={{ textAlign: 'center', padding: 14 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: totalEstimated > totalBudget ? red : ink }}>{fmt(totalEstimated)}</div>
          <div style={{ fontSize: 11, color: gray }}>Allocated</div>
          {totalBudget > 0 && <div style={{ fontSize: 11, color: gray, marginTop: 2 }}>{Math.round(totalEstimated / totalBudget * 100)}% of budget</div>}
        </Card>
        {/* Remaining */}
        <Card style={{ textAlign: 'center', padding: 14, background: totalBudget - totalEstimated < 0 ? `${red}10` : `${green}10` }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: totalBudget - totalEstimated < 0 ? red : green }}>{fmt(Math.abs(totalBudget - totalEstimated))}</div>
          <div style={{ fontSize: 11, color: gray }}>{totalBudget - totalEstimated < 0 ? 'Over budget' : 'Remaining'}</div>
          {totalBudget > 0 && <div style={{ fontSize: 11, color: gray, marginTop: 2 }}>{Math.round(Math.abs(totalBudget - totalEstimated) / totalBudget * 100)}% {totalBudget - totalEstimated < 0 ? 'over' : 'left'}</div>}
        </Card>
        {/* Actual spent */}
        <Card style={{ textAlign: 'center', padding: 14 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: totalActual > totalBudget ? red : ink }}>{fmt(totalActual)}</div>
          <div style={{ fontSize: 11, color: gray }}>Actual spent</div>
        </Card>
      </div>

      {/* Categories */}
      {cats.map(cat => {
        const items = (grouped[cat.category] || []).sort((a, b) => a.sort_order - b.sort_order);
        const catEst = items.reduce((s, i) => s + Number(i.estimated_cost || 0), 0);
        const catAct = items.reduce((s, i) => s + Number(i.actual_cost || 0), 0);
        const suggestedAmt = totalBudget * cat.default_pct;

        return (
          <Card key={cat.category}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 600, color: ink }}>{cat.label}</span>
                <span style={{ fontSize: 11, color: gray, marginLeft: 8 }}>({Math.round(cat.default_pct * 100)}% suggested — {fmt(suggestedAmt)})</span>
              </div>
              <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                <span style={{ color: catEst > suggestedAmt * 1.1 ? amber : gray }}>Est: {fmt(catEst)}</span>
                {catAct > 0 && <span style={{ color: catAct > suggestedAmt * 1.1 ? red : green }}>Actual: {fmt(catAct)}</span>}
              </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <colgroup>
                <col style={{ width: '40%' }} />
                <col style={{ width: '25%' }} />
                <col style={{ width: '25%' }} />
                <col style={{ width: '10%' }} />
              </colgroup>
              {items.length > 0 && (
                <thead>
                  <tr style={{ borderBottom: `1px solid ${border}` }}>
                    {['Item','Estimated','Actual',''].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '4px 8px', fontSize: 11, color: gray, fontWeight: 500 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
              )}
              <tbody>
                {items.map(item => (
                  <BudgetRow key={item.id} item={item} updateBudgetItem={updateBudgetItem} deleteBudgetItem={deleteBudgetItem} />
                ))}
                {addingCat === cat.category && (
                  <tr>
                    <td style={{ padding: '6px 8px' }}>
                      <input value={newItem.item_name} onChange={e => setNewItem(n => ({ ...n, item_name: e.target.value }))}
                        placeholder="Item name" autoFocus style={{ ...inputSt, padding: '3px 6px', fontSize: 12 }} />
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <input value={newItem.estimated_cost} onChange={e => setNewItem(n => ({ ...n, estimated_cost: e.target.value }))}
                        placeholder="0" type="number" style={{ ...inputSt, padding: '3px 6px', fontSize: 12, width: 90 }} />
                    </td>
                    <td />
                    <td style={{ padding: '6px 8px' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => handleAdd(cat.category)}
                          style={{ background: rosa, color: white, border: 'none', borderRadius: 4, padding: '3px 8px', fontSize: 12, cursor: 'pointer' }}>Add</button>
                        <button onClick={() => setAddingCat(null)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: gray }}>×</button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {addingCat !== cat.category && (
              <button onClick={() => { setAddingCat(cat.category); setNewItem({ item_name: '', estimated_cost: '' }); }}
                style={{ marginTop: 8, background: 'none', border: 'none', cursor: 'pointer', color: rosa, fontSize: 12, padding: 0 }}>
                + Add item
              </button>
            )}
          </Card>
        );
      })}
    </div>
  );
}

// ─── Guests Tab ────────────────────────────────────────────────────────────
function GuestsTab({ guests, addGuest, updateGuest, deleteGuest }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', rsvp_status: 'pending', meal_choice: '', dietary_prefs: '', notes: '' });
  const [filter, setFilter] = useState('all');

  const filtered = filter === 'all' ? guests : guests.filter(g => g.rsvp_status === filter);

  const counts = {
    total: guests.length,
    attending: guests.filter(g => g.rsvp_status === 'attending').length,
    declined: guests.filter(g => g.rsvp_status === 'declined').length,
    pending: guests.filter(g => g.rsvp_status === 'pending').length,
  };

  const RSVP_COLORS = { pending: amber, attending: green, declined: red, maybe: gray };

  async function handleAdd() {
    if (!form.name.trim()) return;
    await addGuest(form);
    setForm({ name: '', side: 'both', rsvp_status: 'pending', meal_choice: '', dietary_prefs: '', email: '', phone: '' });
    setShowAdd(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {[['Total', counts.total, ink],['Attending', counts.attending, green],['Declined', counts.declined, red],['Pending', counts.pending, amber]].map(([l, v, c]) => (
          <Card key={l} style={{ textAlign: 'center', padding: 14 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: c }}>{v}</div>
            <div style={{ fontSize: 11, color: gray }}>{l}</div>
          </Card>
        ))}
      </div>

      <Card>
        <SectionHead title="Guest List" action={
          <div style={{ display: 'flex', gap: 8 }}>
            {['all','attending','declined','pending'].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                style={{ padding: '4px 10px', border: `1px solid ${border}`, borderRadius: 6, fontSize: 11,
                  background: filter === f ? ink : white, color: filter === f ? white : gray, cursor: 'pointer' }}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
            <PrimaryBtn onClick={() => setShowAdd(s => !s)} style={{ fontSize: 12, padding: '4px 12px' }}>+ Add guest</PrimaryBtn>
          </div>
        } />

        {showAdd && (
          <div style={{ background: rp, borderRadius: 8, padding: 16, marginBottom: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Inp value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="Guest name" />
            <select value={form.rsvp_status} onChange={e => setForm(f => ({ ...f, rsvp_status: e.target.value }))}
              style={{ ...inputSt, fontSize: 13 }}>
              {['pending','attending','declined','maybe'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
            </select>
            <Inp value={form.meal_choice} onChange={v => setForm(f => ({ ...f, meal_choice: v }))} placeholder="Meal choice" />
            <Inp value={form.dietary_prefs} onChange={v => setForm(f => ({ ...f, dietary_prefs: v }))} placeholder="Dietary notes" />
            <Inp value={form.notes} onChange={v => setForm(f => ({ ...f, notes: v }))} placeholder="Notes" />
            <div style={{ gridColumn: '1/-1', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <GhostBtn onClick={() => setShowAdd(false)} style={{ fontSize: 12, padding: '4px 10px' }}>Cancel</GhostBtn>
              <PrimaryBtn onClick={handleAdd} style={{ fontSize: 12, padding: '4px 12px' }}>Add</PrimaryBtn>
            </div>
          </div>
        )}

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${border}` }}>
              {['Name','RSVP','Meal','Notes',''].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '6px 10px', fontSize: 11, color: gray, fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(g => (
              <tr key={g.id} style={{ borderBottom: `1px solid ${border}` }}>
                <td style={{ padding: '8px 10px', color: ink, fontWeight: 500 }}>{g.name}</td>
                <td style={{ padding: '8px 10px' }}>
                  <select value={g.rsvp_status} onChange={e => updateGuest(g.id, { rsvp_status: e.target.value })}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12,
                      color: RSVP_COLORS[g.rsvp_status] || gray, fontWeight: 600 }}>
                    {['pending','attending','declined','maybe'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
                  </select>
                </td>
                <td style={{ padding: '8px 10px', color: gray, fontSize: 12 }}>{g.meal_choice || '—'}</td>
                <td style={{ padding: '8px 10px', color: gray, fontSize: 12 }}>{g.dietary_prefs || '—'}</td>
                <td style={{ padding: '8px 10px' }}>
                  <button onClick={() => deleteGuest(g.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: gray, fontSize: 14 }}>×</button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={5} style={{ padding: '20px 10px', textAlign: 'center', color: gray, fontSize: 13 }}>No guests yet</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ─── Vendors Tab ───────────────────────────────────────────────────────────
function VendorsTab({ vendors, addVendor, updateVendor, deleteVendor }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ vendor_type: 'Venue', company_name: '', contact_name: '', phone: '', email: '', total_cents: '', notes: '' });

  const grouped = useMemo(() => {
    const map = {};
    for (const v of vendors) {
      const key = v.vendor_type || v.category || 'Other';
      if (!map[key]) map[key] = [];
      map[key].push(v);
    }
    return map;
  }, [vendors]);

  async function handleAdd() {
    if (!form.company_name.trim()) return;
    await addVendor({ ...form, total_cents: form.total_cents ? Math.round(Number(form.total_cents) * 100) : null });
    setForm({ vendor_type: 'Venue', company_name: '', contact_name: '', phone: '', email: '', total_cents: '', notes: '' });
    setShowAdd(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <PrimaryBtn onClick={() => setShowAdd(s => !s)} style={{ fontSize: 12, padding: '6px 14px' }}>+ Add vendor</PrimaryBtn>
      </div>

      {showAdd && (
        <Card style={{ background: rp }}>
          <SectionHead title="Add Vendor" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <select value={form.vendor_type} onChange={e => setForm(f => ({ ...f, vendor_type: e.target.value }))}
              style={{ ...inputSt, fontSize: 13 }}>
              {VENDOR_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <Inp value={form.company_name} onChange={v => setForm(f => ({ ...f, company_name: v }))} placeholder="Business name" />
            <Inp value={form.contact_name} onChange={v => setForm(f => ({ ...f, contact_name: v }))} placeholder="Contact name" />
            <Inp value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} placeholder="Phone" />
            <Inp value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} placeholder="Email" />
            <Inp value={form.total_cents} onChange={v => setForm(f => ({ ...f, total_cents: v }))} placeholder="Total cost ($)" type="number" />
            <div style={{ gridColumn: '1/-1' }}>
              <Inp value={form.notes} onChange={v => setForm(f => ({ ...f, notes: v }))} placeholder="Notes" />
            </div>
            <div style={{ gridColumn: '1/-1', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <GhostBtn onClick={() => setShowAdd(false)} style={{ fontSize: 12, padding: '4px 10px' }}>Cancel</GhostBtn>
              <PrimaryBtn onClick={handleAdd} style={{ fontSize: 12, padding: '4px 12px' }}>Add</PrimaryBtn>
            </div>
          </div>
        </Card>
      )}

      {Object.entries(grouped).map(([cat, items]) => (
        <Card key={cat}>
          <SectionHead title={cat} />
          {items.map(v => (
            <div key={v.id} style={{ borderBottom: `1px solid ${border}`, paddingBottom: 12, marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: ink }}>{v.company_name || v.business_name}</div>
                  {v.contact_name && <div style={{ fontSize: 12, color: gray }}>{v.contact_name}</div>}
                  <div style={{ display: 'flex', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
                    {v.phone && <a href={`tel:${v.phone}`} style={{ fontSize: 12, color: rosa, textDecoration: 'none' }}>{v.phone}</a>}
                    {v.email && <a href={`mailto:${v.email}`} style={{ fontSize: 12, color: rosa, textDecoration: 'none' }}>{v.email}</a>}
                    {v.total_cents && <span style={{ fontSize: 12, color: gray }}>{fmt(v.total_cents / 100)}</span>}
                  </div>
                  {v.notes && <div style={{ fontSize: 12, color: gray, marginTop: 4, fontStyle: 'italic' }}>{v.notes}</div>}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select value={v.stage || 'prospect'} onChange={e => updateVendor(v.id, { stage: e.target.value })}
                    style={{ fontSize: 11, border: `1px solid ${border}`, borderRadius: 4, padding: '2px 6px', background: 'white', color: gray, cursor: 'pointer' }}>
                    {['prospect','contacted','quoted','booked','paid'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
                  </select>
                  <button onClick={() => deleteVendor(v.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: gray, fontSize: 16 }}>×</button>
                </div>
              </div>
            </div>
          ))}
        </Card>
      ))}

      {vendors.length === 0 && (
        <Card style={{ textAlign: 'center', color: gray, fontSize: 13, padding: 40 }}>No vendors yet. Add your first vendor above.</Card>
      )}
    </div>
  );
}

// ─── Run of Show Item with inline edit ────────────────────────────────────
function RunOfShowItem({ item, updateRunItem, deleteRunItem }) {
  const [editing, setEditing] = useState(false);
  const [action, setAction] = useState(item.action || '');
  const [details, setDetails] = useState(item.details || '');
  const [time, setTime] = useState(item.scheduled_time || '');

  React.useEffect(() => { setAction(item.action || ''); }, [item.action]);
  React.useEffect(() => { setDetails(item.details || ''); }, [item.details]);
  React.useEffect(() => { setTime(item.scheduled_time || ''); }, [item.scheduled_time]);

  function save() {
    updateRunItem(item.id, { action, details, scheduled_time: time });
    setEditing(false);
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: `1px solid ${border}` }}>
      {editing ? (
        <>
          <input value={time} onChange={e => setTime(e.target.value)}
            onBlur={save} onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setEditing(false); }}
            placeholder="Time" style={{ ...inputSt, fontSize: 12, width: 80, padding: '3px 6px', flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <input value={action} onChange={e => setAction(e.target.value)}
              autoFocus
              onBlur={save} onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setEditing(false); }}
              placeholder="What happens" style={{ ...inputSt, fontSize: 13, padding: '3px 6px' }} />
            <input value={details} onChange={e => setDetails(e.target.value)}
              onBlur={save} onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setEditing(false); }}
              placeholder="Details / notes" style={{ ...inputSt, fontSize: 12, padding: '3px 6px' }} />
          </div>
        </>
      ) : (
        <>
          {(item.scheduled_time || time) && (
            <div style={{ fontSize: 12, fontWeight: 600, color: rosa, minWidth: 70, flexShrink: 0 }}>{item.scheduled_time}</div>
          )}
          <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => setEditing(true)}>
            <div style={{ fontSize: 13, color: ink }}>{item.action}</div>
            {item.details && <div style={{ fontSize: 11, color: gray, marginTop: 2 }}>{item.details}</div>}
          </div>
        </>
      )}
      <button onClick={() => deleteRunItem(item.id)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: gray, fontSize: 16, flexShrink: 0 }}>×</button>
    </div>
  );
}

// ─── Run of Show Tab ───────────────────────────────────────────────────────
function RunOfShowTab({ runOfShow, addRunItem, updateRunItem, deleteRunItem }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ phase: 'morning', action: '', scheduled_time: '', details: '' });

  const grouped = useMemo(() => {
    const map = {};
    for (const item of runOfShow) {
      if (!map[item.phase]) map[item.phase] = [];
      map[item.phase].push(item);
    }
    return map;
  }, [runOfShow]);

  async function handleAdd() {
    if (!form.action.trim()) return;
    await addRunItem({ ...form, sort_order: (grouped[form.phase]?.length || 0) + 1 });
    setForm({ phase: 'morning', action: '', scheduled_time: '', details: '' });
    setShowAdd(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <PrimaryBtn onClick={() => setShowAdd(s => !s)} style={{ fontSize: 12, padding: '6px 14px' }}>+ Add item</PrimaryBtn>
      </div>

      {showAdd && (
        <Card style={{ background: rp }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <select value={form.phase} onChange={e => setForm(f => ({ ...f, phase: e.target.value }))}
              style={{ ...inputSt, fontSize: 13 }}>
              {Object.entries(ROS_PHASE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <Inp value={form.action} onChange={v => setForm(f => ({ ...f, action: v }))} placeholder="What happens" />
            <Inp value={form.scheduled_time} onChange={v => setForm(f => ({ ...f, scheduled_time: v }))} placeholder="Time (e.g. 14:00)" />
            <Inp value={form.details} onChange={v => setForm(f => ({ ...f, details: v }))} placeholder="Details / notes" />
            <div style={{ gridColumn: '1/-1', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <GhostBtn onClick={() => setShowAdd(false)} style={{ fontSize: 12, padding: '4px 10px' }}>Cancel</GhostBtn>
              <PrimaryBtn onClick={handleAdd} style={{ fontSize: 12, padding: '4px 12px' }}>Add</PrimaryBtn>
            </div>
          </div>
        </Card>
      )}

      {Object.entries(ROS_PHASE_LABELS).map(([phase, phaseLabel]) => {
        const items = (grouped[phase] || []).sort((a, b) => a.sort_order - b.sort_order);
        if (items.length === 0) return null;
        return (
          <Card key={phase}>
            <SectionHead title={phaseLabel} />
            {items.map(item => (
              <RunOfShowItem key={item.id} item={item} updateRunItem={updateRunItem} deleteRunItem={deleteRunItem} />
            ))}
          </Card>
        );
      })}
    </div>
  );
}

// ─── Music Tab ─────────────────────────────────────────────────────────────
function MusicTab({ music, updateMusicItem, addMusicItem, deleteMusicItem }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ type: 'do_play', song_title: '', artist: '', notes: '' });

  const specialMoments = music.filter(m => m.type === 'special_moment');
  const doPlay         = music.filter(m => m.type === 'do_play');
  const doNotPlay      = music.filter(m => m.type === 'do_not_play');

  async function handleAdd() {
    if (!form.song_title.trim()) return;
    await addMusicItem(form);
    setForm({ type: 'do_play', song_title: '', artist: '', notes: '' });
    setShowAdd(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Special moments */}
      <Card>
        <SectionHead title="Special Moments" />
        {specialMoments.sort((a, b) => {
          const keys = Object.keys(MUSIC_MOMENT_LABELS);
          return keys.indexOf(a.moment_key) - keys.indexOf(b.moment_key);
        }).map(m => (
          <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: `1px solid ${border}` }}>
            <div style={{ minWidth: 160, fontSize: 12, fontWeight: 500, color: ink }}>{MUSIC_MOMENT_LABELS[m.moment_key] || m.moment_key}</div>
            <input value={m.song_title} onChange={e => updateMusicItem(m.id, { song_title: e.target.value })}
              placeholder="Song title" style={{ ...inputSt, fontSize: 12, flex: 1, padding: '4px 8px' }} />
            <input value={m.artist} onChange={e => updateMusicItem(m.id, { artist: e.target.value })}
              placeholder="Artist" style={{ ...inputSt, fontSize: 12, width: 150, padding: '4px 8px' }} />
          </div>
        ))}
      </Card>

      {/* Do play / Do not play */}
      {[
        { label: 'Play List', items: doPlay, type: 'do_play', color: green },
        { label: 'Do NOT Play', items: doNotPlay, type: 'do_not_play', color: red },
      ].map(section => (
        <Card key={section.type}>
          <SectionHead title={section.label} action={
            <PrimaryBtn onClick={() => { setForm(f => ({ ...f, type: section.type })); setShowAdd(true); }}
              style={{ fontSize: 12, padding: '4px 10px' }}>+ Add song</PrimaryBtn>
          } />
          {section.items.map(m => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: `1px solid ${border}` }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: ink, fontWeight: 500 }}>{m.song_title}</div>
                {m.artist && <div style={{ fontSize: 11, color: gray }}>{m.artist}</div>}
              </div>
              <button onClick={() => deleteMusicItem(m.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: gray, fontSize: 16 }}>×</button>
            </div>
          ))}
          {section.items.length === 0 && <div style={{ color: gray, fontSize: 13, textAlign: 'center', padding: '12px 0' }}>Empty</div>}
        </Card>
      ))}

      {showAdd && (
        <Card style={{ background: rp }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
              style={{ ...inputSt, fontSize: 13 }}>
              <option value="do_play">Play List</option>
              <option value="do_not_play">Do NOT Play</option>
            </select>
            <Inp value={form.song_title} onChange={v => setForm(f => ({ ...f, song_title: v }))} placeholder="Song title" />
            <Inp value={form.artist} onChange={v => setForm(f => ({ ...f, artist: v }))} placeholder="Artist" />
            <Inp value={form.notes} onChange={v => setForm(f => ({ ...f, notes: v }))} placeholder="Notes" />
            <div style={{ gridColumn: '1/-1', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <GhostBtn onClick={() => setShowAdd(false)} style={{ fontSize: 12, padding: '4px 10px' }}>Cancel</GhostBtn>
              <PrimaryBtn onClick={handleAdd} style={{ fontSize: 12, padding: '4px 12px' }}>Add</PrimaryBtn>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── Gifts Tab ─────────────────────────────────────────────────────────────
function GiftsTab({ gifts, addGift, updateGift, deleteGift }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ giver_name: '', gift_description: '', is_cash: false, cash_amount: '', notes: '' });

  const totalCash = gifts.filter(g => g.is_cash).reduce((s, g) => s + Number(g.cash_amount || 0), 0);
  const thankYouPending = gifts.filter(g => !g.thank_you_sent).length;

  async function handleAdd() {
    if (!form.giver_name.trim()) return;
    await addGift({ ...form, cash_amount: form.is_cash ? Number(form.cash_amount) || null : null });
    setForm({ giver_name: '', gift_description: '', is_cash: false, cash_amount: '', notes: '' });
    setShowAdd(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <Card style={{ textAlign: 'center', padding: 14 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: ink }}>{gifts.length}</div>
          <div style={{ fontSize: 11, color: gray }}>Total gifts</div>
        </Card>
        <Card style={{ textAlign: 'center', padding: 14 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: green }}>{fmt(totalCash)}</div>
          <div style={{ fontSize: 11, color: gray }}>Cash / checks</div>
        </Card>
        <Card style={{ textAlign: 'center', padding: 14 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: thankYouPending > 0 ? amber : gray }}>{thankYouPending}</div>
          <div style={{ fontSize: 11, color: gray }}>Thank-you's pending</div>
        </Card>
      </div>

      <Card>
        <SectionHead title="Gift Log" action={
          <PrimaryBtn onClick={() => setShowAdd(s => !s)} style={{ fontSize: 12, padding: '4px 12px' }}>+ Add gift</PrimaryBtn>
        } />

        {showAdd && (
          <div style={{ background: rp, borderRadius: 8, padding: 16, marginBottom: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Inp value={form.giver_name} onChange={v => setForm(f => ({ ...f, giver_name: v }))} placeholder="Giver name" />
            <Inp value={form.gift_description} onChange={v => setForm(f => ({ ...f, gift_description: v }))} placeholder="Gift description" />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: ink, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.is_cash} onChange={e => setForm(f => ({ ...f, is_cash: e.target.checked }))} />
              Cash/check
            </label>
            {form.is_cash && <Inp value={form.cash_amount} onChange={v => setForm(f => ({ ...f, cash_amount: v }))} placeholder="Amount" type="number" />}
            <div style={{ gridColumn: '1/-1' }}>
              <Inp value={form.notes} onChange={v => setForm(f => ({ ...f, notes: v }))} placeholder="Notes" />
            </div>
            <div style={{ gridColumn: '1/-1', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <GhostBtn onClick={() => setShowAdd(false)} style={{ fontSize: 12, padding: '4px 10px' }}>Cancel</GhostBtn>
              <PrimaryBtn onClick={handleAdd} style={{ fontSize: 12, padding: '4px 12px' }}>Add</PrimaryBtn>
            </div>
          </div>
        )}

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${border}` }}>
              {['Giver','Gift','Amount','Thank you',''].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '6px 10px', fontSize: 11, color: gray, fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {gifts.map(g => (
              <tr key={g.id} style={{ borderBottom: `1px solid ${border}` }}>
                <td style={{ padding: '8px 10px', color: ink, fontWeight: 500 }}>{g.giver_name}</td>
                <td style={{ padding: '8px 10px', color: gray }}>{g.gift_description || (g.is_cash ? 'Cash/check' : '—')}</td>
                <td style={{ padding: '8px 10px', color: g.is_cash ? green : gray }}>{g.is_cash && g.cash_amount ? fmt(g.cash_amount) : '—'}</td>
                <td style={{ padding: '8px 10px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input type="checkbox" checked={g.thank_you_sent} onChange={e => updateGift(g.id, { thank_you_sent: e.target.checked, thank_you_sent_at: e.target.checked ? new Date().toISOString() : null })} />
                    <span style={{ fontSize: 12, color: g.thank_you_sent ? green : amber }}>{g.thank_you_sent ? 'Sent' : 'Pending'}</span>
                  </label>
                </td>
                <td style={{ padding: '8px 10px' }}>
                  <button onClick={() => deleteGift(g.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: gray, fontSize: 14 }}>×</button>
                </td>
              </tr>
            ))}
            {gifts.length === 0 && (
              <tr><td colSpan={5} style={{ padding: '20px 10px', textAlign: 'center', color: gray }}>No gifts logged yet</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ─── Legal Tab ─────────────────────────────────────────────────────────────
function LegalTab({ legalItems, toggleLegalItem }) {
  const pre      = legalItems.filter(i => i.phase === 'pre_wedding').sort((a, b) => a.sort_order - b.sort_order);
  const nameChg  = legalItems.filter(i => i.phase === 'name_change').sort((a, b) => a.sort_order - b.sort_order);

  function Section({ title, items }) {
    const done = items.filter(i => i.done).length;
    return (
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: ink }}>{title}</div>
          <div style={{ fontSize: 12, color: gray }}>{done}/{items.length}</div>
        </div>
        {items.map(item => (
          <Checkbox
            key={item.id}
            checked={item.done}
            onChange={() => toggleLegalItem(item.id, !item.done)}
            label={item.task}
            sub={[item.location, item.cost, item.notes].filter(Boolean).join(' · ')}
          />
        ))}
      </Card>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Section title="Pre-Wedding Legal" items={pre} />
      <Section title="Name Change Checklist" items={nameChg} />
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────
export default function WeddingPlanner({ eventId, event, setScreen }) {
  const { boutique } = useAuth();
  const [tab, setTab] = useState('overview');
  const [initializing, setInitializing] = useState(false);

  const wp = useWeddingPlan(eventId, boutique?.id);

  async function handleInit() {
    setInitializing(true);
    await wp.initPlan(event);
    setInitializing(false);
  }

  if (wp.loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: gray }}>
        Loading…
      </div>
    );
  }

  if (!wp.plan) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Topbar
          title="Wedding Planner"
          subtitle={event?.client_name || ''}
          actions={<GhostBtn onClick={() => setScreen('event_detail')} style={{ fontSize: 12, padding: '5px 12px' }}>← Back to event</GhostBtn>}
        />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 40 }}>💍</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: ink }}>No wedding plan yet</div>
          <div style={{ fontSize: 13, color: gray }}>Start a plan to track checklist, budget, guests, vendors, and more.</div>
          <PrimaryBtn onClick={handleInit} disabled={initializing} style={{ padding: '10px 24px' }}>
            {initializing ? 'Creating plan…' : 'Create wedding plan'}
          </PrimaryBtn>
        </div>
      </div>
    );
  }

  const tabContent = () => {
    switch (tab) {
      case 'overview':  return <OverviewTab plan={wp.plan} updatePlan={wp.updatePlan} event={event} />;
      case 'checklist': return <ChecklistTab checklist={wp.checklist} toggleChecklist={wp.toggleChecklist} />;
      case 'budget':    return <BudgetTab plan={wp.plan} budget={wp.budget} updateBudgetItem={wp.updateBudgetItem} addBudgetItem={wp.addBudgetItem} deleteBudgetItem={wp.deleteBudgetItem} updatePlan={wp.updatePlan} />;
      case 'guests':    return <GuestsTab guests={wp.guests} addGuest={wp.addGuest} updateGuest={wp.updateGuest} deleteGuest={wp.deleteGuest} />;
      case 'vendors':   return <VendorsTab vendors={wp.vendors} addVendor={wp.addVendor} updateVendor={wp.updateVendor} deleteVendor={wp.deleteVendor} />;
      case 'runofshow': return <RunOfShowTab runOfShow={wp.runOfShow} addRunItem={wp.addRunItem} updateRunItem={wp.updateRunItem} deleteRunItem={wp.deleteRunItem} />;
      case 'music':     return <MusicTab music={wp.music} updateMusicItem={wp.updateMusicItem} addMusicItem={wp.addMusicItem} deleteMusicItem={wp.deleteMusicItem} />;
      case 'gifts':     return <GiftsTab gifts={wp.gifts} addGift={wp.addGift} updateGift={wp.updateGift} deleteGift={wp.deleteGift} />;
      case 'legal':     return <LegalTab legalItems={wp.legalItems} toggleLegalItem={wp.toggleLegalItem} />;
      default: return null;
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Topbar
        title="Wedding Planner"
        subtitle={`${wp.plan.partner_1_name || ''}${wp.plan.partner_2_name ? ' & ' + wp.plan.partner_2_name : ''}`}
        actions={<GhostBtn onClick={() => setScreen('event_detail')} style={{ fontSize: 12, padding: '5px 12px' }}>← Back to event</GhostBtn>}
      />

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${border}`, background: white, padding: '0 20px', flexShrink: 0, overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              padding: '10px 14px', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: tab === t.id ? 600 : 400,
              color: tab === t.id ? rosa : gray,
              borderBottom: `2px solid ${tab === t.id ? rosa : 'transparent'}`,
              whiteSpace: 'nowrap',
            }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
        {tabContent()}
      </div>
    </div>
  );
}
