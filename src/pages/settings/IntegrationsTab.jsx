// Settings → Integrations tab.
//
// Extracted out of the 4000-line Settings.jsx parent in the IA-cleanup
// session so it can be lazy-loaded on demand. Adds ~30 KB to the
// Integrations chunk and shaves the equivalent off the main Settings
// chunk for boutiques that never visit this tab. Behavior unchanged.
//
// Dependencies are all explicit imports — no Settings.jsx-internal
// helpers; the original component was self-contained.

import React, { useState, useEffect } from 'react';
import { C } from '../../lib/colors';
import { Card, CardHead, PrimaryBtn, GhostBtn, useToast } from '../../lib/ui.jsx';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

const IntegrationsTab = () => {
  const { boutique, reloadBoutique } = useAuth();
  const toast = useToast();

  // ── QBO state ──
  const [qbo, setQbo] = useState({ realm_id: '', access_token: '', refresh_token: '' });
  const [qboSaving, setQboSaving] = useState(false);
  const [qboSyncing, setQboSyncing] = useState(false);
  const [qboConnected, setQboConnected] = useState(false);
  const [qboConnectedAt, setQboConnectedAt] = useState(null);
  const [qboSyncedAt, setQboSyncedAt] = useState(null);
  const [qboExpanded, setQboExpanded] = useState(false);

  // ── Mailchimp state ──
  const [mc, setMc] = useState({ api_key: '', list_id: '' });
  const [mcSaving, setMcSaving] = useState(false);
  const [mcSyncing, setMcSyncing] = useState(false);
  const [mcConnected, setMcConnected] = useState(false);

  // ── Klaviyo state ──
  const [kl, setKl] = useState({ api_key: '', list_id: '' });
  const [klSaving, setKlSaving] = useState(false);
  const [klSyncing, setKlSyncing] = useState(false);
  const [klConnected, setKlConnected] = useState(false);

  // Load existing credentials from boutique record
  useEffect(() => {
    if (!boutique) return;
    setQboConnected(!!boutique.qbo_realm_id);
    setQboConnectedAt(boutique.qbo_connected_at || null);
    setQboSyncedAt(boutique.qbo_synced_at || null);
    setQbo({
      realm_id: boutique.qbo_realm_id || '',
      access_token: boutique.qbo_access_token ? '••••••••' : '',
      refresh_token: boutique.qbo_refresh_token ? '••••••••' : '',
    });
    setMcConnected(!!(boutique.mailchimp_api_key && boutique.mailchimp_list_id));
    setMc({
      api_key: boutique.mailchimp_api_key ? '••••••••' : '',
      list_id: boutique.mailchimp_list_id || '',
    });
    setKlConnected(!!(boutique.klaviyo_api_key && boutique.klaviyo_list_id));
    setKl({
      api_key: boutique.klaviyo_api_key ? '••••••••' : '',
      list_id: boutique.klaviyo_list_id || '',
    });
  }, [boutique?.id]);

  const relativeTime = (isoStr) => {
    if (!isoStr) return null;
    const diff = Date.now() - new Date(isoStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} minute${mins !== 1 ? 's' : ''} ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hour${hrs !== 1 ? 's' : ''} ago`;
    const days = Math.floor(hrs / 24);
    return `${days} day${days !== 1 ? 's' : ''} ago`;
  };

  const fmtDate = (isoStr) => {
    if (!isoStr) return '';
    return new Date(isoStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // ── QBO save ──
  const saveQbo = async () => {
    if (!qbo.realm_id.trim()) { toast('Realm ID is required', 'error'); return; }
    setQboSaving(true);
    const updates = { qbo_realm_id: qbo.realm_id.trim() };
    // Only update tokens if user typed something new (not the masked placeholder)
    if (qbo.access_token && qbo.access_token !== '••••••••') updates.qbo_access_token = qbo.access_token.trim();
    if (qbo.refresh_token && qbo.refresh_token !== '••••••••') updates.qbo_refresh_token = qbo.refresh_token.trim();
    if (!boutique.qbo_connected_at) updates.qbo_connected_at = new Date().toISOString();
    const { error } = await supabase.from('boutiques').update(updates).eq('id', boutique.id);
    setQboSaving(false);
    if (error) { toast(error.message, 'error'); return; }
    await reloadBoutique();
    setQboConnected(true);
    setQboExpanded(false);
    toast('QuickBooks credentials saved ✓');
  };

  const disconnectQbo = async () => {
    const { error } = await supabase.from('boutiques').update({
      qbo_access_token: null, qbo_refresh_token: null, qbo_realm_id: null,
      qbo_connected_at: null, qbo_synced_at: null,
    }).eq('id', boutique.id);
    if (error) { toast(error.message, 'error'); return; }
    await reloadBoutique();
    setQboConnected(false);
    setQboSyncedAt(null);
    setQbo({ realm_id: '', access_token: '', refresh_token: '' });
    toast('QuickBooks disconnected');
  };

  const syncQbo = async () => {
    setQboSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('qbo-sync', { body: { boutique_id: boutique.id } });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      const newSyncedAt = new Date().toISOString();
      setQboSyncedAt(newSyncedAt);
      toast(`Synced ${data.synced} of ${data.total} payment${data.total !== 1 ? 's' : ''} to QuickBooks ✓`);
    } catch (e) {
      toast('Sync failed: ' + e.message, 'error');
    } finally {
      setQboSyncing(false);
    }
  };

  // ── Mailchimp save ──
  const saveMc = async () => {
    if (!mc.api_key || mc.api_key === '••••••••') { toast('API key is required', 'error'); return; }
    if (!mc.list_id.trim()) { toast('Audience ID is required', 'error'); return; }
    setMcSaving(true);
    const updates = { mailchimp_list_id: mc.list_id.trim() };
    if (mc.api_key !== '••••••••') updates.mailchimp_api_key = mc.api_key.trim();
    if (!boutique.mailchimp_connected_at) updates.mailchimp_connected_at = new Date().toISOString();
    const { error } = await supabase.from('boutiques').update(updates).eq('id', boutique.id);
    setMcSaving(false);
    if (error) { toast(error.message, 'error'); return; }
    await reloadBoutique();
    setMcConnected(true);
    toast('Mailchimp credentials saved ✓');
  };

  const syncMc = async () => {
    setMcSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('mailchimp-sync', { body: { boutique_id: boutique.id } });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      toast(`${data.synced} contact${data.synced !== 1 ? 's' : ''} synced to Mailchimp ✓`);
    } catch (e) {
      toast('Sync failed: ' + e.message, 'error');
    } finally {
      setMcSyncing(false);
    }
  };

  // ── Klaviyo save ──
  const saveKl = async () => {
    if (!kl.api_key || kl.api_key === '••••••••') { toast('API key is required', 'error'); return; }
    if (!kl.list_id.trim()) { toast('List ID is required', 'error'); return; }
    setKlSaving(true);
    const updates = { klaviyo_list_id: kl.list_id.trim() };
    if (kl.api_key !== '••••••••') updates.klaviyo_api_key = kl.api_key.trim();
    const { error } = await supabase.from('boutiques').update(updates).eq('id', boutique.id);
    setKlSaving(false);
    if (error) { toast(error.message, 'error'); return; }
    await reloadBoutique();
    setKlConnected(true);
    toast('Klaviyo credentials saved ✓');
  };

  const syncKl = async () => {
    setKlSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('klaviyo-sync', { body: { boutique_id: boutique.id } });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      toast(`${data.synced} profile${data.synced !== 1 ? 's' : ''} synced to Klaviyo ✓`);
    } catch (e) {
      toast('Sync failed: ' + e.message, 'error');
    } finally {
      setKlSyncing(false);
    }
  };

  const statusDot = (connected) => (
    <span style={{
      display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
      background: connected ? '#16a34a' : C.gray, marginRight: 6, flexShrink: 0,
    }}/>
  );

  const inputStyle = {
    width: '100%', padding: '8px 10px', borderRadius: 7,
    border: `1px solid ${C.border}`, fontSize: 13, color: C.ink,
    boxSizing: 'border-box', outline: 'none', background: C.white,
  };

  const sectionLabel = {fontSize: 11, color: C.gray, marginBottom: 4};
  const fieldWrap = {display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12};

  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>

      {/* ── QuickBooks Online ── */}
      <Card>
        <CardHead title="QuickBooks Online"/>
        <div style={{padding: '0 16px 16px'}}>
          <div style={{fontSize: 12, color: C.gray, marginBottom: 12}}>
            Automatically sync paid payment milestones to QuickBooks as sales receipts.
          </div>

          {/* Status row */}
          <div style={{display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12}}>
            {statusDot(qboConnected)}
            <span style={{fontSize: 13, color: qboConnected ? '#16a34a' : C.gray, fontWeight: 500}}>
              {qboConnected ? `Connected${qboConnectedAt ? ` (since ${fmtDate(qboConnectedAt)})` : ''}` : 'Not connected'}
            </span>
          </div>

          {qboConnected && !qboExpanded && (
            <div style={{marginBottom: 12}}>
              <div style={{fontSize: 12, color: C.gray}}>
                Realm ID: <span style={{fontFamily: 'monospace', color: C.ink}}>{boutique?.qbo_realm_id}</span>
              </div>
              {qboSyncedAt && (
                <div style={{fontSize: 11, color: C.gray, marginTop: 4}}>
                  Last synced: {relativeTime(qboSyncedAt)}
                </div>
              )}
            </div>
          )}

          {/* Credential form — shown when not connected, or when expanding to edit */}
          {(!qboConnected || qboExpanded) && (
            <div style={fieldWrap}>
              <div>
                <div style={sectionLabel}>QBO Realm ID (Company ID) — found in your QuickBooks URL</div>
                <input
                  value={qbo.realm_id}
                  onChange={e => setQbo(q => ({...q, realm_id: e.target.value}))}
                  placeholder="123456789"
                  style={inputStyle}
                />
              </div>
              <div>
                <div style={sectionLabel}>Access token — generate from the Intuit Developer Portal</div>
                <input
                  value={qbo.access_token}
                  onChange={e => setQbo(q => ({...q, access_token: e.target.value}))}
                  onFocus={e => { if (e.target.value === '••••••••') setQbo(q => ({...q, access_token: ''})); }}
                  placeholder="eyJ..."
                  type="password"
                  style={inputStyle}
                />
              </div>
              <div>
                <div style={sectionLabel}>Refresh token</div>
                <input
                  value={qbo.refresh_token}
                  onChange={e => setQbo(q => ({...q, refresh_token: e.target.value}))}
                  onFocus={e => { if (e.target.value === '••••••••') setQbo(q => ({...q, refresh_token: ''})); }}
                  placeholder="AB11..."
                  type="password"
                  style={inputStyle}
                />
              </div>
              <div style={{fontSize: 11, color: C.gray, fontStyle: 'italic'}}>
                Tokens can be obtained from the{' '}
                <a href="https://developer.intuit.com/app/developer/playground" target="_blank" rel="noopener noreferrer"
                  style={{color: C.rosaText}}>Intuit OAuth Playground</a>.
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div style={{display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap'}}>
            {(!qboConnected || qboExpanded) && (
              <PrimaryBtn
                label={qboSaving ? 'Saving…' : (qboConnected ? 'Update credentials' : 'Save & connect')}
                colorScheme="success"
                onClick={saveQbo}
              />
            )}
            {qboConnected && !qboExpanded && (
              <>
                <PrimaryBtn
                  label={qboSyncing ? 'Syncing…' : 'Sync now'}
                  onClick={syncQbo}
                />
                <GhostBtn
                  label="Edit credentials"
                  onClick={() => setQboExpanded(true)}
                />
                <GhostBtn
                  label="Disconnect"
                  colorScheme="danger"
                  onClick={disconnectQbo}
                />
              </>
            )}
            {qboExpanded && (
              <GhostBtn label="Cancel" onClick={() => setQboExpanded(false)}/>
            )}
          </div>
        </div>
      </Card>

      {/* ── Mailchimp ── */}
      <Card>
        <CardHead title="Mailchimp"/>
        <div style={{padding: '0 16px 16px'}}>
          <div style={{fontSize: 12, color: C.gray, marginBottom: 12}}>
            Sync your client list to a Mailchimp audience for email marketing campaigns.
          </div>

          <div style={{display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12}}>
            {statusDot(mcConnected)}
            <span style={{fontSize: 13, color: mcConnected ? '#16a34a' : C.gray, fontWeight: 500}}>
              {mcConnected ? 'Connected' : 'Not connected'}
            </span>
          </div>

          <div style={fieldWrap}>
            <div>
              <div style={sectionLabel}>API key — Settings → Extras → API keys in Mailchimp</div>
              <input
                value={mc.api_key}
                onChange={e => setMc(m => ({...m, api_key: e.target.value}))}
                onFocus={e => { if (e.target.value === '••••••••') setMc(m => ({...m, api_key: ''})); }}
                placeholder="abc123def456…-us6"
                type="password"
                style={inputStyle}
              />
            </div>
            <div>
              <div style={sectionLabel}>Audience ID — found in Audience → Settings → Audience name and defaults</div>
              <input
                value={mc.list_id}
                onChange={e => setMc(m => ({...m, list_id: e.target.value}))}
                placeholder="a1b2c3d4e5"
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap'}}>
            <PrimaryBtn
              label={mcSaving ? 'Saving…' : 'Save credentials'}
              colorScheme="success"
              onClick={saveMc}
            />
            {mcConnected && (
              <GhostBtn
                label={mcSyncing ? 'Syncing…' : 'Sync clients now'}
                onClick={syncMc}
              />
            )}
          </div>
        </div>
      </Card>

      {/* ── Klaviyo ── */}
      <Card>
        <CardHead title="Klaviyo"/>
        <div style={{padding: '0 16px 16px'}}>
          <div style={{fontSize: 12, color: C.gray, marginBottom: 12}}>
            Sync your client list to a Klaviyo list for SMS and email marketing flows.
          </div>

          <div style={{display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12}}>
            {statusDot(klConnected)}
            <span style={{fontSize: 13, color: klConnected ? '#16a34a' : C.gray, fontWeight: 500}}>
              {klConnected ? 'Connected' : 'Not connected'}
            </span>
          </div>

          <div style={fieldWrap}>
            <div>
              <div style={sectionLabel}>Private API key — Account → Settings → API Keys in Klaviyo</div>
              <input
                value={kl.api_key}
                onChange={e => setKl(k => ({...k, api_key: e.target.value}))}
                onFocus={e => { if (e.target.value === '••••••••') setKl(k => ({...k, api_key: ''})); }}
                placeholder="pk_live_…"
                type="password"
                style={inputStyle}
              />
            </div>
            <div>
              <div style={sectionLabel}>List ID — Lists & Segments → select list → copy ID from URL</div>
              <input
                value={kl.list_id}
                onChange={e => setKl(k => ({...k, list_id: e.target.value}))}
                placeholder="AbCdEf"
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap'}}>
            <PrimaryBtn
              label={klSaving ? 'Saving…' : 'Save credentials'}
              colorScheme="success"
              onClick={saveKl}
            />
            {klConnected && (
              <GhostBtn
                label={klSyncing ? 'Syncing…' : 'Sync clients now'}
                onClick={syncKl}
              />
            )}
          </div>
        </div>
      </Card>

    </div>
  );
};

export default IntegrationsTab;
