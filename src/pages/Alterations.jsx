import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { C, fmt } from '../lib/colors';
import { Avatar, Badge, Card, CardHead, Topbar, PrimaryBtn, GhostBtn, useToast,
  inputSt, LBL, EmptyState, useFocusTrap } from '../lib/ui.jsx';
import { ALTERATION_TRANSITIONS } from '../lib/urgency';
import { useLayoutMode } from '../hooks/useLayoutMode.jsx';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { usePageTitle } from '../hooks/usePageTitle';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const ALL_WORK_ITEMS=['Hem','Bustle','Waist take-in','Let out waist','Sleeves','Straps','Custom beading','Lining','Neckline','Train','Zipper','Buttons','Other'];
const WORK_HINTS={Hem:'$60–100',Bustle:'$80–150','Waist take-in':'$60–100','Let out waist':'$60–120',Sleeves:'$40–80',Straps:'$30–60','Custom beading':'$150–400+',Lining:'$80–150',Neckline:'$60–120',Train:'$60–100',Zipper:'$40–80',Buttons:'$30–60'};

// Parse the price-range hint (e.g. "$60–100", "$150–400+") to a tuple of
// [low, mid, high] so the form can auto-suggest a quote price as the
// user picks work items. We use the MIDPOINT as the suggestion — a
// conservative-ish estimate the boutique can adjust either way.
//
// Items missing from this map (e.g. 'Other') contribute 0 and won't
// affect the auto-quote.
const WORK_PRICE_RANGES = (() => {
  const map = {};
  for (const [item, hint] of Object.entries(WORK_HINTS)) {
    // Match $LOW–HIGH or $LOW–HIGH+ (em-dash). Numbers can be 1–4 digits.
    const m = hint.match(/\$(\d+)\D+(\d+)/);
    if (!m) continue;
    const low  = Number(m[1]);
    const high = Number(m[2]);
    map[item] = { low, high, mid: Math.round((low + high) / 2) };
  }
  return map;
})();

// Suggest a price for a list of selected work items. Returns 0 if
// nothing is recognized — the form treats 0 as "don't auto-fill" so
// the user can clear it back to empty by deselecting everything.
function suggestPriceFromWorkItems(items) {
  if (!Array.isArray(items)) return 0;
  let total = 0;
  for (const item of items) {
    const r = WORK_PRICE_RANGES[item];
    if (r) total += r.mid;
  }
  return total;
}
const MEASUREMENT_FIELDS=[
  {key:'bust',label:'Bust',unit:'in'},
  {key:'waist',label:'Waist',unit:'in'},
  {key:'hips',label:'Hips',unit:'in'},
  {key:'height',label:'Height',unit:'in'},
  {key:'hem',label:'Hem length (waist to floor)',unit:'in'},
  {key:'shoulders',label:'Shoulder to shoulder',unit:'in'},
  {key:'sleeve',label:'Sleeve length',unit:'in'},
  {key:'heel',label:'Shoe heel height',unit:'in'},
];
const STATUS_OPTS=[
  {id:'measurement_needed',label:'Measurement needed',color:'var(--text-info)'},
  {id:'in_progress',label:'In progress',color:'var(--text-warning)'},
  {id:'fitting_scheduled',label:'Fitting scheduled',color:C.purple},
  {id:'complete',label:'Complete',color:'var(--text-success)'},
];

// ─── JOB TIMER ────────────────────────────────────────────────────────────────
function JobTimer({ job, logTimeEntry }) {
  const [running, setRunning] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef(null);
  const [showLog, setShowLog] = useState(false);
  const [manualMinutes, setManualMinutes] = useState('');
  const [timerNote, setTimerNote] = useState('');
  const toast = useToast();

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [running, startTime]);

  function start() { setStartTime(Date.now()); setElapsed(0); setRunning(true); }

  async function stop() {
    setRunning(false);
    const mins = Math.max(1, Math.round(elapsed / 60));
    await logTimeEntry(job.id, mins, 'Timer session');
    toast(`Logged ${mins} min`);
    setElapsed(0);
  }

  const totalHours = Math.floor((job.total_minutes || 0) / 60);
  const totalMins = (job.total_minutes || 0) % 60;
  const fmtElapsed = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;

  const effectiveRate = job.price > 0 && job.total_minutes > 0
    ? (job.price / (job.total_minutes / 60)).toFixed(2)
    : null;

  return (
    <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <span style={{ fontSize: 11, color: C.gray }}>
          ⏱ {totalHours > 0 ? `${totalHours}h ` : ''}{totalMins}m total
          {effectiveRate && <span style={{ marginLeft: 6, color: 'var(--text-success)', fontWeight: 600 }}>${effectiveRate}/hr</span>}
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          {!running ? (
            <button onClick={e => { e.stopPropagation(); start(); }}
              style={{ fontSize: 10, padding: '2px 8px', background: C.rosaPale, color: C.rosaText, border: `1px solid ${C.rosa}`, borderRadius: 5, cursor: 'pointer', fontWeight: 600 }}>
              ▶ Start
            </button>
          ) : (
            <button onClick={e => { e.stopPropagation(); stop(); }}
              style={{ fontSize: 10, padding: '2px 8px', background: C.redBg, color: C.danger, border: `1px solid ${C.danger}`, borderRadius: 5, cursor: 'pointer', fontWeight: 600 }}>
              ■ {fmtElapsed}
            </button>
          )}
          <button onClick={e => { e.stopPropagation(); setShowLog(!showLog); }}
            style={{ fontSize: 10, padding: '2px 6px', background: 'none', border: `1px solid ${C.border}`, borderRadius: 5, cursor: 'pointer', color: C.gray }}>
            + Log
          </button>
        </div>
      </div>
      {showLog && (
        <div style={{ marginTop: 6, display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
          <input type="number" placeholder="min" value={manualMinutes} onChange={e => setManualMinutes(e.target.value)}
            style={{ width: 60, padding: '3px 6px', borderRadius: 5, border: `1px solid ${C.border}`, fontSize: 11 }} />
          <input placeholder="note" value={timerNote} onChange={e => setTimerNote(e.target.value)}
            style={{ flex: 1, padding: '3px 6px', borderRadius: 5, border: `1px solid ${C.border}`, fontSize: 11 }} />
          <button onClick={async () => {
            if (!manualMinutes) return;
            await logTimeEntry(job.id, manualMinutes, timerNote);
            toast(`Logged ${manualMinutes} min`);
            setShowLog(false); setManualMinutes(''); setTimerNote('');
          }} style={{ padding: '3px 8px', background: C.rosa, color: '#fff', border: 'none', borderRadius: 5, fontSize: 11, cursor: 'pointer' }}>
            Save
          </button>
        </div>
      )}
    </div>
  );
}

// ─── WORK ITEMS PICKER (shared) ───────────────────────────────────────────────
const WorkItemsPicker = ({value, onChange}) => (
  <div style={{background:C.ivory,padding:16,borderRadius:12,border:`1px solid ${C.border}`}}>
    <div style={{...LBL,marginBottom:12,textTransform:'uppercase',letterSpacing:'0.06em'}}>Work items (select all that apply)</div>
    <div style={{display:'flex',flexWrap:'wrap',gap:8}} role="group" aria-label="Work items">
      {ALL_WORK_ITEMS.map(w=>{
        const selected=value.includes(w);
        const toggle=()=>onChange(selected?value.filter(x=>x!==w):[...value,w]);
        return(
          <button key={w} type="button"
            onClick={toggle}
            onKeyDown={e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();toggle();}}}
            tabIndex={0}
            aria-pressed={selected}
            style={{padding:'6px 14px',borderRadius:999,border:`1.5px solid ${selected?C.rosa:C.border}`,background:selected?C.rosaPale:C.white,color:selected?C.rosaText:C.gray,cursor:'pointer',fontSize:13,fontWeight:selected?600:500,transition:'all 0.1s'}}>
            {w}{WORK_HINTS[w]&&<span style={{color:selected?C.rosaLight:C.borderDark,marginLeft:6,fontSize:11,fontWeight:400}}>{WORK_HINTS[w]}</span>}
          </button>
        );
      })}
    </div>
  </div>
);

// ─── MEASUREMENTS SECTION (shared) ────────────────────────────────────────────
const MeasurementsSection = ({value={}, onChange}) => (
  <div style={{background:C.ivory,padding:16,borderRadius:12,border:`1px solid ${C.border}`}}>
    <div style={{...LBL,marginBottom:12,textTransform:'uppercase',letterSpacing:'0.06em'}}>📏 Measurements <span style={{fontWeight:400,textTransform:'none',letterSpacing:0}}>(optional)</span></div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:12}}>
      {MEASUREMENT_FIELDS.map(f=>(
        <div key={f.key}>
          <div style={{fontSize:11,color:C.gray,fontWeight:500,marginBottom:4}}>{f.label}</div>
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            <input
              type="number" step="0.25" min="0"
              value={value[f.key]||''}
              onChange={e=>onChange({...value,[f.key]:e.target.value})}
              placeholder="—"
              style={{...inputSt,padding:'8px 10px',borderRadius:8,fontSize:13,flex:1}}
            />
            <span style={{fontSize:11,color:C.gray,flexShrink:0}}>{f.unit}</span>
          </div>
        </div>
      ))}
    </div>
    {value?.notes!==undefined&&(
      <div style={{marginTop:12}}>
        <div style={{fontSize:11,color:C.gray,fontWeight:500,marginBottom:4}}>Measurement notes</div>
        <textarea value={value.notes||''} onChange={e=>onChange({...value,notes:e.target.value})} rows={2}
          placeholder="e.g. Tried on 4/2 — take in waist 1.5in, hem with 3in heels"
          style={{...inputSt,padding:'8px 10px',borderRadius:8,fontSize:13,resize:'vertical',width:'100%',boxSizing:'border-box'}}/>
      </div>
    )}
  </div>
);

// ─── INLINE NEW CLIENT FORM ───────────────────────────────────────────────────
const InlineNewClient = ({onCreate, onDone}) => {
  const [name,setName]=useState('');
  const [phone,setPhone]=useState('');
  const [email,setEmail]=useState('');
  const [saving,setSaving]=useState(false);
  const [err,setErr]=useState('');
  const save=async()=>{
    if(!name.trim())return setErr('Name is required');
    setSaving(true);
    const {data,error}=await onCreate({name:name.trim(),phone:phone.trim()||null,email:email.trim()||null});
    setSaving(false);
    if(error){setErr(error.message||'Failed to create client');return;}
    onDone(data);
  };
  return (
    <div style={{background:C.greenBg,border:`1px solid ${C.success}`,borderRadius:12,padding:16,display:'flex',flexDirection:'column',gap:10}}>
      <div style={{fontSize:12,fontWeight:600,color:C.green,marginBottom:2}}>➕ New client</div>
      <input value={name} onChange={e=>setName(e.target.value)} placeholder="Full name *"
        style={{...inputSt,padding:'9px 12px',borderRadius:8,fontSize:13}}/>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
        <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="Phone (optional)"
          style={{...inputSt,padding:'9px 12px',borderRadius:8,fontSize:13}}/>
        <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email (optional)"
          style={{...inputSt,padding:'9px 12px',borderRadius:8,fontSize:13}}/>
      </div>
      {err&&<div style={{fontSize:12,color:'var(--text-danger)'}}>{err}</div>}
      <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
        <button type="button" onClick={()=>onDone(null)}
          style={{padding:'7px 14px',background:'none',border:`1px solid ${C.border}`,borderRadius:8,fontSize:12,cursor:'pointer',color:C.gray}}>
          Cancel
        </button>
        <button type="button" onClick={save} disabled={saving}
          style={{padding:'7px 14px',background:C.green,border:'none',borderRadius:8,fontSize:12,fontWeight:600,color:'#fff',cursor:'pointer',opacity:saving?0.7:1}}>
          {saving?'Saving…':'Create client'}
        </button>
      </div>
    </div>
  );
};

// ─── NEW ALTERATION MODAL ────────────────────────────────────────────────────
const NewAlterationModal = ({staff, clients: initialClients, createClient, onClose, onCreate}) => {
  const trapRef = useFocusTrap(true);
  const [clientsList,setClientsList]=useState(initialClients||[]);
  const [garmentType,setGarmentType]=useState('boutique');
  const [garmentDesc,setGarmentDesc]=useState('');
  const [clientId,setClientId]=useState('');
  const [showNewClient,setShowNewClient]=useState(false);
  const [workItems,setWorkItems]=useState([]);
  const [workNotes,setWorkNotes]=useState('');
  const [measurements,setMeasurements]=useState({notes:''});
  const seamstresses=(staff||[]).filter(s=>['Seamstress','seamstress','owner','Owner'].includes(s.role));
  const [seamstressId,setSeamstressId]=useState('');
  const [quotedPrice,setQuotedPrice]=useState('');
  // Did the user manually type a price? Then stop overwriting from work-item
  // selections. They've taken control. Reset only when they clear the field.
  const [priceTouched,setPriceTouched]=useState(false);
  const [deadline,setDeadline]=useState('');
  const [notes,setNotes]=useState('');
  const [saving,setSaving]=useState(false);
  const [err,setErr]=useState('');

  // Auto-suggest a price from selected work items (sum of midpoints).
  // Only applies until the user manually edits the price field.
  React.useEffect(() => {
    if (priceTouched) return;
    const suggested = suggestPriceFromWorkItems(workItems);
    setQuotedPrice(suggested > 0 ? String(suggested) : '');
  }, [workItems, priceTouched]);

  const handleNewClientDone=(newClient)=>{
    setShowNewClient(false);
    if(newClient){
      setClientsList(prev=>[...prev,newClient]);
      setClientId(newClient.id);
    }
  };

  const confirm=async()=>{
    if(!clientId)return setErr('Please select a client');
    if(!garmentDesc.trim())return setErr('Please describe the garment');
    if(!workItems.length)return setErr('Select at least one work item');
    // price is optional — no validation required
    setSaving(true);
    const meas = Object.fromEntries(Object.entries(measurements).filter(([,v])=>v!==''&&v!=null));
    const result = await onCreate({
      garment:garmentDesc.trim(),
      client_id:clientId,
      work_items:workItems,
      seamstress_id:seamstressId||null,
      price:quotedPrice?Number(quotedPrice):null,
      deadline:deadline||null,
      measurements:Object.keys(meas).length?meas:null,
      notes:[workNotes.trim(),notes.trim()].filter(Boolean).join('\n\n')||null,
      status:'measurement_needed',
    });
    setSaving(false);
    if(result?.error){setErr('Failed to save: '+(result.error.message||'Unknown error'));return;}
    onClose();
  };

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16,backdropFilter:'blur(4px)'}}>
      <div ref={trapRef} role="dialog" aria-modal="true" aria-labelledby="alterations-newjob-title" style={{background:C.white,borderRadius:20,width:600,maxHeight:'92vh',display:'flex',flexDirection:'column',overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,0.15)'}}>
        {/* Header */}
        <div style={{padding:'24px 30px 20px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexShrink:0}}>
          <div>
            <div id="alterations-newjob-title" style={{fontWeight:600,fontSize:18,color:C.ink,marginBottom:4}}>New alteration job</div>
            <div style={{fontSize:13,color:C.gray}}>Enter garment details, work items, and measurements.</div>
          </div>
          <button onClick={onClose} aria-label="Close" title="Close" style={{background:'none',border:'none',fontSize:24,cursor:'pointer',color:C.gray,lineHeight:1}}>×</button>
        </div>
        {/* Body */}
        <div style={{flex:1,overflowY:'auto',padding:30,display:'flex',flexDirection:'column',gap:20}}>
          {/* Client — required */}
          <div>
            <label htmlFor="alteration-field-client" style={{...LBL,marginBottom:8,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <span>Client <span style={{color:'var(--text-danger)'}}>*</span></span>
              {!showNewClient&&createClient&&(
                <button type="button" onClick={()=>setShowNewClient(true)}
                  aria-label="Add new client" title="Add new client"
                  style={{background:'none',border:'none',color:C.rosaText,fontSize:12,fontWeight:600,cursor:'pointer',padding:0}}>
                  ➕ New client
                </button>
              )}
            </label>
            {showNewClient
              ? <InlineNewClient onCreate={createClient} onDone={handleNewClientDone}/>
              : <select id="alteration-field-client" value={clientId} onChange={e=>setClientId(e.target.value)}
                  style={{...inputSt,padding:'12px 14px',borderRadius:10,cursor:'pointer',border:`1px solid ${!clientId&&err?'var(--color-danger)':C.border}`}}>
                  <option value="">Select a client…</option>
                  {clientsList.map(c=><option key={c.id} value={c.id}>{c.name}{c.phone?` · ${c.phone}`:''}</option>)}
                </select>
            }
          </div>
          {/* Garment type */}
          <div>
            <div style={{...LBL,marginBottom:10,textTransform:'uppercase',letterSpacing:'0.06em'}}>Garment type</div>
            <div style={{display:'flex',gap:10}}>
              {[['boutique','Boutique dress (from inventory)'],['byog',"Client's own garment (BYOG)"]].map(([v,l])=>(
                <button key={v} type="button" onClick={()=>setGarmentType(v)} style={{flex:1,padding:'12px',borderRadius:12,border:`1.5px solid ${garmentType===v?C.rosa:C.border}`,background:garmentType===v?C.rosaPale:'transparent',color:garmentType===v?C.rosaText:C.gray,cursor:'pointer',fontSize:13,fontWeight:garmentType===v?600:500,transition:'all 0.15s'}}>{l}</button>
              ))}
            </div>
          </div>
          {/* Garment description */}
          <div>
            <label htmlFor="alteration-field-garment" style={{...LBL,marginBottom:8}}>Garment description <span style={{color:'var(--text-danger)'}}>*</span></label>
            <input id="alteration-field-garment" value={garmentDesc} onChange={e=>setGarmentDesc(e.target.value)}
              placeholder={garmentType==='boutique'?'e.g. Bridal gown #BB-047 · Ivory A-line':"e.g. Client's own bridesmaid dress (×4)"}
              style={{...inputSt,padding:'12px 14px',borderRadius:10}}/>
          </div>
          {/* Work items */}
          <WorkItemsPicker value={workItems} onChange={setWorkItems}/>
          {/* Work notes */}
          <div>
            <label htmlFor="alteration-field-worknotes" style={{...LBL,marginBottom:8,display:'block'}}>Work notes (optional)</label>
            <textarea id="alteration-field-worknotes" value={workNotes} onChange={e=>setWorkNotes(e.target.value)} rows={2}
              placeholder='e.g. Take in waist 1.5 inches. Hem to floor with 1" clearance in heels.'
              style={{...inputSt,padding:'12px 14px',borderRadius:10,resize:'vertical'}}/>
          </div>
          {/* Measurements */}
          <MeasurementsSection value={measurements} onChange={setMeasurements}/>
          {/* Seamstress + Price + Deadline */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
            <div>
              <label htmlFor="alteration-field-seamstress" style={{...LBL,marginBottom:8,display:'block'}}>Seamstress</label>
              <select id="alteration-field-seamstress" value={seamstressId} onChange={e=>setSeamstressId(e.target.value)} style={{...inputSt,padding:'12px 14px',borderRadius:10,cursor:'pointer'}}>
                <option value="">Unassigned</option>
                {seamstresses.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="alteration-field-price" style={{...LBL,marginBottom:8,display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:8}}>
                <span>Price ($)</span>
                {priceTouched && workItems.length > 0 && (
                  <button type="button"
                    onClick={()=>{ setPriceTouched(false); setQuotedPrice(String(suggestPriceFromWorkItems(workItems))); }}
                    style={{background:'none',border:'none',color:C.rosaText,fontSize:10,fontWeight:500,cursor:'pointer',padding:0,letterSpacing:'0.04em',textTransform:'uppercase'}}>
                    Re-estimate
                  </button>
                )}
              </label>
              <input id="alteration-field-price" type="number" value={quotedPrice}
                onChange={e=>{ setQuotedPrice(e.target.value); setPriceTouched(true); }}
                placeholder="0" style={{...inputSt,padding:'12px 14px',borderRadius:10}}/>
              {!priceTouched && workItems.length > 0 && (
                <div style={{fontSize:11,color:C.gray,marginTop:6,fontStyle:'italic'}}>
                  Estimated from work items — adjust as needed
                </div>
              )}
            </div>
            <div>
              <label htmlFor="alteration-field-deadline" style={{...LBL,marginBottom:8,display:'block'}}>Deadline</label>
              <input id="alteration-field-deadline" type="date" value={deadline} onChange={e=>setDeadline(e.target.value)}
                style={{...inputSt,padding:'12px 14px',borderRadius:10}}/>
            </div>
          </div>
          {/* Internal notes */}
          <div>
            <label htmlFor="alteration-field-notes" style={{...LBL,marginBottom:8,display:'block'}}>Internal notes (optional)</label>
            <textarea id="alteration-field-notes" value={notes} onChange={e=>setNotes(e.target.value)} rows={2}
              placeholder="Any additional notes for the team..."
              style={{...inputSt,padding:'12px 14px',borderRadius:10,resize:'vertical'}}/>
          </div>
          {err&&<div style={{fontSize:13,color:'var(--text-danger)',background:'var(--bg-danger)',padding:'10px 14px',borderRadius:10}}>{err}</div>}
        </div>
        {/* Footer */}
        <div style={{padding:'16px 30px',background:C.ivory,borderTop:`1px solid ${C.border}`,display:'flex',justifyContent:'flex-end',gap:12,flexShrink:0}}>
          <GhostBtn label="Cancel" colorScheme="danger" onClick={onClose} style={{padding:'10px 20px'}}/>
          <PrimaryBtn label={saving?'Creating…':'Add job'} onClick={confirm} style={{padding:'10px 24px'}}/>
        </div>
      </div>
    </div>
  );
};

// ─── LABOR COST HELPERS ───────────────────────────────────────────────────────
function fmtMinutes(totalMins) {
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function LaborCostRow({ job }) {
  const totalMins = job.total_minutes || 0;
  if (totalMins === 0) return null;
  const hasPrice = job.price > 0;
  const timeLabel = fmtMinutes(totalMins);
  const rate = hasPrice ? (job.price / (totalMins / 60)).toFixed(2) : null;
  const unpricedColor = C.amber;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      marginTop: 6, paddingTop: 6, borderTop: `1px dashed ${C.border}`,
      fontSize: 11,
    }}>
      <span style={{ color: hasPrice ? C.gray : unpricedColor, fontWeight: 500 }}>
        ⏱ {timeLabel}
      </span>
      {rate && (
        <span style={{ color: C.gray, marginLeft: 2 }}>
          · <span style={{ color: C.ink, fontWeight: 600 }}>${rate}/hr</span>
        </span>
      )}
      {!hasPrice && (
        <span style={{ color: unpricedColor, fontSize: 10, marginLeft: 2 }}>
          — add price to see rate
        </span>
      )}
    </div>
  );
}

// ─── EDIT ALTERATION MODAL ────────────────────────────────────────────────────
const EditAlterationModal = ({job, staff, clients, onClose, onUpdate, onCancel, onDelete}) => {
  const [activeSection,setActiveSection]=useState('details'); // 'details' | 'measurements' | 'status' | 'photos'
  const [confirmAction,setConfirmAction]=useState(null); // 'cancel' | 'delete'
  const [garmentDesc,setGarmentDesc]=useState(job.garment||'');
  const [clientId,setClientId]=useState(job.client_id||'');
  const [workItems,setWorkItems]=useState(job.work||[]);
  const [workNotes,setWorkNotes]=useState('');
  const [measurements,setMeasurements]=useState({notes:'',...(job.measurements||{})});
  const seamstresses=(staff||[]).filter(s=>['Seamstress','seamstress','owner','Owner'].includes(s.role));
  const [seamstressId,setSeamstressId]=useState(job.seamstress_id||'');
  const [quotedPrice,setQuotedPrice]=useState(job.price?String(job.price):'');
  // Pre-existing job price = treat as user-set; never auto-overwrite on
  // re-renders. The "Re-estimate" button below the field is the explicit
  // way to recompute when work items change.
  const [priceTouched,setPriceTouched]=useState(!!job.price);
  // For brand-new jobs (job.price empty), auto-suggest once when items change
  React.useEffect(() => {
    if (priceTouched) return;
    const suggested = suggestPriceFromWorkItems(workItems);
    setQuotedPrice(suggested > 0 ? String(suggested) : '');
  }, [workItems, priceTouched]);
  const [deadline,setDeadline]=useState(job.deadline||'');
  const [notes,setNotes]=useState(job.notes||'');
  const [status,setStatus]=useState(job.status||'measurement_needed');
  const [saving,setSaving]=useState(false);
  const [err,setErr]=useState('');
  const toast=useToast();

  // Photos state
  const [beforeImageUrl,setBeforeImageUrl]=useState(job.before_image_url||null);
  const [afterImageUrl,setAfterImageUrl]=useState(job.after_image_url||null);
  const [uploadingBefore,setUploadingBefore]=useState(false);
  const [uploadingAfter,setUploadingAfter]=useState(false);
  const [photoErr,setPhotoErr]=useState('');
  const beforeFileRef=useRef();
  const afterFileRef=useRef();

  const uploadPhoto=async(file,slot)=>{
    if(!file)return;
    if(file.size>5*1024*1024){setPhotoErr('Image must be under 5 MB');return;}
    setPhotoErr('');
    slot==='before'?setUploadingBefore(true):setUploadingAfter(true);
    const ext=file.name.split('.').pop().replace(/[^a-z0-9]/gi,'').toLowerCase();
    const path=`alterations/${job.id}-${slot}-${Date.now()}.${ext}`;
    const {error:upErr}=await supabase.storage.from('dress-images').upload(path,file,{upsert:true,contentType:file.type});
    if(upErr){setPhotoErr('Upload failed: '+upErr.message);slot==='before'?setUploadingBefore(false):setUploadingAfter(false);return;}
    const {data:pub}=supabase.storage.from('dress-images').getPublicUrl(path);
    const url=pub?.publicUrl||null;
    if(slot==='before')setBeforeImageUrl(url);
    else setAfterImageUrl(url);
    slot==='before'?setUploadingBefore(false):setUploadingAfter(false);
    // Persist immediately
    await onUpdate(job.id,slot==='before'?{before_image_url:url}:{after_image_url:url});
  };

  const removePhoto=async(slot)=>{
    if(slot==='before')setBeforeImageUrl(null);
    else setAfterImageUrl(null);
    await onUpdate(job.id,slot==='before'?{before_image_url:null}:{after_image_url:null});
  };

  const save=async()=>{
    if(!clientId)return setErr('Please select a client');
    if(!garmentDesc.trim())return setErr('Please describe the garment');
    if(!workItems.length)return setErr('Select at least one work item');
    setSaving(true);
    const meas=Object.fromEntries(Object.entries(measurements).filter(([,v])=>v!==''&&v!=null));
    const {error}=await onUpdate(job.id,{
      garment:garmentDesc.trim(),
      client_id:clientId||null,
      seamstress_id:seamstressId||null,
      price:quotedPrice?Number(quotedPrice):null,
      deadline:deadline||null,
      measurements:Object.keys(meas).length?meas:null,
      notes:notes.trim()||null,
      status,
      before_image_url:beforeImageUrl,
      after_image_url:afterImageUrl,
    });
    setSaving(false);
    if(error){setErr('Failed to save: '+(error.message||'Unknown error'));return;}
    toast?.('Job updated ✓');
    onClose();
  };

  const SECTIONS=[
    {id:'details',label:'Details',icon:'✏️'},
    {id:'measurements',label:'Measurements',icon:'📏'},
    {id:'status',label:'Status',icon:'🔄'},
    {id:'photos',label:'Photos',icon:'📷'},
    {id:'labor',label:'Labor',icon:'⏱'},
  ];

  const hasMeasurements=Object.entries(job.measurements||{}).some(([k,v])=>k!=='notes'&&v);

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16,backdropFilter:'blur(4px)'}}>
      <div role="dialog" aria-modal="true" aria-labelledby="alterations-editjob-title" style={{background:C.white,borderRadius:20,width:640,maxHeight:'92vh',display:'flex',flexDirection:'column',overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,0.15)'}}>
        {/* Header */}
        <div style={{padding:'24px 30px 0',borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
            <div>
              <div id="alterations-editjob-title" style={{fontWeight:600,fontSize:18,color:C.ink,marginBottom:2}}>Edit alteration job</div>
              <div style={{fontSize:13,color:C.gray}}>{job.garment}</div>
            </div>
            <button onClick={onClose} aria-label="Close" title="Close" style={{background:'none',border:'none',fontSize:24,cursor:'pointer',color:C.gray,lineHeight:1}}>×</button>
          </div>
          {/* Tabs */}
          <div style={{display:'flex',gap:0}}>
            {SECTIONS.map(s=>(
              <button key={s.id} onClick={()=>setActiveSection(s.id)}
                style={{padding:'10px 20px',background:'none',border:'none',borderBottom:`2px solid ${activeSection===s.id?C.rosa:'transparent'}`,color:activeSection===s.id?C.rosaText:C.gray,fontWeight:activeSection===s.id?600:500,fontSize:13,cursor:'pointer',transition:'all 0.15s',display:'flex',alignItems:'center',gap:6}}>
                {s.icon} {s.label}
                {s.id==='measurements'&&hasMeasurements&&<span style={{fontSize:9,background:C.rosa,color:C.white,borderRadius:999,padding:'1px 5px',fontWeight:700}}>✓</span>}
                {s.id==='photos'&&(beforeImageUrl||afterImageUrl)&&<span style={{fontSize:9,background:C.rosa,color:C.white,borderRadius:999,padding:'1px 5px',fontWeight:700}}>{[beforeImageUrl,afterImageUrl].filter(Boolean).length}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{flex:1,overflowY:'auto',padding:30,display:'flex',flexDirection:'column',gap:20}}>

          {activeSection==='details'&&<>
            {/* Client */}
            <div>
              <label htmlFor="edit-alteration-client" style={{...LBL,marginBottom:8,display:'block'}}>Client <span style={{color:'var(--text-danger)'}}>*</span></label>
              <select id="edit-alteration-client" value={clientId} onChange={e=>setClientId(e.target.value)}
                style={{...inputSt,padding:'12px 14px',borderRadius:10,cursor:'pointer'}}>
                <option value="">Select a client…</option>
                {(clients||[]).map(c=><option key={c.id} value={c.id}>{c.name}{c.phone?` · ${c.phone}`:''}</option>)}
              </select>
            </div>
            {/* Garment */}
            <div>
              <label htmlFor="edit-alteration-garment" style={{...LBL,marginBottom:8,display:'block'}}>Garment description <span style={{color:'var(--text-danger)'}}>*</span></label>
              <input id="edit-alteration-garment" value={garmentDesc} onChange={e=>setGarmentDesc(e.target.value)}
                placeholder="e.g. Bridal gown #BB-047 · Ivory A-line"
                style={{...inputSt,padding:'12px 14px',borderRadius:10}}/>
            </div>
            {/* Work items */}
            <WorkItemsPicker value={workItems} onChange={setWorkItems}/>
            {/* Seamstress + Price + Deadline */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
              <div>
                <label htmlFor="edit-alteration-seamstress" style={{...LBL,marginBottom:8,display:'block'}}>Seamstress</label>
                <select id="edit-alteration-seamstress" value={seamstressId} onChange={e=>setSeamstressId(e.target.value)}
                  style={{...inputSt,padding:'12px 14px',borderRadius:10,cursor:'pointer'}}>
                  <option value="">Unassigned</option>
                  {seamstresses.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="edit-alteration-price" style={{...LBL,marginBottom:8,display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:8}}>
                  <span>Price ($)</span>
                  {workItems.length > 0 && (
                    <button type="button"
                      onClick={()=>{ setPriceTouched(false); setQuotedPrice(String(suggestPriceFromWorkItems(workItems))); }}
                      style={{background:'none',border:'none',color:C.rosaText,fontSize:10,fontWeight:500,cursor:'pointer',padding:0,letterSpacing:'0.04em',textTransform:'uppercase'}}>
                      Re-estimate
                    </button>
                  )}
                </label>
                <input id="edit-alteration-price" type="number" value={quotedPrice}
                  onChange={e=>{ setQuotedPrice(e.target.value); setPriceTouched(true); }}
                  placeholder="0" style={{...inputSt,padding:'12px 14px',borderRadius:10}}/>
                {!priceTouched && workItems.length > 0 && (
                  <div style={{fontSize:11,color:C.gray,marginTop:6,fontStyle:'italic'}}>
                    Estimated from work items — adjust as needed
                  </div>
                )}
              </div>
              <div>
                <label htmlFor="edit-alteration-deadline" style={{...LBL,marginBottom:8,display:'block'}}>Deadline</label>
                <input id="edit-alteration-deadline" type="date" value={deadline} onChange={e=>setDeadline(e.target.value)}
                  style={{...inputSt,padding:'12px 14px',borderRadius:10}}/>
              </div>
            </div>
            {/* Notes */}
            <div>
              <label htmlFor="edit-alteration-notes" style={{...LBL,marginBottom:8,display:'block'}}>Notes</label>
              <textarea id="edit-alteration-notes" value={notes} onChange={e=>setNotes(e.target.value)} rows={3}
                placeholder="Work instructions, client preferences, team notes…"
                style={{...inputSt,padding:'12px 14px',borderRadius:10,resize:'vertical'}}/>
            </div>
          </>}

          {activeSection==='measurements'&&<>
            <div style={{fontSize:13,color:C.gray,background:C.ivory,padding:'10px 14px',borderRadius:10,border:`1px solid ${C.border}`}}>
              Record the client's measurements to guide the seamstress. All fields are optional — fill in what's relevant for this alteration.
            </div>
            <MeasurementsSection value={measurements} onChange={setMeasurements}/>
            <div>
              <label htmlFor="edit-alteration-meas-notes" style={{...LBL,marginBottom:8,display:'block'}}>Measurement notes</label>
              <textarea id="edit-alteration-meas-notes" value={measurements.notes||''} onChange={e=>setMeasurements(m=>({...m,notes:e.target.value}))} rows={3}
                placeholder="e.g. Tried on 4/2 with ivory heels (3in). Needs 1.5in taken in at waist. Hem at floor length."
                style={{...inputSt,padding:'12px 14px',borderRadius:10,resize:'vertical'}}/>
            </div>
          </>}

          {activeSection==='status'&&<>
            <div id="edit-alteration-status-label" style={{...LBL,marginBottom:8}}>Job status</div>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {STATUS_OPTS.map(opt=>(
                <button key={opt.id} type="button" onClick={()=>setStatus(opt.id)}
                  style={{textAlign:'left',padding:'14px 16px',borderRadius:12,border:`1.5px solid ${status===opt.id?C.rosa:C.border}`,background:status===opt.id?C.rosaPale:C.white,cursor:'pointer',transition:'all 0.15s',display:'flex',alignItems:'center',gap:12}}>
                  <span style={{width:10,height:10,borderRadius:'50%',background:opt.color,flexShrink:0,display:'inline-block'}}/>
                  <div>
                    <div style={{fontSize:14,fontWeight:600,color:status===opt.id?C.rosaText:C.ink}}>{opt.label}</div>
                    {opt.id===status&&<div style={{fontSize:12,color:C.gray,marginTop:2}}>Current status</div>}
                  </div>
                  {status===opt.id&&<span style={{marginLeft:'auto',fontSize:16}}>✓</span>}
                </button>
              ))}
            </div>
          </>}

          {activeSection==='photos'&&<>
            <div style={{fontSize:13,color:C.gray,background:C.ivory,padding:'10px 14px',borderRadius:10,border:`1px solid ${C.border}`}}>
              Upload before and after photos to document the alteration work. Max 5 MB per image.
            </div>
            {photoErr&&<div style={{fontSize:12,color:'var(--text-danger)',background:'var(--bg-danger)',padding:'10px 14px',borderRadius:10}}>{photoErr}</div>}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
              {[{slot:'before',label:'Before',url:beforeImageUrl,uploading:uploadingBefore,ref:beforeFileRef},{slot:'after',label:'After',url:afterImageUrl,uploading:uploadingAfter,ref:afterFileRef}].map(({slot,label,url,uploading,ref})=>(
                <div key={slot}>
                  <div style={{...LBL,marginBottom:8}}>{label} photo</div>
                  {url?(
                    <div style={{position:'relative',display:'inline-block'}}>
                      <img src={url} alt={`${label} alteration`} style={{width:'100%',maxWidth:240,height:180,objectFit:'cover',borderRadius:10,border:`1px solid ${C.border}`,display:'block'}}/>
                      <button onClick={()=>removePhoto(slot)}
                        aria-label="Delete photo" title="Delete photo"
                        style={{position:'absolute',top:6,right:6,background:'rgba(0,0,0,0.6)',color:'#fff',border:'none',borderRadius:'50%',width:24,height:24,cursor:'pointer',fontSize:14,lineHeight:1,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700}}>
                        ×
                      </button>
                    </div>
                  ):(
                    <div
                      onClick={()=>ref.current?.click()}
                      style={{width:'100%',height:150,border:`2px dashed ${C.border}`,borderRadius:10,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',cursor:uploading?'default':'pointer',background:C.ivory,gap:8,transition:'border-color 0.15s'}}
                      onMouseEnter={e=>{if(!uploading)e.currentTarget.style.borderColor=C.rosa;}}
                      onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;}}>
                      {uploading?(
                        <span style={{fontSize:12,color:C.gray}}>Uploading…</span>
                      ):(
                        <>
                          <span style={{fontSize:24,lineHeight:1}}>📷</span>
                          <span style={{fontSize:12,color:C.gray,fontWeight:500}}>Click to upload {label.toLowerCase()} photo</span>
                          <span style={{fontSize:11,color:C.gray}}>JPG, PNG, WEBP · max 5 MB</span>
                        </>
                      )}
                    </div>
                  )}
                  <input
                    ref={ref}
                    type="file"
                    accept="image/*"
                    style={{display:'none'}}
                    onChange={e=>{const f=e.target.files?.[0];if(f)uploadPhoto(f,slot);e.target.value='';}}
                  />
                </div>
              ))}
            </div>
          </>}

          {activeSection==='labor'&&(()=>{
            const totalMins=job.total_minutes||0;
            const entries=job.time_entries||[];
            const hours=totalMins/60;
            const displayH=Math.floor(totalMins/60);
            const displayM=totalMins%60;
            const hasPrice=job.price>0;
            const rate=hasPrice&&totalMins>0?(job.price/hours).toFixed(2):null;
            const unpricedColor=C.amber;
            return (
              <div style={{display:'flex',flexDirection:'column',gap:16}}>
                {totalMins===0&&entries.length===0?(
                  <div style={{textAlign:'center',padding:'40px 20px',background:C.ivory,borderRadius:12,border:`1px dashed ${C.border}`}}>
                    <div style={{fontSize:32,marginBottom:10}}>⏱</div>
                    <div style={{fontSize:14,fontWeight:500,color:C.ink,marginBottom:4}}>No time logged yet</div>
                    <div style={{fontSize:12,color:C.gray}}>Use the timer on the job card to log work sessions.</div>
                  </div>
                ):(
                  <>
                    {/* Summary stats */}
                    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
                      {[
                        {label:'Time logged',val:totalMins>0?fmtMinutes(totalMins):'—',col:totalMins>0?C.ink:C.gray},
                        {label:'Quoted price',val:hasPrice?fmt(job.price):'Not set',col:hasPrice?'var(--color-success)':unpricedColor},
                        {label:'Effective rate',val:rate?`$${rate}/hr`:hasPrice?'—':'Price needed',col:rate?C.ink:C.gray},
                      ].map((s,i)=>(
                        <div key={i} style={{background:C.ivory,border:`1px solid ${C.border}`,borderRadius:10,padding:'14px 16px'}}>
                          <div style={{fontSize:11,color:C.gray,fontWeight:500,marginBottom:6,textTransform:'uppercase',letterSpacing:'0.05em'}}>{s.label}</div>
                          <div style={{fontSize:18,fontWeight:700,color:s.col,lineHeight:1}}>{s.val}</div>
                        </div>
                      ))}
                    </div>
                    {/* Time entry log */}
                    {entries.length>0&&(
                      <div>
                        <div style={{...LBL,marginBottom:10}}>Time entries ({entries.length})</div>
                        <div style={{display:'flex',flexDirection:'column',gap:6,maxHeight:220,overflowY:'auto'}}>
                          {[...entries].sort((a,b)=>new Date(b.logged_at)-new Date(a.logged_at)).map((e,i)=>(
                            <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',background:C.ivory,borderRadius:8,border:`1px solid ${C.border}`,fontSize:12}}>
                              <span style={{fontWeight:600,color:C.ink,minWidth:36}}>{fmtMinutes(Number(e.minutes||0))}</span>
                              <span style={{color:C.gray,flex:1}}>{e.note||'Timer session'}</span>
                              <span style={{color:C.gray,fontSize:11,flexShrink:0}}>{e.logged_at?new Date(e.logged_at).toLocaleDateString('en-US',{month:'short',day:'numeric'}):''}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {!hasPrice&&totalMins>0&&(
                      <div style={{padding:'10px 14px',background:C.amberBg,border:`1px solid #FDE68A`,borderRadius:10,fontSize:12,color:C.warningText}}>
                        ⚠️ No price set — go to the <strong>Details</strong> tab to add a quoted price and calculate the effective hourly rate.
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })()}

          {err&&<div style={{fontSize:13,color:'var(--text-danger)',background:'var(--bg-danger)',padding:'10px 14px',borderRadius:10}}>{err}</div>}
        </div>

        {/* Confirm action banner */}
        {confirmAction&&(
          <div style={{padding:'14px 30px',background:confirmAction==='delete'?'var(--bg-danger)':'var(--bg-warning)',borderTop:`1px solid ${confirmAction==='delete'?'var(--color-danger)':'var(--color-warning)'}`,display:'flex',alignItems:'center',gap:12,flexShrink:0}}>
            <span style={{flex:1,fontSize:13,fontWeight:500,color:confirmAction==='delete'?'var(--text-danger)':'var(--text-warning)'}}>
              {confirmAction==='delete'?'⚠️ Permanently delete this job? This cannot be undone.':'Cancel this job? It will be marked as cancelled and removed from the active board.'}
            </span>
            <button onClick={()=>setConfirmAction(null)} style={{padding:'6px 12px',borderRadius:8,border:`1px solid ${C.border}`,background:C.white,fontSize:12,cursor:'pointer',color:C.gray}}>No, go back</button>
            <button onClick={async()=>{
              if(confirmAction==='cancel'){await onCancel?.(job.id);}
              else{await onDelete?.(job.id);}
              onClose();
            }} style={{padding:'6px 14px',borderRadius:8,border:'none',background:confirmAction==='delete'?'var(--color-danger)':'var(--color-warning)',color:C.white,fontSize:12,fontWeight:600,cursor:'pointer'}}>
              {confirmAction==='delete'?'Yes, delete':'Yes, cancel job'}
            </button>
          </div>
        )}
        {/* Footer */}
        <div style={{padding:'14px 30px',background:C.ivory,borderTop:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
          <div style={{display:'flex',gap:8}}>
            {job.status!=='cancelled'&&job.status!=='complete'&&onCancel&&(
              <button onClick={()=>setConfirmAction('cancel')}
                style={{padding:'7px 12px',borderRadius:8,border:'1px solid var(--color-warning)',background:'var(--bg-warning)',color:'var(--text-warning)',fontSize:12,fontWeight:600,cursor:'pointer'}}>
                🚫 Cancel job
              </button>
            )}
            {onDelete&&(
              <button onClick={()=>setConfirmAction('delete')}
                style={{padding:'7px 12px',borderRadius:8,border:'1px solid var(--color-danger)',background:'var(--bg-danger)',color:'var(--text-danger)',fontSize:12,fontWeight:600,cursor:'pointer'}}>
                🗑️ Delete
              </button>
            )}
          </div>
          <div style={{display:'flex',gap:12,alignItems:'center'}}>
            <span style={{fontSize:12,color:C.gray}}>
              {activeSection==='measurements'&&'All measurements in inches'}
            </span>
            <GhostBtn label="Close" onClick={onClose} style={{padding:'8px 18px'}}/>
            <PrimaryBtn label={saving?'Saving…':'Save changes'} onClick={save} style={{padding:'8px 20px'}}/>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── MY JOBS SIDEBAR ─────────────────────────────────────────────────────────
const STATUS_ORDER = ['measurement_needed','in_progress','fitting_scheduled','complete'];

const MyJobsSidebar = ({ jobs, staff, onOpenJob }) => {
  const [collapsed, setCollapsed] = useState(false);
  const { session } = useAuth();

  // Find the boutique_member record for the current logged-in user
  const myMember = useMemo(() => {
    if (!session?.user?.id || !staff?.length) return null;
    return staff.find(s => s.user_id === session.user.id) || null;
  }, [session, staff]);

  const myJobs = useMemo(() => {
    if (!myMember) return [];
    return jobs
      .filter(j => j.seamstress_id === myMember.id && j.status !== 'cancelled')
      .sort((a, b) => {
        const aD = a.deadline ? new Date(a.deadline + 'T12:00:00') : null;
        const bD = b.deadline ? new Date(b.deadline + 'T12:00:00') : null;
        if (aD && bD) return aD - bD;
        if (aD) return -1;
        if (bD) return 1;
        return 0;
      });
  }, [jobs, myMember]);

  const today = new Date(); today.setHours(0, 0, 0, 0);

  function getDaysInfo(job) {
    if (!job.deadline) return null;
    const dl = new Date(job.deadline + 'T12:00:00');
    const diff = Math.ceil((dl - today) / 86400000);
    return diff;
  }

  function getCardBg(job) {
    const diff = getDaysInfo(job);
    if (diff !== null && diff < 0) return C.redBg;
    if (diff !== null && diff <= 3) return C.amberBg;
    return C.white;
  }

  const ALT_COLORS = {
    measurement_needed: { bg: 'var(--bg-info)', col: 'var(--text-info)' },
    in_progress: { bg: 'var(--bg-warning)', col: 'var(--text-warning)' },
    fitting_scheduled: { bg: C.purplePale, col: C.purple },
    complete: { bg: 'var(--bg-success)', col: 'var(--text-success)' },
    cancelled: { bg: C.grayBg, col: C.gray },
  };

  if (collapsed) {
    return (
      <div style={{
        width: 32, flexShrink: 0, background: C.white,
        borderLeft: `1px solid ${C.border}`, display: 'flex',
        flexDirection: 'column', alignItems: 'center', paddingTop: 12, gap: 8,
        position: 'relative', cursor: 'pointer',
      }} onClick={() => setCollapsed(false)} title="Expand My Jobs">
        <button
          onClick={e => { e.stopPropagation(); setCollapsed(false); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: C.gray, padding: 0 }}
          aria-label="Expand My Jobs" title="Expand My Jobs"
        >›</button>
        {myJobs.length > 0 && (
          <span style={{
            background: C.rosa, color: C.white, borderRadius: 999,
            fontSize: 10, fontWeight: 700, padding: '2px 5px', lineHeight: 1,
          }}>{myJobs.length}</span>
        )}
        <span style={{
          writingMode: 'vertical-rl', textOrientation: 'mixed', fontSize: 10,
          fontWeight: 600, color: C.gray, letterSpacing: '0.05em',
          transform: 'rotate(180deg)', marginTop: 8,
        }}>MY JOBS</span>
      </div>
    );
  }

  return (
    <div style={{
      width: 240, flexShrink: 0, background: C.white,
      borderLeft: `1px solid ${C.border}`, display: 'flex',
      flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 14px 10px', borderBottom: `1px solid ${C.border}`, flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.ink, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            My Jobs
          </span>
          {myJobs.length > 0 && (
            <span style={{
              background: C.rosa, color: C.white, borderRadius: 999,
              fontSize: 10, fontWeight: 700, padding: '2px 6px', lineHeight: 1.4,
            }}>{myJobs.length}</span>
          )}
        </div>
        <button
          onClick={() => setCollapsed(true)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: C.gray, padding: 0, lineHeight: 1 }}
          aria-label="Collapse" title="Collapse"
        >‹</button>
      </div>

      {/* Job list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {!myMember ? (
          <div style={{ textAlign: 'center', padding: '24px 12px', fontSize: 12, color: C.gray }}>
            Your account is not linked to a staff member.
          </div>
        ) : myJobs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 12px', fontSize: 12, color: C.gray, lineHeight: 1.5 }}>
            No jobs assigned to you
          </div>
        ) : myJobs.map(job => {
          const diff = getDaysInfo(job);
          const isOverdue = diff !== null && diff < 0;
          const isSoon = diff !== null && diff <= 3 && diff >= 0;
          const sc = ALT_COLORS[job.status] || { bg: C.grayBg, col: C.gray };
          const cardBg = getCardBg(job);
          const workCount = (job.work || []).length;

          return (
            <div
              key={job.id}
              onClick={() => onOpenJob(job)}
              style={{
                background: cardBg,
                border: `1px solid ${isOverdue ? C.red : isSoon ? C.amber : C.border}`,
                borderRadius: 10, padding: '10px 11px',
                cursor: 'pointer', flexShrink: 0,
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                transition: 'box-shadow 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 3px 8px rgba(0,0,0,0.1)'; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.04)'; }}
            >
              {/* Client + status */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4, gap: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.ink, lineHeight: 1.3 }}>
                  {job.client || <span style={{ color: C.gray, fontStyle: 'italic' }}>No client</span>}
                </span>
                <span style={{ fontSize: 9, fontWeight: 700, background: sc.bg, color: sc.col, borderRadius: 999, padding: '2px 5px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {job.status.replace(/_/g, ' ')}
                </span>
              </div>
              {/* Garment */}
              <div style={{ fontSize: 11, color: C.gray, marginBottom: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {job.garment}
              </div>
              {/* Deadline */}
              {diff !== null ? (
                <div style={{ fontSize: 10, fontWeight: 600, color: isOverdue ? C.red : isSoon ? C.amber : C.gray, marginBottom: 4 }}>
                  {isOverdue ? `OVERDUE by ${Math.abs(diff)}d` : diff === 0 ? 'Due today' : `Due in ${diff}d`}
                </div>
              ) : null}
              {/* Work items count */}
              {workCount > 0 && (
                <div style={{ fontSize: 10, color: C.gray }}>
                  {workCount} item{workCount !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── ALTERATIONS ───────────────────────────────────────────────────────────
const Alterations = ({alterations: liveAlterations, staff, clients, createClient, createJob, updateJob, cancelJob, deleteJob, logTimeEntry}) => {
  usePageTitle('Alterations');
  const data = liveAlterations;
  const [view,setView]=useState('kanban');
  const [newJobOpen,setNewJobOpen]=useState(false);
  const [editJob,setEditJob]=useState(null);
  const [selectedJobs,setSelectedJobs]=useState(new Set());
  const [bulkWorking,setBulkWorking]=useState(false);
  const toast=useToast();
  const { boutique } = useAuth();
  const [notifyPrompt,setNotifyPrompt]=useState(null);

  // Auto-open new job modal from dashboard hint
  useEffect(()=>{
    const hint=sessionStorage.getItem('belori_autoopen');
    if(hint==='new_alteration'){sessionStorage.removeItem('belori_autoopen');setNewJobOpen(true);}
  },[]);
  // Auto-open via FAB custom event
  useEffect(()=>{
    const handler=()=>setNewJobOpen(true);
    window.addEventListener('belori:new-alteration',handler);
    return ()=>window.removeEventListener('belori:new-alteration',handler);
  },[]);

  const [search,setSearch]=useState('');
  const [filter,setFilter]=useState('all');
  const [staffFilter,setStaffFilter]=useState('');
  const [draggedJob, setDraggedJob] = useState(null);

  const cols=[
    {id:'measurement_needed',label:'Measurement needed',color:'var(--text-info)',bg:'var(--bg-info)'},
    {id:'in_progress',label:'In progress',color:'var(--text-warning)',bg:'var(--bg-warning)'},
    {id:'fitting_scheduled',label:'Fitting scheduled',color:C.purple,bg:C.purplePale},
    {id:'complete',label:'Complete',color:'var(--text-success)',bg:'var(--bg-success)'},
    {id:'cancelled',label:'Cancelled',color:C.gray,bg:C.grayBg},
  ];
  const ALT_STATUS_COLS={measurement_needed:{bg:'var(--bg-info)',col:'var(--text-info)'},in_progress:{bg:'var(--bg-warning)',col:'var(--text-warning)'},fitting_scheduled:{bg:C.purplePale,col:C.purple},complete:{bg:'var(--bg-success)',col:'var(--text-success)'},cancelled:{bg:C.grayBg,col:C.gray}};

  if (!data) return <div style={{ padding: 40, textAlign: 'center', color: C.gray }}>Loading…</div>;

  const { filtered, totalActive, dueThisWeek, unassigned, completed } = useMemo(() => {
    const filtered = data.filter(job => {
      if(search){const q=search.toLowerCase();if(!job.client?.toLowerCase().includes(q)&&!job.garment?.toLowerCase().includes(q)&&!(job.work||[]).some(w=>w.toLowerCase().includes(q)))return false;}
      if(filter==='urgent')return job.daysUntil<=7&&job.status!=='complete';
      if(filter==='unassigned')return !job.seamstress&&job.status!=='complete';
      if(staffFilter&&job.seamstress!==staffFilter)return false;
      return true;
    });
    return {
      filtered,
      totalActive: data.filter(a=>a.status!=='complete').length,
      dueThisWeek: data.filter(a=>a.daysUntil<=7&&a.status!=='complete').length,
      unassigned:  data.filter(a=>!a.seamstress&&a.status!=='complete').length,
      completed:   data.filter(a=>a.status==='complete').length,
    };
  }, [data, search, filter, staffFilter]);

  const handleDragStart=(e,job)=>{setDraggedJob(job);e.dataTransfer.effectAllowed='move';setTimeout(()=>{if(e.target)e.target.style.opacity='0.5';},0);};
  const handleDragEnd=(e)=>{if(e.target)e.target.style.opacity='1';setDraggedJob(null);};
  const handleDragOver=(e)=>{e.preventDefault();e.dataTransfer.dropEffect='move';e.currentTarget.style.background=C.grayBg;};
  const handleDragLeave=(e)=>{e.currentTarget.style.background='transparent';};
  const handleDrop=async(e,targetStatus)=>{e.preventDefault();e.currentTarget.style.background='transparent';if(draggedJob&&draggedJob.status!==targetStatus){await updateJob?.(draggedJob.id,{status:targetStatus});if(targetStatus==='complete')setNotifyPrompt(draggedJob);}};

  const handleUpdate=async(id,updates)=>{
    const {error}=await (updateJob?.(id,updates)||Promise.resolve({error:null}));
    if(!error&&updates.status==='complete'){const job=data.find(j=>j.id===id);if(job)setNotifyPrompt(job);}
    return {error};
  };

  const handleStatusAdvance=async(job,nextStatus)=>{
    await updateJob?.(job.id,{status:nextStatus});
    if(nextStatus==='complete')setNotifyPrompt(job);
  };

  const toggleJobSelect=(id,e)=>{
    e.stopPropagation();
    setSelectedJobs(s=>{const n=new Set(s);n.has(id)?n.delete(id):n.add(id);return n;});
  };

  const bulkAssign=async(seamstressName)=>{
    if(!seamstressName)return;
    setBulkWorking(true);
    const seamstress=staff?.find(s=>s.name===seamstressName);
    for(const id of selectedJobs){
      await updateJob?.(id,{seamstress_id:seamstress?.id||null});
    }
    toast(`Assigned ${selectedJobs.size} job${selectedJobs.size!==1?'s':''} to ${seamstressName} ✓`);
    setSelectedJobs(new Set());
    setBulkWorking(false);
  };

  const bulkMoveStatus=async(newStatus)=>{
    if(!newStatus)return;
    setBulkWorking(true);
    for(const id of selectedJobs){
      await updateJob?.(id,{status:newStatus});
    }
    const label=STATUS_OPTS.find(s=>s.id===newStatus)?.label||newStatus;
    toast(`Moved ${selectedJobs.size} job${selectedJobs.size!==1?'s':''} to "${label}" ✓`);
    setSelectedJobs(new Set());
    setBulkWorking(false);
  };

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',background:C.ivory}}>
      <Topbar title="Alterations board" subtitle="Manage workshop queues and fittings"
        actions={<><GhostBtn label={view==='kanban'?'List view':'Kanban view'} className="topbar-hide" onClick={()=>setView(v=>v==='kanban'?'list':'kanban')}/><PrimaryBtn label="+ New job" onClick={()=>setNewJobOpen(true)}/></>}/>

      {/* STAT STRIP */}
      <div className="stat-grid" style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16,padding:'16px 20px',background:C.ivory,borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
        {[{label:'Active jobs',val:String(totalActive),col:C.ink},{label:'Due within 7 days',val:String(dueThisWeek),col:dueThisWeek>0?'var(--color-danger)':C.gray},{label:'Unassigned jobs',val:String(unassigned),col:unassigned>0?'var(--color-warning)':C.gray},{label:'Completed',val:String(completed),col:'var(--color-success)'}].map((s,i)=>(
          <div key={i} style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:12,padding:'16px',boxShadow:'0 1px 2px rgba(0,0,0,0.03)'}}>
            <div style={{fontSize:22,fontWeight:600,color:s.col,lineHeight:1,marginBottom:6}}>{s.val}</div>
            <div style={{fontSize:12,color:C.gray,fontWeight:500}}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* FILTER BAR */}
      <div style={{padding:'16px 20px',background:C.white,borderBottom:`1px solid ${C.border}`,flexShrink:0,display:'flex',gap:16,alignItems:'center',flexWrap:'wrap',position:'sticky',top:0,zIndex:10}}>
        <div style={{position:'relative',display:'flex',alignItems:'center',flex:1,minWidth:250}}>
          <svg style={{position:'absolute',left:14,color:C.gray}} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search client, garment, or work item..."
            style={{width:'100%',padding:'10px 14px 10px 38px',borderRadius:10,border:`1px solid ${search?C.rosa:C.border}`,fontSize:'var(--text-input)',outline:'none',boxSizing:'border-box',background:C.ivory,transition:'all 0.2s'}}
            onFocus={e=>{e.target.style.borderColor=C.rosa;e.target.style.background=C.white;}} onBlur={e=>{if(!search){e.target.style.borderColor=C.border;e.target.style.background=C.ivory;}}}/>
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          {[['all',`All (${data.length})`],['urgent',`Urgent (${dueThisWeek})`],['unassigned',`Unassigned (${unassigned})`]].map(([f,label])=>(
            <button key={f} onClick={()=>setFilter(f)} style={{padding:'6px 14px',borderRadius:999,border:`1px solid ${filter===f?'transparent':C.border}`,background:filter===f?C.ink:C.ivory,color:filter===f?C.white:C.gray,fontSize:'var(--btn-font-ghost)',cursor:'pointer',fontWeight:500,whiteSpace:'nowrap',transition:'all 0.2s'}}>{label}</button>
          ))}
        </div>
        {staff?.length>0&&(
          <select value={staffFilter} onChange={e=>setStaffFilter(e.target.value)} style={{padding:'7px 14px',borderRadius:8,border:`1px solid ${C.border}`,fontSize:'var(--btn-font-ghost)',background:C.ivory,color:C.ink,outline:'none',cursor:'pointer'}}>
            <option value="">All seamstresses</option>
            {staff.map(s=><option key={s.id||s.name} value={s.name}>{s.name}</option>)}
          </select>
        )}
      </div>

      {selectedJobs.size>0&&(
        <div style={{display:'flex',alignItems:'center',gap:10,padding:'8px 20px',background:C.infoBg,borderBottom:`1px solid ${C.infoBorder}`,flexShrink:0,flexWrap:'wrap'}}>
          <span style={{fontSize:12,fontWeight:500,color:C.blue}}>{selectedJobs.size} job{selectedJobs.size!==1?'s':''} selected</span>
          {staff?.length>0&&(
            <select disabled={bulkWorking} defaultValue=""
              onChange={e=>bulkAssign(e.target.value)}
              style={{padding:'4px 10px',borderRadius:6,border:`1px solid ${C.infoBorder}`,fontSize:12,color:C.blue,background:C.infoBg,cursor:'pointer',minHeight:'unset'}}>
              <option value="" disabled>Assign to seamstress…</option>
              {staff.map(s=><option key={s.id||s.name} value={s.name}>{s.name}</option>)}
            </select>
          )}
          <select disabled={bulkWorking} defaultValue=""
            onChange={e=>bulkMoveStatus(e.target.value)}
            style={{padding:'4px 10px',borderRadius:6,border:`1px solid ${C.infoBorder}`,fontSize:12,color:C.blue,background:C.infoBg,cursor:'pointer',minHeight:'unset'}}>
            <option value="" disabled>Move to status…</option>
            {STATUS_OPTS.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <button onClick={()=>setSelectedJobs(new Set())}
            style={{marginLeft:'auto',background:'none',border:'none',fontSize:12,cursor:'pointer',color:C.gray,minHeight:'unset',minWidth:'unset'}}>
            Clear selection
          </button>
        </div>
      )}

      {/* TIME TRACKING SUMMARY */}
      {(()=>{
        const now=new Date();
        const weekStart=new Date(now);weekStart.setDate(now.getDate()-now.getDay());weekStart.setHours(0,0,0,0);
        const weekEntries=data.flatMap(j=>(j.time_entries||[]).filter(e=>new Date(e.logged_at)>=weekStart));
        const weekMinutes=weekEntries.reduce((s,e)=>s+Number(e.minutes||0),0);
        const weekHours=Math.floor(weekMinutes/60);const weekMins=weekMinutes%60;
        const jobsWithTime=data.filter(j=>(j.total_minutes||0)>0);
        const avgMinutes=jobsWithTime.length?Math.round(jobsWithTime.reduce((s,j)=>s+(j.total_minutes||0),0)/jobsWithTime.length):0;
        const avgH=Math.floor(avgMinutes/60);const avgM=avgMinutes%60;
        if(weekMinutes===0&&jobsWithTime.length===0)return null;
        return (
          <div style={{padding:'10px 20px',background:C.amberBg,borderBottom:'1px solid #FDE68A',flexShrink:0,display:'flex',gap:20,alignItems:'center',flexWrap:'wrap'}}>
            <span style={{fontSize:12,fontWeight:700,color:C.warningText}}>⏱ Time tracking</span>
            {weekMinutes>0&&<span style={{fontSize:12,color:C.warningText}}>This week: <strong>{weekHours>0?`${weekHours}h `:''}${weekMins}m</strong></span>}
            {jobsWithTime.length>0&&<span style={{fontSize:12,color:C.warningText}}>Avg per job: <strong>{avgH>0?`${avgH}h `:''}${avgM}m</strong> across {jobsWithTime.length} tracked job{jobsWithTime.length!==1?'s':''}</span>}
          </div>
        );
      })()}

      {/* MAIN CONTENT AREA: kanban/list + My Jobs sidebar */}
      <div style={{flex:1,display:'flex',overflow:'hidden'}}>

      {view==='kanban'?(
        data.length===0?(
          <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',background:C.ivory}}>
            <EmptyState
              icon="✂️"
              title="No alteration jobs"
              subtitle="Create a new job from an event or use the + button above"
              action={() => setNewJobOpen(true)}
              actionLabel="+ New job"
            />
          </div>
        ):filtered.length===0?(
          <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',background:C.ivory}}>
            <EmptyState
              icon="🔍"
              title="No jobs match your filters"
              subtitle="Try adjusting the search or filter options."
              action={() => { setSearch(''); setFilter('all'); setStaffFilter(''); }}
              actionLabel="Clear filters"
            />
          </div>
        ):(
        <div className="alt-kanban page-scroll" style={{flex:1,display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16,padding:20,overflowX:'auto',overflowY:'hidden',background:C.ivory}}>
          {cols.map(col=>{
            const _today=new Date();_today.setHours(0,0,0,0);
            const jobs=filtered.filter(a=>a.status===col.id).sort((a,b)=>{
              const aD=a.deadline?new Date(a.deadline+'T12:00:00'):null;
              const bD=b.deadline?new Date(b.deadline+'T12:00:00'):null;
              const aOver=aD&&aD<_today;const bOver=bD&&bD<_today;
              if(aOver&&!bOver)return -1;if(!aOver&&bOver)return 1;
              if(aD&&bD)return aD-bD;if(aD)return -1;if(bD)return 1;
              return (a.daysUntil||999)-(b.daysUntil||999);
            });
            // Next status for tap-to-move (only non-cancelled, non-complete final cols)
            const colIdx=STATUS_ORDER.indexOf(col.id);
            const nextStatus=colIdx>=0&&colIdx<STATUS_ORDER.length-1?STATUS_ORDER[colIdx+1]:null;
            const nextLabel=nextStatus?cols.find(c=>c.id===nextStatus)?.label:null;
            return (
              <div key={col.id} style={{display:'flex',flexDirection:'column',height:'100%'}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12,flexShrink:0}}>
                  <div style={{height:10,width:10,borderRadius:5,background:col.color}}/>
                  <span style={{fontSize:13,fontWeight:600,color:C.ink}}>{col.label}</span>
                  <span style={{fontSize:11,fontWeight:600,color:col.color,background:col.bg,padding:'2px 8px',borderRadius:999,marginLeft:'auto'}}>{jobs.length}</span>
                </div>
                <div onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={e=>handleDrop(e,col.id)}
                  style={{flex:1,display:'flex',flexDirection:'column',gap:12,overflowY:'auto',padding:4,minHeight:100,borderRadius:12,transition:'background 0.2s'}}>
                  {jobs.length===0&&(
                    <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',paddingTop:32,paddingBottom:32,color:C.gray}}>
                      <span style={{fontSize:18,marginBottom:6,opacity:0.5}}>✂️</span>
                      <span style={{fontSize:12,color:C.gray}}>No jobs here</span>
                    </div>
                  )}
                  {jobs.map(job=>{
                    const _td=new Date();_td.setHours(0,0,0,0);
                    const dlDate=job.deadline?new Date(job.deadline+'T12:00:00'):null;
                    const dlDiff=dlDate?Math.ceil((dlDate-_td)/86400000):null;
                    const dlOverdue=dlDiff!==null&&dlDiff<0;
                    const dlSoon=dlDiff!==null&&dlDiff<=3;
                    const isCritical=(job.daysUntil<=7||dlOverdue||dlSoon)&&job.status!=='complete';
                    const isNear=(job.daysUntil<=14||(dlDiff!==null&&dlDiff<=7))&&job.status!=='complete';
                    const hasMeas=job.measurements&&Object.entries(job.measurements).some(([k,v])=>k!=='notes'&&v);
                    return (
                      <div key={job.id} draggable onDragStart={e=>handleDragStart(e,job)} onDragEnd={handleDragEnd}
                        style={{background:C.white,border:`1px solid ${isCritical?'var(--color-danger)':isNear?C.dangerBorder:C.border}`,borderLeftWidth:isCritical?4:1,borderRadius:12,padding:'16px',cursor:'grab',flexShrink:0,boxShadow:'0 1px 3px rgba(0,0,0,0.05)',transition:'transform 0.15s, box-shadow 0.15s',touchAction:'none'}}
                        onMouseEnter={e=>{e.currentTarget.style.borderColor=isCritical?'var(--color-danger)':C.rosa;e.currentTarget.style.boxShadow='0 4px 12px rgba(0,0,0,0.08)';e.currentTarget.style.transform='translateY(-2px)';}}
                        onMouseLeave={e=>{e.currentTarget.style.borderColor=isCritical?'var(--color-danger)':isNear?C.dangerBorder:C.border;e.currentTarget.style.boxShadow='0 1px 3px rgba(0,0,0,0.05)';e.currentTarget.style.transform='none';}}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
                          <div style={{display:'flex',alignItems:'center',gap:0,flex:1,minWidth:0}}>
                            <input
                              type="checkbox"
                              checked={selectedJobs.has(job.id)}
                              onChange={e=>toggleJobSelect(job.id,e)}
                              onClick={e=>e.stopPropagation()}
                              style={{marginRight:8,cursor:'pointer',accentColor:'var(--brand-primary, #C9697A)',flexShrink:0}}
                            />
                            <span style={{fontSize:14,fontWeight:600,color:C.ink}}>{job.client||<span style={{color:C.gray,fontStyle:'italic'}}>No client</span>}</span>
                          </div>
                          <span style={{fontSize:11,fontWeight:600,color:isCritical?'var(--text-danger)':job.status==='complete'?'var(--text-success)':C.gray,background:isCritical?'var(--bg-danger)':job.status==='complete'?'var(--bg-success)':C.grayBg,padding:'2px 8px',borderRadius:999}}>
                            {job.status==='complete'?'Done':`${job.daysUntil} days left`}
                          </span>
                        </div>
                        <div style={{fontSize:12,color:C.gray,marginBottom:4}}>
                          <span style={{fontWeight:500,color:C.ink}}>{job.garment}</span>
                          {job.event&&<><br/>{job.event}</>}
                        </div>
                        <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:12}}>
                          {(job.work||[]).map(w=><span key={w} style={{fontSize:10,color:C.gray,background:C.ivory,padding:'2px 6px',borderRadius:4,border:`1px solid ${C.border}`}}>{w}</span>)}
                        </div>
                        {/* Deadline badge */}
                        {job.deadline&&(
                          <div style={{fontSize:11,color:dlOverdue?'var(--color-danger)':dlSoon?'var(--color-warning)':C.gray,background:dlOverdue?'var(--bg-danger)':dlSoon?'var(--bg-warning)':C.grayBg,padding:'3px 8px',borderRadius:6,marginBottom:8,display:'inline-flex',alignItems:'center',gap:4}}>
                            ✂️ {dlOverdue?`${Math.abs(dlDiff)}d overdue`:dlDiff===0?'Due today':`Due in ${dlDiff}d`} · {new Date(job.deadline+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}
                          </div>
                        )}
                        {/* Measurements badge */}
                        {hasMeas&&(
                          <div style={{fontSize:11,color:C.purple,background:C.purplePale,padding:'3px 8px',borderRadius:6,marginBottom:8,display:'inline-flex',alignItems:'center',gap:4}}>
                            📏 Measurements on file
                          </div>
                        )}
                        {/* Before photo thumbnail */}
                        {job.before_image_url&&(
                          <div style={{marginBottom:8}}>
                            <img src={job.before_image_url} alt="Before" style={{width:40,height:40,objectFit:'cover',borderRadius:4,border:`1px solid ${C.border}`,display:'block'}}/>
                          </div>
                        )}
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',paddingTop:12,borderTop:`1px dashed ${C.border}`}}>
                          <div style={{display:'flex',alignItems:'center',gap:6}}>
                            {job.seamstress?(
                              <><Avatar initials={job.seamstress.split(' ').map(n=>n[0]).join('').slice(0,2)} size={24} bg='var(--bg-success)' color='var(--text-success)'/><span style={{fontSize:12,color:C.ink,fontWeight:500}}>{job.seamstress}</span></>
                            ):(
                              <span style={{fontSize:12,color:'var(--text-warning)',fontWeight:500,padding:'2px 6px',background:'var(--bg-warning)',borderRadius:4}}>Unassigned</span>
                            )}
                          </div>
                          <span style={{fontSize:13,fontWeight:600,color:C.ink}}>{job.price?fmt(job.price):''}</span>
                        </div>
                        {logTimeEntry
                          ? <JobTimer job={job} logTimeEntry={logTimeEntry}/>
                          : <LaborCostRow job={job}/>}
                        <div style={{marginTop:10,display:'flex',justifyContent:'space-between',alignItems:'center',gap:6}}>
                          {/* Move to next status button */}
                          {nextStatus&&job.status!=='cancelled'&&(
                            <button onClick={e=>{e.stopPropagation();handleStatusAdvance(job,nextStatus);}}
                              style={{flex:1,background:C.ivory,border:`1px solid ${C.border}`,padding:'5px 8px',color:C.gray,fontSize:10,fontWeight:600,cursor:'pointer',borderRadius:8,textAlign:'left',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',transition:'all 0.15s'}}
                              title={`Move to ${nextLabel}`}
                              onMouseEnter={e=>{e.currentTarget.style.background=C.greenBg;e.currentTarget.style.borderColor='var(--color-success)';e.currentTarget.style.color='var(--color-success)';}}
                              onMouseLeave={e=>{e.currentTarget.style.background=C.ivory;e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.gray;}}>
                              → {nextLabel}
                            </button>
                          )}
                          <button onClick={e=>{e.stopPropagation();setEditJob(job);}}
                            style={{background:C.rosaPale,border:`1px solid ${C.rosaLight||C.border}`,padding:'5px 12px',color:C.rosaText,fontSize:11,fontWeight:600,cursor:'pointer',borderRadius:8,transition:'all 0.15s',flexShrink:0}}
                            onMouseEnter={e=>{e.currentTarget.style.background=C.rosa;e.currentTarget.style.color=C.white;}}
                            onMouseLeave={e=>{e.currentTarget.style.background=C.rosaPale;e.currentTarget.style.color=C.rosaText;}}>
                            ✏️ Edit job
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {!jobs.length&&<div style={{border:`1px dashed ${C.border}`,borderRadius:12,padding:'30px 20px',textAlign:'center',fontSize:13,color:C.gray}}>Drop to {col.label.toLowerCase()}</div>}
                </div>
              </div>
            );
          })}
        </div>
        )
      ):(
        <div className="page-scroll" style={{flex:1,overflowY:'auto',padding:20}}>
          {data.length===0?(
            <EmptyState
              icon="✂️"
              title="No alteration jobs"
              subtitle="Create a new job from an event or use the + button above"
              action={() => setNewJobOpen(true)}
              actionLabel="+ New job"
              style={{margin:'60px auto',maxWidth:480}}
            />
          ):filtered.length===0?(
            <EmptyState
              icon="🔍"
              title="No jobs match your filters"
              subtitle="Try adjusting the search or filter options."
              action={() => { setSearch(''); setFilter('all'); setStaffFilter(''); }}
              actionLabel="Clear filters"
              style={{margin:'40px auto',maxWidth:420}}
            />
          ):(
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              {/* Seamstress productivity panel */}
              {(()=>{
                const totalJobs=filtered.length;
                const totalMins=filtered.reduce((s,j)=>s+(j.total_minutes||0),0);
                const totalH=Math.floor(totalMins/60);
                const totalM=totalMins%60;
                const revenue=filtered.reduce((s,j)=>s+(j.price||0),0);
                const rate=totalMins>0&&revenue>0?(revenue/(totalMins/60)).toFixed(2):null;
                if(totalMins===0&&revenue===0)return null;
                return (
                  <div style={{display:'flex',gap:16,padding:'12px 16px',background:C.amberBg,border:'1px solid #FDE68A',borderRadius:12,flexWrap:'wrap',alignItems:'center',marginBottom:4}}>
                    <span style={{fontSize:12,fontWeight:700,color:C.warningText,flexShrink:0}}>📊 Period summary</span>
                    <span style={{fontSize:12,color:C.warningText}}>Jobs: <strong>{totalJobs}</strong></span>
                    {totalMins>0&&<span style={{fontSize:12,color:C.warningText}}>Hours logged: <strong>{totalH>0?`${totalH}h `:''}{ totalM}m</strong></span>}
                    {revenue>0&&<span style={{fontSize:12,color:C.warningText}}>Revenue: <strong>{fmt(revenue)}</strong></span>}
                    {rate&&<span style={{fontSize:12,color:C.warningText}}>Avg rate: <strong>${rate}/hr</strong></span>}
                  </div>
                );
              })()}
              <div className="alt-list-row" style={{padding:'0 16px 8px',fontSize:12,fontWeight:600,color:C.gray,textTransform:'uppercase',letterSpacing:'0.04em',display:'grid',gridTemplateColumns:'20px 2fr 2fr 1.5fr 1fr 1fr auto',gap:16}}>
                <div/><div>Client / Garment</div><div>Work Items</div><div>Seamstress</div><div>Status</div><div style={{textAlign:'right'}}>Deadline / Price</div><div/>
              </div>
              {filtered.map(a=>{
                const sc=ALT_STATUS_COLS[a.status]||{bg:C.grayBg,col:C.gray};
                const isUrgent=a.daysUntil<=7&&a.status!=='complete';
                const hasMeas=a.measurements&&Object.entries(a.measurements).some(([k,v])=>k!=='notes'&&v);
                return(
                  <div key={a.id} className="alt-list-row"
                    style={{background:C.white,border:`1px solid ${isUrgent?'var(--color-danger)':C.border}`,borderRadius:12,padding:'16px',boxShadow:'0 1px 2px rgba(0,0,0,0.02)',display:'grid',gridTemplateColumns:'20px 2fr 2fr 1.5fr 1fr 1fr auto',gap:16,alignItems:'center',transition:'all 0.15s'}}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor=C.rosa;e.currentTarget.style.boxShadow='0 4px 12px rgba(201,105,122,0.1)';}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor=isUrgent?'var(--color-danger)':C.border;e.currentTarget.style.boxShadow='0 1px 2px rgba(0,0,0,0.02)';}}>
                    <div>
                      <input
                        type="checkbox"
                        checked={selectedJobs.has(a.id)}
                        onChange={e=>toggleJobSelect(a.id,e)}
                        onClick={e=>e.stopPropagation()}
                        style={{cursor:'pointer',accentColor:'var(--brand-primary, #C9697A)'}}
                      />
                    </div>
                    <div style={{minWidth:0}}>
                      <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
                        <span style={{fontSize:14,fontWeight:600,color:C.ink}}>{a.client||'—'}</span>
                        {isUrgent&&<span style={{padding:'2px 6px',borderRadius:999,fontSize:9,fontWeight:600,background:'var(--bg-danger)',color:'var(--text-danger)'}}>Urgent</span>}
                        {hasMeas&&<span style={{padding:'2px 6px',borderRadius:999,fontSize:9,fontWeight:600,background:C.purplePale,color:C.purple}}>📏</span>}
                      </div>
                      <div style={{fontSize:12,color:C.gray,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{a.garment}</div>
                    </div>
                    <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                      {(a.work||[]).map(w=><span key={w} style={{fontSize:11,color:C.gray,background:C.ivory,border:`1px solid ${C.border}`,padding:'3px 8px',borderRadius:6}}>{w}</span>)}
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      {a.seamstress?(<><Avatar initials={a.seamstress.split(' ').map(n=>n[0]).join('').slice(0,2)} size={28} bg='var(--bg-success)' color='var(--text-success)'/><span style={{fontSize:13,fontWeight:500,color:C.ink}}>{a.seamstress}</span></>):(<span style={{fontSize:12,color:'var(--text-warning)',fontWeight:500,background:'var(--bg-warning)',padding:'4px 8px',borderRadius:6}}>Unassigned</span>)}
                    </div>
                    <div><span style={{padding:'4px 10px',borderRadius:999,fontSize:11,fontWeight:600,background:sc.bg,color:sc.col,whiteSpace:'nowrap'}}>{a.status.replace(/_/g,' ')}</span></div>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontSize:14,fontWeight:600,color:isUrgent?'var(--text-danger)':a.status==='complete'?'var(--text-success)':C.ink}}>{a.status==='complete'?'Done':`${a.daysUntil}d`}</div>
                      <div style={{fontSize:13,fontWeight:600,color:'var(--text-success)',marginTop:4}}>{a.price?fmt(a.price):'—'}</div>
                    </div>
                    <div>
                      <button onClick={()=>setEditJob(a)}
                        style={{padding:'6px 12px',background:C.rosaPale,border:'none',borderRadius:8,color:C.rosaText,fontSize:12,fontWeight:600,cursor:'pointer'}}
                        onMouseEnter={e=>{e.currentTarget.style.background=C.rosa;e.currentTarget.style.color=C.white;}}
                        onMouseLeave={e=>{e.currentTarget.style.background=C.rosaPale;e.currentTarget.style.color=C.rosaText;}}>
                        Edit
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <MyJobsSidebar jobs={data} staff={staff||[]} onOpenJob={setEditJob}/>
      </div>{/* end main content flex row */}

      {notifyPrompt&&(
        <div style={{position:'fixed',bottom:24,right:24,zIndex:1100,background:C.white,borderRadius:14,padding:'16px 20px',boxShadow:'0 8px 32px rgba(0,0,0,0.15)',border:`1px solid ${C.border}`,maxWidth:340,display:'flex',flexDirection:'column',gap:10}}>
          <div style={{display:'flex',alignItems:'flex-start',gap:10}}>
            <span style={{fontSize:20}}>✂️</span>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:600,color:C.ink}}>Job marked complete!</div>
              <div style={{fontSize:12,color:C.gray,marginTop:2}}>Notify {notifyPrompt.client||'the client'} that their {notifyPrompt.garment||'alterations'} are ready?</div>
            </div>
            <button onClick={()=>setNotifyPrompt(null)} aria-label="Close" title="Close" style={{background:'none',border:'none',cursor:'pointer',color:C.gray,fontSize:16,lineHeight:1,padding:0,flexShrink:0}}>×</button>
          </div>
          <div style={{background:C.grayBg,borderRadius:8,padding:'8px 10px',fontSize:11,color:C.gray,fontFamily:'monospace',lineHeight:1.5}}>
            {`"Hi! Your ${notifyPrompt.garment||'garment'} alterations are ready for pickup. Please contact us to schedule your appointment. 💕"`}
          </div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={()=>setNotifyPrompt(null)} style={{flex:1,padding:'7px 0',borderRadius:8,border:`1px solid ${C.border}`,background:'transparent',color:C.gray,fontSize:12,cursor:'pointer'}}>Skip</button>
            <button onClick={async()=>{
              const msg=`Hi! Your ${notifyPrompt.garment||'garment'} alterations are ready for pickup. Please contact us to schedule your appointment. 💕`;
              try{await navigator.clipboard.writeText(msg);}catch{}
              if(notifyPrompt.client_id&&boutique?.id){
                await supabase.from('client_interactions').insert({boutique_id:boutique.id,client_id:notifyPrompt.client_id,type:'sms',title:'Alterations ready — pickup notification sent',body:msg,occurred_at:new Date().toISOString(),is_editable:false,author_name:'Staff'});
              }
              toast('Message copied to clipboard ✓');
              setNotifyPrompt(null);
            }} style={{flex:1,padding:'7px 0',borderRadius:8,border:'none',background:C.rosa,color:C.white,fontSize:12,fontWeight:500,cursor:'pointer'}}>📋 Copy SMS</button>
          </div>
        </div>
      )}
      {newJobOpen&&<NewAlterationModal staff={staff||[]} clients={clients||[]} createClient={createClient} onClose={()=>setNewJobOpen(false)}
        onCreate={async p=>{const r=createJob?await createJob(p):{error:{message:'No createJob'}};return r;}}/>}

      {editJob&&<EditAlterationModal job={editJob} staff={staff||[]} clients={clients||[]} onClose={()=>setEditJob(null)}
        onUpdate={async(id,updates)=>{const r=await handleUpdate(id,updates);return r;}}
        onCancel={cancelJob}
        onDelete={deleteJob}/>}
    </div>
  );
};

export default Alterations;
