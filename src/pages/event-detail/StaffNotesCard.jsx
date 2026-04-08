import React from 'react';
import { C } from '../../lib/colors';
import { Card, Avatar } from '../../lib/ui.jsx';

const StaffNotesCard = ({
  notes,
  note,
  setNote,
  handleAddNote
}) => {
  return (
    <Card>
      <div className="card-header">
        <span className="card-header-title">📋 Staff notes</span>
        <span style={{fontSize:11,color:C.gray}}>{notes.length} notes</span>
      </div>
      <div style={{padding:'0 16px'}}>
        {notes.map((n, i, arr) => (
          <div key={n.id || i} style={{paddingTop:12,paddingBottom:12,borderBottom:i<arr.length-1?`1px solid ${C.border}`:'none'}}>
            <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
              <Avatar initials={n.author?.initials||n.init||'?'} size={22} bg={(n.author?.color||n.col||C.rosa)+'22'} color={n.author?.color||n.col||C.rosa}/>
              <span style={{fontSize:11,fontWeight:500,color:C.ink}}>{n.author?.name||n.auth||'Staff'}</span>
              <span style={{fontSize:10,color:C.gray}}>{n.created_at?new Date(n.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric'}):n.time}</span>
            </div>
            <div style={{fontSize:12,color:C.gray,lineHeight:1.55,paddingLeft:28}}>{n.text}</div>
          </div>
        ))}
        {notes.length === 0 && <div style={{padding:'16px 0',fontSize:12,color:C.gray,textAlign:'center'}}>No notes yet.</div>}
      </div>
      <div style={{padding:'10px 16px',borderTop:`1px solid ${C.border}`,display:'flex',gap:8}}>
        <input 
          value={note} 
          onChange={e => setNote(e.target.value)} 
          onKeyDown={e => e.key === 'Enter' && handleAddNote()} 
          placeholder="Add a note visible to all staff..." 
          style={{flex:1,padding:'8px 12px',borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,color:C.ink,outline:'none',boxSizing:'border-box'}}
        />
        {note.trim() && (
          <button onClick={handleAddNote} style={{padding:'8px 14px',borderRadius:8,background:C.rosa,color:C.white,border:'none',fontSize:12,cursor:'pointer',fontWeight:500}}>
            Save
          </button>
        )}
      </div>
    </Card>
  );
};

export default StaffNotesCard;
