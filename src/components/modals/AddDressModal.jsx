import React, { useState, useRef } from 'react';
import { C } from '../../lib/colors';
import { PrimaryBtn, GhostBtn, inputSt, LBL } from '../../lib/ui.jsx';
import { supabase } from '../../lib/supabase';

const AddDressModal = ({onClose, onCreate}) => {
  const [cat,setCat]=useState('Bridal gown');
  const [sku,setSku]=useState('');
  const [name,setName]=useState('');
  const [color,setColor]=useState('');
  const [size,setSize]=useState('');
  const [price,setPrice]=useState('');
  const [deposit,setDeposit]=useState('');
  const [notes,setNotes]=useState('');
  const [imageFile,setImageFile]=useState(null);
  const [imagePreview,setImagePreview]=useState(null);
  const [saving,setSaving]=useState(false);
  const [err,setErr]=useState('');
  const fileRef=useRef();

  const handleFileChange=(e)=>{
    const file=e.target.files[0];
    if(!file)return;
    if(file.size>5*1024*1024){setErr('Image must be under 5 MB');return;}
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setErr('');
  };

  const confirm=async()=>{
    if(!sku.trim())return setErr('SKU is required');
    if(!name.trim())return setErr('Dress name is required');
    if(!price||Number(price)<=0)return setErr('Rental price is required');
    if(!deposit||Number(deposit)<=0)return setErr('Deposit amount is required');
    if(Number(deposit)>Number(price))return setErr('Deposit cannot exceed the rental price');
    setSaving(true);setErr('');
    let image_url=null;
    if(imageFile){
      const ext=imageFile.name.split('.').pop();
      const path=`${Date.now()}-${sku.trim().replace(/[^a-zA-Z0-9]/g,'-')}.${ext}`;
      const {data:up,error:upErr}=await supabase.storage.from('dress-images').upload(path,imageFile,{upsert:true,contentType:imageFile.type});
      if(upErr){setSaving(false);setErr('Image upload failed: '+upErr.message);return;}
      const {data:pub}=supabase.storage.from('dress-images').getPublicUrl(path);
      image_url=pub?.publicUrl||null;
    }
    const res=await onCreate({
      sku:sku.trim(),name:name.trim(),
      category:cat==='Bridal gown'?'bridal_gown':'quince_gown',
      color:color.trim(),size,price:Number(price),deposit:Number(deposit),
      notes:notes.trim(),status:'available',
      ...(image_url?{image_url}:{}),
    });
    setSaving(false);
    if(res?.error)setErr(res.error.message||'Could not add dress');
    else onClose();
  };

  return (
    <div className="modal-overlay" style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}}>
      <div role="dialog" aria-modal="true" aria-labelledby="add-dress-title" style={{background:C.white,borderRadius:16,width:500,maxHeight:'88vh',display:'flex',flexDirection:'column',overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,0.15)'}}>
        <div style={{padding:'20px 24px 16px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div id="add-dress-title" style={{fontWeight:600,fontSize:16,color:C.ink}}>Add dress to inventory</div>
          <button aria-label="Close" onClick={onClose} style={{background:'none',border:'none',fontSize:22,cursor:'pointer',color:C.gray,lineHeight:1}}>×</button>
        </div>
        <div style={{flex:1,overflowY:'auto',padding:24,display:'flex',flexDirection:'column',gap:16}}>
          {/* Category */}
          <div>
            <div style={{...LBL,marginBottom:8,textTransform:'uppercase',letterSpacing:'0.06em'}}>Category</div>
            <div style={{display:'flex',gap:8}}>
              {['Bridal gown','Quinceañera gown'].map(c=>(
                <button key={c} onClick={()=>setCat(c)} style={{flex:1,padding:'10px',borderRadius:8,border:`1.5px solid ${cat===c?C.rosa:C.border}`,background:cat===c?C.rosaPale:'transparent',color:cat===c?C.rosaText:C.gray,cursor:'pointer',fontWeight:cat===c?500:400,fontSize:13}}>{c}</button>
              ))}
            </div>
          </div>

          {/* Photo upload */}
          <div>
            <label htmlFor="add-dress-photo" style={{...LBL,marginBottom:8,display:'block'}}>Photo (optional)</label>
            <input id="add-dress-photo" ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={handleFileChange}/>
            {imagePreview?(
              <div style={{position:'relative',display:'inline-block'}}>
                <img src={imagePreview} alt="preview" style={{width:'100%',maxHeight:180,objectFit:'cover',borderRadius:10,border:`1px solid ${C.border}`,display:'block'}}/>
                <button onClick={()=>{setImageFile(null);setImagePreview(null);}} style={{position:'absolute',top:6,right:6,background:'rgba(0,0,0,0.55)',border:'none',borderRadius:'50%',width:24,height:24,color:'#fff',cursor:'pointer',fontSize:14,lineHeight:'24px',textAlign:'center'}}>×</button>
              </div>
            ):(
              <button onClick={()=>fileRef.current.click()} style={{width:'100%',padding:'24px',borderRadius:10,border:`2px dashed ${C.border}`,background:C.ivory,cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:8}}>
                <span style={{fontSize:28}}>📷</span>
                <span style={{fontSize:12,color:C.gray}}>Click to upload a photo</span>
                <span style={{fontSize:11,color:C.gray,opacity:0.7}}>JPG, PNG or WEBP · Max 5 MB</span>
              </button>
            )}
          </div>

          {/* SKU + Name */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 2fr',gap:12}}>
            <div><label htmlFor="add-dress-sku" style={LBL}>SKU</label><input id="add-dress-sku" value={sku} onChange={e=>setSku(e.target.value)} placeholder="BB-048" style={{...inputSt}}/></div>
            <div><label htmlFor="add-dress-name" style={LBL}>Dress name</label><input id="add-dress-name" value={name} onChange={e=>setName(e.target.value)} placeholder="Ivory A-line cathedral" style={{...inputSt}}/></div>
          </div>

          {/* Color + Size */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div><label htmlFor="add-dress-color" style={LBL}>Color</label><input id="add-dress-color" value={color} onChange={e=>setColor(e.target.value)} placeholder="Ivory" style={{...inputSt}}/></div>
            <div><label htmlFor="add-dress-size" style={LBL}>Size</label>
              <select id="add-dress-size" value={size} onChange={e=>setSize(e.target.value)} style={{...inputSt}}>
                <option value="">Select size</option>
                {['0','2','4','6','8','10','12','14','16','Custom'].map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Pricing */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div>
              <label htmlFor="add-dress-price" style={LBL}>Rental price ($)</label>
              <input id="add-dress-price" type="number" value={price} onChange={e=>{setPrice(e.target.value);if(!deposit)setDeposit(String(Math.round(Number(e.target.value)*0.65)));}} placeholder="450" style={{...inputSt}}/>
            </div>
            <div>
              <label htmlFor="add-dress-deposit" style={LBL}>Security deposit ($)</label>
              <input id="add-dress-deposit" type="number" value={deposit} onChange={e=>setDeposit(e.target.value)} placeholder="300" style={{...inputSt}}/>
              {price&&deposit&&Number(deposit)>0&&<div style={{fontSize:10,color:C.gray,marginTop:3}}>~{Math.round(Number(deposit)/Number(price)*100)}% of rental price</div>}
            </div>
          </div>

          <div><label htmlFor="add-dress-notes" style={LBL}>Notes (optional)</label><textarea id="add-dress-notes" value={notes} onChange={e=>setNotes(e.target.value)} rows={2} placeholder="Any notes about this dress..." style={{...inputSt,resize:'vertical'}}/></div>
          {err&&<div style={{fontSize:12,color:'var(--text-danger)',background:'var(--bg-danger)',padding:'8px 12px',borderRadius:7}}>{err}</div>}
        </div>
        <div style={{padding:'12px 24px',borderTop:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between'}}>
          <GhostBtn label="Cancel" colorScheme="danger" onClick={onClose}/>
          <PrimaryBtn label={saving?'Adding…':'Add to inventory'} colorScheme="success" onClick={confirm}/>
        </div>
      </div>
    </div>
  );
};

export default AddDressModal;
