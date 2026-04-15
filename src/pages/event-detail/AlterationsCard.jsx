import React from 'react';
import { C, fmt } from '../../lib/colors';
import { Card, Badge } from '../../lib/ui.jsx';

const AlterationsCard = ({
  ev,
  alteration,
  staff,
  setShowAddAlt,
  setAltEditForm,
  setShowEditAlt
}) => {
  if (!ev.services?.includes('alterations')) return null;

  return (
    <Card>
      <div className="card-header">
        <div className="card-header-title">
          <span>✂ Alterations</span>
          {alteration && (
            <span style={{fontSize:11,color:C.gray}}>
              1 active job · {staff.find(s => s.id === alteration.seamstress_id)?.name || 'Unassigned'}
            </span>
          )}
        </div>
        <button onClick={() => setShowAddAlt(true)} className="card-header-action">+ Add job</button>
      </div>
      
      {alteration ? (
        <div className="card-body">
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:1,background:C.border,borderRadius:8,overflow:'hidden',marginBottom:10}}>
            {[['measurement_needed','Measure'],['in_progress','In progress'],['fitting_scheduled','Fitting'],['complete','Complete']].map(([s, label]) => {
              const active = alteration.status === s;
              return (
                <div key={s} style={{background:active ? C.rosaPale : C.white, padding:'8px 4px', textAlign:'center'}}>
                  <div style={{fontSize:10,color:active ? C.rosaText : C.gray, fontWeight:active ? 500 : 400, lineHeight:1.3}}>{label}</div>
                  {active && (
                    <div style={{marginTop:4,background:C.white,border:`1px solid ${C.border}`,borderRadius:5,padding:'3px 5px',fontSize:10,color:C.ink}}>
                      {ev.client?.split(' ')[0] || 'Client'}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',fontSize:11,color:C.gray,marginBottom:8}}>
            <span>
              Seamstress: <strong style={{color:C.ink}}>{staff.find(s=>s.id===alteration.seamstress_id)?.name||'Unassigned'}</strong> · 
              Quoted: <strong style={{color:C.ink}}>{fmt(alteration.price)}</strong>
              {alteration.deadline && <> · Deadline: <strong style={{color:C.ink}}>{new Date(alteration.deadline+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}</strong></>}
            </span>
            <button onClick={() => {
              setAltEditForm({
                status: alteration.status || '',
                seamstress_id: alteration.seamstress_id || '',
                deadline: alteration.deadline || '',
                price: String(alteration.price || '')
              });
              setShowEditAlt(true);
            }} style={{fontSize:11,color:C.rosaText,background:'none',border:'none',cursor:'pointer',fontWeight:500}}>Edit job</button>
          </div>
          
          <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
            {alteration.work_items?.map(w => <Badge key={w.id} text={w.description} bg={C.blueBg} color={C.blue}/>)}
          </div>
        </div>
      ) : (
        <div style={{padding:'20px 16px',textAlign:'center',fontSize:12,color:C.gray}}>
          No alteration jobs yet.<br/>
          <span onClick={() => setShowAddAlt(true)} style={{color:C.rosaText,cursor:'pointer',fontWeight:500}}>+ Create alteration job →</span>
        </div>
      )}
    </Card>
  );
};

export default AlterationsCard;
