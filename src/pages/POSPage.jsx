import React, { useState, useMemo, useEffect, useRef } from 'react';
import { C, fmt } from '../lib/colors';
import { Topbar, PrimaryBtn, GhostBtn, useToast, inputSt } from '../lib/ui.jsx';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { usePackages } from '../hooks/usePackages';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const POS_CATS = ['All', 'Accessories', 'Services', 'Alterations', 'Custom'];
const PAYMENT_METHODS = ['Cash', 'Card', 'Zelle', 'Venmo', 'Check'];
const ACCESSORY_CATEGORIES = ['jewelry', 'headpiece', 'veil', 'accessories'];
const DEFAULT_TAX_RATE = 8.5; // percent

// ─── RECEIPT PRINT STYLE ─────────────────────────────────────────────────────
const PRINT_STYLE = `
@media print {
  body > * { display: none !important; }
  #pos-receipt-print { display: block !important; }
}
#pos-receipt-print { display: none; }
`;

// ─── CUSTOM ITEM MODAL ────────────────────────────────────────────────────────
const CustomItemModal = ({ onAdd, onClose }) => {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');

  const handleAdd = () => {
    const p = parseFloat(price);
    if (!name.trim() || isNaN(p) || p < 0) return;
    onAdd({ id: 'custom_' + Date.now(), name: name.trim(), price: p, category: 'Custom' });
    onClose();
  };

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1100,padding:16}}>
      <div style={{background:C.white,borderRadius:14,padding:28,width:340,boxShadow:'0 8px 40px rgba(0,0,0,0.18)'}}>
        <div style={{fontSize:16,fontWeight:600,color:C.ink,marginBottom:18}}>Custom Item</div>
        <div style={{marginBottom:14}}>
          <div style={{fontSize:12,color:C.gray,marginBottom:5}}>Item name</div>
          <input autoFocus value={name} onChange={e=>setName(e.target.value)}
            placeholder="e.g. Accessory sale" style={inputSt}/>
        </div>
        <div style={{marginBottom:24}}>
          <div style={{fontSize:12,color:C.gray,marginBottom:5}}>Price ($)</div>
          <input type="number" min="0" step="0.01" value={price}
            onChange={e=>setPrice(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&handleAdd()}
            placeholder="0.00" style={inputSt}/>
        </div>
        <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
          <GhostBtn label="Cancel" onClick={onClose}/>
          <PrimaryBtn label="Add to cart" onClick={handleAdd} disabled={!name.trim()||!price}/>
        </div>
      </div>
    </div>
  );
};

// ─── RECEIPT VIEW ─────────────────────────────────────────────────────────────
const ReceiptView = ({ sale, boutique, onNewSale }) => {
  const { total, method, items, client, taxAmount, taxRate } = sale;
  const dateStr = new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' });

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',background:C.grayBg}}>
      {/* Inject print style */}
      <style>{PRINT_STYLE}</style>

      <Topbar title="Point of Sale" subtitle="In-store register"/>

      <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>
        <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:16,padding:40,textAlign:'center',maxWidth:440,width:'100%',boxShadow:'0 4px 24px rgba(0,0,0,0.06)'}}>
          <div style={{width:56,height:56,borderRadius:'50%',background:C.greenBg,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px',fontSize:26,color:C.green}}>✓</div>
          <div style={{fontSize:20,fontWeight:700,color:C.ink,marginBottom:6}}>Payment received</div>
          <div style={{fontSize:30,fontWeight:700,color:C.green,marginBottom:4}}>{fmt(total)}</div>
          <div style={{fontSize:14,color:C.gray,marginBottom:28}}>
            via {method}{client?.name ? ` · ${client.name}` : ''}
          </div>
          <div style={{display:'flex',gap:10,justifyContent:'center'}}>
            <GhostBtn label="🖨️ Print receipt" onClick={() => window.print()}/>
            <PrimaryBtn label="New sale →" onClick={onNewSale}/>
          </div>
        </div>
      </div>

      {/* Print-only receipt */}
      <div id="pos-receipt-print" style={{padding:'32px 40px',maxWidth:360,margin:'0 auto',fontFamily:'monospace'}}>
        <div style={{textAlign:'center',marginBottom:20}}>
          <div style={{fontSize:18,fontWeight:700}}>{boutique?.name || 'Belori'}</div>
          {boutique?.address && <div style={{fontSize:12,marginTop:4}}>{boutique.address}</div>}
          {boutique?.phone && <div style={{fontSize:12}}>{boutique.phone}</div>}
          <div style={{fontSize:12,marginTop:6,color:'#666'}}>{dateStr}</div>
        </div>
        <hr style={{border:'none',borderTop:'1px dashed #ccc',margin:'12px 0'}}/>
        {client?.name && (
          <div style={{fontSize:12,marginBottom:8}}>Client: <strong>{client.name}</strong></div>
        )}
        <div style={{marginBottom:8}}>
          {items.map((item, i) => (
            <div key={i} style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:4}}>
              <span>{item.qty > 1 ? `${item.name} ×${item.qty}` : item.name}</span>
              <span>{fmt(item.price * item.qty)}</span>
            </div>
          ))}
        </div>
        <hr style={{border:'none',borderTop:'1px dashed #ccc',margin:'12px 0'}}/>
        <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:4}}>
          <span>Subtotal</span><span>{fmt(total - taxAmount)}</span>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:4}}>
          <span>Tax ({taxRate}%)</span><span>{fmt(taxAmount)}</span>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',fontSize:14,fontWeight:700,marginBottom:8}}>
          <span>TOTAL</span><span>{fmt(total)}</span>
        </div>
        <div style={{fontSize:12}}>Payment: {method}</div>
        <hr style={{border:'none',borderTop:'1px dashed #ccc',margin:'16px 0'}}/>
        <div style={{textAlign:'center',fontSize:13,fontWeight:600}}>Thank you!</div>
        {boutique?.instagram && (
          <div style={{textAlign:'center',fontSize:11,marginTop:4,color:'#888'}}>@{boutique.instagram.replace('@','')}</div>
        )}
      </div>
    </div>
  );
};

// ─── PRODUCT GRID CARD ────────────────────────────────────────────────────────
const ProductCard = ({ item, onAdd }) => (
  <button onClick={() => onAdd(item)}
    style={{background:C.white,border:`1.5px solid ${C.border}`,borderRadius:12,padding:'14px 12px',
      display:'flex',flexDirection:'column',alignItems:'flex-start',gap:6,cursor:'pointer',
      textAlign:'left',transition:'border-color 0.15s, box-shadow 0.15s',minHeight:90}}
    onMouseEnter={e=>{e.currentTarget.style.borderColor=C.rosa;e.currentTarget.style.boxShadow=`0 2px 12px rgba(201,105,122,0.15)`;}}
    onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.boxShadow='none';}}>
    <div style={{fontSize:12,fontWeight:500,color:C.ink,lineHeight:1.3}}>{item.name}</div>
    <div style={{fontSize:10,color:C.gray,padding:'2px 7px',borderRadius:999,background:C.ivory}}>{item.category}</div>
    <div style={{fontSize:14,fontWeight:700,color:C.rosa,marginTop:'auto'}}>{fmt(item.price)}</div>
  </button>
);

// ─── MAIN POS PAGE ────────────────────────────────────────────────────────────
export default function POSPage({ inventory = [], clients = [], events = [] }) {
  const { boutique } = useAuth();
  const toast = useToast();
  const { packages } = usePackages();

  const [activeCat, setActiveCat] = useState('All');
  const [cart, setCart] = useState([]);       // { id, name, price, qty }
  const [taxRate, setTaxRate] = useState(DEFAULT_TAX_RATE);
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [charging, setCharging] = useState(false);
  const [sale, setSale] = useState(null);       // completed sale data
  const [showCustom, setShowCustom] = useState(false);
  const [showClientResults, setShowClientResults] = useState(false);
  const clientRef = useRef(null);

  // Build product catalog from inventory + service_packages
  const catalog = useMemo(() => {
    const items = [];

    // Inventory accessories
    (inventory || [])
      .filter(inv => ACCESSORY_CATEGORIES.includes(inv.category))
      .forEach(inv => {
        items.push({
          id: 'inv_' + inv.id,
          name: inv.name || inv.sku,
          price: Number(inv.price || 0),
          category: 'Accessories',
          source: 'inventory',
          inventory_id: inv.id,
        });
      });

    // Service packages as "Services"
    (packages || [])
      .filter(pkg => pkg.active !== false)
      .forEach(pkg => {
        items.push({
          id: 'pkg_' + pkg.id,
          name: pkg.name,
          price: Number(pkg.base_price || 0),
          category: 'Services',
          source: 'package',
          package_id: pkg.id,
        });
      });

    // Alterations services
    [
      { id: 'alt_hem',     name: 'Hem alteration',      price: 75,  category: 'Alterations' },
      { id: 'alt_bustle',  name: 'Bustle',               price: 120, category: 'Alterations' },
      { id: 'alt_zipper',  name: 'Zipper repair',        price: 45,  category: 'Alterations' },
      { id: 'alt_takin',   name: 'Take in (sides)',      price: 95,  category: 'Alterations' },
      { id: 'alt_press',   name: 'Steam & press',        price: 55,  category: 'Alterations' },
    ].forEach(a => items.push(a));

    return items;
  }, [inventory, packages]);

  const filteredCatalog = useMemo(() => {
    if (activeCat === 'All') return catalog;
    if (activeCat === 'Custom') return [];
    return catalog.filter(item => item.category === activeCat);
  }, [catalog, activeCat]);

  // Cart math
  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100;
  const total = subtotal + taxAmount;

  // Client search results
  const clientResults = useMemo(() => {
    if (!clientSearch.trim() || clientSearch.length < 2) return [];
    const q = clientSearch.toLowerCase();
    return (clients || []).filter(c =>
      c.name?.toLowerCase().includes(q) || c.phone?.includes(q)
    ).slice(0, 6);
  }, [clients, clientSearch]);

  // Events for selected client
  const clientEvents = useMemo(() =>
    selectedClient ? (events || []).filter(e => e.client_id === selectedClient.id) : [],
    [selectedClient, events]
  );

  // Close client dropdown on outside click
  useEffect(() => {
    const handler = e => {
      if (clientRef.current && !clientRef.current.contains(e.target)) setShowClientResults(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function addToCart(item) {
    setCart(prev => {
      const existing = prev.find(c => c.id === item.id);
      if (existing) return prev.map(c => c.id === item.id ? {...c, qty: c.qty + 1} : c);
      return [...prev, { ...item, qty: 1 }];
    });
  }

  function setQty(id, qty) {
    if (qty < 1) return removeFromCart(id);
    setCart(prev => prev.map(c => c.id === id ? {...c, qty} : c));
  }

  function removeFromCart(id) {
    setCart(prev => prev.filter(c => c.id !== id));
  }

  function handleSelectClient(client) {
    setSelectedClient(client);
    setClientSearch(client.name);
    setShowClientResults(false);
    setSelectedEventId('');
  }

  function clearClient() {
    setSelectedClient(null);
    setClientSearch('');
    setSelectedEventId('');
  }

  async function handleCharge() {
    if (cart.length === 0) { toast('Add items to the cart first', 'warn'); return; }
    setCharging(true);

    const itemsBody = cart.map(i => `• ${i.name}${i.qty>1?` ×${i.qty}`:''} — ${fmt(i.price * i.qty)}`).join('\n');
    const now = new Date().toISOString();
    const today = now.slice(0, 10);

    try {
      // 1. If linked to client + event, create a paid payment_milestone
      if (selectedClient && selectedEventId) {
        await supabase.from('payment_milestones').insert({
          boutique_id: boutique.id,
          event_id: selectedEventId,
          label: 'POS Sale',
          amount: total,
          due_date: today,
          status: 'paid',
          paid_date: today,
          notes: `Payment method: ${paymentMethod}`,
        });
      }

      // 2. If linked to a client, log a client interaction
      if (selectedClient) {
        await supabase.from('client_interactions').insert({
          boutique_id: boutique.id,
          client_id: selectedClient.id,
          type: 'note',
          title: `POS Sale ${fmt(total)}`,
          body: `Payment: ${paymentMethod}\n\nItems:\n${itemsBody}`,
          occurred_at: now,
          author_name: 'POS Register',
          is_editable: false,
          ...(selectedEventId ? { related_event_id: selectedEventId } : {}),
        });
      }

      setSale({
        total,
        taxAmount,
        taxRate,
        method: paymentMethod,
        client: selectedClient,
        items: cart,
      });
    } catch (err) {
      toast('Charge failed: ' + (err.message || 'Unknown error'), 'error');
    }

    setCharging(false);
  }

  function handleNewSale() {
    setCart([]);
    setClientSearch('');
    setSelectedClient(null);
    setSelectedEventId('');
    setPaymentMethod('Cash');
    setSale(null);
  }

  if (sale) {
    return <ReceiptView sale={sale} boutique={boutique} onNewSale={handleNewSale}/>;
  }

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',background:C.grayBg}}>
      <style>{PRINT_STYLE}</style>
      <Topbar title="Point of Sale" subtitle="In-store register"/>

      <div style={{flex:1,display:'flex',overflow:'hidden',gap:0}}>
        {/* ── LEFT PANEL: Product grid ── */}
        <div style={{flex:'0 0 60%',display:'flex',flexDirection:'column',overflow:'hidden',borderRight:`1px solid ${C.border}`,background:C.white}}>
          {/* Category tabs */}
          <div style={{display:'flex',gap:6,padding:'10px 16px',borderBottom:`1px solid ${C.border}`,overflowX:'auto',flexShrink:0}}>
            {POS_CATS.map(cat => (
              <button key={cat} onClick={() => { setActiveCat(cat); if (cat==='Custom') setShowCustom(true); }}
                style={{padding:'6px 14px',borderRadius:999,border:`1px solid ${activeCat===cat?C.rosa:C.border}`,
                  background:activeCat===cat?C.rosaPale:'transparent',color:activeCat===cat?C.rosa:C.gray,
                  fontSize:12,fontWeight:activeCat===cat?600:400,cursor:'pointer',whiteSpace:'nowrap',flexShrink:0}}>
                {cat}
              </button>
            ))}
          </div>

          {/* Product cards */}
          <div style={{flex:1,overflowY:'auto',padding:16}}>
            {activeCat === 'Custom' ? (
              <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',gap:16,color:C.gray}}>
                <div style={{fontSize:32}}>+</div>
                <div style={{fontSize:14}}>Add a custom item</div>
                <PrimaryBtn label="+ Custom item" onClick={() => setShowCustom(true)}/>
              </div>
            ) : filteredCatalog.length === 0 ? (
              <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:200,color:C.gray,gap:8}}>
                <div style={{fontSize:13}}>No items in this category</div>
              </div>
            ) : (
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:10}}>
                {filteredCatalog.map(item => (
                  <ProductCard key={item.id} item={item} onAdd={addToCart}/>
                ))}
              </div>
            )}
          </div>

          {/* Custom item floating button */}
          <div style={{padding:'10px 16px',borderTop:`1px solid ${C.border}`,flexShrink:0}}>
            <GhostBtn label="+ Custom item" onClick={() => setShowCustom(true)}/>
          </div>
        </div>

        {/* ── RIGHT PANEL: Cart + checkout ── */}
        <div style={{flex:'0 0 40%',display:'flex',flexDirection:'column',overflow:'hidden',background:C.white}}>
          {/* Cart header */}
          <div style={{padding:'12px 16px',borderBottom:`1px solid ${C.border}`,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <span style={{fontSize:14,fontWeight:600,color:C.ink}}>Cart</span>
            {cart.length > 0 && (
              <button onClick={() => setCart([])}
                style={{fontSize:11,color:C.gray,background:'none',border:'none',cursor:'pointer',padding:'2px 6px'}}>
                Clear all
              </button>
            )}
          </div>

          {/* Cart items */}
          <div style={{flex:1,overflowY:'auto',padding:'0 16px'}}>
            {cart.length === 0 ? (
              <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:120,color:C.gray,fontSize:13}}>
                Cart is empty
              </div>
            ) : (
              <div style={{paddingTop:8,paddingBottom:8}}>
                {cart.map(item => (
                  <div key={item.id} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 0',borderBottom:`1px solid ${C.border}`}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:500,color:C.ink,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.name}</div>
                      <div style={{fontSize:11,color:C.gray}}>{fmt(item.price)} each</div>
                    </div>
                    {/* Qty controls */}
                    <div style={{display:'flex',alignItems:'center',gap:4,flexShrink:0}}>
                      <button onClick={() => setQty(item.id, item.qty - 1)}
                        style={{width:24,height:24,borderRadius:6,border:`1px solid ${C.border}`,background:C.ivory,cursor:'pointer',fontSize:14,color:C.ink,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:500}}>−</button>
                      <span style={{fontSize:13,fontWeight:500,color:C.ink,minWidth:18,textAlign:'center'}}>{item.qty}</span>
                      <button onClick={() => setQty(item.id, item.qty + 1)}
                        style={{width:24,height:24,borderRadius:6,border:`1px solid ${C.border}`,background:C.ivory,cursor:'pointer',fontSize:14,color:C.ink,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:500}}>+</button>
                    </div>
                    <div style={{fontSize:13,fontWeight:600,color:C.ink,minWidth:50,textAlign:'right'}}>{fmt(item.price * item.qty)}</div>
                    <button onClick={() => removeFromCart(item.id)}
                      style={{background:'none',border:'none',color:C.gray,cursor:'pointer',fontSize:16,lineHeight:1,padding:'0 2px',flexShrink:0}}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Totals + checkout */}
          <div style={{borderTop:`1px solid ${C.border}`,padding:'14px 16px',display:'flex',flexDirection:'column',gap:12,flexShrink:0}}>
            {/* Tax rate */}
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <span style={{fontSize:12,color:C.gray,flex:1}}>Tax rate (%)</span>
              <input type="number" min="0" max="30" step="0.1"
                value={taxRate}
                onChange={e => setTaxRate(Math.max(0, parseFloat(e.target.value)||0))}
                style={{width:60,padding:'4px 8px',borderRadius:6,border:`1px solid ${C.border}`,fontSize:12,textAlign:'right',outline:'none'}}/>
            </div>

            {/* Subtotal / Tax / Total */}
            <div style={{display:'flex',flexDirection:'column',gap:4}}>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:C.gray}}>
                <span>Subtotal</span><span>{fmt(subtotal)}</span>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:C.gray}}>
                <span>Tax ({taxRate}%)</span><span>{fmt(taxAmount)}</span>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:16,fontWeight:700,color:C.ink,paddingTop:4,borderTop:`1px solid ${C.border}`}}>
                <span>Total</span><span>{fmt(total)}</span>
              </div>
            </div>

            {/* Client search */}
            <div ref={clientRef} style={{position:'relative'}}>
              <div style={{fontSize:11,color:C.gray,marginBottom:4}}>Link to client (optional)</div>
              {selectedClient ? (
                <div style={{display:'flex',alignItems:'center',gap:8,padding:'7px 10px',background:C.rosaPale,borderRadius:8,border:`1px solid ${C.rosa}`}}>
                  <span style={{flex:1,fontSize:12,fontWeight:500,color:C.rosa}}>{selectedClient.name}</span>
                  <button onClick={clearClient}
                    style={{background:'none',border:'none',color:C.rosa,cursor:'pointer',fontSize:16,lineHeight:1}}>×</button>
                </div>
              ) : (
                <input
                  value={clientSearch}
                  onChange={e => { setClientSearch(e.target.value); setShowClientResults(true); }}
                  onFocus={() => clientSearch.length >= 2 && setShowClientResults(true)}
                  placeholder="Type client name…"
                  style={{...inputSt,fontSize:12,padding:'7px 10px'}}
                />
              )}
              {showClientResults && clientResults.length > 0 && (
                <div style={{position:'absolute',top:'100%',left:0,right:0,background:C.white,border:`1px solid ${C.border}`,borderRadius:9,boxShadow:'0 8px 24px rgba(0,0,0,0.12)',zIndex:50,overflow:'hidden',marginTop:2}}>
                  {clientResults.map(c => (
                    <div key={c.id} onClick={() => handleSelectClient(c)}
                      style={{padding:'9px 12px',cursor:'pointer',fontSize:12,color:C.ink,borderBottom:`1px solid ${C.border}`}}
                      onMouseEnter={e=>e.currentTarget.style.background=C.ivory}
                      onMouseLeave={e=>e.currentTarget.style.background=C.white}>
                      <div style={{fontWeight:500}}>{c.name}</div>
                      {c.phone && <div style={{fontSize:11,color:C.gray}}>{c.phone}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Event selector (when client selected) */}
            {selectedClient && clientEvents.length > 0 && (
              <div>
                <div style={{fontSize:11,color:C.gray,marginBottom:4}}>Link to event (optional)</div>
                <select value={selectedEventId} onChange={e => setSelectedEventId(e.target.value)}
                  style={{...inputSt,fontSize:12,padding:'7px 10px'}}>
                  <option value="">No event</option>
                  {clientEvents.map(ev => (
                    <option key={ev.id} value={ev.id}>
                      {ev.type ? (ev.type.charAt(0).toUpperCase() + ev.type.slice(1)) : 'Event'} {ev.event_date ? new Date(ev.event_date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Payment method */}
            <div>
              <div style={{fontSize:11,color:C.gray,marginBottom:6}}>Payment method</div>
              <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                {PAYMENT_METHODS.map(m => (
                  <button key={m} onClick={() => setPaymentMethod(m)}
                    style={{padding:'5px 12px',borderRadius:8,border:`1.5px solid ${paymentMethod===m?C.rosa:C.border}`,
                      background:paymentMethod===m?C.rosaPale:C.white,color:paymentMethod===m?C.rosa:C.gray,
                      fontSize:12,fontWeight:paymentMethod===m?600:400,cursor:'pointer'}}>
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Charge button */}
            <button onClick={handleCharge} disabled={charging || cart.length === 0}
              style={{width:'100%',padding:'14px 0',borderRadius:10,border:'none',
                background:cart.length===0?C.border:C.rosa,color:C.white,
                fontSize:15,fontWeight:700,cursor:cart.length===0?'not-allowed':'pointer',
                transition:'background 0.15s',opacity:charging?0.7:1}}>
              {charging ? 'Processing…' : `💳 Charge ${fmt(total)}`}
            </button>
          </div>
        </div>
      </div>

      {showCustom && (
        <CustomItemModal
          onAdd={item => { addToCart(item); }}
          onClose={() => setShowCustom(false)}
        />
      )}
    </div>
  );
}
