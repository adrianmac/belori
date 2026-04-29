import React, { useState, useEffect, useRef, useCallback } from 'react'
import { C } from '../lib/colors'
import { supabase } from '../lib/supabase'

const FONT = '-apple-system,BlinkMacSystemFont,"Inter","Segoe UI",sans-serif'

const CATEGORY_GROUPS = [
  { key: 'all',        label: 'All',              cats: null },
  { key: 'bridal',     label: 'Bridal',           cats: ['bridal_gown'] },
  { key: 'quince',     label: 'Quinceañera',      cats: ['quince_gown'] },
  { key: 'veils',      label: 'Accessories',      cats: ['veil', 'headpiece', 'jewelry'] },
  { key: 'deco',       label: 'Decoration',       cats: ['arch', 'centerpiece', 'linen', 'lighting', 'chair', 'ceremony'] },
]

const CATEGORY_LABELS = {
  bridal_gown: 'Bridal Gown', quince_gown: 'Quinceañera Gown',
  veil: 'Veil', headpiece: 'Headpiece', jewelry: 'Jewelry',
  arch: 'Arch', centerpiece: 'Centerpiece', linen: 'Linen',
  lighting: 'Lighting', chair: 'Chair', ceremony: 'Ceremony', consumable: 'Consumable', equipment: 'Equipment',
}

function getCategoryStyle(cat) {
  if (cat === 'bridal_gown')   return { grad: 'linear-gradient(180deg,#1a0a0e 0%,#3d1520 60%,#6b2535 100%)', emoji: '👗', accent: '#C9697A' }
  if (cat === 'quince_gown')   return { grad: 'linear-gradient(180deg,#0e0818 0%,#2d1060 60%,#5b21b6 100%)', emoji: '👗', accent: '#8B5CF6' }
  if (['veil','headpiece','jewelry'].includes(cat)) return { grad: 'linear-gradient(180deg,#1a1500 0%,#4a3800 60%,#92700a 100%)', emoji: '💍', accent: '#D97706' }
  if (['arch','centerpiece','linen','lighting','chair','ceremony'].includes(cat)) return { grad: 'linear-gradient(180deg,#071a0e 0%,#0f4020 60%,#166534 100%)', emoji: '🌸', accent: '#16A34A' }
  return { grad: 'linear-gradient(180deg,#111 0%,#333 100%)', emoji: '✨', accent: '#C9697A' }
}

function getAvailBadge(status, availQty) {
  if (status === 'available' || (availQty != null && availQty > 0)) return { label: 'Available', bg: '#16A34A' }
  if (status === 'reserved') return { label: 'Reserved', bg: '#D97706' }
  return { label: 'Out', bg: '#DC2626' }
}

function fmtPrice(price) {
  if (!price && price !== 0) return null
  return `$${Number(price).toLocaleString('en-US', { minimumFractionDigits: 0 })}`
}

function wishlistKey(bid) { return `catalog_wishlist_${bid}` }
function loadWishlist(bid) { try { return JSON.parse(localStorage.getItem(wishlistKey(bid)) || '[]') } catch { return [] } }
function saveWishlist(bid, ids) { try { localStorage.setItem(wishlistKey(bid), JSON.stringify(ids)) } catch {} }

// ─── KIOSK RATE LIMIT ────────────────────────────────────────────────────────
const KIOSK_RATE_KEY = 'belori_kiosk_last_booking'
const KIOSK_COOLDOWN_MS = 5 * 60 * 1000 // 5 minutes

function checkKioskRateLimit() {
  const last = localStorage.getItem(KIOSK_RATE_KEY)
  if (last && Date.now() - Number(last) < KIOSK_COOLDOWN_MS) {
    const remaining = Math.ceil((KIOSK_COOLDOWN_MS - (Date.now() - Number(last))) / 1000)
    throw new Error(`Please wait ${remaining} seconds before booking again.`)
  }
}

function recordKioskBooking() {
  localStorage.setItem(KIOSK_RATE_KEY, String(Date.now()))
}

// ─── GLOBAL STYLES ──────────────────────────────────────────────────────────
const STYLE = `
* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
body { margin: 0; overflow: hidden; }
.ck-swipe-container { scroll-snap-type: y mandatory; overflow-y: scroll; height: 100vh; scrollbar-width: none; }
.ck-swipe-container::-webkit-scrollbar { display: none; }
.ck-slide { scroll-snap-align: start; scroll-snap-stop: always; }
.ck-btn:active { transform: scale(0.94); opacity: 0.85; }
.ck-heart { transition: transform 0.2s cubic-bezier(0.34,1.56,0.64,1); }
.ck-heart.pop { transform: scale(1.4); }
@keyframes like-burst { 0%{transform:scale(0);opacity:1} 60%{transform:scale(1.8);opacity:0.6} 100%{transform:scale(2.5);opacity:0} }
.ck-like-burst { animation: like-burst 0.5s ease-out forwards; position:absolute; pointer-events:none; }
@keyframes slide-up { from{transform:translateY(100%)} to{transform:translateY(0)} }
.ck-sheet { animation: slide-up 0.3s cubic-bezier(0.32,0.72,0,1) }
@keyframes fade-in { from{opacity:0} to{opacity:1} }
.ck-fade { animation: fade-in 0.25s ease }
`

// ─── PIN MODAL ───────────────────────────────────────────────────────────────
function PinModal({ onSuccess, onCancel }) {
  const [digits, setDigits] = useState([])
  const [error, setError] = useState(false)
  const PIN = localStorage.getItem('belori_kiosk_pin') || '1234'

  function press(d) {
    if (digits.length >= 4) return
    const next = [...digits, String(d)]
    setError(false); setDigits(next)
    if (next.length === 4) {
      if (next.join('') === PIN) setTimeout(() => onSuccess(), 200)
      else setTimeout(() => { setDigits([]); setError(true) }, 400)
    }
  }

  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999,fontFamily:FONT }}>
      <div style={{ background:'#1a1a1a',borderRadius:24,padding:'36px 40px',textAlign:'center',width:320,border:'1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ fontSize:20,fontWeight:700,color:'#fff',marginBottom:6 }}>Exit Kiosk</div>
        <div style={{ fontSize:13,color:'rgba(255,255,255,0.5)',marginBottom:24 }}>Enter staff PIN</div>
        <div style={{ display:'flex',justifyContent:'center',gap:14,marginBottom:20 }}>
          {[0,1,2,3].map(i=>(
            <div key={i} style={{ width:16,height:16,borderRadius:'50%',background:digits.length>i?(error?'#EF4444':C.rosa):'rgba(255,255,255,0.2)',transition:'background 0.15s' }}/>
          ))}
        </div>
        {error && <div style={{ fontSize:12,color:'#EF4444',marginBottom:12,fontWeight:600 }}>Incorrect PIN</div>}
        <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
          {[[1,2,3],[4,5,6],[7,8,9],['',0,'⌫']].map((row,ri)=>(
            <div key={ri} style={{ display:'flex',gap:10,justifyContent:'center' }}>
              {row.map((k,ki)=> k==='' ? <div key={ki} style={{width:76,height:52}}/> : (
                <button key={ki} className="ck-btn" onClick={()=>k==='⌫'?setDigits(d=>d.slice(0,-1)):press(k)} style={{ width:76,height:52,borderRadius:12,border:'1px solid rgba(255,255,255,0.15)',background:'rgba(255,255,255,0.08)',fontSize:k==='⌫'?20:22,fontWeight:600,color:'#fff',cursor:'pointer',touchAction:'manipulation' }}>{k}</button>
              ))}
            </div>
          ))}
        </div>
        <button className="ck-btn" onClick={onCancel} style={{ marginTop:16,fontSize:13,color:'rgba(255,255,255,0.4)',background:'none',border:'none',cursor:'pointer',width:'100%',padding:'10px 0' }}>Cancel</button>
      </div>
    </div>
  )
}

// ─── REQUEST SHEET ────────────────────────────────────────────────────────────
function RequestSheet({ item, boutiqueId, onClose }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [date, setDate] = useState('')
  const [timeSlot, setTimeSlot] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  async function submit() {
    if (!name.trim()) return
    try {
      checkKioskRateLimit()
    } catch (err) {
      alert(err.message)
      return
    }
    setSaving(true)
    const timeMap = { Morning: '10:00', Afternoon: '14:00', Evening: '18:00' }
    await supabase.from('appointments').insert({
      boutique_id: boutiqueId,
      event_id: null,
      client_name: name.trim(),
      client_phone: phone.trim() || null,
      type: 'consultation',
      date: date || new Date().toISOString().split('T')[0],
      time: timeMap[timeSlot] || '10:00',
      note: `Try-on request: ${item.name}${notes ? ' · ' + notes : ''}`,
      status: 'scheduled',
    })
    recordKioskBooking()
    setSaving(false)
    setDone(true)
  }

  const inp = { width:'100%',padding:'14px 16px',borderRadius:14,border:'1px solid rgba(255,255,255,0.12)',background:'rgba(255,255,255,0.06)',color:'#fff',fontSize:16,fontFamily:FONT,outline:'none' }

  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.65)',display:'flex',alignItems:'flex-end',zIndex:1000,fontFamily:FONT }} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="ck-sheet" style={{ width:'100%',maxHeight:'90vh',background:'#1a1a1a',borderRadius:'24px 24px 0 0',border:'1px solid rgba(255,255,255,0.1)',overflowY:'auto' }}>
        {/* Handle */}
        <div style={{ display:'flex',justifyContent:'center',paddingTop:12,paddingBottom:8 }}>
          <div style={{ width:40,height:4,borderRadius:2,background:'rgba(255,255,255,0.2)' }}/>
        </div>

        <div style={{ padding:'0 24px 40px' }}>
          {done ? (
            <div style={{ textAlign:'center',padding:'40px 0' }}>
              <div style={{ fontSize:52,marginBottom:12 }}>✨</div>
              <div style={{ fontSize:22,fontWeight:700,color:'#fff',marginBottom:8 }}>Request Sent!</div>
              <div style={{ fontSize:15,color:'rgba(255,255,255,0.6)',marginBottom:28 }}>We'll reach out to confirm your try-on appointment.</div>
              <button className="ck-btn" onClick={onClose} style={{ padding:'14px 40px',borderRadius:50,background:C.rosa,color:'#fff',fontSize:16,fontWeight:700,border:'none',cursor:'pointer',touchAction:'manipulation' }}>Back to Catalog</button>
            </div>
          ) : (
            <>
              <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20 }}>
                <div>
                  <div style={{ fontSize:20,fontWeight:700,color:'#fff' }}>Book a Try-On</div>
                  <div style={{ fontSize:13,color:'rgba(255,255,255,0.5)',marginTop:2 }}>{item.name}</div>
                </div>
                <button className="ck-btn" onClick={onClose} style={{ width:36,height:36,borderRadius:'50%',background:'rgba(255,255,255,0.1)',border:'none',color:'rgba(255,255,255,0.7)',fontSize:18,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }} aria-label="Close">×</button>
              </div>

              <div style={{ display:'flex',flexDirection:'column',gap:12 }}>
                <input style={inp} placeholder="Your name *" value={name} onChange={e=>setName(e.target.value)}/>
                <input style={inp} placeholder="Phone number" type="tel" value={phone} onChange={e=>setPhone(e.target.value)}/>
                <input style={inp} type="date" value={date} onChange={e=>setDate(e.target.value)} min={new Date().toISOString().split('T')[0]}/>

                <div style={{ display:'flex',gap:8 }}>
                  {['Morning','Afternoon','Evening'].map(t=>(
                    <button key={t} className="ck-btn" onClick={()=>setTimeSlot(t)} style={{ flex:1,padding:'12px 6px',borderRadius:12,border:`1.5px solid ${timeSlot===t?C.rosa:'rgba(255,255,255,0.12)'}`,background:timeSlot===t?C.rosa+'22':'rgba(255,255,255,0.05)',color:timeSlot===t?C.rosaText:'rgba(255,255,255,0.6)',fontSize:13,fontWeight:600,cursor:'pointer',touchAction:'manipulation' }}>
                      {t==='Morning'?'🌅':t==='Afternoon'?'☀️':'🌙'} {t}
                    </button>
                  ))}
                </div>

                <textarea style={{...inp,resize:'none',minHeight:80}} placeholder="Any notes or special requests…" value={notes} onChange={e=>setNotes(e.target.value)} rows={3}/>

                <button className="ck-btn" onClick={submit} disabled={!name.trim()||saving} style={{ padding:'18px',borderRadius:16,border:'none',background:!name.trim()||saving?'rgba(255,255,255,0.1)':`linear-gradient(135deg,${C.rosa} 0%,#7C3AED 100%)`,color:'#fff',fontSize:18,fontWeight:700,cursor:'pointer',touchAction:'manipulation',opacity:!name.trim()||saving?0.5:1 }}>
                  {saving ? 'Sending…' : 'Send Request ✨'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── SINGLE ITEM SLIDE ────────────────────────────────────────────────────────
function ItemSlide({ item, isWishlisted, onWishlist, onRequest, onDoubleTap, index, total }) {
  const catStyle = getCategoryStyle(item.category)
  const avail = getAvailBadge(item.status, item.availQty)
  const price = fmtPrice(item.price)
  const [showBurst, setShowBurst] = useState(false)
  const lastTap = useRef(0)

  function handleTap() {
    const now = Date.now()
    if (now - lastTap.current < 300) {
      // double tap
      onDoubleTap(item)
      setShowBurst(true)
      setTimeout(() => setShowBurst(false), 600)
    }
    lastTap.current = now
  }

  return (
    <div className="ck-slide" style={{ position:'relative',width:'100vw',height:'100vh',overflow:'hidden',background:'#000',fontFamily:FONT }} onClick={handleTap}>

      {/* Background image or gradient */}
      {item.image_url
        ? <img src={item.image_url} alt={item.name} style={{ position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',opacity:0.85 }}/>
        : (
          <div style={{ position:'absolute',inset:0,background:catStyle.grad,display:'flex',alignItems:'center',justifyContent:'center' }}>
            <span style={{ fontSize:'35vw',opacity:0.15,userSelect:'none' }}>{catStyle.emoji}</span>
          </div>
        )
      }

      {/* Gradient overlay — bottom */}
      <div style={{ position:'absolute',inset:0,background:'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.4) 40%, rgba(0,0,0,0.1) 70%, transparent 100%)' }}/>

      {/* Like burst */}
      {showBurst && (
        <div style={{ position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',pointerEvents:'none',zIndex:10 }}>
          <span className="ck-like-burst" style={{ fontSize:80 }}>♥</span>
        </div>
      )}

      {/* Counter top-right */}
      <div style={{ position:'absolute',top:20,right:20,fontSize:12,color:'rgba(255,255,255,0.5)',fontWeight:500,letterSpacing:'0.05em' }}>
        {index + 1} / {total}
      </div>

      {/* Right side action rail */}
      <div style={{ position:'absolute',right:16,bottom:160,display:'flex',flexDirection:'column',alignItems:'center',gap:20,zIndex:5 }}>
        {/* Heart */}
        <button className="ck-btn" onClick={e=>{e.stopPropagation();onWishlist(item.id)}} style={{ background:'none',border:'none',cursor:'pointer',touchAction:'manipulation',display:'flex',flexDirection:'column',alignItems:'center',gap:4,padding:0 }}>
          <div className={`ck-heart${isWishlisted?' pop':''}`} style={{ width:52,height:52,borderRadius:'50%',background:'rgba(0,0,0,0.4)',backdropFilter:'blur(8px)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,border:'1px solid rgba(255,255,255,0.15)' }}>
            {isWishlisted ? '❤️' : '🤍'}
          </div>
          <span style={{ fontSize:11,color:'rgba(255,255,255,0.7)',fontWeight:600 }}>Save</span>
        </button>

        {/* Try-on */}
        <button className="ck-btn" onClick={e=>{e.stopPropagation();onRequest(item)}} style={{ background:'none',border:'none',cursor:'pointer',touchAction:'manipulation',display:'flex',flexDirection:'column',alignItems:'center',gap:4,padding:0 }}>
          <div style={{ width:52,height:52,borderRadius:'50%',background:'rgba(0,0,0,0.4)',backdropFilter:'blur(8px)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,border:'1px solid rgba(255,255,255,0.15)' }}>
            📅
          </div>
          <span style={{ fontSize:11,color:'rgba(255,255,255,0.7)',fontWeight:600 }}>Try On</span>
        </button>
      </div>

      {/* Bottom info */}
      <div style={{ position:'absolute',bottom:0,left:0,right:72,padding:'0 20px 36px',zIndex:5 }}>
        {/* Availability + category */}
        <div style={{ display:'flex',gap:8,marginBottom:10,flexWrap:'wrap' }}>
          <span style={{ fontSize:12,fontWeight:700,padding:'4px 10px',borderRadius:50,background:avail.bg,color:'#fff',letterSpacing:'0.02em' }}>{avail.label}</span>
          <span style={{ fontSize:12,fontWeight:600,padding:'4px 10px',borderRadius:50,background:'rgba(255,255,255,0.15)',backdropFilter:'blur(8px)',color:'rgba(255,255,255,0.9)' }}>
            {CATEGORY_LABELS[item.category] || item.category}
          </span>
          {item.color && (
            <span style={{ fontSize:12,fontWeight:600,padding:'4px 10px',borderRadius:50,background:'rgba(255,255,255,0.15)',backdropFilter:'blur(8px)',color:'rgba(255,255,255,0.9)' }}>
              {item.color}
            </span>
          )}
        </div>

        {/* Name */}
        <div style={{ fontSize:26,fontWeight:800,color:'#fff',lineHeight:1.2,marginBottom:6,textShadow:'0 2px 8px rgba(0,0,0,0.5)' }}>
          {item.name}
        </div>

        {/* Price + size */}
        <div style={{ display:'flex',alignItems:'baseline',gap:12 }}>
          {price && <span style={{ fontSize:22,fontWeight:700,color:'#fff' }}>{price}</span>}
          {price && <span style={{ fontSize:13,color:'rgba(255,255,255,0.5)' }}>rental</span>}
          {item.size && <span style={{ fontSize:13,color:'rgba(255,255,255,0.6)',fontWeight:500 }}>Size {item.size}</span>}
        </div>

        {item.notes && (
          <div style={{ fontSize:13,color:'rgba(255,255,255,0.55)',marginTop:6,lineHeight:1.4,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden' }}>
            {item.notes}
          </div>
        )}

        {/* Swipe hint */}
        <div style={{ fontSize:11,color:'rgba(255,255,255,0.3)',marginTop:12,letterSpacing:'0.05em' }}>
          Swipe up for next ↑
        </div>
      </div>
    </div>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function CatalogKioskPage() {
  const params = new URLSearchParams(window.location.search)
  const boutiqueId = params.get('boutique') || localStorage.getItem('activeBoutiqueId') || ''

  const [boutiqueName, setBoutiqueName] = useState('')
  const [allItems, setAllItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState('all')
  const [showPin, setShowPin] = useState(false)
  const [requestItem, setRequestItem] = useState(null)
  const [wishlistIds, setWishlistIds] = useState(() => loadWishlist(boutiqueId))
  const [currentIndex, setCurrentIndex] = useState(0)
  const [wishlistCount, setWishlistCount] = useState(() => loadWishlist(boutiqueId).length)
  const [showWishlistSheet, setShowWishlistSheet] = useState(false)
  const [viewMode, setViewMode] = useState('swipe') // 'swipe' | 'grid'
  const containerRef = useRef(null)
  const slideRefs = useRef([])

  // Filter items by category
  const items = React.useMemo(() => {
    const group = CATEGORY_GROUPS.find(g => g.key === activeCategory)
    if (!group || !group.cats) return allItems
    return allItems.filter(item => group.cats.includes(item.category))
  }, [allItems, activeCategory])

  // Track current slide via IntersectionObserver
  useEffect(() => {
    if (!containerRef.current) return
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const idx = slideRefs.current.indexOf(entry.target)
          if (idx !== -1) setCurrentIndex(idx)
        }
      })
    }, { root: containerRef.current, threshold: 0.6 })
    slideRefs.current.forEach(el => el && observer.observe(el))
    return () => observer.disconnect()
  }, [items])

  // Fetch data
  useEffect(() => {
    if (!boutiqueId) { setLoading(false); return }
    async function load() {
      const [bRes, invRes] = await Promise.all([
        supabase.from('boutiques').select('name').eq('id', boutiqueId).single(),
        supabase.from('inventory')
          .select('id, name, sku, category, color, size, price, deposit, status, condition, notes, availQty, totalQty, image_url')
          .eq('boutique_id', boutiqueId)
          .neq('status', 'retired')
          .order('name'),
      ])
      if (bRes.data) setBoutiqueName(bRes.data.name)
      if (invRes.data) setAllItems(invRes.data)
      setLoading(false)
    }
    load()
  }, [boutiqueId])

  // Reset scroll to top when category changes
  useEffect(() => {
    setCurrentIndex(0)
    if (containerRef.current) containerRef.current.scrollTop = 0
  }, [activeCategory])

  function toggleWishlist(id) {
    setWishlistIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      saveWishlist(boutiqueId, next)
      setWishlistCount(next.length)
      return next
    })
  }

  function handleDoubleTap(item) {
    if (!wishlistIds.includes(item.id)) toggleWishlist(item.id)
  }

  function scrollToSlide(idx) {
    const el = slideRefs.current[idx]
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }

  if (!boutiqueId) return (
    <div style={{ minHeight:'100vh',background:'#000',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:FONT,color:'rgba(255,255,255,0.5)',fontSize:16 }}>
      No boutique ID provided
    </div>
  )

  if (loading) return (
    <div style={{ minHeight:'100vh',background:'#000',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:FONT }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:40,marginBottom:12 }}>👗</div>
        <div style={{ color:'rgba(255,255,255,0.5)',fontSize:16 }}>Loading catalog…</div>
      </div>
    </div>
  )

  const wishlistItems = allItems.filter(i => wishlistIds.includes(i.id))

  return (
    <>
      <style>{STYLE}</style>

      {/* ── TOP HUD ── */}
      <div style={{ position:'fixed',top:0,left:0,right:0,zIndex:100,padding:'14px 20px',display:'flex',alignItems:'center',justifyContent:'space-between',background:'linear-gradient(to bottom,rgba(0,0,0,0.6) 0%,transparent 100%)',fontFamily:FONT,pointerEvents:'none' }}>
        {/* Left: boutique name */}
        <div style={{ fontSize:15,fontWeight:700,color:'#fff',textShadow:'0 1px 4px rgba(0,0,0,0.6)',letterSpacing:'-0.2px' }}>
          {boutiqueName}
        </div>
        {/* Right: wishlist + exit */}
        <div style={{ display:'flex',gap:10,pointerEvents:'auto',alignItems:'center' }}>
          {/* View toggle */}
          <div style={{ display:'flex',borderRadius:50,overflow:'hidden',border:'1px solid rgba(255,255,255,0.2)',background:'rgba(0,0,0,0.4)',backdropFilter:'blur(8px)' }}>
            <button className="ck-btn" onClick={() => setViewMode('swipe')} style={{ padding:'8px 14px',border:'none',background:viewMode==='swipe'?'rgba(255,255,255,0.2)':'transparent',color:'#fff',fontSize:16,cursor:'pointer',touchAction:'manipulation',lineHeight:1 }} title="Swipe view">⬆️</button>
            <button className="ck-btn" onClick={() => setViewMode('grid')} style={{ padding:'8px 14px',border:'none',background:viewMode==='grid'?'rgba(255,255,255,0.2)':'transparent',color:'#fff',fontSize:16,cursor:'pointer',touchAction:'manipulation',lineHeight:1 }} title="Grid view">⊞</button>
          </div>
          <button className="ck-btn" onClick={() => setShowWishlistSheet(true)} style={{ position:'relative',width:44,height:44,borderRadius:'50%',background:'rgba(0,0,0,0.4)',backdropFilter:'blur(8px)',border:'1px solid rgba(255,255,255,0.15)',color:'#fff',fontSize:20,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',touchAction:'manipulation' }}>
            ❤️
            {wishlistCount > 0 && (
              <span style={{ position:'absolute',top:0,right:0,width:18,height:18,borderRadius:'50%',background:C.rosa,color:'#fff',fontSize:10,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',border:'2px solid #000' }}>{wishlistCount}</span>
            )}
          </button>
          <button className="ck-btn" onClick={() => setShowPin(true)} style={{ width:44,height:44,borderRadius:'50%',background:'rgba(0,0,0,0.4)',backdropFilter:'blur(8px)',border:'1px solid rgba(255,255,255,0.15)',color:'rgba(255,255,255,0.7)',fontSize:12,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',touchAction:'manipulation' }}>
            Exit
          </button>
        </div>
      </div>

      {/* ── CATEGORY TABS ── */}
      <div style={{ position:'fixed',top:70,left:0,right:0,zIndex:100,padding:'0 16px',pointerEvents:'auto',fontFamily:FONT }}>
        <div style={{ display:'flex',gap:8,overflowX:'auto',scrollbarWidth:'none',paddingBottom:4 }} className="ck-filter-scroll">
          {CATEGORY_GROUPS.map(g => (
            <button key={g.key} className="ck-btn" onClick={() => setActiveCategory(g.key)} style={{ flexShrink:0,padding:'7px 16px',borderRadius:50,border:'none',background:activeCategory===g.key?'rgba(255,255,255,0.95)':'rgba(0,0,0,0.45)',backdropFilter:'blur(12px)',color:activeCategory===g.key?C.ink:'rgba(255,255,255,0.85)',fontSize:13,fontWeight:600,cursor:'pointer',touchAction:'manipulation',transition:'all 0.15s',WebkitBorderBeforeStyle:'1px solid rgba(255,255,255,0.1)' }}>
              {g.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── EMPTY STATE ── */}
      {items.length === 0 && (
        <div style={{ minHeight:'100vh',background:'#111',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:FONT,flexDirection:'column',gap:12 }}>
          <span style={{ fontSize:48 }}>👗</span>
          <div style={{ color:'rgba(255,255,255,0.5)',fontSize:16 }}>No items in this category</div>
          <button className="ck-btn" onClick={() => setActiveCategory('all')} style={{ marginTop:8,padding:'12px 28px',borderRadius:50,background:C.rosa,color:'#fff',border:'none',fontSize:15,fontWeight:600,cursor:'pointer' }}>Show all</button>
        </div>
      )}

      {/* ── SWIPE FEED ── */}
      {items.length > 0 && viewMode === 'swipe' && (
        <div ref={containerRef} className="ck-swipe-container">
          {items.map((item, idx) => (
            <div key={item.id} ref={el => slideRefs.current[idx] = el}>
              <ItemSlide
                item={item}
                index={idx}
                total={items.length}
                isWishlisted={wishlistIds.includes(item.id)}
                onWishlist={toggleWishlist}
                onRequest={setRequestItem}
                onDoubleTap={handleDoubleTap}
              />
            </div>
          ))}
        </div>
      )}

      {/* ── GRID VIEW ── */}
      {items.length > 0 && viewMode === 'grid' && (
        <div style={{ minHeight:'100vh',background:'#111',paddingTop:130,paddingBottom:40,overflowY:'auto',fontFamily:FONT }}>
          <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:16,padding:'0 16px',maxWidth:1200,margin:'0 auto' }}>
            {items.map(item => {
              const catStyle = getCategoryStyle(item.category)
              const avail = getAvailBadge(item.status, item.availQty)
              const price = fmtPrice(item.price)
              const isWishlisted = wishlistIds.includes(item.id)
              return (
                <div key={item.id} className="ck-btn" onClick={() => setRequestItem(item)} style={{ background:'#1a1a1a',borderRadius:20,overflow:'hidden',border:'1px solid rgba(255,255,255,0.08)',cursor:'pointer',touchAction:'manipulation',transition:'transform 0.15s,box-shadow 0.15s' }}>
                  {/* Image */}
                  <div style={{ height:220,position:'relative',background:catStyle.grad,display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden' }}>
                    {item.image_url
                      ? <img src={item.image_url} alt={item.name} style={{ width:'100%',height:'100%',objectFit:'cover' }}/>
                      : <span style={{ fontSize:80,opacity:0.3 }}>{catStyle.emoji}</span>
                    }
                    {/* Availability badge */}
                    <span style={{ position:'absolute',top:12,left:12,fontSize:11,fontWeight:700,padding:'4px 10px',borderRadius:50,background:avail.bg,color:'#fff' }}>{avail.label}</span>
                    {/* Heart button */}
                    <button className="ck-btn" onClick={e => { e.stopPropagation(); toggleWishlist(item.id) }} style={{ position:'absolute',top:8,right:8,width:38,height:38,borderRadius:'50%',background:'rgba(0,0,0,0.5)',backdropFilter:'blur(8px)',border:'none',fontSize:18,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',touchAction:'manipulation' }}>
                      {isWishlisted ? '❤️' : '🤍'}
                    </button>
                  </div>
                  {/* Info */}
                  <div style={{ padding:'14px 16px 16px' }}>
                    <div style={{ fontSize:16,fontWeight:700,color:'#fff',marginBottom:6,lineHeight:1.3 }}>{item.name}</div>
                    <div style={{ display:'flex',gap:6,flexWrap:'wrap',marginBottom:10 }}>
                      <span style={{ fontSize:11,padding:'3px 8px',borderRadius:50,background:'rgba(255,255,255,0.1)',color:'rgba(255,255,255,0.7)',fontWeight:600 }}>{CATEGORY_LABELS[item.category] || item.category}</span>
                      {item.color && <span style={{ fontSize:11,padding:'3px 8px',borderRadius:50,background:'rgba(255,255,255,0.1)',color:'rgba(255,255,255,0.7)' }}>{item.color}</span>}
                      {item.size && <span style={{ fontSize:11,padding:'3px 8px',borderRadius:50,background:'rgba(255,255,255,0.1)',color:'rgba(255,255,255,0.7)' }}>Size {item.size}</span>}
                    </div>
                    <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between' }}>
                      {price && <span style={{ fontSize:18,fontWeight:700,color:'#fff' }}>{price}</span>}
                      <button className="ck-btn" onClick={e => { e.stopPropagation(); setRequestItem(item) }} style={{ padding:'10px 18px',borderRadius:50,border:'none',background:`linear-gradient(135deg,${C.rosa} 0%,#7C3AED 100%)`,color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer',touchAction:'manipulation' }}>
                        Book Try-On
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── SIDE PROGRESS DOTS ── */}
      {viewMode === 'swipe' && items.length > 1 && items.length <= 20 && (
        <div style={{ position:'fixed',right:8,top:'50%',transform:'translateY(-50%)',zIndex:90,display:'flex',flexDirection:'column',gap:4,pointerEvents:'none' }}>
          {items.map((_,i) => (
            <div key={i} style={{ width:3,height:i===currentIndex?18:4,borderRadius:2,background:i===currentIndex?'rgba(255,255,255,0.9)':'rgba(255,255,255,0.25)',transition:'all 0.2s ease' }}/>
          ))}
        </div>
      )}

      {/* ── WISHLIST SHEET ── */}
      {showWishlistSheet && (
        <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:200,fontFamily:FONT }} onClick={e=>e.target===e.currentTarget&&setShowWishlistSheet(false)}>
          <div className="ck-sheet" style={{ position:'absolute',bottom:0,left:0,right:0,maxHeight:'85vh',background:'#1a1a1a',borderRadius:'24px 24px 0 0',border:'1px solid rgba(255,255,255,0.1)',display:'flex',flexDirection:'column' }}>
            <div style={{ display:'flex',justifyContent:'center',padding:'12px 0 8px' }}>
              <div style={{ width:40,height:4,borderRadius:2,background:'rgba(255,255,255,0.2)' }}/>
            </div>
            <div style={{ padding:'0 20px 12px',display:'flex',alignItems:'center',justifyContent:'space-between' }}>
              <div style={{ fontSize:18,fontWeight:700,color:'#fff' }}>❤️ Saved ({wishlistItems.length})</div>
              <button className="ck-btn" onClick={() => setShowWishlistSheet(false)} style={{ width:32,height:32,borderRadius:'50%',background:'rgba(255,255,255,0.1)',border:'none',color:'rgba(255,255,255,0.7)',fontSize:18,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}>×</button>
            </div>
            <div style={{ flex:1,overflowY:'auto',padding:'0 20px 32px' }}>
              {wishlistItems.length === 0 ? (
                <div style={{ textAlign:'center',padding:'40px 0',color:'rgba(255,255,255,0.4)',fontSize:15 }}>
                  <div style={{ fontSize:40,marginBottom:12 }}>🤍</div>
                  Double-tap or press ♥ on any item to save it
                </div>
              ) : (
                <div style={{ display:'flex',flexDirection:'column',gap:12 }}>
                  {wishlistItems.map(item => {
                    const catStyle = getCategoryStyle(item.category)
                    const avail = getAvailBadge(item.status, item.availQty)
                    return (
                      <div key={item.id} style={{ display:'flex',gap:12,alignItems:'center',background:'rgba(255,255,255,0.05)',borderRadius:16,padding:'12px 14px',border:'1px solid rgba(255,255,255,0.08)' }}>
                        {/* Thumb */}
                        <div style={{ width:56,height:56,borderRadius:12,flexShrink:0,overflow:'hidden',background:catStyle.grad,display:'flex',alignItems:'center',justifyContent:'center' }}>
                          {item.image_url
                            ? <img src={item.image_url} alt={item.name} style={{ width:'100%',height:'100%',objectFit:'cover' }}/>
                            : <span style={{ fontSize:26 }}>{catStyle.emoji}</span>
                          }
                        </div>
                        <div style={{ flex:1,minWidth:0 }}>
                          <div style={{ fontSize:14,fontWeight:700,color:'#fff',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{item.name}</div>
                          <div style={{ display:'flex',gap:6,marginTop:4,flexWrap:'wrap' }}>
                            <span style={{ fontSize:11,padding:'2px 8px',borderRadius:50,background:avail.bg,color:'#fff',fontWeight:600 }}>{avail.label}</span>
                            {item.price && <span style={{ fontSize:12,color:'rgba(255,255,255,0.7)',fontWeight:700 }}>{fmtPrice(item.price)}</span>}
                          </div>
                        </div>
                        <div style={{ display:'flex',flexDirection:'column',gap:8,flexShrink:0 }}>
                          <button className="ck-btn" onClick={() => { setRequestItem(item); setShowWishlistSheet(false) }} style={{ padding:'8px 14px',borderRadius:10,border:'none',background:C.rosa,color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer',touchAction:'manipulation',whiteSpace:'nowrap' }}>
                            Try On
                          </button>
                          <button className="ck-btn" onClick={() => toggleWishlist(item.id)} style={{ padding:'8px 14px',borderRadius:10,border:'1px solid rgba(255,255,255,0.15)',background:'transparent',color:'rgba(255,255,255,0.5)',fontSize:12,fontWeight:500,cursor:'pointer',touchAction:'manipulation' }}>
                            Remove
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── REQUEST SHEET ── */}
      {requestItem && (
        <RequestSheet item={requestItem} boutiqueId={boutiqueId} onClose={() => setRequestItem(null)} />
      )}

      {/* ── PIN MODAL ── */}
      {showPin && (
        <PinModal
          onSuccess={() => { setShowPin(false); window.history.back() }}
          onCancel={() => setShowPin(false)}
        />
      )}
    </>
  )
}
