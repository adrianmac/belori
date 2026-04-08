import React from 'react';
import { C } from '../../lib/colors';

export const QRModal = ({dress, onClose}) => {
  const url=`https://belori.app/scan/${dress.id}`;
  const qrSrc=`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}&margin=2&color=1C1012`;
  
  return (
    <div className="modal-overlay" style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}}>
      <div style={{background:C.white,borderRadius:16,width:320,display:'flex',flexDirection:'column',overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,0.15)'}}>
        <div style={{padding:'18px 22px 14px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div style={{fontWeight:600,fontSize:15,color:C.ink}}>QR label — #{dress.sku}</div>
          <button onClick={onClose} style={{background:'none',border:'none',fontSize:22,cursor:'pointer',color:C.gray,lineHeight:1}}>×</button>
        </div>
        <div style={{padding:24,display:'flex',flexDirection:'column',alignItems:'center',gap:14}}>
          <div style={{border:`1px solid ${C.border}`,borderRadius:12,padding:20,textAlign:'center',display:'flex',flexDirection:'column',alignItems:'center',gap:8,background:C.white}}>
            <img src={qrSrc} alt="QR code" width={180} height={180} style={{display:'block'}}/>
            <div style={{fontFamily:'monospace',fontWeight:600,fontSize:14,color:C.ink}}>#{dress.sku}</div>
            <div style={{fontSize:11,color:C.gray}}>{dress.name?.length>26?dress.name.slice(0,24)+'…':dress.name}</div>
            <div style={{fontSize:9,color:C.inkLight,letterSpacing:'0.06em'}}>■ BELORI</div>
          </div>
          <div style={{fontSize:10,color:C.gray,textAlign:'center',wordBreak:'break-all'}}>{url.slice(0,40)}…</div>
          <div style={{display:'flex',gap:8,width:'100%'}}>
            <a href={qrSrc} download={`qr-${dress.sku}.png`} style={{flex:1,textAlign:'center',padding:'9px',borderRadius:8,border:`1px solid ${C.border}`,color:C.gray,fontSize:12,cursor:'pointer',textDecoration:'none'}}>Download PNG</a>
            <button onClick={()=>window.print()} style={{flex:1,padding:'9px',borderRadius:8,border:`1px solid ${C.rosa}`,background:C.rosaPale,color:C.rosa,fontSize:12,cursor:'pointer',fontWeight:500}}>Print label</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QRModal;
