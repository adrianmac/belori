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

  const voidContract = async (c) => {
    if (!window.confirm(`Void "${c.title}"? This cannot be undone.`)) return;
    setVoidingId(c.id);
    try {
      const { error } = await supabase.from('contracts').update({ status: 'voided' }).eq('id', c.id);
      if (error) throw error;
      onContractVoided?.(c.id);
    } catch {
      toast('Failed to void contract', 'error');
    } finally {
      setVoidingId(null);
    }
  };

  return (
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
          <span onClick={openContractModal} style={{color:C.rosa,cursor:'pointer',fontWeight:500}}>+ Create & send for signature →</span>
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
                {c.status === 'voided' && <div style={{fontSize:11,color:'var(--color-danger)'}}>Voided</div>}
              </div>
              <div style={{display:'flex',gap:5,flexShrink:0,flexWrap:'wrap',justifyContent:'flex-end'}}>
                {c.status === 'signed' && (
                  <button onClick={() => downloadSignedPDF(c)} style={{fontSize:11,padding:'4px 10px',borderRadius:7,border:`1px solid ${C.border}`,background:'#fff',color:C.gray,cursor:'pointer',minHeight:'unset',minWidth:'unset'}}>📄 PDF</button>
                )}
                {(c.status === 'sent' || c.status === 'draft') && (
                  <>
                    <button onClick={() => copyContractLink(c)}
                      style={{fontSize:11,padding:'4px 10px',borderRadius:7,border:`1px solid ${copiedContractId===c.id?C.rosa:C.border}`,background:copiedContractId===c.id?C.rosaPale:'#fff',color:copiedContractId===c.id?C.rosa:C.gray,cursor:'pointer',minHeight:'unset',minWidth:'unset'}}>
                      {copiedContractId === c.id ? '✓ Copied!' : '🔗 Copy link'}
                    </button>
                    <button onClick={() => voidContract(c)} disabled={voidingId===c.id}
                      style={{fontSize:11,padding:'4px 10px',borderRadius:7,border:`1px solid var(--color-danger)`,background:'#fff',color:'var(--color-danger)',cursor:'pointer',minHeight:'unset',minWidth:'unset',opacity:voidingId===c.id?0.6:1}}>
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
  );
};

export default ContractsCard;
