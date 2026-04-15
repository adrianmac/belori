import React from 'react';
import { C, fmt } from '../../lib/colors';
import { Badge, inputSt, GhostBtn } from '../../lib/ui.jsx';

export const HistoryTab = ({ liveInventory, search, setSearch, historyFilter, setHistoryFilter, toast }) => (
  <div style={{padding:20}}>
    {/* Stats strip */}
    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:20}}>
      <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:12,padding:16}}>
        <div style={{fontSize:11,color:C.gray,marginBottom:4}}>Total rentals</div>
        <div style={{fontSize:24,fontWeight:700,color:C.ink}}>{liveInventory.filter(d=>d.status==='returned').length}</div>
        <div style={{fontSize:11,color:C.gray,marginTop:2}}>completed rentals on record</div>
      </div>
      <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:12,padding:16}}>
        <div style={{fontSize:11,color:C.gray,marginBottom:4}}>Active now</div>
        <div style={{fontSize:24,fontWeight:700,color:C.ink}}>{liveInventory.filter(d=>['rented','picked_up'].includes(d.status)).length}</div>
        <div style={{fontSize:11,color:'var(--text-info)',marginTop:2}}>dresses currently out</div>
      </div>
      <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:12,padding:16}}>
        <div style={{fontSize:11,color:C.gray,marginBottom:4}}>Reserved</div>
        <div style={{fontSize:24,fontWeight:700,color:C.ink}}>{liveInventory.filter(d=>d.status==='reserved').length}</div>
        <div style={{fontSize:11,color:'var(--text-warning)',marginTop:2}}>upcoming pickups</div>
      </div>
    </div>
    {/* Filter bar */}
    <div style={{display:'flex',gap:8,marginBottom:16,alignItems:'center'}}>
      <div style={{flex:1,position:'relative'}}>
        <span style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:C.gray,pointerEvents:'none',fontSize:13}}>🔍</span>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search dress, client…" style={{...inputSt,paddingLeft:30,margin:0,width:'100%'}}/>
      </div>
      <div style={{display:'flex',gap:4}}>
        {[['all','All time'],['month','This month'],['quarter','This quarter']].map(([id,l])=>(
          <button key={id} onClick={()=>setHistoryFilter(id)} style={{padding:'5px 12px',borderRadius:999,border:`1px solid ${historyFilter===id?C.rosa:C.border}`,background:historyFilter===id?C.rosaPale:'transparent',color:historyFilter===id?C.rosaText:C.gray,fontSize:11,cursor:'pointer'}}>{l}</button>
        ))}
      </div>
      <GhostBtn label="📥 Export CSV" onClick={()=>{
        const rows=[['SKU','Dress','Client','Status','Return due'],
          ...liveInventory.filter(d=>['rented','reserved','picked_up','returned'].includes(d.status)).map(d=>[d.sku,d.name,d.client?.name||d.client||'',d.status,d.return_date||''])];
        const csv=rows.map(r=>r.join(',')).join('\n');
        const blob=new Blob([csv],{type:'text/csv'});
        const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`belori-rental-history-${new Date().toISOString().split('T')[0]}.csv`;a.click();
        toast('CSV downloaded');
      }}/>
    </div>
    {/* History table */}
    <div style={{background:C.white,borderRadius:12,border:`1px solid ${C.border}`,overflow:'hidden'}}>
      <table style={{width:'100%',borderCollapse:'collapse'}}>
        <thead>
          <tr style={{background:C.ivory,borderBottom:`1px solid ${C.border}`}}>
            {['Dress','Client','Status','Return due','Fee'].map(h=>(
              <th key={h} style={{padding:'8px 14px',textAlign:'left',fontSize:11,fontWeight:600,color:C.gray,letterSpacing:'0.04em'}}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {liveInventory.filter(d=>{
            if(!['rented','reserved','picked_up','returned'].includes(d.status))return false;
            const q=search.toLowerCase();
            return !q||(d.name+' '+(d.client?.name||d.client||'')+' '+d.sku).toLowerCase().includes(q);
          }).map(d=>(
            <tr key={d.id} style={{borderBottom:`1px solid ${C.border}`}} onMouseEnter={e=>e.currentTarget.style.background=C.ivory} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
              <td style={{padding:'10px 14px'}}>
                <div style={{fontSize:13,fontWeight:500,color:C.ink}}>{d.name}</div>
                <div style={{fontSize:11,color:C.gray,fontFamily:'monospace'}}>#{d.sku}</div>
              </td>
              <td style={{padding:'10px 14px',fontSize:12,color:C.ink}}>{d.client?.name||d.client||'—'}</td>
              <td style={{padding:'10px 14px'}}><Badge text={d.status} bg={d.status==='returned'?C.grayBg:'var(--bg-info)'} color={d.status==='returned'?C.gray:'var(--text-info)'}/></td>
              <td style={{padding:'10px 14px',fontSize:12,color:C.gray}}>{d.return_date||'—'}</td>
              <td style={{padding:'10px 14px',fontSize:12,fontWeight:500,color:C.ink}}>{d.price?fmt(d.price):'—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);
export default HistoryTab;
