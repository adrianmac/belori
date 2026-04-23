import React, { useState } from 'react';
import { C } from '../../lib/colors';
import { PrimaryBtn, GhostBtn } from '../../lib/ui.jsx';

export const ImportModal = ({onClose, onImport}) => {
  const [step,setStep]=useState(1);
  const [rows,setRows]=useState([]);
  const [valid,setValid]=useState([]);
  const [errors,setErrors]=useState([]);
  const [importing,setImporting]=useState(false);
  const [imported,setImported]=useState(0);
  const CAT_MAP={'bridal':'bridal_gown','bridal gown':'bridal_gown','wedding gown':'bridal_gown','wedding dress':'bridal_gown','bride':'bridal_gown','bridal_gown':'bridal_gown','b':'bridal_gown','quinceanera':'quinceanera_gown','quinceañera':'quinceanera_gown','quince':'quinceanera_gown','quince gown':'quinceanera_gown','quinceanera_gown':'quinceanera_gown','q':'quinceanera_gown'};
  const mapCat=v=>CAT_MAP[v?.toLowerCase()?.trim()]||null;
  const parseCSV=text=>{
    const lines=text.split(/\r?\n/).filter(l=>l.trim());
    if(lines.length<2)return{headers:[],rows:[]};
    const hdrs=lines[0].split(',').map(h=>h.trim().replace(/^"|"$/g,'').toLowerCase());
    const parsed=lines.slice(1).map(line=>{
      const vals=line.split(',').map(v=>v.trim().replace(/^"|"$/g,''));
      return Object.fromEntries(hdrs.map((h,i)=>[h,vals[i]||'']));
    });
    return{headers:hdrs,rows:parsed};
  };
  const findKey=(hdrs,options)=>hdrs.find(h=>options.includes(h));
  const handleFile=file=>{
    if(!file)return;
    const reader=new FileReader();
    reader.onload=e=>{
      const{headers:hdrs,rows:parsed}=parseCSV(e.target.result);
      const skuK=findKey(hdrs,['sku','item#','item number','item_number'])||hdrs[0];
      const nameK=findKey(hdrs,['name','dress name','description'])||hdrs[1];
      const catK=findKey(hdrs,['category','cat','type'])||hdrs[2];
      const priceK=findKey(hdrs,['rental_price','rental price','price','rate'])||hdrs[3];
      const depK=findKey(hdrs,['deposit','security deposit'])||hdrs[4];
      const colorK=findKey(hdrs,['color','colour']);
      const sizeK=findKey(hdrs,['size','dress size']);
      const v=[],errs=[];
      parsed.forEach((row,i)=>{
        const sku=row[skuK],nm=row[nameK],cat=mapCat(row[catK]),price=parseFloat((row[priceK]||'').replace(/[$,]/g,'')),dep=parseFloat((row[depK]||'').replace(/[$,]/g,''));
        const e=[];
        if(!sku)e.push('Missing SKU');
        if(!nm)e.push('Missing name');
        if(!cat)e.push('Unknown category');
        if(!price||price<=0)e.push('Invalid price');
        if(!dep||dep<=0)e.push('Invalid deposit');
        const mapped={sku,name:nm,category:cat,color:row[colorK]||'',size:row[sizeK]||'',price,deposit:dep,status:'available'};
        if(e.length)errs.push({row:i+2,errors:e,data:mapped});
        else v.push(mapped);
      });
      setValid(v);setErrors(errs);setRows(parsed);setStep(2);
    };
    reader.readAsText(file);
  };
  const doImport=async()=>{
    setImporting(true);let count=0;
    for(const row of valid){await onImport(row);count++;setImported(count);}
    setImporting(false);setStep(3);
  };
  return (
    <div className="modal-overlay" style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}}>
      <div role="dialog" aria-modal="true" aria-labelledby="import-title" style={{background:C.white,borderRadius:16,width:560,maxHeight:'88vh',display:'flex',flexDirection:'column',overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,0.15)'}}>
        <div style={{padding:'20px 24px 16px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div>
            <div id="import-title" style={{fontWeight:600,fontSize:16,color:C.ink}}>Import dress inventory</div>
            <div style={{fontSize:11,color:C.gray,marginTop:2}}>Step {step} of 3 · {step===1?'Upload file':step===2?'Review & confirm':'Complete'}</div>
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',fontSize:22,cursor:'pointer',color:C.gray,lineHeight:1}} aria-label="Close"><span aria-hidden="true">×</span></button>
        </div>
        <div style={{flex:1,overflowY:'auto',padding:24}}>
          {step===1&&(
            <div style={{display:'flex',flexDirection:'column',gap:16}}>
              <label style={{border:`2px dashed ${C.border}`,borderRadius:12,padding:40,textAlign:'center',cursor:'pointer',display:'block',transition:'border-color 0.15s'}}
                onMouseEnter={e=>e.currentTarget.style.borderColor=C.rosa} onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
                <div style={{fontSize:36,marginBottom:10}}>📁</div>
                <div style={{fontSize:14,fontWeight:500,color:C.ink,marginBottom:4}}>Drag & drop your CSV file here</div>
                <div style={{fontSize:12,color:C.gray,marginBottom:16}}>CSV format · Max 500 dresses</div>
                <div style={{display:'inline-block',padding:'8px 20px',borderRadius:8,background:C.rosaPale,color:C.rosaText,fontSize:13,fontWeight:500}}>Choose file</div>
                <input type="file" accept=".csv,.tsv" style={{display:'none'}} onChange={e=>handleFile(e.target.files[0])}/>
              </label>
              <div style={{fontSize:11,color:C.gray,textAlign:'center',lineHeight:1.6}}>
                Required columns: <strong>sku, name, category, rental_price, deposit</strong><br/>
                Optional: size, color, status, notes<br/>
                Category values: "bridal gown" or "quinceanera"
              </div>
            </div>
          )}
          {step===2&&(
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
                {[{label:'Ready to import',val:valid.length,col:'var(--color-success)',bg:'var(--bg-success)'},{label:'Rows with errors',val:errors.length,col:errors.length?'var(--color-danger)':C.gray,bg:errors.length?'var(--bg-danger)':C.grayBg},{label:'Total rows',val:rows.length,col:C.ink,bg:C.ivory}].map(s=>(
                  <div key={s.label} style={{background:s.bg,borderRadius:8,padding:'12px',textAlign:'center'}}>
                    <div style={{fontSize:20,fontWeight:600,color:s.col}}>{s.val}</div>
                    <div style={{fontSize:11,color:C.gray,marginTop:2}}>{s.label}</div>
                  </div>
                ))}
              </div>
              {errors.length>0&&(
                <div>
                  <div style={{fontSize:11,fontWeight:600,color:'var(--text-danger)',marginBottom:6,textTransform:'uppercase',letterSpacing:'0.06em'}}>Errors — will be skipped</div>
                  {errors.slice(0,5).map((e,i)=>(
                    <div key={i} style={{fontSize:11,color:'var(--text-danger)',background:'var(--bg-danger)',padding:'6px 10px',borderRadius:6,marginBottom:4}}>Row {e.row}: {e.errors.join(' · ')}</div>
                  ))}
                  {errors.length>5&&<div style={{fontSize:11,color:C.gray}}>{errors.length-5} more errors…</div>}
                </div>
              )}
              {valid.length>0&&(
                <div>
                  <div style={{fontSize:11,fontWeight:600,color:C.gray,marginBottom:6,textTransform:'uppercase',letterSpacing:'0.06em'}}>Preview (first 5)</div>
                  <div style={{border:`1px solid ${C.border}`,borderRadius:8,overflow:'hidden',fontSize:11}}>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 2fr 1fr 1fr 1fr',background:C.ivory,padding:'8px 10px',fontWeight:500,color:C.gray,gap:4}}>
                      {['SKU','Name','Category','Price','Deposit'].map(h=><div key={h}>{h}</div>)}
                    </div>
                    {valid.slice(0,5).map((r,i)=>(
                      <div key={i} style={{display:'grid',gridTemplateColumns:'1fr 2fr 1fr 1fr 1fr',padding:'7px 10px',borderTop:`1px solid ${C.border}`,color:C.ink,gap:4}}>
                        <div>{r.sku}</div>
                        <div style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.name}</div>
                        <div>{r.category==='bridal_gown'?'Bridal':'Quinceañera'}</div>
                        <div>\${r.price}</div><div>\${r.deposit}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {step===3&&(
            <div style={{textAlign:'center',padding:'30px 0'}}>
              <div style={{fontSize:48,marginBottom:16}}>✅</div>
              <div style={{fontSize:18,fontWeight:600,color:C.ink,marginBottom:8}}>Import complete!</div>
              <div style={{fontSize:13,color:C.gray,marginBottom:4}}>{imported} dress{imported!==1?'es':''} added to inventory</div>
              {errors.length>0&&<div style={{fontSize:12,color:'var(--text-danger)'}}>{errors.length} row{errors.length!==1?'s':''} skipped due to errors</div>}
            </div>
          )}
        </div>
        <div style={{padding:'12px 24px',borderTop:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between'}}>
          <GhostBtn label={step===3?'Close':'Cancel'} onClick={onClose}/>
          {step===2&&valid.length>0&&<PrimaryBtn label={importing?`Importing ${imported}/${valid.length}…`:`Import ${valid.length} dress${valid.length!==1?'es':''}`} onClick={doImport}/>}
          {step===3&&<PrimaryBtn label="View inventory" onClick={onClose}/>}
        </div>
      </div>
    </div>
  );
};

export default ImportModal;
