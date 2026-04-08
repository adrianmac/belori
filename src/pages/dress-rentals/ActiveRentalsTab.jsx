import React from 'react';
import { C } from '../../lib/colors';

export const ActiveRentalsTab = ({ overdueItems, onTimeItems, reservedItems, cleaningItems = [], handleMarkAvailable, RentalRow }) => (
  <div>
    {overdueItems.length===0&&onTimeItems.length===0&&reservedItems.length===0&&cleaningItems.length===0&&(
      <div style={{textAlign:'center',padding:60,color:C.gray}}>
        <div style={{fontSize:36,marginBottom:8}}>✓</div>
        <div style={{fontSize:14,fontWeight:500,color:C.ink}}>No active rentals</div>
        <div style={{fontSize:12,marginTop:4}}>All dresses are available or in cleaning</div>
      </div>
    )}
    {/* Overdue section */}
    {overdueItems.length>0&&(
      <div>
        <div style={{padding:'12px 20px',background:'#FEF2F2',borderBottom:'1px solid #FCA5A5',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div style={{fontSize:12,fontWeight:700,color:C.red,textTransform:'uppercase',letterSpacing:'0.06em'}}>⚠ Overdue returns ({overdueItems.length})</div>
        </div>
        {overdueItems.map(d=><RentalRow key={d.id} d={d} section="overdue"/>)}
      </div>
    )}
    {/* Currently rented */}
    {onTimeItems.length>0&&(
      <div>
        <div style={{padding:'12px 20px',background:C.ivory,borderBottom:`1px solid ${C.border}`}}>
          <span style={{fontSize:12,fontWeight:700,color:C.ink,textTransform:'uppercase',letterSpacing:'0.06em'}}>Currently rented ({onTimeItems.length})</span>
        </div>
        {onTimeItems.map(d=><RentalRow key={d.id} d={d} section="rented"/>)}
      </div>
    )}
    {/* Upcoming pickups */}
    {reservedItems.length>0&&(
      <div>
        <div style={{padding:'12px 20px',background:C.ivory,borderBottom:`1px solid ${C.border}`}}>
          <span style={{fontSize:12,fontWeight:700,color:C.ink,textTransform:'uppercase',letterSpacing:'0.06em'}}>Upcoming pickups ({reservedItems.length})</span>
        </div>
        {reservedItems.map(d=><RentalRow key={d.id} d={d} section="reserved"/>)}
      </div>
    )}
    {/* Cleaning */}
    {cleaningItems.length>0&&(
      <div>
        <div style={{padding:'12px 20px',background:'#F5F3FF',borderBottom:'1px solid #DDD6FE'}}>
          <span style={{fontSize:12,fontWeight:700,color:'#5B21B6',textTransform:'uppercase',letterSpacing:'0.06em'}}>🧺 In cleaning ({cleaningItems.length})</span>
        </div>
        {cleaningItems.map(d=>(
          <div key={d.id} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 16px',minHeight:64,background:'#FDFBFF',borderBottom:`1px solid #EDE9FE`}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <span style={{fontSize:13,fontWeight:500,color:'#1F1729'}}>{d.name}</span>
                <span style={{fontFamily:'monospace',fontSize:11,color:C.gray}}>#{d.sku}</span>
                <span style={{fontSize:10,padding:'2px 8px',borderRadius:8,background:'#EDE9FE',color:'#5B21B6',fontWeight:500}}>🧺 Cleaning</span>
              </div>
              <div style={{fontSize:12,color:C.gray,marginTop:2}}>
                {d.color&&<span>{d.color}</span>}
                {d.size&&<span> · Size {d.size}</span>}
              </div>
            </div>
            <button
              onClick={()=>handleMarkAvailable&&handleMarkAvailable(d.id)}
              style={{padding:'6px 14px',borderRadius:6,border:`1px solid var(--color-success, #16A34A)`,background:'transparent',color:'var(--color-success, #16A34A)',fontSize:11,fontWeight:500,cursor:'pointer',whiteSpace:'nowrap',flexShrink:0}}
            >
              ✓ Mark available
            </button>
          </div>
        ))}
      </div>
    )}
  </div>
);

export default ActiveRentalsTab;
