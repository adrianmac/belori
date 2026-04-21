import React, { useState, useCallback, useEffect, useRef, createContext, useContext } from "react";
import { C, SVC_LABELS, SVC_COLORS, EVT_TYPES, pct } from "./colors";
import { getCountdownConfig } from "./urgency";
import { useLayoutMode } from "../hooks/useLayoutMode.jsx";

// ─── SHARED STYLE OBJECTS ──────────────────────────────────────────────────
// Couture-refined: sharp 2px radius, warm-cream bg, hairline border, gold focus ring (via CSS in index.css)
export const inputSt = {
  width:'100%',
  padding:'10px 12px',
  borderRadius:2,
  border:`1px solid ${C.border}`,
  fontSize:13,
  color:C.ink,
  boxSizing:'border-box',
  outline:'none',
  background:'#FEFBF7',           // warm cream, not sterile white
  transition:'border-color 0.2s cubic-bezier(.22,.61,.36,1), box-shadow 0.2s cubic-bezier(.22,.61,.36,1)',
  fontFamily:"'DM Sans','Inter',system-ui,sans-serif",
};
// LBL is intentionally kept for backward compat. Prefer <label htmlFor="…" style={LBL}> over <div style={LBL}>
// Upgraded to small-caps couture treatment — subtle but propagates everywhere.
export const LBL = {
  fontSize:10,
  color:'#5C4A52',
  marginBottom:6,
  display:'block',
  textTransform:'uppercase',
  letterSpacing:'0.14em',
  fontWeight:500,
  fontFamily:"'DM Sans','Inter',system-ui,sans-serif",
};

// ─── FOCUS TRAP ────────────────────────────────────────────────────────────
// Traps keyboard focus within a modal container and restores it on close.
// Usage: const trapRef = useFocusTrap(isOpen);  <div ref={trapRef} ...>
export function useFocusTrap(isOpen) {
  const ref = useRef(null);
  const previousFocus = useRef(null);
  useEffect(() => {
    if (!isOpen) return;
    previousFocus.current = document.activeElement;
    const el = ref.current;
    if (!el) return;
    // Focus first focusable element
    const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
    const first = el.querySelectorAll(FOCUSABLE)[0];
    if (first) first.focus();
    const handleKeyDown = (e) => {
      if (e.key !== 'Tab') return;
      const focusable = [...el.querySelectorAll(FOCUSABLE)].filter(n => !n.closest('[aria-hidden="true"]'));
      if (!focusable.length) { e.preventDefault(); return; }
      const firstEl = focusable[0];
      const lastEl  = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
      } else {
        if (document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
      }
    };
    el.addEventListener('keydown', handleKeyDown);
    return () => {
      el.removeEventListener('keydown', handleKeyDown);
      if (previousFocus.current && typeof previousFocus.current.focus === 'function') {
        previousFocus.current.focus();
      }
    };
  }, [isOpen]);
  return ref;
}

// ─── SHARED UI ATOMS ───────────────────────────────────────────────────────
export const Avatar = ({initials,size=32,bg=C.rosaPale,color=C.rosaText,label}) => (
  <div role="img" aria-label={label || initials} style={{width:size,height:size,borderRadius:'50%',background:bg,color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:size*0.34,fontWeight:500,flexShrink:0}}>
    {initials}
  </div>
);
export const Badge = ({text,bg,color,style={}}) => (
  <span style={{fontSize:10,padding:'3px 8px',borderRadius:999,background:bg,color,fontWeight:500,whiteSpace:'nowrap',...style}}>{text}</span>
);
export const SvcTag = ({svc}) => {
  const s = SVC_COLORS[svc]||{bg:C.grayBg,text:C.gray};
  return <Badge text={SVC_LABELS[svc]||svc} bg={s.bg} color={s.text}/>;
};
export const Countdown = ({days}) => {
  const cfg = getCountdownConfig(days);
  return (
    <span style={{
      fontSize:10, padding:'3px 8px', borderRadius:999,
      background:cfg.bg, color:cfg.color, fontWeight:500, whiteSpace:'nowrap',
      animation: cfg.pulse ? 'pulse 1.5s ease-in-out infinite' : 'none',
    }}>{cfg.text}</span>
  );
};
export const EventTypeBadge = ({type}) => {
  const t = EVT_TYPES[type] || {label:type, bg:C.grayBg, col:C.gray};
  return <Badge text={t.label} bg={t.bg} color={t.col}/>;
};
export const ProgressBar = ({paid,total,height=5}) => {
  const pctVal = Math.min(100, pct(paid, total));
  return (
    <div
      role="progressbar"
      aria-valuenow={pctVal}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${pctVal}% paid`}
      style={{height,background:C.border,borderRadius:3,overflow:'hidden',flexShrink:0}}
    >
      <div style={{height:'100%',width:`${pctVal}%`,background:'var(--color-success)',borderRadius:3,transition:'width 0.4s'}}/>
    </div>
  );
};
// Couture-refined: warm cream bg, hairline border, sharper radius driven by --card-radius (3px/4px)
export const Card = ({children,style={}}) => (
  <div style={{
    background:'#FEFBF7',                        // warm cream, not sterile white
    border:'1px solid #EDE7E2',                  // softer than the old gray border
    borderRadius:'var(--card-radius)',
    overflow:'hidden',
    boxShadow:'var(--card-shadow, 0 1px 3px rgba(28,17,24,0.04))',
    ...style,
  }}>
    {children}
  </div>
);
// CardHead: italic serif title (couture editorial) + small-caps eyebrow,
// and the "action" link becomes a gold couture-link instead of rosa pink.
export const CardHead = ({title,sub,action,onAction}) => {
  const { isTablet } = useLayoutMode();
  return (
    <div style={{
      display:'flex',alignItems:'center',justifyContent:'space-between',
      padding:'var(--card-head-padding)',
      borderBottom:'1px solid #EDE7E2',
    }}>
      <div style={{minWidth:0}}>
        <div style={{
          fontFamily:"'Cormorant Garamond','Didot',Georgia,serif",
          fontSize:'calc(var(--text-card-title, 12px) + 3px)',
          fontWeight:500,
          fontStyle:'italic',
          color:'#1C1118',
          letterSpacing:'0.005em',
          lineHeight:1.15,
        }}>{title}</div>
        {sub && <div style={{
          fontFamily:"'DM Sans','Inter',system-ui,sans-serif",
          fontSize:10,
          color:'#5C4A52',
          textTransform:'uppercase',
          letterSpacing:'0.14em',
          marginTop:4,
          fontWeight:500,
        }}>{sub}</div>}
      </div>
      {action&&(isTablet
        ?<button onClick={onAction} style={{
            fontFamily:"'DM Sans','Inter',system-ui,sans-serif",
            fontSize:10,color:'#1C1118',fontWeight:500,
            textTransform:'uppercase',letterSpacing:'0.14em',
            background:'transparent',border:'1px solid #1C1118',
            borderRadius:2,padding:'7px 14px',cursor:'pointer',
            minHeight:36,minWidth:'unset',lineHeight:1,
          }}>{action}</button>
        :<button onClick={onAction} style={{
            fontFamily:"'DM Sans','Inter',system-ui,sans-serif",
            fontSize:10,color:'#8E6B34',cursor:'pointer',fontWeight:500,
            textTransform:'uppercase',letterSpacing:'0.14em',
            background:'none',border:'none',padding:0,
          }}>{action} <span aria-hidden="true">→</span></button>
      )}
    </div>
  );
};
// PrimaryBtn/GhostBtn forward all extra props to the underlying <button>, so
// callers can pass data-testid, aria-*, type, title, form, etc. without
// touching the atoms.
export const PrimaryBtn = ({label,onClick,style={},className='',colorScheme='primary',children,disabled,...rest}) => (
  <button onClick={onClick} className={`btn-solid ${className}`} data-color={colorScheme} style={style} disabled={disabled} {...rest}>
    {label||children}
  </button>
);
export const GhostBtn = ({label,onClick,style={},className='',colorScheme='primary',children,disabled,...rest}) => (
  <button onClick={onClick} className={`btn-ghost ${className}`} data-color={colorScheme} style={style} disabled={disabled} {...rest}>
    {label||children}
  </button>
);
export const StatusDot = ({status}) => {
  const colors={paid:'var(--color-success)',overdue:'var(--color-danger)',pending:'var(--color-warning)',upcoming:'var(--color-info)'};
  const label = status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown';
  return <div role="img" aria-label={label} title={label} style={{width:8,height:8,borderRadius:'50%',background:colors[status]||C.gray,flexShrink:0,marginTop:4}}/>;
};

// ─── EMPTY STATE — couture editorial ──────────────────────────────────────
// Uses italic serif title + small-caps subtitle + ornamental diamond.
// Legacy `icon` emoji is retained but de-emphasized (ghosted) so any caller
// passing '📭', '👗', etc. still renders without regressions.
export function EmptyState({ icon, title, subtitle, action, actionLabel, style = {} }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '56px 24px', textAlign: 'center', ...style
    }}>
      {/* Ornamental diamond — the editorial mark, replaces the emoji as the focal */}
      <div aria-hidden="true" style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, opacity: 0.7,
      }}>
        <span style={{ height: 1, width: 36, background: 'linear-gradient(90deg, transparent, #B08A4E)' }} />
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 0l5 5-5 5-5-5 5-5z" fill="#B08A4E"/></svg>
        <span style={{ height: 1, width: 36, background: 'linear-gradient(270deg, transparent, #B08A4E)' }} />
      </div>
      {/* Optional legacy emoji — muted, under the title */}
      {icon && (
        <div style={{ fontSize: 28, marginBottom: 10, lineHeight: 1, opacity: 0.4, filter: 'grayscale(0.3)' }}>
          {icon}
        </div>
      )}
      {title && <div style={{
        fontFamily: "'Cormorant Garamond','Didot',Georgia,serif",
        fontSize: 22, fontStyle: 'italic', fontWeight: 400,
        color: '#1C1118', marginBottom: 8, letterSpacing: '0.005em',
      }}>{title}</div>}
      {subtitle && <div style={{
        fontFamily: "'DM Sans','Inter',system-ui,sans-serif",
        fontSize: 13, color: '#5C4A52', lineHeight: 1.6, maxWidth: 320,
      }}>{subtitle}</div>}
      {action && actionLabel && (
        <button onClick={action} className="btn-solid" data-color="primary" style={{
          marginTop: 22,
        }}>{actionLabel}</button>
      )}
    </div>
  );
}

// ─── TOAST SYSTEM — couture palette, editorial typography ────────────────
// Ivory card + gold hairline left accent. Different tints by type.
export const ToastCtx=createContext(()=>{});
const TOAST_SKINS = {
  success: { accent: '#5C8A6E', bg: '#FEFBF7', mark: '✓' },
  error:   { accent: '#A34454', bg: '#FEFBF7', mark: '×' },
  warn:    { accent: '#B07A2E', bg: '#FEFBF7', mark: '!' },
  info:    { accent: '#1C1118', bg: '#FEFBF7', mark: '—' },
};
export const ToastProvider=({children})=>{
  const [toasts,setToasts]=useState([]);
  const show=useCallback((msg,type='success')=>{
    const id=Date.now()+Math.random();
    setToasts(t=>[...t,{id,msg,type}]);
    setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)),3400);
  },[]);
  return(
    <ToastCtx.Provider value={show}>
      {children}
      <div aria-live="polite" aria-atomic="false" role="status" style={{
        position:'fixed', bottom:80, right:20, zIndex:9999,
        display:'flex', flexDirection:'column', gap:10, pointerEvents:'none',
      }}>
        {toasts.map(t=>{
          const skin = TOAST_SKINS[t.type] || TOAST_SKINS.info;
          return (
            <div key={t.id} role={t.type==='error'?'alert':'status'} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 16px 12px 14px',
              background: skin.bg, color: '#1C1118',
              borderLeft: `2px solid ${skin.accent}`,
              borderTop: '1px solid #EDE7E2',
              borderRight: '1px solid #EDE7E2',
              borderBottom: '1px solid #EDE7E2',
              fontFamily: "'DM Sans','Inter',system-ui,sans-serif",
              fontSize: 13, fontWeight: 500,
              boxShadow: '0 8px 24px rgba(28,17,24,0.10), 0 1px 3px rgba(28,17,24,0.06)',
              animation: 'coutureToastIn 0.35s cubic-bezier(.22,.61,.36,1)',
              maxWidth: 380, minWidth: 240, pointerEvents: 'auto',
            }}>
              <span aria-hidden="true" style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 22, height: 22, borderRadius: '50%',
                background: skin.accent, color: '#FEFBF7',
                fontSize: 12, fontWeight: 500, flexShrink: 0,
              }}>{skin.mark}</span>
              <span>{t.msg}</span>
            </div>
          );
        })}
      </div>
      <style>{`
        @keyframes coutureToastIn {
          from { transform: translateX(24px); opacity: 0; }
          to   { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideIn { from { transform: translateX(40px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      `}</style>
    </ToastCtx.Provider>
  );
};
export const useToast=()=>useContext(ToastCtx);

// ─── SKELETON LOADERS ──────────────────────────────────────────────────────────
const skeletonKeyframes = `
@keyframes belori-shimmer {
  0% { background-position: -400px 0; }
  100% { background-position: 400px 0; }
}`;

// Inject keyframes once
if (typeof document !== 'undefined' && !document.getElementById('belori-skeleton-style')) {
  const s = document.createElement('style');
  s.id = 'belori-skeleton-style';
  s.textContent = skeletonKeyframes;
  document.head.appendChild(s);
}

// Couture skeleton — warm ivory → champagne light → ivory shimmer.
const skeletonBase = {
  background: 'linear-gradient(90deg, #F2ECE5 25%, #FBF5E9 50%, #F2ECE5 75%)',
  backgroundSize: '400px 100%',
  animation: 'belori-shimmer 1.6s ease-in-out infinite',
  borderRadius: 2,
  display: 'block',
};

export function SkeletonLine({ width = '100%', height = 12, style = {} }) {
  return <span style={{ ...skeletonBase, width, height, ...style }}/>;
}

export function SkeletonCard({ rows = 3, style = {} }) {
  return (
    <div style={{ background: '#FEFBF7', border: '1px solid #EDE7E2', borderRadius: 3, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10, ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <span style={{ ...skeletonBase, width: 36, height: 36, borderRadius: '50%', flexShrink: 0 }}/>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <SkeletonLine width="55%" height={13}/>
          <SkeletonLine width="35%" height={10}/>
        </div>
      </div>
      {Array.from({ length: rows - 1 }).map((_, i) => (
        <SkeletonLine key={i} width={i % 2 === 0 ? '80%' : '60%'} height={10}/>
      ))}
    </div>
  );
}

export function SkeletonList({ count = 5, style = {} }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, ...style }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} rows={2}/>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 6, cols = 4, style = {} }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, ...style }}>
      {/* Header */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 8, padding: '10px 14px', background: '#F8F4F0', borderRadius: '3px 3px 0 0', borderBottom: '1px solid #EDE7E2' }}>
        {Array.from({ length: cols }).map((_, i) => <SkeletonLine key={i} height={10} width="60%"/>)}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 8, padding: '12px 14px', background: r % 2 === 0 ? '#FEFBF7' : '#FAF6F1', borderBottom: '1px solid #EDE7E2' }}>
          {Array.from({ length: cols }).map((_, c) => (
            <SkeletonLine key={c} height={11} width={c === 0 ? '75%' : c === cols-1 ? '40%' : '55%'}/>
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonDashboard() {
  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Stat cards row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
        {[1,2,3,4,5].map(i => (
          <div key={i} style={{ background: '#FEFBF7', border: '1px solid #EDE7E2', borderRadius: 3, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <SkeletonLine width="50%" height={10}/>
            <SkeletonLine width="70%" height={22}/>
          </div>
        ))}
      </div>
      <SkeletonCard rows={4}/>
      <SkeletonList count={3}/>
    </div>
  );
}

// ─── NAV ICONS ─────────────────────────────────────────────────────────────
export const icons = {
  overview: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><rect x="9" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><rect x="1" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><rect x="9" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/></svg>,
  calendar: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="3" width="14" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><line x1="1" y1="7" x2="15" y2="7" stroke="currentColor" strokeWidth="1.3"/><line x1="5" y1="1" x2="5" y2="5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><line x1="11" y1="1" x2="11" y2="5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>,
  events: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="2" width="14" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M5 1v2M11 1v2M1 6h14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>,
  clients: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.3"/><path d="M2 14c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>,
  alterations: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 3l10 10M13 3L3 13M8 1v2M8 13v2M1 8h2M13 8h2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>,
  rentals: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1c-2 0-5 1.5-5 5v6l5 3 5-3V6c0-3.5-3-5-5-5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>,
  planning: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="2" width="10" height="12" rx="1.5"/>
      <path d="M6 2v1.5a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5V2"/>
      <line x1="5.5" y1="7" x2="10.5" y2="7"/>
      <line x1="5.5" y1="9.5" x2="10.5" y2="9.5"/>
      <line x1="5.5" y1="12" x2="8.5" y2="12"/>
    </svg>
  ),
  inventory: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="7" width="14" height="7" rx="1" stroke="currentColor" strokeWidth="1.3"/><path d="M3 7V5a5 5 0 0 1 10 0v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>,
  payments: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="3" width="14" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M1 7h14" stroke="currentColor" strokeWidth="1.3"/></svg>,
  settings: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.3"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6L13 13M3 13l1.4-1.4M11.6 4.4L13 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>,
  reports:    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 14V6l3-3 3 2 3-3 3 3v9H2Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M5 14v-4M8 14V9M11 14v-6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>,
  expenses:   <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="3" width="14" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M5 8h6M8 6v4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>,
  measures:   <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="5" width="14" height="6" rx="1" stroke="currentColor" strokeWidth="1.3"/><path d="M4 5V4M8 5V3M12 5V4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>,
  vendors:    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M1 5l2-3h10l2 3v1a2 2 0 0 1-4 0 2 2 0 0 1-4 0 2 2 0 0 1-4 0V5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M2 9h12v4a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V9Z" stroke="currentColor" strokeWidth="1.3"/></svg>,
  waitlist:   <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1a7 7 0 1 1 0 14A7 7 0 0 1 8 1Z" stroke="currentColor" strokeWidth="1.3"/><path d="M8 4v4l3 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  reviews:    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2l1.5 3 3.5.5-2.5 2.5.5 3.5L8 10l-3 1.5.5-3.5L3 5.5 6.5 5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>,
  emailmkt:   <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="3" width="14" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M1 5l7 5 7-5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>,
  export:     <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1v8M5 6l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/><path d="M2 11v2a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>,
  pos:        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="1" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M5 15h6M8 11v4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><path d="M5 5h2M9 5h2M5 7h2M9 7h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>,
  retail:     <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 2h2l2 6h6l2-4H6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/><circle cx="7" cy="13" r="1" stroke="currentColor" strokeWidth="1.3"/><circle cx="12" cy="13" r="1" stroke="currentColor" strokeWidth="1.3"/></svg>,
  staffsched: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="2" width="14" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M5 1v2M11 1v2M1 6h14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><path d="M5 9h2M9 9h2M5 11.5h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>,
  auditlog:   <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M9 1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5L9 1Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M9 1v4h4M5 8h6M5 10.5h6M5 13h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>,
  catalog:    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="6" height="8" rx="1" stroke="currentColor" strokeWidth="1.3"/><rect x="9" y="1" width="6" height="8" rx="1" stroke="currentColor" strokeWidth="1.3"/><rect x="1" y="11" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="1.3"/><rect x="9" y="11" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="1.3"/></svg>,
  fbbeo:      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M5 2v4a3 3 0 0 0 6 0V2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><path d="M8 8v7M5 15h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>,
  floorplan:  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="14" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M1 7h7M7 7v8M7 1v6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>,
  gallery:    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="14" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><circle cx="5.5" cy="5.5" r="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M1 10l3.5-3 3 3 2-2 3.5 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/><path d="M4 15h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>,
  ticketing:  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M1 6a2 2 0 0 1 0-4h14a2 2 0 0 1 0 4v4a2 2 0 0 1 0 4H1a2 2 0 0 1 0-4V6Z" stroke="currentColor" strokeWidth="1.3"/><path d="M6 2v12M9 6h3M9 10h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>,
  accounting: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M5 8h6M8 5v6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>,
  paylinks:   <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M7 9a4 4 0 0 0 5.66 0l1.41-1.41a4 4 0 0 0-5.66-5.66L7 3.34" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><path d="M9 7a4 4 0 0 0-5.66 0L1.93 8.41a4 4 0 0 0 5.66 5.66L9 12.66" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>,
  roadmap:    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M1 4l4-2 6 4 4-2v8l-4 2-6-4-4 2V4Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M5 2v10M11 6v8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>,
  purchase_orders: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="3" width="14" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M5 3V2a3 3 0 0 1 6 0v1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><path d="M5 8h6M5 10.5h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>,
  sms:        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M13 1H3a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2l3 3 3-3h2a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M5 6h6M5 8.5h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>,
  quote:      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M10 1H3a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V5L10 1Z"/><path d="M10 1v4h4"/><path d="M8 12V9M6.5 10.5h3"/></svg>,
  import:     <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M14 10v3a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-3"/><polyline points="5 7 8 10 11 7"/><line x1="8" y1="10" x2="8" y2="2"/></svg>,
  commissions: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="5" r="3"/><path d="M2 14c0-3.314 2.686-5 6-5s6 1.686 6 5"/><path d="M8 2v1M8 7v1M6.5 3.27A1.5 1.5 0 0 0 8 5a1.5 1.5 0 0 0 0-3 1.5 1.5 0 0 1 0-3"/></svg>,
  promo:       <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M13.5 9.17 9.17 13.5a1.33 1.33 0 0 1-1.88 0L1.5 7.71V2.83A1.33 1.33 0 0 1 2.83 1.5h4.88l5.79 5.79a1.33 1.33 0 0 1 0 1.88Z"/><circle cx="5" cy="5" r="0.75" fill="currentColor" stroke="none"/><line x1="10" y1="6" x2="6" y2="10"/></svg>,
  funnel:      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M1.5 2h13l-5 6v5l-3-1.5V8L1.5 2Z"/></svg>,
  mytasks:     <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="1" width="9" height="12" rx="1.5"/><path d="M5 4.5h4M5 7h4M5 9.5h2"/><circle cx="12.5" cy="11.5" r="2.5"/><path d="M11.5 11.5l.75.75 1.25-1.25"/></svg>,
  search:      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  help:        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="8" r="7"/><path d="M6 6a2 2 0 1 1 2 2v1"/><circle cx="8" cy="12" r="0.6" fill="currentColor" stroke="none"/></svg>,
  activity:    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M1 8h2.5l2-5 2.5 9 2-6 1.5 3H15"/></svg>,
};

// ─── CONFIRM MODAL — couture editorial confirm ─────────────────────────────
// Replaces the bank-warning red circle with an ornamental diamond,
// italic-serif title, small-caps message, and sharp-edged couture buttons.
// Props: title, message, confirmLabel, onConfirm, onCancel, danger (bool)
export function ConfirmModal({ title, message, confirmLabel = 'Confirm', onConfirm, onCancel, danger = true }) {
  const trapRef = useFocusTrap(true);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);
  // Danger confirms stay red (muted, not neon). Non-danger uses gold.
  const accentColor = danger ? '#A34454' : '#B08A4E';
  const accentBg    = danger ? '#F7E6E9' : '#FBF5E9';
  const confirmClass = danger ? 'btn-solid' : 'btn-solid';
  const confirmScheme = danger ? 'danger' : 'primary';
  return (
    <div role="presentation" onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
      style={{
        position:'fixed', inset:0,
        background:'rgba(28,17,24,0.45)',
        backdropFilter: 'blur(3px)',
        display:'flex', alignItems:'center', justifyContent:'center',
        zIndex:1200, padding:16,
      }}>
      <div role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title" ref={trapRef}
        style={{
          background:'#FEFBF7', borderRadius:3, width:420, overflow:'hidden',
          boxShadow:'0 28px 80px -12px rgba(28,17,24,0.35), 0 1px 3px rgba(28,17,24,0.08)',
          border: '1px solid #EDE7E2',
          animation: 'coutureToastIn 0.28s cubic-bezier(.22,.61,.36,1)',
        }}>
        {/* Top accent line matches confirm-button color */}
        <div aria-hidden="true" style={{
          height: 2, background: accentColor, opacity: 0.75,
        }}/>
        <div style={{padding:'32px 28px 20px',textAlign:'center'}}>
          {/* Ornamental diamond instead of bank-warning icon */}
          <div aria-hidden="true" style={{
            display:'flex', alignItems:'center', justifyContent:'center',
            gap: 10, marginBottom: 18, opacity: 0.85,
          }}>
            <span style={{ height: 1, width: 32, background: `linear-gradient(90deg, transparent, ${accentColor})` }} />
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M5 0l5 5-5 5-5-5 5-5z" fill={accentColor} />
            </svg>
            <span style={{ height: 1, width: 32, background: `linear-gradient(270deg, transparent, ${accentColor})` }} />
          </div>
          <div id="confirm-modal-title" style={{
            fontFamily: "'Cormorant Garamond','Didot',Georgia,serif",
            fontSize:22, fontStyle:'italic', fontWeight:400,
            color:'#1C1118', marginBottom:message?10:0, letterSpacing: '0.005em',
          }}>{title}</div>
          {message && <div style={{
            fontFamily:"'DM Sans','Inter',system-ui,sans-serif",
            fontSize:13, color:'#5C4A52', lineHeight: 1.6, maxWidth: 320, margin: '0 auto',
          }}>{message}</div>}
        </div>
        <div style={{padding:'12px 24px 24px', display:'flex', gap:10, borderTop: '1px solid #EDE7E2', background: accentBg }}>
          <button onClick={onCancel} className="btn-ghost" data-color="primary"
            style={{ flex:1 }}>
            Cancel
          </button>
          <button onClick={onConfirm} className={confirmClass} data-color={confirmScheme}
            style={{ flex:1 }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── TOPBAR COMPONENTS ─────────────────────────────────────────────────────
export const ModeIndicatorBtn = () => {
  const { mode, toggle } = useLayoutMode();
  return (
    <button onClick={toggle} title={mode === 'tablet' ? 'Switch to desktop mode' : 'Switch to tablet mode'}
      className="btn-icon" style={{border:`1px solid ${C.border}`,background:'transparent',borderRadius:8,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:C.gray,minHeight:32,minWidth:32,padding:0,boxShadow:'var(--btn-shadow-ghost)'}}>
      {mode === 'tablet' ? (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="1" width="12" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M6 13h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="3" width="14" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M5 13h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
      )}
    </button>
  );
};
export const Topbar = ({title,subtitle,actions}) => {
  const { isTablet } = useLayoutMode();
  return (
    <div className="topbar" style={{
      display:'flex',alignItems:'center',justifyContent:'space-between',
      padding:'14px 22px',background:C.white,
      borderBottom:`1px solid ${C.border}`,flexShrink:0,gap:8,
      minHeight:'var(--topbar-height)', position:'relative',
    }}>
      {/* Couture hairline gold accent — bottom rule */}
      <div aria-hidden="true" style={{
        position:'absolute', left:22, right:22, bottom:-1, height:1,
        background:'linear-gradient(90deg, transparent, rgba(176,138,78,0.35) 50%, transparent)',
      }} />
      <div style={{minWidth:0, display:'flex', alignItems:'center', gap:12}}>
        {/* Editorial serif title */}
        <div style={{
          fontFamily:"'Cormorant Garamond', 'Didot', Georgia, serif",
          fontSize:'calc(var(--topbar-title-size, 18px) + 4px)',
          fontWeight:500,fontStyle:'italic',
          color:C.ink,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',
          letterSpacing:'0.005em', lineHeight:1.1,
        }}>{title}</div>
        {subtitle&&(
          <>
            <span aria-hidden="true" style={{color:'#B08A4E',opacity:0.5,fontSize:10}}>◆</span>
            <div className={isTablet?undefined:'topbar-hide'} style={{
              fontFamily:"'DM Sans', system-ui, sans-serif",
              fontSize:10, color:'#5C4A52',
              textTransform:'uppercase', letterSpacing:'0.18em',
              whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',
            }}>{subtitle}</div>
          </>
        )}
      </div>
      <div className="topbar-actions" style={{display:'flex',gap:8,alignItems:'center',flexShrink:0}}>
        {actions}
        <ModeIndicatorBtn />
      </div>
    </div>
  );
};
// ─── SCROLL SHADOW ─────────────────────────────────────────────────────────
export function ScrollShadow({ children, maxHeight, style }) {
  const ref = useRef(null);
  const [showTop, setShowTop] = useState(false);
  const [showBottom, setShowBottom] = useState(false);

  const check = () => {
    const el = ref.current;
    if (!el) return;
    setShowTop(el.scrollTop > 8);
    setShowBottom(el.scrollTop < el.scrollHeight - el.clientHeight - 8);
  };

  useEffect(() => { check(); }, []);

  return (
    <div style={{ position: 'relative', ...style }}>
      {showTop && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 16,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.08), transparent)',
          zIndex: 1, pointerEvents: 'none'
        }}/>
      )}
      <div ref={ref} onScroll={check} style={{ overflowY: 'auto', maxHeight }}>
        {children}
      </div>
      {showBottom && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 16,
          background: 'linear-gradient(to top, rgba(0,0,0,0.08), transparent)',
          zIndex: 1, pointerEvents: 'none'
        }}/>
      )}
    </div>
  );
}

// ─── AUTO-RESIZE HOOK ──────────────────────────────────────────────────────
export function useAutoResize(ref) {
  const resize = useCallback(() => {
    if (!ref.current) return;
    ref.current.style.height = 'auto';
    ref.current.style.height = ref.current.scrollHeight + 'px';
  }, [ref]);
  useEffect(() => { resize(); }, [resize]);
  return resize;
}

export const AlertBanner = ({msg,action,onAction}) => {
  const { isTablet } = useLayoutMode();
  return (
    <div style={{background:'var(--bg-warning)',borderBottom:true?`1px solid var(--color-warning)`:'none',padding:isTablet?'11px 18px':'10px 20px',display:'flex',alignItems:'center',gap:10,flexShrink:0}}>
      <svg width="18" height="18" viewBox="0 0 16 16" fill="none" style={{flexShrink:0}}><circle cx="8" cy="8" r="7" stroke='var(--color-warning)' strokeWidth="1.2"/><path d="M8 5v3M8 11v.5" stroke='var(--color-warning)' strokeWidth="1.4" strokeLinecap="round"/></svg>
      <span style={{fontSize:isTablet?13:12,color:'var(--text-warning)',flex:1,lineHeight:1.4}}>{msg}</span>
      {action&&(isTablet?
        <button onClick={onAction} style={{height:44,padding:'0 16px',background:'var(--color-warning)',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:500,cursor:'pointer',whiteSpace:'nowrap',flexShrink:0,minHeight:'unset',minWidth:'unset'}}>{action}</button>
        :
        <span onClick={onAction} style={{fontSize:12,color:'var(--text-warning)',fontWeight:500,cursor:'pointer',whiteSpace:'nowrap'}}>{action} →</span>
      )}
    </div>
  );
};
