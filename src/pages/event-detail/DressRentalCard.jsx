import React from 'react';
import { C, fmt } from '../../lib/colors';
import { Card, PrimaryBtn, Badge } from '../../lib/ui.jsx';

const DressRentalCard = ({
  ev,
  dressRental,
  setRentalForm,
  setShowEditRental,
  updateDress,
  toast,
  createMilestone,
  setScreen
}) => {
  if (!ev.services?.includes('dress_rental')) return null;

  return (
    <Card>
      <div className="card-header">
        <span className="card-header-title">👗 Dress rental</span>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          {dressRental ? <>
            <button onClick={()=>{
              setRentalForm({
                pickup_date: dressRental.pickupDate || '',
                return_date: dressRental.returnDate || '',
                fee: String(dressRental.fee || dressRental.price || ''),
                deposit_paid: !!dressRental.depositPaid
              });
              setShowEditRental(true);
            }} className="card-header-action">Edit</button>
            {dressRental.status === 'reserved' && (
              <PrimaryBtn label="Mark picked up" colorScheme="success" onClick={async()=>{
                if(updateDress && dressRental.id) {
                  await updateDress(dressRental.id, {status:'picked_up', pickup_date: new Date().toISOString().slice(0,10)});
                }
                toast('Dress marked as picked up ✓');
              }} style={{fontSize:11,padding:'6px 12px'}}/>
            )}
            {dressRental.status === 'rented' && (
              <PrimaryBtn label="Log return" colorScheme="success" onClick={async()=>{
                if(updateDress && dressRental.id) {
                  await updateDress(dressRental.id, {status:'returned'});
                }
                toast('Return logged ✓');
              }} style={{fontSize:11,padding:'6px 12px'}}/>
            )}
          </> : (
            <PrimaryBtn label="Reserve dress" colorScheme="info" onClick={()=>setScreen('inventory')} style={{fontSize:11,padding:'6px 12px'}}/>
          )}
        </div>
      </div>

      {dressRental ? (
        <div className="card-body">
          <div style={{display:'flex',gap:12,marginBottom:12}}>
            <div style={{width:52,height:66,background:'#F8F4F0',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              <svg viewBox="0 0 40 56" fill="none" style={{width:28,height:40}}>
                <path d="M20 4c-3 0-6 2-8 5L6 16v36h28V16l-6-7c-2-3-5-5-8-5z" stroke={C.rosa} strokeWidth="1.5" fill={C.rosaPale}/>
                <path d="M14 16c0-3 2.7-5 6-5s6 2 6 5" stroke={C.rosa} strokeWidth="1.3" fill="none"/>
              </svg>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:500,color:C.ink,marginBottom:2}}>{dressRental.name}</div>
              <div style={{fontSize:10,color:C.gray,fontFamily:'monospace',marginBottom:6}}>#{dressRental.sku} · Size {dressRental.size} · {dressRental.color}</div>
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                <span style={{fontSize:12,fontWeight:500,color:C.ink}}>{fmt(dressRental.fee)} rental</span>
                <Badge text={dressRental.depositPaid?'Deposit paid':'Deposit pending'} bg={dressRental.depositPaid?'var(--bg-success)':'var(--bg-warning)'} color={dressRental.depositPaid?'var(--text-success)':'var(--text-warning)'}/>
                <Badge text={dressRental.status==='reserved'?'Reserved':'Rented'} bg={C.grayBg} color={C.gray}/>
              </div>
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
            <div style={{background:'#F8F4F0',borderRadius:8,padding:'10px 12px'}}>
              <div style={{fontSize:9,color:C.gray,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:3}}>Pickup date</div>
              <div style={{fontSize:13,fontWeight:500,color:C.ink}}>{dressRental.pickupDate}</div>
              <div style={{fontSize:11,color:C.gray}}>{dressRental.pickupTime}</div>
            </div>
            <div style={{background:'#F8F4F0',borderRadius:8,padding:'10px 12px'}}>
              <div style={{fontSize:9,color:C.gray,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:3}}>Return due</div>
              <div style={{fontSize:13,fontWeight:500,color:C.ink}}>{dressRental.returnDate}</div>
              <div style={{fontSize:11,color:C.gray}}>{dressRental.returnTime} · $25/day late</div>
            </div>
          </div>
          {createMilestone && dressRental.fee > 0 && (() => {
            const milestones = ev.milestones || [];
            const hasDeposit = milestones.some(m => m.label === 'Dress deposit');
            const hasRentalFee = milestones.some(m => m.label === 'Dress rental fee');
            if (hasDeposit && hasRentalFee) return null;
            return (
              <div style={{marginTop:10,display:'flex',gap:8}}>
                {!hasDeposit && (
                  <PrimaryBtn label="💳 Take deposit" colorScheme="success" style={{fontSize:11,padding:'6px 12px',flex:1}} onClick={async()=>{
                    await createMilestone({
                      event_id: ev.id,
                      label: 'Dress deposit',
                      amount: dressRental.deposit || Math.round(dressRental.fee * 0.65),
                      due_date: dressRental.pickupDate && dressRental.pickupDate !== '—' ? dressRental.pickupDate : new Date().toISOString().slice(0,10),
                      status: 'pending'
                    });
                    toast('Deposit milestone created ✓');
                  }}/>
                )}
                {!hasRentalFee && (
                  <PrimaryBtn label="💳 Take rental fee" colorScheme="success" style={{fontSize:11,padding:'6px 12px',flex:1}} onClick={async()=>{
                    await createMilestone({
                      event_id: ev.id,
                      label: 'Dress rental fee',
                      amount: dressRental.fee,
                      due_date: dressRental.pickupDate && dressRental.pickupDate !== '—' ? dressRental.pickupDate : new Date().toISOString().slice(0,10),
                      status: 'pending'
                    });
                    toast('Rental fee milestone created ✓');
                  }}/>
                )}
              </div>
            );
          })()}
        </div>
      ) : (
        <div style={{padding:'20px 16px',textAlign:'center',fontSize:12,color:C.gray}}>
          No dress reserved yet.<br/>
          <span onClick={()=>setScreen('inventory')} style={{color:C.rosaText,cursor:'pointer',fontWeight:500}}>Browse available dresses →</span>
        </div>
      )}
    </Card>
  );
};

export default DressRentalCard;
