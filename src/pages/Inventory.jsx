import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { C, fmt } from '../lib/colors';
import { supabase } from '../lib/supabase';
import { Avatar, Badge, Card, CardHead, Topbar, PrimaryBtn, GhostBtn, useToast,
  inputSt, LBL } from '../lib/ui.jsx';
import { useLayoutMode } from '../hooks/useLayoutMode.jsx';
import { DRESS_TRANSITIONS } from '../lib/urgency.js';
import { useAuth } from '../context/AuthContext';
import AddDressModal from '../components/modals/AddDressModal';
import DressLifecycleModal from '../components/modals/DressLifecycleModal';
import QRModal from '../components/modals/QRModal';
import ImportModal from '../components/modals/ImportModal';
import RentDressModal from '../components/modals/RentDressModal';
import BarcodeScanner from '../components/BarcodeScanner';
import DamageAssessmentModal, { DamageHistorySection } from '../components/DamageAssessmentModal';
import { useInventoryAuditAll } from '../hooks/useInventoryAudit';

// ─── INVENTORY ─────────────────────────────────────────────────────────────
const INV_CATS=[
  {id:'bridal_gown', group:'gowns',       label:'Bridal gowns',       icon:'👗', prefix:'BB',    track:'individual'},
  {id:'quince_gown', group:'gowns',       label:'Quinceañera gowns',  icon:'👗', prefix:'QG',    track:'individual'},
  {id:'arch',        group:'decoration',  label:'Arches & backdrops', icon:'🌸', prefix:'ARCH',  track:'individual'},
  {id:'centerpiece', group:'decoration',  label:'Centerpieces',       icon:'💐', prefix:'CTR',   track:'quantity'},
  {id:'linen',       group:'decoration',  label:'Linens',             icon:'🪢', prefix:'LIN',   track:'quantity'},
  {id:'lighting',    group:'decoration',  label:'Lighting',           icon:'💡', prefix:'LIGHT', track:'quantity'},
  {id:'chair',       group:'decoration',  label:'Chairs & seating',   icon:'🪑', prefix:'CHAIR', track:'quantity'},
  {id:'veil',        group:'accessories', label:'Veils',              icon:'🤍', prefix:'VL',    track:'individual'},
  {id:'headpiece',   group:'accessories', label:'Headpieces & tiaras',icon:'👑', prefix:'HP',    track:'individual'},
  {id:'jewelry',     group:'accessories', label:'Jewelry sets',       icon:'💎', prefix:'JWL',   track:'individual'},
  {id:'ceremony',    group:'planning',    label:'Ceremony items',     icon:'🕊', prefix:'CER',   track:'individual'},
  {id:'consumable',  group:'consumables', label:'Consumables',        icon:'📦', prefix:'CON',   track:'consumable'},
  {id:'equipment',   group:'equipment',   label:'Equipment',          icon:'🎤', prefix:'EQP',   track:'individual'},
];
const INV_GROUPS={gowns:'Gowns',decoration:'Decoration',accessories:'Accessories',planning:'Planning supplies',consumables:'Consumables',equipment:'Equipment'};

// ─── PHOTO CAPTURE (camera-based dress intake) ───────────────────────────────
const PhotoCapture = ({ boutique, onCapture, onError }) => {
  const [stream, setStream] = useState(null)
  const [hasPhoto, setHasPhoto] = useState(false)
  const [uploading, setUploading] = useState(false)
  const videoRef = useRef(null)
  const toast = useToast()

  async function startCamera() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }, audio: false,
      })
      setStream(s)
      if (videoRef.current) videoRef.current.srcObject = s
    } catch (e) {
      onError?.('Camera access denied — please allow permissions.')
    }
  }

  useEffect(() => {
    if (stream && videoRef.current) videoRef.current.srcObject = stream
    return () => { if (stream) stream.getTracks().forEach(t => t.stop()) }
  }, [stream])

  async function takePhoto() {
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 1280
    canvas.height = video.videoHeight || 720
    canvas.getContext('2d').drawImage(video, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.82)
    // stop stream immediately after capture
    if (stream) stream.getTracks().forEach(t => t.stop())
    setStream(null)
    setHasPhoto(true)
    setUploading(true)
    try {
      const res = await fetch(dataUrl)
      const blob = await res.blob()
      const filename = `${boutique?.id || 'inv'}/${Date.now()}.jpg`
      const { error: upErr } = await supabase.storage
        .from('inventory-photos')
        .upload(filename, blob, { contentType: 'image/jpeg', upsert: true })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage
        .from('inventory-photos')
        .getPublicUrl(filename)
      onCapture(publicUrl)
      toast('Photo saved ✓')
    } catch (e) {
      onError?.('Photo upload failed: ' + (e.message || e))
      setHasPhoto(false)
    } finally {
      setUploading(false)
    }
  }

  if (hasPhoto) {
    return (
      <div style={{ padding: '8px 12px', background: C.grayBg, borderRadius: 8, fontSize: 12, color: C.gray, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>📸</span>
        <span>{uploading ? 'Uploading photo…' : 'Photo captured and saved ✓'}</span>
      </div>
    )
  }

  if (!stream) {
    return (
      <button
        type="button"
        onClick={startCamera}
        style={{
          width: '100%', padding: '18px 10px',
          border: `2px dashed ${C.border}`, borderRadius: 10,
          background: C.ivory, cursor: 'pointer',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        }}
      >
        <span style={{ fontSize: 24 }}>📸</span>
        <span style={{ fontSize: 12, color: C.gray, fontWeight: 500 }}>Take a photo of the dress</span>
        <span style={{ fontSize: 11, color: C.inkLight }}>Auto-saves to inventory on capture</span>
      </button>
    )
  }

  return (
    <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden' }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ width: '100%', display: 'block', maxHeight: 200, objectFit: 'cover', borderRadius: 10 }}
      />
      <button
        type="button"
        onClick={takePhoto}
        style={{
          position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
          padding: '8px 22px', background: C.rosa, color: '#fff',
          border: 'none', borderRadius: 20, fontWeight: 600, fontSize: 13, cursor: 'pointer',
        }}
      >
        Capture
      </button>
    </div>
  )
}

// ─── ADD ITEM MODAL ──────────────────────────────────────────────────────────
const AddItemModal = ({onClose,onCreate,boutique}) => {
  const [catId,setCatId]=useState('bridal_gown');
  const cat=INV_CATS.find(c=>c.id===catId)||INV_CATS[0];
  const [name,setName]=useState('');
  const [sku,setSku]=useState('');
  const [color,setColor]=useState('');
  const [sizeOrDim,setSizeOrDim]=useState('');
  const [notes,setNotes]=useState('');
  const [tracking,setTracking]=useState('individual');
  const [totalQty,setTotalQty]=useState('');
  const [minStock,setMinStock]=useState('');
  const [currentStock,setCurrentStock]=useState('');
  const [restockPoint,setRestockPoint]=useState('');
  const [restockQty,setRestockQty]=useState('');
  const [unit,setUnit]=useState('box');
  const [price,setPrice]=useState('');
  const [deposit,setDeposit]=useState('');
  const [replaceCost,setReplaceCost]=useState('');
  const [condition,setCondition]=useState('excellent');
  const [imageFile,setImageFile]=useState(null);
  const [imagePreview,setImagePreview]=useState(null);
  const [capturedPhotoUrl,setCapturedPhotoUrl]=useState(null);
  const [saving,setSaving]=useState(false);
  const [err,setErr]=useState('');
  const galleryRef=useRef();
  const cameraRef=useRef();

  useEffect(()=>{setTracking(INV_CATS.find(c=>c.id===catId)?.track||'individual');},[catId]);
  const autoSku=()=>{if(!sku)setSku(`${cat.prefix}-${String(Math.floor(Math.random()*900)+100).padStart(3,'0')}`)};

  const handleFile=(file)=>{
    if(!file)return;
    if(file.size>5*1024*1024){setErr('Image must be under 5 MB');return;}
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setErr('');
  };

  const confirm=async()=>{
    if(!name.trim())return setErr('Name is required');
    if(!sku.trim())return setErr('SKU is required');
    if(tracking!=='consumable'&&(!price||Number(price)<=0))return setErr('Rental price is required');
    if(tracking==='individual'&&deposit&&Number(deposit)>Number(price))return setErr('Deposit cannot exceed the rental price');
    setSaving(true);setErr('');

    let image_url=null;
    if(imageFile){
      const ext=imageFile.name.split('.').pop().replace(/[^a-z0-9]/gi,'');
      const path=`${Date.now()}-${sku.trim().replace(/[^a-zA-Z0-9]/g,'-')}.${ext}`;
      const {error:upErr}=await supabase.storage.from('dress-images').upload(path,imageFile,{upsert:true,contentType:imageFile.type});
      if(upErr){setSaving(false);setErr('Image upload failed: '+upErr.message);return;}
      const {data:pub}=supabase.storage.from('dress-images').getPublicUrl(path);
      image_url=pub?.publicUrl||null;
    }

    // Use gallery/camera file upload URL, or the camera-captured photo URL
    const final_image_url = image_url || capturedPhotoUrl || null;
    const payload={sku,name,category:catId,group:cat.group,color,size:sizeOrDim,track:tracking,price:Number(price)||0,deposit:Number(deposit)||0,status:'available',notes,condition,
      ...(final_image_url?{image_url:final_image_url,photo_url:final_image_url}:{}),
      ...(tracking==='quantity'?{totalQty:Number(totalQty)||1,availQty:Number(totalQty)||1,reservedQty:0,outQty:0,dmgQty:0,minStock:Number(minStock)||1}:{}),
      ...(tracking==='consumable'?{currentStock:Number(currentStock)||0,restockPoint:Number(restockPoint)||0,restockQty:Number(restockQty)||0,unit}:{})};
    const res=await onCreate?.(payload);
    if(res?.error)setErr(res.error.message||'Could not add item');
    else onClose();
    setSaving(false);
  };

  return (
    <div className="modal-overlay" style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
      <div style={{background:C.white,borderRadius:16,width:500,maxHeight:'92vh',display:'flex',flexDirection:'column',boxShadow:'0 20px 60px rgba(0,0,0,0.15)'}}>
        <div style={{padding:'20px 24px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div style={{fontSize:16,fontWeight:600,color:C.ink}}>Add inventory item</div>
          <button onClick={onClose} style={{background:'none',border:'none',fontSize:20,color:C.gray,cursor:'pointer',lineHeight:1}}>×</button>
        </div>
        <div style={{flex:1,overflowY:'auto',padding:'20px 24px'}}>

          {/* Photo */}
          <div style={{fontSize:10,fontWeight:600,color:C.gray,letterSpacing:'0.08em',marginBottom:10}}>PHOTO (OPTIONAL)</div>
          {/* Hidden inputs — gallery + file-based camera */}
          <input ref={galleryRef} type="file" accept="image/*" style={{display:'none'}} onChange={e=>handleFile(e.target.files[0])}/>
          <input ref={cameraRef}  type="file" accept="image/*" capture="environment" style={{display:'none'}} onChange={e=>handleFile(e.target.files[0])}/>

          {/* Live camera capture (BarcodeDetector-style, uses getUserMedia) */}
          {!imagePreview&&!capturedPhotoUrl&&(
            <div style={{marginBottom:10}}>
              <PhotoCapture
                boutique={boutique}
                onCapture={url=>{setCapturedPhotoUrl(url);}}
                onError={msg=>setErr(msg)}
              />
            </div>
          )}
          {capturedPhotoUrl&&!imagePreview&&(
            <div style={{position:'relative',marginBottom:10}}>
              <img src={capturedPhotoUrl} alt="captured" style={{width:'100%',maxHeight:160,objectFit:'cover',borderRadius:10,border:`1px solid ${C.border}`,display:'block'}}/>
              <button onClick={()=>setCapturedPhotoUrl(null)} style={{position:'absolute',top:6,right:6,background:'rgba(0,0,0,0.55)',border:'none',borderRadius:'50%',width:26,height:26,color:'#fff',cursor:'pointer',fontSize:15,lineHeight:'26px',textAlign:'center'}}>×</button>
              <div style={{position:'absolute',bottom:8,left:8,background:'rgba(0,0,0,0.55)',borderRadius:6,padding:'2px 8px',fontSize:10,color:'#fff'}}>📸 Live capture</div>
            </div>
          )}

          {/* File-based options */}
          {!capturedPhotoUrl&&(imagePreview?(
            <div style={{position:'relative',marginBottom:16}}>
              <img src={imagePreview} alt="preview" style={{width:'100%',maxHeight:160,objectFit:'cover',borderRadius:10,border:`1px solid ${C.border}`,display:'block'}}/>
              <button onClick={()=>{setImageFile(null);setImagePreview(null);}} style={{position:'absolute',top:6,right:6,background:'rgba(0,0,0,0.55)',border:'none',borderRadius:'50%',width:26,height:26,color:'#fff',cursor:'pointer',fontSize:15,lineHeight:'26px',textAlign:'center'}}>×</button>
            </div>
          ):(
            <div style={{marginBottom:16,display:'flex',gap:8}}>
              <button onClick={()=>cameraRef.current.click()} style={{flex:1,padding:'10px',borderRadius:10,border:`1.5px solid ${C.border}`,background:C.white,cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
                <span style={{fontSize:18}}>📂</span>
                <span style={{fontSize:11,color:C.gray,fontWeight:500}}>Camera (file)</span>
              </button>
              <button onClick={()=>galleryRef.current.click()} style={{flex:1,padding:'10px',borderRadius:10,border:`1.5px solid ${C.border}`,background:C.white,cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
                <span style={{fontSize:18}}>🖼️</span>
                <span style={{fontSize:11,color:C.gray,fontWeight:500}}>Upload file</span>
              </button>
            </div>
          ))}

          {/* Category & Identity */}
          <div style={{fontSize:10,fontWeight:600,color:C.gray,letterSpacing:'0.08em',marginBottom:10}}>CATEGORY & IDENTITY</div>
          <div style={LBL}>Category *</div>
          <select value={catId} onChange={e=>setCatId(e.target.value)} style={inputSt}>
            {Object.entries(INV_GROUPS).map(([gid,glabel])=>(
              <optgroup key={gid} label={glabel}>
                {INV_CATS.filter(c=>c.group===gid).map(c=><option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
              </optgroup>
            ))}
          </select>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:10}}>
            <div>
              <div style={LBL}>Item name *</div>
              <input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Gold metal arch" style={inputSt}/>
            </div>
            <div>
              <div style={LBL}>SKU *</div>
              <input value={sku} onChange={e=>setSku(e.target.value)} onFocus={autoSku} placeholder={`${cat.prefix}-001`} style={inputSt}/>
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:10}}>
            <div>
              <div style={LBL}>Color</div>
              <input value={color} onChange={e=>setColor(e.target.value)} placeholder="e.g. Ivory, Gold" style={inputSt}/>
            </div>
            <div>
              <div style={LBL}>Size / Dimensions</div>
              <input value={sizeOrDim} onChange={e=>setSizeOrDim(e.target.value)} placeholder={cat.group==='gowns'?'e.g. 8':'e.g. 6ft×30in'} style={inputSt}/>
            </div>
          </div>

          {/* Tracking Mode */}
          <div style={{fontSize:10,fontWeight:600,color:C.gray,letterSpacing:'0.08em',margin:'18px 0 10px'}}>TRACKING MODE</div>
          {[['individual','Single item','One unique unit — gown, arch, veil'],['quantity','Quantity pool','Multiple units tracked as a total — chairs, linens'],['consumable','Consumable','Used up, not returned — candles, ribbon, wire']].map(([v,l,d])=>(
            <button key={v} onClick={()=>setTracking(v)} style={{display:'flex',alignItems:'flex-start',gap:10,padding:'10px 12px',borderRadius:8,border:`2px solid ${tracking===v?C.rosa:C.border}`,background:tracking===v?C.rosaPale:C.white,cursor:'pointer',textAlign:'left',width:'100%',marginBottom:6}}>
              <div style={{width:14,height:14,borderRadius:'50%',border:`2px solid ${tracking===v?C.rosa:C.gray}`,background:tracking===v?C.rosa:'transparent',flexShrink:0,marginTop:2}}/>
              <div>
                <div style={{fontSize:13,fontWeight:tracking===v?500:400,color:tracking===v?C.rosa:C.ink}}>{l}</div>
                <div style={{fontSize:11,color:C.gray}}>{d}</div>
              </div>
            </button>
          ))}
          {tracking==='quantity'&&(
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:6}}>
              <div><div style={LBL}>Total quantity</div><input type="number" value={totalQty} onChange={e=>setTotalQty(e.target.value)} placeholder="85" style={inputSt}/></div>
              <div><div style={LBL}>Alert when below</div><input type="number" value={minStock} onChange={e=>setMinStock(e.target.value)} placeholder="10" style={inputSt}/></div>
            </div>
          )}
          {tracking==='consumable'&&(
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginTop:6}}>
              <div><div style={LBL}>In stock</div><input type="number" value={currentStock} onChange={e=>setCurrentStock(e.target.value)} placeholder="12" style={inputSt}/></div>
              <div><div style={LBL}>Restock at</div><input type="number" value={restockPoint} onChange={e=>setRestockPoint(e.target.value)} placeholder="3" style={inputSt}/></div>
              <div><div style={LBL}>Unit</div><select value={unit} onChange={e=>setUnit(e.target.value)} style={inputSt}><option>box</option><option>roll</option><option>pack</option><option>piece</option><option>set</option></select></div>
            </div>
          )}

          {/* Pricing */}
          {tracking!=='consumable'&&(<>
            <div style={{fontSize:10,fontWeight:600,color:C.gray,letterSpacing:'0.08em',margin:'18px 0 10px'}}>PRICING</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
              <div><div style={LBL}>Rental price</div><input type="number" value={price} onChange={e=>{setPrice(e.target.value);if(!deposit)setDeposit(String(Math.round(Number(e.target.value)*0.5)));}} placeholder="150" style={inputSt}/></div>
              <div><div style={LBL}>Deposit</div><input type="number" value={deposit} onChange={e=>setDeposit(e.target.value)} placeholder="100" style={inputSt}/></div>
              <div><div style={LBL}>Replacement cost</div><input type="number" value={replaceCost} onChange={e=>setReplaceCost(e.target.value)} placeholder="800" style={inputSt}/></div>
            </div>
          </>)}

          {/* Condition */}
          <div style={{fontSize:10,fontWeight:600,color:C.gray,letterSpacing:'0.08em',margin:'18px 0 10px'}}>INITIAL CONDITION</div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:12}}>
            {['new','excellent','good','fair','needs_repair'].map(c=>(
              <button key={c} onClick={()=>setCondition(c)} style={{padding:'5px 12px',borderRadius:999,border:`1.5px solid ${condition===c?C.rosa:C.border}`,background:condition===c?C.rosaPale:'transparent',color:condition===c?C.rosa:C.gray,fontSize:11,cursor:'pointer',fontWeight:condition===c?500:400}}>
                {c==='needs_repair'?'Needs repair':c.charAt(0).toUpperCase()+c.slice(1)}
              </button>
            ))}
          </div>
          <div style={LBL}>Notes (optional)</div>
          <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Any details about this item…" style={{...inputSt,minHeight:56,resize:'vertical'}}/>
          {err&&<div style={{fontSize:12,color:C.red,marginTop:8}}>{err}</div>}
        </div>
        <div style={{padding:'12px 24px',borderTop:`1px solid ${C.border}`,display:'flex',gap:8,justifyContent:'flex-end'}}>
          <GhostBtn label="Cancel" colorScheme="danger" onClick={onClose}/>
          <PrimaryBtn label={saving?'Adding…':'Add item'} colorScheme="success" onClick={confirm}/>
        </div>
      </div>
    </div>
  );
};

// ─── EDIT ITEM MODAL ─────────────────────────────────────────────────────────
const EditItemModal = ({item, onClose, onUpdate}) => {
  const cat0=INV_CATS.find(c=>c.id===item.category||c.id===item.cat)||INV_CATS[0];
  const [catId,setCatId]=useState(cat0.id);
  const cat=INV_CATS.find(c=>c.id===catId)||INV_CATS[0];
  const [name,setName]=useState(item.name||'');
  const [sku,setSku]=useState(item.sku||'');
  const [color,setColor]=useState(item.color||'');
  const [sizeOrDim,setSizeOrDim]=useState(item.size||'');
  const [notes,setNotes]=useState(item.notes||'');
  const [tracking,setTracking]=useState(item.track||cat0.track||'individual');
  const [totalQty,setTotalQty]=useState(String(item.totalQty||''));
  const [minStock,setMinStock]=useState(String(item.minStock||''));
  const [currentStock,setCurrentStock]=useState(String(item.currentStock||''));
  const [restockPoint,setRestockPoint]=useState(String(item.restockPoint||''));
  const [restockQty,setRestockQty]=useState(String(item.restockQty||''));
  const [unit,setUnit]=useState(item.unit||'box');
  const [price,setPrice]=useState(String(item.price||''));
  const [deposit,setDeposit]=useState(String(item.deposit||''));
  const [replaceCost,setReplaceCost]=useState(String(item.replaceCost||''));
  const [condition,setCondition]=useState(item.condition||'excellent');
  const [existingImg]=useState(item.image_url||null);
  const [imageFile,setImageFile]=useState(null);
  const [imagePreview,setImagePreview]=useState(item.image_url||null);
  const [saving,setSaving]=useState(false);
  const [err,setErr]=useState('');
  const galleryRef=useRef();
  const cameraRef=useRef();

  const handleFile=(file)=>{
    if(!file)return;
    if(file.size>5*1024*1024){setErr('Image must be under 5 MB');return;}
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setErr('');
  };

  const confirm=async()=>{
    if(!name.trim())return setErr('Name is required');
    if(!sku.trim())return setErr('SKU is required');
    if(tracking!=='consumable'&&(!price||Number(price)<=0))return setErr('Rental price is required');
    if(tracking==='individual'&&deposit&&Number(deposit)>Number(price))return setErr('Deposit cannot exceed the rental price');
    setSaving(true);setErr('');

    let image_url=existingImg;
    if(imageFile){
      const ext=imageFile.name.split('.').pop().replace(/[^a-z0-9]/gi,'');
      const path=`${Date.now()}-${sku.trim().replace(/[^a-zA-Z0-9]/g,'-')}.${ext}`;
      const {error:upErr}=await supabase.storage.from('dress-images').upload(path,imageFile,{upsert:true,contentType:imageFile.type});
      if(upErr){setSaving(false);setErr('Image upload failed: '+upErr.message);return;}
      const {data:pub}=supabase.storage.from('dress-images').getPublicUrl(path);
      image_url=pub?.publicUrl||null;
    } else if(!imagePreview) {
      image_url=null; // user removed image
    }

    const updates={sku,name,category:catId,group:cat.group,color,size:sizeOrDim,track:tracking,
      price:Number(price)||0,deposit:Number(deposit)||0,notes,condition,image_url,
      ...(tracking==='quantity'?{totalQty:Number(totalQty)||1,availQty:Number(totalQty)||1,minStock:Number(minStock)||1}:{}),
      ...(tracking==='consumable'?{currentStock:Number(currentStock)||0,restockPoint:Number(restockPoint)||0,restockQty:Number(restockQty)||0,unit}:{})};
    const res=await onUpdate?.(item.id, updates);
    if(res?.error)setErr(res.error.message||'Could not update item');
    else onClose();
    setSaving(false);
  };

  return(
    <div className="modal-overlay" style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
      <div style={{background:'white',borderRadius:16,width:500,maxHeight:'92vh',display:'flex',flexDirection:'column',boxShadow:'0 20px 60px rgba(0,0,0,0.15)'}}>
        <div style={{padding:'20px 24px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div style={{fontWeight:600,fontSize:16,color:C.ink}}>Edit item</div>
          <button onClick={onClose} style={{background:'none',border:'none',fontSize:20,color:C.gray,cursor:'pointer',lineHeight:1}}>×</button>
        </div>
        <div style={{flex:1,overflowY:'auto',padding:'20px 24px'}}>

          {/* Photo */}
          <div style={{fontSize:10,fontWeight:600,color:C.gray,letterSpacing:'0.08em',marginBottom:10}}>PHOTO</div>
          <input ref={galleryRef} type="file" accept="image/*" style={{display:'none'}} onChange={e=>handleFile(e.target.files[0])}/>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{display:'none'}} onChange={e=>handleFile(e.target.files[0])}/>
          {imagePreview?(
            <div style={{position:'relative',marginBottom:16}}>
              <img src={imagePreview} alt="preview" style={{width:'100%',maxHeight:160,objectFit:'cover',borderRadius:10,border:`1px solid ${C.border}`,display:'block'}}/>
              <div style={{position:'absolute',bottom:8,left:8,display:'flex',gap:6}}>
                <button onClick={()=>cameraRef.current.click()} style={{padding:'4px 10px',borderRadius:6,background:'rgba(0,0,0,0.55)',border:'none',color:'#fff',fontSize:11,cursor:'pointer'}}>📷 Retake</button>
                <button onClick={()=>galleryRef.current.click()} style={{padding:'4px 10px',borderRadius:6,background:'rgba(0,0,0,0.55)',border:'none',color:'#fff',fontSize:11,cursor:'pointer'}}>🖼️ Replace</button>
              </div>
              <button onClick={()=>{setImageFile(null);setImagePreview(null);}} style={{position:'absolute',top:6,right:6,background:'rgba(0,0,0,0.55)',border:'none',borderRadius:'50%',width:26,height:26,color:'#fff',cursor:'pointer',fontSize:15,lineHeight:'26px',textAlign:'center'}}>×</button>
            </div>
          ):(
            <div style={{marginBottom:16,display:'flex',gap:8}}>
              <button onClick={()=>cameraRef.current.click()} style={{flex:1,padding:'14px 10px',borderRadius:10,border:`2px dashed ${C.border}`,background:C.ivory,cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:5}}>
                <span style={{fontSize:22}}>📷</span>
                <span style={{fontSize:11,color:C.gray,fontWeight:500}}>Take photo</span>
              </button>
              <button onClick={()=>galleryRef.current.click()} style={{flex:1,padding:'14px 10px',borderRadius:10,border:`2px dashed ${C.border}`,background:C.ivory,cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:5}}>
                <span style={{fontSize:22}}>🖼️</span>
                <span style={{fontSize:11,color:C.gray,fontWeight:500}}>Upload file</span>
              </button>
            </div>
          )}

          {/* Category & Identity */}
          <div style={{fontSize:10,fontWeight:600,color:C.gray,letterSpacing:'0.08em',marginBottom:10}}>CATEGORY & IDENTITY</div>
          <div style={LBL}>Category</div>
          <select value={catId} onChange={e=>setCatId(e.target.value)} style={inputSt}>
            {Object.entries(INV_GROUPS).map(([gid,glabel])=>(
              <optgroup key={gid} label={glabel}>
                {INV_CATS.filter(c=>c.group===gid).map(c=><option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
              </optgroup>
            ))}
          </select>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:10}}>
            <div><div style={LBL}>Item name *</div><input value={name} onChange={e=>setName(e.target.value)} style={inputSt}/></div>
            <div><div style={LBL}>SKU *</div><input value={sku} onChange={e=>setSku(e.target.value)} style={inputSt}/></div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:10}}>
            <div><div style={LBL}>Color</div><input value={color} onChange={e=>setColor(e.target.value)} style={inputSt}/></div>
            <div><div style={LBL}>Size / Dimensions</div><input value={sizeOrDim} onChange={e=>setSizeOrDim(e.target.value)} style={inputSt}/></div>
          </div>

          {/* Tracking */}
          <div style={{fontSize:10,fontWeight:600,color:C.gray,letterSpacing:'0.08em',margin:'18px 0 10px'}}>TRACKING MODE</div>
          {[['individual','Single item','One unique unit'],['quantity','Quantity pool','Multiple units tracked as a total'],['consumable','Consumable','Used up, not returned']].map(([v,l,d])=>(
            <button key={v} onClick={()=>setTracking(v)} style={{display:'flex',alignItems:'flex-start',gap:10,padding:'10px 12px',borderRadius:8,border:`2px solid ${tracking===v?C.rosa:C.border}`,background:tracking===v?C.rosaPale:'white',cursor:'pointer',textAlign:'left',width:'100%',marginBottom:6}}>
              <div style={{width:14,height:14,borderRadius:'50%',border:`2px solid ${tracking===v?C.rosa:C.gray}`,background:tracking===v?C.rosa:'transparent',flexShrink:0,marginTop:2}}/>
              <div><div style={{fontSize:13,fontWeight:tracking===v?500:400,color:tracking===v?C.rosa:C.ink}}>{l}</div><div style={{fontSize:11,color:C.gray}}>{d}</div></div>
            </button>
          ))}
          {tracking==='quantity'&&(
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:6}}>
              <div><div style={LBL}>Total quantity</div><input type="number" value={totalQty} onChange={e=>setTotalQty(e.target.value)} style={inputSt}/></div>
              <div><div style={LBL}>Alert when below</div><input type="number" value={minStock} onChange={e=>setMinStock(e.target.value)} style={inputSt}/></div>
            </div>
          )}
          {tracking==='consumable'&&(
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginTop:6}}>
              <div><div style={LBL}>In stock</div><input type="number" value={currentStock} onChange={e=>setCurrentStock(e.target.value)} style={inputSt}/></div>
              <div><div style={LBL}>Restock at</div><input type="number" value={restockPoint} onChange={e=>setRestockPoint(e.target.value)} style={inputSt}/></div>
              <div><div style={LBL}>Unit</div><select value={unit} onChange={e=>setUnit(e.target.value)} style={inputSt}><option>box</option><option>roll</option><option>pack</option><option>piece</option><option>set</option></select></div>
            </div>
          )}

          {/* Pricing */}
          {tracking!=='consumable'&&(<>
            <div style={{fontSize:10,fontWeight:600,color:C.gray,letterSpacing:'0.08em',margin:'18px 0 10px'}}>PRICING</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
              <div><div style={LBL}>Rental price</div><input type="number" value={price} onChange={e=>setPrice(e.target.value)} style={inputSt}/></div>
              <div><div style={LBL}>Deposit</div><input type="number" value={deposit} onChange={e=>setDeposit(e.target.value)} style={inputSt}/></div>
              <div><div style={LBL}>Replacement cost</div><input type="number" value={replaceCost} onChange={e=>setReplaceCost(e.target.value)} style={inputSt}/></div>
            </div>
          </>)}

          {/* Condition */}
          <div style={{fontSize:10,fontWeight:600,color:C.gray,letterSpacing:'0.08em',margin:'18px 0 10px'}}>CONDITION</div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:12}}>
            {['new','excellent','good','fair','needs_repair'].map(c=>(
              <button key={c} onClick={()=>setCondition(c)} style={{padding:'5px 12px',borderRadius:999,border:`1.5px solid ${condition===c?C.rosa:C.border}`,background:condition===c?C.rosaPale:'transparent',color:condition===c?C.rosa:C.gray,fontSize:11,cursor:'pointer',fontWeight:condition===c?500:400}}>
                {c==='needs_repair'?'Needs repair':c.charAt(0).toUpperCase()+c.slice(1)}
              </button>
            ))}
          </div>
          <div style={LBL}>Notes</div>
          <textarea value={notes} onChange={e=>setNotes(e.target.value)} style={{...inputSt,minHeight:56,resize:'vertical'}}/>
          {err&&<div style={{fontSize:12,color:C.red,marginTop:8,background:'var(--bg-danger)',padding:'8px 12px',borderRadius:7}}>{err}</div>}
        </div>
        <div style={{padding:'12px 24px',borderTop:`1px solid ${C.border}`,display:'flex',gap:8,justifyContent:'flex-end'}}>
          <GhostBtn label="Cancel" colorScheme="danger" onClick={onClose}/>
          <PrimaryBtn label={saving?'Saving…':'Save changes'} colorScheme="success" onClick={confirm}/>
        </div>
      </div>
    </div>
  );
};

// ─── ITEM DETAIL PANEL ───────────────────────────────────────────────────────
const ItemDetailPanel = ({ item: d, SC, catIcon, onClose, onEdit, onQR, onRent, onLifecycle }) => {
  const s = SC[d.status] || { bg: C.grayBg, col: C.gray, label: d.status };
  const catDef = INV_CATS.find(c => c.id === (d.cat || d.category));
  const isGown = d.group === 'gowns';
  const isOverdue = d.status === 'rented' || d.status === 'overdue';
  const [damageModalOpen, setDamageModalOpen] = useState(false);

  const Row = ({ label, value, color }) => value ? (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
      <span style={{ fontSize: 12, color: C.gray }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 500, color: color || C.ink, textAlign: 'right', maxWidth: '60%' }}>{value}</span>
    </div>
  ) : null;

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 490 }}/>
      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 360,
        background: C.white, zIndex: 500,
        boxShadow: '-8px 0 40px rgba(0,0,0,0.12)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Photo header */}
        <div style={{ height: 200, background: C.ivory, position: 'relative', flexShrink: 0, overflow: 'hidden' }}>
          {(d.image_url || d.photo_url)
            ? <img src={d.image_url || d.photo_url} alt={d.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
            : isGown
              ? <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg viewBox="0 0 60 80" style={{ width: 80, height: 106, opacity: 0.3 }}>
                    <path d="M30 2c-4 0-10 3-10 10v8l-12 48h44L40 20V12C40 5 34 2 30 2Z" fill={C.rosa}/>
                    <ellipse cx="30" cy="12" rx="8" ry="6" fill={C.rosaLight}/>
                  </svg>
                </div>
              : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 56, opacity: 0.4 }}>{catIcon(d.cat)}</span>
                </div>
          }
          {/* Close button */}
          <button onClick={onClose} style={{ position: 'absolute', top: 12, right: 12, width: 30, height: 30, borderRadius: '50%', background: 'rgba(0,0,0,0.45)', border: 'none', color: '#fff', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>×</button>
          {/* Status badge */}
          <div style={{ position: 'absolute', bottom: 12, left: 12 }}>
            <span style={{ padding: '4px 10px', borderRadius: 999, background: s.bg, color: s.col, fontSize: 11, fontWeight: 600 }}>{s.label}</span>
          </div>
          {/* SKU badge */}
          <div style={{ position: 'absolute', top: 12, left: 12 }}>
            <span style={{ padding: '3px 8px', borderRadius: 6, background: 'rgba(0,0,0,0.45)', color: '#fff', fontSize: 11, fontFamily: 'monospace' }}>{d.sku}</span>
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          <div style={{ fontSize: 17, fontWeight: 600, color: C.ink, marginBottom: 2 }}>{d.name}</div>
          <div style={{ fontSize: 12, color: C.gray, marginBottom: 16 }}>
            {[catDef?.label, d.color, d.size ? `Size ${d.size}` : null].filter(Boolean).join(' · ')}
          </div>

          {/* Pricing */}
          {d.track !== 'consumable' && (d.price > 0 || d.deposit > 0) && (
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              {d.price > 0 && (
                <div style={{ flex: 1, background: C.ivory, borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: C.ink }}>{fmt(d.price)}</div>
                  <div style={{ fontSize: 10, color: C.gray, marginTop: 1 }}>per rental</div>
                </div>
              )}
              {d.deposit > 0 && (
                <div style={{ flex: 1, background: C.ivory, borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: C.ink }}>{fmt(d.deposit)}</div>
                  <div style={{ fontSize: 10, color: C.gray, marginTop: 1 }}>deposit</div>
                </div>
              )}
            </div>
          )}

          {/* Stock (quantity) */}
          {d.track === 'quantity' && (
            <div style={{ background: C.ivory, borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.gray, marginBottom: 8 }}>STOCK LEVELS</div>
              <div style={{ height: 6, background: C.border, borderRadius: 999, overflow: 'hidden', marginBottom: 8 }}>
                {(() => { const pct = d.totalQty ? d.availQty / d.totalQty : 0; return (
                  <div style={{ height: '100%', width: `${Math.round(pct * 100)}%`, background: pct > 0.5 ? 'var(--color-success)' : pct > 0.2 ? 'var(--color-warning)' : 'var(--color-danger)', borderRadius: 999 }}/>
                ); })()}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, textAlign: 'center' }}>
                {[['Available', d.availQty, d.availQty < (d.minStock || 1) ? 'var(--color-danger)' : C.ink], ['Reserved', d.reservedQty || 0, C.ink], ['Out', d.outQty || 0, C.ink], ['Damaged', d.dmgQty || 0, d.dmgQty > 0 ? 'var(--color-danger)' : C.gray]].map(([l, v, col]) => (
                  <div key={l}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: col }}>{v}</div>
                    <div style={{ fontSize: 10, color: C.gray }}>{l}</div>
                  </div>
                ))}
              </div>
              {d.minStock > 0 && <div style={{ fontSize: 11, color: C.gray, marginTop: 8 }}>Alert threshold: {d.minStock} units</div>}
            </div>
          )}

          {/* Consumable stock */}
          {d.track === 'consumable' && (
            <div style={{ background: d.currentStock <= d.restockPoint ? '#FEF3C7' : C.ivory, borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.gray, marginBottom: 6 }}>STOCK</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: d.currentStock <= d.restockPoint ? 'var(--color-warning)' : C.ink }}>
                {d.currentStock} <span style={{ fontSize: 13, fontWeight: 400, color: C.gray }}>{d.unit}s in stock</span>
              </div>
              <div style={{ fontSize: 11, color: C.gray, marginTop: 4 }}>Restock at {d.restockPoint} · order {d.restockQty} {d.unit}s</div>
              {d.currentStock <= d.restockPoint && <div style={{ marginTop: 8, fontSize: 12, color: 'var(--color-warning)', fontWeight: 600 }}>⚠ Restock needed</div>}
            </div>
          )}

          {/* Details */}
          <div style={{ marginBottom: 16 }}>
            <Row label="Category" value={catDef?.label || d.cat}/>
            <Row label="Color" value={d.color}/>
            <Row label="Size / Dimensions" value={d.size}/>
            <Row label="Condition" value={d.condition ? d.condition.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : null}/>
            <Row label="Last cleaned" value={d.last_cleaned}/>
            {d.client && <Row label={d.status === 'rented' ? 'Rented to' : 'Reserved for'} value={d.client?.name || d.client} color={isOverdue ? 'var(--color-danger)' : 'var(--color-warning)'}/>}
            {d.return_date && <Row label="Return date" value={new Date(d.return_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} color={isOverdue ? 'var(--color-danger)' : C.ink}/>}
            {d.pickup_date && <Row label="Pickup date" value={new Date(d.pickup_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}/>}
          </div>

          {d.notes && (
            <div style={{ background: C.ivory, borderRadius: 10, padding: '10px 14px', marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: C.gray, marginBottom: 4 }}>NOTES</div>
              <div style={{ fontSize: 12, color: C.ink, lineHeight: 1.5 }}>{d.notes}</div>
            </div>
          )}
        </div>

        {/* Damage history */}
        <div style={{ borderTop: `1px solid ${C.border}` }}>
          <DamageHistorySection item={d} onOpenModal={() => setDamageModalOpen(true)}/>
        </div>

        {/* Damage assessment modal (standalone — no event/client context) */}
        {damageModalOpen && (
          <DamageAssessmentModal
            dress={d}
            onClose={() => setDamageModalOpen(false)}
            onSaved={() => setDamageModalOpen(false)}
          />
        )}

        {/* Action footer */}
        <div style={{ padding: '12px 16px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 8, flexShrink: 0 }}>
          <button onClick={() => onEdit(d)} style={{ flex: 1, padding: '9px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'transparent', color: C.gray, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>✏ Edit</button>
          <button onClick={() => onQR(d)} style={{ padding: '9px 14px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'transparent', color: C.gray, fontSize: 12, cursor: 'pointer' }}>QR</button>
          {isGown && d.status === 'available' && (
            <button onClick={() => onRent(d)} style={{ flex: 1, padding: '9px', borderRadius: 8, border: 'none', background: C.rosa, color: C.white, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Rent dress →</button>
          )}
          {isGown && DRESS_TRANSITIONS[d.status]?.next && (
            <button onClick={() => onLifecycle(d)} style={{ flex: 1, padding: '9px', borderRadius: 8, border: 'none', background: C.rosaPale, color: C.rosa, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>{DRESS_TRANSITIONS[d.status].label}</button>
          )}
        </div>
      </div>
    </>
  );
};

// ─── AUDIT LOG BADGE COLORS ──────────────────────────────────────────────────
const AUDIT_ACTION_STYLE = {
  checked_out:  { bg: C.amberBg,   col: C.amber,   label: 'Checked out'  },
  checked_in:   { bg: C.greenBg,   col: C.green,   label: 'Checked in'   },
  status_change:{ bg: C.blueBg,    col: C.blue,    label: 'Status change' },
  created:      { bg: '#CCFBF1',   col: '#0F766E', label: 'Created'       },
  updated:      { bg: C.grayBg,    col: C.gray,    label: 'Updated'       },
  cleaned:      { bg: C.purpleBg,  col: C.purple,  label: 'Cleaned'       },
  damaged:      { bg: C.redBg,     col: C.red,     label: 'Damaged'       },
  reserved:     { bg: '#FEF9C3',   col: '#A16207', label: 'Reserved'      },
};

function fmtTs(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// ─── AUDIT LOG VIEW ──────────────────────────────────────────────────────────
const AuditLogView = ({ entries, loading, onRefresh }) => {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all'); // 'today'|'week'|'month'|'all'

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfDay);
  startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const filtered = entries.filter(e => {
    const itemName = (e.inventory?.name || '').toLowerCase();
    const itemSku = (e.inventory?.sku || '').toLowerCase();
    const q = search.toLowerCase();
    const matchSearch = !q || itemName.includes(q) || itemSku.includes(q)
      || (e.client_name || '').toLowerCase().includes(q)
      || (e.user_name || '').toLowerCase().includes(q);
    const matchAction = actionFilter === 'all' || e.action === actionFilter;
    let matchDate = true;
    if (dateFilter !== 'all' && e.created_at) {
      const d = new Date(e.created_at);
      if (dateFilter === 'today') matchDate = d >= startOfDay;
      else if (dateFilter === 'week') matchDate = d >= startOfWeek;
      else if (dateFilter === 'month') matchDate = d >= startOfMonth;
    }
    return matchSearch && matchAction && matchDate;
  });

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Filter bar */}
      <div style={{ padding: '10px 20px', background: C.white, borderBottom: `1px solid ${C.border}`, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
        <div style={{ flex: 1, position: 'relative', minWidth: 180 }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: C.gray, pointerEvents: 'none', fontSize: 13 }}>🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search item name, SKU, client, staff…"
            style={{ ...inputSt, paddingLeft: 30, margin: 0, width: '100%' }}
          />
        </div>
        <select value={actionFilter} onChange={e => setActionFilter(e.target.value)} style={{ ...inputSt, margin: 0, width: 'auto' }}>
          <option value="all">All actions</option>
          {Object.entries(AUDIT_ACTION_STYLE).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <div style={{ display: 'flex', border: `1px solid ${C.border}`, borderRadius: 6, overflow: 'hidden', flexShrink: 0 }}>
          {[['today', 'Today'], ['week', 'This week'], ['month', 'This month'], ['all', 'All time']].map(([id, lbl]) => (
            <button key={id} onClick={() => setDateFilter(id)} style={{ padding: '6px 12px', border: 'none', background: dateFilter === id ? C.rosaPale : 'transparent', color: dateFilter === id ? C.rosa : C.gray, cursor: 'pointer', fontSize: 11, fontWeight: dateFilter === id ? 600 : 400, borderRight: id !== 'all' ? `1px solid ${C.border}` : 'none' }}>
              {lbl}
            </button>
          ))}
        </div>
        <button onClick={onRefresh} title="Refresh" style={{ padding: '6px 12px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent', color: C.gray, fontSize: 12, cursor: 'pointer' }}>↺ Refresh</button>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: C.gray, fontSize: 13 }}>Loading audit log…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: C.gray }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
            <div style={{ fontSize: 14, fontWeight: 500, color: C.ink }}>No audit entries found</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>
              {entries.length === 0 ? 'Audit entries will appear here as inventory is modified.' : 'Try a different search or filter.'}
            </div>
          </div>
        ) : (
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 130px 160px 110px 1fr 1fr', gap: 0, background: C.ivory, borderBottom: `1px solid ${C.border}` }}>
              {['Timestamp', 'Item', 'Action', 'Status change', 'Staff', 'Client / Event', 'Notes'].map((h, i) => (
                <div key={i} style={{ padding: '8px 12px', fontSize: 11, fontWeight: 600, color: C.gray, letterSpacing: '0.04em', borderRight: i < 6 ? `1px solid ${C.border}` : 'none' }}>{h}</div>
              ))}
            </div>
            {/* Rows */}
            {filtered.map((e, idx) => {
              const as = AUDIT_ACTION_STYLE[e.action] || { bg: C.grayBg, col: C.gray, label: e.action };
              const isLast = idx === filtered.length - 1;
              return (
                <div key={e.id} style={{ display: 'grid', gridTemplateColumns: '160px 1fr 130px 160px 110px 1fr 1fr', borderBottom: isLast ? 'none' : `1px solid ${C.border}`, background: idx % 2 === 0 ? C.white : C.grayBg }}>
                  {/* Timestamp */}
                  <div style={{ padding: '10px 12px', fontSize: 11, color: C.gray, borderRight: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>{fmtTs(e.created_at)}</div>
                  {/* Item */}
                  <div style={{ padding: '10px 12px', borderRight: `1px solid ${C.border}`, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.inventory?.name || '—'}</div>
                    {e.inventory?.sku && <div style={{ fontSize: 10, color: C.gray, fontFamily: 'monospace' }}>#{e.inventory.sku}</div>}
                  </div>
                  {/* Action badge */}
                  <div style={{ padding: '10px 12px', borderRight: `1px solid ${C.border}`, display: 'flex', alignItems: 'center' }}>
                    <span style={{ padding: '3px 9px', borderRadius: 999, fontSize: 10, fontWeight: 600, background: as.bg, color: as.col, whiteSpace: 'nowrap' }}>{as.label}</span>
                  </div>
                  {/* Status change */}
                  <div style={{ padding: '10px 12px', fontSize: 11, color: C.ink, borderRight: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 4 }}>
                    {e.prev_status || e.new_status ? (
                      <>
                        {e.prev_status && <span style={{ color: C.gray, textTransform: 'capitalize' }}>{e.prev_status.replace(/_/g, ' ')}</span>}
                        {e.prev_status && e.new_status && <span style={{ color: C.gray }}>→</span>}
                        {e.new_status && <span style={{ color: C.ink, fontWeight: 500, textTransform: 'capitalize' }}>{e.new_status.replace(/_/g, ' ')}</span>}
                      </>
                    ) : <span style={{ color: C.border }}>—</span>}
                  </div>
                  {/* Staff */}
                  <div style={{ padding: '10px 12px', fontSize: 11, color: C.gray, borderRight: `1px solid ${C.border}`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.user_name || '—'}</div>
                  {/* Client / Event */}
                  <div style={{ padding: '10px 12px', fontSize: 11, color: C.gray, borderRight: `1px solid ${C.border}`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.client_name || '—'}</div>
                  {/* Notes */}
                  <div style={{ padding: '10px 12px', fontSize: 11, color: C.gray, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.notes || '—'}</div>
                </div>
              );
            })}
          </div>
        )}
        {!loading && filtered.length > 0 && (
          <div style={{ marginTop: 12, fontSize: 11, color: C.gray, textAlign: 'right' }}>
            Showing {filtered.length} of {entries.length} entries (last 200)
          </div>
        )}
      </div>
    </div>
  );
};

const Inventory = ({inventory: liveInventory, updateDress, createDress, events, updateEvent, clients, setScreen}) => {
  const toast=useToast();
  const { boutique } = useAuth();
  const [view,setView]=useState('grid');
  const [mainView,setMainView]=useState('inventory'); // 'inventory' | 'audit'
  const { entries: auditEntries, loading: auditLoading, refetch: refetchAudit } = useInventoryAuditAll();
  const [search,setSearch]=useState('');
  const [groupFilter,setGroupFilter]=useState('all');
  const [statusFilter,setStatusFilter]=useState('all');
  const [addOpen,setAddOpen]=useState(false);
  const [editItem,setEditItem]=useState(null);
  const [lifecycle,setLifecycle]=useState(null);
  const [rentDress,setRentDress]=useState(null);
  const [qrDress,setQrDress]=useState(null);
  const [importOpen,setImportOpen]=useState(false);
  const [selectedItem,setSelectedItem]=useState(null);
  const [lowStockFilter,setLowStockFilter]=useState(false);
  const [lowStockBannerDismissed,setLowStockBannerDismissed]=useState(false);
  const [bulkMode,setBulkMode]=useState(false);
  const [selectedIds,setSelectedIds]=useState(new Set());
  const [bulkStatus,setBulkStatus]=useState('');
  const [bulkWorking,setBulkWorking]=useState(false);
  const [scannerOpen,setScannerOpen]=useState(false);
  const [highlightedId,setHighlightedId]=useState(null);
  const [page,setPage]=useState(1);
  const PAGE_SIZE=60;
  const listContainerRef=useRef(null);

  // ── Barcode / QR scan handler ────────────────────────────────────────────
  const handleScan=useCallback(async(raw)=>{
    setScannerOpen(false);
    // QR codes encode a URL: <origin>/scan/<uuid>
    // Extract the ID: last path segment, or use raw directly as a UUID/SKU
    let code=raw.trim();
    try{const u=new URL(code);const parts=u.pathname.split('/').filter(Boolean);if(parts.length>0)code=parts[parts.length-1];}catch(_){}
    const {data,error}=await supabase.from('inventory').select('*')
      .eq('boutique_id',boutique.id)
      .or(`id.eq.${code},sku.eq.${code}`)
      .limit(1)
      .maybeSingle();
    if(error||!data){toast('No item found for this code','error');return;}
    // Map item and show detail panel
    const catDef=INV_CATS.find(c=>c.id===(data.category||data.cat||'bridal_gown'));
    const mapped={...data,cat:data.category||data.cat||'bridal_gown',group:data.group||catDef?.group||'gowns',track:data.track||catDef?.track||'individual'};
    setSelectedItem(mapped);
    setHighlightedId(data.id);
    toast(`Found: ${data.name}`);
    // clear highlight after 3s
    setTimeout(()=>setHighlightedId(null),3000);
  },[boutique?.id,toast]);

  const dressesMapped=liveInventory.map(d=>{
    const catDef=INV_CATS.find(c=>c.id===(d.category||d.cat||'bridal_gown'));
    return {
      ...d,
      cat:d.category||d.cat||'bridal_gown',
      group:d.group||catDef?.group||'gowns',
      track:d.track||catDef?.track||'individual',
    };
  });
  const allData=dressesMapped;

  const lowStockCount=allData.filter(d=>d.track&&d.minStock>0&&(
    (d.track==='quantity'&&d.availQty!=null&&d.availQty<=d.minStock)||
    (d.track==='consumable'&&d.currentStock!=null&&d.currentStock<=d.minStock)
  )).length;

  const filtered=allData.filter(d=>{
    const q=(d.name+' '+d.sku+' '+(d.color||'')).toLowerCase();
    const matchesSearch=!search||q.includes(search.toLowerCase());
    const matchesGroup=groupFilter==='all'||d.group===groupFilter;
    const matchesStatus=statusFilter==='all'||d.status===statusFilter;
    const matchesLowStock=!lowStockFilter||(d.track&&d.minStock>0&&(
      (d.track==='quantity'&&d.availQty!=null&&d.availQty<=d.minStock)||
      (d.track==='consumable'&&d.currentStock!=null&&d.currentStock<=d.minStock)
    ));
    return matchesSearch&&matchesGroup&&matchesStatus&&matchesLowStock;
  });

  // Reset pagination when filters change
  useEffect(()=>{setPage(1);},[search,groupFilter,statusFilter,lowStockFilter]);
  const paginatedFiltered=filtered.slice(0,page*PAGE_SIZE);

  const rowVirtualizer=useVirtualizer({
    count:filtered.length,
    getScrollElement:()=>listContainerRef.current,
    estimateSize:()=>52,
    overscan:10,
  });

  const attention=allData.filter(d=>(d.dmgQty>0)||(d.track==='consumable'&&d.currentStock<=d.restockPoint)||(d.status==='overdue'));

  const SC={
    available:{bg:'var(--bg-success)',col:'var(--color-success)',label:'Available'},
    reserved: {bg:'var(--bg-warning)',col:'var(--color-warning)',label:'Reserved'},
    picked_up:{bg:'var(--bg-danger)',  col:'var(--color-danger)',  label:'Picked up'},
    returned: {bg:'var(--bg-info)', col:'var(--color-info)', label:'Returned'},
    cleaning: {bg:'var(--bg-info)', col:'var(--color-info)', label:'Cleaning'},
    overdue:  {bg:'var(--bg-danger)',  col:'var(--color-danger)',  label:'Overdue'},
    rented:   {bg:'var(--bg-danger)',  col:'var(--color-danger)',  label:'Rented out'},
    low_stock:{bg:'var(--bg-warning)',col:'var(--color-warning)',label:'Low stock'},
  };

  const catIcon=id=>INV_CATS.find(c=>c.id===id)?.icon||'📦';

  const toggleBulk=(id,e)=>{e.stopPropagation();setSelectedIds(s=>{const n=new Set(s);n.has(id)?n.delete(id):n.add(id);return n;});};
  const selectAll=()=>setSelectedIds(new Set(filtered.map(d=>d.id)));
  const bulkApply=async()=>{
    if(!bulkStatus||!selectedIds.size)return;
    setBulkWorking(true);
    const updates=bulkStatus==='available'?{status:'available',client_id:null,return_date:null,pickup_date:null}:{status:bulkStatus};
    for(const id of selectedIds)await updateDress?.(id,updates);
    setBulkWorking(false);
    toast(`${selectedIds.size} item${selectedIds.size!==1?'s':''} updated ✓`);
    setSelectedIds(new Set());setBulkMode(false);setBulkStatus('');
  };

  const GridCard=({d})=>{
    const s=SC[d.status]||{bg:C.grayBg,col:C.gray,label:d.status};
    const isOverdue=d.status==='rented'||d.status==='overdue';
    const isGown=d.group==='gowns';
    if(d.track==='quantity'){
      const pct=d.totalQty?d.availQty/d.totalQty:0;
      const isQSel=selectedIds.has(d.id);
      return(
        <div onClick={bulkMode?e=>toggleBulk(d.id,e):()=>setSelectedItem(d)} style={{background:isQSel?C.rosaPale:C.white,border:`2px solid ${isQSel?C.rosa:C.border}`,borderRadius:12,overflow:'hidden',cursor:'pointer',transition:'border-color 0.1s,background 0.1s'}} onMouseEnter={e=>{if(!bulkMode&&!isQSel)e.currentTarget.style.borderColor=C.rosa;}} onMouseLeave={e=>{if(!bulkMode&&!isQSel)e.currentTarget.style.borderColor=C.border;}}>
          <div style={{height:80,background:C.ivory,display:'flex',alignItems:'center',justifyContent:'center',position:'relative',overflow:'hidden'}}>
            {(d.image_url||d.photo_url)?<img src={d.image_url||d.photo_url} alt={d.name} style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontSize:30,opacity:0.8}}>{catIcon(d.cat)}</span>}
            {bulkMode?(
              <div onClick={e=>toggleBulk(d.id,e)} style={{position:'absolute',top:8,left:8,width:20,height:20,borderRadius:4,border:`2px solid ${isQSel?C.rosa:'rgba(255,255,255,0.9)'}`,background:isQSel?C.rosa:'rgba(0,0,0,0.25)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',zIndex:5}}>
                {isQSel&&<span style={{color:'#fff',fontSize:12,lineHeight:1,fontWeight:700}}>✓</span>}
              </div>
            ):<div style={{position:'absolute',top:8,left:8}}><Badge text={d.sku} bg="rgba(0,0,0,0.45)" color="#fff"/></div>}
          </div>
          <div style={{padding:'10px 12px'}}>
            <div style={{fontSize:13,fontWeight:500,color:C.ink,marginBottom:2}}>{d.name}</div>
            <div style={{fontSize:11,color:C.gray,marginBottom:8}}>{INV_CATS.find(c=>c.id===d.cat)?.label||d.cat} · {d.color}</div>
            <div style={{marginBottom:6}}>
              <div style={{height:5,background:C.grayBg,borderRadius:999,overflow:'hidden',marginBottom:4}}>
                <div style={{height:'100%',width:`${Math.round(pct*100)}%`,background:pct>0.5?'var(--color-success)':pct>0.2?'var(--color-warning)':'var(--color-danger)',borderRadius:999}}/>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:C.gray}}>
                <span style={{color:pct<0.2?'var(--color-danger)':C.gray}}>{d.availQty} avail of {d.totalQty}</span>
                <span>{d.reservedQty||0} reserved · {d.dmgQty||0} damaged</span>
              </div>
            </div>
            <div style={{fontSize:12,fontWeight:500,color:C.ink}}>{fmt(d.price)}<span style={{color:C.gray,fontWeight:400}}>/ea</span></div>
            {d.minStock>0&&d.availQty!=null&&d.availQty<=0&&<span style={{fontSize:10,background:'#FEE2E2',color:'#DC2626',padding:'2px 6px',borderRadius:4,fontWeight:600,display:'inline-block',marginTop:4}}>✕ Out of stock</span>}
            {d.minStock>0&&d.availQty!=null&&d.availQty>0&&d.availQty<=d.minStock&&<span style={{fontSize:10,background:'#FEF2F2',color:'#DC2626',padding:'2px 6px',borderRadius:4,fontWeight:600,display:'inline-block',marginTop:4}}>⚠ Low stock</span>}
          </div>
        </div>
      );
    }
    if(d.track==='consumable'){
      const low=d.currentStock<=d.restockPoint;
      const isCSel=selectedIds.has(d.id);
      return(
        <div onClick={bulkMode?e=>toggleBulk(d.id,e):()=>setSelectedItem(d)} style={{background:isCSel?C.rosaPale:C.white,border:`2px solid ${isCSel?C.rosa:low?'#FCA5A5':C.border}`,borderRadius:12,overflow:'hidden',cursor:'pointer',transition:'border-color 0.1s,background 0.1s'}}>
          <div style={{height:80,background:C.ivory,display:'flex',alignItems:'center',justifyContent:'center',position:'relative'}}>
            <span style={{fontSize:30,opacity:0.8}}>📦</span>
            {bulkMode?(
              <div onClick={e=>toggleBulk(d.id,e)} style={{position:'absolute',top:8,left:8,width:20,height:20,borderRadius:4,border:`2px solid ${isCSel?C.rosa:'rgba(0,0,0,0.3)'}`,background:isCSel?C.rosa:'rgba(0,0,0,0.12)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',zIndex:5}}>
                {isCSel&&<span style={{color:'#fff',fontSize:12,lineHeight:1,fontWeight:700}}>✓</span>}
              </div>
            ):<div style={{position:'absolute',top:8,left:8}}><Badge text={d.sku} bg="rgba(0,0,0,0.1)" color={C.ink}/></div>}
            {low&&<div style={{position:'absolute',top:8,right:8}}><Badge text="Low stock" bg={C.amberBg} color={C.amber}/></div>}
          </div>
          <div style={{padding:'10px 12px'}}>
            <div style={{fontSize:13,fontWeight:500,color:C.ink,marginBottom:2}}>{d.name}</div>
            <div style={{fontSize:11,color:C.gray,marginBottom:6}}>Consumable · {d.color}</div>
            <div style={{fontSize:13,fontWeight:500,color:low?'var(--color-danger)':C.ink}}>{d.currentStock} <span style={{fontSize:11,fontWeight:400,color:C.gray}}>{d.unit}s in stock</span></div>
            <div style={{fontSize:11,color:C.gray,marginTop:2}}>Restock at {d.restockPoint} {d.unit}s · order {d.restockQty}</div>
            {low&&<div style={{marginTop:8,padding:'6px 10px',background:'#FEF3C7',borderRadius:6,fontSize:11,color:'var(--color-warning)',fontWeight:500}}>⚠ Order {d.restockQty} {d.unit}s now</div>}
          </div>
        </div>
      );
    }
    const isHighlighted=highlightedId===d.id;
    return(
      <div onClick={bulkMode?e=>toggleBulk(d.id,e):()=>setSelectedItem(d)} style={{background:selectedIds.has(d.id)?C.rosaPale:C.white,border:`2px solid ${isHighlighted?C.green:selectedIds.has(d.id)?C.rosa:isOverdue?'#FCA5A5':C.border}`,borderRadius:12,overflow:'hidden',cursor:'pointer',transition:'border-color 0.15s,background 0.15s',boxShadow:isHighlighted?`0 0 0 3px ${C.greenBg}`:undefined}} onMouseEnter={e=>{if(!bulkMode&&!selectedIds.has(d.id))e.currentTarget.style.borderColor=C.rosa;}} onMouseLeave={e=>{if(!bulkMode&&!selectedIds.has(d.id))e.currentTarget.style.borderColor=isHighlighted?C.green:isOverdue?'#FCA5A5':C.border;}}>
        <div style={{height:100,background:C.ivory,display:'flex',alignItems:'center',justifyContent:'center',position:'relative',overflow:'hidden'}}>
          {(d.image_url||d.photo_url)
            ?<img src={d.image_url||d.photo_url} alt={d.name} style={{width:'100%',height:'100%',objectFit:'cover'}}/>
            :isGown
              ?<svg viewBox="0 0 60 80" style={{width:48,height:64,opacity:0.35}}><path d="M30 2c-4 0-10 3-10 10v8l-12 48h44L40 20V12C40 5 34 2 30 2Z" fill={C.rosa}/><ellipse cx="30" cy="12" rx="8" ry="6" fill={C.rosaLight}/></svg>
              :<span style={{fontSize:32,opacity:0.75}}>{catIcon(d.cat)}</span>}
          {bulkMode?(
            <div onClick={e=>toggleBulk(d.id,e)} style={{position:'absolute',top:8,left:8,width:20,height:20,borderRadius:4,border:`2px solid ${selectedIds.has(d.id)?C.rosa:'rgba(255,255,255,0.9)'}`,background:selectedIds.has(d.id)?C.rosa:'rgba(0,0,0,0.25)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',zIndex:5}}>
              {selectedIds.has(d.id)&&<span style={{color:'#fff',fontSize:12,lineHeight:1,fontWeight:700}}>✓</span>}
            </div>
          ):<div style={{position:'absolute',top:8,left:8}}><Badge text={d.sku} bg="rgba(0,0,0,0.45)" color="#fff"/></div>}
          <div style={{position:'absolute',top:8,right:8}}><Badge text={s.label} bg={s.bg} color={s.col}/></div>
          {!bulkMode&&<><button onClick={e=>{e.stopPropagation();setQrDress(d);}} style={{position:'absolute',bottom:8,right:8,background:'rgba(255,255,255,0.9)',border:`1px solid ${C.border}`,borderRadius:6,padding:'3px 7px',fontSize:10,cursor:'pointer',color:C.gray}}>QR</button>
          <button onClick={e=>{e.stopPropagation();setEditItem(d);}} style={{position:'absolute',bottom:8,left:8,background:'rgba(255,255,255,0.9)',border:`1px solid ${C.border}`,borderRadius:6,padding:'3px 7px',fontSize:10,cursor:'pointer',color:C.gray}}>✏ Edit</button></>}
        </div>
        <div style={{padding:'10px 12px'}}>
          <div style={{fontSize:13,fontWeight:500,color:C.ink,marginBottom:2}}>{d.name}</div>
          <div style={{fontSize:11,color:C.gray,marginBottom:6}}>{[d.color,d.size?`Size ${d.size}`:'',INV_CATS.find(c=>c.id===d.cat)?.label||d.cat].filter(Boolean).join(' · ')}</div>
          {d.minStock>0&&d.currentStock!=null&&d.currentStock<=0&&<span style={{fontSize:10,background:'#FEE2E2',color:'#DC2626',padding:'2px 6px',borderRadius:4,fontWeight:600,display:'inline-block',marginBottom:4}}>✕ Out of stock</span>}
          {d.minStock>0&&d.currentStock!=null&&d.currentStock>0&&d.currentStock<=d.minStock&&<span style={{fontSize:10,background:'#FEF2F2',color:'#DC2626',padding:'2px 6px',borderRadius:4,fontWeight:600,display:'inline-block',marginBottom:4}}>⚠ Low stock</span>}
          {d.track!=='consumable'&&<div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:8}}>
            <span style={{color:C.ink,fontWeight:500}}>{fmt(d.price||0)}<span style={{color:C.gray,fontWeight:400}}>/rental</span></span>
            {d.deposit>0&&<span style={{color:C.gray}}>Dep: {fmt(d.deposit||0)}</span>}
          </div>}
          {d.client&&<div style={{fontSize:11,color:isOverdue?'var(--color-danger)':'var(--color-warning)',marginBottom:6}}>{d.status==='rented'?'Rented to':'Reserved for'}: {d.client?.name||d.client}{d.returnDate?` · Returns ${d.returnDate}`:''}</div>}
          {d.lastCleaned&&!d.client&&<div style={{fontSize:11,color:C.gray,marginBottom:6}}>Last cleaned: {d.lastCleaned}</div>}
          {isGown&&d.status==='available'
            ?<button onClick={e=>{e.stopPropagation();setRentDress(d);}} style={{width:'100%',marginTop:4,padding:'8px',borderRadius:7,border:`1px solid ${C.rosa}`,background:C.rosa,color:C.white,fontSize:11,fontWeight:600,cursor:'pointer'}}>Rent dress →</button>
            :isGown&&DRESS_TRANSITIONS[d.status]?.next
            ?<button onClick={e=>{e.stopPropagation();setLifecycle(d);}} style={{width:'100%',marginTop:4,padding:'8px',borderRadius:7,border:`1px solid ${C.rosa}`,background:C.rosaPale,color:C.rosa,fontSize:11,fontWeight:500,cursor:'pointer'}}>{DRESS_TRANSITIONS[d.status].label}</button>
            :<div style={{marginTop:4,height:28}}/>}
        </div>
      </div>
    );
  };

  const ListRow=({d})=>{
    const s=SC[d.status]||{bg:C.grayBg,col:C.gray,label:d.status};
    const isSelected=selectedIds.has(d.id);
    const colBase={padding:'8px 14px',display:'flex',alignItems:'center',flexShrink:0,boxSizing:'border-box'};
    return(
      <div onClick={bulkMode?e=>toggleBulk(d.id,e):()=>setSelectedItem(d)}
        style={{display:'flex',alignItems:'center',borderBottom:`1px solid ${C.border}`,cursor:'pointer',background:isSelected?C.rosaPale:'transparent',minWidth:600}}
        onMouseEnter={e=>{if(!isSelected)e.currentTarget.style.background=C.ivory;}}
        onMouseLeave={e=>{e.currentTarget.style.background=isSelected?C.rosaPale:'transparent';}}>
        {bulkMode&&(
          <div style={{...colBase,width:36,paddingLeft:10,paddingRight:10,flexShrink:0}} onClick={e=>toggleBulk(d.id,e)}>
            <div style={{width:16,height:16,borderRadius:3,border:`2px solid ${isSelected?C.rosa:C.gray}`,background:isSelected?C.rosa:'transparent',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',margin:'0 auto'}}>
              {isSelected&&<span style={{color:'#fff',fontSize:10,fontWeight:700}}>✓</span>}
            </div>
          </div>
        )}
        <div style={{...colBase,width:90,fontSize:11,color:C.gray,fontFamily:'monospace',whiteSpace:'nowrap'}}>{d.sku}</div>
        <div style={{...colBase,flex:1,flexDirection:'column',alignItems:'flex-start'}}>
          <div style={{fontSize:13,fontWeight:500,color:C.ink}}>{d.name}</div>
          <div style={{fontSize:11,color:C.gray}}>{d.color}{d.size?` · Sz ${d.size}`:''}</div>
        </div>
        <div style={{...colBase,width:120,fontSize:11,color:C.gray}}>{INV_CATS.find(c=>c.id===d.cat)?.label||d.cat}</div>
        <div style={{...colBase,width:130,flexDirection:'column',alignItems:'flex-start',gap:2}}>
          {d.track==='quantity'
            ?<><span style={{fontSize:12,color:d.availQty<(d.minStock||1)?'var(--color-danger)':C.ink}}>{d.availQty}/{d.totalQty} avail</span>
              {d.minStock>0&&d.availQty!=null&&d.availQty<=0&&<span style={{fontSize:10,background:'#FEE2E2',color:'#DC2626',padding:'1px 5px',borderRadius:4,fontWeight:600}}>✕ Out</span>}
              {d.minStock>0&&d.availQty!=null&&d.availQty>0&&d.availQty<=d.minStock&&<span style={{fontSize:10,background:'#FEF2F2',color:'#DC2626',padding:'1px 5px',borderRadius:4,fontWeight:600}}>⚠ Low</span>}</>
            :d.track==='consumable'
            ?<><span style={{fontSize:12,color:d.currentStock<=d.restockPoint?'var(--color-danger)':C.ink}}>{d.currentStock} {d.unit}s</span>
              {d.minStock>0&&d.currentStock!=null&&d.currentStock<=0&&<span style={{fontSize:10,background:'#FEE2E2',color:'#DC2626',padding:'1px 5px',borderRadius:4,fontWeight:600}}>✕ Out</span>}
              {d.minStock>0&&d.currentStock!=null&&d.currentStock>0&&d.currentStock<=d.minStock&&<span style={{fontSize:10,background:'#FEF2F2',color:'#DC2626',padding:'1px 5px',borderRadius:4,fontWeight:600}}>⚠ Low</span>}</>
            :<Badge text={s.label} bg={s.bg} color={s.col}/>}
        </div>
        <div style={{...colBase,width:80,fontSize:12,color:C.ink,whiteSpace:'nowrap'}}>{d.track==='consumable'?'—':fmt(d.price||0)}</div>
        <div style={{...colBase,flex:1,fontSize:11,color:C.gray}}>{d.client?.name||d.client||''}{d.track==='consumable'&&d.currentStock<=d.restockPoint?<span style={{color:'var(--color-warning)'}}>Restock needed</span>:''}</div>
        <div style={{...colBase,width:70}}>
          <button onClick={e=>{e.stopPropagation();setEditItem(d);}} style={{padding:'4px 10px',borderRadius:6,border:`1px solid ${C.border}`,background:'transparent',color:C.gray,fontSize:11,cursor:'pointer',whiteSpace:'nowrap'}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=C.rosa;e.currentTarget.style.color=C.rosa;}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.gray;}}>
            ✏ Edit
          </button>
        </div>
      </div>
    );
  };

  const ByCatView=()=>(
    <div>
      {Object.entries(INV_GROUPS).map(([gid,glabel])=>{
        const gItems=filtered.filter(d=>d.group===gid);
        if(!gItems.length)return null;
        return(
          <div key={gid} style={{marginBottom:28}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',paddingBottom:8,marginBottom:12,borderBottom:`2px solid ${C.border}`}}>
              <div style={{fontSize:12,fontWeight:700,color:C.ink,textTransform:'uppercase',letterSpacing:'0.06em'}}>{glabel}</div>
              <Badge text={`${gItems.length} items`} bg={C.grayBg} color={C.gray}/>
            </div>
            {INV_CATS.filter(c=>c.group===gid).map(cat=>{
              const catItems=gItems.filter(d=>{
                const cid=d.cat||d.category;
                return cid===cat.id||(cat.id==='bridal_gown'&&(cid==='Bridal gown'||cid==='bridal_gown'))||(cat.id==='quince_gown'&&(cid==='Quinceañera'||cid==='quinceanera_gown'));
              });
              if(!catItems.length)return null;
              return(
                <div key={cat.id} style={{marginBottom:16}}>
                  <div style={{fontSize:11,fontWeight:600,color:C.gray,marginBottom:10}}>{cat.icon} {cat.label} <span style={{fontWeight:400}}>({catItems.length})</span></div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
                    {catItems.map(d=><GridCard key={d.id} d={d}/>)}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );

  const totalItems=allData.length;
  const availCount=allData.filter(d=>d.status==='available').length;

  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <Topbar title="Inventory" subtitle={`${totalItems} items · ${availCount} available${attention.length?` · ⚠ ${attention.length} need attention`:''}`}
        actions={<><GhostBtn label="QR Labels" onClick={()=>setScreen?.('qr_labels')}/><GhostBtn label="Import CSV" onClick={()=>setImportOpen(true)}/><GhostBtn label="📷 Scan" onClick={()=>setScannerOpen(true)}/><PrimaryBtn label="+ Add item" colorScheme="success" onClick={()=>setAddOpen(true)}/></>}/>

      {/* Main view tab switcher */}
      <div style={{padding:'0 20px',background:C.white,borderBottom:`1px solid ${C.border}`,display:'flex',gap:0,flexShrink:0}}>
        {[['inventory','Inventory'],['audit','📋 Audit Log']].map(([id,lbl])=>(
          <button key={id} onClick={()=>setMainView(id)} style={{padding:'10px 18px',border:'none',borderBottom:`2px solid ${mainView===id?C.rosa:'transparent'}`,background:'transparent',color:mainView===id?C.rosa:C.gray,fontSize:13,fontWeight:mainView===id?600:400,cursor:'pointer'}}>
            {lbl}
          </button>
        ))}
      </div>

      {/* ══ AUDIT LOG VIEW ══ */}
      {mainView==='audit'&&<AuditLogView entries={auditEntries} loading={auditLoading} onRefresh={refetchAudit}/>}

      {/* ══ INVENTORY VIEW ══ */}
      {mainView==='inventory'&&<>

      {/* Attention banner */}
      {attention.length>0&&(
        <div style={{padding:'10px 20px',background:'#FFFBEB',borderBottom:`1px solid #FDE68A`,display:'flex',gap:10,alignItems:'flex-start'}}>
          <span style={{fontSize:16,lineHeight:1.4}}>⚠</span>
          <div>
            <span style={{fontSize:12,fontWeight:600,color:'#92400E'}}>{attention.length} item{attention.length!==1?'s':''} need attention: </span>
            <span style={{fontSize:12,color:'#B45309'}}>
              {attention.map(d=>d.track==='consumable'?`${d.name} (low stock)`:d.dmgQty?`${d.name} (${d.dmgQty} damaged)`:`${d.name} overdue`).join(' · ')}
            </span>
          </div>
        </div>
      )}

      {/* Low stock amber banner */}
      {lowStockCount>0&&!lowStockFilter&&!lowStockBannerDismissed&&(
        <div style={{padding:'10px 20px',background:'#FFFBEB',borderBottom:`1px solid #FDE68A`,display:'flex',gap:10,alignItems:'center'}}>
          <span style={{fontSize:15,lineHeight:1}}>⚠</span>
          <span style={{fontSize:12,fontWeight:600,color:'#92400E',flex:1}}>{lowStockCount} item{lowStockCount!==1?'s':''} need restocking</span>
          <button onClick={()=>{setLowStockFilter(true);setLowStockBannerDismissed(true);}} style={{padding:'4px 12px',borderRadius:6,border:`1px solid #FCD34D`,background:'#FDE68A',color:'#92400E',fontSize:11,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap'}}>Filter by low stock →</button>
          <button onClick={()=>setLowStockBannerDismissed(true)} style={{background:'none',border:'none',fontSize:16,color:'#92400E',cursor:'pointer',lineHeight:1,padding:'0 2px'}}>×</button>
        </div>
      )}

      {/* Filter + view bar */}
      <div style={{padding:'10px 20px',background:C.white,borderBottom:`1px solid ${C.border}`,display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
        <div style={{flex:1,position:'relative',minWidth:180}}>
          <span style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:C.gray,pointerEvents:'none',fontSize:13}}>🔍</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, SKU, color…" style={{...inputSt,paddingLeft:30,margin:0,width:'100%'}}/>
        </div>
        <select value={groupFilter} onChange={e=>setGroupFilter(e.target.value)} style={{...inputSt,margin:0,width:'auto'}}>
          <option value="all">All categories</option>
          {Object.entries(INV_GROUPS).map(([id,l])=><option key={id} value={id}>{l}</option>)}
        </select>
        <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} style={{...inputSt,margin:0,width:'auto'}}>
          <option value="all">All statuses</option>
          <option value="available">Available</option>
          <option value="reserved">Reserved</option>
          <option value="rented">Rented out</option>
          <option value="overdue">Overdue</option>
          <option value="low_stock">Low stock</option>
        </select>
        <button onClick={()=>{setLowStockFilter(f=>!f);setLowStockBannerDismissed(true);}} style={{padding:'6px 12px',borderRadius:6,border:`1.5px solid ${lowStockFilter?'#DC2626':'#FCA5A5'}`,background:lowStockFilter?'#FEE2E2':'#FEF2F2',color:lowStockFilter?'#DC2626':'#B91C1C',fontSize:11,fontWeight:600,cursor:'pointer',flexShrink:0,whiteSpace:'nowrap'}}>
          {lowStockFilter?'✕ Clear':'⚠ Low stock'}{lowStockCount>0&&!lowStockFilter?` (${lowStockCount})`:''}
        </button>
        <div style={{display:'flex',border:`1px solid ${C.border}`,borderRadius:6,overflow:'hidden',flexShrink:0}}>
          {[['grid','▦ Grid'],['list','☰ List'],['bycat','⊞ Category']].map(([v,lbl])=>(
            <button key={v} onClick={()=>setView(v)} style={{padding:'6px 12px',border:'none',background:view===v?C.rosaPale:'transparent',color:view===v?C.rosa:C.gray,cursor:'pointer',fontSize:11,fontWeight:view===v?600:400,borderRight:v!=='bycat'?`1px solid ${C.border}`:'none'}}>
              {lbl}
            </button>
          ))}
        </div>
        <button onClick={()=>{setBulkMode(b=>!b);setSelectedIds(new Set());setBulkStatus('');}}
          style={{padding:'6px 12px',borderRadius:6,border:`1px solid ${bulkMode?C.rosa:C.border}`,background:bulkMode?C.rosaPale:'transparent',color:bulkMode?C.rosa:C.gray,fontSize:11,fontWeight:bulkMode?600:400,cursor:'pointer',flexShrink:0,whiteSpace:'nowrap'}}>
          {bulkMode?'✕ Cancel':'⊡ Select'}
        </button>
      </div>

      {/* Bulk action bar */}
      {bulkMode&&(
        <div style={{display:'flex',alignItems:'center',gap:10,padding:'8px 20px',background:'#EFF6FF',borderBottom:`1px solid #BFDBFE`,flexShrink:0,flexWrap:'wrap'}}>
          <span style={{fontSize:12,fontWeight:500,color:'#1D4ED8'}}>{selectedIds.size} selected</span>
          {selectedIds.size===0&&<span style={{fontSize:12,color:'#6B7280'}}>Click items to select</span>}
          {selectedIds.size>0&&(<>
            <select value={bulkStatus} onChange={e=>setBulkStatus(e.target.value)} style={{...inputSt,margin:0,width:'auto',fontSize:12,padding:'4px 8px'}}>
              <option value="">Set status…</option>
              <option value="available">✅ Available</option>
              <option value="reserved">🟡 Reserved</option>
              <option value="cleaning">🫧 Cleaning</option>
              <option value="returned">📦 Returned</option>
            </select>
            <button onClick={bulkApply} disabled={!bulkStatus||bulkWorking}
              style={{padding:'5px 14px',borderRadius:7,border:'none',background:!bulkStatus||bulkWorking?C.grayBg:'#1D4ED8',color:!bulkStatus||bulkWorking?C.gray:'#fff',fontSize:12,fontWeight:500,cursor:!bulkStatus||bulkWorking?'default':'pointer'}}>
              {bulkWorking?'Updating…':'Apply'}
            </button>
            <button onClick={selectAll} style={{padding:'5px 10px',borderRadius:7,border:`1px solid #BFDBFE`,background:'transparent',color:'#1D4ED8',fontSize:12,cursor:'pointer'}}>Select all</button>
          </>)}
          <button onClick={()=>{setBulkMode(false);setSelectedIds(new Set());setBulkStatus('');}} style={{marginLeft:'auto',background:'none',border:'none',fontSize:13,cursor:'pointer',color:'#6B7280'}}>Done</button>
        </div>
      )}

      {/* Content */}
      <div style={{flex:1,overflowY:'auto',padding:20}}>
        {view==='grid'&&(
          <>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
              {paginatedFiltered.map(d=><GridCard key={d.id} d={d}/>)}
            </div>
            {filtered.length>page*PAGE_SIZE&&(
              <div style={{padding:'20px 0 4px',display:'flex',justifyContent:'center'}}>
                <button onClick={()=>setPage(p=>p+1)} style={{border:`1px solid ${C.border}`,borderRadius:8,padding:'10px 24px',background:C.white,cursor:'pointer',fontSize:13,color:C.gray}}>
                  Showing {paginatedFiltered.length} of {filtered.length} items · Load more
                </button>
              </div>
            )}
          </>
        )}
        {view==='list'&&(
          <div style={{background:C.white,borderRadius:12,border:`1px solid ${C.border}`,display:'flex',flexDirection:'column',overflow:'hidden'}}>
            {/* Sticky header row */}
            <div style={{display:'flex',alignItems:'center',background:C.ivory,borderBottom:`1px solid ${C.border}`,flexShrink:0,minWidth:600}}>
              {bulkMode&&(
                <div style={{width:36,padding:'8px 10px',flexShrink:0,cursor:'pointer',display:'flex',justifyContent:'center'}} onClick={()=>{if(selectedIds.size===filtered.length)setSelectedIds(new Set());else selectAll();}}>
                  <div style={{width:16,height:16,borderRadius:3,border:`2px solid ${selectedIds.size===filtered.length?C.rosa:C.gray}`,background:selectedIds.size===filtered.length?C.rosa:'transparent',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
                    {selectedIds.size===filtered.length&&<span style={{color:'#fff',fontSize:10,fontWeight:700}}>✓</span>}
                  </div>
                </div>
              )}
              {[['SKU',90],['Item',undefined],['Category',120],['Status / Stock',130],['Price',80],['Assigned to',undefined],['',70]].map(([h,w],i)=>(
                <div key={i} style={{padding:'8px 14px',textAlign:'left',fontSize:11,fontWeight:600,color:C.gray,letterSpacing:'0.04em',whiteSpace:'nowrap',...(w?{width:w,flexShrink:0}:{flex:1})}}>{h}</div>
              ))}
            </div>
            {/* Virtualized body */}
            <div ref={listContainerRef} style={{overflowY:'auto',overflowX:'auto',height:Math.min(filtered.length*52,520)}}>
              <div style={{height:`${rowVirtualizer.getTotalSize()}px`,position:'relative',minWidth:600}}>
                {rowVirtualizer.getVirtualItems().map(virtualRow=>(
                  <div
                    key={virtualRow.index}
                    ref={rowVirtualizer.measureElement}
                    data-index={virtualRow.index}
                    style={{position:'absolute',top:0,left:0,width:'100%',transform:`translateY(${virtualRow.start}px)`}}
                  >
                    <ListRow d={filtered[virtualRow.index]}/>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        {view==='bycat'&&<ByCatView/>}
        {filtered.length===0&&(
          <div style={{textAlign:'center',padding:60,color:C.gray}}>
            <div style={{fontSize:36,marginBottom:8}}>🔍</div>
            <div style={{fontSize:14,fontWeight:500,color:C.ink}}>No items found</div>
            <div style={{fontSize:12,marginTop:4}}>Try a different search or filter</div>
          </div>
        )}
      </div>

      {addOpen&&<AddItemModal boutique={boutique} onClose={()=>setAddOpen(false)} onCreate={async p=>{const r=await createDress?.(p);return r;}}/>}
      {editItem&&<EditItemModal item={editItem} onClose={()=>setEditItem(null)} onUpdate={async(id,u)=>{const r=await updateDress?.(id,u);if(!r?.error)setEditItem(null);return r;}}/>}
      {rentDress&&<RentDressModal dress={rentDress} events={events||[]} clients={clients||[]} onClose={()=>setRentDress(null)} onRent={async(id,u)=>{const r=await updateDress?.(id,u);setRentDress(null);return r;}}/>}
      {lifecycle&&<DressLifecycleModal dress={lifecycle} onClose={()=>setLifecycle(null)} onUpdate={async(id,u)=>{await updateDress?.(id,u);setLifecycle(null);}}/>}
      {qrDress&&<QRModal dress={qrDress} onClose={()=>setQrDress(null)}/>}
      {importOpen&&<ImportModal onClose={()=>setImportOpen(false)} onImport={async r=>createDress?.(r)}/>}
      {selectedItem&&<ItemDetailPanel item={selectedItem} SC={SC} catIcon={catIcon} onClose={()=>setSelectedItem(null)} onEdit={d=>{setSelectedItem(null);setEditItem(d);}} onQR={d=>{setSelectedItem(null);setQrDress(d);}} onRent={d=>{setSelectedItem(null);setRentDress(d);}} onLifecycle={d=>{setSelectedItem(null);setLifecycle(d);}}/>}
      {scannerOpen&&<BarcodeScanner onScan={handleScan} onClose={()=>setScannerOpen(false)}/>}
      </>}
    </div>
  );
};

export default Inventory;
