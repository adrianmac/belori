import React from 'react';
import { C } from '../lib/colors';

const SHORTCUTS = [
  { section: 'Navigation' },
  { keys: ['⌘K', 'Ctrl+K'],  desc: 'Global search' },
  { keys: ['?'],              desc: 'Show this help' },
  { keys: ['Esc'],            desc: 'Close modal / menu' },
  { section: 'Events' },
  { keys: ['E'],              desc: 'Go to Events (from Dashboard)' },
  { keys: ['C'],              desc: 'Go to Clients' },
  { keys: ['P'],              desc: 'Go to Payments' },
  { section: 'In lists' },
  { keys: ['↑', '↓'],        desc: 'Navigate items' },
  { keys: ['Enter'],          desc: 'Open selected item' },
  { section: 'In modals' },
  { keys: ['Enter'],          desc: 'Submit / confirm' },
  { keys: ['Esc'],            desc: 'Cancel / close' },
  { section: 'Calendar' },
  { keys: ['←', '→'],        desc: 'Previous / next period' },
  { keys: ['T'],              desc: 'Jump to today' },
];

export default function KeyboardShortcutsModal({ onClose }) {
  return (
    <div
      style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:2000,padding:16}}
      onClick={e=>{if(e.target===e.currentTarget)onClose();}}
    >
      <div style={{background:C.white,borderRadius:16,width:440,maxHeight:'88dvh',display:'flex',flexDirection:'column',boxShadow:'0 24px 80px rgba(0,0,0,0.2)',overflow:'hidden'}}>
        <div style={{padding:'16px 20px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
          <div>
            <span style={{fontWeight:600,fontSize:15,color:C.ink}}>Keyboard shortcuts</span>
            <div style={{fontSize:12,color:C.gray,marginTop:1}}>Press <kbd style={{background:C.grayBg,border:`1px solid ${C.border}`,borderRadius:4,padding:'1px 5px',fontSize:11}}>?</kbd> anytime to show this</div>
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:C.gray,lineHeight:1}}>×</button>
        </div>
        <div style={{flex:1,overflowY:'auto',padding:'12px 20px 20px'}}>
          {SHORTCUTS.map((s, i) => {
            if (s.section) return (
              <div key={i} style={{fontSize:10,fontWeight:700,color:C.gray,textTransform:'uppercase',letterSpacing:'0.08em',marginTop:i>0?16:4,marginBottom:8}}>{s.section}</div>
            );
            return (
              <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 0',borderBottom:`1px solid ${C.border}`}}>
                <span style={{fontSize:13,color:C.inkMid}}>{s.desc}</span>
                <div style={{display:'flex',gap:4}}>
                  {s.keys.map((k,ki)=>(
                    <React.Fragment key={ki}>
                      {ki>0&&<span style={{fontSize:11,color:C.gray,alignSelf:'center'}}>/</span>}
                      <kbd style={{
                        background:C.grayBg,
                        border:`1px solid ${C.border}`,
                        borderBottom:`2px solid ${C.borderDark}`,
                        borderRadius:6,
                        padding:'2px 8px',
                        fontSize:12,
                        fontFamily:'monospace',
                        color:C.ink,
                        whiteSpace:'nowrap',
                      }}>{k}</kbd>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{padding:'10px 20px',borderTop:`1px solid ${C.border}`,background:C.grayBg,flexShrink:0}}>
          <div style={{fontSize:11,color:C.gray,textAlign:'center'}}>Shortcuts work when no input is focused · Press Esc to close</div>
        </div>
      </div>
    </div>
  );
}
