import React, { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { C } from '../lib/colors'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

// ── Label maps ────────────────────────────────────────────────────────────────
const EVT_LABELS = {
  wedding:       'Wedding 💍',
  quince:        'Quinceañera 👑',
  baptism:       'Baptism 🕊️',
  birthday:      'Birthday 🎂',
  anniversary:   'Anniversary 💕',
  graduation:    'Graduation 🎓',
  baby_shower:   'Baby Shower 🍼',
  bridal_shower: 'Bridal Shower 💐',
  party:         'Party 🎉',
  other:         'Event 🎊',
}

const SVC_LABELS = {
  dress_rental:  'Dress Rental',
  alterations:   'Alterations',
  planning:      'Event Planning',
  decoration:    'Decoration',
  photography:   'Photography',
  catering:      'Catering',
  florals:       'Florals',
  venue:         'Venue',
  dj:            'DJ / Music',
  other:         'Other',
}

const CAT_LABELS = {
  bridal_gown:  'Bridal Gown',
  quince_gown:  'Quinceañera Gown',
  arch:         'Arch',
  centerpiece:  'Centerpiece',
  linen:        'Linen',
  lighting:     'Lighting',
  chair:        'Chair',
  veil:         'Veil',
  headpiece:    'Headpiece',
  jewelry:      'Jewelry',
  ceremony:     'Ceremony',
  consumable:   'Consumable',
  equipment:    'Equipment',
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(Number(n) || 0)
}
function fmtDate(d) {
  if (!d) return '—'
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}
function fmtShortDate(d) {
  if (!d) return '—'
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
function daysUntil(d) {
  if (!d) return null
  return Math.ceil((new Date(d + 'T12:00:00') - new Date()) / 86400000)
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const centered = {
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: 'Inter,system-ui,sans-serif',
  padding: 24,
  textAlign: 'center',
  background: C.ivory,
  color: C.ink,
}
const card = {
  background: C.white,
  borderRadius: 16,
  border: `1px solid ${C.border}`,
  marginBottom: 14,
  boxShadow: '0 2px 12px rgba(28,16,18,0.06)',
  overflow: 'hidden',
}
const cardHead = {
  padding: '14px 18px',
  borderBottom: `1px solid #F3F4F6`,
  fontSize: 13,
  fontWeight: 600,
  color: C.ink,
}

// ── Spinner ───────────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <div style={centered}>
      <div style={{
        width: 44, height: 44, borderRadius: '50%',
        border: `3px solid ${C.rosaLight}`,
        borderTopColor: C.rosa,
        animation: 'spin 0.8s linear infinite',
        marginBottom: 18,
      }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ fontSize: 20, marginBottom: 8 }}>
        <span style={{ fontFamily: 'Georgia,serif', color: C.rosa, fontWeight: 600 }}>Belori</span>
      </div>
      <div style={{ fontSize: 13, color: C.gray }}>Loading your event portal…</div>
    </div>
  )
}

// ── InspirationUpload component ───────────────────────────────────────────────
function InspirationUpload({ event, portalToken }) {
  const [files, setFiles]               = useState([])
  const [uploading, setUploading]       = useState(false)
  const [uploadErr, setUploadErr]       = useState(null)
  const [dragOver, setDragOver]         = useState(false)
  const [loadingFiles, setLoadingFiles] = useState(true)
  const fileInputRef = useRef(null)

  const prefix = `${event.boutique_id}/${event.id}`

  useEffect(() => {
    async function loadFiles() {
      try {
        const { data, error } = await supabase.storage
          .from('event-inspiration')
          .list(prefix, { limit: 50, sortBy: { column: 'created_at', order: 'desc' } })
        if (error) { setLoadingFiles(false); return }
        const items = (data || []).filter(f => f.name && !f.name.startsWith('.'))
        const withUrls = items.map(f => {
          const { data: { publicUrl } } = supabase.storage
            .from('event-inspiration')
            .getPublicUrl(`${prefix}/${f.name}`)
          return { name: f.name, path: `${prefix}/${f.name}`, url: publicUrl }
        })
        setFiles(withUrls)
      } catch { /* silent */ } finally {
        setLoadingFiles(false)
      }
    }
    loadFiles()
  }, [prefix])

  async function handleFiles(fileList) {
    const accepted = Array.from(fileList).filter(f => f.type.startsWith('image/'))
    if (!accepted.length) return
    setUploading(true)
    setUploadErr(null)
    for (const file of accepted) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const uploadPath = `${prefix}/${Date.now()}-${safeName}`
      const { error } = await supabase.storage
        .from('event-inspiration')
        .upload(uploadPath, file, { cacheControl: '3600', upsert: false })
      if (error) {
        setUploadErr('Upload unavailable — please contact the boutique directly.')
        setUploading(false)
        return
      }
      const { data: { publicUrl } } = supabase.storage
        .from('event-inspiration')
        .getPublicUrl(uploadPath)
      const filename = uploadPath.split('/').pop()
      setFiles(prev => [{ name: filename, path: uploadPath, url: publicUrl }, ...prev])
    }
    setUploading(false)
  }

  async function removeFile(filePath) {
    const { error } = await supabase.storage.from('event-inspiration').remove([filePath])
    if (!error) setFiles(prev => prev.filter(f => f.path !== filePath))
  }

  function onDrop(e) {
    e.preventDefault()
    setDragOver(false)
    handleFiles(e.dataTransfer.files)
  }

  return (
    <div style={card}>
      <div style={cardHead}>💡 Inspiration</div>
      <div style={{ padding: '16px 18px' }}>
        <div style={{ fontSize: 13, color: C.gray, marginBottom: 14, lineHeight: 1.5 }}>
          Upload photos, Pinterest screenshots, or any inspiration you'd like us to see.
        </div>
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${dragOver ? C.rosa : C.border}`,
            borderRadius: 12,
            padding: '28px 16px',
            textAlign: 'center',
            cursor: 'pointer',
            background: dragOver ? C.rosaPale : '#FAFAFA',
            transition: 'border-color 0.2s, background 0.2s',
            marginBottom: 14,
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={e => handleFiles(e.target.files)}
          />
          <div style={{ fontSize: 28, marginBottom: 8 }}>{uploading ? '⏳' : '📸'}</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 4 }}>
            {uploading ? 'Uploading…' : 'Tap to upload or drag & drop'}
          </div>
          <div style={{ fontSize: 11, color: C.gray }}>PNG, JPG, WEBP accepted</div>
        </div>
        {uploadErr && (
          <div style={{ fontSize: 12, color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '8px 12px', marginBottom: 12 }}>
            {uploadErr}
          </div>
        )}
        {loadingFiles ? (
          <div style={{ fontSize: 12, color: C.gray, textAlign: 'center', padding: '8px 0' }}>Loading uploads…</div>
        ) : files.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {files.map(f => (
              <div key={f.path} style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: `1px solid ${C.border}`, aspectRatio: '1', background: '#F3F4F6' }}>
                <img src={f.url} alt={f.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} onError={e => { e.target.style.display = 'none' }}/>
                <button
                  onClick={() => removeFile(f.path)}
                  style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: '50%', background: 'rgba(0,0,0,0.55)', color: C.white, border: 'none', cursor: 'pointer', fontSize: 13, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  title="Remove"
                >×</button>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: C.gray, textAlign: 'center', padding: '4px 0' }}>No photos uploaded yet.</div>
        )}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ClientPortalPage() {
  const { token } = useParams()
  const [data, setData]         = useState(null)
  const [loading, setLoading]   = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!token) { setNotFound(true); setLoading(false); return }

    async function fetchPortal() {
      try {
        // Primary: use the DB RPC function (bypasses RLS, anon-accessible)
        const { data: rpcData, error: rpcErr } = await supabase
          .rpc('get_event_by_portal_token', { p_token: token })

        if (!rpcErr && rpcData) {
          // RPC returns a single jsonb row; enrich with extra data via edge function
          // for contracts and services (not included in the lean RPC)
          const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY
          let extra = { contracts: [], services: [], event_extra: {} }
          try {
            const r = await fetch(`${SUPABASE_URL}/functions/v1/get-portal-data?token=${token}`, {
              headers: { apikey: SUPABASE_ANON },
            })
            if (r.ok) {
              const j = await r.json()
              if (!j.error) {
                extra.contracts   = j.contracts   || []
                extra.services    = j.services    || []
                extra.event_extra = {
                  guests:              j.event?.guests,
                  inspiration_colors:  j.event?.inspiration_colors  || [],
                  inspiration_styles:  j.event?.inspiration_styles  || [],
                  inspiration_notes:   j.event?.inspiration_notes   || null,
                  inspiration_florals: j.event?.inspiration_florals || null,
                }
              }
            }
          } catch { /* optional enrichment — silent */ }

          setData({
            event: {
              ...rpcData,
              boutique_id: rpcData.boutique?.id,
              client_id:   rpcData.client?.id,
              ...extra.event_extra,
            },
            boutique:     rpcData.boutique     || {},
            client:       rpcData.client       || {},
            milestones:   rpcData.milestones   || [],
            appointments: rpcData.appointments || [],
            inventory:    rpcData.inventory    || [],
            contracts:    extra.contracts,
            services:     extra.services,
          })
          setLoading(false)
          return
        }

        // Fallback: edge function
        const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY
        const r = await fetch(`${SUPABASE_URL}/functions/v1/get-portal-data?token=${token}`, {
          headers: { apikey: SUPABASE_ANON },
        })
        const j = await r.json()
        if (j.error) { setNotFound(true) }
        else {
          setData({
            event:        j.event        || {},
            boutique:     j.boutique     || {},
            client:       j.client       || {},
            milestones:   j.milestones   || [],
            appointments: j.appointments || [],
            inventory:    [],
            contracts:    j.contracts    || [],
            services:     j.services     || [],
          })
        }
      } catch {
        setNotFound(true)
      }
      setLoading(false)
    }

    fetchPortal()
  }, [token])

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) return <Spinner />

  // ── Not found ──────────────────────────────────────────────────────────────
  if (notFound) return (
    <div style={centered}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: C.ink, marginBottom: 8 }}>Portal not found</div>
      <div style={{ fontSize: 14, color: C.gray, lineHeight: 1.6, maxWidth: 320 }}>
        This link is invalid or has expired. Please contact your boutique for a new link.
      </div>
    </div>
  )

  const { event, boutique, client, milestones, appointments, inventory, contracts, services } = data

  const days      = daysUntil(event.event_date)
  const paid      = Number(event.paid)  || 0
  const total     = Number(event.total) || 0
  const remaining = Math.max(0, total - paid)
  const paidPct   = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0
  const upcoming  = (appointments || []).filter(a => a.date && new Date(a.date) >= new Date())

  const urgency = days == null ? null
    : days < 0  ? { label: 'Event has passed',                bg: '#F3F4F6', col: C.gray    }
    : days === 0 ? { label: 'Today!',                         bg: '#FEE2E2', col: '#DC2626'  }
    : days <= 7  ? { label: `${days} day${days===1?'':'s'} away`, bg: '#FEE2E2', col: '#DC2626' }
    : days <= 30 ? { label: `${days} days away`,              bg: '#FEF3C7', col: '#D97706'  }
    : { label: `${days} days away`,                           bg: '#F0FDF4', col: C.green    }

  const unsignedContracts = (contracts || []).filter(c => c.status !== 'signed' && c.sign_token)

  return (
    <div style={{ minHeight: '100vh', background: C.ivory, fontFamily: 'Inter,system-ui,sans-serif', paddingBottom: 56 }}>

      {/* ── Hero header ─────────────────────────────────────────────────────── */}
      <div style={{
        background: `linear-gradient(135deg, #B85568 0%, ${C.rosa} 55%, #D4889A 100%)`,
        padding: '36px 20px 32px',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decorative circles */}
        <div style={{ position:'absolute',top:-30,right:-30,width:120,height:120,borderRadius:'50%',background:'rgba(255,255,255,0.07)',pointerEvents:'none' }}/>
        <div style={{ position:'absolute',bottom:-20,left:-20,width:80,height:80,borderRadius:'50%',background:'rgba(255,255,255,0.07)',pointerEvents:'none' }}/>

        {/* Boutique logo mark */}
        <div style={{ display:'flex',justifyContent:'center',marginBottom:14 }}>
          <div style={{ width:46,height:46,borderRadius:12,background:'rgba(255,255,255,0.18)',display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(4px)' }}>
            <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
              <path d="M7 25V7l18 18V7" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>

        {/* Boutique name */}
        <div style={{ fontSize:11,fontWeight:600,color:'rgba(255,255,255,0.8)',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:4 }}>
          {boutique?.name || 'Belori'}
        </div>
        {(boutique?.phone || boutique?.instagram) && (
          <div style={{ fontSize:11,color:'rgba(255,255,255,0.65)',marginBottom:14,display:'flex',gap:10,justifyContent:'center',flexWrap:'wrap' }}>
            {boutique.phone && <span>{boutique.phone}</span>}
            {boutique.instagram && <span>@{boutique.instagram.replace(/^@/,'')}</span>}
          </div>
        )}

        {/* Client name */}
        <div style={{ fontSize:28,fontWeight:700,color:C.white,fontFamily:'Georgia,serif',lineHeight:1.2,marginBottom:6 }}>
          {client?.name || 'Your Event'}
          {client?.partner_name && (
            <span style={{ fontWeight:400,opacity:0.85 }}> & {client.partner_name}</span>
          )}
        </div>

        {/* Subtitle */}
        <div style={{ fontSize:12,color:'rgba(255,255,255,0.7)',letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:12 }}>
          Your Event Details
        </div>

        {/* Badges row */}
        <div style={{ display:'flex',gap:8,justifyContent:'center',flexWrap:'wrap',marginBottom: event.event_date ? 10 : 0 }}>
          <span style={{ fontSize:12,fontWeight:600,padding:'5px 14px',borderRadius:20,background:'rgba(255,255,255,0.2)',color:C.white }}>
            {EVT_LABELS[event.type] || 'Event'}
          </span>
          {urgency && (
            <span style={{ fontSize:12,fontWeight:600,padding:'5px 14px',borderRadius:20,background:urgency.bg,color:urgency.col }}>
              {urgency.label}
            </span>
          )}
        </div>

        {/* Date */}
        {event.event_date && (
          <div style={{ fontSize:15,color:'rgba(255,255,255,0.92)',fontWeight:500,marginTop:8 }}>
            {fmtDate(event.event_date)}
          </div>
        )}

        {/* Venue */}
        {event.venue && (
          <div style={{ fontSize:12,color:'rgba(255,255,255,0.72)',marginTop:4 }}>
            📍 {event.venue}
          </div>
        )}
      </div>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '20px 16px' }}>

        {/* ── Unsigned contract alert ── */}
        {unsignedContracts.length > 0 && (
          <div style={{ background:'#FFFBEB',border:'1px solid #FDE68A',borderRadius:12,padding:'14px 16px',marginBottom:16,display:'flex',alignItems:'flex-start',gap:10 }}>
            <span style={{ fontSize:18,flexShrink:0 }}>📋</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13,fontWeight:600,color:'#92400E',marginBottom:4 }}>Contract awaiting your signature</div>
              {unsignedContracts.map(c => (
                <a key={c.id} href={`/sign/${c.sign_token}`}
                  style={{ display:'inline-block',marginTop:4,padding:'7px 14px',borderRadius:8,background:C.rosa,color:C.white,fontSize:12,fontWeight:600,textDecoration:'none' }}>
                  ✍ Sign "{c.title}" →
                </a>
              ))}
            </div>
          </div>
        )}

        {/* ── Event detail pill (guests) ── */}
        {event.guests && (
          <div style={{ ...card, padding:'14px 18px', display:'flex', gap:16, flexWrap:'wrap' }}>
            <div style={{ flex:1, minWidth:120 }}>
              <div style={{ fontSize:10,fontWeight:700,color:C.gray,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:4 }}>Guests</div>
              <div style={{ fontSize:13,color:C.ink,fontWeight:500 }}>~{event.guests}</div>
            </div>
          </div>
        )}

        {/* ── Services booked ── */}
        {services?.length > 0 && (
          <div style={{ ...card, padding:'14px 18px' }}>
            <div style={{ fontSize:13,fontWeight:600,color:C.ink,marginBottom:12 }}>✨ Your services</div>
            <div style={{ display:'flex',flexWrap:'wrap',gap:6 }}>
              {services.map(s => (
                <span key={s} style={{ fontSize:12,fontWeight:500,padding:'4px 12px',borderRadius:20,background:C.rosaPale,color:C.rosa,border:`1px solid ${C.rosa}22` }}>
                  {SVC_LABELS[s] || s.replace(/_/g,' ')}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── 1. Payment Summary ── */}
        <div style={card}>
          <div style={cardHead}>💳 Payment Summary</div>
          <div style={{ padding:'16px 18px' }}>

            {/* 3-col summary */}
            <div style={{ display:'flex',gap:0,marginBottom:16,borderRadius:10,overflow:'hidden',border:`1px solid ${C.border}` }}>
              {[
                { label:'Total',     value:fmt(total),     col:C.ink },
                { label:'Paid',      value:fmt(paid),      col:C.green },
                { label:'Remaining', value:fmt(remaining), col:remaining > 0 ? '#DC2626' : C.green },
              ].map((item, i) => (
                <div key={item.label} style={{ flex:1,padding:'10px 0',textAlign:'center',borderLeft:i>0?`1px solid ${C.border}`:'none',background:C.white }}>
                  <div style={{ fontSize:10,fontWeight:600,color:C.gray,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:3 }}>{item.label}</div>
                  <div style={{ fontSize:15,fontWeight:700,color:item.col }}>{item.value}</div>
                </div>
              ))}
            </div>

            {/* Progress bar */}
            <div style={{ display:'flex',justifyContent:'space-between',fontSize:11,color:C.gray,marginBottom:6 }}>
              <span style={{ fontWeight:600,color:C.ink }}>{fmt(paid)} paid</span>
              <span>{paidPct}% of {fmt(total)}</span>
            </div>
            <div style={{ height:8,background:'#F3F4F6',borderRadius:999,overflow:'hidden',marginBottom:18 }}>
              <div style={{ height:'100%',width:`${paidPct}%`,background:paidPct===100?'#22C55E':C.rosa,borderRadius:999,transition:'width 0.6s' }}/>
            </div>

            {/* Milestone list */}
            {milestones.length === 0 ? (
              <div style={{ fontSize:12,color:'#9CA3AF',textAlign:'center',padding:'8px 0' }}>No payment schedule set yet.</div>
            ) : milestones.map((m, i) => {
              const status    = m.status || (m.paid_date ? 'paid' : 'pending')
              const isPaid    = status === 'paid'
              const isOverdue = status === 'overdue'
              const hasLink   = !isPaid && m.stripe_payment_link_url
              const dotColor  = isPaid ? '#22C55E' : isOverdue ? '#DC2626' : '#D1D5DB'

              return (
                <div key={m.id || i} style={{ padding:'12px 0',borderTop:i>0?`1px solid #F3F4F6`:'none' }}>
                  <div style={{ display:'flex',alignItems:'flex-start',gap:12 }}>
                    <div style={{ width:10,height:10,borderRadius:'50%',background:dotColor,marginTop:4,flexShrink:0 }}/>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13,fontWeight:500,color:C.ink }}>{m.label}</div>
                      {isPaid ? (
                        <div style={{ fontSize:11,color:C.green,marginTop:1,fontWeight:500 }}>
                          {m.paid_date ? `✅ Paid · ${fmtShortDate(m.paid_date)}` : '✅ Paid'}
                        </div>
                      ) : (
                        <div style={{ fontSize:11,color:isOverdue?'#DC2626':C.gray,marginTop:1 }}>
                          {isOverdue ? `⚠️ Due ${fmtShortDate(m.due_date)} — Overdue` : `⏳ Due ${fmtShortDate(m.due_date)}`}
                        </div>
                      )}
                    </div>
                    {!hasLink && (
                      <div style={{ fontSize:14,fontWeight:700,color:isPaid?'#22C55E':isOverdue?'#DC2626':C.ink,flexShrink:0 }}>{fmt(m.amount)}</div>
                    )}
                  </div>

                  {hasLink && (
                    <a
                      href={m.stripe_payment_link_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ display:'flex',alignItems:'center',justifyContent:'center',gap:8,marginTop:10,width:'100%',height:48,borderRadius:12,background:C.rosa,color:C.white,fontWeight:700,fontSize:15,textDecoration:'none',boxSizing:'border-box',boxShadow:`0 2px 8px ${C.rosa}55` }}
                    >
                      💳 Pay {fmt(m.amount)} online →
                    </a>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── 2. Upcoming Appointments ── */}
        <div style={card}>
          <div style={cardHead}>📅 Upcoming Appointments</div>
          <div style={{ padding:'10px 18px' }}>
            {upcoming.length === 0 ? (
              <div style={{ fontSize:13,color:C.gray,padding:'12px 0',textAlign:'center' }}>
                No upcoming appointments.
              </div>
            ) : upcoming.map((a, i) => {
              const apptIcon = a.type?.toLowerCase().includes('fitting')   ? '👗'
                             : a.type?.toLowerCase().includes('measure')   ? '📏'
                             : a.type?.toLowerCase().includes('pickup')    ? '📦'
                             : a.type?.toLowerCase().includes('return')    ? '🔄'
                             : '📋'
              const statusMeta = {
                confirmed:  { label:'Confirmed',  bg:'#F0FDF4', col:C.green     },
                pending:    { label:'Pending',    bg:'#FEF3C7', col:'#D97706'   },
                cancelled:  { label:'Cancelled', bg:'#FEE2E2', col:'#DC2626'   },
                completed:  { label:'Completed', bg:'#F3F4F6', col:C.gray      },
              }
              const sm = statusMeta[a.status] || statusMeta.pending

              return (
                <div key={a.id || i} style={{ display:'flex',alignItems:'center',gap:12,padding:'12px 0',borderTop:i>0?`1px solid #F3F4F6`:'none' }}>
                  <div style={{ width:40,height:40,borderRadius:10,background:C.rosaPale,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:18 }}>
                    {apptIcon}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13,fontWeight:500,color:C.ink }}>{a.type?.replace(/_/g,' ')}</div>
                    <div style={{ fontSize:11,color:C.gray,marginTop:2 }}>
                      {a.date ? new Date(a.date+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}) : 'Date TBD'}
                      {a.time && ` · ${a.time.slice(0,5)}`}
                    </div>
                  </div>
                  <span style={{ fontSize:10,fontWeight:600,padding:'3px 9px',borderRadius:20,background:sm.bg,color:sm.col,flexShrink:0 }}>
                    {sm.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── 3. Your Dress / Items ── */}
        <div style={card}>
          <div style={cardHead}>👗 Your Dress / Items</div>
          <div style={{ padding:'10px 18px' }}>
            {(!inventory || inventory.length === 0) ? (
              <div style={{ fontSize:13,color:C.gray,padding:'12px 0',textAlign:'center' }}>
                No items on file.
              </div>
            ) : inventory.map((item, i) => {
              const statusMeta = {
                rented:    { label:'Rented',    bg:'#EDE9FE', col:'#7C3AED' },
                picked_up: { label:'Picked Up', bg:'#DBEAFE', col:'#1D4ED8' },
                returned:  { label:'Returned',  bg:'#F0FDF4', col:C.green   },
                available: { label:'Available', bg:'#F3F4F6', col:C.gray    },
              }
              const sm = statusMeta[item.status] || { label:item.status, bg:'#F3F4F6', col:C.gray }

              return (
                <div key={i} style={{ padding:'12px 0',borderTop:i>0?`1px solid #F3F4F6`:'none' }}>
                  <div style={{ display:'flex',alignItems:'flex-start',gap:12 }}>
                    <div style={{ width:40,height:40,borderRadius:10,background:C.rosaPale,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:18 }}>
                      {item.category==='bridal_gown'||item.category==='quince_gown' ? '👗' : item.category==='veil' ? '🤍' : item.category==='jewelry' ? '💍' : '📦'}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13,fontWeight:600,color:C.ink,marginBottom:2 }}>{item.name}</div>
                      <div style={{ fontSize:11,color:C.gray }}>
                        {CAT_LABELS[item.category] || item.category?.replace(/_/g,' ')}
                      </div>
                      <div style={{ display:'flex',gap:12,marginTop:6,flexWrap:'wrap' }}>
                        {item.pickup_date && (
                          <div style={{ fontSize:11 }}>
                            <span style={{ color:C.gray }}>Pickup: </span>
                            <span style={{ color:C.ink,fontWeight:500 }}>{fmtShortDate(item.pickup_date)}</span>
                          </div>
                        )}
                        {item.return_date && (
                          <div style={{ fontSize:11 }}>
                            <span style={{ color:C.gray }}>Return: </span>
                            <span style={{ color:C.ink,fontWeight:500 }}>{fmtShortDate(item.return_date)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <span style={{ fontSize:10,fontWeight:600,padding:'3px 9px',borderRadius:20,background:sm.bg,color:sm.col,flexShrink:0,whiteSpace:'nowrap' }}>
                      {sm.label}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Contracts ── */}
        {(contracts || []).length > 0 && (
          <div style={card}>
            <div style={cardHead}>📝 Contracts</div>
            <div style={{ padding:'10px 18px' }}>
              {contracts.map((c, i) => {
                const CSTATUS = {
                  draft:  { label:'Draft',              col:'#9CA3AF', bg:'#F3F4F6' },
                  sent:   { label:'Awaiting signature', col:'#1D4ED8', bg:'#EFF6FF' },
                  signed: { label:'Signed ✓',           col:C.green,   bg:'#F0FDF4' },
                }
                const cs      = CSTATUS[c.status] || CSTATUS.draft
                const isSigned = c.status === 'signed' && c.signed_at

                return (
                  <div key={c.id} style={{ padding:'12px 0',borderTop:i>0?`1px solid #F3F4F6`:'none' }}>
                    <div style={{ display:'flex',alignItems:'center',gap:12 }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13,fontWeight:500,color:C.ink,marginBottom:4 }}>{c.title}</div>
                        <span style={{ fontSize:10,padding:'2px 8px',borderRadius:20,background:cs.bg,color:cs.col,fontWeight:600 }}>{cs.label}</span>
                        {isSigned && c.signed_by_name && (
                          <div style={{ fontSize:11,color:C.gray,marginTop:4 }}>
                            Signed by {c.signed_by_name} · {new Date(c.signed_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
                          </div>
                        )}
                      </div>
                      {c.sign_token && c.status !== 'signed' && (
                        <a href={`/sign/${c.sign_token}`}
                          style={{ padding:'8px 14px',borderRadius:9,background:C.rosa,color:C.white,fontSize:12,fontWeight:600,textDecoration:'none',whiteSpace:'nowrap',flexShrink:0 }}>
                          ✍ Sign →
                        </a>
                      )}
                    </div>

                    {isSigned ? (
                      <a
                        href={`${SUPABASE_URL}/functions/v1/pdf?type=contract&event_id=${event.id}&token=${token}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display:'flex',alignItems:'center',justifyContent:'center',gap:8,marginTop:10,width:'100%',height:44,borderRadius:10,background:C.white,color:C.ink,fontWeight:600,fontSize:13,textDecoration:'none',border:`1.5px solid ${C.border}`,boxSizing:'border-box' }}
                      >
                        📄 Download signed contract
                      </a>
                    ) : (
                      <div style={{ marginTop:10,padding:'10px 14px',borderRadius:10,background:'#F9FAFB',border:`1px solid ${C.border}` }}>
                        <div style={{ fontSize:12,color:C.gray,fontWeight:500 }}>✍️ Contract not yet signed</div>
                        <div style={{ fontSize:11,color:'#9CA3AF',marginTop:3,lineHeight:1.4 }}>Your boutique will send you a contract to sign soon.</div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Inspiration upload ── */}
        {event.boutique_id && event.id && (
          <InspirationUpload event={event} portalToken={token} />
        )}

        {/* ── Vision board ── */}
        {(event.inspiration_colors?.length > 0 || event.inspiration_styles?.length > 0 || event.inspiration_notes) && (
          <div style={card}>
            <div style={cardHead}>🎨 Your vision board</div>
            <div style={{ padding:'14px 18px',display:'flex',flexDirection:'column',gap:12 }}>
              {event.inspiration_colors?.length > 0 && (
                <div>
                  <div style={{ fontSize:11,fontWeight:600,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8 }}>Colors</div>
                  <div style={{ display:'flex',gap:8,flexWrap:'wrap' }}>
                    {event.inspiration_colors.map((col, i) => (
                      <div key={i} style={{ display:'flex',alignItems:'center',gap:6,padding:'4px 10px',borderRadius:20,border:`1px solid ${C.border}`,background:C.white }}>
                        <div style={{ width:14,height:14,borderRadius:'50%',background:col.hex||col,border:'1px solid rgba(0,0,0,0.08)',flexShrink:0 }}/>
                        <span style={{ fontSize:12,color:'#374151' }}>{col.name||col}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {event.inspiration_styles?.length > 0 && (
                <div>
                  <div style={{ fontSize:11,fontWeight:600,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8 }}>Style</div>
                  <div style={{ display:'flex',gap:6,flexWrap:'wrap' }}>
                    {event.inspiration_styles.map((s, i) => (
                      <span key={i} style={{ fontSize:12,padding:'4px 12px',borderRadius:20,background:'#F3F4F6',color:'#374151',fontWeight:500 }}>{s}</span>
                    ))}
                  </div>
                </div>
              )}
              {event.inspiration_notes && (
                <div>
                  <div style={{ fontSize:11,fontWeight:600,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:6 }}>Notes from your boutique</div>
                  <p style={{ fontSize:13,color:'#374151',lineHeight:1.6,margin:0,fontStyle:'italic' }}>"{event.inspiration_notes}"</p>
                </div>
              )}
              {event.inspiration_florals && (
                <div style={{ fontSize:12,color:C.gray }}>
                  🌸 Florals: <strong style={{ color:C.ink }}>{event.inspiration_florals}</strong>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── 4. Contact Us ── */}
        <div style={card}>
          <div style={cardHead}>📞 Contact Us</div>
          <div style={{ padding:'16px 18px',display:'flex',flexDirection:'column',gap:12 }}>
            {boutique?.phone && (
              <a href={`tel:${boutique.phone}`} style={{ display:'flex',alignItems:'center',gap:12,textDecoration:'none',padding:'12px 14px',borderRadius:12,background:C.rosaPale,border:`1px solid ${C.rosa}22` }}>
                <span style={{ fontSize:20 }}>📞</span>
                <div>
                  <div style={{ fontSize:11,fontWeight:600,color:C.rosa,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:1 }}>Call us</div>
                  <div style={{ fontSize:14,fontWeight:600,color:C.ink }}>{boutique.phone}</div>
                </div>
              </a>
            )}
            {boutique?.email && (
              <a href={`mailto:${boutique.email}`} style={{ display:'flex',alignItems:'center',gap:12,textDecoration:'none',padding:'12px 14px',borderRadius:12,background:C.grayBg,border:`1px solid ${C.border}` }}>
                <span style={{ fontSize:20 }}>✉️</span>
                <div>
                  <div style={{ fontSize:11,fontWeight:600,color:C.gray,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:1 }}>Email us</div>
                  <div style={{ fontSize:14,fontWeight:600,color:C.ink }}>{boutique.email}</div>
                </div>
              </a>
            )}
            {boutique?.instagram && (
              <a
                href={`https://instagram.com/${boutique.instagram.replace(/^@/,'')}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display:'flex',alignItems:'center',gap:12,textDecoration:'none',padding:'12px 14px',borderRadius:12,background:'#FDF2F8',border:'1px solid #F0ABDC33' }}
              >
                <span style={{ fontSize:20 }}>📸</span>
                <div>
                  <div style={{ fontSize:11,fontWeight:600,color:'#9D174D',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:1 }}>Follow us</div>
                  <div style={{ fontSize:14,fontWeight:600,color:C.ink }}>@{boutique.instagram.replace(/^@/,'')}</div>
                </div>
              </a>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div style={{ textAlign:'center',marginTop:32,fontSize:12,color:'#9CA3AF',lineHeight:1.9 }}>
          {boutique?.name && <div style={{ fontWeight:600,color:C.gray }}>{boutique.name}</div>}
          {boutique?.address && <div style={{ fontSize:11 }}>{boutique.address}</div>}
          <div style={{ marginTop:12,fontSize:10,color:'#D1D5DB',letterSpacing:'0.04em' }}>
            Powered by Belori · This portal is private — do not share the link
          </div>
          <div style={{ marginTop:6,fontSize:10,color:'#D1D5DB' }}>
            <a href="/data-deletion" style={{ color:'#D1D5DB',textDecoration:'underline' }}>Request data deletion</a>
          </div>
        </div>

      </div>
    </div>
  )
}
