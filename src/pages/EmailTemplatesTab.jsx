import React, { useState, useEffect } from 'react';
import { C } from '../lib/colors';
import { Card, CardHead, PrimaryBtn, GhostBtn, Badge, inputSt, LBL, useToast } from '../lib/ui.jsx';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

// ─── CONSTANTS ──────────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: 'general',      label: 'General' },
  { id: 'confirmation', label: 'Confirmation' },
  { id: 'reminder',     label: 'Reminder' },
  { id: 'followup',     label: 'Follow-up' },
  { id: 'promotion',    label: 'Promotion' },
  { id: 'contract',     label: 'Contract' },
];

const CAT_COLORS = {
  general:      { bg: C.grayBg,             color: C.gray },
  confirmation: { bg: '#DCFCE7',             color: '#15803D' },
  reminder:     { bg: '#FEF3C7',             color: '#B45309' },
  followup:     { bg: '#DBEAFE',             color: '#1D4ED8' },
  promotion:    { bg: '#EDE9FE',             color: '#7C3AED' },
  contract:     { bg: C.rosaPale,            color: C.rosa },
};

const SUGGESTED_VARS = [
  '{{client_name}}',
  '{{event_date}}',
  '{{boutique_name}}',
  '{{appointment_date}}',
  '{{appointment_time}}',
  '{{balance_due}}',
  '{{dress_name}}',
];

const PREVIEW_MAP = {
  '{{client_name}}':      'Maria Garcia',
  '{{event_date}}':       'June 14, 2026',
  '{{boutique_name}}':    'Bella Bridal Boutique',
  '{{appointment_date}}': 'April 15, 2026',
  '{{appointment_time}}': '2:00 PM',
  '{{balance_due}}':      '$850.00',
  '{{dress_name}}':       'Essense of Australia D3200',
};

// Detect {{variable}} patterns in text
function extractVariables(text) {
  const matches = text.match(/\{\{[^}]+\}\}/g);
  return matches ? [...new Set(matches)] : [];
}

function applyPreview(text) {
  let out = text;
  for (const [token, val] of Object.entries(PREVIEW_MAP)) {
    out = out.replaceAll(token, val);
  }
  // Any remaining {{unknown}} tokens — highlight them
  out = out.replace(/\{\{[^}]+\}\}/g, match => `[${match}]`);
  return out;
}

// ─── EMPTY STATE ────────────────────────────────────────────────────────────
const EmptyState = ({ onNew }) => (
  <div style={{ padding: '60px 24px', textAlign: 'center', color: C.gray }}>
    <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.35 }}>✉️</div>
    <div style={{ fontSize: 15, fontWeight: 600, color: C.ink, marginBottom: 8 }}>
      No email templates yet
    </div>
    <div style={{ fontSize: 13, color: C.gray, maxWidth: 380, margin: '0 auto 20px' }}>
      Create your first template to streamline client communications.
    </div>
    <PrimaryBtn label="+ New Template" onClick={onNew} />
  </div>
);

// ─── VARIABLE CHIPS ─────────────────────────────────────────────────────────
const VarChip = ({ variable, onInsert }) => (
  <button
    onClick={() => onInsert && onInsert(variable)}
    title={onInsert ? `Insert ${variable}` : variable}
    style={{
      padding: '3px 10px',
      borderRadius: 20,
      border: `1px solid ${C.border}`,
      background: C.ivory,
      color: C.ink,
      fontSize: 11,
      fontFamily: 'monospace',
      cursor: onInsert ? 'pointer' : 'default',
      transition: 'border-color 0.15s',
      whiteSpace: 'nowrap',
    }}
    onMouseEnter={e => { if (onInsert) { e.currentTarget.style.borderColor = C.rosa; e.currentTarget.style.color = C.rosa; } }}
    onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.ink; }}
  >
    {variable}
  </button>
);

// ─── EDIT PANEL ─────────────────────────────────────────────────────────────
const EditPanel = ({ template, onSave, onCancel, onDelete, saving }) => {
  const [form, setForm] = useState({
    name:     template?.name     || '',
    subject:  template?.subject  || '',
    body:     template?.body     || '',
    category: template?.category || 'general',
    is_active: template?.is_active ?? true,
  });
  const [showPreview, setShowPreview] = useState(false);
  const bodyRef = React.useRef(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const detectedVars = extractVariables(form.body + ' ' + form.subject);

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

  const handleSave = () => {
    if (!form.name.trim()) return;
    onSave(form);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>
          {template?.id ? 'Edit template' : 'New template'}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {template?.id && (
            confirmDelete
              ? <>
                  <span style={{ fontSize: 12, color: C.gray, alignSelf: 'center' }}>Are you sure?</span>
                  <GhostBtn label="Cancel" onClick={() => setConfirmDelete(false)} style={{ fontSize: 12, padding: '5px 10px' }} />
                  <button
                    onClick={() => onDelete(template.id)}
                    style={{ padding: '5px 12px', borderRadius: 7, border: `1px solid #B91C1C`, background: '#FEE2E2', color: '#B91C1C', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                    Delete
                  </button>
                </>
              : <GhostBtn label="Delete" onClick={() => setConfirmDelete(true)} style={{ fontSize: 12, padding: '5px 10px', color: '#B91C1C', borderColor: '#B91C1C' }} />
          )}
        </div>
      </div>

      {/* Name + Category row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10 }}>
        <div>
          <div style={LBL}>Template name</div>
          <input
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Appointment Confirmation"
            style={inputSt}
          />
        </div>
        <div>
          <div style={LBL}>Category</div>
          <select
            value={form.category}
            onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
            style={{ ...inputSt, width: 140 }}>
            {CATEGORIES.map(c => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Subject */}
      <div>
        <div style={LBL}>Email subject line</div>
        <input
          value={form.subject}
          onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
          placeholder="e.g. Your appointment at {{boutique_name}} is confirmed"
          style={inputSt}
        />
      </div>

      {/* Body */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={LBL}>Email body</div>
          <button
            onClick={() => setShowPreview(p => !p)}
            style={{ background: 'none', border: 'none', fontSize: 12, color: C.rosa, cursor: 'pointer', padding: 0 }}>
            {showPreview ? 'Edit' : 'Preview'}
          </button>
        </div>
        {showPreview ? (
          <div style={{
            width: '100%', minHeight: 220, padding: 12, borderRadius: 8,
            border: `1px solid ${C.border}`, fontSize: 13, lineHeight: 1.7,
            color: C.ink, background: C.ivory, whiteSpace: 'pre-wrap', boxSizing: 'border-box',
          }}>
            <div style={{ fontSize: 11, color: C.gray, marginBottom: 6, fontStyle: 'italic' }}>
              Subject: {applyPreview(form.subject) || '(empty)'}
            </div>
            <hr style={{ border: 'none', borderTop: `1px solid ${C.border}`, margin: '0 0 8px' }} />
            {applyPreview(form.body) || <span style={{ color: C.gray, fontStyle: 'italic' }}>(empty body)</span>}
          </div>
        ) : (
          <textarea
            ref={bodyRef}
            value={form.body}
            onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
            rows={10}
            placeholder="Dear {{client_name}},&#10;&#10;We are pleased to confirm your appointment at {{boutique_name}}…"
            style={{ ...inputSt, resize: 'vertical', minHeight: 220, fontFamily: 'inherit', lineHeight: 1.6 }}
          />
        )}
      </div>

      {/* Detected variables */}
      {detectedVars.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.gray, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Variables detected in this template
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {detectedVars.map(v => <VarChip key={v} variable={v} />)}
          </div>
        </div>
      )}

      {/* Suggested variables */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: C.gray, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Click a variable to insert at cursor
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {SUGGESTED_VARS.map(v => <VarChip key={v} variable={v} onInsert={showPreview ? null : insertVar} />)}
        </div>
      </div>

      {/* Active toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
          style={{ width: 38, height: 20, borderRadius: 10, background: form.is_active ? C.rosa : C.border, cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
          <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: form.is_active ? 20 : 2, transition: 'left 0.2s' }} />
        </div>
        <span style={{ fontSize: 12, color: C.gray }}>Active</span>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
        <PrimaryBtn
          label={saving ? 'Saving…' : 'Save template'}
          colorScheme="success"
          onClick={handleSave}
          style={{ flex: 1 }}
        />
        <GhostBtn label="Cancel" onClick={onCancel} />
      </div>
    </div>
  );
};

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────
export default function EmailTemplatesTab() {
  const { boutique } = useAuth();
  const toast = useToast();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | 'new' | template object
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!boutique) return;
    fetchTemplates();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boutique?.id]);

  async function fetchTemplates() {
    setLoading(true);
    const { data, error } = await supabase
      .from('email_templates')
      .select('*')
      .eq('boutique_id', boutique.id)
      .order('created_at', { ascending: false });
    setLoading(false);
    if (error) { toast('Failed to load templates', 'error'); return; }
    setTemplates(data || []);
  }

  async function handleSave(form) {
    setSaving(true);
    const payload = {
      ...form,
      boutique_id: boutique.id,
      updated_at: new Date().toISOString(),
    };
    let error;
    if (editing?.id) {
      ({ error } = await supabase
        .from('email_templates')
        .update(payload)
        .eq('id', editing.id)
        .eq('boutique_id', boutique.id));
    } else {
      ({ error } = await supabase
        .from('email_templates')
        .insert(payload));
    }
    setSaving(false);
    if (error) { toast(error.message || 'Save failed', 'error'); return; }
    toast(editing?.id ? 'Template updated ✓' : 'Template created ✓');
    setEditing(null);
    fetchTemplates();
  }

  async function handleDelete(id) {
    const { error } = await supabase
      .from('email_templates')
      .delete()
      .eq('id', id)
      .eq('boutique_id', boutique.id);
    if (error) { toast(error.message || 'Delete failed', 'error'); return; }
    toast('Template deleted');
    setEditing(null);
    setTemplates(t => t.filter(x => x.id !== id));
  }

  const catStyle = (cat) => CAT_COLORS[cat] || CAT_COLORS.general;

  // ── Render ──
  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>

      {/* Left: template list */}
      <div style={{ flex: editing ? '0 0 340px' : 1, minWidth: 0 }}>
        <Card>
          <CardHead
            title="Email templates"
            action="+ New Template"
            onAction={() => setEditing('new')}
          />

          {loading ? (
            <div style={{ padding: '32px 24px', textAlign: 'center', color: C.gray, fontSize: 13 }}>
              Loading…
            </div>
          ) : templates.length === 0 ? (
            <EmptyState onNew={() => setEditing('new')} />
          ) : (
            <div style={{ padding: '0 16px 8px' }}>
              {templates.map((tmpl, i) => {
                const cs = catStyle(tmpl.category);
                const isActive = editing && editing !== 'new' && editing.id === tmpl.id;
                return (
                  <div
                    key={tmpl.id}
                    onClick={() => setEditing(tmpl)}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
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
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {tmpl.name}
                        </span>
                        {!tmpl.is_active && (
                          <Badge text="Inactive" bg={C.grayBg} color={C.gray} />
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: C.gray, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>
                        {tmpl.subject}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Badge
                          text={CATEGORIES.find(c => c.id === tmpl.category)?.label || tmpl.category}
                          bg={cs.bg}
                          color={cs.color}
                        />
                        <span style={{ fontSize: 11, color: C.gray }}>
                          {new Date(tmpl.updated_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div style={{ fontSize: 16, color: C.gray, flexShrink: 0, marginTop: 2 }}>›</div>
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
              />
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
