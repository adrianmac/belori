import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { C, fmt } from '../lib/colors';
import { PrimaryBtn, GhostBtn, Badge, SvcTag, useToast, SkeletonList, inputSt } from '../lib/ui.jsx';
import { supabase } from '../lib/supabase';
import ClientDetail from './clients/ClientDetail.jsx';
import NewClientModal from '../components/modals/NewClientModal.jsx';
import { TIER_CFG } from './clients/clientConfigs.js';
import { getTier, tierMedal, DEFAULT_LOYALTY_TIERS } from '../lib/loyalty';

// ─── BulkMessageModal ─────────────────────────────────────────────────────────
const QUICK_TEMPLATES = [
  {
    label: 'Payment reminder',
    body: 'Hi {{name}}, this is a reminder about your upcoming payment with {{boutique}}. Please contact us at your earliest convenience.',
  },
  {
    label: 'Appointment reminder',
    body: 'Hi {{name}}, reminder of your upcoming appointment at {{boutique}}. Reply STOP to unsubscribe.',
  },
  {
    label: 'Special offer',
    body: 'Hi {{name}}, {{boutique}} has a special offer just for you! Contact us to learn more.',
  },
  {
    label: 'Thank you',
    body: 'Hi {{name}}, thank you for choosing {{boutique}}! We appreciate your trust and look forward to seeing you soon.',
  },
];

const BulkMessageModal = ({ clients, boutiqueName, boutiqueId, onClose }) => {
  const toast = useToast();
  const [channel, setChannel] = useState('sms');
  const [template, setTemplate] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState(null); // null or { current, total }
  const [bulkConfirmed, setBulkConfirmed] = useState(false);
  const [results, setResults] = useState(null); // null = not sent yet, array = done

  // Filter clients by channel capability
  const eligibleClients = clients.filter(cl =>
    channel === 'sms' ? !!cl.phone : !!cl.email
  );
  const visibleClients = eligibleClients.filter(cl => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (cl.name || '').toLowerCase().includes(q) ||
           (cl.phone || '').includes(q) ||
           (cl.email || '').toLowerCase().includes(q);
  });

  // Keep selected set valid when channel changes (remove clients who lost eligibility)
  useEffect(() => {
    setSelected(prev => {
      const eligibleIds = new Set(eligibleClients.map(c => c.id));
      const next = new Set([...prev].filter(id => eligibleIds.has(id)));
      return next;
    });
    setBulkConfirmed(false);
  }, [channel]); // eslint-disable-line react-hooks/exhaustive-deps

  const allVisibleSelected = visibleClients.length > 0 && visibleClients.every(cl => selected.has(cl.id));

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelected(prev => {
        const next = new Set(prev);
        visibleClients.forEach(cl => next.delete(cl.id));
        return next;
      });
    } else {
      setSelected(prev => {
        const next = new Set(prev);
        visibleClients.forEach(cl => next.add(cl.id));
        return next;
      });
    }
  };

  const toggleClient = id => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const interpolate = (msg, cl) =>
    msg.replace(/\{\{name\}\}/g, cl.name || 'there')
       .replace(/\{\{boutique\}\}/g, boutiqueName || 'us');

  const doSend = async () => {
    if (!template.trim() || selected.size === 0) return;
    setSending(true);
    setSendProgress(null);
    const selectedClients = clients.filter(cl => selected.has(cl.id));
    const total = selectedClients.length;
    const res = [];

    for (const cl of selectedClients) {
      const msg = interpolate(template, cl);
      let status = 'sent';

      try {
        if (channel === 'sms') {
          const { error } = await supabase.functions.invoke('send-sms', {
            body: { client_id: cl.id, message: msg },
          });
          if (error) status = 'failed';
        }
        // For email: log interaction regardless (actual sending may not be wired)
        // Log interaction
        await supabase.from('client_interactions').insert({
          boutique_id: boutiqueId,
          client_id: cl.id,
          type: channel === 'sms' ? 'sms_blast' : 'email_blast',
          title: 'Bulk message sent',
          body: msg,
          occurred_at: new Date().toISOString(),
          is_editable: false,
          ...(channel === 'email' && cl.email ? { author_name: boutiqueName } : {}),
        });

        if (channel === 'email') {
          // Attempt edge function for email; failure is non-fatal since we already logged
          await supabase.functions.invoke('send-email', {
            body: {
              to_email: cl.email,
              to_name: cl.name,
              subject: `Message from ${boutiqueName}`,
              html: `<p>${msg.replace(/\n/g, '<br>')}</p>`,
            },
          }).catch(() => {}); // edge function may not exist yet
        }
      } catch {
        status = 'failed';
      }

      res.push({ clientId: cl.id, name: cl.name, status });
      setSendProgress({ current: res.length, total });
      // 100ms delay between sends to avoid rate limits
      await new Promise(r => setTimeout(r, 100));
    }

    setSending(false);
    setSendProgress(null);
    setResults(res);
    const sentCount = res.filter(r => r.status === 'sent').length;
    toast(`Sent to ${sentCount} of ${res.length} client${res.length !== 1 ? 's' : ''}`);
  };

  const smsOver160 = channel === 'sms' && template.length > 160;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div role="dialog" aria-modal="true" aria-labelledby="clients-bulk-message-title" style={{ background: '#fff', borderRadius: 16, maxWidth: '90vw', width: 620, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.18)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '18px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <div id="clients-bulk-message-title" style={{ fontWeight: 600, fontSize: 15, color: C.ink }}>Bulk message clients</div>
            <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>
              {results ? `${results.filter(r => r.status === 'sent').length} sent · ${results.filter(r => r.status === 'failed').length} failed` : `${selected.size} client${selected.size !== 1 ? 's' : ''} selected`}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: C.gray, padding: '4px 8px', minHeight: 32, minWidth: 32 }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {results ? (
            /* Results view */
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.gray, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Send results</div>
              {results.map(r => (
                <div key={r.clientId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, background: r.status === 'sent' ? 'var(--bg-success)' : 'var(--bg-danger)', border: `1px solid ${r.status === 'sent' ? 'var(--color-success)' : 'var(--color-danger)'}20` }}>
                  <span style={{ fontSize: 14 }}>{r.status === 'sent' ? '✓' : '✗'}</span>
                  <span style={{ fontSize: 13, fontWeight: 500, color: C.ink, flex: 1 }}>{r.name}</span>
                  <span style={{ fontSize: 11, color: r.status === 'sent' ? 'var(--text-success)' : 'var(--text-danger)', fontWeight: 600, textTransform: 'uppercase' }}>{r.status}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', height: '100%' }}>
              {/* Left: client selector */}
              <div style={{ width: 240, borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                <div style={{ padding: '10px 12px', borderBottom: `1px solid ${C.border}` }}>
                  {/* Channel toggle */}
                  <div style={{ display: 'flex', border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', marginBottom: 8 }}>
                    {[['sms', 'SMS'], ['email', 'Email']].map(([v, lbl]) => (
                      <button key={v} onClick={() => setChannel(v)} style={{ flex: 1, padding: '6px', border: 'none', background: channel === v ? C.rosa : '#fff', color: channel === v ? '#fff' : C.gray, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{lbl}</button>
                    ))}
                  </div>
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." style={{ ...inputSt, fontSize: 12, padding: '6px 10px' }} />
                </div>
                {/* Select all */}
                <div style={{ padding: '8px 12px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAll} style={{ cursor: 'pointer', accentColor: C.rosa }} />
                  <span style={{ fontSize: 11, color: C.gray, fontWeight: 500 }}>
                    {allVisibleSelected ? 'Deselect all' : `Select all (${visibleClients.length})`}
                  </span>
                </div>
                {/* Client list */}
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  {visibleClients.length === 0 ? (
                    <div style={{ padding: '20px 12px', textAlign: 'center', color: C.gray, fontSize: 12 }}>
                      No clients with {channel === 'sms' ? 'phone' : 'email'} on file
                    </div>
                  ) : visibleClients.map(cl => (
                    <label key={cl.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', cursor: 'pointer', borderBottom: `1px solid ${C.border}`, background: selected.has(cl.id) ? C.rosaPale : '#fff', transition: 'background 0.1s' }}>
                      <input type="checkbox" checked={selected.has(cl.id)} onChange={() => toggleClient(cl.id)} style={{ cursor: 'pointer', accentColor: C.rosa, flexShrink: 0 }} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cl.name}</div>
                        <div style={{ fontSize: 10, color: C.gray, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{channel === 'sms' ? cl.phone : cl.email}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Right: composer */}
              <div style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Quick templates */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.gray, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Quick templates</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {QUICK_TEMPLATES.map(t => (
                      <button key={t.label} onClick={() => setTemplate(t.body)}
                        style={{ padding: '5px 10px', borderRadius: 6, border: `1px solid ${C.border}`, background: template === t.body ? C.rosaPale : '#fff', color: template === t.body ? C.rosaText : C.gray, fontSize: 11, cursor: 'pointer', fontWeight: 500 }}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Message textarea */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: C.gray, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Message</div>
                    <div style={{ fontSize: 10, color: smsOver160 ? 'var(--text-danger)' : C.gray }}>
                      {template.length} chars{smsOver160 ? ' — over 160 (multi-part SMS)' : ''}
                    </div>
                  </div>
                  <textarea
                    value={template}
                    onChange={e => setTemplate(e.target.value)}
                    placeholder={`Type your message...\n\nVariables: {{name}}, {{boutique}}`}
                    style={{ flex: 1, minHeight: 140, padding: '10px 12px', border: `1px solid ${smsOver160 ? 'var(--color-danger)' : C.border}`, borderRadius: 8, fontSize: 13, resize: 'none', outline: 'none', fontFamily: 'inherit', lineHeight: 1.5, boxSizing: 'border-box' }}
                  />
                  <div style={{ fontSize: 10, color: C.gray }}>
                    Variables: <code style={{ background: C.ivory, padding: '1px 4px', borderRadius: 3 }}>{'{{name}}'}</code> <code style={{ background: C.ivory, padding: '1px 4px', borderRadius: 3 }}>{'{{boutique}}'}</code>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
          {/* Bulk confirmation gate — shown when > 5 recipients and not yet sending */}
          {!results && !sending && selected.size > 5 && (
            <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 12, color: '#92400E', fontWeight: 500 }}>
                ⚠️ Sending to {selected.size} clients — this cannot be undone
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: '#92400E' }}>
                <input type="checkbox" checked={bulkConfirmed} onChange={e => setBulkConfirmed(e.target.checked)} style={{ accentColor: '#D97706', cursor: 'pointer' }}/>
                ✓ I confirm I want to send this message to {selected.size} clients
              </label>
            </div>
          )}
          {/* Progress indicator */}
          {sending && sendProgress && (
            <div style={{ fontSize: 12, color: C.gray, textAlign: 'center', padding: '4px 0' }}>
              Sending… {sendProgress.current} of {sendProgress.total}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '9px', borderRadius: 8, border: `1px solid ${C.border}`, background: '#fff', fontSize: 13, cursor: 'pointer', color: C.gray }}>
              {results ? 'Close' : 'Cancel'}
            </button>
            {!results && (() => {
              const needsConfirm = selected.size > 5 && !bulkConfirmed;
              const isDisabled = sending || selected.size === 0 || !template.trim() || needsConfirm;
              return (
                <button onClick={doSend}
                  disabled={isDisabled}
                  style={{ flex: 2, padding: '9px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600, cursor: isDisabled ? 'default' : 'pointer', background: isDisabled ? '#e5e7eb' : C.rosa, color: isDisabled ? C.gray : '#fff' }}>
                  {sending ? (sendProgress ? `Sending… ${sendProgress.current} of ${sendProgress.total}` : 'Sending…') : `Send to ${selected.size} client${selected.size !== 1 ? 's' : ''}`}
                </button>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── (MergeDuplicatesModal removed — merge UI is inline in Clients component) ──

// ─── Referral Tree ────────────────────────────────────────────────────────────
function buildReferralTree(clients) {
  const byName = {};
  for (const c of clients) byName[c.name] = c;

  function getChildren(name) {
    return clients.filter(c => c.referred_by === name);
  }

  function renderNode(client, depth = 0) {
    const children = getChildren(client.name);
    return {
      client,
      children: children.map(c => renderNode(c, depth + 1)),
      depth,
    };
  }

  const roots = clients.filter(c => !c.referred_by || !byName[c.referred_by]);
  return roots.map(r => renderNode(r));
}

function TreeNode({ node, onSelectClient }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  return (
    <div style={{ marginLeft: node.depth > 0 ? 24 : 0 }}>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8, cursor: 'pointer', background: node.depth === 0 ? C.rosaPale : 'transparent' }}
        onClick={() => onSelectClient(node.client)}
      >
        {hasChildren ? (
          <button
            onClick={e => { e.stopPropagation(); setExpanded(!expanded); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.gray, fontSize: 12, padding: 0, width: 16, flexShrink: 0 }}
          >
            {expanded ? '▼' : '▶'}
          </button>
        ) : (
          <span style={{ width: 16, flexShrink: 0 }} />
        )}
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: C.rosa, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
          {node.client.name.slice(0, 1)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{node.client.name}</div>
          {hasChildren && <div style={{ fontSize: 10, color: C.gray }}>{node.children.length} referral{node.children.length > 1 ? 's' : ''}</div>}
        </div>
        {node.client.loyalty_points > 0 && (
          <span style={{ fontSize: 10, color: C.rosaText, flexShrink: 0 }}>⭐ {node.client.loyalty_points} pts</span>
        )}
      </div>
      {expanded && hasChildren && node.children.map((child, i) => (
        <TreeNode key={i} node={child} onSelectClient={onSelectClient} />
      ))}
    </div>
  );
}

const ReferralTree = ({ clients, onSelectClient }) => {
  const tree = buildReferralTree(clients);
  const totalReferrals = clients.filter(c => c.referred_by).length;
  const referrerCounts = {};
  for (const c of clients) {
    if (c.referred_by) referrerCounts[c.referred_by] = (referrerCounts[c.referred_by] || 0) + 1;
  }
  const topReferrerName = Object.keys(referrerCounts).sort((a, b) => referrerCounts[b] - referrerCounts[a])[0];
  const topReferrerCount = topReferrerName ? referrerCounts[topReferrerName] : 0;

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
      {totalReferrals > 0 && (
        <div style={{ padding: '10px 16px', background: C.rosaPale, border: `1px solid ${C.petal}`, borderRadius: 10, marginBottom: 16, fontSize: 12, color: C.ink, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <span><strong>{totalReferrals}</strong> total referral{totalReferrals !== 1 ? 's' : ''}</span>
          {topReferrerName && <span>Top referrer: <strong>{topReferrerName}</strong> ({topReferrerCount} referral{topReferrerCount !== 1 ? 's' : ''})</span>}
        </div>
      )}
      <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
        {tree.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: C.gray, fontSize: 13 }}>No clients yet.</div>
        ) : tree.map((node, i) => (
          <TreeNode key={i} node={node} onSelectClient={onSelectClient} />
        ))}
      </div>
    </div>
  );
};

const ClientImportModal = ({ onClose, createClient }) => {
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [valid, setValid] = useState([]);
  const [errors, setErrors] = useState([]);
  const [totalRows, setTotalRows] = useState(0);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(0);

  const parseCSV = text => {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return { headers: [], rows: [] };
    const hdrs = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
    const parsed = lines.slice(1).map(line => {
      const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      return Object.fromEntries(hdrs.map((h, i) => [h, vals[i] || '']));
    });
    return { headers: hdrs, rows: parsed };
  };

  const findKey = (hdrs, options) => hdrs.find(h => options.includes(h));

  const handleFile = file => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      const { headers: hdrs, rows: parsed } = parseCSV(e.target.result);
      const nameK = findKey(hdrs, ['name', 'full name', 'full_name', 'client name', 'client_name']) || hdrs[0];
      const phoneK = findKey(hdrs, ['phone', 'phone number', 'phone_number', 'mobile', 'cell']);
      const emailK = findKey(hdrs, ['email', 'email address', 'email_address']);
      const partnerK = findKey(hdrs, ['partner_name', 'partner name', 'partner', 'honoree']);
      const birthdayK = findKey(hdrs, ['birthday', 'birth_date', 'birthdate', 'dob', 'date of birth']);
      const anniversaryK = findKey(hdrs, ['anniversary', 'anniversary_date', 'wedding_date', 'wedding date']);
      const referredK = findKey(hdrs, ['referred_by', 'referred by', 'referral', 'how found', 'how_found']);
      const notesK = findKey(hdrs, ['notes', 'note', 'comments', 'comment']);

      const v = [], errs = [];
      parsed.forEach((row, i) => {
        const name = row[nameK]?.trim();
        const erList = [];
        if (!name) erList.push('Missing name');
        const mapped = {
          name,
          phone: phoneK ? row[phoneK]?.trim() || null : null,
          email: emailK ? row[emailK]?.trim() || null : null,
          partner_name: partnerK ? row[partnerK]?.trim() || null : null,
          birthday: birthdayK ? row[birthdayK]?.trim() || null : null,
          anniversary: anniversaryK ? row[anniversaryK]?.trim() || null : null,
          referred_by: referredK ? row[referredK]?.trim() || null : null,
          notes: notesK ? row[notesK]?.trim() || null : null,
        };
        if (erList.length) errs.push({ row: i + 2, errors: erList, data: mapped });
        else v.push(mapped);
      });
      setValid(v); setErrors(errs); setTotalRows(parsed.length); setStep(2);
    };
    reader.readAsText(file);
  };

  const doImport = async () => {
    setImporting(true);
    let count = 0;
    for (const row of valid) {
      await createClient(row);
      count++;
      setImported(count);
    }
    setImporting(false);
    setStep(3);
    if (count > 0) toast(`${count} client${count !== 1 ? 's' : ''} imported`);
  };


  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div role="dialog" aria-modal="true" aria-labelledby="clients-import-csv-title" style={{ background: '#fff', borderRadius: 16, width: 560, maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div id="clients-import-csv-title" style={{ fontWeight: 600, fontSize: 16, color: C.ink }}>Import clients from CSV</div>
            <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>Step {step} of 3 · {step === 1 ? 'Upload file' : step === 2 ? 'Review & confirm' : 'Complete'}</div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: C.gray, lineHeight: 1, padding: '4px 8px', minHeight: 32, minWidth: 32 }}>×</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <label style={{ border: `2px dashed ${C.border}`, borderRadius: 12, padding: 40, textAlign: 'center', cursor: 'pointer', display: 'block', transition: 'border-color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = C.rosa}
                onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>📁</div>
                <div style={{ fontSize: 14, fontWeight: 500, color: C.ink, marginBottom: 4 }}>Drag & drop your CSV file here</div>
                <div style={{ fontSize: 12, color: C.gray, marginBottom: 16 }}>CSV format · Max 500 clients</div>
                <div style={{ display: 'inline-block', padding: '8px 20px', borderRadius: 8, background: C.rosaPale, color: C.rosaText, fontSize: 13, fontWeight: 500 }}>Choose file</div>
                <input type="file" accept=".csv,.tsv" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
              </label>
              <div style={{ fontSize: 11, color: C.gray, textAlign: 'center', lineHeight: 1.7 }}>
                Required column: <strong>name</strong><br />
                Optional: <strong>phone, email, partner_name, birthday, anniversary, referred_by, notes</strong><br />
                Dates should be in YYYY-MM-DD format · Column headers are case-insensitive
              </div>
            </div>
          )}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                {[
                  { label: 'Ready to import', val: valid.length, col: 'var(--text-success)', bg: 'var(--bg-success)' },
                  { label: 'Rows with errors', val: errors.length, col: errors.length ? 'var(--text-danger)' : C.gray, bg: errors.length ? 'var(--bg-danger)' : C.grayBg },
                  { label: 'Total rows', val: totalRows, col: C.ink, bg: C.ivory },
                ].map(s => (
                  <div key={s.label} style={{ background: s.bg, borderRadius: 8, padding: 12, textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 600, color: s.col }}>{s.val}</div>
                    <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>
              {errors.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-danger)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Errors — will be skipped</div>
                  {errors.slice(0, 5).map((e, i) => (
                    <div key={i} style={{ fontSize: 11, color: 'var(--text-danger)', background: 'var(--bg-danger)', padding: '6px 10px', borderRadius: 6, marginBottom: 4 }}>Row {e.row}: {e.errors.join(' · ')}</div>
                  ))}
                  {errors.length > 5 && <div style={{ fontSize: 11, color: C.gray }}>{errors.length - 5} more errors…</div>}
                </div>
              )}
              {valid.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.gray, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Preview (first 5)</div>
                  <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', fontSize: 11 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', background: C.ivory, padding: '8px 10px', fontWeight: 500, color: C.gray, gap: 4 }}>
                      {['Name', 'Phone', 'Email', 'Birthday'].map(h => <div key={h}>{h}</div>)}
                    </div>
                    {valid.slice(0, 5).map((r, i) => (
                      <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', padding: '7px 10px', borderTop: `1px solid ${C.border}`, color: C.ink, gap: 4 }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.phone || '—'}</div>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.email || '—'}</div>
                        <div>{r.birthday || '—'}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {step === 3 && (
            <div style={{ textAlign: 'center', padding: '30px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: C.ink, marginBottom: 8 }}>Import complete!</div>
              <div style={{ fontSize: 13, color: C.gray, marginBottom: 4 }}>{imported} client{imported !== 1 ? 's' : ''} added</div>
              {errors.length > 0 && <div style={{ fontSize: 12, color: 'var(--text-danger)' }}>{errors.length} row{errors.length !== 1 ? 's' : ''} skipped due to errors</div>}
            </div>
          )}
        </div>
        <div style={{ padding: '12px 24px', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 8, border: `1px solid ${C.border}`, background: '#fff', fontSize: 13, cursor: 'pointer', color: C.gray }}>{step === 3 ? 'Close' : 'Cancel'}</button>
          {step === 2 && valid.length > 0 && (
            <button onClick={doImport} disabled={importing}
              style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: importing ? C.border : C.rosa, color: '#fff', fontSize: 13, fontWeight: 600, cursor: importing ? 'default' : 'pointer' }}>
              {importing ? `Importing ${imported}/${valid.length}…` : `Import ${valid.length} client${valid.length !== 1 ? 's' : ''}`}
            </button>
          )}
          {step === 3 && (
            <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: C.rosa, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Done</button>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── CSV EXPORT HELPER ─────────────────────────────────────────────────────
function downloadCSV(rows, filename) {
  if (!rows || rows.length === 0) return;
  const header = Object.keys(rows[0]).join(',');
  const body = rows.map(r => Object.values(r).map(v => `"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([header + '\n' + body], {type:'text/csv'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
}

// ─── BULK SMS MODAL ────────────────────────────────────────────────────────
const BulkSmsModal = ({ clients, boutiqueName, boutiqueId, onClose, toast }) => {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const eligible = clients.filter(c => !!c.phone);
  const requiresConfirmation = eligible.length > 10;

  const doSend = async () => {
    if (!message.trim() || !eligible.length) return;
    if (requiresConfirmation && !confirmed) return;
    setSending(true);
    const results = [];
    for (const cl of eligible) {
      const msg = message.replace(/\{\{name\}\}/g, cl.name||'there').replace(/\{\{boutique\}\}/g, boutiqueName||'us');
      const { error } = await supabase.functions.invoke('send-sms', { body: { client_id: cl.id, message: msg } });
      const success = !error;
      if (success) {
        await supabase.from('client_interactions').insert({
          boutique_id: boutiqueId, client_id: cl.id, type: 'sms_blast',
          title: 'Bulk SMS sent', body: msg, occurred_at: new Date().toISOString(), is_editable: false,
        });
      }
      results.push({ name: cl.name, success });
      // Rate limiting: small delay between sends
      await new Promise(r => setTimeout(r, 100));
    }
    const sentCount = results.filter(r => r.success).length;
    const failedClients = results.filter(r => !r.success).map(r => r.name);
    toast(`SMS sent to ${sentCount} of ${results.length} client${results.length !== 1 ? 's' : ''} ✓`);
    if (failedClients.length > 0) {
      toast(`Failed: ${failedClients.join(', ')}`, 'warn');
    }
    onClose();
  };

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:300,padding:16}}>
      <div role="dialog" aria-modal="true" aria-labelledby="clients-bulk-sms-title" style={{background:C.white,borderRadius:16,width:480,boxShadow:'0 20px 60px rgba(0,0,0,0.15)',overflow:'hidden'}}>
        <div style={{padding:'18px 20px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span id="clients-bulk-sms-title" style={{fontWeight:600,fontSize:15,color:C.ink}}>Send SMS to {eligible.length} client{eligible.length!==1?'s':''}</span>
          <button onClick={onClose} aria-label="Close" style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:C.gray,lineHeight:1,padding:'4px 8px',minHeight:32,minWidth:32}}>×</button>
        </div>
        <div style={{padding:20,display:'flex',flexDirection:'column',gap:14}}>
          {clients.length > eligible.length && (
            <div style={{fontSize:12,color:C.warningText,background:C.amberBg,padding:'8px 12px',borderRadius:8}}>
              {clients.length - eligible.length} client{clients.length-eligible.length!==1?'s':''} skipped (no phone on file)
            </div>
          )}
          {requiresConfirmation && (
            <div style={{fontSize:12,color:'#92400E',background:'#FEF3C7',border:'1px solid #F59E0B',padding:'10px 12px',borderRadius:8}}>
              You are about to send SMS to {eligible.length} clients. This cannot be undone.
            </div>
          )}
          <div style={{fontSize:11,color:C.gray}}>Use {'{{name}}'} and {'{{boutique}}'} for personalization.</div>
          <textarea
            value={message}
            onChange={e=>setMessage(e.target.value)}
            rows={5}
            placeholder="Hi {{name}}, this is a message from {{boutique}}…"
            style={{width:'100%',padding:'10px 12px',borderRadius:9,border:`1px solid ${C.border}`,fontSize:13,resize:'vertical',boxSizing:'border-box',outline:'none',fontFamily:'inherit'}}
          />
          {requiresConfirmation && (
            <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:12,color:C.ink}}>
              <input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} style={{width:15,height:15,cursor:'pointer',accentColor:C.rosa,flexShrink:0}}/>
              I confirm I want to send this message to {eligible.length} clients
            </label>
          )}
        </div>
        <div style={{padding:'12px 20px',borderTop:`1px solid ${C.border}`,display:'flex',gap:8,justifyContent:'flex-end'}}>
          <GhostBtn label="Cancel" onClick={onClose}/>
          <PrimaryBtn label={sending ? 'Sending…' : `Send to ${eligible.length} client${eligible.length!==1?'s':''}`} onClick={doSend} disabled={sending||!message.trim()||(requiresConfirmation&&!confirmed)}/>
        </div>
      </div>
    </div>
  );
};

// ─── BULK ADD TAG MODAL ────────────────────────────────────────────────────
const BulkAddTagModal = ({ boutiqueId, selectedIds, onClose, toast }) => {
  const [tags, setTags] = useState([]);
  const [chosenTag, setChosenTag] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!boutiqueId) return;
    supabase.from('client_tag_definitions').select('*').eq('boutique_id', boutiqueId).then(({ data }) => {
      if (data) setTags(data);
    });
  }, [boutiqueId]);

  const doApply = async () => {
    if (!chosenTag || !selectedIds.length) return;
    setSaving(true);
    const rows = selectedIds.map(id => ({ boutique_id: boutiqueId, client_id: id, tag_id: chosenTag.id }));
    const { error } = await supabase.from('client_tag_assignments').upsert(rows, { onConflict: 'boutique_id,client_id,tag_id', ignoreDuplicates: true });
    if (error) toast('Failed to apply tag', 'error');
    else { toast(`Tag "${chosenTag.name}" applied to ${selectedIds.length} client${selectedIds.length!==1?'s':''} ✓`); onClose(); }
    setSaving(false);
  };

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:300,padding:16}}>
      <div role="dialog" aria-modal="true" aria-labelledby="clients-bulk-tag-title" style={{background:C.white,borderRadius:16,width:400,boxShadow:'0 20px 60px rgba(0,0,0,0.15)',overflow:'hidden'}}>
        <div style={{padding:'18px 20px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span id="clients-bulk-tag-title" style={{fontWeight:600,fontSize:15,color:C.ink}}>Add tag to {selectedIds.length} client{selectedIds.length!==1?'s':''}</span>
          <button onClick={onClose} aria-label="Close" style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:C.gray,lineHeight:1,padding:'4px 8px',minHeight:32,minWidth:32}}>×</button>
        </div>
        <div style={{padding:20,display:'flex',flexDirection:'column',gap:10}}>
          {tags.length === 0 ? (
            <div style={{fontSize:13,color:C.gray,textAlign:'center',padding:'20px 0'}}>No tag definitions found. Create tags in client settings first.</div>
          ) : tags.map(tag => (
            <label key={tag.id} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',borderRadius:9,border:`1.5px solid ${chosenTag?.id===tag.id?C.rosa:C.border}`,cursor:'pointer',background:chosenTag?.id===tag.id?C.rosaPale:C.white,transition:'all 0.1s'}}>
              <input type="radio" name="bulk_tag" checked={chosenTag?.id===tag.id} onChange={()=>setChosenTag(tag)} style={{accentColor:C.rosa}}/>
              <span style={{width:10,height:10,borderRadius:'50%',background:tag.color||C.rosa,flexShrink:0}}/>
              <span style={{fontSize:13,color:C.ink,fontWeight:500}}>{tag.name}</span>
              {tag.category && <span style={{fontSize:11,color:C.gray,marginLeft:'auto'}}>{tag.category}</span>}
            </label>
          ))}
        </div>
        <div style={{padding:'12px 20px',borderTop:`1px solid ${C.border}`,display:'flex',gap:8,justifyContent:'flex-end'}}>
          <GhostBtn label="Cancel" onClick={onClose}/>
          <PrimaryBtn label={saving ? 'Applying…' : 'Apply tag'} onClick={doApply} disabled={saving||!chosenTag}/>
        </div>
      </div>
    </div>
  );
};

const Clients = ({ setScreen, setSelectedEvent, clients: liveClients, clientsLoading, createClient, updateClient, adjustLoyaltyPoints, redeemPoints, adjustPoints, mergeClients, inventory }) => {
  const toast = useToast();
  const { boutique: clBoutique } = useAuth();
  const rawClients = liveClients;
  const loyaltyTiers = clBoutique?.loyalty_tiers || DEFAULT_LOYALTY_TIERS;

  const [selCl, setSelCl] = useState(null);
  const [view, setView] = useState('list');
  const [showTree, setShowTree] = useState(false);
  const [filter, setFilter] = useState('all');
  const [tierFilter, setTierFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showMerge, setShowMerge] = useState(false);
  const [mergeGroups, setMergeGroups] = useState([]);
  const [merging, setMerging] = useState(false);
  const [selectedMerge, setSelectedMerge] = useState(null); // {keep: clientId, remove: clientId, groupIdx: number}
  const [showImport, setShowImport] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [sortCol, setSortCol] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [editingCell, setEditingCell] = useState(null); // { clientId, field }
  const [cellValue, setCellValue] = useState('');
  const [hoveredCell, setHoveredCell] = useState(null); // { clientId, field }
  // Bulk selection state
  const [bulkSelected, setBulkSelected] = useState(new Set());
  const [bulkWorking, setBulkWorking] = useState(false);
  const [showSmsModal, setShowSmsModal] = useState(false);
  const [showTagModal, setShowTagModal] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;
  const [newClientId, setNewClientId] = useState(null);
  const [showBookEvent, setShowBookEvent] = useState(false);

  // Auto-dismiss "book event" prompt after 8 seconds
  useEffect(() => {
    if (!showBookEvent) return;
    const t = setTimeout(() => setShowBookEvent(false), 8000);
    return () => clearTimeout(t);
  }, [showBookEvent]);

  // Auto-select client from global search or open new modal from onboarding checklist
  useEffect(()=>{
    const autoOpen=sessionStorage.getItem('belori_autoopen');
    const autoSelect=sessionStorage.getItem('belori_select_client');
    if(autoOpen==='new_client'){sessionStorage.removeItem('belori_autoopen');setShowNew(true);}
    if(autoSelect){sessionStorage.removeItem('belori_select_client');const cl=liveClients.find(c=>c.id===autoSelect);if(cl)setSelCl(cl);}
  },[liveClients]);

  // Debounced search value (300ms)
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Reset pagination when search or filter changes
  useEffect(() => { setPage(1); }, [debouncedSearch, filter, tierFilter, sortCol, sortDir]);

  // Bulk selection helpers
  const anyBulkSelected = bulkSelected.size > 0;
  const toggleBulkSelect = (id) => setBulkSelected(s => { const n=new Set(s); n.has(id)?n.delete(id):n.add(id); return n; });
  const clearBulkSelection = () => setBulkSelected(new Set());

  const findDuplicates = () => {
    const phoneMap = {};
    const emailMap = {};
    const dupeGroups = [];
    const seen = new Set();

    (rawClients||[]).forEach(c => {
      if (c.phone) {
        const p = c.phone.replace(/\D/g,'');
        if (p.length >= 7) {
          if (!phoneMap[p]) phoneMap[p] = [];
          phoneMap[p].push(c);
        }
      }
      if (c.email) {
        const e = c.email.toLowerCase().trim();
        if (!emailMap[e]) emailMap[e] = [];
        emailMap[e].push(c);
      }
    });

    Object.values(phoneMap).filter(g=>g.length>1).forEach(g=>{
      const key = g.map(c=>c.id).sort().join('-');
      if (!seen.has(key)) { seen.add(key); dupeGroups.push({reason:'Same phone',clients:g}); }
    });
    Object.values(emailMap).filter(g=>g.length>1).forEach(g=>{
      const key = g.map(c=>c.id).sort().join('-');
      if (!seen.has(key)) { seen.add(key); dupeGroups.push({reason:'Same email',clients:g}); }
    });

    return dupeGroups;
  };

  const bulkExportClients = () => {
    const rows = rawClients.filter(c=>bulkSelected.has(c.id)).map(c=>({
      name: c.name||'',
      phone: c.phone||'',
      email: c.email||'',
      loyalty_points: c.loyalty_points||0,
    }));
    downloadCSV(rows,'clients-export.csv');
    toast(`${rows.length} clients exported ✓`);
    clearBulkSelection();
  };

  if (clientsLoading && !rawClients?.length) return <SkeletonList count={5} style={{padding:'0 16px',marginTop:16}}/>;

  const todayStr = new Date().toISOString().slice(0, 10);

  const { filtered, vipCount, lifetimeRev, returningCount, overdueCount } = useMemo(() => {
    const clients = rawClients || [];
    const filtered = clients.filter(cl => {
      if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase();
        const name = (cl.name || `${cl.firstName || ''} ${cl.lastName || ''}`).toLowerCase();
        if (!name.includes(q) && !(cl.phone || '').includes(q)) return false;
      }
      if (filter === 'vip') return ['vip', 'diamond'].includes(cl.tier || 'new');
      if (filter === 'loyal') return (cl.tier || 'new') === 'loyal';
      if (filter === 'new') return (cl.tier || 'new') === 'new';
      if (filter === 'overdue') return cl.hasOverdue;
      if (filter === 'returning') return (cl.totalEvents || cl.events?.length || 0) > 1;
      if (tierFilter !== 'all') {
        const pts = cl.loyalty_points || 0;
        const t = getTier(pts, loyaltyTiers);
        if (t.name !== tierFilter) return false;
      }
      return true;
    });
    return {
      filtered,
      vipCount: clients.filter(c => ['vip', 'diamond'].includes(c.tier || 'new')).length,
      lifetimeRev: clients.reduce((s, c) => s + (c.totalSpent || (c.events || []).reduce((es, e) => es + Number(e.total || 0), 0)), 0),
      returningCount: clients.filter(c => (c.totalEvents || c.events?.length || 0) > 1).length,
      overdueCount: clients.filter(c => c.hasOverdue).length,
    };
  }, [rawClients, debouncedSearch, filter, tierFilter, loyaltyTiers]);

  const handleSort = col => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };
  const sortIcon = col => sortCol === col
    ? <span style={{color:C.rosaText,fontSize:8,marginLeft:3,lineHeight:1}}>{sortDir==='asc'?'▲':'▼'}</span>
    : <span style={{color:'#D1D5DB',fontSize:8,marginLeft:3,lineHeight:1}}>⇅</span>;
  const sortedFiltered = useMemo(() => [...filtered].sort((a, b) => {
    let av, bv;
    switch (sortCol) {
      case 'name':      av = (a.name||'').toLowerCase(); bv = (b.name||'').toLowerCase(); break;
      case 'phone':     av = a.phone||''; bv = b.phone||''; break;
      case 'partner':   av = (a.partner_name||'').toLowerCase(); bv = (b.partner_name||'').toLowerCase(); break;
      case 'events':    av = a.totalEvents||0; bv = b.totalEvents||0; break;
      case 'spent':     av = a.totalSpent||0; bv = b.totalSpent||0; break;
      case 'points':    av = a.loyalty_points||0; bv = b.loyalty_points||0; break;
      case 'birthday':  av = a.birthday||'9999'; bv = b.birthday||'9999'; break;
      case 'tier':      { const o={diamond:0,vip:1,loyal:2,regular:3,new:4}; av=o[a.tier||'new']||4; bv=o[b.tier||'new']||4; break; }
      case 'nextEvent': {
        const ne = cl => (cl.events||[]).filter(e=>e.event_date>todayStr&&e.status!=='cancelled').sort((x,y)=>x.event_date.localeCompare(y.event_date))[0]?.event_date||'9999';
        av = ne(a); bv = ne(b); break;
      }
      case 'status':      av = a.hasOverdue?0:1; bv = b.hasOverdue?0:1; break;
      case 'lastContact': av = new Date(a.last_contacted_at||0); bv = new Date(b.last_contacted_at||0); break;
      default:            av = (a.name||'').toLowerCase(); bv = (b.name||'').toLowerCase();
    }
    if (typeof av === 'string' && typeof bv === 'string') {
      const r = av.localeCompare(bv);
      return sortDir === 'asc' ? r : -r;
    }
    return sortDir === 'asc' ? av - bv : bv - av;
  }), [filtered, sortCol, sortDir, todayStr]);

  const paginatedSorted = sortedFiltered.slice(0, page * PAGE_SIZE);
  const paginatedFiltered = filtered.slice(0, page * PAGE_SIZE);

  const activeCl = selCl ? (liveClients.find(c => c.id === selCl.id) || selCl) : null;
  if(activeCl) {
    return <ClientDetail
      cl={activeCl}
      onBack={() => setSelCl(null)}
      setSelectedEvent={setSelectedEvent}
      setScreen={setScreen}
      updateClient={updateClient}
      adjustLoyaltyPoints={adjustLoyaltyPoints}
      redeemPoints={redeemPoints}
      adjustPoints={adjustPoints}
      inventory={inventory}
    />;
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* TOPBAR */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', background: C.white, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 500, color: C.ink }}>Clients</div>
          <div style={{ fontSize: 12, color: C.gray }}>{rawClients.length} clients · {fmt(lifetimeRev)} total revenue</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ display: 'flex', border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
            {[['list', '☰'], ['grid', '⊞']].map(([v, icon]) => (
              <button key={v} onClick={() => { setView(v); setShowTree(false); }} style={{ padding: '7px 12px', border: 'none', background: !showTree && view === v ? C.rosaPale : C.white, color: !showTree && view === v ? C.rosaText : C.gray, cursor: 'pointer', fontSize: 14 }}>{icon}</button>
            ))}
          </div>
          {rawClients.some(c => c.referred_by) && (
            <button onClick={() => setShowTree(t => !t)} style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${showTree ? C.rosa : C.border}`, background: showTree ? C.rosaPale : '#fff', fontSize: 12, color: showTree ? C.rosaText : C.gray, cursor: 'pointer', fontWeight: 500 }}>🌳 Referral tree</button>
          )}
          <button onClick={() => setShowBulk(true)} style={{padding:'7px 14px',borderRadius:8,border:`1px solid ${C.border}`,background:'#fff',fontSize:12,color:C.gray,cursor:'pointer',fontWeight:500}}>📣 Bulk message</button>
          <GhostBtn label="Find duplicates" onClick={() => { const groups = findDuplicates(); setMergeGroups(groups); setShowMerge(true); }} />
          <button onClick={() => setShowImport(true)} style={{padding:'7px 14px',borderRadius:8,border:`1px solid ${C.border}`,background:'#fff',fontSize:12,color:C.gray,cursor:'pointer',fontWeight:500}}>⬆ Import CSV</button>
          <PrimaryBtn label="+ New client" colorScheme="success" onClick={() => setShowNew(true)} />
        </div>
      </div>
      {/* STAT STRIP */}
      <div className="stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, padding: '16px 20px', background: C.ivory, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        {[{ label: 'Total clients', val: String(rawClients.length), col: C.ink }, { label: 'VIP clients', val: String(vipCount), col: vipCount > 0 ? '#B45309' : C.gray }, { label: 'Lifetime revenue', val: fmt(lifetimeRev), col: 'var(--text-success)' }, { label: 'Returning clients', val: String(returningCount), col: returningCount > 0 ? C.purple : C.gray }].map((s, i) => (
          <div key={s.label} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
            <div style={{ fontSize: 22, fontWeight: 600, color: s.col, lineHeight: 1, marginBottom: 6 }}>{s.val}</div>
            <div style={{ fontSize: 12, color: C.gray, fontWeight: 500 }}>{s.label}</div>
          </div>
        ))}
      </div>
      {/* FILTER BAR */}
      <div style={{ padding: '16px 20px', background: C.white, borderBottom: `1px solid ${C.border}`, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12, position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <svg style={{ position: 'absolute', left: 14, color: C.gray }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clients by name, phone, or email..." style={{ width: '100%', padding: '10px 14px 10px 38px', borderRadius: 10, border: `1px solid ${search ? C.rosa : C.border}`, fontSize: 'var(--text-input)', outline: 'none', boxSizing: 'border-box', background: C.grayBg, transition: 'all 0.2s', boxShadow: search ? `0 0 0 3px ${C.rosaPale}` : 'inset 0 1px 2px rgba(0,0,0,0.02)' }} onFocus={e => { e.target.style.borderColor = C.rosa; e.target.style.boxShadow = `0 0 0 3px ${C.rosaPale}`; }} onBlur={e => { if (!search) { e.target.style.borderColor = C.border; e.target.style.boxShadow = 'inset 0 1px 2px rgba(0,0,0,0.02)'; } }} />
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {[['all', `All (${rawClients.length})`], ['vip', `VIP (${vipCount})`], ['loyal', 'Loyal'], ['new', 'New'], ['overdue', `Has overdue (${overdueCount})`], ['returning', 'Returning']].map(([f, label]) => (
            <button key={f} onClick={() => setFilter(f)} style={{ padding: '6px 14px', borderRadius: 999, border: `1px solid ${C.border}`, background: filter === f ? C.ink : C.white, color: filter === f ? C.white : C.gray, fontSize: 'var(--btn-font-ghost)', cursor: 'pointer', fontWeight: 500, whiteSpace: 'nowrap', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }} onMouseEnter={e => { if (filter !== f) e.currentTarget.style.background = C.grayBg; }} onMouseLeave={e => { if (filter !== f) e.currentTarget.style.background = C.white; }}>{label}</button>
          ))}
          {/* Tier filter dropdown */}
          <select
            value={tierFilter}
            onChange={e => setTierFilter(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 999, border: `1px solid ${tierFilter !== 'all' ? C.rosa : C.border}`, background: tierFilter !== 'all' ? C.rosaPale : C.white, color: tierFilter !== 'all' ? C.rosaText : C.gray, fontSize: 12, cursor: 'pointer', fontWeight: 500, outline: 'none' }}>
            <option value="all">All tiers</option>
            {loyaltyTiers.map(t => (
              <option key={t.name} value={t.name}>{tierMedal(t.name)} {t.name}</option>
            ))}
          </select>
        </div>
      </div>
      {/* REFERRAL TREE VIEW */}
      {showTree && (
        <ReferralTree clients={rawClients} onSelectClient={cl => { setShowTree(false); setSelCl(cl); }} />
      )}
      {/* CLIENT CARDS */}
      {!showTree && <div className="page-scroll" style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', padding: 20 }}>
        {filtered.length === 0 ? (
          rawClients.length === 0 ? (
            /* True empty state — no clients exist at all */
            <div style={{ textAlign: 'center', padding: '80px 20px', background: C.white, borderRadius: 16, border: `1px dashed ${C.border}`, maxWidth: 520, margin: '40px auto' }}>
              <div style={{ fontSize: 52, marginBottom: 16 }}>👥</div>
              <div style={{ fontSize: 17, fontWeight: 600, color: C.ink, marginBottom: 8 }}>No clients yet</div>
              <div style={{ fontSize: 13, color: C.gray, maxWidth: 300, margin: '0 auto 28px' }}>Add your first client to start managing your CRM.</div>
              <PrimaryBtn label="+ Add client" colorScheme="success" onClick={() => setShowNew(true)} />
            </div>
          ) : (
            /* No results from active search / filters */
            <div style={{ textAlign: 'center', padding: '80px 20px', background: C.white, borderRadius: 16, border: `1px dashed ${C.border}`, maxWidth: 520, margin: '40px auto' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
              <div style={{ fontSize: 16, fontWeight: 500, color: C.ink, marginBottom: 8 }}>No clients match your search</div>
              <div style={{ fontSize: 13, color: C.gray, maxWidth: 300, margin: '0 auto 20px' }}>Try adjusting your search terms or filters.</div>
              <button onClick={() => { setSearch(''); setFilter('all'); setTierFilter('all'); }}
                style={{ fontSize: 13, fontWeight: 500, color: C.rosaText, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
                Clear filters
              </button>
            </div>
          )
        ) : view === 'list' ? (
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
              <thead>
                <tr style={{ background: C.white, borderBottom: `2px solid ${C.border}`, position: 'sticky', top: 0, zIndex: 2 }}>
                  {/* Checkbox header — visible when any selected */}
                  <th style={{ padding: '9px 8px 9px 14px', width: 36, minWidth: 36, background: C.white, borderRight: `1px solid ${C.border}`, opacity: anyBulkSelected ? 1 : 0, transition: 'opacity 0.15s' }}>
                    <input type="checkbox"
                      checked={sortedFiltered.length > 0 && sortedFiltered.every(c => bulkSelected.has(c.id))}
                      onChange={() => {
                        const allSel = sortedFiltered.every(c => bulkSelected.has(c.id));
                        setBulkSelected(allSel ? new Set() : new Set(sortedFiltered.map(c => c.id)));
                      }}
                      style={{ width: 16, height: 16, cursor: 'pointer', accentColor: C.rosa }}/>
                  </th>
                  {[
                    {key:'name',        label:'Name',         w:190, s:true},
                    {key:'phone',       label:'Phone',        w:145, s:true},
                    {key:'email',       label:'Email',        w:165, s:false},
                    {key:'partner',     label:'Partner',      w:120, s:true},
                    {key:'tier',        label:'Tier',         w:80,  s:true},
                    {key:'events',      label:'Events',       w:65,  s:true},
                    {key:'spent',       label:'Total spent',  w:110, s:true},
                    {key:'points',      label:'Points',       w:70,  s:true},
                    {key:'birthday',    label:'Birthday',     w:90,  s:true},
                    {key:'nextEvent',   label:'Next event',   w:105, s:true},
                    {key:'lastContact', label:'Last contact', w:100, s:true},
                    {key:'status',      label:'Status',       w:85,  s:true},
                  ].map(col => (
                    <th key={col.key}
                      onClick={() => col.s && handleSort(col.key)}
                      style={{ padding: '9px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: sortCol===col.key ? C.rosaText : C.gray, letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap', width: col.w, minWidth: col.w, cursor: col.s ? 'pointer' : 'default', userSelect: 'none', background: sortCol===col.key ? C.rosaPale : C.white, borderRight: `1px solid ${C.border}`, transition: 'background 0.12s' }}
                      onMouseEnter={e => { if (col.s && sortCol !== col.key) e.currentTarget.style.background = C.ivory; }}
                      onMouseLeave={e => { if (sortCol !== col.key) e.currentTarget.style.background = C.white; }}>
                      {col.label}{col.s && sortIcon(col.key)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedSorted.map((cl, i) => {
                  const tc = TIER_CFG[cl.tier || 'new'] || TIER_CFG.new;
                  const initials = (cl.name || '').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
                  const spent = cl.totalSpent || 0;
                  const evCount = cl.totalEvents || cl.events?.length || 0;
                  const isVip = cl.tier === 'vip' || cl.tier === 'diamond';
                  const zebra = i % 2 === 1;
                  const nextEv = (cl.events || []).filter(e => e.event_date > todayStr && e.status !== 'cancelled').sort((a,b)=>a.event_date.localeCompare(b.event_date))[0];
                  const nextEvFmt = nextEv ? new Date(nextEv.event_date + 'T12:00:00').toLocaleDateString('en-US', {month:'short',day:'numeric'}) : null;
                  const bdayFmt = cl.birthday ? (() => { const [,m,d]=cl.birthday.split('-'); return new Date(`2000-${m}-${d}T12:00:00`).toLocaleDateString('en-US',{month:'short',day:'numeric'}); })() : null;
                  const tdBase = { padding: '7px 12px', borderRight: `1px solid ${C.border}`, fontSize: 12, color: C.ink };
                  const DASH = <span style={{color:'#D1D5DB'}}>—</span>;

                  // Last contact formatting
                  const lastContactedAt = cl.last_contacted_at ? new Date(cl.last_contacted_at) : null;
                  const now = new Date();
                  const daysSinceContact = lastContactedAt ? Math.floor((now - lastContactedAt) / (1000 * 60 * 60 * 24)) : null;
                  const isStale = daysSinceContact === null || daysSinceContact > 30;
                  const lastContactFmt = lastContactedAt
                    ? lastContactedAt.getFullYear() === now.getFullYear()
                      ? lastContactedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                      : lastContactedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
                    : null;

                  // Left border: amber if stale contact, otherwise VIP color or transparent
                  const leftBorderColor = isStale ? '#FDE68A' : isVip ? tc.border : 'transparent';

                  // Inline edit helpers
                  const isEditingPhone = editingCell?.clientId === cl.id && editingCell?.field === 'phone';
                  const isEditingEmail = editingCell?.clientId === cl.id && editingCell?.field === 'email';
                  const isHoverPhone = hoveredCell?.clientId === cl.id && hoveredCell?.field === 'phone';
                  const isHoverEmail = hoveredCell?.clientId === cl.id && hoveredCell?.field === 'email';

                  const startEdit = (e, field, currentVal) => {
                    e.stopPropagation();
                    setEditingCell({ clientId: cl.id, field });
                    setCellValue(currentVal || '');
                  };
                  const commitEdit = async (field) => {
                    await updateClient(cl.id, { [field]: cellValue || null });
                    setEditingCell(null);
                    toast('Saved ✓');
                  };
                  const cancelEdit = () => { setEditingCell(null); };

                  return (
                    <tr key={cl.id || i} onClick={() => setSelCl(cl)}
                      style={{ borderBottom: `1px solid ${C.border}`, cursor: 'pointer', background: bulkSelected.has(cl.id) ? C.rosaPale : zebra ? '#F9FAFB' : C.white, borderLeft: `3px solid ${leftBorderColor}` }}
                      onMouseEnter={e => { if (!bulkSelected.has(cl.id)) e.currentTarget.style.background = C.rosaPale; e.currentTarget.querySelector('.cl-chk-td').style.opacity = '1'; }}
                      onMouseLeave={e => { if (!bulkSelected.has(cl.id)) e.currentTarget.style.background = zebra ? '#F9FAFB' : C.white; if (!anyBulkSelected) e.currentTarget.querySelector('.cl-chk-td').style.opacity = '0'; }}>

                      {/* Checkbox */}
                      <td className="cl-chk-td" onClick={e=>e.stopPropagation()}
                        style={{ padding: '7px 8px 7px 14px', borderRight: `1px solid ${C.border}`, width: 36, opacity: anyBulkSelected || bulkSelected.has(cl.id) ? 1 : 0, transition: 'opacity 0.15s' }}>
                        <input type="checkbox" checked={bulkSelected.has(cl.id)} onChange={()=>toggleBulkSelect(cl.id)}
                          onClick={e=>e.stopPropagation()}
                          style={{ width: 16, height: 16, cursor: 'pointer', accentColor: C.rosa }}/>
                      </td>

                      {/* Name */}
                      <td style={{ ...tdBase, padding: '7px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 26, height: 26, borderRadius: '50%', background: tc.avatarBg||tc.bg, color: tc.avatarCol||tc.col, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, flexShrink:0 }}>{initials}</div>
                          <div style={{ fontSize:12, fontWeight:600, color:C.ink, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{cl.name}</div>
                          <span style={{ fontSize:13, flexShrink:0, lineHeight:1 }} title={getTier(cl.loyalty_points||0, loyaltyTiers).name}>{tierMedal(getTier(cl.loyalty_points||0, loyaltyTiers).name)}</span>
                        </div>
                      </td>

                      {/* Phone */}
                      <td style={{ ...tdBase, position: 'relative' }}
                        onMouseEnter={() => !isEditingPhone && setHoveredCell({ clientId: cl.id, field: 'phone' })}
                        onMouseLeave={() => setHoveredCell(null)}
                        onClick={e => e.stopPropagation()}>
                        {isEditingPhone ? (
                          <input
                            autoFocus
                            value={cellValue}
                            onChange={e => setCellValue(e.target.value)}
                            onBlur={() => commitEdit('phone')}
                            onKeyDown={e => { if (e.key === 'Enter') commitEdit('phone'); if (e.key === 'Escape') cancelEdit(); }}
                            style={{ width: '100%', fontSize: 12, padding: '2px 6px', border: `1px solid ${C.rosa}`, borderRadius: 5, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                          />
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            {cl.phone ? (
                              <>
                                <a href={`tel:${cl.phone}`} onClick={e => e.stopPropagation()} title="Call"
                                  style={{ color: C.ink, textDecoration: 'none', fontSize: 12, lineHeight: 1 }}
                                  onMouseEnter={e => e.currentTarget.style.color = C.rosa}
                                  onMouseLeave={e => e.currentTarget.style.color = C.ink}>
                                  📞
                                </a>
                                <a href={`https://wa.me/${(cl.phone||'').replace(/\D/g,'')}`} target="_blank" rel="noopener" title="WhatsApp"
                                  onClick={e => e.stopPropagation()}
                                  style={{ lineHeight: 1, display: 'inline-flex', alignItems: 'center' }}>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="#25D366" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                                    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.107.549 4.087 1.508 5.81L0 24l6.335-1.483A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.007-1.371l-.36-.214-3.732.873.907-3.619-.235-.372A9.818 9.818 0 1112 21.818z"/>
                                  </svg>
                                </a>
                                <span style={{ fontSize: 12, color: C.ink, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cl.phone}</span>
                              </>
                            ) : (
                              <span style={{ color: '#D1D5DB' }}>—</span>
                            )}
                            {isHoverPhone && (
                              <button onClick={e => startEdit(e, 'phone', cl.phone)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', color: C.gray, fontSize: 11, lineHeight: 1, flexShrink: 0 }}
                                title="Edit phone">✏</button>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Email */}
                      <td style={{ ...tdBase, color: C.gray, maxWidth: 165, position: 'relative' }}
                        onMouseEnter={() => !isEditingEmail && setHoveredCell({ clientId: cl.id, field: 'email' })}
                        onMouseLeave={() => setHoveredCell(null)}
                        onClick={e => e.stopPropagation()}>
                        {isEditingEmail ? (
                          <input
                            autoFocus
                            value={cellValue}
                            onChange={e => setCellValue(e.target.value)}
                            onBlur={() => commitEdit('email')}
                            onKeyDown={e => { if (e.key === 'Enter') commitEdit('email'); if (e.key === 'Escape') cancelEdit(); }}
                            style={{ width: '100%', fontSize: 11, padding: '2px 6px', border: `1px solid ${C.rosa}`, borderRadius: 5, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                          />
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden' }}>
                            {cl.email ? (
                              <a href={`mailto:${cl.email}`} onClick={e => e.stopPropagation()} style={{ color: C.gray, textDecoration: 'none', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}
                                onMouseEnter={e => e.currentTarget.style.color = C.rosa}
                                onMouseLeave={e => e.currentTarget.style.color = C.gray}>{cl.email}</a>
                            ) : (
                              <span style={{ color: '#D1D5DB' }}>—</span>
                            )}
                            {isHoverEmail && (
                              <button onClick={e => startEdit(e, 'email', cl.email)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', color: C.gray, fontSize: 11, lineHeight: 1, flexShrink: 0 }}
                                title="Edit email">✏</button>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Partner */}
                      <td style={{ ...tdBase, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{cl.partner_name || DASH}</td>

                      {/* Tier */}
                      <td style={tdBase}>
                        <span style={{ padding:'2px 7px', borderRadius:999, fontSize:9, fontWeight:700, background:tc.bg, color:tc.col, whiteSpace:'nowrap', textTransform:'uppercase', letterSpacing:'0.04em' }}>{tc.label}</span>
                      </td>

                      {/* Events */}
                      <td style={{ ...tdBase, textAlign:'center' }}>
                        <span style={{ fontSize:13, fontWeight:600, color: evCount > 1 ? C.rosaText : evCount === 1 ? C.ink : C.gray }}>{evCount || DASH}</span>
                      </td>

                      {/* Spent / LTV */}
                      <td style={{ ...tdBase, whiteSpace:'nowrap', textAlign:'right' }}>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'flex-end', gap:5 }}>
                          {spent >= 5000
                            ? <span title="Platinum" style={{fontSize:13,lineHeight:1}}>💎</span>
                            : spent >= 2000
                              ? <span title="Gold" style={{fontSize:13,lineHeight:1}}>🥇</span>
                              : spent >= 500
                                ? <span title="Silver" style={{fontSize:13,lineHeight:1}}>🥈</span>
                                : null}
                          <span style={{ fontWeight:500, color: spent > 0 ? C.ink : C.gray }}>
                            {spent > 0 ? fmt(spent) : DASH}
                          </span>
                        </div>
                      </td>

                      {/* Points */}
                      <td style={{ ...tdBase, textAlign:'center' }}>
                        {cl.loyalty_points > 0
                          ? <span style={{fontSize:12,fontWeight:600,color:'#B45309'}}>{cl.loyalty_points}</span>
                          : DASH}
                      </td>

                      {/* Birthday */}
                      <td style={{ ...tdBase, color:C.gray, whiteSpace:'nowrap' }}>{bdayFmt || DASH}</td>

                      {/* Next event */}
                      <td style={{ ...tdBase, whiteSpace:'nowrap' }}>
                        {nextEv
                          ? <div>
                              <div style={{fontSize:11,fontWeight:500,color:C.ink}}>{nextEvFmt}</div>
                              <div style={{fontSize:9,color:C.gray,textTransform:'capitalize'}}>{nextEv.type}</div>
                            </div>
                          : DASH}
                      </td>

                      {/* Last contact */}
                      <td style={{ ...tdBase, whiteSpace: 'nowrap' }}>
                        {lastContactFmt
                          ? <span style={{ fontSize: 11, color: daysSinceContact > 30 ? '#92400E' : C.gray }}>{lastContactFmt}</span>
                          : <span style={{ color: '#D1D5DB', fontSize: 11 }}>Never</span>}
                      </td>

                      {/* Status */}
                      <td style={{ padding:'7px 12px' }}>
                        {cl.hasOverdue
                          ? <span style={{padding:'2px 7px',borderRadius:999,fontSize:9,fontWeight:700,background:'var(--bg-danger)',color:'var(--text-danger)',whiteSpace:'nowrap',textTransform:'uppercase'}}>Overdue</span>
                          : evCount > 0
                            ? <span style={{padding:'2px 7px',borderRadius:999,fontSize:9,fontWeight:700,background:'var(--bg-success)',color:'var(--text-success)',whiteSpace:'nowrap',textTransform:'uppercase'}}>Active</span>
                            : DASH}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
            <div style={{ padding: '8px 14px', background: C.ivory, borderTop: `1px solid ${C.border}`, fontSize: 11, color: C.gray, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Showing {paginatedSorted.length} of {sortedFiltered.length} client{sortedFiltered.length !== 1 ? 's' : ''}{filter !== 'all' || search ? ' matching filter' : ''}</span>
              <span style={{color:'#D1D5DB'}}>Click any column header to sort</span>
            </div>
            {sortedFiltered.length > page * PAGE_SIZE && (
              <div style={{ padding: '12px 14px', background: C.white, borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'center' }}>
                <button onClick={() => setPage(p => p + 1)} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 24px', background: C.white, cursor: 'pointer', fontSize: 13, color: C.gray }}>
                  Showing {paginatedSorted.length} of {sortedFiltered.length} clients · Load more
                </button>
              </div>
            )}
          </div>
        ) : (
          /* GRID VIEW */
          <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
            {paginatedFiltered.map((cl, i) => {
              const tc = TIER_CFG[cl.tier || 'new'] || TIER_CFG.new;
              const initials = (cl.name || `${cl.firstName || ''}${cl.lastName || ''}`).split(' ').map(w => w[0]).slice(0, 2).join('');
              const spent = cl.totalSpent || (cl.events || []).reduce((s, e) => s + Number(e.total || 0), 0);
              return (
                <div key={cl.id || i} onClick={() => setSelCl(cl)} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2sease', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = C.rosa; e.currentTarget.style.boxShadow = '0 4px 12px rgba(201,105,122,0.1)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.02)'; e.currentTarget.style.transform = 'none'; }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: tc.avatarBg || tc.bg, color: tc.avatarCol || tc.col, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 600, margin: '0 auto 12px' }}>{initials}</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginBottom: 4 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>{cl.name}</div>
                    <span style={{ fontSize: 14, lineHeight: 1 }} title={getTier(cl.loyalty_points||0, loyaltyTiers).name}>{tierMedal(getTier(cl.loyalty_points||0, loyaltyTiers).name)}</span>
                  </div>
                  <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 600, background: tc.bg, color: tc.col }}>{tc.label}</span>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-success)', marginTop: 12 }}>{fmt(spent)}</div>
                  <div style={{ fontSize: 11, color: C.gray, marginTop: 4 }}>Last: {cl.lastActivity || '—'}</div>
                </div>
              );
            })}
          </div>
          {filtered.length > page * PAGE_SIZE && (
            <div style={{ padding: '20px 0 4px', display: 'flex', justifyContent: 'center' }}>
              <button onClick={() => setPage(p => p + 1)} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 24px', background: C.white, cursor: 'pointer', fontSize: 13, color: C.gray }}>
                Showing {paginatedFiltered.length} of {filtered.length} clients · Load more
              </button>
            </div>
          )}
          </>
        )}
      </div>}

      {showBulk && (
        <BulkMessageModal
          clients={rawClients}
          boutiqueName={clBoutique?.name || 'us'}
          boutiqueId={clBoutique?.id}
          onClose={() => setShowBulk(false)}
        />
      )}
      {showNew && (
        <NewClientModal
          onClose={() => setShowNew(false)}
          createClient={createClient}
          onSuccess={savedClient => { setNewClientId(savedClient.id); setShowBookEvent(true); }}
        />
      )}
      {showImport && (
        <ClientImportModal
          onClose={() => setShowImport(false)}
          createClient={createClient}
        />
      )}
      {showMerge && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}}>
          <div role="dialog" aria-modal="true" aria-labelledby="clients-merge-title" style={{background:C.white,borderRadius:16,width:520,maxHeight:'88dvh',display:'flex',flexDirection:'column',boxShadow:'0 20px 60px rgba(0,0,0,0.15)',overflow:'hidden'}}>
            <div style={{padding:'16px 20px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
              <div>
                <span id="clients-merge-title" style={{fontWeight:600,fontSize:15,color:C.ink}}>Duplicate clients</span>
                <div style={{fontSize:12,color:C.gray,marginTop:1}}>{mergeGroups.length} potential duplicate{mergeGroups.length!==1?'s':''} found</div>
              </div>
              <button onClick={()=>{setShowMerge(false);setSelectedMerge(null);}} aria-label="Close" style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:C.gray,padding:'4px 8px',minHeight:32,minWidth:32}}>×</button>
            </div>
            <div style={{flex:1,overflowY:'auto',padding:'12px 20px',display:'flex',flexDirection:'column',gap:12}}>
              {mergeGroups.length===0&&(
                <div style={{textAlign:'center',padding:'32px 0'}}>
                  <div style={{fontSize:32,marginBottom:8}}>✅</div>
                  <div style={{fontSize:14,color:C.ink,fontWeight:500}}>No duplicates found</div>
                  <div style={{fontSize:12,color:C.gray,marginTop:4}}>All clients have unique phone numbers and email addresses</div>
                </div>
              )}
              {mergeGroups.map((group,gi)=>(
                <div key={gi} style={{border:`1px solid ${C.border}`,borderRadius:10,padding:'12px 14px'}}>
                  <div style={{fontSize:11,color:C.rosaText,fontWeight:600,marginBottom:10,textTransform:'uppercase',letterSpacing:'0.05em'}}>{group.reason}</div>
                  <div style={{display:'flex',flexDirection:'column',gap:8}}>
                    {group.clients.map(cl=>(
                      <div key={cl.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 10px',borderRadius:8,border:`2px solid ${selectedMerge?.keep===cl.id&&selectedMerge?.groupIdx===gi?C.rosa:C.border}`,cursor:'pointer',transition:'border-color 0.15s'}}
                        onClick={()=>setSelectedMerge(prev=>{
                          if(!prev||prev.groupIdx!==gi) return {keep:cl.id,remove:group.clients.find(c=>c.id!==cl.id)?.id,groupIdx:gi};
                          if(prev.keep===cl.id) return null;
                          return {keep:cl.id,remove:group.clients.find(c=>c.id!==cl.id)?.id,groupIdx:gi};
                        })}>
                        <div style={{width:34,height:34,borderRadius:'50%',background:C.rosaPale,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:600,color:C.rosaText,flexShrink:0}}>{cl.name?.split(' ').map(w=>w[0]).join('').slice(0,2)}</div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:13,fontWeight:500,color:C.ink}}>{cl.name}</div>
                          <div style={{fontSize:11,color:C.gray}}>{cl.phone} · {cl.email}</div>
                        </div>
                        {selectedMerge?.keep===cl.id&&selectedMerge?.groupIdx===gi&&(
                          <span style={{fontSize:10,padding:'2px 8px',borderRadius:8,background:C.rosaPale,color:C.rosaText,fontWeight:600}}>KEEP</span>
                        )}
                      </div>
                    ))}
                  </div>
                  {selectedMerge?.groupIdx===gi&&selectedMerge.keep&&selectedMerge.remove&&(
                    <button
                      onClick={async()=>{
                        if(!selectedMerge.keep||!selectedMerge.remove) return;
                        setMerging(true);
                        await supabase.from('events').update({client_id:selectedMerge.keep}).eq('client_id',selectedMerge.remove).eq('boutique_id',clBoutique.id);
                        await supabase.from('client_interactions').update({client_id:selectedMerge.keep}).eq('client_id',selectedMerge.remove).eq('boutique_id',clBoutique.id);
                        await supabase.from('client_tasks').update({client_id:selectedMerge.keep}).eq('client_id',selectedMerge.remove).eq('boutique_id',clBoutique.id);
                        await supabase.from('pipeline_leads').update({client_id:selectedMerge.keep}).eq('client_id',selectedMerge.remove).eq('boutique_id',clBoutique.id);
                        const removed = group.clients.find(c=>c.id===selectedMerge.remove);
                        const kept = group.clients.find(c=>c.id===selectedMerge.keep);
                        if(removed?.loyalty_points>0){
                          await supabase.from('clients').update({loyalty_points:(kept?.loyalty_points||0)+(removed?.loyalty_points||0)}).eq('id',selectedMerge.keep).eq('boutique_id',clBoutique.id);
                        }
                        await supabase.from('clients').delete().eq('id',selectedMerge.remove).eq('boutique_id',clBoutique.id);
                        setMerging(false);
                        setSelectedMerge(null);
                        setMergeGroups(g=>g.filter((_,i)=>i!==gi));
                        toast('Clients merged ✓');
                      }}
                      disabled={merging}
                      style={{marginTop:10,width:'100%',padding:'8px',background:C.rosa,color:C.white,border:'none',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:500}}>
                      {merging?'Merging…':'Merge — keep selected client'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* Bulk SMS modal */}
      {showSmsModal && (
        <BulkSmsModal
          clients={rawClients.filter(c => bulkSelected.has(c.id))}
          boutiqueName={clBoutique?.name || 'us'}
          boutiqueId={clBoutique?.id}
          onClose={() => { setShowSmsModal(false); clearBulkSelection(); }}
          toast={toast}
        />
      )}
      {/* Bulk add tag modal */}
      {showTagModal && (
        <BulkAddTagModal
          boutiqueId={clBoutique?.id}
          selectedIds={[...bulkSelected]}
          onClose={() => { setShowTagModal(false); clearBulkSelection(); }}
          toast={toast}
        />
      )}
      {/* Book event follow-up prompt */}
      {showBookEvent && (
        <div style={{position:'fixed',bottom:24,right:24,zIndex:1100,background:C.white,borderRadius:14,padding:'16px 20px',boxShadow:'0 8px 32px rgba(0,0,0,0.15)',border:`1px solid ${C.border}`,maxWidth:320,display:'flex',flexDirection:'column',gap:10}}>
          <div style={{display:'flex',alignItems:'flex-start',gap:10}}>
            <span style={{fontSize:20}}>🎉</span>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:600,color:C.ink}}>Client added!</div>
              <div style={{fontSize:12,color:C.gray,marginTop:2}}>Ready to book their first event?</div>
            </div>
            <button onClick={()=>setShowBookEvent(false)} aria-label="Close" style={{background:'none',border:'none',cursor:'pointer',color:C.gray,fontSize:16,lineHeight:1,padding:'4px 8px',flexShrink:0,minHeight:32,minWidth:32}}>×</button>
          </div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={()=>setShowBookEvent(false)} style={{flex:1,padding:'7px 0',borderRadius:8,border:`1px solid ${C.border}`,background:'transparent',color:C.gray,fontSize:12,cursor:'pointer'}}>Not now</button>
            <button onClick={()=>{setShowBookEvent(false);if(setScreen)setScreen('events');sessionStorage.setItem('belori_autoopen','new_event');}} style={{flex:1,padding:'7px 0',borderRadius:8,border:'none',background:C.rosa,color:C.white,fontSize:12,fontWeight:500,cursor:'pointer'}}>Book event →</button>
          </div>
        </div>
      )}
      {/* Floating bulk action bar */}
      {anyBulkSelected && (
        <div style={{position:'fixed',bottom:16,left:'50%',transform:'translateX(-50%)',zIndex:200,background:C.white,borderRadius:999,boxShadow:'0 4px 24px rgba(0,0,0,0.18)',padding:'10px 18px',display:'flex',alignItems:'center',gap:10,maxWidth:600,border:`1px solid ${C.border}`}}>
          <span style={{fontSize:13,fontWeight:600,color:C.rosaText,whiteSpace:'nowrap'}}>✓ {bulkSelected.size} selected</span>
          <button onClick={bulkExportClients} disabled={bulkWorking}
            style={{padding:'6px 14px',borderRadius:999,border:`1px solid ${C.border}`,background:C.grayBg,color:C.ink,fontSize:12,fontWeight:500,cursor:'pointer',whiteSpace:'nowrap'}}>
            Export CSV
          </button>
          <button onClick={() => setShowSmsModal(true)} disabled={bulkWorking}
            style={{padding:'6px 14px',borderRadius:999,border:`1px solid ${C.border}`,background:C.grayBg,color:C.ink,fontSize:12,fontWeight:500,cursor:'pointer',whiteSpace:'nowrap'}}>
            Send SMS
          </button>
          <button onClick={() => setShowTagModal(true)} disabled={bulkWorking}
            style={{padding:'6px 14px',borderRadius:999,border:`1px solid ${C.border}`,background:C.grayBg,color:C.ink,fontSize:12,fontWeight:500,cursor:'pointer',whiteSpace:'nowrap'}}>
            Add tag
          </button>
          <button onClick={clearBulkSelection} aria-label="Clear selection"
            style={{padding:'6px 10px',borderRadius:999,border:'none',background:'none',color:C.gray,fontSize:18,cursor:'pointer',lineHeight:1,marginLeft:4,minHeight:32,minWidth:32}}>
            ×
          </button>
        </div>
      )}
    </div>
  );
};

export default Clients;
