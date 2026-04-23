import React, { useState, useRef, useCallback, useEffect } from 'react';
import { C } from '../lib/colors';
import { PrimaryBtn, GhostBtn, Badge, inputSt, LBL, useToast } from '../lib/ui.jsx';

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const FLORAL_STYLES = ['Garden','Romantic','Modern','Rustic','Tropical','Minimal'];

const FLORAL_COLORS = [
  {label:'White', hex:'#FFFFFF'},
  {label:'Ivory', hex:'#FFFFF0'},
  {label:'Blush', hex:'#FFB6C1'},
  {label:'Rose', hex:'#FF007F'},
  {label:'Mauve', hex:'#E0B0B0'},
  {label:'Burgundy', hex:'#800020'},
  {label:'Sage', hex:'#9CAF88'},
  {label:'Eucalyptus', hex:'#44A87A'},
  {label:'Dusty Blue', hex:'#7A9CBF'},
  {label:'Lavender', hex:'#B57EDC'},
  {label:'Peach', hex:'#FFCBA4'},
  {label:'Terracotta', hex:'#E2725B'},
  {label:'Gold', hex:'#FFD700'},
  {label:'Black', hex:'#222222'},
];

const ARRANGEMENT_TYPES = [
  {key:'bridal_bouquet',    label:'Bridal Bouquet',           icon:'💐'},
  {key:'bridesmaids_bouquets', label:'Bridesmaids Bouquets',  icon:'💐'},
  {key:'boutonnieres',      label:'Boutonnieres',             icon:'🌹'},
  {key:'flower_girl_petals',label:'Flower Girl Petals',       icon:'🌸'},
  {key:'ceremony_arch',     label:'Ceremony Arch Florals',    icon:'🌿'},
  {key:'aisle_markers',     label:'Aisle Markers / Pew Flowers', icon:'🌼'},
  {key:'centerpieces',      label:'Centerpieces',             icon:'🌺'},
  {key:'cocktail_hour',     label:'Cocktail Hour Pieces',     icon:'🪴'},
  {key:'head_table',        label:'Head Table Garland',       icon:'🌿'},
  {key:'cake_flowers',      label:'Cake Flowers',             icon:'🎂'},
];

const BACKDROP_TYPES = [
  {key:'none',        label:'None',                icon:'⬜'},
  {key:'floral_arch', label:'Floral Arch',         icon:'🌸'},
  {key:'curtain',     label:'Curtain / Draping',   icon:'🪟'},
  {key:'greenery',    label:'Greenery Wall',        icon:'🌿'},
  {key:'balloon',     label:'Balloon Arch',         icon:'🎈'},
  {key:'sequin',      label:'Sequin / Shimmer Wall',icon:'✨'},
  {key:'wooden',      label:'Wooden Frame',         icon:'🪵'},
  {key:'custom',      label:'Custom',               icon:'✏️'},
];

const BACKDROP_PLACEMENTS = ['Ceremony only','Reception only','Both','Photo station'];

const BACKDROP_MATERIALS = ['Florals','Fairy lights','Draping fabric','Greenery','Balloons','Candles'];

const TABLE_SHAPES = ['Round','Rectangular','Mixed','Sweetheart head table'];

const CENTERPIECE_STYLES = ['Tall floral','Low floral','Lanterns','Candles only','Mix of tall & low','Floating candles'];

const LINEN_COLORS = ['White','Ivory','Blush','Champagne','Sage','Navy','Black','Custom'];
const LINEN_STYLES = ['Satin','Chiffon','Lace','Sequin','Burlap','Polyester'];
const NAPKIN_FOLDS = ['Classic','Fan','Pocket','Rose'];

const TABLE_NUMBERS = ['Standing frames','Mirror','Acrylic','Wooden','Floral','None'];

const PLACE_SETTINGS = ['Charger plates','China rental','Glassware','Custom napkin rings'];

const LIGHTING_OPTIONS = [
  {key:'string_lights',    label:'String / bistro lights',     detail:'Coverage area'},
  {key:'uplighting',       label:'Uplighting',                 detail:'Color + qty'},
  {key:'candlelight',      label:'Candlelight',                detail:'Candle type (pillar/votive/taper) + qty'},
  {key:'spotlights',       label:'Spotlights / pin spots',     detail:"What's spotlit"},
  {key:'monogram',         label:'Monogram / gobo light',      detail:'Initials/design'},
  {key:'dance_floor',      label:'Dance floor lighting',       detail:'Type'},
  {key:'chandeliers',      label:'Chandeliers / hanging lights',detail:'Description'},
];

const DECO_CATEGORIES = ['arch','centerpiece','linen','lighting','chair','ceremony'];

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function SectionHeader({label}) {
  return (
    <div style={{fontSize:10,color:C.gray,textTransform:'uppercase',letterSpacing:'0.08em',fontWeight:600,marginBottom:10,marginTop:18}}>
      {label}
    </div>
  );
}

function PillSelector({options, value, onChange, multi=false}) {
  return (
    <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
      {options.map(opt => {
        const val = typeof opt === 'string' ? opt : opt.key || opt;
        const lbl = typeof opt === 'string' ? opt : opt.label || opt;
        const active = multi ? (value||[]).includes(val) : value===val;
        return (
          <button
            key={val}
            onClick={()=>{
              if(multi){
                const cur = value||[];
                onChange(active ? cur.filter(v=>v!==val) : [...cur,val]);
              } else {
                onChange(active ? '' : val);
              }
            }}
            style={{
              padding:'5px 12px',
              borderRadius:20,
              border:`1.5px solid ${active?C.rosa:C.border}`,
              background:active?C.rosaPale:C.white,
              color:active?C.rosaText:C.gray,
              fontSize:12,
              fontWeight:active?600:400,
              cursor:'pointer',
              transition:'all .15s',
            }}
          >{lbl}</button>
        );
      })}
    </div>
  );
}

function ToggleCard({label, active, onToggle, children}) {
  return (
    <div style={{
      border:`1.5px solid ${active?C.rosa:C.border}`,
      borderRadius:10,
      background:C.white,
      boxShadow:active?'0 2px 8px rgba(201,105,122,0.10)':'none',
      marginBottom:8,
      overflow:'hidden',
      transition:'border-color .15s',
    }}>
      <div
        style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',cursor:'pointer',userSelect:'none'}}
        onClick={onToggle}
      >
        <div style={{
          width:18,height:18,borderRadius:4,
          border:`2px solid ${active?C.rosa:C.borderDark}`,
          background:active?C.rosa:'transparent',
          display:'flex',alignItems:'center',justifyContent:'center',
          flexShrink:0,transition:'all .15s',
        }}>
          {active&&<span style={{color:'#fff',fontSize:11,lineHeight:1,fontWeight:700}}>✓</span>}
        </div>
        <span style={{fontSize:13,fontWeight:active?600:400,color:active?C.ink:C.gray}}>{label}</span>
      </div>
      {active&&children&&(
        <div style={{padding:'0 14px 12px 42px'}}>{children}</div>
      )}
    </div>
  );
}

function ColorCircle({color, selected, onToggle}) {
  const isDark = ['#222222','#800020'].includes(color.hex);
  return (
    <div
      title={color.label}
      onClick={onToggle}
      style={{
        width:28,height:28,borderRadius:'50%',
        background:color.hex,
        border:selected?`2.5px solid ${C.rosa}`:`1.5px solid ${color.hex==='#FFFFFF'||color.hex==='#FFFFF0'?C.border:color.hex}`,
        cursor:'pointer',
        boxShadow:selected?`0 0 0 2px ${C.rosaPale}`:'none',
        transition:'transform .12s',
        transform:selected?'scale(1.18)':'scale(1)',
        flexShrink:0,
      }}
    />
  );
}

// ─── TABS ─────────────────────────────────────────────────────────────────────

const TABS = [
  {key:'florals',   label:'🌸 Florals'},
  {key:'backdrop',  label:'🏛 Backdrop & Arch'},
  {key:'tables',    label:'🍽 Tables'},
  {key:'lighting',  label:'💡 Lighting'},
  {key:'inventory', label:'📦 Inventory'},
  {key:'overview',  label:'📋 Overview'},
];

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export default function DecorationPlanner({event, updateEvent, addDecoItem, removeDecoItem, updateDecoItem, inventory=[], refetch}) {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('florals');

  // decoration_plan state — initialised from event
  const [plan, setPlan] = useState(() => event?.decoration_plan || {});
  const saveTimer = useRef(null);
  const [savedIndicator, setSavedIndicator] = useState(false);

  // Sync plan when event changes (e.g. refetch)
  useEffect(() => {
    if (event?.decoration_plan) {
      setPlan(prev => {
        // Only sync if the server data differs from what we have
        // (shallow compare via JSON to avoid overwriting in-flight changes)
        const server = JSON.stringify(event.decoration_plan);
        const current = JSON.stringify(prev);
        return server !== current && !saveTimer.current ? event.decoration_plan : prev;
      });
    }
  }, [event?.decoration_plan]);

  // Auto-save with 600ms debounce
  const updatePlan = useCallback((updater) => {
    setPlan(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        saveTimer.current = null;
        const { error } = await updateEvent(event.id, { decoration_plan: next });
        if (!error) {
          setSavedIndicator(true);
          setTimeout(() => setSavedIndicator(false), 2000);
        }
      }, 600);
      return next;
    });
  }, [event?.id, updateEvent]);

  // ── Inventory assignment state (was in EventDetail) ──────────────────────
  const [decoSearch, setDecoSearch] = useState('');
  const [showAssignDeco, setShowAssignDeco] = useState(false);
  const [editingDecoId, setEditingDecoId] = useState(null);
  const [decoForm, setDecoForm] = useState({inventoryId:'',quantity:'1',notes:'',setup_time:'',placement:'',color_notes:''});
  const [saving, setSaving] = useState(false);

  const decoItems = event?.event_inventory || [];

  const resetDecoModal = () => {
    setShowAssignDeco(false);
    setEditingDecoId(null);
    setDecoForm({inventoryId:'',quantity:'1',notes:'',setup_time:'',placement:'',color_notes:''});
    setDecoSearch('');
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const p = (key, def) => plan[key] ?? def;
  const set = (key, val) => updatePlan(prev => ({...prev, [key]: val}));
  const setNested = (section, key, val) => updatePlan(prev => ({...prev, [section]: {...(prev[section]||{}), [key]: val}}));

  // ─── TAB: FLORALS ────────────────────────────────────────────────────────
  const floral = plan.floral || {};
  const setFloral = (k,v) => updatePlan(prev => ({...prev, floral: {...(prev.floral||{}), [k]: v}}));

  const arrangements = floral.arrangements || {};
  const setArrangement = (key, field, val) => {
    updatePlan(prev => {
      const cur = prev.floral?.arrangements?.[key] || {};
      return {
        ...prev,
        floral: {
          ...(prev.floral||{}),
          arrangements: {
            ...(prev.floral?.arrangements||{}),
            [key]: {...cur, [field]: val},
          },
        },
      };
    });
  };

  // ─── TAB: BACKDROP ───────────────────────────────────────────────────────
  const backdrop = plan.backdrop || {};
  const setBackdrop = (k,v) => updatePlan(prev => ({...prev, backdrop: {...(prev.backdrop||{}), [k]: v}}));

  // ─── TAB: TABLES ─────────────────────────────────────────────────────────
  const tables = plan.tables || {};
  const setTables = (k,v) => updatePlan(prev => ({...prev, tables: {...(prev.tables||{}), [k]: v}}));
  const setLinens = (type,k,v) => updatePlan(prev => ({
    ...prev,
    tables: {
      ...(prev.tables||{}),
      linens: {
        ...(prev.tables?.linens||{}),
        [type]: {...(prev.tables?.linens?.[type]||{}), [k]: v},
      },
    },
  }));

  // ─── TAB: LIGHTING ───────────────────────────────────────────────────────
  const lighting = plan.lighting || {};
  const setLighting = (k,v) => updatePlan(prev => ({...prev, lighting: {...(prev.lighting||{}), [k]: v}}));
  const setLightingOption = (key, field, val) => updatePlan(prev => ({
    ...prev,
    lighting: {
      ...(prev.lighting||{}),
      options: {
        ...(prev.lighting?.options||{}),
        [key]: {...(prev.lighting?.options?.[key]||{}), [field]: val},
      },
    },
  }));

  // ─── RENDER ──────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Tab bar */}
      <div style={{display:'flex',gap:4,overflowX:'auto',paddingBottom:2,marginBottom:16,scrollbarWidth:'none',WebkitOverflowScrolling:'touch'}}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={()=>setActiveTab(tab.key)}
            style={{
              padding:'6px 14px',
              borderRadius:20,
              border:`1.5px solid ${activeTab===tab.key?C.rosa:C.border}`,
              background:activeTab===tab.key?C.rosaPale:C.white,
              color:activeTab===tab.key?C.rosaText:C.gray,
              fontSize:12,
              fontWeight:activeTab===tab.key?600:400,
              cursor:'pointer',
              whiteSpace:'nowrap',
              flexShrink:0,
              transition:'all .15s',
            }}
          >{tab.label}</button>
        ))}
        {savedIndicator && (
          <span style={{marginLeft:'auto',fontSize:11,color:C.green,alignSelf:'center',flexShrink:0,fontWeight:500}}>Saved ✓</span>
        )}
      </div>

      {/* ── FLORALS TAB ──────────────────────────────────────────────────── */}
      {activeTab==='florals'&&(
        <div style={{display:'flex',flexDirection:'column',gap:0}}>
          <SectionHeader label="Floral Style"/>
          <PillSelector
            options={FLORAL_STYLES}
            value={floral.style||''}
            onChange={v=>setFloral('style',v)}
          />

          <SectionHeader label="Color Palette"/>
          <div style={{display:'flex',flexWrap:'wrap',gap:8,alignItems:'center'}}>
            {FLORAL_COLORS.map(c=>(
              <ColorCircle
                key={c.label}
                color={c}
                selected={(floral.colors||[]).includes(c.label)}
                onToggle={()=>{
                  const cur = floral.colors||[];
                  setFloral('colors', cur.includes(c.label)?cur.filter(x=>x!==c.label):[...cur,c.label]);
                }}
              />
            ))}
          </div>
          {(floral.colors||[]).length>0&&(
            <div style={{marginTop:6,fontSize:11,color:C.gray}}>{(floral.colors||[]).join(' · ')}</div>
          )}

          <SectionHeader label="Arrangements"/>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {ARRANGEMENT_TYPES.map(({key,label,icon})=>{
              const arr = arrangements[key]||{};
              const qty = arr.qty ?? 0;
              return (
                <div key={key} style={{display:'flex',alignItems:'flex-start',gap:10,padding:'8px 10px',borderRadius:8,border:`1px solid ${qty>0?C.rosa:C.border}`,background:qty>0?C.rosaPale:C.white}}>
                  <span style={{fontSize:16,flexShrink:0,marginTop:1}}>{icon}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12,fontWeight:500,color:C.ink,marginBottom:4}}>{label}</div>
                    <div style={{display:'flex',gap:8,alignItems:'center'}}>
                      <input
                        type="number"
                        min="0"
                        value={qty}
                        onChange={e=>setArrangement(key,'qty',Number(e.target.value))}
                        style={{...inputSt,width:60,padding:'4px 8px',fontSize:12}}
                      />
                      {qty>0&&(
                        <input
                          value={arr.notes||''}
                          onChange={e=>setArrangement(key,'notes',e.target.value)}
                          placeholder="Notes…"
                          style={{...inputSt,flex:1,padding:'4px 8px',fontSize:12}}
                        />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <SectionHeader label="Floral Vendor"/>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <div>
              <label htmlFor="deco-vendor-name" style={LBL}>Vendor Name</label>
              <input id="deco-vendor-name" value={floral.vendorName||''} onChange={e=>setFloral('vendorName',e.target.value)} placeholder="Vendor name" style={{...inputSt}}/>
            </div>
            <div>
              <label htmlFor="deco-vendor-phone" style={LBL}>Phone</label>
              <input id="deco-vendor-phone" value={floral.vendorPhone||''} onChange={e=>setFloral('vendorPhone',e.target.value)} placeholder="Phone number" style={{...inputSt}}/>
            </div>
          </div>

          <SectionHeader label="Floral Notes"/>
          <textarea
            value={floral.notes||''}
            onChange={e=>setFloral('notes',e.target.value)}
            placeholder="General notes about florals, timing, special requests…"
            rows={3}
            style={{...inputSt,resize:'vertical'}}
          />
        </div>
      )}

      {/* ── BACKDROP & ARCH TAB ──────────────────────────────────────────── */}
      {activeTab==='backdrop'&&(
        <div style={{display:'flex',flexDirection:'column',gap:0}}>
          <SectionHeader label="Backdrop Type"/>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))',gap:8,marginBottom:8}}>
            {BACKDROP_TYPES.map(({key,label,icon})=>(
              <div
                key={key}
                onClick={()=>setBackdrop('type', backdrop.type===key?'':key)}
                style={{
                  padding:'12px 8px',
                  borderRadius:10,
                  border:`2px solid ${backdrop.type===key?C.rosa:C.border}`,
                  background:backdrop.type===key?C.rosaPale:C.white,
                  cursor:'pointer',
                  textAlign:'center',
                  transition:'all .15s',
                  boxShadow:backdrop.type===key?'0 2px 8px rgba(201,105,122,0.12)':'none',
                }}
              >
                <div style={{fontSize:22,marginBottom:4}}>{icon}</div>
                <div style={{fontSize:11,fontWeight:backdrop.type===key?600:400,color:backdrop.type===key?C.rosaText:C.gray}}>{label}</div>
              </div>
            ))}
          </div>
          {backdrop.type==='custom'&&(
            <input
              value={backdrop.customType||''}
              onChange={e=>setBackdrop('customType',e.target.value)}
              placeholder="Describe custom backdrop…"
              style={{...inputSt,marginBottom:8}}
            />
          )}

          <SectionHeader label="Placement"/>
          <PillSelector options={BACKDROP_PLACEMENTS} value={backdrop.placement||''} onChange={v=>setBackdrop('placement',v)}/>

          <SectionHeader label="Size"/>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <div>
              <label htmlFor="deco-backdrop-width" style={LBL}>Width</label>
              <input id="deco-backdrop-width" value={backdrop.width||''} onChange={e=>setBackdrop('width',e.target.value)} placeholder="e.g. 8ft" style={{...inputSt}}/>
            </div>
            <div>
              <label htmlFor="deco-backdrop-height" style={LBL}>Height</label>
              <input id="deco-backdrop-height" value={backdrop.height||''} onChange={e=>setBackdrop('height',e.target.value)} placeholder="e.g. 8ft" style={{...inputSt}}/>
            </div>
          </div>

          <SectionHeader label="Materials & Details"/>
          <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:8}}>
            {BACKDROP_MATERIALS.map(m=>{
              const active = (backdrop.materials||[]).includes(m);
              return (
                <button
                  key={m}
                  onClick={()=>{
                    const cur=backdrop.materials||[];
                    setBackdrop('materials',active?cur.filter(x=>x!==m):[...cur,m]);
                  }}
                  style={{
                    padding:'5px 12px',borderRadius:20,
                    border:`1.5px solid ${active?C.rosa:C.border}`,
                    background:active?C.rosaPale:C.white,
                    color:active?C.rosaText:C.gray,
                    fontSize:12,fontWeight:active?600:400,cursor:'pointer',
                  }}
                >{m}</button>
              );
            })}
          </div>
          <div>
            <label htmlFor="deco-backdrop-material" style={LBL}>Color / Fabric Notes</label>
            <input id="deco-backdrop-material" value={backdrop.materialNotes||''} onChange={e=>setBackdrop('materialNotes',e.target.value)} placeholder="e.g. Blush chiffon draping with gold fairy lights" style={{...inputSt}}/>
          </div>

          <SectionHeader label="Photo Backdrop"/>
          <ToggleCard
            label="Separate photo backdrop?"
            active={!!backdrop.photoBackdrop}
            onToggle={()=>setBackdrop('photoBackdrop',!backdrop.photoBackdrop)}
          >
            <div style={{display:'flex',flexDirection:'column',gap:8,marginTop:4}}>
              <div>
                <div id="deco-photo-type-label" style={LBL}>Type</div>
                <PillSelector
                  options={BACKDROP_TYPES.filter(b=>b.key!=='none')}
                  value={backdrop.photoType||''}
                  onChange={v=>setBackdrop('photoType',v)}
                />
              </div>
              <div>
                <label htmlFor="deco-photo-notes" style={LBL}>Materials / Notes</label>
                <input id="deco-photo-notes" value={backdrop.photoNotes||''} onChange={e=>setBackdrop('photoNotes',e.target.value)} placeholder="Details…" style={{...inputSt}}/>
              </div>
            </div>
          </ToggleCard>

          <SectionHeader label="Notes"/>
          <textarea value={backdrop.notes||''} onChange={e=>setBackdrop('notes',e.target.value)} placeholder="Additional notes about backdrop or arch…" rows={3} style={{...inputSt,resize:'vertical'}}/>
        </div>
      )}

      {/* ── TABLES TAB ───────────────────────────────────────────────────── */}
      {activeTab==='tables'&&(
        <div style={{display:'flex',flexDirection:'column',gap:0}}>
          <SectionHeader label="Table Count"/>
          <input
            type="number"
            min="0"
            value={tables.count||''}
            onChange={e=>setTables('count',e.target.value)}
            placeholder="Number of tables"
            style={{...inputSt,maxWidth:140}}
          />

          <SectionHeader label="Table Shape"/>
          <PillSelector options={TABLE_SHAPES} value={tables.shape||''} onChange={v=>setTables('shape',v)}/>

          <SectionHeader label="Head Table"/>
          <div style={{display:'flex',gap:8}}>
            {['Sweetheart table for 2','Long head table for bridal party'].map(opt=>{
              const active=tables.headTable===opt;
              return (
                <button key={opt} onClick={()=>setTables('headTable',active?'':opt)} style={{
                  padding:'6px 14px',borderRadius:20,
                  border:`1.5px solid ${active?C.rosa:C.border}`,
                  background:active?C.rosaPale:C.white,
                  color:active?C.rosaText:C.gray,
                  fontSize:12,fontWeight:active?600:400,cursor:'pointer',
                }}>{opt}</button>
              );
            })}
          </div>

          <SectionHeader label="Centerpieces"/>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            <div>
              <div id="deco-cp-style-label" style={LBL}>Style</div>
              <PillSelector options={CENTERPIECE_STYLES} value={tables.cpStyle||''} onChange={v=>setTables('cpStyle',v)}/>
            </div>
            <div>
              <label htmlFor="deco-cp-notes" style={LBL}>Notes</label>
              <input id="deco-cp-notes" value={tables.cpNotes||''} onChange={e=>setTables('cpNotes',e.target.value)} placeholder="Centerpiece details…" style={{...inputSt}}/>
            </div>
          </div>

          <SectionHeader label="Linens — Guest Tables"/>
          <LinensSection values={tables.linens?.guest||{}} onChange={(k,v)=>setLinens('guest',k,v)}/>

          <SectionHeader label="Linens — Head Table"/>
          <LinensSection values={tables.linens?.head||{}} onChange={(k,v)=>setLinens('head',k,v)}/>

          <SectionHeader label="Place Settings"/>
          <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
            {PLACE_SETTINGS.map(ps=>{
              const active=(tables.placeSettings||[]).includes(ps);
              return (
                <button key={ps} onClick={()=>{
                  const cur=tables.placeSettings||[];
                  setTables('placeSettings',active?cur.filter(x=>x!==ps):[...cur,ps]);
                }} style={{
                  padding:'5px 12px',borderRadius:20,
                  border:`1.5px solid ${active?C.rosa:C.border}`,
                  background:active?C.rosaPale:C.white,
                  color:active?C.rosaText:C.gray,
                  fontSize:12,fontWeight:active?600:400,cursor:'pointer',
                }}>{ps}</button>
              );
            })}
          </div>

          <SectionHeader label="Table Numbers"/>
          <PillSelector options={TABLE_NUMBERS} value={tables.tableNumbers||''} onChange={v=>setTables('tableNumbers',v)}/>

          <SectionHeader label="Notes"/>
          <textarea value={tables.notes||''} onChange={e=>setTables('notes',e.target.value)} placeholder="Additional notes about tables, seating layout, etc." rows={3} style={{...inputSt,resize:'vertical'}}/>
        </div>
      )}

      {/* ── LIGHTING TAB ─────────────────────────────────────────────────── */}
      {activeTab==='lighting'&&(
        <div style={{display:'flex',flexDirection:'column',gap:0}}>
          <SectionHeader label="Lighting Options"/>
          {LIGHTING_OPTIONS.map(({key,label,detail})=>{
            const opt = lighting.options?.[key]||{};
            return (
              <ToggleCard
                key={key}
                label={label}
                active={!!opt.enabled}
                onToggle={()=>setLightingOption(key,'enabled',!opt.enabled)}
              >
                <div>
                  <label htmlFor={`lighting-${key}`} style={LBL}>{detail}</label>
                  <input
                    id={`lighting-${key}`}
                    value={opt.detail||''}
                    onChange={e=>setLightingOption(key,'detail',e.target.value)}
                    placeholder={detail+'…'}
                    style={{...inputSt,fontSize:12,padding:'5px 10px'}}
                  />
                </div>
              </ToggleCard>
            );
          })}

          <SectionHeader label="Generator"/>
          <div style={{display:'flex',gap:8}}>
            {['Yes','No'].map(opt=>{
              const active=lighting.generator===opt;
              return (
                <button key={opt} onClick={()=>setLighting('generator',active?'':opt)} style={{
                  padding:'6px 14px',borderRadius:20,
                  border:`1.5px solid ${active?C.rosa:C.border}`,
                  background:active?C.rosaPale:C.white,
                  color:active?C.rosaText:C.gray,
                  fontSize:12,fontWeight:active?600:400,cursor:'pointer',
                }}>{opt}</button>
              );
            })}
          </div>

          <SectionHeader label="Lighting Vendor"/>
          <input value={lighting.vendor||''} onChange={e=>setLighting('vendor',e.target.value)} placeholder="Vendor name" style={{...inputSt}}/>

          <SectionHeader label="Notes"/>
          <textarea value={lighting.notes||''} onChange={e=>setLighting('notes',e.target.value)} placeholder="Additional lighting notes…" rows={3} style={{...inputSt,resize:'vertical'}}/>
        </div>
      )}

      {/* ── INVENTORY TAB ────────────────────────────────────────────────── */}
      {activeTab==='inventory'&&(
        <InventoryTab
          decoItems={decoItems}
          inventory={inventory}
          event={event}
          onAssign={()=>{
            setEditingDecoId(null);
            setDecoForm({inventoryId:'',quantity:'1',notes:'',setup_time:'',placement:'',color_notes:''});
            setDecoSearch('');
            setShowAssignDeco(true);
          }}
          onEdit={(d)=>{
            setEditingDecoId(d.id);
            setDecoForm({inventoryId:d.inventory_id,quantity:String(d.qty),notes:d.notes||'',setup_time:d.setup_time||'',placement:d.placement||'',color_notes:d.color_notes||''});
            setDecoSearch(d.name);
            setShowAssignDeco(true);
          }}
          onRemove={removeDecoItem}
        />
      )}

      {/* ── OVERVIEW TAB ─────────────────────────────────────────────────── */}
      {activeTab==='overview'&&(
        <OverviewTab plan={plan} decoItems={decoItems} event={event}/>
      )}

      {/* ── ASSIGN DECO MODAL ────────────────────────────────────────────── */}
      {showAssignDeco&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}}>
          <div style={{background:C.white,borderRadius:16,width:500,maxHeight:'90vh',display:'flex',flexDirection:'column',overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,0.15)'}}>
            <div style={{padding:'18px 20px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontWeight:600,fontSize:15,color:C.ink}}>{editingDecoId?'Edit decoration item':'Assign decoration item'}</span>
              <button onClick={resetDecoModal} style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:C.gray,lineHeight:1}} aria-label="Close"><span aria-hidden="true">×</span></button>
            </div>
            <div style={{flex:1,overflowY:'auto',padding:20,display:'flex',flexDirection:'column',gap:14}}>
              {/* Item search */}
              <div>
                <label htmlFor="deco-form-item" style={LBL}>{editingDecoId?'Item':'Search inventory'}</label>
                <input
                  id="deco-form-item"
                  value={decoSearch}
                  onChange={e=>{if(editingDecoId)return;setDecoSearch(e.target.value);setDecoForm(f=>({...f,inventoryId:''}));}}
                  placeholder="Search by name or SKU…"
                  readOnly={!!editingDecoId}
                  style={{...inputSt,background:editingDecoId?C.ivory:C.white,cursor:editingDecoId?'default':'text'}}
                />
                {!editingDecoId&&decoSearch.length>0&&(()=>{
                  const q=decoSearch.toLowerCase();
                  const hits=(inventory||[])
                    .filter(d=>DECO_CATEGORIES.includes(d.category)&&(d.name+' '+(d.sku||'')).toLowerCase().includes(q))
                    .slice(0,8);
                  if(!hits.length){
                    // fallback: show all matching regardless of category
                    const all=(inventory||[]).filter(d=>(d.name+' '+(d.sku||'')).toLowerCase().includes(q)).slice(0,8);
                    if(!all.length) return <div style={{fontSize:12,color:C.gray,marginTop:6}}>No items found</div>;
                    return renderHits(all, decoForm, setDecoForm, setDecoSearch);
                  }
                  return renderHits(hits, decoForm, setDecoForm, setDecoSearch);
                })()}
              </div>

              {/* Qty + Setup time */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div>
                  <label htmlFor="deco-form-qty" style={LBL}>Quantity</label>
                  <input id="deco-form-qty" type="number" min="1" value={decoForm.quantity} onChange={e=>setDecoForm(f=>({...f,quantity:e.target.value}))} style={{...inputSt}}/>
                </div>
                <div>
                  <label htmlFor="deco-form-setup" style={LBL}>Setup time</label>
                  <input id="deco-form-setup" value={decoForm.setup_time} onChange={e=>setDecoForm(f=>({...f,setup_time:e.target.value}))} placeholder="e.g. 2:00 PM" style={{...inputSt}}/>
                </div>
              </div>

              {/* Placement */}
              <div>
                <label htmlFor="deco-form-placement" style={LBL}>Placement / location in venue</label>
                <input id="deco-form-placement" value={decoForm.placement} onChange={e=>setDecoForm(f=>({...f,placement:e.target.value}))} placeholder="e.g. Ceremony arch backdrop, center aisle" style={{...inputSt}}/>
              </div>

              {/* Color notes */}
              <div>
                <label htmlFor="deco-form-colornotes" style={LBL}>Color / style notes</label>
                <input id="deco-form-colornotes" value={decoForm.color_notes} onChange={e=>setDecoForm(f=>({...f,color_notes:e.target.value}))} placeholder="e.g. Dusty rose ribbons, gold accents" style={{...inputSt}}/>
              </div>

              {/* General notes */}
              <div>
                <label htmlFor="deco-form-addnotes" style={LBL}>Additional notes</label>
                <textarea id="deco-form-addnotes" value={decoForm.notes} onChange={e=>setDecoForm(f=>({...f,notes:e.target.value}))} placeholder="Any special handling, setup instructions, or reminders…" rows={2} style={{...inputSt,resize:'vertical'}}/>
              </div>
            </div>
            <div style={{padding:'12px 20px',borderTop:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <GhostBtn label="Cancel" colorScheme="danger" onClick={resetDecoModal}/>
              <PrimaryBtn
                label={saving?'Saving…':editingDecoId?'Save changes':'Assign item'}
                colorScheme="success"
                onClick={async()=>{
                  if(!editingDecoId&&!decoForm.inventoryId){toast('Select an item first','warn');return;}
                  setSaving(true);
                  let error;
                  if(editingDecoId){
                    ({error}=await updateDecoItem(editingDecoId,{quantity:Number(decoForm.quantity)||1,notes:decoForm.notes||null,setup_time:decoForm.setup_time||null,placement:decoForm.placement||null,color_notes:decoForm.color_notes||null}));
                  } else {
                    ({error}=await addDecoItem(decoForm.inventoryId,Number(decoForm.quantity)||1,decoForm.notes||null));
                    if(!error&&(decoForm.setup_time||decoForm.placement||decoForm.color_notes)){
                      // Re-fetch happens inside addDecoItem; patch the new row
                      if(refetch) await refetch();
                      const newRow=event?.event_inventory?.find?.(ei=>ei.inventory_id===decoForm.inventoryId);
                      if(newRow?.id){await updateDecoItem(newRow.id,{quantity:Number(decoForm.quantity)||1,notes:decoForm.notes||null,setup_time:decoForm.setup_time||null,placement:decoForm.placement||null,color_notes:decoForm.color_notes||null});}
                    }
                  }
                  setSaving(false);
                  if(error){toast('Failed to save','warn');return;}
                  resetDecoModal();
                  toast(editingDecoId?'Item updated ✓':'Item assigned ✓');
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── LINENS SECTION ──────────────────────────────────────────────────────────

function LinensSection({values, onChange}) {
  return (
    <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:4}}>
      <div>
        <div id="linen-color-label" style={LBL}>Linen Color</div>
        <div style={{display:'flex',flexWrap:'wrap',gap:4,marginBottom:4}}>
          {LINEN_COLORS.map(c=>{
            const active=values.color===c;
            return <button key={c} onClick={()=>onChange('color',active?'':c)} style={{padding:'3px 10px',borderRadius:20,border:`1.5px solid ${active?C.rosa:C.border}`,background:active?C.rosaPale:C.white,color:active?C.rosaText:C.gray,fontSize:11,cursor:'pointer',fontWeight:active?600:400}}>{c}</button>;
          })}
        </div>
        {values.color==='Custom'&&<input value={values.colorCustom||''} onChange={e=>onChange('colorCustom',e.target.value)} placeholder="Custom color…" style={{...inputSt,fontSize:12,padding:'4px 8px'}}/>}
      </div>
      <div>
        <div id="linen-style-label" style={LBL}>Style</div>
        <PillSelector options={LINEN_STYLES} value={values.style||''} onChange={v=>onChange('style',v)}/>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
        <div>
          <label htmlFor="linen-overlay" style={LBL}>Overlay</label>
          <input id="linen-overlay" value={values.overlay||''} onChange={e=>onChange('overlay',e.target.value)} placeholder="e.g. Lace overlay" style={{...inputSt}}/>
        </div>
        <div>
          <label htmlFor="linen-napkin-color" style={LBL}>Napkin Color</label>
          <input id="linen-napkin-color" value={values.napkinColor||''} onChange={e=>onChange('napkinColor',e.target.value)} placeholder="e.g. Ivory" style={{...inputSt}}/>
        </div>
      </div>
      <div>
        <div id="linen-napkin-fold-label" style={LBL}>Napkin Fold</div>
        <PillSelector options={NAPKIN_FOLDS} value={values.napkinFold||''} onChange={v=>onChange('napkinFold',v)}/>
      </div>
    </div>
  );
}

// ─── INVENTORY TAB ───────────────────────────────────────────────────────────

function InventoryTab({decoItems, inventory, event, onAssign, onEdit, onRemove}) {
  const toast = useToast();
  // Group by category_tag or inventory category
  const grouped = {};
  decoItems.forEach(d => {
    const tag = d.category_tag || d.category || 'other';
    if (!grouped[tag]) grouped[tag] = [];
    grouped[tag].push(d);
  });
  const groupKeys = Object.keys(grouped);

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
        <div style={{fontSize:12,color:C.gray}}>
          {decoItems.length>0
            ? `${decoItems.reduce((s,d)=>s+d.qty,0)} items assigned`
            : 'No items assigned yet'}
          {decoItems.some(d=>d.available<d.qty)&&(
            <span style={{color:C.amber,marginLeft:8}}>⚠️ {decoItems.filter(d=>d.available<d.qty).length} shortfall{decoItems.filter(d=>d.available<d.qty).length!==1?'s':''}</span>
          )}
        </div>
        <button
          onClick={onAssign}
          style={{padding:'6px 14px',borderRadius:20,border:`1.5px solid ${C.rosa}`,background:C.rosaPale,color:C.rosaText,fontSize:12,fontWeight:600,cursor:'pointer'}}
        >+ Assign item</button>
      </div>

      {decoItems.length===0?(
        <div style={{padding:'32px 16px',textAlign:'center',fontSize:12,color:C.gray,border:`1px dashed ${C.border}`,borderRadius:10}}>
          No inventory items assigned yet.<br/>Click <strong>+ Assign item</strong> to add decoration items from your inventory.
        </div>
      ):(
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          {groupKeys.map(tag=>(
            <div key={tag}>
              {groupKeys.length>1&&(
                <div style={{fontSize:10,color:C.gray,textTransform:'uppercase',letterSpacing:'0.07em',fontWeight:600,marginBottom:6}}>
                  {tag.replace(/_/g,' ')}
                </div>
              )}
              {grouped[tag].map((d,i)=>{
                const short = d.qty - (d.available??d.qty);
                const catLabel = d.category?d.category.replace(/_/g,' '):'';
                return (
                  <div key={d.id} style={{border:`1px solid ${C.border}`,borderRadius:8,overflow:'hidden'}}>
                    <div style={{padding:'10px 14px',display:'flex',alignItems:'flex-start',gap:10}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                          <span style={{fontSize:13,fontWeight:600,color:C.ink}}>{d.name}</span>
                          {catLabel&&<span style={{fontSize:10,padding:'1px 6px',borderRadius:4,background:C.ivory,color:C.gray,border:`1px solid ${C.border}`,textTransform:'capitalize'}}>{catLabel}</span>}
                          {d.color&&<span style={{fontSize:10,padding:'1px 6px',borderRadius:4,background:C.rosaPale,color:C.rosaText,border:`1px solid ${C.border}`}}>{d.color}</span>}
                          {d.condition&&d.condition!=='good'&&<span style={{fontSize:10,padding:'1px 6px',borderRadius:4,background:C.amberBg,color:C.warningText,border:`1px solid ${C.border}`,textTransform:'capitalize'}}>{d.condition}</span>}
                        </div>
                        <div style={{fontSize:10,color:C.gray,fontFamily:'monospace',marginTop:2}}>#{d.sku}{d.totalQty!=null?` · stock: ${d.totalQty}`:''}</div>
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:6,flexShrink:0}}>
                        <span style={{fontSize:12,color:C.gray}}>×{d.qty}</span>
                        <Badge text={short<=0?'Available':`${d.available??d.qty} of ${d.qty}`} bg={short<=0?C.greenBg:C.amberBg} color={short<=0?C.green:C.warningText}/>
                        <button onClick={()=>onEdit(d)} style={{background:'none',border:`1px solid ${C.border}`,borderRadius:6,cursor:'pointer',color:C.gray,fontSize:11,padding:'2px 8px',minHeight:'unset'}} title="Edit">✏️</button>
                        <button onClick={()=>onRemove(d.id)} style={{background:'none',border:'none',cursor:'pointer',color:C.gray,fontSize:16,lineHeight:1,padding:'0 2px',minHeight:'unset'}} title="Remove">×</button>
                      </div>
                    </div>
                    {(d.placement||d.setup_time||d.color_notes||d.notes)&&(
                      <div style={{display:'flex',flexWrap:'wrap',gap:'4px 12px',padding:'6px 14px',background:C.ivory,borderTop:`1px solid ${C.border}`}}>
                        {d.placement&&<span style={{fontSize:11,color:C.gray}}>📍 <span style={{color:C.ink}}>{d.placement}</span></span>}
                        {d.setup_time&&<span style={{fontSize:11,color:C.gray}}>⏰ <span style={{color:C.ink}}>{d.setup_time}</span></span>}
                        {d.color_notes&&<span style={{fontSize:11,color:C.gray}}>🎨 <span style={{color:C.ink}}>{d.color_notes}</span></span>}
                        {d.notes&&<span style={{fontSize:11,color:C.gray,fontStyle:'italic'}}>"{d.notes}"</span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}

          {decoItems.some(d=>d.available<d.qty)&&(
            <div style={{padding:'9px 16px',background:C.amberBg,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'space-between',fontSize:11}}>
              <span style={{color:'#78350F'}}>
                {decoItems.filter(d=>d.available<d.qty).map(d=>`${d.qty-(d.available??d.qty)} ${d.name.split(' ')[0].toLowerCase()}s short`).join(' · ')}
                {event?.event_date&&` — source before ${event.event_date}`}
              </span>
              <span onClick={()=>toast('Noted — add a task to resolve shortfall')} style={{color:C.amber,fontWeight:500,cursor:'pointer',whiteSpace:'nowrap',marginLeft:8}}>Resolve →</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── OVERVIEW TAB ────────────────────────────────────────────────────────────

function OverviewTab({plan, decoItems, event}) {
  const floral = plan.floral || {};
  const backdrop = plan.backdrop || {};
  const tables = plan.tables || {};
  const lighting = plan.lighting || {};

  const hasFloral = floral.style || (floral.colors||[]).length || Object.values(floral.arrangements||{}).some(a=>a.qty>0) || floral.vendorName || floral.notes;
  const hasBackdrop = backdrop.type && backdrop.type!=='none';
  const hasTables = tables.count || tables.shape || tables.cpStyle;
  const hasLighting = Object.values(lighting.options||{}).some(o=>o.enabled);
  const hasInventory = decoItems.length > 0;

  return (
    <div>
      <style>{`
        @media print {
          body > *:not(.deco-overview-print) { display: none !important; }
          .deco-overview-print { display: block !important; }
        }
      `}</style>
      <div className="deco-overview-print">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
          <div>
            <div style={{fontSize:16,fontWeight:700,color:C.ink}}>Decoration Day Sheet</div>
            {event?.event_date&&<div style={{fontSize:12,color:C.gray}}>Event date: {event.event_date}</div>}
          </div>
          <button
            onClick={()=>window.print()}
            style={{padding:'7px 16px',borderRadius:8,border:`1.5px solid ${C.rosa}`,background:C.rosaPale,color:C.rosaText,fontSize:12,fontWeight:600,cursor:'pointer'}}
          >🖨 Print Day Sheet</button>
        </div>

        {!hasFloral&&!hasBackdrop&&!hasTables&&!hasLighting&&!hasInventory&&(
          <div style={{padding:'32px 16px',textAlign:'center',fontSize:12,color:C.gray,border:`1px dashed ${C.border}`,borderRadius:10}}>
            No decoration details entered yet. Fill in the other tabs to see the summary here.
          </div>
        )}

        {hasFloral&&(
          <OverviewSection title="🌸 Florals">
            {floral.style&&<OverviewRow label="Style" value={floral.style}/>}
            {(floral.colors||[]).length>0&&<OverviewRow label="Colors" value={floral.colors.join(', ')}/>}
            {Object.entries(floral.arrangements||{}).filter(([,a])=>a.qty>0).map(([key,a])=>{
              const t = ARRANGEMENT_TYPES.find(x=>x.key===key);
              return <OverviewRow key={key} label={t?.label||key} value={`×${a.qty}${a.notes?' — '+a.notes:''}`}/>;
            })}
            {floral.vendorName&&<OverviewRow label="Vendor" value={`${floral.vendorName}${floral.vendorPhone?' · '+floral.vendorPhone:''}`}/>}
            {floral.notes&&<OverviewRow label="Notes" value={floral.notes} italic/>}
          </OverviewSection>
        )}

        {hasBackdrop&&(
          <OverviewSection title="🏛 Backdrop & Arch">
            {backdrop.type&&<OverviewRow label="Type" value={BACKDROP_TYPES.find(b=>b.key===backdrop.type)?.label||backdrop.type}/>}
            {backdrop.type==='custom'&&backdrop.customType&&<OverviewRow label="Custom" value={backdrop.customType}/>}
            {backdrop.placement&&<OverviewRow label="Placement" value={backdrop.placement}/>}
            {(backdrop.width||backdrop.height)&&<OverviewRow label="Size" value={`${backdrop.width||'?'} × ${backdrop.height||'?'}`}/>}
            {(backdrop.materials||[]).length>0&&<OverviewRow label="Materials" value={backdrop.materials.join(', ')}/>}
            {backdrop.materialNotes&&<OverviewRow label="Material Notes" value={backdrop.materialNotes}/>}
            {backdrop.photoBackdrop&&<OverviewRow label="Photo Backdrop" value={`${BACKDROP_TYPES.find(b=>b.key===backdrop.photoType)?.label||backdrop.photoType||'Yes'}${backdrop.photoNotes?' — '+backdrop.photoNotes:''}`}/>}
            {backdrop.notes&&<OverviewRow label="Notes" value={backdrop.notes} italic/>}
          </OverviewSection>
        )}

        {hasTables&&(
          <OverviewSection title="🍽 Tables">
            {tables.count&&<OverviewRow label="Table Count" value={tables.count}/>}
            {tables.shape&&<OverviewRow label="Shape" value={tables.shape}/>}
            {tables.headTable&&<OverviewRow label="Head Table" value={tables.headTable}/>}
            {tables.cpStyle&&<OverviewRow label="Centerpieces" value={`${tables.cpStyle}${tables.cpNotes?' — '+tables.cpNotes:''}`}/>}
            {tables.linens?.guest?.color&&<OverviewRow label="Guest Linens" value={`${tables.linens.guest.color}${tables.linens.guest.style?' · '+tables.linens.guest.style:''}${tables.linens.guest.napkinColor?' · napkins: '+tables.linens.guest.napkinColor:''}`}/>}
            {tables.linens?.head?.color&&<OverviewRow label="Head Table Linens" value={`${tables.linens.head.color}${tables.linens.head.style?' · '+tables.linens.head.style:''}`}/>}
            {(tables.placeSettings||[]).length>0&&<OverviewRow label="Place Settings" value={tables.placeSettings.join(', ')}/>}
            {tables.tableNumbers&&<OverviewRow label="Table Numbers" value={tables.tableNumbers}/>}
            {tables.notes&&<OverviewRow label="Notes" value={tables.notes} italic/>}
          </OverviewSection>
        )}

        {hasLighting&&(
          <OverviewSection title="💡 Lighting">
            {LIGHTING_OPTIONS.filter(o=>lighting.options?.[o.key]?.enabled).map(o=>(
              <OverviewRow key={o.key} label={o.label} value={lighting.options[o.key].detail||'Yes'}/>
            ))}
            {lighting.generator&&<OverviewRow label="Generator" value={lighting.generator}/>}
            {lighting.vendor&&<OverviewRow label="Vendor" value={lighting.vendor}/>}
            {lighting.notes&&<OverviewRow label="Notes" value={lighting.notes} italic/>}
          </OverviewSection>
        )}

        {hasInventory&&(
          <OverviewSection title="📦 Inventory Items">
            {decoItems.map(d=>(
              <OverviewRow
                key={d.id}
                label={d.name}
                value={`×${d.qty}${d.placement?' · '+d.placement:''}${d.setup_time?' · setup: '+d.setup_time:''}${d.color_notes?' · '+d.color_notes:''}`}
              />
            ))}
          </OverviewSection>
        )}
      </div>
    </div>
  );
}

function OverviewSection({title, children}) {
  return (
    <div style={{marginBottom:16,borderRadius:8,border:`1px solid ${C.border}`,overflow:'hidden'}}>
      <div style={{padding:'8px 14px',background:C.ivory,borderBottom:`1px solid ${C.border}`,fontSize:13,fontWeight:600,color:C.ink}}>{title}</div>
      <div style={{padding:'8px 14px',display:'flex',flexDirection:'column',gap:4}}>{children}</div>
    </div>
  );
}

function OverviewRow({label, value, italic}) {
  return (
    <div style={{display:'flex',gap:8,fontSize:12}}>
      <span style={{color:C.gray,minWidth:120,flexShrink:0,fontWeight:500}}>{label}:</span>
      <span style={{color:C.ink,fontStyle:italic?'italic':'normal'}}>{value}</span>
    </div>
  );
}

// ─── RENDER HITS HELPER (for modal search) ───────────────────────────────────

function renderHits(hits, decoForm, setDecoForm, setDecoSearch) {
  return (
    <div style={{border:`1px solid ${C.border}`,borderRadius:8,marginTop:4,overflow:'hidden'}}>
      {hits.map(d=>(
        <div
          key={d.id}
          onClick={()=>{setDecoForm(f=>({...f,inventoryId:d.id}));setDecoSearch(d.name+(d.sku?' ('+d.sku+')':''));}}
          style={{padding:'8px 12px',cursor:'pointer',background:decoForm.inventoryId===d.id?C.rosaPale:C.white,borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}
          onMouseEnter={e=>{if(decoForm.inventoryId!==d.id)e.currentTarget.style.background=C.ivory;}}
          onMouseLeave={e=>{e.currentTarget.style.background=decoForm.inventoryId===d.id?C.rosaPale:C.white;}}
        >
          <div>
            <div style={{fontSize:12,fontWeight:500,color:C.ink}}>{d.name}</div>
            <div style={{fontSize:10,color:C.gray,fontFamily:'monospace'}}>{d.sku}{d.color?' · '+d.color:''}{d.category?' · '+d.category.replace(/_/g,' '):''}</div>
          </div>
          <div style={{fontSize:11,color:d.availQty>0?C.green:C.amber,fontWeight:500}}>{d.availQty??'—'} avail</div>
        </div>
      ))}
    </div>
  );
}
