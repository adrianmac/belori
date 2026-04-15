import React, { useState } from 'react';
import { C } from '../../lib/colors';
import { Card, useToast } from '../../lib/ui.jsx';
import { supabase } from '../../lib/supabase';

const STATUS = {
  draft:{label:'Draft',bg:C.grayBg,col:C.gray},
  sent:{label:'Sent',bg:'#EFF6FF',col:'#1D4ED8'},
  signed:{label:'Signed ✓',bg:'#F0FDF4',col:'#15803D'},
  voided:{label:'Voided',bg:'#FEF2F2',col:'#DC2626'}
};

const ContractsCard = ({
  contracts,
  openContractModal,
  downloadSignedPDF,
  copyContractLink,
  copiedContractId,
  onContractVoided,
}) => {
  const toast = useToast();
  const [voidingId, setVoidingId] = useState(null);
  const [voidConfirm, setVoidConfirm] = useState(null); // contract | null

  const voidContract = async () => {
    if (!voidConfirm) return;
    setVoidingId(voidConfirm.id);
    try {
      const { error } = await supabase.from('contracts').update({ status: 'voided' }).eq('id', voidConfirm.id);
      if (error) throw error;
      onContractVoided?.(voidConfirm.id);
    } catch {
      toast('Failed to void contract', 'error');
    } finally {
      setVoidingId(null);
      setVoidConfirm(null);
    }
  };

  return (
    <>
    <Card>
      <div className="card-header">
        <div className="card-header-title">
          <span>📝 Contracts</span>
          {contracts.length > 0 && <span style={{fontSize:11,color:C.gray,fontWeight:400}}>{contracts.filter(c=>c.status==='signed').length} signed · {contracts.filter(c=>c.status==='sent').length} pending</span>}
        </div>
        <button onClick={openContractModal} className="card-header-action">+ New contract</button>
      </div>

      {contracts.length === 0 ? (
        <div style={{padding:'24px 16px',textAlign:'center',fontSize:12,color:C.gray}}>
          No contracts yet.<br/>
          <span onClick={openContractModal} style={{color:C.rosaText,cursor:'pointer',fontWeight:500}}>+ Create & send for signature →</span>
        </div>
      ) : contracts.map((c, i) => {
        const cfg = STATUS[c.status] || STATUS.draft;
        return (
          <div key={c.id} style={{padding:'12px 16px',borderTop:i>0?`1px solid ${C.border}`:'none',opacity:c.status==='voided'?0.5:1}}>
            <div style={{display:'flex',alignItems:'flex-start',gap:10}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap',marginBottom:3}}>
                  <span style={{fontSize:12,fontWeight:500,color:C.ink}}>{c.title}</span>
                  <span style={{fontSize:10,padding:'2px 8px',borderRadius:20,background:cfg.bg,color:cfg.col,fontWeight:600}}>{cfg.label}</span>
                </div>
                {c.status === 'signed' && <div style={{fontSize:11,color:C.gray}}>Signed by <strong style={{color:C.ink}}>{c.signed_by_name}</strong> · {new Date(c.signed_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</div>}
                {c.status === 'sent' && <div style={{fontSize:11,color:C.gray}}>Sent {new Date(c.sent_at).toLocaleDateString('en-US',{month:'short',day:'numeric'})} · Awaiting signature</div>}
                {c.status === 'draft' && <div style={{fontSize:11,color:C.gray}}>Created {new Date(c.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</div>}
                {c.status === 'voided' && <div style={{fontSize:11,color:'var(--text-danger)'}}>Voided</div>}
              </div>
              <div style={{display:'flex',gap:5,flexShrink:0,flexWrap:'wrap',justifyContent:'flex-end'}}>
                {c.status === 'signed' && (
                  <button onClick={() => downloadSignedPDF(c)} style={{fontSize:11,padding:'4px 10px',borderRadius:7,border:`1px solid ${C.border}`,background:'#fff',color:C.gray,cursor:'pointer',minHeight:'unset',minWidth:'unset'}}>📄 PDF</button>
                )}
                {(c.status === 'sent' || c.status === 'draft') && (
                  <>
                    <button onClick={() => copyContractLink(c)}
                      style={{fontSize:11,padding:'4px 10px',borderRadius:7,border:`1px solid ${copiedContractId===c.id?C.rosa:C.border}`,background:copiedContractId===c.id?C.rosaPale:'#fff',color:copiedContractId===c.id?C.rosaText:C.gray,cursor:'pointer',minHeight:'unset',minWidth:'unset'}}>
                      {copiedContractId === c.id ? '✓ Copied!' : '🔗 Copy link'}
                    </button>
                    <button onClick={() => setVoidConfirm(c)} disabled={voidingId===c.id}
                      style={{fontSize:11,padding:'4px 10px',borderRadius:7,border:`1px solid var(--color-danger)`,background:'#fff',color:'var(--text-danger)',cursor:'pointer',minHeight:'unset',minWidth:'unset',opacity:voidingId===c.id?0.6:1}}>
                      {voidingId===c.id ? '…' : 'Void'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </Card>

      {/* Void contract confirmation modal */}
      {voidConfirm && (
        <div role="presentation" onClick={e => { if (e.target === e.currentTarget) setVoidConfirm(null); }}
          style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1200,padding:16}}>
          <div role="dialog" aria-modal="true" aria-labelledby="void-contract-title"
            style={{background:'#fff',borderRadius:16,width:380,overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,0.2)'}}>
            <div style={{padding:'20px 20px 12px',textAlign:'center'}}>
              <div style={{width:44,height:44,borderRadius:'50%',background:'var(--bg-danger)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 12px'}}>
                <svg width="20" height="20" viewBox="0 0 16 16" fill="none"><path d="M8 2a6 6 0 100 12A6 6 0 008 2zM8 5v4M8 11h.01" stroke="var(--color-danger)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <div id="void-contract-title" style={{fontSize:15,fontWeight:600,color:'#111',marginBottom:8}}>
                Void &ldquo;{voidConfirm.title}&rdquo;?
              </div>
              <div style={{fontSize:12,color:'var(--text-danger)',background:'var(--bg-danger)',borderRadius:8,padding:'8px 12px'}}>
                This cannot be undone.
              </div>
            </div>
            <div style={{padding:'12px 20px 20px',display:'flex',gap:8}}>
              <button onClick={() => setVoidConfirm(null)}
                style={{flex:1,padding:'9px 16px',borderRadius:8,border:`1px solid ${C.border}`,background:'#fff',color:C.gray,fontSize:13,fontWeight:600,cursor:'pointer'}}>
                Cancel
              </button>
              <button onClick={voidContract} disabled={!!voidingId}
                style={{flex:1,padding:'9px 16px',borderRadius:8,border:'none',background:'var(--color-danger)',color:'#fff',fontSize:13,fontWeight:600,cursor:voidingId?'not-allowed':'pointer',opacity:voidingId?0.7:1}}>
                {voidingId ? 'Voiding…' : 'Void contract'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ContractsCard;
