import React, { useState, useEffect } from 'react';
import { C } from '../lib/colors';
import { Card, CardHead, PrimaryBtn, GhostBtn, inputSt, LBL, useToast } from '../lib/ui.jsx';
import { useAuth } from '../context/AuthContext';
import { useBoutique } from '../hooks/useBoutique';
import { supabase } from '../lib/supabase';

// ─── CONSTANTS ──────────────────────────────────────────────────────────────
const CONTRACT_VARS = [
  { token: '{{client_name}}',    label: 'Client name' },
  { token: '{{event_date}}',     label: 'Event date' },
  { token: '{{event_type}}',     label: 'Event type' },
  { token: '{{total_amount}}',   label: 'Total amount' },
  { token: '{{boutique_name}}',  label: 'Boutique name' },
  { token: '{{boutique_address}}',label: 'Boutique address' },
  { token: '{{partner_name}}',   label: 'Partner / groom name' },
  { token: '{{venue}}',          label: 'Venue' },
  { token: '{{balance_due}}',    label: 'Balance due' },
  { token: '{{today_date}}',     label: 'Today\'s date' },
];

const DEFAULT_CONTRACT = `SERVICE AGREEMENT

This agreement is entered into between {{boutique_name}} ("the Boutique") and {{client_name}} ("the Client") on {{today_date}}.

EVENT DETAILS
Event type: {{event_type}}
Event date: {{event_date}}
Venue: {{venue}}

SERVICES & FEES
Total amount: {{total_amount}}
Balance due: {{balance_due}}

TERMS AND CONDITIONS
1. A non-refundable deposit is required to secure the date.
2. The remaining balance is due no later than 30 days before the event.
3. Cancellations made less than 30 days before the event date are non-refundable.
4. The Boutique reserves the right to reschedule in the event of unforeseen circumstances.

SIGNATURES

Client signature: _______________________  Date: ____________

Boutique representative: _______________  Date: ____________

{{boutique_name}}
{{boutique_address}}
`;

// ─── HELPERS ────────────────────────────────────────────────────────────────
function fillTemplate(body, eventData, boutique) {
  const fmt = (d) => {
    if (!d) return '';
    try { return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); }
    catch { return d; }
  };

  const fmtMoney = (n) => {
    if (!n && n !== 0) return '$0';
    return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const paid = eventData?.paid || 0;
  const total = eventData?.total || 0;
  const balance = total - paid;

  const map = {
    '{{client_name}}':     eventData?.client?.name || '',
    '{{event_date}}':      fmt(eventData?.event_date),
    '{{event_type}}':      eventData?.type ? eventData.type.charAt(0).toUpperCase() + eventData.type.slice(1) : '',
    '{{total_amount}}':    fmtMoney(total),
    '{{boutique_name}}':   boutique?.name || '',
    '{{boutique_address}}':boutique?.address || '',
    '{{partner_name}}':    eventData?.client?.partner_name || '',
    '{{venue}}':           eventData?.venue || '',
    '{{balance_due}}':     fmtMoney(balance),
    '{{today_date}}':      new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
  };

  let out = body;
  for (const [token, val] of Object.entries(map)) {
    out = out.replaceAll(token, val);
  }
  return out;
}

// ─── GENERATE CONTRACT MODAL ─────────────────────────────────────────────────
const GenerateModal = ({ template, boutique, onClose }) => {
  const toast = useToast();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [filled, setFilled] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function fetchEvents() {
      setLoading(true);
      const { data } = await supabase
        .from('events')
        .select('id, type, event_date, venue, total, paid, client:clients(name, partner_name)')
        .eq('boutique_id', boutique.id)
        .order('event_date', { ascending: false })
        .limit(60);
      setLoading(false);
      setEvents(data || []);
    }
    if (boutique) fetchEvents();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boutique?.id]);

  useEffect(() => {
    if (!selectedEventId) { setFilled(''); return; }
    const ev = events.find(e => e.id === selectedEventId);
    if (!ev) return;
    setFilled(fillTemplate(template.body, ev, boutique));
  }, [selectedEventId, events, template, boutique]);

  const handleCopy = () => {
    navigator.clipboard.writeText(filled).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast('Contract text copied to clipboard ✓');
    });
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
      <div style={{ background: C.white, borderRadius: 16, width: '100%', maxWidth: 680, maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15, color: C.ink }}>Generate contract</div>
            <div style={{ fontSize: 12, color: C.gray, marginTop: 2 }}>Template: {template.name}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: C.gray, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Event picker */}
          <div>
            <div style={LBL}>Select an event</div>
            {loading ? (
              <div style={{ fontSize: 13, color: C.gray }}>Loading events…</div>
            ) : (
              <select
                value={selectedEventId}
                onChange={e => setSelectedEventId(e.target.value)}
                style={{ ...inputSt }}>
                <option value="">— choose an event —</option>
                {events.map(ev => (
                  <option key={ev.id} value={ev.id}>
                    {ev.client?.name || 'Unknown client'} · {ev.type} · {ev.event_date ? new Date(ev.event_date + 'T00:00:00').toLocaleDateString() : 'no date'}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Filled contract preview */}
          {filled ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.gray, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Generated contract
                </div>
                <PrimaryBtn
                  label={copied ? 'Copied ✓' : 'Copy text'}
                  onClick={handleCopy}
                  colorScheme={copied ? 'success' : undefined}
                  style={{ fontSize: 12, padding: '5px 14px' }}
                />
              </div>
              <pre style={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontFamily: 'Georgia, serif',
                fontSize: 13,
                lineHeight: 1.7,
                color: C.ink,
                background: C.ivory,
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                padding: '16px 18px',
                margin: 0,
                maxHeight: 400,
                overflowY: 'auto',
              }}>
                {filled}
              </pre>
            </div>
          ) : selectedEventId ? null : (
            <div style={{ padding: '24px', textAlign: 'center', color: C.gray, fontSize: 13 }}>
              Select an event above to generate the filled contract text.
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
          <GhostBtn label="Close" onClick={onClose} />
        </div>
      </div>
    </div>
  );
};

// ─── EDIT PANEL ─────────────────────────────────────────────────────────────
const EditPanel = ({ template, onSave, onCancel, onDelete, saving, boutique }) => {
  const [form, setForm] = useState({
    name: template?.name || '',
    body: template?.body || DEFAULT_CONTRACT,
  });
  const [showPreview, setShowPreview] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const bodyRef = React.useRef(null);

  const insertVar = (token) => {
    const ta = bodyRef.current;
    if (!ta) {
      setForm(f => ({ ...f, body: f.body + token }));
      return;
    }
    const start = ta.selectionStart;
    const end   = ta.selectionEnd;
    const next  = form.body.slice(0, start) + token + form.body.slice(end);
    setForm(f => ({ ...f, body: next }));
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + token.length, start + token.length);
    });
  };

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>
            {template?.id ? 'Edit template' : 'New template'}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {template?.id && (
              <>
                <GhostBtn
                  label="Generate contract"
                  onClick={() => setShowGenerate(true)}
                  style={{ fontSize: 12, padding: '5px 10px' }}
                />
                {confirmDelete
                  ? <>
                      <span style={{ fontSize: 12, color: C.gray, alignSelf: 'center' }}>Sure?</span>
                      <GhostBtn label="Cancel" onClick={() => setConfirmDelete(false)} style={{ fontSize: 12, padding: '5px 10px' }} />
                      <button
                        onClick={() => onDelete(template.id)}
                        style={{ padding: '5px 12px', borderRadius: 7, border: `1px solid #B91C1C`, background: '#FEE2E2', color: '#B91C1C', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                        Delete
                      </button>
                    </>
                  : <GhostBtn label="Delete" onClick={() => setConfirmDelete(true)} style={{ fontSize: 12, padding: '5px 10px', color: '#B91C1C', borderColor: '#B91C1C' }} />
                }
              </>
            )}
          </div>
        </div>

        {/* Name */}
        <div>
          <div style={LBL}>Template name</div>
          <input
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Standard Wedding Contract"
            style={inputSt}
          />
        </div>

        {/* Body */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={LBL}>Contract body</div>
            <button
              onClick={() => setShowPreview(p => !p)}
              style={{ background: 'none', border: 'none', fontSize: 12, color: C.rosa, cursor: 'pointer', padding: 0 }}>
              {showPreview ? 'Edit' : 'Preview (sample data)'}
            </button>
          </div>
          {showPreview ? (
            <pre style={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontFamily: 'Georgia, serif',
              fontSize: 13,
              lineHeight: 1.7,
              color: C.ink,
              background: C.ivory,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: '14px 16px',
              margin: 0,
              minHeight: 320,
            }}>
              {fillTemplate(form.body, {
                client: { name: 'Maria Garcia', partner_name: 'Carlos Garcia' },
                event_date: '2026-06-14',
                type: 'wedding',
                venue: 'The Grand Ballroom',
                total: 3500,
                paid: 1000,
              }, boutique)}
            </pre>
          ) : (
            <textarea
              ref={bodyRef}
              value={form.body}
              onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
              rows={16}
              style={{ ...inputSt, resize: 'vertical', minHeight: 320, fontFamily: 'monospace', lineHeight: 1.6 }}
            />
          )}
        </div>

        {/* Variable chips */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.gray, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Template variables — click to insert at cursor
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {CONTRACT_VARS.map(v => (
              <button
                key={v.token}
                onClick={() => !showPreview && insertVar(v.token)}
                title={showPreview ? v.label : `Insert ${v.token}`}
                style={{
                  padding: '4px 10px',
                  borderRadius: 20,
                  border: `1px solid ${C.border}`,
                  background: C.ivory,
                  color: C.ink,
                  fontSize: 11,
                  fontFamily: 'monospace',
                  cursor: showPreview ? 'default' : 'pointer',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => { if (!showPreview) { e.currentTarget.style.borderColor = C.rosa; e.currentTarget.style.color = C.rosa; } }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.ink; }}
              >
                {v.token}
                <span style={{ fontFamily: 'inherit', color: C.gray, marginLeft: 4, fontSize: 10 }}>· {v.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Character count */}
        <div style={{ fontSize: 11, color: C.gray, textAlign: 'right', marginTop: -8 }}>
          {form.body.length.toLocaleString()} characters
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
          <PrimaryBtn
            label={saving ? 'Saving…' : 'Save template'}
            colorScheme="success"
            onClick={() => { if (form.name.trim()) onSave(form); }}
            style={{ flex: 1 }}
          />
          <GhostBtn label="Cancel" onClick={onCancel} />
        </div>
      </div>

      {showGenerate && template?.id && (
        <GenerateModal
          template={{ ...template, ...form }}
          boutique={boutique}
          onClose={() => setShowGenerate(false)}
        />
      )}
    </>
  );
};

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────
export default function ContractBuilderTab() {
  const { boutique, reloadBoutique, session } = useAuth();
  const { updateBoutique, saving } = useBoutique();
  const toast = useToast();
  const [editing, setEditing] = useState(null); // null | 'new' | template object

  // Templates stored as boutiques.contract_templates (array)
  const templates = React.useMemo(() => {
    const raw = boutique?.contract_templates;
    if (!raw) return [];
    // Support both array format (new) and legacy object format
    if (Array.isArray(raw)) return raw;
    // Legacy: { default, wedding, quince } — convert for display only (don't overwrite)
    return Object.entries(raw).map(([key, body]) => ({
      id: key,
      name: key.charAt(0).toUpperCase() + key.slice(1) + ' contract',
      body,
      created_at: null,
    }));
  }, [boutique?.contract_templates]);

  async function handleSave(form) {
    let updated;
    if (editing?.id && editing !== 'new') {
      // Update existing
      updated = templates.map(t => t.id === editing.id ? { ...t, ...form, updated_at: new Date().toISOString() } : t);
    } else {
      // New template
      const newTpl = {
        id: crypto.randomUUID(),
        name: form.name,
        body: form.body,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      updated = [...templates, newTpl];
    }
    const { error } = await updateBoutique({ contract_templates: updated });
    if (error) { toast(error.message || 'Save failed', 'error'); return; }
    if (session) reloadBoutique(session.user.id);
    toast(editing?.id && editing !== 'new' ? 'Template updated ✓' : 'Template created ✓');
    setEditing(null);
  }

  async function handleDelete(id) {
    const updated = templates.filter(t => t.id !== id);
    const { error } = await updateBoutique({ contract_templates: updated });
    if (error) { toast(error.message || 'Delete failed', 'error'); return; }
    if (session) reloadBoutique(session.user.id);
    toast('Template deleted');
    setEditing(null);
  }

  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
      {/* Left: template list */}
      <div style={{ flex: editing ? '0 0 300px' : 1, minWidth: 0 }}>
        <Card>
          <CardHead
            title="Contract templates"
            action="+ New Template"
            onAction={() => setEditing('new')}
          />

          {templates.length === 0 ? (
            <div style={{ padding: '52px 24px', textAlign: 'center', color: C.gray }}>
              <div style={{ fontSize: 36, marginBottom: 14, opacity: 0.35 }}>📄</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.ink, marginBottom: 8 }}>
                No contract templates yet
              </div>
              <div style={{ fontSize: 13, color: C.gray, maxWidth: 320, margin: '0 auto 20px' }}>
                Create a contract template to quickly generate client agreements.
              </div>
              <PrimaryBtn label="+ New Template" onClick={() => setEditing('new')} />
            </div>
          ) : (
            <div style={{ padding: '0 16px 8px' }}>
              {templates.map((tmpl) => {
                const isActive = editing && editing !== 'new' && editing.id === tmpl.id;
                return (
                  <div
                    key={tmpl.id}
                    onClick={() => setEditing(tmpl)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '12px 10px',
                      borderRadius: 8,
                      marginBottom: 4,
                      background: isActive ? C.rosaPale : 'transparent',
                      border: `1px solid ${isActive ? C.rosa : 'transparent'}`,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = C.grayBg; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: C.rosaPale, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                      📄
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {tmpl.name}
                      </div>
                      {tmpl.created_at && (
                        <div style={{ fontSize: 11, color: C.gray }}>
                          Created {new Date(tmpl.created_at).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 16, color: C.gray, flexShrink: 0 }}>›</div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Right: edit panel */}
      {editing && (
        <div style={{ flex: 1, minWidth: 0 }}>
          <Card>
            <div style={{ padding: 20 }}>
              <EditPanel
                template={editing === 'new' ? null : editing}
                onSave={handleSave}
                onCancel={() => setEditing(null)}
                onDelete={handleDelete}
                saving={saving}
                boutique={boutique}
              />
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
