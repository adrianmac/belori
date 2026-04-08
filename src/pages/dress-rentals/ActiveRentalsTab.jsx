import React from 'react';
import { C } from '../../lib/colors';

export const ActiveRentalsTab = ({ overdueItems, onTimeItems, reservedItems, RentalRow }) => (
  <div>
    {overdueItems.length===0&&onTimeItems.length===0&&reservedItems.length===0&&(
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
  </div>
);

export default ActiveRentalsTab;
