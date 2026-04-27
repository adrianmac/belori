import React, { useState, useEffect } from 'react';
import { C, fmt, SVC_LABELS } from '../lib/colors';
import { applyTheme, getTheme } from '../lib/theme';
import { Avatar, Badge, Card, CardHead, Topbar, PrimaryBtn, GhostBtn, useToast,
  inputSt, LBL, SvcTag } from '../lib/ui.jsx';
import { useLayoutMode } from '../hooks/useLayoutMode.jsx';
import { useAuth } from '../context/AuthContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { useBoutique } from '../hooks/useBoutique';
import { canAccessSettingsTab } from '../lib/permissions';
import { useModules, saveModuleSettings, saveModuleConfig } from '../hooks/useModules.jsx';
import { MODULE_REGISTRY, planAllows } from '../lib/modules/registry';
import { validateDisableModule } from '../lib/modules/dependencies';
import { useBilling, PLANS } from '../hooks/useBilling';
import UpgradeGate, { useRequiresPlan } from '../components/UpgradeGate';
import { usePackages } from '../hooks/usePackages'
import { useLocations } from '../hooks/useLocations';
import { useTaskTemplates } from '../hooks/useTaskTemplates';
import { useChecklistTemplates } from '../hooks/useChecklistTemplates';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { useEvents } from '../hooks/useEvents';
import { supabase } from '../lib/supabase';
import { sendInngestEvent } from '../lib/inngest';
import { useI18n } from '../lib/i18n/index.jsx';
import { getLangPref, setLangPref as saveLangPref } from '../lib/i18n';
import EmailTemplatesTab from './EmailTemplatesTab';
import ContractBuilderTab from './ContractBuilderTab';

// ─── LAYOUT MODE TOGGLE (Settings) ─────────────────────────────────────────
const LayoutModeToggle = () => {
  const { mode, setMode } = useLayoutMode();
  return (
    <Card>
      <CardHead title="Display mode"/>
      <div style={{padding:'0 16px 16px'}}>
        <div style={{fontSize:12,color:C.gray,marginBottom:4}}>Choose how Belori looks on your device</div>
        <div className="mode-toggle-grid">
          <div className={`mode-option ${mode==='desktop'?'active':''}`} onClick={()=>setMode('desktop')} role="button" tabIndex={0}>
            <div className="mode-icon">
              <svg width="22" height="22" viewBox="0 0 16 16" fill="none"><rect x="1" y="3" width="14" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M5 13h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
            </div>
            <div className="mode-label">Desktop</div>
            <div className="mode-desc">Compact layout · Mouse & keyboard optimized · Hover states · Dense information · Full sidebar with labels</div>
          </div>
          <div className={`mode-option ${mode==='tablet'?'active':''}`} onClick={()=>setMode('tablet')} role="button" tabIndex={0}>
            <div className="mode-icon">
              <svg width="22" height="22" viewBox="0 0 16 16" fill="none"><rect x="2" y="1" width="12" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M6 13h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
            </div>
            <div className="mode-label">Tablet / Touch</div>
            <div className="mode-desc">Large tap targets · 48px buttons · Icon sidebar · Press states · Touch-friendly list rows</div>
          </div>
        </div>
        <div style={{fontSize:11,color:C.gray,fontStyle:'italic'}}>Your preference is saved to this browser. Staff on different devices each set their own.</div>
      </div>
    </Card>
  );
};
// ─── LANGUAGE TOGGLE (Settings → Display tab) ──────────────────────────────
const LanguageToggle = () => {
  const { lang, setLang } = useI18n();

  const handleChange = (newLang) => {
    localStorage.setItem('belori_lang', newLang);
    setLang(newLang);
  };

  const LANGS = [
    { id: 'en', label: 'English' },
    { id: 'es', label: 'Español' },
  ];

  return (
    <Card>
      <CardHead title="Language"/>
      <div style={{padding:'0 16px 16px'}}>
        <div style={{fontSize:12,color:C.gray,marginBottom:10}}>Choose your preferred language for the Belori interface</div>
        <div style={{display:'flex',gap:8}}>
          {LANGS.map(l => {
            const active = lang === l.id;
            return (
              <button
                key={l.id}
                onClick={() => handleChange(l.id)}
                style={{
                  padding:'8px 20px',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:active?600:400,
                  border:`1.5px solid ${active ? 'var(--brand-primary, #C9697A)' : C.border}`,
                  background:active ? 'var(--brand-pale, #FDF5F6)' : C.white,
                  color:active ? 'var(--brand-primary, #C9697A)' : C.gray,
                  transition:'all 0.15s',minHeight:'unset',minWidth:'unset',
                }}
              >
                {l.label}
              </button>
            );
          })}
        </div>
        <div style={{fontSize:11,color:C.gray,fontStyle:'italic',marginTop:8}}>Language preference is saved to this browser.</div>
      </div>
    </Card>
  );
};
// ─── BILINGUAL LABEL TOGGLE (Settings → Display tab) ──────────────────────────
const BilingualLabelToggle = () => {
  const [langPref, setLangPref] = useState(getLangPref());

  function handleLangChange(pref) {
    saveLangPref(pref);
    setLangPref(pref);
  }

  const pills = [
    { id: 'bilingual', label: 'Bilingual / Bilingüe' },
    { id: 'en',        label: 'English only' },
  ];

  return (
    <Card>
      <CardHead title="Label language / Idioma de etiquetas"/>
      <div style={{padding:'0 16px 16px'}}>
        <div style={{fontSize:12,color:C.gray,marginBottom:10}}>
          Choose how appointment types, statuses, and actions are labeled throughout Belori
        </div>
        <div style={{display:'flex',gap:8}}>
          {pills.map(p => {
            const active = langPref === p.id;
            return (
              <button
                key={p.id}
                onClick={() => handleLangChange(p.id)}
                style={{
                  background: active ? C.rosaText : C.grayBg,
                  color: active ? '#fff' : C.gray,
                  borderRadius: 20,
                  padding: '5px 14px',
                  fontWeight: active ? 600 : 400,
                  cursor: 'pointer',
                  border: 'none',
                  fontSize: 13,
                  transition: 'all 0.15s',
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>
        <div style={{fontSize:11,color:C.gray,fontStyle:'italic',marginTop:8}}>
          Bilingual mode shows English + Spanish side by side on labels. Saved to this browser.
        </div>
      </div>
    </Card>
  );
};

// ─── CURRENCY SELECTOR (Settings → Display tab) ──────────────────────────────
const CURRENCIES = [
  { code:'USD', symbol:'$',   label:'US Dollar (USD)' },
  { code:'MXN', symbol:'$',   label:'Mexican Peso (MXN)' },
  { code:'CAD', symbol:'CA$', label:'Canadian Dollar (CAD)' },
  { code:'EUR', symbol:'€',   label:'Euro (EUR)' },
  { code:'GBP', symbol:'£',   label:'British Pound (GBP)' },
];
const CurrencySelector = () => {
  const { boutique } = useAuth();
  const { updateBoutique } = useBoutique();
  const toast = useToast();
  const [code, setCode] = useState(() => localStorage.getItem('belori_currency') || 'USD');

  useEffect(() => {
    if (boutique?.currency) {
      setCode(boutique.currency);
      localStorage.setItem('belori_currency', boutique.currency);
      localStorage.setItem('belori_currency_symbol', boutique.currency_symbol || CURRENCIES.find(c => c.code === boutique.currency)?.symbol || '$');
    }
  }, [boutique?.currency]);

  const handleChange = async (e) => {
    const selected = CURRENCIES.find(c => c.code === e.target.value);
    if (!selected) return;
    setCode(selected.code);
    localStorage.setItem('belori_currency', selected.code);
    localStorage.setItem('belori_currency_symbol', selected.symbol);
    await updateBoutique({ currency: selected.code, currency_symbol: selected.symbol });
    toast('Currency updated');
  };

  return (
    <Card>
      <CardHead title="Currency"/>
      <div style={{padding:'0 16px 16px'}}>
        <div style={{fontSize:12,color:C.gray,marginBottom:10}}>Choose the currency used for displaying prices and payments</div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <span style={{fontSize:16}}>{'💱'}</span>
          <select
            value={code}
            onChange={handleChange}
            style={{...inputSt, minWidth:220, cursor:'pointer'}}
          >
            {CURRENCIES.map(c => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </select>
        </div>
        <div style={{fontSize:11,color:C.gray,fontStyle:'italic',marginTop:8}}>Currency is saved to your boutique and this browser.</div>
      </div>
    </Card>
  );
};
// ─── KIOSK MODE CARD (Display tab) ───────────────────────────────────────────
const KioskModeCard = () => {
  const { boutique } = useAuth();
  const toast = useToast();
  const [pin, setPin] = useState(() => sessionStorage.getItem('belori_kiosk_pin') || '1234');
  const [pinEdit, setPinEdit] = useState('');
  const [editing, setEditing] = useState(false);

  const kioskUrl = `${window.location.origin}/kiosk?boutique=${boutique?.id || ''}`;
  const catalogKioskUrl = `${window.location.origin}/catalog-kiosk?boutique=${boutique?.id || ''}`;

  function savePin() {
    const trimmed = pinEdit.trim();
    if (!/^\d{4}$/.test(trimmed)) return;
    sessionStorage.setItem('belori_kiosk_pin', trimmed);
    setPin(trimmed);
    setEditing(false);
    setPinEdit('');
  }

  return (
    <Card>
      <CardHead title="Kiosk Mode"/>
      <div style={{padding:'0 16px 20px'}}>
        <div style={{fontSize:12,color:C.gray,marginBottom:16}}>
          Mount a tablet at your front desk and open this URL for a self-service client check-in kiosk.
        </div>

        {/* URL display */}
        <div style={{
          display:'flex',alignItems:'center',gap:10,
          background:'#F3F4F6',borderRadius:10,padding:'12px 14px',marginBottom:16,
          border:`1px solid ${C.border}`,
        }}>
          <span style={{fontSize:12,color:C.gray,fontFamily:'monospace',flex:1,wordBreak:'break-all'}}>
            {kioskUrl}
          </span>
          <button
            onClick={async () => { try { await navigator.clipboard.writeText(kioskUrl); toast('Copied!', 'success'); } catch { toast('Could not copy — please copy manually', 'warn'); } }}
            style={{
              padding:'6px 12px',borderRadius:7,border:`1px solid ${C.border}`,
              background:C.white,color:C.ink,fontSize:12,fontWeight:500,cursor:'pointer',flexShrink:0,
            }}
          >
            Copy
          </button>
        </div>

        {/* Launch buttons */}
        <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:20}}>
          <button
            onClick={() => window.open(kioskUrl, '_blank')}
            style={{
              display:'inline-flex',alignItems:'center',gap:8,
              padding:'12px 22px',borderRadius:10,border:'none',
              background:'linear-gradient(135deg,#7C3AED,#C9697A)',
              color:'#fff',fontSize:14,fontWeight:600,cursor:'pointer',
            }}
          >
            Launch check-in kiosk →
          </button>
          <button
            onClick={() => window.open(catalogKioskUrl, '_blank')}
            style={{
              display:'inline-flex',alignItems:'center',gap:8,
              padding:'12px 22px',borderRadius:10,border:'none',
              background:'linear-gradient(135deg,#C9697A,#E8B4BB)',
              color:'#fff',fontSize:14,fontWeight:600,cursor:'pointer',
            }}
          >
            Catalog Kiosk →
          </button>
        </div>

        {/* Catalog Kiosk URL */}
        <div style={{marginBottom:16}}>
          <div style={{fontSize:12,color:C.gray,marginBottom:6,fontWeight:500}}>Catalog Kiosk URL</div>
          <div style={{
            display:'flex',alignItems:'center',gap:10,
            background:'#F3F4F6',borderRadius:10,padding:'12px 14px',
            border:`1px solid ${C.border}`,
          }}>
            <span style={{fontSize:12,color:C.gray,fontFamily:'monospace',flex:1,wordBreak:'break-all'}}>
              {catalogKioskUrl}
            </span>
            <button
              onClick={async () => { try { await navigator.clipboard.writeText(catalogKioskUrl); toast('Copied!', 'success'); } catch { toast('Could not copy — please copy manually', 'warn'); } }}
              style={{
                padding:'6px 12px',borderRadius:7,border:`1px solid ${C.border}`,
                background:C.white,color:C.ink,fontSize:12,fontWeight:500,cursor:'pointer',flexShrink:0,
              }}
            >
              Copy
            </button>
          </div>
        </div>

        {/* PIN setting */}
        <div style={{borderTop:`1px solid ${C.border}`,paddingTop:16}}>
          <div style={{fontSize:13,fontWeight:600,color:C.ink,marginBottom:8}}>Exit PIN</div>
          <div style={{fontSize:12,color:C.gray,marginBottom:10}}>
            Staff must enter this 4-digit PIN to exit kiosk mode.
          </div>
          {editing ? (
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <input
                value={pinEdit}
                onChange={e => setPinEdit(e.target.value.replace(/\D/g,'').slice(0,4))}
                placeholder="New 4-digit PIN"
                maxLength={4}
                type="password"
                style={{
                  ...inputSt,width:140,fontSize:18,letterSpacing:4,textAlign:'center',fontWeight:700,
                }}
              />
              <button
                onClick={savePin}
                disabled={!/^\d{4}$/.test(pinEdit)}
                style={{
                  padding:'8px 16px',borderRadius:8,border:'none',
                  background:C.purple,color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer',
                  opacity:/^\d{4}$/.test(pinEdit)?1:0.5,
                }}
              >
                Save
              </button>
              <button
                onClick={()=>{setEditing(false);setPinEdit('');}}
                style={{padding:'8px 14px',borderRadius:8,border:`1px solid ${C.border}`,background:C.white,fontSize:13,cursor:'pointer',color:C.gray}}
              >
                Cancel
              </button>
            </div>
          ) : (
            <div style={{display:'flex',alignItems:'center',gap:12}}>
              <span style={{fontSize:20,fontWeight:700,letterSpacing:6,color:C.ink}}>
                {'•'.repeat(pin.length)}
              </span>
              <span style={{fontSize:12,color:C.gray}}>({pin.length}-digit PIN set)</span>
              <button
                onClick={()=>setEditing(true)}
                style={{padding:'6px 14px',borderRadius:8,border:`1px solid ${C.border}`,background:C.white,color:C.ink,fontSize:12,fontWeight:500,cursor:'pointer'}}
              >
                Change PIN
              </button>
            </div>
          )}
        </div>

        <div style={{marginTop:16,fontSize:11,color:C.gray,fontStyle:'italic'}}>
          PIN is stored on this device only. Each staff device can set its own PIN.
        </div>
      </div>
    </Card>
  );
};
// ─── SETTINGS ──────────────────────────────────────────────────────────────
// ─── MODULE MANAGER (inside Settings → Modules tab) ──────────────────────────
const CATEGORY_LABELS = {core:'Core',services:'Services',client:'Client',documents:'Documents',marketing:'Marketing',finance:'Finance',operations:'Operations',security:'Security'};
const PLAN_COLORS = {all:'#15803D',growth:'#7C3AED',pro:'#F59E0B'};

const ModuleManager = () => {
  const { boutique } = useAuth();
  const { isEnabled, getModuleConfig, planTier, reload } = useModules();
  const toast = useToast();
  const [pending, setPending] = useState({});
  const [pendingConfigs, setPendingConfigs] = useState({});
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  // Merge registry with live state + pending local changes
  const moduleStates = MODULE_REGISTRY.map(m => {
    const effectiveEnabled = m.id in pending ? pending[m.id] : isEnabled(m.id);
    return { ...m, currentlyEnabled: isEnabled(m.id), planLocked: !planAllows(planTier, m.plan), effectiveEnabled };
  });

  const filtered = moduleStates.filter(m => {
    if (filter === 'enabled' && !m.effectiveEnabled) return false;
    if (filter === 'disabled' && m.effectiveEnabled) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!m.name.toLowerCase().includes(q) && !(m.description||'').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const allCategories = [...new Set(MODULE_REGISTRY.map(m => m.category))];
  const grouped = allCategories.map(cat => ({ cat, items: filtered.filter(m => m.category === cat) })).filter(g => g.items.length > 0);

  const handleToggle = (m) => {
    if (m.isCore || m.planLocked) return;
    const newVal = !(m.id in pending ? pending[m.id] : m.currentlyEnabled);
    if (!newVal) {
      const allEnabled = new Set(moduleStates.filter(x => x.id in pending ? pending[x.id] : x.currentlyEnabled).map(x => x.id));
      allEnabled.delete(m.id);
      const { blocking } = validateDisableModule(m.id, allEnabled);
      if (blocking.length > 0) { toast(`Disable ${blocking.join(', ')} first`); return; }
    }
    setPending(prev => ({ ...prev, [m.id]: newVal }));
  };

  const hasPending = Object.keys(pending).length > 0 || Object.keys(pendingConfigs).length > 0;

  const save = async () => {
    setSaving(true);
    try {
      if (Object.keys(pending).length > 0) {
        const updates = Object.entries(pending).map(([moduleId, enabled]) => ({ moduleId, enabled }));
        await saveModuleSettings(boutique.id, updates, 'Staff', planTier);
      }
      // Save any module configs independently
      for (const [moduleId, config] of Object.entries(pendingConfigs)) {
        await saveModuleConfig(boutique.id, moduleId, config);
      }
      await reload();
      setPending({});
      setPendingConfigs({});
      toast('Module settings saved ✓');
    } catch (e) {
      toast(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const activeCount  = moduleStates.filter(m => m.effectiveEnabled).length;
  const disabledCount= moduleStates.filter(m => !m.effectiveEnabled).length;
  const lockedCount  = moduleStates.filter(m => m.planLocked).length;

  return (
    <div style={{position:'relative'}}>
      {/* Stats strip */}
      <Card style={{marginBottom:16}}>
        <div style={{padding:'14px 20px',display:'flex',gap:28,alignItems:'center',flexWrap:'wrap'}}>
          {[['Active',activeCount,C.rosa],[`Disabled`,disabledCount,C.ink],[`Plan-locked`,lockedCount,C.gray]].map(([lbl,n,col])=>(
            <div key={lbl} style={{textAlign:'center'}}>
              <div style={{fontSize:22,fontWeight:700,color:col,lineHeight:1}}>{n}</div>
              <div style={{fontSize:11,color:C.gray,marginTop:2}}>{lbl}</div>
            </div>
          ))}
          <div style={{marginLeft:'auto'}}>
            <span style={{fontSize:11,fontWeight:600,padding:'4px 12px',borderRadius:12,background:C.rosaPale,color:C.rosaText,textTransform:'capitalize'}}>{planTier} plan</span>
          </div>
        </div>
      </Card>

      {/* Filter + search */}
      <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap',alignItems:'center'}}>
        {['all','enabled','disabled'].map(f=>(
          <button key={f} onClick={()=>setFilter(f)}
            style={{padding:'5px 14px',borderRadius:20,border:`1.5px solid ${filter===f?C.rosa:C.border}`,background:filter===f?C.rosaPale:'transparent',color:filter===f?C.rosaText:C.gray,cursor:'pointer',fontSize:12,fontWeight:filter===f?600:400,textTransform:'capitalize'}}>
            {f.charAt(0).toUpperCase()+f.slice(1)}
          </button>
        ))}
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search modules…"
          style={{marginLeft:'auto',padding:'5px 12px',borderRadius:20,border:`1px solid ${C.border}`,fontSize:12,color:C.ink,outline:'none',minWidth:180}}/>
      </div>

      {/* Category groups */}
      {grouped.map(({cat,items})=>(
        <div key={cat} style={{marginBottom:18}}>
          <div style={{fontSize:10,fontWeight:600,color:C.gray,letterSpacing:'0.07em',textTransform:'uppercase',marginBottom:8}}>{CATEGORY_LABELS[cat]||cat}</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(268px,1fr))',gap:10}}>
            {items.map(m=>{
              const isOn = m.id in pending ? pending[m.id] : m.currentlyEnabled;
              const changed = m.id in pending;
              return (
                <div key={m.id} style={{background:C.white,borderRadius:12,padding:'13px 15px',border:`1.5px solid ${changed?C.rosa:C.border}`,transition:'border 0.15s'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:5}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:2,flexWrap:'wrap'}}>
                        <span style={{fontSize:13,fontWeight:600,color:C.ink}}>{m.name}</span>
                        {m.plan!=='all'&&<span style={{fontSize:10,padding:'1px 6px',borderRadius:9,background:`${PLAN_COLORS[m.plan]||C.gray}1A`,color:PLAN_COLORS[m.plan]||C.gray,fontWeight:500,textTransform:'capitalize',flexShrink:0}}>{m.plan}</span>}
                      </div>
                      <div style={{fontSize:11,color:C.gray,lineHeight:1.4}}>{m.description||''}</div>
                    </div>
                    <div style={{marginLeft:10,flexShrink:0,paddingTop:1}}>
                      {m.isCore
                        ? <span style={{fontSize:10,color:C.green,background:C.greenBg,padding:'3px 8px',borderRadius:9,fontWeight:500,whiteSpace:'nowrap'}}>Always on</span>
                        : m.planLocked
                          ? <span style={{fontSize:10,color:C.gray,background:C.grayBg,padding:'3px 8px',borderRadius:9,fontWeight:500,whiteSpace:'nowrap'}}>Upgrade</span>
                          : <div onClick={()=>handleToggle(m)} title={isOn?'Disable':'Enable'}
                              style={{width:38,height:21,borderRadius:11,background:isOn?C.rosa:C.border,cursor:'pointer',position:'relative',transition:'background 0.2s',flexShrink:0}}>
                              <div style={{width:17,height:17,borderRadius:'50%',background:'white',position:'absolute',top:2,left:isOn?19:2,transition:'left 0.2s'}}/>
                            </div>
                      }
                    </div>
                  </div>
                  {m.features&&m.features.length>0&&(
                    <ul style={{margin:'6px 0 0',padding:'0 0 0 14px',listStyle:'disc'}}>
                      {m.features.slice(0,3).map(f=><li key={f} style={{fontSize:11,color:C.gray,lineHeight:1.6}}>{f}</li>)}
                    </ul>
                  )}
                  {m.id==='dress_rental'&&isOn&&(
                    <div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${C.border}`}}>
                      <div style={{fontSize:11,color:C.gray,marginBottom:4}}>Late fee per day ($)</div>
                      <input
                        type="number" min="0" step="1"
                        value={pendingConfigs['dress_rental']?.late_fee_per_day ?? getModuleConfig('dress_rental')?.late_fee_per_day ?? 25}
                        onChange={e=>setPendingConfigs(p=>({...p,dress_rental:{...(p.dress_rental||getModuleConfig('dress_rental')||{}),late_fee_per_day:Number(e.target.value)||0}}))}
                        style={{...inputSt,maxWidth:90,fontSize:12,padding:'5px 8px'}}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Sticky save bar */}
      {hasPending&&(
        <div style={{position:'sticky',bottom:0,background:C.white,borderTop:`1px solid ${C.border}`,padding:'12px 16px',display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:12,borderRadius:'0 0 12px 12px',boxShadow:'0 -4px 16px rgba(0,0,0,0.06)'}}>
          <span style={{fontSize:13,color:C.gray}}>{Object.keys(pending).length} unsaved change{Object.keys(pending).length!==1?'s':''}</span>
          <div style={{display:'flex',gap:8}}>
            <GhostBtn label="Discard" onClick={()=>{setPending({});setPendingConfigs({});}} colorScheme="danger"/>
            <PrimaryBtn label={saving?'Saving…':'Save changes'} onClick={save} colorScheme="success"/>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── BILLING TAB ─────────────────────────────────────────────────────────────
const STATUS_LABELS = { trialing:'Trial', active:'Active', canceled:'Canceled', past_due:'Past due', incomplete:'Incomplete' };
const STATUS_COLORS = { trialing:{bg:C.amberBg,color:C.warningText}, active:{bg:C.greenBg,color:C.green}, canceled:{bg:C.grayBg,color:C.gray}, past_due:{bg:C.redBg,color:C.red}, incomplete:{bg:C.redBg,color:C.red} };

const PLAN_LIMITS = {
  starter: { events: 50, staff: 1 },
  growth:  { events: null, staff: 5 },
  pro:     { events: null, staff: null },
};
const BillingTab = () => {
  const { plan, status, trialDaysLeft, isTrialing, hasActiveSubscription, loading, error, startCheckout, openBillingPortal } = useBilling();
  const { boutique } = useAuth();
  const toast = useToast();
  const [checkingOut, setCheckingOut] = useState(null);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (!boutique?.id) return;
    const thisYear = new Date().getFullYear();
    Promise.all([
      supabase.from('events').select('id', { count: 'exact', head: true })
        .eq('boutique_id', boutique.id)
        .gte('event_date', `${thisYear}-01-01`),
      supabase.from('clients').select('id', { count: 'exact', head: true })
        .eq('boutique_id', boutique.id),
      supabase.from('boutique_members').select('id', { count: 'exact', head: true })
        .eq('boutique_id', boutique.id),
      supabase.from('service_packages').select('id', { count: 'exact', head: true })
        .eq('boutique_id', boutique.id).eq('active', true),
    ]).then(([ev, cl, st, pk]) => {
      setStats({ events: ev.count ?? 0, clients: cl.count ?? 0, staff: st.count ?? 0, packages: pk.count ?? 0 });
    });
  }, [boutique?.id]);

  const handleUpgrade = async (planId) => {
    setCheckingOut(planId);
    try { await startCheckout(planId); }
    catch (e) { toast(e.message || 'Could not start checkout', 'error'); setCheckingOut(null); }
  };

  const statusColor = STATUS_COLORS[status] || STATUS_COLORS.trialing;

  return (
    <div style={{display:'flex',flexDirection:'column',gap:20}}>
      {/* Current status header */}
      <Card>
        <div style={{padding:'20px 24px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:16,flexWrap:'wrap'}}>
          <div>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
              <span style={{fontSize:18,fontWeight:700,color:C.ink,textTransform:'capitalize'}}>{plan} plan</span>
              <span style={{fontSize:11,padding:'3px 10px',borderRadius:999,background:statusColor.bg,color:statusColor.color,fontWeight:600}}>{STATUS_LABELS[status]||status}</span>
            </div>
            {isTrialing && trialDaysLeft !== null && (
              <div style={{fontSize:13,color:trialDaysLeft<=3?C.red:C.amber}}>
                {trialDaysLeft > 0 ? `${trialDaysLeft} day${trialDaysLeft!==1?'s':''} left in your trial` : 'Trial ended'}
              </div>
            )}
            {!isTrialing && status==='active' && (
              <div style={{fontSize:12,color:C.gray}}>Your subscription is active. Manage invoices and payment methods below.</div>
            )}
            {status==='canceled' && (
              <div style={{fontSize:12,color:C.red}}>Your subscription was canceled. Upgrade to restore full access.</div>
            )}
            {status==='past_due' && (
              <div style={{fontSize:12,color:C.red}}>Payment failed. Update your payment method to avoid interruption.</div>
            )}
          </div>
          {hasActiveSubscription && (
            <button onClick={openBillingPortal} disabled={loading}
              style={{padding:'9px 18px',borderRadius:8,border:`1px solid ${C.border}`,background:C.white,cursor:'pointer',fontSize:13,fontWeight:500,color:C.ink,whiteSpace:'nowrap',flexShrink:0}}>
              {loading?'Opening…':'Manage billing →'}
            </button>
          )}
        </div>
        {error && <div style={{padding:'10px 24px 16px',fontSize:12,color:C.red}}>{error}</div>}
      </Card>

      {/* Upgrade CTA for non-Pro plans */}
      {['free','starter','growth'].includes(plan) && (
        <div style={{
          background:'linear-gradient(135deg,#667EEA15,#764BA215)',
          border:'2px solid #667EEA40',
          borderRadius:14,padding:'20px 24px',
          display:'flex',alignItems:'center',justifyContent:'space-between',gap:16,flexWrap:'wrap'
        }}>
          <div style={{flex:1,minWidth:200}}>
            <div style={{fontSize:14,fontWeight:700,color:'#4C1D95',marginBottom:4}}>✨ Unlock Pro features</div>
            <div style={{fontSize:12,color:'#6D28D9',lineHeight:1.5}}>
              AI task suggestions · Advanced analytics · Heatmaps · YoY comparisons · QuickBooks &amp; Mailchimp sync · Profitability ranking
            </div>
          </div>
          <button
            onClick={() => document.dispatchEvent(new CustomEvent('belori:show-upgrade', { detail: { feature: 'Pro Plan', minPlan: 'pro' } }))}
            style={{padding:'10px 22px',borderRadius:10,border:'none',cursor:'pointer',background:'linear-gradient(135deg,#667EEA,#764BA2)',color:'#fff',fontSize:13,fontWeight:700,boxShadow:'0 4px 15px rgba(102,126,234,0.35)',whiteSpace:'nowrap',flexShrink:0}}>
            See Pro features →
          </button>
        </div>
      )}

      {/* Usage stats */}
      {stats && (()=>{
        const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.starter;
        const statDefs = [
          { label: 'Events this year', value: stats.events, limit: limits.events },
          { label: 'Clients',          value: stats.clients, limit: null },
          { label: 'Staff members',    value: stats.staff,   limit: limits.staff },
          { label: 'Active packages',  value: stats.packages, limit: null },
        ];
        return (
          <Card>
            <CardHead title="Current usage"/>
            <div style={{padding:'4px 16px 16px',display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:12}}>
              {statDefs.map(s=>{
                const pct = s.limit ? Math.min(100, Math.round(s.value / s.limit * 100)) : null;
                const nearLimit = pct !== null && pct >= 80;
                return (
                  <div key={s.label} style={{padding:'12px',borderRadius:10,background:C.ivory,border:`1px solid ${nearLimit?C.amber:C.border}`}}>
                    <div style={{fontSize:22,fontWeight:700,color:nearLimit?C.amber:C.ink,lineHeight:1,marginBottom:4}}>{s.value}</div>
                    <div style={{fontSize:11,color:C.gray,marginBottom:s.limit?4:0}}>{s.label}</div>
                    {s.limit && (
                      <>
                        <div style={{height:4,borderRadius:2,background:C.border,marginBottom:3,overflow:'hidden'}}>
                          <div style={{height:'100%',borderRadius:2,background:nearLimit?C.amber:'#16a34a',width:`${pct}%`,transition:'width 0.4s'}}/>
                        </div>
                        <div style={{fontSize:10,color:nearLimit?C.amber:C.gray}}>{s.value} / {s.limit} limit</div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })()}

      {/* Plan cards */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:16}}>
        {PLANS.map(p => {
          const isCurrent = p.id === plan;
          return (
            <div key={p.id} style={{background:C.white,borderRadius:14,border:`2px solid ${p.highlight&&!isCurrent?C.rosa:isCurrent?C.green:C.border}`,padding:'20px 20px 16px',display:'flex',flexDirection:'column',position:'relative',boxShadow:p.highlight?'0 4px 20px rgba(201,105,122,0.10)':'none'}}>
              {p.highlight && !isCurrent && (
                <div style={{position:'absolute',top:-11,left:'50%',transform:'translateX(-50%)',background:C.rosa,color:C.white,fontSize:10,fontWeight:700,padding:'3px 12px',borderRadius:999,whiteSpace:'nowrap',letterSpacing:'0.05em'}}>MOST POPULAR</div>
              )}
              {isCurrent && (
                <div style={{position:'absolute',top:-11,left:'50%',transform:'translateX(-50%)',background:C.green,color:C.white,fontSize:10,fontWeight:700,padding:'3px 12px',borderRadius:999,whiteSpace:'nowrap',letterSpacing:'0.05em'}}>CURRENT PLAN</div>
              )}
              <div style={{marginBottom:4}}>
                <span style={{fontSize:15,fontWeight:700,color:C.ink}}>{p.name}</span>
              </div>
              <div style={{marginBottom:12}}>
                <span style={{fontSize:28,fontWeight:700,color:C.ink}}>${p.price}</span>
                <span style={{fontSize:12,color:C.gray}}>/month</span>
              </div>
              <div style={{fontSize:12,color:C.gray,marginBottom:16,lineHeight:1.5}}>{p.description}</div>
              <ul style={{margin:'0 0 20px',padding:'0 0 0 16px',listStyle:'disc',flex:1}}>
                {p.features.map(f=>(
                  <li key={f} style={{fontSize:12,color:C.inkLight,lineHeight:1.7}}>{f}</li>
                ))}
              </ul>
              {isCurrent ? (
                <div style={{padding:'9px',borderRadius:8,background:C.grayBg,textAlign:'center',fontSize:13,color:C.gray,fontWeight:500}}>Current plan</div>
              ) : p.id === 'starter' ? (
                <div style={{padding:'9px',borderRadius:8,background:C.grayBg,textAlign:'center',fontSize:13,color:C.gray,fontWeight:500}}>Downgrade via support</div>
              ) : (
                <button onClick={()=>handleUpgrade(p.id)} disabled={!!checkingOut||loading}
                  style={{padding:'9px',borderRadius:8,border:'none',background:p.highlight?C.rosa:C.ink,color:C.white,cursor:checkingOut?'default':'pointer',fontSize:13,fontWeight:600,transition:'opacity 0.15s',opacity:checkingOut?0.7:1}}>
                  {checkingOut===p.id?'Redirecting to Stripe…':`Upgrade to ${p.name} →`}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div style={{fontSize:11,color:C.gray,textAlign:'center'}}>
        Payments securely processed by Stripe. Cancel anytime. Questions? <a href="mailto:support@belori.app" style={{color:C.rosaText}}>Contact support</a>
      </div>
    </div>
  );
};

// ─── INVITE STAFF MODAL ─────────────────────────────────────────────────────
const ROLE_OPTIONS = [
  {value:'coordinator',label:'Coordinator'},
  {value:'front_desk',label:'Front desk'},
  {value:'seamstress',label:'Seamstress'},
  {value:'decorator',label:'Decorator'},
];
const InviteStaffModal = ({onClose, sendInvite, toast, boutique}) => {
  const [email,setEmail]=useState('');
  const [role,setRole]=useState('front_desk');
  const [inviteLink,setInviteLink]=useState('');
  const [sending,setSending]=useState(false);
  const [err,setErr]=useState('');

  const send=async()=>{
    if(!email.trim()||!/\S+@\S+\.\S+/.test(email)){setErr('Valid email required');return;}
    setSending(true);setErr('');
    const {token,error}=await sendInvite(email.trim(),role);
    if(error){setErr(error.message||'Failed to send invite');setSending(false);return;}
    const link=`${window.location.origin}/join/${token}`;
    setInviteLink(link);
    // Fire invite email (fire-and-forget)
    sendInngestEvent('belori/staff.invited',{
      email: email.trim(),
      boutique_name: boutique?.name || 'Your boutique',
      role,
      invite_link: link,
    });
    setSending(false);
    toast('Invite sent ✓');
  };

  return (
    <div className="modal-overlay" style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}}>
      <div role="dialog" aria-modal="true" aria-labelledby="settings-invite-staff-title" style={{background:C.white,borderRadius:16,width:420,overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,0.15)'}}>
        <div style={{padding:'18px 20px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span id="settings-invite-staff-title" style={{fontWeight:600,fontSize:15,color:C.ink}}>Invite staff member</span>
          <button onClick={onClose} style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:C.gray,lineHeight:1}}>×</button>
        </div>
        <div style={{padding:20,display:'flex',flexDirection:'column',gap:12}}>
          {err&&<div style={{fontSize:12,color:'var(--text-danger)',background:'var(--bg-danger)',padding:'8px 12px',borderRadius:7}}>{err}</div>}
          {inviteLink?(
            <>
              <div style={{fontSize:13,color:C.green,background:C.greenBg,padding:'10px 12px',borderRadius:8,fontWeight:500}}>✓ Invite link created</div>
              <div>
                <div style={{...LBL,marginBottom:6}}>Share this link with {email}</div>
                <div style={{display:'flex',gap:8}}>
                  <input readOnly value={inviteLink} style={{...inputSt,fontSize:11,color:C.gray,flex:1}}/>
                  <button onClick={async()=>{ try { await navigator.clipboard.writeText(inviteLink); toast('Copied!', 'success'); } catch { toast('Could not copy — please copy manually', 'warn'); } }}
                    style={{padding:'0 14px',borderRadius:7,border:`1px solid ${C.border}`,background:C.grayBg,cursor:'pointer',fontSize:12,color:C.ink,whiteSpace:'nowrap',flexShrink:0}}>
                    Copy
                  </button>
                </div>
                <div style={{fontSize:11,color:C.gray,marginTop:6}}>Link expires in 7 days</div>
              </div>
            </>
          ):(
            <>
              <div><label htmlFor="invite-email" style={LBL}>Email</label><input id="invite-email" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="staff@boutique.com" style={{...inputSt}}/></div>
              <div><label htmlFor="invite-role" style={LBL}>Role</label>
                <select id="invite-role" value={role} onChange={e=>setRole(e.target.value)} style={{...inputSt}}>
                  {ROLE_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </>
          )}
        </div>
        <div style={{padding:'12px 20px',borderTop:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between'}}>
          <GhostBtn label={inviteLink?'Close':'Cancel'} colorScheme="danger" onClick={onClose}/>
          {!inviteLink&&<PrimaryBtn label={sending?'Creating…':'Create invite link'} colorScheme="success" onClick={send}/>}
        </div>
      </div>
    </div>
  );
};

// ─── AVAILABILITY MODAL ───────────────────────────────────────────────────────
const DAYS = [
  {label:'Monday',    index:1},
  {label:'Tuesday',   index:2},
  {label:'Wednesday', index:3},
  {label:'Thursday',  index:4},
  {label:'Friday',    index:5},
  {label:'Saturday',  index:6},
  {label:'Sunday',    index:0},
];
const TIME_OPTIONS = [
  {label:'7:00 AM',  value:'07:00'},
  {label:'8:00 AM',  value:'08:00'},
  {label:'9:00 AM',  value:'09:00'},
  {label:'10:00 AM', value:'10:00'},
  {label:'11:00 AM', value:'11:00'},
  {label:'12:00 PM', value:'12:00'},
  {label:'1:00 PM',  value:'13:00'},
  {label:'2:00 PM',  value:'14:00'},
  {label:'3:00 PM',  value:'15:00'},
  {label:'4:00 PM',  value:'16:00'},
  {label:'5:00 PM',  value:'17:00'},
  {label:'6:00 PM',  value:'18:00'},
  {label:'7:00 PM',  value:'19:00'},
  {label:'8:00 PM',  value:'20:00'},
];
const DEFAULT_DAY = {available:true, start:'09:00', end:'17:00'};

const AvailabilityModal = ({member, boutique, onClose, toast}) => {
  const [days, setDays] = useState(DAYS.map(d => ({...d, ...DEFAULT_DAY})));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Blockout dates
  const [blockouts, setBlockouts] = useState([]);
  const [showAddBlockout, setShowAddBlockout] = useState(false);
  const [blockoutForm, setBlockoutForm] = useState({start_date:'', end_date:'', reason:''});
  const [savingBlockout, setSavingBlockout] = useState(false);
  const today = new Date().toISOString().slice(0,10);

  useEffect(() => {
    if (!member?.user_id) { setLoading(false); return; }
    Promise.all([
      supabase
        .from('staff_availability')
        .select('day_of_week, start_time, end_time, available')
        .eq('staff_id', member.user_id)
        .eq('boutique_id', boutique.id),
      supabase
        .from('staff_blockouts')
        .select('id, start_date, end_date, reason')
        .eq('boutique_id', boutique.id)
        .eq('user_id', member.user_id)
        .order('start_date', {ascending: true}),
    ]).then(([{data: avData}, {data: blData}]) => {
      if (avData && avData.length > 0) {
        setDays(prev => prev.map(d => {
          const row = avData.find(r => r.day_of_week === d.index);
          return row
            ? {...d, available: row.available, start: row.start_time?.slice(0,5) || '09:00', end: row.end_time?.slice(0,5) || '17:00'}
            : {...d, available: false};
        }));
      }
      setBlockouts(blData || []);
      setLoading(false);
    });
  }, [member?.user_id, boutique?.id]);

  const setDay = (index, field, value) => {
    setDays(prev => prev.map(d => d.index === index ? {...d, [field]: value} : d));
  };

  const save = async () => {
    setSaving(true);
    await supabase.from('staff_availability').delete()
      .eq('staff_id', member.user_id).eq('boutique_id', boutique.id);
    const rows = days.map(d => ({
      boutique_id: boutique.id,
      staff_id: member.user_id,
      day_of_week: d.index,
      start_time: d.start,
      end_time: d.end,
      available: d.available,
    }));
    const {error} = await supabase.from('staff_availability').insert(rows);
    setSaving(false);
    if (error) { toast(error.message, 'error'); return; }
    toast('Availability saved ✓');
    onClose();
  };

  const addBlockout = async () => {
    if (!blockoutForm.start_date || !blockoutForm.end_date) { toast('Start and end dates are required', 'warn'); return; }
    if (blockoutForm.end_date < blockoutForm.start_date) { toast('End date must be on or after start date', 'warn'); return; }
    setSavingBlockout(true);
    const {data, error} = await supabase
      .from('staff_blockouts')
      .insert({boutique_id: boutique.id, user_id: member.user_id, start_date: blockoutForm.start_date, end_date: blockoutForm.end_date, reason: blockoutForm.reason || null})
      .select().single();
    setSavingBlockout(false);
    if (error) { toast(error.message, 'error'); return; }
    setBlockouts(prev => [...prev, data].sort((a,b) => a.start_date.localeCompare(b.start_date)));
    setShowAddBlockout(false);
    setBlockoutForm({start_date:'', end_date:'', reason:''});
    toast('Time off added ✓');
  };

  const removeBlockout = async (id) => {
    const {error} = await supabase.from('staff_blockouts').delete().eq('id', id).eq('boutique_id', boutique.id);
    if (error) { toast(error.message, 'error'); return; }
    setBlockouts(prev => prev.filter(b => b.id !== id));
    toast('Removed');
  };

  const fmtDate = (d) => {
    if (!d) return '';
    const [y,m,dd] = d.split('-');
    return `${m}/${dd}/${y}`;
  };

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1100,padding:16}}>
      <div role="dialog" aria-modal="true" aria-labelledby="settings-staff-availability-title" style={{background:C.white,borderRadius:16,width:560,maxHeight:'92vh',overflowY:'auto',boxShadow:'0 20px 60px rgba(0,0,0,0.15)'}}>
        <div style={{padding:'18px 20px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center',position:'sticky',top:0,background:C.white,zIndex:1}}>
          <span id="settings-staff-availability-title" style={{fontWeight:600,fontSize:15,color:C.ink}}>Availability — {member.name}</span>
          <button onClick={onClose} style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:C.gray,lineHeight:1}}>×</button>
        </div>
        <div style={{padding:20}}>
          {loading ? (
            <div style={{textAlign:'center',padding:'24px 0',color:C.gray,fontSize:13}}>Loading…</div>
          ) : (
            <>
              {/* ── Weekly Schedule ── */}
              <div style={{fontSize:12,fontWeight:600,color:C.ink,marginBottom:10,textTransform:'uppercase',letterSpacing:'0.05em'}}>Weekly schedule</div>
              <div style={{display:'flex',flexDirection:'column',gap:0,marginBottom:24}}>
                {days.map((d, i) => (
                  <div key={d.index} style={{
                    display:'flex', alignItems:'center', gap:12, padding:'10px 0',
                    borderBottom: i < days.length - 1 ? `1px solid ${C.border}` : 'none',
                    opacity: d.available ? 1 : 0.55,
                  }}>
                    <div style={{width:90,fontSize:13,fontWeight:500,color:C.ink,flexShrink:0}}>{d.label}</div>
                    <div
                      onClick={() => setDay(d.index, 'available', !d.available)}
                      style={{
                        width:40, height:22, borderRadius:11,
                        background: d.available ? C.rosa : C.border,
                        cursor:'pointer', position:'relative', transition:'background 0.2s', flexShrink:0,
                      }}
                    >
                      <div style={{
                        width:18, height:18, borderRadius:'50%', background:'white',
                        position:'absolute', top:2,
                        left: d.available ? 20 : 2, transition:'left 0.2s',
                      }}/>
                    </div>
                    <span style={{fontSize:12,color:d.available?C.ink:C.gray,width:36,flexShrink:0}}>
                      {d.available ? 'On' : 'Off'}
                    </span>
                    <select
                      value={d.start}
                      onChange={e => setDay(d.index, 'start', e.target.value)}
                      disabled={!d.available}
                      style={{...inputSt, flex:1, fontSize:12, padding:'6px 8px'}}
                    >
                      {TIME_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <span style={{fontSize:12,color:C.gray,flexShrink:0}}>to</span>
                    <select
                      value={d.end}
                      onChange={e => setDay(d.index, 'end', e.target.value)}
                      disabled={!d.available}
                      style={{...inputSt, flex:1, fontSize:12, padding:'6px 8px'}}
                    >
                      {TIME_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                ))}
              </div>

              {/* ── Block-out dates ── */}
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                <div style={{fontSize:12,fontWeight:600,color:C.ink,textTransform:'uppercase',letterSpacing:'0.05em'}}>Time off / block-out dates</div>
                <button
                  onClick={() => setShowAddBlockout(v => !v)}
                  style={{fontSize:11,padding:'4px 12px',borderRadius:7,border:`1.5px solid ${C.rosa}`,background:showAddBlockout?C.rosa:C.white,color:showAddBlockout?C.white:C.rosaText,cursor:'pointer',fontWeight:500,minHeight:'unset',minWidth:'unset'}}
                >
                  {showAddBlockout ? 'Cancel' : '+ Add time off'}
                </button>
              </div>

              {showAddBlockout && (
                <div style={{background:C.grayBg,borderRadius:10,padding:'14px 14px',marginBottom:14,display:'flex',flexDirection:'column',gap:10}}>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                    <div>
                      <div style={{...LBL,marginBottom:4}}>Start date</div>
                      <input type="date" value={blockoutForm.start_date} min={today}
                        onChange={e => setBlockoutForm(f=>({...f, start_date:e.target.value, end_date: e.target.value > f.end_date ? e.target.value : f.end_date}))}
                        style={{...inputSt}}/>
                    </div>
                    <div>
                      <div style={{...LBL,marginBottom:4}}>End date</div>
                      <input type="date" value={blockoutForm.end_date} min={blockoutForm.start_date||today}
                        onChange={e => setBlockoutForm(f=>({...f, end_date:e.target.value}))}
                        style={{...inputSt}}/>
                    </div>
                  </div>
                  <div>
                    <div style={{...LBL,marginBottom:4}}>Reason (optional)</div>
                    <input value={blockoutForm.reason} onChange={e => setBlockoutForm(f=>({...f,reason:e.target.value}))}
                      placeholder="e.g. Vacation, personal day, holiday…"
                      style={{...inputSt}}/>
                  </div>
                  <div style={{display:'flex',justifyContent:'flex-end'}}>
                    <PrimaryBtn label={savingBlockout?'Saving…':'Add blockout'} colorScheme="success" onClick={addBlockout}/>
                  </div>
                </div>
              )}

              {blockouts.length === 0 ? (
                <div style={{fontSize:12,color:C.gray,padding:'10px 0',fontStyle:'italic'}}>No blockout dates set.</div>
              ) : (
                <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  {blockouts.map(bl => {
                    const isPast = bl.end_date < today;
                    const isUpcoming = !isPast;
                    return (
                      <div key={bl.id} style={{
                        display:'flex',alignItems:'center',gap:10,padding:'8px 12px',borderRadius:8,
                        background: isUpcoming ? C.amberBg : C.grayBg,
                        border: `1px solid ${isUpcoming ? '#FDE68A' : C.border}`,
                      }}>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:12,fontWeight:500,color:isPast?C.gray:C.ink}}>
                            {fmtDate(bl.start_date)}{bl.start_date !== bl.end_date ? ` – ${fmtDate(bl.end_date)}` : ''}
                            {bl.reason && <span style={{color:isPast?C.gray:C.amber,marginLeft:6,fontWeight:400}}>· {bl.reason}</span>}
                          </div>
                          {isPast && <div style={{fontSize:10,color:C.gray}}>Past</div>}
                        </div>
                        <button
                          onClick={() => removeBlockout(bl.id)}
                          style={{background:'none',border:'none',cursor:'pointer',color:C.gray,fontSize:16,lineHeight:1,padding:'0 4px',minHeight:'unset',minWidth:'unset'}}
                          title="Remove"
                        >×</button>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
        <div style={{padding:'12px 20px',borderTop:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',position:'sticky',bottom:0,background:C.white}}>
          <GhostBtn label="Cancel" colorScheme="danger" onClick={onClose}/>
          <PrimaryBtn label={saving?'Saving…':'Save schedule'} colorScheme="success" onClick={save}/>
        </div>
      </div>
    </div>
  );
};

// ─── EDIT STAFF MODAL ─────────────────────────────────────────────────────────
const STAFF_ROLES = ['owner','coordinator','front_desk','seamstress','decorator'];
const EditStaffModal = ({member, updateStaffMember, onClose, onSaved}) => {
  const [name,setName]=useState(member.name||'');
  const [role,setRole]=useState(member.role||'front_desk');
  const [commType,setCommType]=useState(member.commission_type||'none');
  const [commPct,setCommPct]=useState(member.commission_pct!=null?String(member.commission_pct):'0');
  const [commFlat,setCommFlat]=useState(member.commission_flat!=null?String(member.commission_flat):'0');
  const [saving,setSaving]=useState(false);
  const [err,setErr]=useState('');
  const save=async()=>{
    if(!name.trim()){setErr('Name is required');return;}
    setSaving(true);setErr('');
    const updates = {
      name: name.trim(),
      role,
      commission_type: commType,
      commission_pct: commType==='percent' ? parseFloat(commPct)||0 : 0,
      commission_flat: commType==='flat' ? parseFloat(commFlat)||0 : 0,
    };
    const {error}=await updateStaffMember(member.id, updates);
    setSaving(false);
    if(error){setErr(error.message);return;}
    onSaved({id:member.id,...updates});
  };
  return (
    <div className="modal-overlay" style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}}>
      <div role="dialog" aria-modal="true" aria-labelledby="settings-edit-staff-title" style={{background:C.white,borderRadius:16,width:420,overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,0.15)'}}>
        <div style={{padding:'18px 20px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span id="settings-edit-staff-title" style={{fontWeight:600,fontSize:15,color:C.ink}}>Edit staff member</span>
          <button onClick={onClose} style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:C.gray,lineHeight:1}}>×</button>
        </div>
        <div style={{padding:20,display:'flex',flexDirection:'column',gap:12}}>
          {err&&<div style={{fontSize:12,color:'var(--text-danger)',background:'var(--bg-danger)',padding:'8px 12px',borderRadius:7}}>{err}</div>}
          <div><label htmlFor="staff-name" style={LBL}>Full name</label><input id="staff-name" value={name} onChange={e=>setName(e.target.value)} style={{...inputSt}}/></div>
          <div><label htmlFor="staff-role" style={LBL}>Role</label>
            <select id="staff-role" value={role} onChange={e=>setRole(e.target.value)} style={{...inputSt}}>
              {STAFF_ROLES.map(r=><option key={r} value={r}>{r.charAt(0).toUpperCase()+r.slice(1).replace('_',' ')}</option>)}
            </select>
          </div>
          <div style={{borderTop:`1px solid ${C.border}`,paddingTop:12,marginTop:4}}>
            <div style={{fontSize:12,fontWeight:600,color:C.ink,marginBottom:10}}>Commission</div>
            <div><label htmlFor="staff-commtype" style={LBL}>Commission type</label>
              <select id="staff-commtype" value={commType} onChange={e=>setCommType(e.target.value)} style={{...inputSt}}>
                <option value="none">None</option>
                <option value="percent">Percentage of event total</option>
                <option value="flat">Flat fee per event</option>
              </select>
            </div>
            {commType==='percent'&&(
              <div style={{marginTop:10}}>
                <label htmlFor="staff-commperc" style={LBL}>Percentage (%)</label>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <input id="staff-commperc" type="number" min="0" max="100" step="0.5" value={commPct}
                    onChange={e=>setCommPct(e.target.value)}
                    style={{...inputSt,width:100}}/>
                  <span style={{fontSize:13,color:C.gray}}>% of event total</span>
                </div>
              </div>
            )}
            {commType==='flat'&&(
              <div style={{marginTop:10}}>
                <label htmlFor="staff-commflat" style={LBL}>Flat amount ($)</label>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <input id="staff-commflat" type="number" min="0" step="1" value={commFlat}
                    onChange={e=>setCommFlat(e.target.value)}
                    style={{...inputSt,width:100}}/>
                  <span style={{fontSize:13,color:C.gray}}>per event</span>
                </div>
              </div>
            )}
          </div>
        </div>
        <div style={{padding:'12px 20px',borderTop:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between'}}>
          <GhostBtn label="Cancel" colorScheme="danger" onClick={onClose}/>
          <PrimaryBtn label={saving?'Saving…':'Save changes'} colorScheme="success" onClick={save}/>
        </div>
      </div>
    </div>
  );
};

const AUTOMATION_DEFS = [
  {key:'sms24h',       label:'24h appointment reminder',   desc:'SMS sent the day before every appointment'},
  {key:'sms2h',        label:'2h appointment reminder',    desc:'SMS sent 2 hours before appointment start'},
  {key:'paymentReminder',label:'Payment due reminder',     desc:'SMS + email 3 days before milestone due date'},
  {key:'overdueAlert', label:'Overdue payment alerts',     desc:'1, 7, 14 days after due date'},
  {key:'returnReminder',label:'Dress return reminder',     desc:'SMS 48 hours before rental return date'},
  {key:'reviewRequest',label:'Post-event review request',  desc:'SMS 24 hours after event date (5-star filter active)'},
  {key:'winBack',         label:'Win-back campaign',          desc:'SMS to clients with no activity in 60+ days'},
  {key:'weeklyDigest',    label:'Weekly event digest',        desc:'Email to owner every Monday morning'},
  {key:'birthdaySms',         label:'Birthday SMS',          desc:'Send a birthday greeting SMS to clients on their birthday'},
  {key:'anniversarySms',      label:'Anniversary SMS',       desc:'Send an anniversary SMS to clients on their event anniversary'},
];
const DEFAULT_AUTOMATIONS = {sms24h:true,sms2h:true,paymentReminder:true,overdueAlert:true,returnReminder:true,reviewRequest:true,winBack:false,weeklyDigest:true,birthdaySms:true,anniversarySms:true};
const DEFAULT_SMS_TEMPLATES = {
  paymentReminder: 'Hi {name}, your payment of {amount} for your event is due in 3 days. Please contact {boutique_name} if you have any questions.',
  overdueAlert:    'Hi {name}, your payment of {amount} was due {days} ago. Please reach out to {boutique_name} to arrange payment.',
  returnReminder:  'Hi {name}, your dress is due for return in 2 days. Please contact {boutique_name} to confirm your return.',
};

// ─── EMBED WIDGET SECTION ────────────────────────────────────────────────────
const EmbedWidgetSection = ({ boutiqueId }) => {
  const toast = useToast();
  const [btnText, setBtnText] = useState('');
  const origin = import.meta.env.VITE_APP_URL || 'https://belori.app';

  const snippet = btnText.trim()
    ? `<script src="${origin}/embed.js" data-boutique-id="${boutiqueId || 'YOUR_BOUTIQUE_ID'}" data-button-text="${btnText.trim()}"><\/script>`
    : `<script src="${origin}/embed.js" data-boutique-id="${boutiqueId || 'YOUR_BOUTIQUE_ID'}"><\/script>`;

  const copySnippet = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      toast('Snippet copied!', 'success');
    } catch {
      toast('Could not copy — please copy manually', 'warn');
    }
  };

  return (
    <div style={{padding:'0 16px 20px',borderTop:`1px solid ${C.border}`,marginTop:4,paddingTop:14}}>
      <div style={{fontSize:12,fontWeight:500,color:C.ink,marginBottom:4}}>Website embed widget</div>
      <div style={{fontSize:12,color:C.gray,marginBottom:12}}>
        Add a booking button to your website by pasting this code snippet just before the <code style={{fontSize:11,background:C.ivory,padding:'1px 5px',borderRadius:4,color:C.ink}}>&lt;/body&gt;</code> tag.
      </div>

      {/* Code block */}
      <div style={{position:'relative',marginBottom:12}}>
        <pre style={{margin:0,padding:'12px 14px',background:C.ivory,border:`1px solid ${C.border}`,borderRadius:8,fontSize:11,color:C.ink,fontFamily:'monospace',overflowX:'auto',whiteSpace:'pre-wrap',wordBreak:'break-all',lineHeight:1.6}}>
          {snippet}
        </pre>
        <button
          onClick={copySnippet}
          style={{position:'absolute',top:8,right:8,padding:'4px 10px',borderRadius:6,border:`1px solid ${C.border}`,background:C.white,fontSize:11,fontWeight:500,color:C.ink,cursor:'pointer',minHeight:'unset',minWidth:'unset',transition:'border-color 0.15s,color 0.15s'}}
          onMouseEnter={e=>{e.currentTarget.style.borderColor=C.rosa;e.currentTarget.style.color=C.rosa;}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.ink;}}>
          Copy
        </button>
      </div>

      {/* Customize button text */}
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14}}>
        <div style={{fontSize:11,color:C.gray,whiteSpace:'nowrap',flexShrink:0}}>Button text:</div>
        <input
          value={btnText}
          onChange={e=>setBtnText(e.target.value)}
          placeholder="💍 Book a consultation (default)"
          style={{flex:1,padding:'6px 10px',borderRadius:7,border:`1px solid ${C.border}`,fontSize:12,color:C.ink,outline:'none',fontFamily:'inherit'}}
          onFocus={e=>{e.currentTarget.style.borderColor=C.rosa;}}
          onBlur={e=>{e.currentTarget.style.borderColor=C.border;}}
        />
      </div>

      {/* Copy button */}
      <div style={{display:'flex',alignItems:'center',gap:12}}>
        <button
          onClick={copySnippet}
          style={{padding:'8px 16px',borderRadius:8,border:'none',background:C.rosa,color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer',minHeight:'unset',minWidth:'unset',transition:'opacity 0.15s'}}
          onMouseEnter={e=>{e.currentTarget.style.opacity='0.85';}}
          onMouseLeave={e=>{e.currentTarget.style.opacity='1';}}>
          Copy snippet
        </button>

        {/* Preview */}
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          <div style={{fontSize:11,color:C.gray}}>Preview:</div>
          <div style={{background:'#C9697A',color:'#fff',borderRadius:28,padding:'7px 14px',fontSize:13,fontWeight:600,fontFamily:'-apple-system,BlinkMacSystemFont,"Inter","Segoe UI",sans-serif',boxShadow:'0 4px 12px rgba(201,105,122,0.35)',userSelect:'none',pointerEvents:'none',display:'inline-flex',alignItems:'center',gap:6}}>
            {btnText.trim() || '💍 Book a consultation'}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── WEBHOOKS TAB ─────────────────────────────────────────────────────────────
const WEBHOOK_EVENTS = [
  { id: 'event.created',   label: 'New event created' },
  { id: 'event.completed', label: 'Event completed' },
  { id: 'payment.paid',    label: 'Payment received' },
  { id: 'payment.overdue', label: 'Payment overdue' },
  { id: 'contract.signed', label: 'Contract signed' },
  { id: 'booking.received',label: 'New booking request' },
  { id: 'lead.created',    label: 'New lead created' },
];

const WebhooksTab = () => {
  const { boutique } = useAuth();
  const toast = useToast();
  const [webhooks, setWebhooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newWebhook, setNewWebhook] = useState({ url: '', label: '', events: [], secret: '' });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(null);

  useEffect(() => {
    if (!boutique?.id) return;
    supabase.from('boutique_webhooks').select('*').eq('boutique_id', boutique.id).order('created_at').then(({ data }) => {
      setWebhooks(data || []);
      setLoading(false);
    });
  }, [boutique?.id]);

  const addWebhook = async () => {
    if (!newWebhook.url.startsWith('https://')) { toast('URL must start with https://', 'error'); return; }
    if (newWebhook.events.length === 0) { toast('Select at least one event', 'error'); return; }
    setSaving(true);
    const row = { boutique_id: boutique.id, url: newWebhook.url.trim(), label: newWebhook.label.trim() || null, events: newWebhook.events, secret: newWebhook.secret.trim() || null, active: true };
    const { data, error } = await supabase.from('boutique_webhooks').insert(row).select().single();
    setSaving(false);
    if (error) { toast(error.message, 'error'); return; }
    setWebhooks(w => [...w, data]);
    setNewWebhook({ url: '', label: '', events: [], secret: '' });
    setShowAddForm(false);
    toast('Webhook added ✓');
  };

  const toggleActive = async (wh) => {
    const { error } = await supabase.from('boutique_webhooks').update({ active: !wh.active }).eq('id', wh.id);
    if (error) { toast(error.message, 'error'); return; }
    setWebhooks(ws => ws.map(w => w.id === wh.id ? { ...w, active: !wh.active } : w));
  };

  const deleteWebhook = async (id) => {
    const { error } = await supabase.from('boutique_webhooks').delete().eq('id', id);
    if (error) { toast(error.message, 'error'); return; }
    setWebhooks(ws => ws.filter(w => w.id !== id));
    toast('Webhook deleted');
  };

  const testWebhook = async (wh) => {
    setTesting(wh.id);
    try {
      await fetch(wh.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Belori-Event': 'test' },
        body: JSON.stringify({ event: 'test', boutique_id: boutique.id, timestamp: new Date().toISOString() }),
      });
      toast('Test payload sent ✓');
    } catch (e) {
      toast('Test failed: ' + e.message, 'error');
    } finally {
      setTesting(null);
    }
  };

  const toggleEvent = (evId) => {
    setNewWebhook(nw => ({
      ...nw,
      events: nw.events.includes(evId) ? nw.events.filter(e => e !== evId) : [...nw.events, evId],
    }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card>
        <CardHead title="Outbound webhooks" action="+ Add webhook" onAction={() => setShowAddForm(s => !s)} />
        <div style={{ padding: '0 16px 4px', fontSize: 12, color: C.gray }}>
          Webhooks are fired automatically when events occur in Belori. Configure them here — firing happens server-side via edge functions.
        </div>

        {/* Add form */}
        {showAddForm && (
          <div style={{ margin: '12px 16px', padding: 16, borderRadius: 10, border: `1.5px solid ${C.rosa}`, background: C.rosaPale }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 12 }}>New webhook</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <div style={{ ...LBL, marginBottom: 4 }}>Endpoint URL <span style={{ color: C.red }}>*</span></div>
                <input value={newWebhook.url} onChange={e => setNewWebhook(nw => ({ ...nw, url: e.target.value }))}
                  placeholder="https://your-site.com/webhook" style={{ ...inputSt }} />
              </div>
              <div>
                <div style={{ ...LBL, marginBottom: 4 }}>Label (optional)</div>
                <input value={newWebhook.label} onChange={e => setNewWebhook(nw => ({ ...nw, label: e.target.value }))}
                  placeholder="e.g. Zapier, Slack, CRM" style={{ ...inputSt }} />
              </div>
              <div>
                <div style={{ ...LBL, marginBottom: 6 }}>Events to trigger <span style={{ color: C.red }}>*</span></div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {WEBHOOK_EVENTS.map(ev => (
                    <label key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: C.ink }}>
                      <input type="checkbox" checked={newWebhook.events.includes(ev.id)} onChange={() => toggleEvent(ev.id)}
                        style={{ accentColor: C.rosa, width: 14, height: 14 }} />
                      {ev.label}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ ...LBL, marginBottom: 4 }}>Secret (optional — for HMAC signing)</div>
                <input value={newWebhook.secret} onChange={e => setNewWebhook(nw => ({ ...nw, secret: e.target.value }))}
                  placeholder="my-secret-key" type="password" style={{ ...inputSt }} />
                <div style={{ fontSize: 11, color: C.gray, marginTop: 3 }}>If set, Belori will include an X-Belori-Signature header with each request.</div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <GhostBtn label="Cancel" colorScheme="danger" onClick={() => setShowAddForm(false)} />
                <PrimaryBtn label={saving ? 'Saving…' : 'Save webhook'} colorScheme="success" onClick={addWebhook} />
              </div>
            </div>
          </div>
        )}

        {/* Webhook list */}
        <div style={{ padding: '8px 16px 16px' }}>
          {loading ? (
            <div style={{ fontSize: 13, color: C.gray, padding: '16px 0', textAlign: 'center' }}>Loading…</div>
          ) : webhooks.length === 0 ? (
            <div style={{ fontSize: 13, color: C.gray, padding: '16px 0', textAlign: 'center' }}>No webhooks configured yet. Add one above.</div>
          ) : (
            webhooks.map((wh, i) => {
              const statusColor = wh.last_status === 200 ? C.green : wh.last_status ? C.red : C.gray;
              const statusBg = wh.last_status === 200 ? C.greenBg : wh.last_status ? C.redBg : C.grayBg;
              const statusLabel = wh.last_status ? String(wh.last_status) : 'Never triggered';
              return (
                <div key={wh.id} style={{ padding: '12px 0', borderBottom: i < webhooks.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {wh.label || wh.url}
                      </div>
                      {wh.label && <div style={{ fontSize: 11, color: C.gray, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{wh.url}</div>}
                    </div>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: statusBg, color: statusColor, fontWeight: 500, flexShrink: 0 }}>
                      {statusLabel}
                    </span>
                    <div onClick={() => toggleActive(wh)} title={wh.active ? 'Disable' : 'Enable'}
                      style={{ width: 36, height: 20, borderRadius: 10, background: wh.active ? C.rosa : C.border, cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                      <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'white', position: 'absolute', top: 2, left: wh.active ? 18 : 2, transition: 'left 0.2s' }} />
                    </div>
                    <button onClick={() => testWebhook(wh)} disabled={testing === wh.id}
                      style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.white, fontSize: 11, color: C.ink, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, minHeight: 'unset', minWidth: 'unset' }}>
                      {testing === wh.id ? 'Sending…' : 'Test'}
                    </button>
                    <button onClick={() => deleteWebhook(wh.id)}
                      style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.white, fontSize: 11, color: C.red, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, minHeight: 'unset', minWidth: 'unset' }}>
                      Delete
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {(wh.events || []).map(evId => {
                      const def = WEBHOOK_EVENTS.find(e => e.id === evId);
                      return <span key={evId} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 999, background: C.grayBg, color: C.gray, fontWeight: 500 }}>{def?.label || evId}</span>;
                    })}
                  </div>
                  {wh.last_triggered_at && (
                    <div style={{ fontSize: 11, color: C.gray, marginTop: 4 }}>
                      Last triggered: {new Date(wh.last_triggered_at).toLocaleString()}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
};

// ─── THEME TOGGLE (inside Display tab) ────────────────────────────────────────
const ThemeToggle = () => {
  const [currentTheme, setCurrentTheme] = useState(getTheme());
  const handleTheme = (t) => {
    setCurrentTheme(t);
    applyTheme(t);
  };
  const opts = [
    { id: 'light', label: 'Light' },
    { id: 'dark',  label: 'Dark' },
    { id: 'system',label: 'System' },
  ];
  return (
    <Card style={{ marginBottom: 16 }}>
      <CardHead title="Appearance" />
      <div style={{ padding: '0 16px 16px' }}>
        <div style={{ fontSize: 12, color: C.gray, marginBottom: 10 }}>Choose your preferred color theme</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {opts.map(o => (
            <button key={o.id} onClick={() => handleTheme(o.id)}
              style={{
                flex: 1, padding: '9px 0', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: currentTheme === o.id ? 600 : 400,
                border: `1.5px solid ${currentTheme === o.id ? C.rosa : C.border}`,
                background: currentTheme === o.id ? C.rosaPale : C.white,
                color: currentTheme === o.id ? C.rosaText : C.gray,
                transition: 'all 0.15s',
              }}>
              {o.id === 'light' ? '\uD83C\uDF24\uFE0F' : o.id === 'dark' ? '\uD83C\uDF19' : '\uD83D\uDCBB'} {o.label}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 11, color: C.gray, fontStyle: 'italic', marginTop: 8 }}>Theme is saved to this browser only.</div>
      </div>
    </Card>
  );
};

// ─── INTEGRATIONS TAB ────────────────────────────────────────────────────────
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

// ─── PUSH NOTIFICATION TOGGLE WITH PREFERENCES ─────────────────────────────
const NOTIF_PREFS = [
  { id:'overdue_payments', label:'Overdue payments' },
  { id:'new_bookings', label:'New booking requests' },
  { id:'appointments_24h', label:'Upcoming appointments (24h)' },
  { id:'signed_contracts', label:'Signed contracts' },
  { id:'low_stock', label:'Low stock alerts' },
];

function loadNotifPrefs() {
  try { return JSON.parse(localStorage.getItem('belori_notif_prefs') || 'null'); } catch { return null; }
}

const PushNotificationToggleWithPrefs = ({ boutique }) => {
  const toast = useToast();
  const { supported, subscribed, loading, subscribe, unsubscribe } = usePushNotifications();
  const [notifPrefs, setNotifPrefs] = useState(() => {
    const saved = loadNotifPrefs();
    if (saved) return saved;
    return Object.fromEntries(NOTIF_PREFS.map(p => [p.id, true]));
  });

  const togglePref = (id) => {
    setNotifPrefs(prev => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem('belori_notif_prefs', JSON.stringify(next));
      return next;
    });
  };

  if (!supported) return (
    <div style={{ fontSize: 12, color: C.gray, padding: '8px 0' }}>
      Push notifications are not supported in this browser.
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: C.ink }}>Browser push notifications</div>
          <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>
            {subscribed
              ? 'You\'ll get alerts for overdue payments, upcoming appointments, and signed contracts.'
              : 'Get alerts for overdue payments, upcoming appointments, and signed contracts — even when the app isn\'t open.'}
          </div>
        </div>
        <button
          onClick={subscribed ? unsubscribe : subscribe}
          disabled={loading}
          style={{
            flexShrink: 0,
            marginLeft: 16,
            padding: '8px 16px',
            borderRadius: 9,
            border: subscribed ? `1px solid ${C.border}` : 'none',
            background: loading ? C.grayBg : subscribed ? C.white : C.rosa,
            color: loading ? C.gray : subscribed ? C.gray : C.white,
            fontSize: 12,
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            whiteSpace: 'nowrap',
            transition: 'all 0.15s',
          }}
        >
          {loading ? '…' : subscribed ? '🔔 Enabled — Click to disable' : '🔔 Enable notifications'}
        </button>
      </div>
      {subscribed && (
        <>
          <button
            onClick={async () => {
              await supabase.functions.invoke('push-notify', {
                body: { boutique_id: boutique?.id, title: 'Test notification ✓', body: 'Push notifications are working!' }
              });
              toast('Test sent!');
            }}
            style={{marginTop:8,padding:'7px 14px',borderRadius:8,border:`1px solid ${C.border}`,background:C.white,fontSize:12,cursor:'pointer',color:C.ink}}
          >
            🔔 Send test notification
          </button>
          <div style={{marginTop:12,background:C.ivory,borderRadius:9,padding:'12px 14px',border:`1px solid ${C.border}`}}>
            <div style={{fontSize:11,fontWeight:500,color:C.gray,marginBottom:8,textTransform:'uppercase',letterSpacing:'0.05em'}}>Notify me about</div>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {NOTIF_PREFS.map(pref => (
                <label key={pref.id} style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:12,color:C.ink}}>
                  <input
                    type="checkbox"
                    checked={!!notifPrefs[pref.id]}
                    onChange={() => togglePref(pref.id)}
                    style={{width:14,height:14,accentColor:C.rosa,cursor:'pointer'}}
                  />
                  {pref.label}
                </label>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// ─── LOCATIONS SECTION (Settings → Profile tab) ────────────────────────────
function LocationsSection({ boutique }) {
  const { locations, createLocation, updateLocation, setPrimary, deactivateLocation } = useLocations()
  const toast = useToast()
  const [showAdd, setShowAdd] = useState(false)
  const [draft, setDraft] = useState({ name:'', address:'', phone:'', email:'', timezone:'America/Chicago' })
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)

  // Auto-seed primary location from boutique on first load
  useEffect(() => {
    if (boutique && locations.length === 0) {
      createLocation({ name: boutique.name || 'Main Store', address: boutique.address || '', is_primary: true })
    }
  }, [boutique?.id, locations.length])

  async function handleSave() {
    setSaving(true)
    if (editingId) {
      await updateLocation(editingId, draft)
    } else {
      await createLocation({ ...draft, is_primary: locations.length === 0 })
    }
    setDraft({ name:'', address:'', phone:'', email:'', timezone:'America/Chicago' })
    setShowAdd(false)
    setEditingId(null)
    setSaving(false)
    toast('Location saved')
  }

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>📍 Locations</span>
        <button onClick={() => { setShowAdd(!showAdd); setEditingId(null); setDraft({name:'',address:'',phone:'',email:'',timezone:'America/Chicago'}) }}
          style={{ fontSize: 12, color: C.rosaText, background: 'none', border: `1px solid ${C.rosa}`, borderRadius: 7, padding: '4px 10px', cursor: 'pointer' }}>
          + Add location
        </button>
      </div>

      {locations.map(loc => (
        <div key={loc.id} style={{ padding: '10px 12px', border: `1px solid ${C.border}`, borderRadius: 9, marginBottom: 8, background: C.white }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
            <div>
              <div style={{ display:'flex', alignItems:'center', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{loc.name}</span>
                {loc.is_primary && <span style={{ fontSize: 10, background: C.rosaPale, color: C.rosaText, padding: '1px 6px', borderRadius: 10, fontWeight: 600 }}>Primary</span>}
              </div>
              {loc.address && <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>{loc.address}</div>}
            </div>
            <div style={{ display:'flex', gap: 6, flexShrink: 0 }}>
              {!loc.is_primary && (
                <button onClick={() => setPrimary(loc.id)} style={{ fontSize: 11, color: C.gray, background: 'none', border: `1px solid ${C.border}`, borderRadius: 5, padding: '2px 7px', cursor: 'pointer' }}>
                  Set primary
                </button>
              )}
              <button onClick={() => { setEditingId(loc.id); setDraft({ name:loc.name, address:loc.address||'', phone:loc.phone||'', email:loc.email||'', timezone:loc.timezone||'America/Chicago' }); setShowAdd(true) }}
                style={{ fontSize: 11, color: C.gray, background: 'none', border: `1px solid ${C.border}`, borderRadius: 5, padding: '2px 7px', cursor: 'pointer' }}>
                Edit
              </button>
              {!loc.is_primary && (
                <button onClick={() => deactivateLocation(loc.id)} style={{ fontSize: 11, color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}>
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>
      ))}

      {showAdd && (
        <div style={{ padding: 16, border: `1px solid ${C.rosa}`, borderRadius: 10, background: C.rosaPale, marginTop: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 12 }}>{editingId ? 'Edit location' : 'Add location'}</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 10 }}>
            {[['name','Location name *','text'],['address','Address','text'],['phone','Phone','tel'],['email','Email','email']].map(([k,ph,t]) => (
              <input key={k} type={t} placeholder={ph} value={draft[k]} onChange={e => setDraft(d=>({...d,[k]:e.target.value}))}
                style={{ padding:'8px 10px', borderRadius:7, border:`1px solid ${C.border}`, fontSize:13, background:C.white, color:C.ink }} />
            ))}
          </div>
          <div style={{ display:'flex', gap: 8, marginTop: 12 }}>
            <button onClick={handleSave} disabled={!draft.name||saving}
              style={{ padding:'8px 16px', background:C.rosa, color:C.white, border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => { setShowAdd(false); setEditingId(null) }}
              style={{ padding:'8px 16px', background:C.white, color:C.gray, border:`1px solid ${C.border}`, borderRadius:8, fontSize:13, cursor:'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const Settings = ({boutique, initialTab, setScreen}) => {
  usePageTitle('Settings');
  const toast=useToast();
  const {updateBoutique,getStaff,updateStaffMember,sendInvite,getPendingInvites,cancelInvite}=useBoutique();
  const { reloadBoutique, session, myRole } = useAuth();
  const hasProPlan = useRequiresPlan('pro');

  // ── Profile state ──────────────────────────────────────────────
  const [profile,setProfile]=useState({name:'',phone:'',address:'',instagram:'',booking_url:'',email:'',slug:'',primary_color:'#C9697A',receipt_logo_url:'',receipt_footer_text:'',whatsapp_number:'',whatsapp_template:'Hi {{name}}, this is {{boutique}}. How can we help you today?'});
  const [profileSaving,setProfileSaving]=useState(false);
  useEffect(()=>{
    if(boutique) setProfile({name:boutique.name||'',phone:boutique.phone||'',address:boutique.address||'',instagram:boutique.instagram||'',booking_url:boutique.booking_url||'',email:boutique.email||'',slug:boutique.slug||'',primary_color:boutique.primary_color||'#C9697A',receipt_logo_url:boutique.receipt_logo_url||'',receipt_footer_text:boutique.receipt_footer_text||'',whatsapp_number:boutique.whatsapp_number||'',whatsapp_template:boutique.whatsapp_template||'Hi {{name}}, this is {{boutique}}. How can we help you today?'});
  },[boutique?.id]);
  const saveProfile=async()=>{
    setProfileSaving(true);
    const {error}=await updateBoutique({name:profile.name,phone:profile.phone,address:profile.address,instagram:profile.instagram,booking_url:profile.booking_url,email:profile.email,primary_color:profile.primary_color,slug:profile.slug.toLowerCase().replace(/[^a-z0-9-]/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,''),receipt_logo_url:profile.receipt_logo_url,receipt_footer_text:profile.receipt_footer_text,whatsapp_number:profile.whatsapp_number||null,whatsapp_template:profile.whatsapp_template||null});
    setProfileSaving(false);
    if(error) toast(error.message,'error');
    else { toast('Profile saved ✓'); if(session) reloadBoutique(session.user.id); }
  };

  // ── Data deletion requests state ───────────────────────────────
  const [deletionRequests,setDeletionRequests]=useState([]);
  const [deletionLoaded,setDeletionLoaded]=useState(false);
  const loadDeletionRequests=async()=>{
    if(!boutique?.id) return;
    // Fetch client emails for this boutique, then match against deletion requests
    const {data:clients}=await supabase.from('clients').select('email').eq('boutique_id',boutique.id).not('email','is',null);
    const emails=(clients||[]).map(c=>c.email).filter(Boolean);
    if(emails.length===0){setDeletionLoaded(true);return;}
    const {data:reqs}=await supabase.from('data_deletion_requests').select('*').in('email',emails).order('submitted_at',{ascending:false});
    setDeletionRequests(reqs||[]);
    setDeletionLoaded(true);
  };
  const updateDeletionStatus=async(id,status)=>{
    const {error}=await supabase.from('data_deletion_requests').update({status,completed_at:status==='completed'?new Date().toISOString():null}).eq('id',id);
    if(error) toast(error.message,'error');
    else { toast(status==='completed'?'Marked as completed ✓':'Request rejected'); loadDeletionRequests(); }
  };

  // ── Staff state ────────────────────────────────────────────────
  const [staffList,setStaffList]=useState([]);
  const loadStaff=()=>getStaff().then(({data})=>setStaffList(data||[]));
  useEffect(()=>{loadStaff();},[]);
  const [showInviteStaff,setShowInviteStaff]=useState(false);
  const [showEditStaff,setShowEditStaff]=useState(null);
  const [showAvailability,setShowAvailability]=useState(null);
  const [pendingInvites,setPendingInvites]=useState([]);
  useEffect(()=>{getPendingInvites().then(({data})=>setPendingInvites(data||[]));},[]);

  // ── Automations state ──────────────────────────────────────────
  const [automations,setAutomations]=useState(()=>({...DEFAULT_AUTOMATIONS,...(boutique?.automations||{})}));
  useEffect(()=>{if(boutique?.automations) setAutomations(a=>({...DEFAULT_AUTOMATIONS,...boutique.automations}));},[boutique?.id]);
  const toggle=(k)=>setAutomations(a=>({...a,[k]:!a[k]}));
  const handleAutomationsChange=(patch)=>setAutomations(a=>({...a,...patch}));
  // ── Loyalty Tiers state ─────────────────────────────────────────
  const DEFAULT_LOYALTY_TIERS_SETTINGS=[
    {name:'Bronze',  min_points:0,    color:'#cd7f32',perks:['Priority booking']},
    {name:'Silver',  min_points:500,  color:'#c0c0c0',perks:['5% discount','Priority booking']},
    {name:'Gold',    min_points:1500, color:'#ffd700',perks:['10% discount','Free alteration consultation','Priority booking']},
    {name:'Platinum',min_points:3000, color:'#e5e4e2',perks:['15% discount','Free alteration','Dedicated coordinator','Priority booking']},
  ];
  const TIER_PRESET_COLORS=['#cd7f32','#c0c0c0','#ffd700','#e5e4e2','#C9697A','#7C3AED'];
  const [loyaltyTiersSettings,setLoyaltyTiersSettings]=useState(()=>boutique?.loyalty_tiers||DEFAULT_LOYALTY_TIERS_SETTINGS);
  useEffect(()=>{if(boutique?.loyalty_tiers)setLoyaltyTiersSettings(boutique.loyalty_tiers);},[boutique?.id]);
  const [tiersSaving,setTiersSaving]=useState(false);
  const [tierNewPerks,setTierNewPerks]=useState({});
  const saveLoyaltyTiers=async()=>{
    setTiersSaving(true);
    const{error}=await updateBoutique({loyalty_tiers:loyaltyTiersSettings});
    setTiersSaving(false);
    if(error)toast(error.message,'error');
    else toast('Loyalty tiers saved ✓');
  };
  const updateTier=(idx,field,val)=>setLoyaltyTiersSettings(ts=>ts.map((t,i)=>i===idx?{...t,[field]:val}:t));
  const addTierPerk=(idx,perk)=>{
    if(!perk.trim())return;
    setLoyaltyTiersSettings(ts=>ts.map((t,i)=>i===idx?{...t,perks:[...(t.perks||[]),perk.trim()]}:t));
    setTierNewPerks(p=>({...p,[idx]:''}));
  };
  const removeTierPerk=(idx,perkIdx)=>setLoyaltyTiersSettings(ts=>ts.map((t,i)=>i===idx?{...t,perks:(t.perks||[]).filter((_,pi)=>pi!==perkIdx)}:t));
  const [googleReviewUrl,setGoogleReviewUrl]=useState(()=>boutique?.automations?.googleReviewUrl||'');
  useEffect(()=>{if(boutique?.automations?.googleReviewUrl!=null)setGoogleReviewUrl(boutique.automations.googleReviewUrl);},[boutique?.id]);
  const [autoSaving,setAutoSaving]=useState(false);
  const saveAutomations=async()=>{
    setAutoSaving(true);
    const {error}=await updateBoutique({automations:{...automations,smsTemplates,googleReviewUrl}});
    setAutoSaving(false);
    if(error) toast(error.message,'error');
    else toast('Automation settings saved ✓');
  };

  // ── SMS Templates state ────────────────────────────────────────
  const [smsTemplates,setSmsTemplates]=useState(()=>({...DEFAULT_SMS_TEMPLATES,...(boutique?.automations?.smsTemplates||{})}));
  useEffect(()=>{
    if(boutique?.automations?.smsTemplates)
      setSmsTemplates(t=>({...DEFAULT_SMS_TEMPLATES,...boutique.automations.smsTemplates}));
  },[boutique?.id]);
  const [tmplSaving,setTmplSaving]=useState(false);
  const saveSmsTemplates=async()=>{
    setTmplSaving(true);
    const {error}=await updateBoutique({automations:{...automations,smsTemplates}});
    setTmplSaving(false);
    if(error) toast(error.message,'error');
    else toast('SMS templates saved ✓');
  };

  // ── ICS import state ─────────────────────────────────────────────────────────
  const [icsImportUrl,setIcsImportUrl]=useState('');
  const [icsFile,setIcsFile]=useState(null);
  const [icsPreview,setIcsPreview]=useState([]);
  const [icsImporting,setIcsImporting]=useState(false);
  const [icsSelected,setIcsSelected]=useState(new Set());

  function parseICS(text) {
    const events = [];
    const lines = text.replace(/\r\n /g, '').replace(/\r\n/g, '\n').split('\n');
    let cur = null;
    for (const line of lines) {
      if (line === 'BEGIN:VEVENT') { cur = {}; }
      else if (line === 'END:VEVENT' && cur) { if (cur.date) events.push(cur); cur = null; }
      else if (cur) {
        const colon = line.indexOf(':');
        if (colon < 0) continue;
        const key = line.slice(0, colon).split(';')[0];
        const val = line.slice(colon + 1);
        if (key === 'SUMMARY') cur.summary = val.replace(/\\,/g, ',').replace(/\\n/g, ' ').trim();
        if (key === 'DESCRIPTION') cur.description = val.replace(/\\,/g, ',').replace(/\\n/g, ' ').trim();
        if (key === 'LOCATION') cur.location = val.replace(/\\,/g, ',').trim();
        if (key === 'DTSTART') {
          const d = val.replace(/Z$/, '').replace('T', '');
          cur.date = `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`;
          cur.time = val.includes('T') ? `${d.slice(8,10)}:${d.slice(10,12)}` : null;
        }
      }
    }
    return events;
  }

  async function handleFetchICS() {
    if (!icsImportUrl.trim()) return;
    setIcsImporting(true);
    try {
      const res = await fetch(icsImportUrl);
      const text = await res.text();
      const parsed = parseICS(text);
      setIcsPreview(parsed);
      setIcsSelected(new Set(parsed.map((_,i)=>i)));
    } catch(e) {
      toast('Could not fetch calendar. Try downloading the .ics file and uploading it.','warn');
    }
    setIcsImporting(false);
  }

  function handleICSFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setIcsFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const parsed = parseICS(ev.target.result);
      setIcsPreview(parsed);
      setIcsSelected(new Set(parsed.map((_,i)=>i)));
    };
    reader.readAsText(file);
  }

  async function importICS() {
    const toImport = icsPreview.filter((_,i)=>icsSelected.has(i));
    let count = 0;
    for (const ev of toImport) {
      const {error} = await supabase.from('appointments').insert({
        boutique_id: boutique.id,
        type: 'Other',
        date: ev.date,
        time: ev.time || '09:00',
        note: ev.summary + (ev.description ? ' — ' + ev.description : '') + (ev.location ? ' @ ' + ev.location : ''),
        status: 'confirmed',
      });
      if (!error) count++;
    }
    toast(`Imported ${count} appointment${count !== 1 ? 's' : ''}`);
    setIcsPreview([]);
    setIcsSelected(new Set());
    setIcsFile(null);
    setIcsImportUrl('');
  }

  function formatTimeAgo(isoStr) {
    if (!isoStr) return null;
    const diff = Date.now() - new Date(isoStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins} minute${mins !== 1 ? 's' : ''} ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hour${hrs !== 1 ? 's' : ''} ago`;
    const days = Math.floor(hrs / 24);
    return `${days} day${days !== 1 ? 's' : ''} ago`;
  }

  const [activeTab, setActiveTab]=useState(()=>{
    const hint = sessionStorage.getItem('belori_autoopen');
    if(hint==='tab_packages'&&canAccessSettingsTab(myRole,'packages')){sessionStorage.removeItem('belori_autoopen');return 'packages';}
    if(hint==='tab_billing'&&canAccessSettingsTab(myRole,'billing')){sessionStorage.removeItem('belori_autoopen');return 'billing';}
    const requested = initialTab || 'profile';
    if(canAccessSettingsTab(myRole, requested)) return requested;
    // Fall back to first permitted tab
    const TAB_IDS = ['profile','staff','automations','packages','all_templates','modules','billing','webhooks','bookings','integrations','display','data'];
    return TAB_IDS.find(t=>canAccessSettingsTab(myRole,t)) ?? 'display';
  });
  // Sync when initialTab prop changes — but only if the role allows it
  useEffect(()=>{ if(initialTab && canAccessSettingsTab(myRole, initialTab)) setActiveTab(initialTab); },[initialTab, myRole]);
  
  // Grouped left-rail (replaces the 12-tab horizontal strip).
  // Each section = a labeled group with its own tabs. Sections render
  // top-to-bottom in the left rail; clicking a tab swaps the body.
  const ALL_TABS = [
    {id:'profile',     label:'Boutique profile'},
    {id:'staff',       label:'Staff members'},
    {id:'automations', label:'Automations'},
    {id:'packages',      label:'Packages'},
    {id:'all_templates', label:'Templates'},
    {id:'modules',       label:'Modules'},
    {id:'billing',     label:'Billing'},
    {id:'webhooks',      label:'Webhooks'},
    {id:'bookings',      label:'Booking Requests'},
    {id:'integrations',  label:'Integrations'},
    {id:'display',       label:'Display mode'},
    {id:'data',          label:'Data, Import & Admin'},
  ];
  const TABS = ALL_TABS.filter(t => canAccessSettingsTab(myRole, t.id));

  // Section grouping for the left-rail. Tabs absent from any section
  // (because the user's role can't access them) are filtered when each
  // section renders.
  const SECTIONS = [
    { key: 'general', label: 'General',
      tabIds: ['profile', 'display'] },
    { key: 'team',    label: 'Team & access',
      tabIds: ['staff', 'modules', 'integrations'] },
    { key: 'money',   label: 'Money',
      tabIds: ['billing', 'packages', 'webhooks'] },
    { key: 'content', label: 'Content & automation',
      tabIds: ['automations', 'all_templates'] },
    { key: 'public',  label: 'Public surfaces',
      tabIds: ['bookings'] },
    { key: 'admin',   label: 'Data & admin',
      tabIds: ['data'] },
  ];
  const TAB_BY_ID = Object.fromEntries(TABS.map(t => [t.id, t]));

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',background:C.ivory}}>
      <Topbar title="Settings" subtitle="Manage your boutique preferences and configurations"/>

      {/* Two-column shell: grouped left rail + content panel.
          On narrow screens, the rail collapses into a horizontal scroller
          via media-query CSS in index.css (.settings-rail). */}
      <div style={{flex:1,display:'flex',overflow:'hidden'}}>

        {/* Left rail — grouped sections */}
        <nav data-testid="settings-rail" aria-label="Settings sections" style={{
          width: 240,
          flexShrink: 0,
          background: C.white,
          borderRight: `1px solid ${C.border}`,
          overflowY: 'auto',
          padding: '14px 0 24px',
        }}>
          {SECTIONS.map(section => {
            const sectionTabs = section.tabIds
              .map(id => TAB_BY_ID[id])
              .filter(Boolean);
            if (sectionTabs.length === 0) return null;
            return (
              <div key={section.key} style={{ marginBottom: 18 }}>
                <div style={{
                  fontFamily: "'DM Sans','Inter',system-ui,sans-serif",
                  fontSize: 10.5,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: '#8E6B34',
                  fontWeight: 600,
                  padding: '4px 20px 6px',
                }}>
                  {section.label}
                </div>
                {sectionTabs.map(tab => {
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      data-testid={`settings-tab-${tab.id}`}
                      onClick={() => setActiveTab(tab.id)}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        padding: '8px 20px',
                        border: 'none',
                        background: active ? '#FBF2E3' : 'transparent',
                        borderLeft: `2px solid ${active ? '#B08A4E' : 'transparent'}`,
                        color: active ? '#5C3A0F' : '#5C4A52',
                        fontSize: 13,
                        fontWeight: active ? 600 : 400,
                        cursor: 'pointer',
                        transition: 'background 0.12s',
                      }}
                      onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#FAF6F1'; }}
                      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Content panel */}
        <div style={{flex:1,overflowY:'auto',padding:20}}>
          <div style={{display:'flex',flexDirection:'column',gap:20,maxWidth:960,margin:'0 auto'}}>
          
          {activeTab === 'profile' && (
            <Card>
              <CardHead title="Boutique profile"/>
              <div className="stat-grid-2" style={{padding:'16px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                {[
                  ['Business name','name'],['Phone','phone'],['Address','address'],
                  ['Instagram','instagram'],['Public booking URL','booking_url'],['Email','email'],
                ].map(([label,field])=>(
                  <div key={field}>
                    <div style={{fontSize:11,color:C.gray,marginBottom:4}}>{label}</div>
                    <input value={profile[field]} onChange={e=>setProfile(p=>({...p,[field]:e.target.value}))}
                      style={{width:'100%',padding:'8px 10px',borderRadius:7,border:`1px solid ${C.border}`,fontSize:13,color:C.ink,boxSizing:'border-box',outline:'none'}}/>
                  </div>
                ))}
                {/* Booking page slug — full width */}
                <div style={{gridColumn:'1/-1'}}>
                  <div style={{fontSize:11,color:C.gray,marginBottom:4}}>Booking page slug <span style={{fontWeight:400,color:C.gray}}>— used in your public booking URL</span></div>
                  <div style={{display:'flex',alignItems:'center',gap:0,border:`1px solid ${profile.slug?C.rosa:C.border}`,borderRadius:7,overflow:'hidden',background:'#fff'}}>
                    <span style={{padding:'8px 10px',background:C.ivory,fontSize:12,color:C.gray,borderRight:`1px solid ${C.border}`,whiteSpace:'nowrap',flexShrink:0}}>{window.location.origin}/book/</span>
                    <input
                      value={profile.slug}
                      onChange={e=>setProfile(p=>({...p,slug:e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,'').replace(/^-/,'')}))}
                      placeholder={profile.name?profile.name.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'').slice(0,30):'mi-boutique'}
                      style={{flex:1,padding:'8px 10px',border:'none',fontSize:13,color:C.ink,outline:'none',fontFamily:'monospace'}}/>
                  </div>
                  {profile.slug&&<div style={{fontSize:11,color:'var(--text-success)',marginTop:4}}>✓ Booking page: <strong>{window.location.origin}/book/{profile.slug}</strong></div>}
                  {!profile.slug&&profile.name&&<div style={{fontSize:11,color:C.gray,marginTop:4}}>Suggestion: <span style={{color:C.rosaText,cursor:'pointer'}} onClick={()=>setProfile(p=>({...p,slug:p.name.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'').slice(0,40)}))}>use "{profile.name.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'').slice(0,40)}"</span></div>}
                  {profile.slug&&<div style={{marginTop:6}}><a href={`/boutique/${profile.slug}`} target="_blank" rel="noopener noreferrer" style={{fontSize:12,color:C.rosaText,textDecoration:'none',fontWeight:500}}>🔗 View public profile →</a></div>}
                </div>
              </div>
              {/* Brand color */}
              <div style={{padding:'0 16px 16px',borderTop:`1px solid ${C.border}`,marginTop:4,paddingTop:14}}>
                <div style={{fontSize:12,fontWeight:500,color:C.ink,marginBottom:10}}>Brand color</div>
                <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:12}}>
                  {['#C9697A','#D4788A','#9B6B83','#8B7BC8','#6FAE8A','#B8954A','#C27B5A','#5E7A8A','#8B3A7A','#3A4E7A','#5A5A6A','#C4A87A'].map(hex=>{
                    const sel=profile.primary_color?.toLowerCase()===hex.toLowerCase();
                    return(
                      <button key={hex} onClick={()=>setProfile(p=>({...p,primary_color:hex}))} title={hex}
                        style={{width:28,height:28,borderRadius:'50%',background:hex,border:sel?`3px solid ${C.ink}`:'3px solid transparent',
                          boxShadow:sel?`0 0 0 2px ${hex}44`:'none',cursor:'pointer',padding:0,
                          minHeight:'unset',minWidth:'unset',transform:sel?'scale(1.2)':'scale(1)',transition:'all 0.15s'}}/>
                    );
                  })}
                </div>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <input type="color" value={profile.primary_color||'#C9697A'} onChange={e=>setProfile(p=>({...p,primary_color:e.target.value}))}
                    style={{width:32,height:32,borderRadius:7,border:`1px solid ${C.border}`,cursor:'pointer',padding:2}}/>
                  <input type="text" value={profile.primary_color||''} onChange={e=>{const v=e.target.value.startsWith('#')?e.target.value:'#'+e.target.value;if(/^#[0-9A-Fa-f]{6}$/.test(v))setProfile(p=>({...p,primary_color:v}));else setProfile(p=>({...p,primary_color:e.target.value}));}}
                    placeholder="#C9697A" style={{width:100,padding:'6px 8px',borderRadius:7,border:`1px solid ${C.border}`,fontSize:12,color:C.ink,fontFamily:'monospace',outline:'none'}}/>
                  <span style={{fontSize:11,color:C.gray}}>This color appears in your navigation, buttons, and accents</span>
                </div>
              </div>
              {/* Lead form URL */}
              <div style={{padding:'0 16px 16px',borderTop:`1px solid ${C.border}`,marginTop:4,paddingTop:14}}>
                <div style={{fontSize:12,fontWeight:500,color:C.ink,marginBottom:6}}>Lead form URL</div>
                <div style={{fontSize:12,color:C.gray,marginBottom:8}}>Share this link so potential clients can submit an inquiry directly to your boutique.</div>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <div style={{flex:1,padding:'8px 10px',borderRadius:7,border:`1px solid ${C.border}`,fontSize:12,color:C.inkLight,background:C.ivory,fontFamily:'monospace',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                    {`${window.location.origin}/lead/${boutique?.id}`}
                  </div>
                  <button
                    onClick={async()=>{
                      try { await navigator.clipboard.writeText(`${window.location.origin}/lead/${boutique?.id}`); toast('Lead form URL copied ✓', 'success'); } catch { toast('Could not copy — please copy manually', 'warn'); }
                    }}
                    style={{padding:'8px 14px',borderRadius:7,border:`1px solid ${C.border}`,background:C.white,fontSize:12,fontWeight:500,color:C.ink,cursor:'pointer',whiteSpace:'nowrap',flexShrink:0,minHeight:'unset',minWidth:'unset',transition:'border-color 0.15s'}}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor=C.rosa;e.currentTarget.style.color=C.rosa;}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.ink;}}
                  >
                    Copy link
                  </button>
                </div>
              </div>
              {/* Calendar feed */}
              <div style={{padding:'0 16px 16px',borderTop:`1px solid ${C.border}`,marginTop:4,paddingTop:14}}>
                <div style={{fontSize:12,fontWeight:500,color:C.ink,marginBottom:6}}>📅 Calendar feed (Google / Apple / Outlook)</div>
                <div style={{fontSize:12,color:C.gray,marginBottom:8}}>Subscribe to this URL in your calendar app to sync all events and appointments automatically.</div>
                <div style={{display:'flex',gap:6}}>
                  <input
                    readOnly
                    value={boutique?.calendar_feed_token
                      ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/calendar-feed?token=${boutique.calendar_feed_token}`
                      : `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/calendar-feed?boutique_id=${boutique?.id}`}
                    style={{flex:1,...inputSt,fontSize:11,color:C.gray,background:C.ivory}}
                  />
                  <button
                    onClick={async()=>{
                      const url = boutique?.calendar_feed_token
                        ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/calendar-feed?token=${boutique.calendar_feed_token}`
                        : `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/calendar-feed?boutique_id=${boutique?.id}`;
                      try { await navigator.clipboard.writeText(url); toast('Calendar URL copied!', 'success'); } catch { toast('Could not copy — please copy manually', 'warn'); }
                    }}
                    style={{padding:'8px 14px',borderRadius:8,border:`1px solid ${C.border}`,background:C.white,cursor:'pointer',fontSize:12,color:C.gray,whiteSpace:'nowrap',minHeight:'unset',minWidth:'unset',transition:'border-color 0.15s'}}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor=C.rosa;e.currentTarget.style.color=C.rosa;}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.gray;}}
                  >
                    Copy URL
                  </button>
                </div>
                {/* Sync status */}
                {boutique?.calendar_feed_accessed_at && (
                  <div style={{marginTop:8,fontSize:11,color:C.gray}}>
                    Last synced: {formatTimeAgo(boutique.calendar_feed_accessed_at)} · Accessed {boutique.calendar_feed_access_count || 0} time{(boutique.calendar_feed_access_count || 0) !== 1 ? 's' : ''}
                  </div>
                )}

                {/* ICS Import */}
                <div style={{marginTop:16,paddingTop:14,borderTop:`1px solid ${C.border}`}}>
                  <div style={{fontSize:12,fontWeight:500,color:C.ink,marginBottom:6}}>📥 Import from calendar (.ics)</div>
                  <div style={{fontSize:12,color:C.gray,marginBottom:10}}>Upload a .ics file or paste a calendar URL to import appointments into Belori.</div>
                  <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:8}}>
                    <label style={{display:'inline-flex',alignItems:'center',gap:6,padding:'7px 12px',borderRadius:8,border:`1px solid ${C.border}`,background:C.white,cursor:'pointer',fontSize:12,color:C.ink,whiteSpace:'nowrap'}}>
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 1v9M4 6l4 4 4-4M2 13h12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      {icsFile ? icsFile.name : 'Upload .ics file'}
                      <input type="file" accept=".ics,text/calendar" onChange={handleICSFile} style={{display:'none'}}/>
                    </label>
                    <div style={{display:'flex',flex:1,gap:6,minWidth:200}}>
                      <input
                        value={icsImportUrl}
                        onChange={e=>setIcsImportUrl(e.target.value)}
                        placeholder="or paste a calendar URL..."
                        style={{flex:1,...inputSt,fontSize:12}}
                        onKeyDown={e=>{if(e.key==='Enter') handleFetchICS();}}
                      />
                      <button
                        onClick={handleFetchICS}
                        disabled={icsImporting||!icsImportUrl.trim()}
                        style={{padding:'7px 12px',borderRadius:8,border:`1px solid ${C.border}`,background:C.white,cursor:icsImporting||!icsImportUrl.trim()?'not-allowed':'pointer',fontSize:12,color:C.ink,whiteSpace:'nowrap',opacity:icsImporting||!icsImportUrl.trim()?0.5:1,minHeight:'unset',minWidth:'unset'}}
                      >
                        {icsImporting ? 'Fetching…' : 'Fetch & preview'}
                      </button>
                    </div>
                  </div>

                  {/* Preview table */}
                  {icsPreview.length > 0 && (
                    <div style={{marginTop:10}}>
                      <div style={{fontSize:11,color:C.gray,marginBottom:6}}>{icsPreview.length} event{icsPreview.length!==1?'s':''} found — select which to import:</div>
                      <div style={{border:`1px solid ${C.border}`,borderRadius:8,overflow:'hidden'}}>
                        <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                          <thead>
                            <tr style={{background:C.ivory}}>
                              <th style={{padding:'7px 10px',textAlign:'left',fontWeight:600,width:32,borderBottom:`1px solid ${C.border}`}}>
                                <input
                                  type="checkbox"
                                  checked={icsSelected.size===icsPreview.slice(0,20).length}
                                  onChange={e=>{
                                    if(e.target.checked) setIcsSelected(new Set(icsPreview.slice(0,20).map((_,i)=>i)));
                                    else setIcsSelected(new Set());
                                  }}
                                />
                              </th>
                              <th style={{padding:'7px 8px',textAlign:'left',fontWeight:600,borderBottom:`1px solid ${C.border}`,color:C.ink}}>Date</th>
                              <th style={{padding:'7px 8px',textAlign:'left',fontWeight:600,borderBottom:`1px solid ${C.border}`,color:C.ink}}>Time</th>
                              <th style={{padding:'7px 8px',textAlign:'left',fontWeight:600,borderBottom:`1px solid ${C.border}`,color:C.ink}}>Title</th>
                              <th style={{padding:'7px 8px',textAlign:'left',fontWeight:600,borderBottom:`1px solid ${C.border}`,color:C.ink}}>Location</th>
                            </tr>
                          </thead>
                          <tbody>
                            {icsPreview.slice(0,20).map((ev,i)=>(
                              <tr key={i} style={{borderBottom:i<Math.min(icsPreview.length,20)-1?`1px solid ${C.border}`:'none',background:icsSelected.has(i)?'#fdf5f6':'#fff'}}>
                                <td style={{padding:'6px 10px'}}>
                                  <input type="checkbox" checked={icsSelected.has(i)} onChange={e=>{
                                    const next=new Set(icsSelected);
                                    if(e.target.checked) next.add(i); else next.delete(i);
                                    setIcsSelected(next);
                                  }}/>
                                </td>
                                <td style={{padding:'6px 8px',color:C.ink}}>{ev.date}</td>
                                <td style={{padding:'6px 8px',color:C.gray}}>{ev.time||'All day'}</td>
                                <td style={{padding:'6px 8px',color:C.ink,maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{ev.summary||'—'}</td>
                                <td style={{padding:'6px 8px',color:C.gray,maxWidth:120,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{ev.location||'—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {icsPreview.length>20&&<div style={{padding:'6px 10px',fontSize:11,color:C.gray,borderTop:`1px solid ${C.border}`}}>Showing first 20 of {icsPreview.length} events</div>}
                      </div>
                      <div style={{marginTop:10,display:'flex',gap:8,alignItems:'center'}}>
                        <button
                          onClick={importICS}
                          disabled={icsSelected.size===0}
                          style={{padding:'8px 16px',borderRadius:8,border:'none',background:icsSelected.size===0?C.border:C.rosa,color:'#fff',cursor:icsSelected.size===0?'not-allowed':'pointer',fontSize:13,fontWeight:600,opacity:icsSelected.size===0?0.6:1}}
                        >
                          Import {icsSelected.size} selected appointment{icsSelected.size!==1?'s':''}
                        </button>
                        <button
                          onClick={()=>{setIcsPreview([]);setIcsSelected(new Set());setIcsFile(null);setIcsImportUrl('');}}
                          style={{padding:'8px 12px',borderRadius:8,border:`1px solid ${C.border}`,background:C.white,cursor:'pointer',fontSize:12,color:C.gray,minHeight:'unset',minWidth:'unset'}}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {/* Receipt customization */}
              <div style={{padding:'0 16px 16px',borderTop:`1px solid ${C.border}`,marginTop:4,paddingTop:14}}>
                <div style={{fontSize:12,fontWeight:500,color:C.ink,marginBottom:10}}>🧾 Receipt customization</div>
                <div style={{display:'flex',flexDirection:'column',gap:12}}>
                  <div>
                    <div style={{fontSize:11,color:C.gray,marginBottom:4}}>Receipt logo URL</div>
                    <input
                      value={profile.receipt_logo_url}
                      onChange={e=>setProfile(p=>({...p,receipt_logo_url:e.target.value}))}
                      placeholder="https://example.com/logo.png"
                      style={{width:'100%',padding:'8px 10px',borderRadius:7,border:`1px solid ${C.border}`,fontSize:13,color:C.ink,boxSizing:'border-box',outline:'none'}}
                    />
                    <div style={{fontSize:11,color:C.gray,marginTop:4}}>Paste a URL to your logo image. It will appear on PDF receipts.</div>
                    {profile.receipt_logo_url && (
                      <div style={{marginTop:8}}>
                        <img
                          src={profile.receipt_logo_url}
                          alt="Receipt logo preview"
                          style={{maxHeight:48,maxWidth:200,borderRadius:4,border:`1px solid ${C.border}`,objectFit:'contain',background:C.ivory,padding:4}}
                          onError={e=>{e.currentTarget.style.display='none';}}
                        />
                      </div>
                    )}
                  </div>
                  <div>
                    <div style={{fontSize:11,color:C.gray,marginBottom:4}}>Receipt footer message</div>
                    <textarea
                      value={profile.receipt_footer_text}
                      onChange={e=>setProfile(p=>({...p,receipt_footer_text:e.target.value}))}
                      rows={2}
                      placeholder="Thank you for choosing us! Contact us at..."
                      style={{width:'100%',padding:'8px 10px',borderRadius:7,border:`1px solid ${C.border}`,fontSize:13,color:C.ink,boxSizing:'border-box',outline:'none',resize:'vertical',fontFamily:'inherit',lineHeight:1.5}}
                    />
                    <div style={{fontSize:11,color:C.gray,marginTop:2}}>Appears at the bottom of PDF receipts and contracts.</div>
                  </div>
                </div>
              </div>
              {/* WhatsApp Business */}
              <div style={{padding:'0 16px 16px',borderTop:`1px solid ${C.border}`,marginTop:4,paddingTop:14}}>
                <div style={{fontSize:12,fontWeight:500,color:C.ink,marginBottom:10}}>💬 WhatsApp Business</div>
                <div style={{display:'flex',flexDirection:'column',gap:12}}>
                  <div>
                    <div style={{fontSize:11,color:C.gray,marginBottom:4}}>WhatsApp Business number</div>
                    <input
                      value={profile.whatsapp_number}
                      onChange={e=>setProfile(p=>({...p,whatsapp_number:e.target.value}))}
                      placeholder="+1 (555) 000-0000"
                      style={{width:'100%',padding:'8px 10px',borderRadius:7,border:`1px solid ${C.border}`,fontSize:13,color:C.ink,boxSizing:'border-box',outline:'none'}}
                    />
                    <div style={{fontSize:11,color:C.gray,marginTop:2}}>Include country code, e.g. +1 for US</div>
                  </div>
                  <div>
                    <div style={{fontSize:11,color:C.gray,marginBottom:4}}>Default WhatsApp message template</div>
                    <textarea
                      value={profile.whatsapp_template}
                      onChange={e=>setProfile(p=>({...p,whatsapp_template:e.target.value}))}
                      rows={2}
                      style={{width:'100%',padding:'8px 10px',borderRadius:7,border:`1px solid ${C.border}`,fontSize:13,color:C.ink,boxSizing:'border-box',outline:'none',resize:'vertical',fontFamily:'inherit',lineHeight:1.5}}
                    />
                    <div style={{fontSize:11,color:C.gray,marginTop:2}}>
                      Available variables:{' '}
                      <code style={{background:C.grayBg,padding:'1px 5px',borderRadius:4,fontSize:11}}>{'{{name}}'}</code>{' '}
                      <code style={{background:C.grayBg,padding:'1px 5px',borderRadius:4,fontSize:11}}>{'{{boutique}}'}</code>
                    </div>
                  </div>
                </div>
              </div>
              {/* Embed widget */}
              <EmbedWidgetSection boutiqueId={boutique?.id} />
              {/* Push notifications */}
              <div style={{padding:'0 16px 16px',borderTop:`1px solid ${C.border}`,marginTop:4,paddingTop:14}}>
                <div style={{fontSize:12,fontWeight:500,color:C.ink,marginBottom:4}}>🔔 Notifications</div>
                <PushNotificationToggleWithPrefs boutique={boutique} />
              </div>
              {/* Locations */}
              <div style={{padding:'0 16px 16px',borderTop:`1px solid ${C.border}`,marginTop:4,paddingTop:14}}>
                <LocationsSection boutique={boutique} />
              </div>
              {/* Data deletion requests — owner only */}
              {myRole==='owner'&&(
                <div style={{padding:'0 16px 16px',borderTop:`1px solid ${C.border}`,marginTop:4,paddingTop:14}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                    <div style={{fontSize:12,fontWeight:600,color:C.ink}}>🗑️ Data deletion requests</div>
                    <button onClick={()=>{if(!deletionLoaded)loadDeletionRequests();else loadDeletionRequests();}} style={{fontSize:11,color:C.rosaText,background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',padding:0}}>
                      {deletionLoaded?'Refresh':'Load requests'}
                    </button>
                  </div>
                  {!deletionLoaded&&<div style={{fontSize:12,color:C.gray}}>Click "Load requests" to check for pending data deletion requests from your clients.</div>}
                  {deletionLoaded&&deletionRequests.length===0&&<div style={{fontSize:12,color:C.gray,background:C.ivory,padding:'10px 14px',borderRadius:8}}>No data deletion requests from your clients.</div>}
                  {deletionLoaded&&deletionRequests.length>0&&(
                    <div>
                      <div style={{fontSize:12,color:C.gray,marginBottom:8}}>{deletionRequests.filter(r=>r.status==='pending').length} pending · {deletionRequests.length} total</div>
                      <div style={{border:`1px solid ${C.border}`,borderRadius:8,overflow:'hidden'}}>
                        <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                          <thead>
                            <tr style={{background:C.ivory}}>
                              <th style={{padding:'7px 10px',textAlign:'left',fontWeight:600,color:C.ink,borderBottom:`1px solid ${C.border}`}}>Name / Email</th>
                              <th style={{padding:'7px 10px',textAlign:'left',fontWeight:600,color:C.ink,borderBottom:`1px solid ${C.border}`}}>Date</th>
                              <th style={{padding:'7px 10px',textAlign:'left',fontWeight:600,color:C.ink,borderBottom:`1px solid ${C.border}`}}>Status</th>
                              <th style={{padding:'7px 10px',textAlign:'left',fontWeight:600,color:C.ink,borderBottom:`1px solid ${C.border}`}}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {deletionRequests.map((req,i)=>(
                              <tr key={req.id} style={{borderBottom:i<deletionRequests.length-1?`1px solid ${C.border}`:'none',background:req.status==='pending'?'#FFF7F0':'#fff'}}>
                                <td style={{padding:'8px 10px'}}>
                                  <div style={{fontWeight:500,color:C.ink}}>{req.name||'—'}</div>
                                  <div style={{color:C.gray,marginTop:1}}>{req.email}</div>
                                </td>
                                <td style={{padding:'8px 10px',color:C.gray}}>{req.submitted_at?new Date(req.submitted_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):'-'}</td>
                                <td style={{padding:'8px 10px'}}>
                                  <span style={{
                                    display:'inline-block',padding:'2px 8px',borderRadius:12,fontSize:11,fontWeight:600,
                                    background:req.status==='pending'?'#FEF3C7':req.status==='completed'?'#DCFCE7':req.status==='rejected'?'#FEE2E2':'#F3F4F6',
                                    color:req.status==='pending'?'#92400E':req.status==='completed'?'#15803D':req.status==='rejected'?'#B91C1C':C.gray,
                                  }}>{req.status}</span>
                                </td>
                                <td style={{padding:'8px 10px'}}>
                                  {req.status==='pending'&&(
                                    <div style={{display:'flex',gap:6}}>
                                      <button onClick={()=>updateDeletionStatus(req.id,'completed')} title="Mark completed" style={{padding:'3px 10px',borderRadius:6,border:`1px solid #16A34A`,background:'#DCFCE7',color:'#15803D',fontSize:11,fontWeight:600,cursor:'pointer',minHeight:'unset',minWidth:'unset'}}>✓</button>
                                      <button onClick={()=>updateDeletionStatus(req.id,'rejected')} title="Reject" style={{padding:'3px 10px',borderRadius:6,border:`1px solid #FECACA`,background:'#FEE2E2',color:'#B91C1C',fontSize:11,fontWeight:600,cursor:'pointer',minHeight:'unset',minWidth:'unset'}}>✗</button>
                                    </div>
                                  )}
                                  {req.status!=='pending'&&<span style={{fontSize:11,color:C.gray}}>—</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div style={{padding:'0 16px 16px'}}><PrimaryBtn label={profileSaving?'Saving…':'Save changes'} colorScheme="success" onClick={saveProfile}/></div>
            </Card>
          )}

          {activeTab === 'profile' && (
            null /* <BookingPageCard boutique={boutique}/> Disabled for now */
          )}

          {activeTab === 'staff' && (
            <>
            <Card>
              <CardHead title="Staff members" action="Invite staff" onAction={()=>setShowInviteStaff(true)}/>
              <div style={{padding:'0 16px 8px'}}>
                {staffList.length === 0
                  ? <div style={{padding:'16px 0',fontSize:12,color:C.gray,textAlign:'center'}}>No staff members yet</div>
                  : staffList.map((s,i)=>(
                  <div key={s.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 0',borderBottom:i<staffList.length-1?`1px solid ${C.border}`:'none'}}>
                    <Avatar initials={s.initials||s.name?.slice(0,2).toUpperCase()||'?'} size={36} bg={(s.color||C.rosa)+'22'} color={s.color||C.rosa}/>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:500,color:C.ink}}>{s.name||s.user_id?.slice(0,8)}</div>
                      <div style={{fontSize:11,color:C.gray,textTransform:'capitalize'}}>{s.role}</div>
                    </div>
                    <Badge text={s.role} bg={C.grayBg} color={C.gray}/>
                    <GhostBtn label="Schedule" onClick={()=>setShowAvailability(s)} style={{fontSize:11,padding:'4px 10px'}}/>
                    <GhostBtn label="Edit" onClick={()=>setShowEditStaff(s)} style={{fontSize:11,padding:'4px 10px'}}/>
                  </div>
                ))}
              </div>
            </Card>
            {pendingInvites.length>0&&(
              <Card>
                <CardHead title="Pending invites"/>
                <div style={{padding:'0 16px 8px'}}>
                  {pendingInvites.map((inv,i)=>(
                    <div key={inv.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 0',borderBottom:i<pendingInvites.length-1?`1px solid ${C.border}`:'none'}}>
                      <div style={{width:36,height:36,borderRadius:'50%',background:C.grayBg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,color:C.gray,flexShrink:0}}>✉</div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:500,color:C.ink,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{inv.email}</div>
                        <div style={{fontSize:11,color:C.gray,textTransform:'capitalize'}}>{inv.role} · Expires {new Date(inv.expires_at).toLocaleDateString()}</div>
                      </div>
                      <span style={{fontSize:11,padding:'3px 8px',borderRadius:999,background:C.amberBg,color:C.warningText,fontWeight:500,flexShrink:0}}>Pending</span>
                      <button onClick={async()=>{
                        const{error}=await cancelInvite(inv.id);
                        if(error) toast(error.message,'error');
                        else{setPendingInvites(p=>p.filter(x=>x.id!==inv.id));toast('Invite cancelled');}
                      }} style={{background:'none',border:`1px solid ${C.border}`,borderRadius:6,padding:'4px 10px',fontSize:11,color:C.gray,cursor:'pointer',flexShrink:0,minHeight:'unset',minWidth:'unset'}}
                        onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--color-danger)';e.currentTarget.style.color='var(--text-danger)';}}
                        onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.gray;}}>
                        Cancel
                      </button>
                    </div>
                  ))}
                </div>
              </Card>
            )}
            </>
          )}

          {activeTab === 'automations' && (
            <>
            <Card>
              <CardHead title="Automation settings"/>
              <div style={{padding:'0 16px 8px'}}>
                {AUTOMATION_DEFS.map((a,i)=>(
                  <div key={a.key} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 0',borderBottom:i<AUTOMATION_DEFS.length-1?`1px solid ${C.border}`:'none'}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:500,color:C.ink}}>{a.label}</div>
                      <div style={{fontSize:11,color:C.gray}}>{a.desc}</div>
                    </div>
                    <div onClick={()=>toggle(a.key)} style={{width:40,height:22,borderRadius:11,background:automations[a.key]?C.rosa:C.border,cursor:'pointer',position:'relative',transition:'background 0.2s',flexShrink:0}}>
                      <div style={{width:18,height:18,borderRadius:'50%',background:'white',position:'absolute',top:2,left:automations[a.key]?20:2,transition:'left 0.2s'}}/>
                    </div>
                  </div>
                ))}
              </div>
              {/* Google Review URL */}
              <div style={{padding:'0 16px 16px',borderTop:`1px solid ${C.border}`,marginTop:4,paddingTop:14}}>
                <div style={{fontSize:12,fontWeight:500,color:C.ink,marginBottom:4}}>Google Review link</div>
                <input
                  type="url"
                  value={googleReviewUrl}
                  onChange={e=>setGoogleReviewUrl(e.target.value)}
                  placeholder="https://g.page/r/YOUR_REVIEW_LINK/review"
                  style={{...inputSt,width:'100%',boxSizing:'border-box'}}
                />
                <div style={{fontSize:11,color:C.gray,marginTop:4}}>Paste your Google review link. It will be included in the post-event review request SMS.</div>
              </div>
              <div style={{padding:'0 16px 16px'}}><PrimaryBtn label={autoSaving?'Saving…':'Save automations'} colorScheme="success" onClick={saveAutomations}/></div>
            </Card>
            <Card>
              <CardHead title="Message templates"/>
              <div style={{padding:'0 16px 8px',fontSize:12,color:C.gray}}>
                Customize the SMS messages sent by each automation. Use these variables in your text:&nbsp;
                <span style={{fontFamily:'monospace',background:C.grayBg,padding:'1px 5px',borderRadius:4,fontSize:11}}>{'{name}'}</span>&nbsp;
                <span style={{fontFamily:'monospace',background:C.grayBg,padding:'1px 5px',borderRadius:4,fontSize:11}}>{'{amount}'}</span>&nbsp;
                <span style={{fontFamily:'monospace',background:C.grayBg,padding:'1px 5px',borderRadius:4,fontSize:11}}>{'{days}'}</span>&nbsp;
                <span style={{fontFamily:'monospace',background:C.grayBg,padding:'1px 5px',borderRadius:4,fontSize:11}}>{'{boutique_name}'}</span>&nbsp;
                <span style={{fontFamily:'monospace',background:C.grayBg,padding:'1px 5px',borderRadius:4,fontSize:11}}>{'{return_date}'}</span>
              </div>
              <div style={{padding:'8px 16px 8px',display:'flex',flexDirection:'column',gap:16}}>
                {[
                  {key:'paymentReminder', label:'Payment reminder', hint:'Sent 3 days before a milestone is due.'},
                  {key:'overdueAlert',    label:'Overdue payment alert', hint:'Sent at 1, 7, and 14 days past due. Use {days} for the number of days overdue.'},
                  {key:'returnReminder',  label:'Dress return reminder', hint:'Sent 48 hours before the rental return date.'},
                ].map(tmpl=>(
                  <div key={tmpl.key}>
                    <div style={{...LBL,marginBottom:4}}>{tmpl.label}</div>
                    <textarea
                      value={smsTemplates[tmpl.key]||''}
                      onChange={e=>setSmsTemplates(t=>({...t,[tmpl.key]:e.target.value}))}
                      rows={3}
                      style={{...inputSt,resize:'vertical',width:'100%',boxSizing:'border-box',fontFamily:'inherit',lineHeight:1.5}}
                    />
                    <div style={{fontSize:11,color:C.gray,marginTop:3}}>{tmpl.hint}</div>
                    {(smsTemplates[tmpl.key]||'').trim() && (
                      <div style={{marginTop:8,background:'#F0FDF4',border:'1px solid #BBF7D0',borderRadius:8,padding:'10px 12px'}}>
                        <div style={{fontSize:10,fontWeight:600,color:'#065F46',marginBottom:4,letterSpacing:'0.05em',textTransform:'uppercase'}}>Preview</div>
                        <div style={{fontSize:13,color:'#065F46',lineHeight:1.5,fontFamily:'monospace'}}>
                          {(smsTemplates[tmpl.key]||'')
                            .replace(/\{name\}/g,'María García')
                            .replace(/\{amount\}/g,'$450.00')
                            .replace(/\{days\}/g,'3')
                            .replace(/\{boutique_name\}/g,boutique?.name||'Your Boutique')
                            .replace(/\{return_date\}/g,'April 12')
                            .replace(/\{event_date\}/g,'May 15')
                            .replace(/\{event_type\}/g,'Wedding')
                            .replace(/\{balance\}/g,'$1,200.00')
                          }
                        </div>
                        <div style={{fontSize:10,color:'#059669',marginTop:6}}>
                          {(smsTemplates[tmpl.key]||'')
                            .replace(/\{name\}/g,'María García')
                            .replace(/\{amount\}/g,'$450.00')
                            .replace(/\{days\}/g,'3')
                            .replace(/\{boutique_name\}/g,boutique?.name||'Your Boutique')
                            .replace(/\{return_date\}/g,'April 12')
                            .replace(/\{event_date\}/g,'May 15')
                            .replace(/\{event_type\}/g,'Wedding')
                            .replace(/\{balance\}/g,'$1,200.00')
                            .length
                          } chars · SMS rates apply over 160 chars
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div style={{padding:'0 16px 16px'}}><PrimaryBtn label={tmplSaving?'Saving…':'Save templates'} colorScheme="success" onClick={saveSmsTemplates}/></div>
            </Card>
            {/* ── LOYALTY TIERS CARD ── */}
            <Card>
              <CardHead title="Loyalty Tiers"/>
              <div style={{padding:'0 16px 8px',fontSize:12,color:C.gray}}>
                Define the tiers clients earn as they accumulate loyalty points. Each tier can have a custom name, minimum point threshold, accent color, and list of perks.
              </div>
              <div style={{padding:'8px 16px 4px',display:'flex',flexDirection:'column',gap:14}}>
                {loyaltyTiersSettings.map((tier,idx)=>(
                    <div key={idx} style={{border:`2px solid ${tier.color}44`,borderRadius:12,padding:14,background:`${tier.color}08`}}>
                      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
                        <div style={{width:28,height:28,borderRadius:'50%',background:tier.color,flexShrink:0}}/>
                        <div style={{flex:1,display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                          <div>
                            <div style={{fontSize:10,fontWeight:600,color:C.gray,textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:3}}>Tier name</div>
                            <input
                              value={tier.name}
                              onChange={e=>updateTier(idx,'name',e.target.value)}
                              style={{width:'100%',padding:'5px 8px',border:`1px solid ${C.border}`,borderRadius:7,fontSize:12,outline:'none',boxSizing:'border-box'}}
                            />
                          </div>
                          <div>
                            <div style={{fontSize:10,fontWeight:600,color:C.gray,textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:3}}>Min. points</div>
                            <input
                              type="number"
                              min={0}
                              value={tier.min_points}
                              onChange={e=>updateTier(idx,'min_points',parseInt(e.target.value)||0)}
                              style={{width:'100%',padding:'5px 8px',border:`1px solid ${C.border}`,borderRadius:7,fontSize:12,outline:'none',boxSizing:'border-box'}}
                            />
                          </div>
                        </div>
                      </div>
                      {/* Color presets */}
                      <div style={{marginBottom:10}}>
                        <div style={{fontSize:10,fontWeight:600,color:C.gray,textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:5}}>Color</div>
                        <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
                          {TIER_PRESET_COLORS.map(col=>(
                            <button key={col} onClick={()=>updateTier(idx,'color',col)}
                              style={{width:20,height:20,borderRadius:'50%',background:col,border:tier.color===col?`3px solid ${C.ink}`:'2px solid transparent',cursor:'pointer',padding:0,flexShrink:0,transition:'border 0.1s'}}
                              title={col}/>
                          ))}
                          <input type="color" value={tier.color} onChange={e=>updateTier(idx,'color',e.target.value)}
                            style={{width:24,height:24,border:'none',padding:0,cursor:'pointer',borderRadius:4,flexShrink:0}} title="Custom color"/>
                        </div>
                      </div>
                      {/* Perks */}
                      <div>
                        <div style={{fontSize:10,fontWeight:600,color:C.gray,textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:5}}>Perks</div>
                        <div style={{display:'flex',flexWrap:'wrap',gap:4,marginBottom:6}}>
                          {(tier.perks||[]).map((perk,pi)=>(
                            <span key={pi} style={{display:'inline-flex',alignItems:'center',gap:4,fontSize:11,padding:'2px 8px',borderRadius:999,background:tier.color+'22',color:C.ink,border:`1px solid ${tier.color}44`}}>
                              {perk}
                              <button onClick={()=>removeTierPerk(idx,pi)} style={{background:'none',border:'none',cursor:'pointer',padding:0,lineHeight:1,color:C.gray,fontSize:12}}>×</button>
                            </span>
                          ))}
                        </div>
                        <div style={{display:'flex',gap:6}}>
                          <input
                            value={tierNewPerks[idx]||''}
                            onChange={e=>setTierNewPerks(p=>({...p,[idx]:e.target.value}))}
                            onKeyDown={e=>{if(e.key==='Enter'){addTierPerk(idx,tierNewPerks[idx]||'');}}}
                            placeholder="Add a perk…"
                            style={{flex:1,padding:'5px 8px',border:`1px solid ${C.border}`,borderRadius:7,fontSize:11,outline:'none'}}
                          />
                          <button onClick={()=>addTierPerk(idx,tierNewPerks[idx]||'')}
                            style={{padding:'5px 10px',borderRadius:7,border:`1px solid ${C.border}`,background:C.white,fontSize:11,cursor:'pointer',color:C.gray,fontWeight:500}}>
                            Add
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
              <div style={{padding:'12px 16px 16px'}}><PrimaryBtn label={tiersSaving?'Saving…':'Save tiers'} colorScheme="success" onClick={saveLoyaltyTiers}/></div>
            </Card>
            </>
          )}

          {activeTab === 'packages' && (
            <PackagesCard/>
          )}

          {activeTab === 'all_templates' && (
            <AllTemplatesTab/>
          )}

          {activeTab === 'modules' && (
            <ModuleManager/>
          )}

          {activeTab === 'billing' && (
            <BillingTab/>
          )}

          {activeTab === 'webhooks' && (
            <WebhooksTab/>
          )}

          {activeTab === 'bookings' && (
            <BookingRequestsTab/>
          )}

          {activeTab === 'integrations' && (
            hasProPlan
              ? <IntegrationsTab/>
              : <UpgradeGate minPlan="pro" feature="Third-party integrations"><IntegrationsTab/></UpgradeGate>
          )}

          {activeTab === 'display' && (
            <>
              <ThemeToggle/>
              <LayoutModeToggle/>
              <div>
                <div style={{fontSize:14,fontWeight:600,color:'var(--color-ink,#1a1a2e)',marginBottom:2}}>App Language</div>
                <div style={{fontSize:12,color:'#888',marginBottom:10}}>Controls the language of the app interface (menus, buttons, labels)</div>
                <LanguageToggle/>
              </div>
              <div>
                <div style={{fontSize:14,fontWeight:600,color:'var(--color-ink,#1a1a2e)',marginBottom:2}}>Bilingual Labels</div>
                <div style={{fontSize:12,color:'#888',marginBottom:10}}>Show service and event type names in both English and Spanish</div>
                <BilingualLabelToggle/>
              </div>
              <CurrencySelector/>
              <KioskModeCard/>
              <Card>
                <CardHead title="Appointment defaults"/>
                <div style={{padding:'0 16px 16px',display:'flex',flexDirection:'column',gap:12}}>
                  <div>
                    <label htmlFor="auto-apptdur" style={LBL}>Default appointment duration</label>
                    <select id="auto-apptdur" value={automations.appointmentDuration||60} onChange={e=>handleAutomationsChange({appointmentDuration:Number(e.target.value)})} style={{...inputSt}}>
                      <option value={30}>30 minutes</option>
                      <option value={45}>45 minutes</option>
                      <option value={60}>1 hour</option>
                      <option value={90}>1.5 hours</option>
                      <option value={120}>2 hours</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="auto-buffer" style={LBL}>Booking buffer (time between appointments)</label>
                    <select id="auto-buffer" value={automations.bookingBuffer||15} onChange={e=>handleAutomationsChange({bookingBuffer:Number(e.target.value)})} style={{...inputSt}}>
                      <option value={0}>No buffer</option>
                      <option value={15}>15 minutes</option>
                      <option value={30}>30 minutes</option>
                      <option value={60}>1 hour</option>
                    </select>
                  </div>
                </div>
              </Card>
              <Card>
                <CardHead title="Business hours" sub="Shown on your booking page"/>
                <div style={{padding:'0 16px 16px',display:'flex',flexDirection:'column',gap:8}}>
                  {['mon','tue','wed','thu','fri','sat','sun'].map(day=>{
                    const LABELS={mon:'Monday',tue:'Tuesday',wed:'Wednesday',thu:'Thursday',fri:'Friday',sat:'Saturday',sun:'Sunday'};
                    const h=(automations.businessHours||{})[day]||{open:'09:00',close:day==='sat'?'17:00':'18:00',enabled:day!=='sun'};
                    return (
                      <div key={day} style={{display:'flex',alignItems:'center',gap:12}}>
                        <label style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',minWidth:90}}>
                          <input type="checkbox" checked={!!h.enabled} onChange={e=>{
                            const bh={...(automations.businessHours||{}),[day]:{...h,enabled:e.target.checked}};
                            handleAutomationsChange({businessHours:bh});
                          }}/>
                          <span style={{fontSize:13,color:C.ink,fontWeight:h.enabled?500:400}}>{LABELS[day]}</span>
                        </label>
                        {h.enabled?(
                          <div style={{display:'flex',gap:8,alignItems:'center',flex:1}}>
                            <input type="time" value={h.open||'09:00'} onChange={e=>{
                              const bh={...(automations.businessHours||{}),[day]:{...h,open:e.target.value}};
                              handleAutomationsChange({businessHours:bh});
                            }} style={{...inputSt,flex:1,padding:'5px 8px',fontSize:12}}/>
                            <span style={{fontSize:12,color:C.gray}}>to</span>
                            <input type="time" value={h.close||'18:00'} onChange={e=>{
                              const bh={...(automations.businessHours||{}),[day]:{...h,close:e.target.value}};
                              handleAutomationsChange({businessHours:bh});
                            }} style={{...inputSt,flex:1,padding:'5px 8px',fontSize:12}}/>
                          </div>
                        ):(
                          <span style={{fontSize:12,color:C.gray}}>Closed</span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div style={{padding:'0 16px 16px'}}>
                  <PrimaryBtn label={autoSaving?'Saving…':'Save scheduling'} colorScheme="success" onClick={saveAutomations}/>
                </div>
              </Card>
            </>
          )}

          {activeTab === 'data' && (
            <Card>
              <CardHead title="Data, Import & Admin"/>
              <div style={{padding:'0 16px 20px',display:'flex',flexDirection:'column',gap:24}}>

                {/* Import */}
                <div>
                  <div style={{fontSize:13,fontWeight:600,color:C.ink,marginBottom:4}}>Import data</div>
                  <div style={{fontSize:12,color:C.gray,lineHeight:1.6,marginBottom:12}}>
                    Import clients, events, inventory, and more from a CSV or Excel file. Map your columns and preview before importing.
                  </div>
                  <button
                    onClick={() => setScreen && setScreen('bulk_import')}
                    style={{padding:'9px 18px',borderRadius:8,border:'none',background:C.rosa,color:C.white,fontSize:13,fontWeight:500,cursor:'pointer',display:'inline-flex',alignItems:'center',gap:6}}
                  >
                    <span>📥</span> Import data
                  </button>
                </div>

                {/* Export — moved from its own nav item to keep admin tools in one place */}
                <div>
                  <div style={{fontSize:13,fontWeight:600,color:C.ink,marginBottom:4}}>Export data</div>
                  <div style={{fontSize:12,color:C.gray,lineHeight:1.6,marginBottom:12}}>
                    Download CSV exports of your clients, events, payments, and inventory for backup or migration.
                  </div>
                  <button
                    onClick={() => setScreen && setScreen('data_export')}
                    style={{padding:'9px 18px',borderRadius:8,border:`1px solid ${C.border}`,background:'transparent',color:C.ink,fontSize:13,fontWeight:500,cursor:'pointer',display:'inline-flex',alignItems:'center',gap:6}}
                  >
                    <span>📤</span> Export data
                  </button>
                </div>

                {/* Audit log — moved from its own nav item; sensitive enough to live behind Settings */}
                <div>
                  <div style={{fontSize:13,fontWeight:600,color:C.ink,marginBottom:4}}>Audit log</div>
                  <div style={{fontSize:12,color:C.gray,lineHeight:1.6,marginBottom:12}}>
                    Tamper-proof history of every INSERT, UPDATE, and DELETE across your boutique's data — who did what, when, and what changed.
                  </div>
                  <button
                    onClick={() => setScreen && setScreen('audit_ui')}
                    style={{padding:'9px 18px',borderRadius:8,border:`1px solid ${C.border}`,background:'transparent',color:C.ink,fontSize:13,fontWeight:500,cursor:'pointer',display:'inline-flex',alignItems:'center',gap:6}}
                  >
                    <span>📋</span> Open audit log
                  </button>
                </div>

              </div>
            </Card>
          )}

          </div>
        </div>
      </div>{/* end of two-column shell */}
      {/* ── INVITE STAFF MODAL ── */}
      {showInviteStaff&&<InviteStaffModal onClose={()=>setShowInviteStaff(false)} sendInvite={sendInvite} toast={toast} boutique={boutique}/>}
      {/* ── EDIT STAFF MODAL ── */}
      {showEditStaff&&<EditStaffModal member={showEditStaff} updateStaffMember={updateStaffMember}
        onClose={()=>setShowEditStaff(null)}
        onSaved={(updated)=>{setStaffList(sl=>sl.map(s=>s.id===updated.id?{...s,...updated}:s));setShowEditStaff(null);toast('Staff updated ✓');}}
      />}
      {/* ── AVAILABILITY MODAL ── */}
      {showAvailability&&<AvailabilityModal member={showAvailability} boutique={boutique} onClose={()=>setShowAvailability(null)} toast={toast}/>}
    </div>
  );
};
// ─── CONTRACTS TAB (inside Settings) ─────────────────────────────────────────
const DEFAULT_CONTRACT_TEXT = `BRIDAL SERVICES AGREEMENT

This agreement is entered into between {{boutique_name}} ("Boutique") and {{client_name}} ("Client").

Event Date: {{event_date}}
Venue: {{venue}}

SERVICES & PAYMENT
The Boutique agrees to provide the following services as detailed in the attached service list.

Total Contract Value: {{total_amount}}
Deposit Required: {{deposit_amount}}

TERMS & CONDITIONS
1. The deposit is non-refundable once services have commenced.
2. The remaining balance is due no later than 14 days before the event date.
3. Any alterations or changes to the agreed services must be made in writing.
4. The Boutique is not responsible for delays caused by circumstances beyond its control.

CANCELLATION POLICY
Cancellations made more than 90 days before the event: deposit retained.
Cancellations made 30-90 days before the event: 50% of total retained.
Cancellations made less than 30 days before the event: 100% of total retained.

SIGNATURES
Client: _________________________ Date: _______
Boutique: _______________________ Date: _______`;

const CONTRACT_VARS = [
  { token: '{{client_name}}',    label: 'Client name' },
  { token: '{{event_date}}',     label: 'Event date' },
  { token: '{{venue}}',          label: 'Venue' },
  { token: '{{boutique_name}}',  label: 'Boutique name' },
  { token: '{{total_amount}}',   label: 'Total amount' },
  { token: '{{deposit_amount}}', label: 'Deposit amount' },
];

const PREVIEW_VALUES = {
  '{{client_name}}':    'Jane Smith',
  '{{event_date}}':     new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
  '{{venue}}':          'Grand Ballroom, Hotel Belori',
  '{{boutique_name}}':  'Belori Bridal Boutique',
  '{{total_amount}}':   '$8,500.00',
  '{{deposit_amount}}': '$2,125.00',
};

const TEMPLATE_TYPES = [
  { id: 'default', label: 'Default' },
  { id: 'wedding', label: 'Wedding' },
  { id: 'quince',  label: 'Quinceañera' },
];

const ContractsTab = ({ boutique }) => {
  const toast = useToast();
  const { reloadBoutique, session } = useAuth();
  const [activeTemplate, setActiveTemplate] = useState('default');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const textareaRef = React.useRef(null);

  const initTemplates = () => {
    const saved = boutique?.contract_templates || {};
    return {
      default: saved.default || DEFAULT_CONTRACT_TEXT,
      wedding: saved.wedding || DEFAULT_CONTRACT_TEXT,
      quince:  saved.quince  || DEFAULT_CONTRACT_TEXT,
    };
  };

  const [templates, setTemplates] = useState(initTemplates);

  // Re-initialize when boutique changes (e.g. after reloadBoutique)
  useEffect(() => {
    setTemplates(initTemplates());
    setDirty(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boutique?.id]);

  const handleChange = (value) => {
    setTemplates(t => ({ ...t, [activeTemplate]: value }));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('boutiques')
      .update({ contract_templates: templates })
      .eq('id', boutique.id);
    setSaving(false);
    if (error) { toast(error.message || 'Save failed', 'error'); return; }
    if (session) reloadBoutique(session.user.id);
    setDirty(false);
    toast('Templates saved ✓');
  };

  const insertVariable = (token) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end   = ta.selectionEnd;
    const current = templates[activeTemplate] || '';
    const next = current.slice(0, start) + token + current.slice(end);
    handleChange(next);
    // Restore cursor after the inserted token
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const resetToDefault = () => setShowResetConfirm(true);

  const previewText = () => {
    let text = templates[activeTemplate] || '';
    for (const [token, value] of Object.entries(PREVIEW_VALUES)) {
      text = text.replaceAll(token, value);
    }
    return text;
  };

  const charCount = (templates[activeTemplate] || '').length;

  return (
    <>
      <Card>
        {/* Header row */}
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.ink }}>Contract templates</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setShowPreview(true)}
              style={{ padding: '7px 16px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.white, color: C.ink, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              Preview
            </button>
            <PrimaryBtn
              label={saving ? 'Saving…' : dirty ? 'Save*' : 'Save'}
              colorScheme="success"
              onClick={handleSave}
            />
          </div>
        </div>

        {/* Two-column layout */}
        <div style={{ display: 'flex', minHeight: 540 }}>
          {/* Left sidebar — template type picker */}
          <div style={{ width: 160, flexShrink: 0, borderRight: `1px solid ${C.border}`, paddingTop: 8 }}>
            {TEMPLATE_TYPES.map(t => (
              <div
                key={t.id}
                onClick={() => setActiveTemplate(t.id)}
                style={{
                  padding: '11px 16px',
                  fontSize: 13,
                  fontWeight: activeTemplate === t.id ? 600 : 400,
                  color: activeTemplate === t.id ? C.rosaText : C.ink,
                  background: activeTemplate === t.id ? C.rosaPale : 'transparent',
                  borderLeft: `3px solid ${activeTemplate === t.id ? C.rosa : 'transparent'}`,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  userSelect: 'none',
                }}
              >
                {t.label}
              </div>
            ))}
          </div>

          {/* Right panel — editor */}
          <div style={{ flex: 1, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <textarea
              ref={textareaRef}
              value={templates[activeTemplate] || ''}
              onChange={e => handleChange(e.target.value)}
              style={{
                width: '100%',
                minHeight: 400,
                padding: '12px',
                borderRadius: 8,
                border: `1px solid ${C.border}`,
                fontSize: 13,
                fontFamily: 'monospace',
                lineHeight: 1.6,
                color: C.ink,
                resize: 'vertical',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />

            {/* Character count */}
            <div style={{ fontSize: 11, color: C.gray, textAlign: 'right', marginTop: -8 }}>
              {charCount.toLocaleString()} characters
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
                    onClick={() => insertVariable(v.token)}
                    title={`Insert ${v.token}`}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 20,
                      border: `1px solid ${C.border}`,
                      background: C.ivory,
                      color: C.ink,
                      fontSize: 11,
                      fontFamily: 'monospace',
                      cursor: 'pointer',
                      transition: 'border-color 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = C.rosa; e.currentTarget.style.color = C.rosa; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.ink; }}
                  >
                    {v.token}
                    <span style={{ fontFamily: 'inherit', color: C.gray, marginLeft: 4, fontSize: 10 }}>· {v.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Reset to default */}
            <div style={{ marginTop: 4 }}>
              <button
                onClick={resetToDefault}
                style={{ background: 'none', border: 'none', fontSize: 11, color: C.gray, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
              >
                Reset to default
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Preview modal */}
      {showResetConfirm && (
        <div role="presentation" onClick={e => { if (e.target === e.currentTarget) setShowResetConfirm(false); }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 16 }}>
          <div role="dialog" aria-modal="true" aria-labelledby="reset-template-title"
            style={{ background: C.white, borderRadius: 16, width: 380, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '20px 20px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 26, marginBottom: 8 }}>⚠️</div>
              <div id="reset-template-title" style={{ fontSize: 15, fontWeight: 600, color: C.ink, marginBottom: 8 }}>Reset to default template?</div>
              <div style={{ fontSize: 12, color: 'var(--text-danger)', background: 'var(--bg-danger)', borderRadius: 8, padding: '8px 12px' }}>
                This cannot be undone.
              </div>
            </div>
            <div style={{ padding: '12px 20px 20px', display: 'flex', gap: 8 }}>
              <GhostBtn label="Cancel" onClick={() => setShowResetConfirm(false)} style={{ flex: 1 }} />
              <button onClick={() => { setTemplates(t => ({ ...t, [activeTemplate]: DEFAULT_CONTRACT_TEXT })); setDirty(true); setShowResetConfirm(false); }}
                style={{ flex: 1, padding: '9px 16px', borderRadius: 8, border: 'none', background: 'var(--color-danger)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Reset template
              </button>
            </div>
          </div>
        </div>
      )}
      {showPreview && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
          <div role="dialog" aria-modal="true" aria-labelledby="settings-contract-preview-title" style={{ background: C.white, borderRadius: 16, width: '100%', maxWidth: 680, maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '18px 24px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div>
                <div id="settings-contract-preview-title" style={{ fontWeight: 600, fontSize: 15, color: C.ink }}>Contract preview</div>
                <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>Sample values substituted for template variables</div>
              </div>
              <button onClick={() => setShowPreview(false)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: C.gray, lineHeight: 1 }}>×</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }}>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 13, lineHeight: 1.7, color: C.ink, fontFamily: 'inherit', margin: 0 }}>
                {previewText()}
              </pre>
            </div>
            <div style={{ padding: '14px 24px', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
              <GhostBtn label="Close" onClick={() => setShowPreview(false)} />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// ─── TASK TEMPLATES TAB (inside Settings) ─────────────────────────────────────
const TMPL_EVENT_LABELS = { wedding:'Wedding', quince:'Quinceañera', party:'Party' };

// ─── ALL TEMPLATES (combined tab with sub-nav) ───────────────────────────────
const TEMPLATE_SUBTABS = [
  { id: 'tasks',     label: '✅ Task templates' },
  { id: 'checklist', label: '☑️ Checklists' },
  { id: 'email',     label: '✉️ Email templates' },
  { id: 'contracts', label: '📄 Contracts' },
];

const AllTemplatesTab = () => {
  const [sub, setSub] = useState('tasks');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Sub-nav pill bar */}
      <div style={{ display: 'flex', gap: 6, padding: '0 0 16px 0', flexWrap: 'wrap' }}>
        {TEMPLATE_SUBTABS.map(t => {
          const active = sub === t.id;
          return (
            <button key={t.id} onClick={() => setSub(t.id)} style={{
              padding: '6px 14px', borderRadius: 20, border: `1.5px solid ${active ? C.rosa : C.border}`,
              background: active ? C.rosaPale : C.white, color: active ? C.rosaText : C.gray,
              fontSize: 12, fontWeight: active ? 600 : 400, cursor: 'pointer', transition: 'all .15s',
            }}>{t.label}</button>
          );
        })}
      </div>
      {sub === 'tasks'     && <TemplatesTab />}
      {sub === 'checklist' && <ChecklistTemplatesTab />}
      {sub === 'email'     && <EmailTemplatesTab />}
      {sub === 'contracts' && <ContractBuilderTab />}
    </div>
  );
};

const BLANK_FORM = { name: '', event_type: '', tasksText: '' };

const TemplatesTab = () => {
  const toast = useToast();
  const { templates, loading, createTemplate, updateTemplate, deleteTemplate } = useTaskTemplates();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(BLANK_FORM);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const parseTasks = (text) =>
    text.split('\n').map(l => l.trim()).filter(Boolean)
      .map(text => ({ text, category: 'General', is_alert: false }));

  const openCreate = () => { setForm(BLANK_FORM); setEditId(null); setShowForm(true); };
  const openEdit = (tmpl) => {
    setForm({
      name: tmpl.name,
      event_type: tmpl.event_type || '',
      tasksText: (tmpl.tasks || []).map(t => t.text).join('\n'),
    });
    setEditId(tmpl.id);
    setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setForm(BLANK_FORM); setEditId(null); };

  const handleSave = async () => {
    if (!form.name.trim()) { toast('Template name is required', 'warn'); return; }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      event_type: form.event_type || null,
      tasks: parseTasks(form.tasksText),
    };
    const { error } = editId
      ? await updateTemplate(editId, payload)
      : await createTemplate(payload);
    setSaving(false);
    if (error) { toast(error.message || 'Save failed', 'error'); return; }
    toast(editId ? 'Template updated ✓' : 'Template created ✓');
    closeForm();
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    const { error } = await deleteTemplate(id);
    setDeletingId(null);
    if (error) toast(error.message || 'Delete failed', 'error');
    else toast('Template deleted');
  };

  return (
    <Card>
      <CardHead title="Task templates" action="+ New template" onAction={openCreate}/>
      <div style={{padding:'0 16px 16px'}}>
        <div style={{fontSize:12,color:C.gray,marginBottom:14}}>
          Reusable task lists you can apply to any event. Templates can be scoped to a specific event type or left as general-purpose.
        </div>

        {/* Inline create / edit form */}
        {showForm && (
          <div style={{background:C.grayBg,borderRadius:10,padding:16,marginBottom:16,border:`1.5px solid ${C.rosa}`}}>
            <div style={{fontSize:13,fontWeight:600,color:C.ink,marginBottom:12}}>
              {editId ? 'Edit template' : 'New template'}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
              <div>
                <div style={{fontSize:11,color:C.gray,marginBottom:4}}>Template name *</div>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Wedding day checklist"
                  style={{width:'100%',padding:'8px 10px',borderRadius:7,border:`1px solid ${C.border}`,fontSize:13,color:C.ink,boxSizing:'border-box',outline:'none'}}
                />
              </div>
              <div>
                <div style={{fontSize:11,color:C.gray,marginBottom:4}}>Event type</div>
                <select
                  value={form.event_type}
                  onChange={e => setForm(f => ({ ...f, event_type: e.target.value }))}
                  style={{width:'100%',padding:'8px 10px',borderRadius:7,border:`1px solid ${C.border}`,fontSize:13,color:C.ink,background:C.white,outline:'none',boxSizing:'border-box'}}>
                  <option value="">Any event type</option>
                  <option value="wedding">Wedding</option>
                  <option value="quince">Quinceañera</option>
                  <option value="party">Party</option>
                </select>
              </div>
            </div>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:11,color:C.gray,marginBottom:4}}>Tasks — one per line</div>
              <textarea
                value={form.tasksText}
                onChange={e => setForm(f => ({ ...f, tasksText: e.target.value }))}
                placeholder={'Book venue\nConfirm florist\nSend invitations'}
                rows={6}
                style={{width:'100%',padding:'8px 10px',borderRadius:7,border:`1px solid ${C.border}`,fontSize:13,color:C.ink,resize:'vertical',fontFamily:'inherit',boxSizing:'border-box',outline:'none'}}
              />
              <div style={{fontSize:11,color:C.gray,marginTop:3}}>
                {parseTasks(form.tasksText).length} task{parseTasks(form.tasksText).length !== 1 ? 's' : ''}
              </div>
            </div>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <GhostBtn label="Cancel" colorScheme="danger" onClick={closeForm}/>
              <PrimaryBtn label={saving ? 'Saving…' : editId ? 'Save changes' : 'Create template'} colorScheme="success" onClick={handleSave}/>
            </div>
          </div>
        )}

        {/* Template list */}
        {loading && <div style={{padding:'20px 0',textAlign:'center',fontSize:12,color:C.gray}}>Loading…</div>}
        {!loading && templates.length === 0 && !showForm && (
          <div style={{padding:'24px 0',textAlign:'center',fontSize:12,color:C.gray}}>
            No templates yet. Create your first template to speed up event setup.
          </div>
        )}
        {templates.map((tmpl, i) => (
          <div key={tmpl.id} style={{padding:'14px 0',borderBottom:i<templates.length-1?`1px solid ${C.border}`:'none'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:3,flexWrap:'wrap'}}>
                  <span style={{fontSize:13,fontWeight:600,color:C.ink}}>{tmpl.name}</span>
                  <span style={{fontSize:11,padding:'2px 8px',borderRadius:9,background:tmpl.event_type?C.rosaPale:C.grayBg,color:tmpl.event_type?C.rosaText:C.gray,fontWeight:500}}>
                    {tmpl.event_type ? TMPL_EVENT_LABELS[tmpl.event_type] || tmpl.event_type : 'Any event'}
                  </span>
                </div>
                <div style={{fontSize:11,color:C.gray}}>
                  {(tmpl.tasks||[]).length} task{(tmpl.tasks||[]).length!==1?'s':''}
                  {(tmpl.tasks||[]).length > 0 && (
                    <span style={{marginLeft:6,color:C.inkLight}}>
                      · {(tmpl.tasks||[]).slice(0,3).map(t=>t.text).join(', ')}{(tmpl.tasks||[]).length>3?' …':''}
                    </span>
                  )}
                </div>
              </div>
              <div style={{display:'flex',gap:6,flexShrink:0}}>
                <GhostBtn label="Edit" onClick={() => openEdit(tmpl)} style={{fontSize:11,padding:'4px 10px'}}/>
                <GhostBtn
                  label={deletingId===tmpl.id ? 'Deleting…' : 'Delete'}
                  colorScheme="danger"
                  onClick={() => handleDelete(tmpl.id)}
                  style={{fontSize:11,padding:'4px 10px'}}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};
// ─── CHECKLIST TEMPLATES TAB (inside Settings) ────────────────────────────────
const CHECKLIST_EVT_LABELS = { wedding: 'Wedding', quince: 'Quinceañera', both: 'Wedding & Quinceañera' };
const TASK_CATEGORIES = ['General','Dress','Alterations','Venue','Florals','Payment','Communication','Day-of'];
const BLANK_CL_FORM = { name: '', event_type: 'both', items: [] };

const ChecklistTemplatesTab = () => {
  const toast = useToast();
  const { templates, loading, createTemplate, updateTemplate, deleteTemplate } = useChecklistTemplates();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(BLANK_CL_FORM);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const openCreate = () => { setForm(BLANK_CL_FORM); setEditId(null); setShowForm(true); };
  const openEdit = (tmpl) => {
    setForm({ name: tmpl.name, event_type: tmpl.event_type || 'both', items: (tmpl.items || []).map(it => ({ ...it })) });
    setEditId(tmpl.id);
    setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setForm(BLANK_CL_FORM); setEditId(null); };

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { text: '', category: 'General', is_alert: false }] }));
  const removeItem = (i) => setForm(f => ({ ...f, items: f.items.filter((_,j) => j !== i) }));
  const updateItem = (i, key, val) => setForm(f => ({ ...f, items: f.items.map((it,j) => j === i ? { ...it, [key]: val } : it) }));

  const handleSave = async () => {
    if (!form.name.trim()) { toast('Template name is required', 'warn'); return; }
    const validItems = form.items.filter(it => it.text.trim());
    if (!validItems.length) { toast('Add at least one checklist item', 'warn'); return; }
    setSaving(true);
    const payload = { name: form.name.trim(), event_type: form.event_type, items: validItems };
    const { error } = editId
      ? await updateTemplate(editId, payload)
      : await createTemplate(payload);
    setSaving(false);
    if (error) { toast(error.message || 'Save failed', 'error'); return; }
    toast(editId ? 'Template updated ✓' : 'Template created ✓');
    closeForm();
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    const { error } = await deleteTemplate(id);
    setDeletingId(null);
    if (error) toast(error.message || 'Delete failed', 'error');
    else toast('Template deleted');
  };

  return (
    <Card>
      <CardHead title="Checklist templates" action="+ New template" onAction={openCreate}/>
      <div style={{padding:'0 16px 16px'}}>
        <div style={{fontSize:12,color:C.gray,marginBottom:14}}>
          Reusable checklist task lists that auto-apply when creating events. Each item gets individual category and alert settings.
        </div>

        {showForm && (
          <div style={{background:C.grayBg,borderRadius:10,padding:16,marginBottom:16,border:`1.5px solid ${C.rosa}`}}>
            <div style={{fontSize:13,fontWeight:600,color:C.ink,marginBottom:12}}>
              {editId ? 'Edit checklist template' : 'New checklist template'}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
              <div>
                <div style={{fontSize:11,color:C.gray,marginBottom:4}}>Template name *</div>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Wedding day checklist"
                  style={{width:'100%',padding:'8px 10px',borderRadius:7,border:`1px solid ${C.border}`,fontSize:13,color:C.ink,boxSizing:'border-box',outline:'none'}}
                />
              </div>
              <div>
                <div style={{fontSize:11,color:C.gray,marginBottom:4}}>Event type</div>
                <select
                  value={form.event_type}
                  onChange={e => setForm(f => ({ ...f, event_type: e.target.value }))}
                  style={{width:'100%',padding:'8px 10px',borderRadius:7,border:`1px solid ${C.border}`,fontSize:13,color:C.ink,background:C.white,outline:'none',boxSizing:'border-box'}}>
                  <option value="both">Wedding &amp; Quinceañera</option>
                  <option value="wedding">Wedding only</option>
                  <option value="quince">Quinceañera only</option>
                </select>
              </div>
            </div>

            <div style={{marginBottom:10}}>
              <div style={{fontSize:11,color:C.gray,marginBottom:6,fontWeight:500}}>Checklist items</div>
              {form.items.map((item, i) => (
                <div key={i} style={{display:'grid',gridTemplateColumns:'1fr 130px 80px 28px',gap:6,marginBottom:6,alignItems:'center'}}>
                  <input
                    value={item.text}
                    onChange={e => updateItem(i, 'text', e.target.value)}
                    placeholder="Task description…"
                    style={{padding:'7px 10px',borderRadius:7,border:`1px solid ${C.border}`,fontSize:12,color:C.ink,outline:'none'}}
                  />
                  <select
                    value={item.category}
                    onChange={e => updateItem(i, 'category', e.target.value)}
                    style={{padding:'7px 8px',borderRadius:7,border:`1px solid ${C.border}`,fontSize:11,color:C.gray,background:C.white,outline:'none'}}>
                    {TASK_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                  <label style={{display:'flex',alignItems:'center',gap:4,fontSize:11,color:C.gray,cursor:'pointer'}}>
                    <input
                      type="checkbox"
                      checked={item.is_alert}
                      onChange={e => updateItem(i, 'is_alert', e.target.checked)}
                      style={{accentColor:C.rosa}}
                    />
                    Alert
                  </label>
                  <button
                    onClick={() => removeItem(i)}
                    style={{background:'none',border:'none',color:C.gray,cursor:'pointer',fontSize:16,padding:0,minHeight:'unset',minWidth:'unset'}}
                  >×</button>
                </div>
              ))}
              <button
                onClick={addItem}
                style={{fontSize:12,color:C.rosaText,background:'none',border:'none',cursor:'pointer',fontWeight:500,padding:0,minHeight:'unset',marginTop:4}}>
                + Add item
              </button>
            </div>

            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <GhostBtn label="Cancel" colorScheme="danger" onClick={closeForm}/>
              <PrimaryBtn label={saving ? 'Saving…' : editId ? 'Save changes' : 'Create template'} colorScheme="success" onClick={handleSave}/>
            </div>
          </div>
        )}

        {loading && <div style={{padding:'20px 0',textAlign:'center',fontSize:12,color:C.gray}}>Loading…</div>}
        {!loading && templates.length === 0 && !showForm && (
          <div style={{padding:'24px 0',textAlign:'center',fontSize:12,color:C.gray}}>
            No checklist templates yet. Create one to auto-apply tasks when creating events.
          </div>
        )}
        {templates.map((tmpl, i) => (
          <div key={tmpl.id} style={{padding:'14px 0',borderBottom:i<templates.length-1?`1px solid ${C.border}`:'none'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:3,flexWrap:'wrap'}}>
                  <span style={{fontSize:13,fontWeight:600,color:C.ink}}>{tmpl.name}</span>
                  <span style={{fontSize:11,padding:'2px 8px',borderRadius:9,background:C.rosaPale,color:C.rosaText,fontWeight:500}}>
                    {CHECKLIST_EVT_LABELS[tmpl.event_type] || tmpl.event_type}
                  </span>
                  <span style={{fontSize:11,color:C.gray}}>
                    {(tmpl.items||[]).length} item{(tmpl.items||[]).length !== 1 ? 's' : ''}
                  </span>
                </div>
                {(tmpl.items||[]).length > 0 && (
                  <div style={{fontSize:11,color:C.inkLight}}>
                    {(tmpl.items||[]).slice(0,3).map(it => it.text).join(' · ')}{(tmpl.items||[]).length > 3 ? ' …' : ''}
                  </div>
                )}
              </div>
              <div style={{display:'flex',gap:6,flexShrink:0}}>
                <GhostBtn label="Edit" onClick={() => openEdit(tmpl)} style={{fontSize:11,padding:'4px 10px'}}/>
                <GhostBtn
                  label={deletingId === tmpl.id ? 'Deleting…' : 'Delete'}
                  colorScheme="danger"
                  onClick={() => handleDelete(tmpl.id)}
                  style={{fontSize:11,padding:'4px 10px'}}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};
// ─── PACKAGES CARD (inside Settings) ─────────────────────────────────────────
const PKG_EVENT_LABEL = {both:'Wedding & Quinceañera',wedding:'Wedding',quince:'Quinceañera'};

const PackagesCard = () => {
  const toast = useToast();
  const { packages, loading, createPackage, updatePackage, archivePackage } = usePackages();
  const [createOpen, setCreateOpen] = useState(false);
  const [editPkg, setEditPkg] = useState(null);
  const [showArchived, setShowArchived] = useState(false);

  const active = packages.filter(p => p.active);
  const archived = packages.filter(p => !p.active);

  return (
    <>
      <Card>
        <CardHead title="Service packages" action="+ Create package" onAction={()=>{setEditPkg(null);setCreateOpen(true);}}/>
        <div style={{padding:'0 16px 8px'}}>
          {loading && <div style={{padding:'20px 0',textAlign:'center',fontSize:12,color:C.gray}}>Loading…</div>}
          {!loading && active.length === 0 && (
            <div style={{padding:'24px 0',textAlign:'center',fontSize:12,color:C.gray}}>
              No packages yet. Create your first package to speed up event creation.
            </div>
          )}
          {active.map((pkg,i)=>(
            <div key={pkg.id} style={{padding:'14px 0',borderBottom:i<active.length-1?`1px solid ${C.border}`:'none'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:3}}>
                    <span style={{fontSize:13,fontWeight:600,color:C.ink}}>{pkg.name}</span>
                    <span style={{fontSize:13,fontWeight:500,color:'#16a34a'}}>{fmt(pkg.base_price)}</span>
                  </div>
                  {pkg.description && <div style={{fontSize:11,color:C.gray,marginBottom:6}}>{pkg.description}</div>}
                  <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:4}}>
                    {(pkg.services||[]).map(s=><SvcTag key={s} svc={s}/>)}
                  </div>
                  <div style={{fontSize:10,color:C.gray}}>
                    Used in {pkg.used} event{pkg.used!==1?'s':''} · {PKG_EVENT_LABEL[pkg.event_type]||'All events'}
                  </div>
                </div>
                <div style={{display:'flex',gap:6,marginLeft:12,flexShrink:0}}>
                  <GhostBtn label="Edit" onClick={()=>{setEditPkg(pkg);setCreateOpen(true);}} style={{fontSize:11,padding:'4px 10px'}}/>
                  <GhostBtn label="Archive" onClick={async()=>{
                    const {error}=await archivePackage(pkg.id);
                    if(error) toast(error.message,'error');
                  }} style={{fontSize:11,padding:'4px 10px',color:C.gray}}/>
                </div>
              </div>
            </div>
          ))}
        </div>
        {archived.length > 0 && (
          <div style={{padding:'0 16px 12px'}}>
            <button onClick={()=>setShowArchived(v=>!v)} style={{background:'none',border:'none',fontSize:11,color:C.gray,cursor:'pointer',padding:0}}>
              {showArchived?'▲':'▶'} {archived.length} archived package{archived.length!==1?'s':''}
            </button>
            {showArchived && archived.map((pkg,i)=>(
              <div key={pkg.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderTop:i===0?`1px solid ${C.border}`:'none',opacity:0.6}}>
                <span style={{flex:1,fontSize:12,color:C.gray}}>{pkg.name} — {fmt(pkg.base_price)}</span>
                <GhostBtn label="Restore" onClick={async()=>{
                  const {error}=await updatePackage(pkg.id,{active:true});
                  if(error) toast(error.message,'error');
                }} style={{fontSize:11,padding:'3px 8px'}}/>
              </div>
            ))}
          </div>
        )}
      </Card>
      {createOpen && <CreatePackageModal
        pkg={editPkg}
        onClose={()=>{setCreateOpen(false);setEditPkg(null);}}
        onSave={async(fields)=>{
          let error;
          if(fields.id) ({error}=await updatePackage(fields.id,fields));
          else ({error}=await createPackage(fields));
          if(error){toast(error.message,'error');return;}
          toast(fields.id?'Package updated ✓':'Package created ✓');
          setCreateOpen(false);setEditPkg(null);
        }}
      />}
    </>
  );
};
// ─── CREATE PACKAGE MODAL ─────────────────────────────────────────────────────
// Built-in service keys
const BUILTIN_SVCS = Object.keys(SVC_LABELS);

const CreatePackageModal = ({pkg, onClose, onSave}) => {
  const [name,        setName]      = useState(pkg?.name||'');
  const [description, setDesc]      = useState(pkg?.description||'');
  const [services,    setServices]  = useState(pkg?.services||[]);
  const [base_price,  setPrice]     = useState(pkg?.base_price||'');
  const [event_type,  setEventType] = useState(pkg?.event_type||'both');
  const [saving,      setSaving]    = useState(false);
  const [err,         setErr]       = useState('');
  const [customInput, setCustomInput] = useState('');

  const toggleSvc = s => setServices(ss => ss.includes(s) ? ss.filter(x=>x!==s) : [...ss,s]);
  const addCustom = () => {
    const val = customInput.trim();
    if (!val) return;
    if (!services.includes(val)) setServices(ss => [...ss, val]);
    setCustomInput('');
  };
  // Custom services = those not in BUILTIN_SVCS
  const customServices = services.filter(s => !BUILTIN_SVCS.includes(s));

  const save = async () => {
    if(!name.trim())              return setErr('Package name is required');
    if(!services.length)          return setErr('Select at least one service');
    if(!base_price||Number(base_price)<=0) return setErr('Enter a valid price');
    setSaving(true); setErr('');
    await onSave({ id:pkg?.id, name, description, services, base_price, event_type });
    setSaving(false);
  };

  return (
    <div className="modal-overlay" style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}}>
      <div role="dialog" aria-modal="true" aria-labelledby="settings-package-title" style={{background:C.white,borderRadius:16,width:480,maxHeight:'90vh',display:'flex',flexDirection:'column',overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,0.15)'}}>
        <div style={{padding:'20px 24px 16px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div id="settings-package-title" style={{fontWeight:600,fontSize:16,color:C.ink}}>{pkg?'Edit package':'Create package'}</div>
          <button onClick={onClose} style={{background:'none',border:'none',fontSize:22,cursor:'pointer',color:C.gray,lineHeight:1}}>×</button>
        </div>
        <div style={{flex:1,overflowY:'auto',padding:24,display:'flex',flexDirection:'column',gap:16}}>
          <div>
            <label htmlFor="pkg-name" style={LBL}>Package name</label>
            <input id="pkg-name" value={name} onChange={e=>setName(e.target.value)} placeholder='e.g. "Full Service Wedding"' style={{...inputSt}}/>
          </div>
          <div>
            <label htmlFor="pkg-desc" style={LBL}>Description <span style={{fontWeight:400,color:C.gray}}>(optional)</span></label>
            <textarea id="pkg-desc" value={description} onChange={e=>setDesc(e.target.value)} rows={2} placeholder="Brief description shown to staff" style={{...inputSt,resize:'vertical'}}/>
          </div>
          <div>
            <div id="pkg-services-label" style={{...LBL,marginBottom:8}}>Services included</div>
            <div role="group" aria-labelledby="pkg-services-label" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              {Object.entries(SVC_LABELS).map(([k,l])=>(
                <button key={k} onClick={()=>toggleSvc(k)}
                  style={{padding:'9px 12px',borderRadius:8,border:`1.5px solid ${services.includes(k)?C.rosa:C.border}`,background:services.includes(k)?C.rosaPale:'transparent',color:services.includes(k)?C.rosaText:C.gray,cursor:'pointer',fontSize:12,fontWeight:services.includes(k)?600:400,textAlign:'left',transition:'all 0.15s'}}>
                  {services.includes(k)?'✓ ':''}{l}
                </button>
              ))}
            </div>
            {/* Custom services */}
            <div style={{marginTop:10}}>
              <div style={{fontSize:11,color:C.gray,marginBottom:6}}>+ Add custom service</div>
              <div style={{display:'flex',gap:6}}>
                <input value={customInput} onChange={e=>setCustomInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addCustom()} placeholder="e.g. Hair & Makeup, Catering…" style={{...inputSt,flex:1,margin:0}}/>
                <button onClick={addCustom} style={{padding:'8px 14px',borderRadius:8,border:`1px solid ${C.border}`,background:C.ivory,color:C.ink,fontSize:12,cursor:'pointer',whiteSpace:'nowrap'}}>Add</button>
              </div>
              {customServices.length>0&&(
                <div style={{display:'flex',flexWrap:'wrap',gap:6,marginTop:8}}>
                  {customServices.map(s=>(
                    <span key={s} style={{display:'inline-flex',alignItems:'center',gap:4,padding:'4px 10px',borderRadius:20,background:C.rosaPale,border:`1px solid ${C.rosa}`,fontSize:11,color:C.rosaText,fontWeight:500}}>
                      {s}
                      <button onClick={()=>toggleSvc(s)} style={{background:'none',border:'none',cursor:'pointer',color:C.rosaText,fontSize:13,lineHeight:1,padding:0}}>×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div>
            <div id="pkg-eventtype-label" style={{...LBL,marginBottom:8}}>Apply to event type</div>
            <div role="group" aria-labelledby="pkg-eventtype-label" style={{display:'flex',gap:8}}>
              {[['both','Wedding & Quinceañera'],['wedding','Weddings only'],['quince','Quinceañeras only']].map(([v,l])=>(
                <button key={v} onClick={()=>setEventType(v)}
                  style={{flex:1,padding:'8px 6px',borderRadius:7,border:`1.5px solid ${event_type===v?C.rosa:C.border}`,background:event_type===v?C.rosaPale:'transparent',color:event_type===v?C.rosaText:C.gray,cursor:'pointer',fontSize:11,fontWeight:event_type===v?600:400,transition:'all 0.15s'}}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="pkg-price" style={LBL}>Base price ($)</label>
            <input id="pkg-price" type="number" min="0" step="0.01" value={base_price} onChange={e=>setPrice(e.target.value)} placeholder="6800" style={{...inputSt}}/>
          </div>
          {err && <div style={{fontSize:12,color:'#dc2626',background:'#fef2f2',padding:'8px 12px',borderRadius:7,border:'1px solid #fecaca'}}>{err}</div>}
        </div>
        <div style={{padding:'12px 24px',borderTop:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between'}}>
          <GhostBtn label="Cancel" colorScheme="danger" onClick={onClose}/>
          <PrimaryBtn label={saving?'Saving…':pkg?'Save changes':'Create package'} onClick={save}/>
        </div>
      </div>
    </div>
  );
};
// ─── BOOKING REQUESTS TAB ───────────────────────────────────────────────────
const STATUS_CFG = {
  pending:   {label:'Pending',   bg:'#FEF9C3',col:'#854D0E'},
  contacted: {label:'Contacted', bg:'#EFF6FF',col:'#1D4ED8'},
  converted: {label:'Converted',bg:'#F0FDF4',col:'#15803D'},
  declined:  {label:'Declined', bg:'#FEF2F2',col:'#DC2626'},
};

// NOTE: defined here (after STATUS_CFG) so it's available to BookingRequestsTab
const BookingPageCard = ({ boutique }) => {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const bookingUrl = boutique?.slug ? `${window.location.origin}/book/${boutique.slug}` : null;
  const copyUrl = async () => {
    if (!bookingUrl) return;
    try {
      await navigator.clipboard.writeText(bookingUrl);
      toast('Copied!', 'success');
    } catch {
      toast('Could not copy — please copy manually', 'warn');
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <CardHead title="Your public booking link"/>
      <div style={{padding:'0 16px 16px'}}>
        <div style={{fontSize:12,color:C.gray,marginBottom:10}}>Share this link with clients so they can request a consultation without calling you.</div>
        {bookingUrl ? (
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <div style={{flex:1,padding:'9px 12px',borderRadius:8,border:`1px solid ${C.border}`,background:C.ivory,fontSize:12,color:C.ink,fontFamily:'monospace',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{bookingUrl}</div>
            <PrimaryBtn label={copied ? '✓ Copied!' : 'Copy link'} colorScheme={copied ? 'success' : 'primary'} onClick={copyUrl}/>
          </div>
        ) : (
          <div style={{fontSize:12,color:C.gray,background:C.ivory,padding:'10px 14px',borderRadius:8}}>
            Add a slug to your boutique profile to enable the public booking page.
          </div>
        )}
      </div>
    </Card>
  );
};

// ─── Share-your-booking-page card ────────────────────────────────────────────
// Lives at the top of the Booking Requests tab. Gives the boutique owner
// 4 ways to put their public booking URL into a prospect's hands:
//   - Copy the URL itself (works in any DM, business card, email signature)
//   - Copy an <iframe> snippet they can paste into their existing website
//   - Open a QR code (perfect for printed flyers / window decals)
//   - Open the live page in a new tab so they can see what prospects see
//
// Quietly degrades when the boutique has no slug yet (sends them to set one
// in the Profile tab instead of showing a broken URL).
const ShareBookingPageCard = ({ boutique }) => {
  const toast = useToast();
  const [copied, setCopied] = useState(null); // 'url' | 'embed' | null
  const [qrUrl, setQrUrl] = useState(null);

  const slug = boutique?.slug;
  const url  = slug ? `${window.location.origin}/book/${slug}` : null;
  const embed = slug
    ? `<iframe src="${url}" style="width:100%;min-height:720px;border:0;border-radius:12px;" loading="lazy" title="Book a consultation"></iframe>`
    : null;

  const copy = async (text, kind) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      toast(kind === 'url' ? 'Booking URL copied ✓' : 'Embed snippet copied ✓');
      setTimeout(() => setCopied(c => c === kind ? null : c), 2000);
    } catch {
      toast('Could not copy — please copy manually', 'warn');
    }
  };

  const showQR = async () => {
    if (!url) return;
    const { generateQRDataUrl } = await import('../lib/qrUtils');
    const dataUrl = await generateQRDataUrl(url, 360);
    setQrUrl(dataUrl);
  };

  if (!slug) {
    return (
      <Card>
        <CardHead title="Your booking page"/>
        <div style={{padding:'14px 16px 18px',fontSize:13,color:C.gray,lineHeight:1.6}}>
          Set a public URL slug in <strong>Settings → Boutique profile</strong> first. Once you have one, prospects will be able to book consultations at <code style={{background:C.ivory,padding:'1px 6px',borderRadius:4}}>belori.app/book/your-slug</code>.
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHead title="Share your booking page"/>
      <div style={{padding:'14px 16px 18px',display:'flex',flexDirection:'column',gap:14}}>

        {/* The URL itself */}
        <div>
          <div style={{fontSize:11,color:C.gray,marginBottom:6,textTransform:'uppercase',letterSpacing:'0.06em',fontWeight:500}}>Booking URL</div>
          <div style={{display:'flex',gap:8,alignItems:'stretch',flexWrap:'wrap'}}>
            <code style={{flex:1,minWidth:200,background:C.ivory,padding:'9px 12px',borderRadius:7,fontSize:12,color:C.ink,fontFamily:'ui-monospace,SFMono-Regular,Menlo,monospace',border:`1px solid ${C.border}`,wordBreak:'break-all'}}>{url}</code>
            <button onClick={()=>copy(url, 'url')} data-testid="settings-share-copy-url" style={{padding:'9px 14px',borderRadius:7,border:'none',background:copied==='url'?'#5C8A6E':C.rosa,color:'#fff',fontSize:12,fontWeight:500,cursor:'pointer',flexShrink:0}}>
              {copied === 'url' ? '✓ Copied' : 'Copy URL'}
            </button>
            <a href={url} target="_blank" rel="noopener noreferrer" data-testid="settings-share-preview" style={{padding:'9px 14px',borderRadius:7,border:`1px solid ${C.border}`,background:'#fff',color:C.ink,fontSize:12,fontWeight:500,cursor:'pointer',flexShrink:0,textDecoration:'none',display:'inline-flex',alignItems:'center',gap:5}}>
              Preview ↗
            </a>
          </div>
        </div>

        {/* Embed snippet */}
        <div>
          <div style={{fontSize:11,color:C.gray,marginBottom:6,textTransform:'uppercase',letterSpacing:'0.06em',fontWeight:500}}>Embed on your website</div>
          <div style={{display:'flex',gap:8,alignItems:'flex-start',flexWrap:'wrap'}}>
            <code style={{flex:1,minWidth:200,background:C.ivory,padding:'9px 12px',borderRadius:7,fontSize:11,color:C.ink,fontFamily:'ui-monospace,SFMono-Regular,Menlo,monospace',border:`1px solid ${C.border}`,wordBreak:'break-all',lineHeight:1.5,whiteSpace:'pre-wrap'}}>{embed}</code>
            <button onClick={()=>copy(embed, 'embed')} data-testid="settings-share-copy-embed" style={{padding:'9px 14px',borderRadius:7,border:`1px solid ${C.border}`,background:'#fff',color:C.ink,fontSize:12,fontWeight:500,cursor:'pointer',flexShrink:0}}>
              {copied === 'embed' ? '✓ Copied' : 'Copy embed'}
            </button>
          </div>
          <div style={{fontSize:11,color:C.gray,marginTop:6}}>Paste this where you want the booking form to appear (Squarespace, Wix, Webflow, plain HTML, etc.)</div>
        </div>

        {/* QR code */}
        <div>
          <div style={{fontSize:11,color:C.gray,marginBottom:6,textTransform:'uppercase',letterSpacing:'0.06em',fontWeight:500}}>QR code</div>
          {qrUrl ? (
            <div style={{display:'flex',gap:14,alignItems:'flex-start'}}>
              <img src={qrUrl} alt="Booking page QR code" data-testid="settings-share-qr-image" style={{width:160,height:160,borderRadius:8,border:`1px solid ${C.border}`,background:'#fff',padding:8}}/>
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                <a href={qrUrl} download={`${slug}-booking-qr.png`} style={{padding:'7px 12px',borderRadius:7,border:`1px solid ${C.border}`,background:'#fff',color:C.ink,fontSize:12,fontWeight:500,cursor:'pointer',textDecoration:'none',display:'inline-block'}}>Download PNG</a>
                <div style={{fontSize:11,color:C.gray,maxWidth:220,lineHeight:1.5}}>Print on flyers, window decals, business cards. Scans straight to your booking page.</div>
              </div>
            </div>
          ) : (
            <button onClick={showQR} data-testid="settings-share-qr-generate" style={{padding:'9px 14px',borderRadius:7,border:`1px solid ${C.border}`,background:'#fff',color:C.ink,fontSize:12,fontWeight:500,cursor:'pointer'}}>
              Generate QR code
            </button>
          )}
        </div>
      </div>
    </Card>
  );
};

const BookingRequestsTab = () => {
  const { boutique } = useAuth();
  const { createEvent } = useEvents();
  const toast = useToast();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selectedId, setSelectedId] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!boutique) return;
    fetchRequests();
  }, [boutique?.id]);

  async function fetchRequests() {
    setLoading(true);
    const { data } = await supabase
      .from('booking_requests')
      .select('*')
      .eq('boutique_id', boutique.id)
      .order('created_at', { ascending: false });
    setRequests(data || []);
    setLoading(false);
  };

  const updateStatus = async (id, status) => {
    setSaving(true);
    const updates = { status };
    if (status === 'contacted') updates.contacted_at = new Date().toISOString();
    const { error } = await supabase.from('booking_requests').update(updates).eq('id', id).eq('boutique_id', boutique.id);
    if (!error) {
      setRequests(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
      toast(`Status updated to "${STATUS_CFG[status].label}" ✓`);
    }
    setSaving(false);
  };

  const convertLead = async (req) => {
    setSaving(true);
    const { data: event, error: evError } = await createEvent({
      isNewClient: true,
      newClientData: {
        name: req.client_name,
        email: req.client_email,
        phone: req.client_phone,
      },
      type: req.event_type === 'quinceanera' ? 'quince' : (req.event_type || 'wedding'),
      event_date: req.event_date || null,
      guests: req.guest_count || null,
      services: req.services || [],
      total: 0,
      paid: 0,
      status: 'active',
    });

    if (evError) {
      toast(evError.message || 'Failed to convert lead', 'error');
      setSaving(false);
      return;
    }

    const { error } = await supabase.from('booking_requests').update({ status: 'converted' }).eq('id', req.id);
    if (!error) {
      setRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'converted' } : r));
      toast('Lead converted into a new Client and Event! 🎉', 'success');
    }
    setSaving(false);
  };

  const saveNote = async (id) => {
    setSaving(true);
    const { error } = await supabase.from('booking_requests').update({ notes: noteText }).eq('id', id).eq('boutique_id', boutique.id);
    if (!error) {
      setRequests(prev => prev.map(r => r.id === id ? { ...r, notes: noteText } : r));
      toast('Note saved ✓');
    }
    setSaving(false);
  };

  const filtered = filter === 'all' ? requests : requests.filter(r => r.status === filter);
  const selected = requests.find(r => r.id === selectedId);

  return (
    <div style={{display:'flex',flexDirection:'column',gap:16}}>
      {/* Share-your-booking-page card — copy URL, QR code, embed snippet */}
      <ShareBookingPageCard boutique={boutique}/>

      {/* Requests list */}
      <Card>
        <CardHead title={`Booking requests (${requests.filter(r=>r.status==='pending').length} pending)`}/>
        <div style={{padding:'0 16px 8px',display:'flex',gap:6,flexWrap:'wrap'}}>
          {['all','pending','contacted','converted','declined'].map(f=>(
            <button key={f} onClick={()=>setFilter(f)}
              style={{padding:'4px 12px',borderRadius:20,border:`1px solid ${filter===f?C.rosa:C.border}`,background:filter===f?C.rosaPale:'#fff',color:filter===f?C.rosaText:C.gray,fontSize:12,fontWeight:filter===f?600:400,cursor:'pointer',minHeight:'unset',minWidth:'unset',textTransform:'capitalize'}}>
              {f === 'all' ? `All (${requests.length})` : `${STATUS_CFG[f]?.label} (${requests.filter(r=>r.status===f).length})`}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{padding:'32px 16px',textAlign:'center',color:C.gray,fontSize:13}}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{padding:'32px 16px',textAlign:'center',color:C.gray,fontSize:13}}>
            <div style={{fontSize:28,marginBottom:8}}>📭</div>
            No booking requests yet. Share your booking link to get started!
          </div>
        ) : filtered.map((r, i) => (
          <div key={r.id}>
            <div onClick={() => { setSelectedId(selectedId === r.id ? null : r.id); setNoteText(r.notes || ''); }}
              style={{display:'flex',alignItems:'flex-start',gap:12,padding:'12px 16px',cursor:'pointer',borderTop:i>0?`1px solid ${C.border}`:'none',background:selectedId===r.id?C.ivory:'transparent',transition:'background 0.15s'}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                  <span style={{fontSize:13,fontWeight:600,color:C.ink}}>{r.client_name}</span>
                  <span style={{fontSize:11,padding:'2px 8px',borderRadius:20,background:STATUS_CFG[r.status]?.bg,color:STATUS_CFG[r.status]?.col,fontWeight:600}}>{STATUS_CFG[r.status]?.label}</span>
                  {r.event_type && <span style={{fontSize:11,color:C.gray,textTransform:'capitalize'}}>{r.event_type}</span>}
                </div>
                <div style={{fontSize:11,color:C.gray,marginTop:3}}>
                  {[r.client_email, r.client_phone].filter(Boolean).join(' · ')}
                  {r.event_date && ` · ${new Date(r.event_date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}`}
                </div>
                {(r.services||[]).length > 0 && (
                  <div style={{display:'flex',gap:4,flexWrap:'wrap',marginTop:5}}>
                    {r.services.map(s => <span key={s} style={{fontSize:10,padding:'2px 8px',borderRadius:20,background:C.grayBg,color:C.gray}}>{SVC_LABELS[s]||s}</span>)}
                  </div>
                )}
                {r.message && <div style={{fontSize:11,color:C.gray,marginTop:4,fontStyle:'italic',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>"{r.message}"</div>}
              </div>
              <div style={{fontSize:11,color:C.gray,flexShrink:0,whiteSpace:'nowrap'}}>
                {new Date(r.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric'})}
              </div>
            </div>

            {/* Expanded detail panel */}
            {selectedId === r.id && (
              <div style={{padding:'12px 16px 16px',background:C.ivory,borderTop:`1px solid ${C.border}`}}>
                <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:12}}>
                  {['pending','contacted','declined'].map(s => (
                    <button key={s} onClick={()=>updateStatus(r.id,s)} disabled={saving||r.status===s}
                      style={{padding:'5px 12px',borderRadius:7,border:`1px solid ${r.status===s?STATUS_CFG[s].col:C.border}`,background:r.status===s?STATUS_CFG[s].bg:'#fff',color:r.status===s?STATUS_CFG[s].col:C.gray,fontSize:12,fontWeight:r.status===s?600:400,cursor:r.status===s?'default':'pointer',transition:'all 0.15s',minHeight:'unset',minWidth:'unset'}}>
                      {STATUS_CFG[s].label}
                    </button>
                  ))}
                  {r.status !== 'converted' ? (
                    <PrimaryBtn label={saving ? 'Converting…' : 'Convert to Event'} onClick={() => convertLead(r)} colorScheme="success" style={{padding:'5px 12px', minHeight: 'unset', minWidth: 'unset', fontSize: 12}} />
                  ) : (
                    <button disabled style={{padding:'5px 12px',borderRadius:7,border:`1px solid ${STATUS_CFG['converted'].col}`,background:STATUS_CFG['converted'].bg,color:STATUS_CFG['converted'].col,fontSize:12,fontWeight:600,cursor:'default'}}>
                      Converted
                    </button>
                  )}
                </div>
                {r.message && (
                  <div style={{marginBottom:10,padding:'8px 10px',borderRadius:8,background:'#fff',border:`1px solid ${C.border}`,fontSize:12,color:C.gray,lineHeight:1.5}}>
                    <strong style={{color:C.ink}}>Client note:</strong> {r.message}
                  </div>
                )}
                <div style={{marginBottom:8,fontSize:11,fontWeight:600,color:C.gray}}>Internal notes</div>
                <textarea value={noteText} onChange={e=>setNoteText(e.target.value)} rows={2}
                  placeholder="Add a note for your team…"
                  style={{width:'100%',padding:'8px 10px',borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,fontFamily:'inherit',resize:'vertical',background:'#fff',boxSizing:'border-box'}}/>
                <div style={{marginTop:8,display:'flex',gap:8}}>
                  <PrimaryBtn label={saving ? 'Saving…' : 'Save note'} onClick={()=>saveNote(r.id)}/>
                  {r.client_email && <GhostBtn label="Send email" onClick={()=>window.open(`mailto:${r.client_email}?subject=Your booking request at ${boutique?.name||'our boutique'}`,`_blank`)}/>}
                  {r.client_phone && <GhostBtn label="Call" onClick={()=>window.open(`tel:${r.client_phone}`,`_blank`)}/>}
                </div>
              </div>
            )}
          </div>
        ))}
      </Card>
    </div>
  );
};

// ─── PLACEHOLDER ───────────────────────────────────────────────────────────
const Placeholder = ({title,icon}) => (
  <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
    <Topbar title={title}/>
    <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:12,color:C.gray}}>
      <div style={{fontSize:40,opacity:0.3}}>{icon}</div>
      <div style={{fontSize:14,fontWeight:500}}>{title}</div>
      <div style={{fontSize:12}}>This screen is ready to build.</div>
    </div>
  </div>
);

export default Settings;
export { Placeholder };
