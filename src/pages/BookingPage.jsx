import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const FN_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`

// ─── Color helpers ────────────────────────────────────────────────────────────
const mix = (hex, amount) => {
  const n = parseInt(hex.replace('#',''), 16)
  const r = Math.min(255, Math.round(((n>>16)&255) + amount))
  const g = Math.min(255, Math.round(((n>>8)&255)  + amount))
  const b = Math.min(255, Math.round((n&255)        + amount))
  return `rgb(${r},${g},${b})`
}

// ─── Constants ────────────────────────────────────────────────────────────────
const ROSA = '#C9697A'
const TOTAL_STEPS = 5

const SERVICES = [
  { id: 'dress_rental',   label: 'Dress Rental',   icon: '👗' },
  { id: 'alterations',    label: 'Alterations',    icon: '✂️' },
  { id: 'decoration',     label: 'Decorations',    icon: '🌸' },
  { id: 'event_planning', label: 'Event Planning', icon: '📋' },
  { id: 'photography',    label: 'Photography',    icon: '📷' },
  { id: 'hair_makeup',    label: 'Hair & Makeup',  icon: '💄' },
]

const EVENT_TYPES = [
  { id: 'wedding',     label: 'Wedding',      icon: '💍', desc: 'Ceremony & reception' },
  { id: 'quinceanera', label: 'Quinceañera',  icon: '🎀', desc: 'Quinceañera celebration' },
  { id: 'party',       label: 'Party',        icon: '🎊', desc: 'Birthdays & celebrations' },
  { id: 'other',       label: 'Other Event',  icon: '🎉', desc: 'Tell us more below' },
]

// ─── <meta> tag helper (for social sharing previews) ─────────────────────────
// Inserts or updates a single <meta> tag in <head>. Most public pages need
// to look good when shared on iMessage / Facebook / WhatsApp; without
// og:title + og:description, the link preview just shows the bare URL.
function setOrUpdateMeta(key, value, attr = 'name') {
  if (typeof document === 'undefined') return
  let tag = document.querySelector(`meta[${attr}="${key}"]`)
  if (!tag) {
    tag = document.createElement('meta')
    tag.setAttribute(attr, key)
    document.head.appendChild(tag)
  }
  tag.setAttribute('content', value)
}

// ─── ICS calendar helper ──────────────────────────────────────────────────────
function downloadICS(boutiqueName) {
  const now = new Date()
  const reminder = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const fmt = d => d.toISOString().replace(/[-:]/g,'').split('.')[0] + 'Z'
  const uid = `booking-followup-${Date.now()}@belori`
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Belori//Booking//EN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTART:${fmt(reminder)}`,
    `DTEND:${fmt(new Date(reminder.getTime() + 30 * 60 * 1000))}`,
    `SUMMARY:Follow up: Check on ${boutiqueName} booking`,
    `DESCRIPTION:You submitted a booking request to ${boutiqueName}. Follow up if you haven't heard back!`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
  const blob = new Blob([ics], { type: 'text/calendar' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `booking-reminder-${boutiqueName.replace(/\s+/g,'-').toLowerCase()}.ics`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Confetti ─────────────────────────────────────────────────────────────────
const Confetti = ({ color }) => {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    canvas.width  = canvas.offsetWidth
    canvas.height = canvas.offsetHeight
    const pieces = Array.from({length: 80}, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * -canvas.height,
      r: 5 + Math.random() * 7,
      d: 2 + Math.random() * 5,
      color: [color, '#fff', '#f9a8d4', '#fde68a', '#a7f3d0'][Math.floor(Math.random()*5)],
      tilt: Math.random() * 10 - 5,
    }))
    let frame
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      pieces.forEach(p => {
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI*2)
        ctx.fillStyle = p.color
        ctx.fill()
        p.y += p.d; p.x += Math.sin(p.tilt) * 2; p.tilt += 0.05
        if (p.y > canvas.height) { p.y = -10; p.x = Math.random() * canvas.width }
      })
      frame = requestAnimationFrame(draw)
    }
    draw()
    const t = setTimeout(() => cancelAnimationFrame(frame), 4500)
    return () => { cancelAnimationFrame(frame); clearTimeout(t) }
  }, [color])
  return <canvas ref={canvasRef} style={{position:'fixed',inset:0,pointerEvents:'none',zIndex:999,width:'100%',height:'100%'}}/>
}

// ─── CSS checkmark animation (injected once) ──────────────────────────────────
const CHECKMARK_CSS = `
@keyframes bk-dash {
  to { stroke-dashoffset: 0; }
}
@keyframes bk-circle-in {
  from { transform: scale(0.6); opacity: 0; }
  to   { transform: scale(1);   opacity: 1; }
}
@keyframes bk-check-pop {
  0%   { transform: scale(0.5); opacity: 0; }
  70%  { transform: scale(1.1); }
  100% { transform: scale(1);   opacity: 1; }
}
.bk-circle {
  animation: bk-circle-in 0.4s cubic-bezier(.22,.61,.36,1) forwards;
}
.bk-check {
  stroke-dasharray: 60;
  stroke-dashoffset: 60;
  animation: bk-dash 0.5s 0.35s ease forwards, bk-check-pop 0.5s 0.35s ease forwards;
}
`

let cssInjected = false
function injectCSS() {
  if (cssInjected) return
  const style = document.createElement('style')
  style.textContent = CHECKMARK_CSS
  document.head.appendChild(style)
  cssInjected = true
}

// ─── Animated checkmark SVG ───────────────────────────────────────────────────
const Checkmark = ({ color }) => {
  useEffect(() => { injectCSS() }, [])
  return (
    <svg width="96" height="96" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle className="bk-circle" cx="48" cy="48" r="44" fill={mix(color, 170)}/>
      <polyline className="bk-check" points="28,50 42,64 68,36"
        stroke={color} strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
  )
}

// ─── Input style factory ──────────────────────────────────────────────────────
const inputSt = (accent) => ({
  width: '100%',
  padding: '13px 14px',
  borderRadius: 12,
  border: '1.5px solid #e5e7eb',
  fontSize: 15,
  color: '#111',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  background: '#fff',
  minHeight: 48,
})

// ─── Main component ────────────────────────────────────────────────────────────
export default function BookingPage() {
  const slug = window.location.pathname.split('/book/')[1]?.split('/')[0] || ''

  const [boutique, setBoutique]         = useState(null)
  const [loading, setLoading]           = useState(true)
  const [notFound, setNotFound]         = useState(false)
  const [step, setStep]                 = useState(1)   // 1–5 = wizard, 6 = success
  const [submitting, setSubmitting]     = useState(false)
  const [error, setError]               = useState('')
  const [showConfetti, setShowConfetti] = useState(false)
  const [dateHint, setDateHint]         = useState(false)

  // Waitlist state (success screen)
  const [showWaitlist,    setShowWaitlist]    = useState(false)
  const [wlName,          setWlName]          = useState('')
  const [wlPhone,         setWlPhone]         = useState('')
  const [wlEmail,         setWlEmail]         = useState('')
  const [wlDate,          setWlDate]          = useState('')
  const [wlFlexible,      setWlFlexible]      = useState(false)
  const [wlSubmitting,    setWlSubmitting]    = useState(false)
  const [wlDone,          setWlDone]          = useState(false)
  const [wlError,         setWlError]         = useState('')

  // Form state
  const [eventType,    setEventType]    = useState('')
  const [eventDate,    setEventDate]    = useState('')
  const [venue,        setVenue]        = useState('')
  const [guestCount,   setGuestCount]   = useState('')
  const [services,     setServices]     = useState([])
  const [name,         setName]         = useState('')
  const [partnerName,  setPartnerName]  = useState('')
  const [email,        setEmail]        = useState('')
  const [phone,        setPhone]        = useState('')
  const [message,      setMessage]      = useState('')

  // Fetch boutique info
  useEffect(() => {
    if (!slug) { setNotFound(true); setLoading(false); return }
    fetch(`${FN_BASE}/booking-page-data?slug=${encodeURIComponent(slug)}`)
      .then(async r => {
        // 404 / 5xx / non-2xx all → not-found UX. Previously we only
        // checked for `d.error` in the body, which missed the case where
        // Supabase returns its own envelope ({code:'NOT_FOUND', message:…})
        // and we'd silently fall through to the wizard with garbage data.
        if (!r.ok) { setNotFound(true); return }
        const d = await r.json()
        if (d.error || !d.id) setNotFound(true)
        else setBoutique(d)
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [slug])

  // Update browser tab title + social-share meta tags as soon as the
  // boutique's name is known. og:title / og:description make iMessage,
  // WhatsApp, and Facebook share previews look professional instead of
  // showing the raw URL.
  useEffect(() => {
    if (!boutique?.name) return
    const title = `Book a consultation · ${boutique.name}`
    const desc  = `Tell us about your event and we'll be in touch within 24 hours. Powered by Belori.`
    document.title = title
    setOrUpdateMeta('og:title',       title, 'property')
    setOrUpdateMeta('og:description', desc,  'property')
    setOrUpdateMeta('og:type',        'website', 'property')
    setOrUpdateMeta('twitter:card',   'summary')
    setOrUpdateMeta('description',    desc)
    return () => { document.title = 'Belori' }
  }, [boutique?.name])

  const primaryColor = boutique?.primary_color || ROSA
  const accent  = primaryColor
  const accentL = mix(primaryColor, 178)
  const accentM = mix(primaryColor, 140)

  const toggleService = (id) =>
    setServices(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id])

  const handleDateChange = (val) => {
    setEventDate(val)
    setDateHint(!!val)
  }

  const submit = async () => {
    if (!name.trim()) { setError('Please enter your name.'); return }
    if (!email.trim() && !phone.trim()) { setError('Please enter at least an email or phone number.'); return }
    setSubmitting(true); setError('')
    try {
      const res = await fetch(`${FN_BASE}/booking-page-data?slug=${encodeURIComponent(slug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_name:    name,
          partner_name:   partnerName || null,
          client_email:   email,
          client_phone:   phone,
          event_type:     eventType || 'other',
          event_date:     eventDate || null,
          venue:          venue || null,
          guest_count:    guestCount ? Number(guestCount) : null,
          services,
          message,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setStep(6)
      setShowConfetti(true)
      setTimeout(() => setShowConfetti(false), 4500)
    } catch (e) {
      setError(e.message || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const submitWaitlist = async () => {
    if (!wlName.trim()) { setWlError('Please enter your name.'); return }
    if (!wlPhone.trim() && !wlEmail.trim()) { setWlError('Please enter a phone number or email.'); return }
    setWlSubmitting(true); setWlError('')
    try {
      const { error } = await supabase.from('waitlist').insert({
        boutique_id:    boutique.id,
        name:           wlName.trim(),
        phone:          wlPhone.trim() || null,
        email:          wlEmail.trim() || null,
        preferred_date: wlDate || null,
        flexible_dates: wlFlexible,
        event_type:     eventType || null,
        source:         'booking_form',
      })
      if (error) throw error
      setWlDone(true)
    } catch (e) {
      setWlError(e.message || 'Something went wrong. Please try again.')
    } finally {
      setWlSubmitting(false)
    }
  }

  // ── Loading ──
  if (loading) return (
    <div style={{height:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#fdf8f8',fontFamily:'Inter,system-ui,sans-serif'}}>
      <div style={{textAlign:'center',color:'#9ca3af'}}>
        <div style={{fontSize:36,marginBottom:10}}>🌸</div>
        <div style={{fontSize:14,letterSpacing:'0.02em'}}>Loading…</div>
      </div>
    </div>
  )

  // ── Not found ──
  if (notFound) return (
    <div style={{height:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#fdf8f8',fontFamily:'Inter,system-ui,sans-serif'}}>
      <div style={{textAlign:'center',maxWidth:340,padding:24}}>
        <div style={{fontSize:48,marginBottom:16}}>🔍</div>
        <div style={{fontSize:20,fontWeight:700,color:'#111',marginBottom:8}}>Boutique not found</div>
        <div style={{fontSize:14,color:'#6b7280',lineHeight:1.6}}>This booking link doesn't match any boutique. Please check the URL or contact the boutique directly.</div>
      </div>
    </div>
  )

  const CARD = {
    background: '#fff',
    borderRadius: 20,
    boxShadow: '0 4px 40px rgba(0,0,0,0.08)',
    overflow: 'hidden',
    fontFamily: 'Inter,system-ui,sans-serif',
  }

  // ── Step 6: Success ──
  if (step === 6) return (
    <>
      {showConfetti && <Confetti color={accent}/>}
      <div style={{minHeight:'100vh',background:`linear-gradient(150deg,${accentL} 0%,#fff 55%)`,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'24px 16px',fontFamily:'Inter,system-ui,sans-serif'}}>
        <div style={{...CARD,maxWidth:480,width:'100%',padding:'40px 32px',textAlign:'center'}}>

          {/* Animated checkmark */}
          <div style={{display:'flex',justifyContent:'center',marginBottom:20}}>
            <Checkmark color={accent}/>
          </div>

          <div style={{fontSize:26,fontWeight:800,color:'#111',marginBottom:10,lineHeight:1.2}}>
            We received your request!
          </div>
          <div style={{fontSize:15,color:'#6b7280',lineHeight:1.7,marginBottom:6}}>
            <strong style={{color:'#111'}}>{boutique.name}</strong> will contact you at{' '}
            <strong style={{color:'#111'}}>{email || phone}</strong> within 24 hours.
          </div>

          {/* Availability reassurance */}
          <div style={{background:accentL,borderRadius:14,padding:'14px 18px',margin:'20px 0',textAlign:'left'}}>
            <div style={{fontSize:12,fontWeight:700,color:accent,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8}}>What happens next</div>
            {[
              "We'll review your request within 24 hours",
              "A team member will contact you to confirm details",
              "Get ready to celebrate! 🌸",
            ].map((t, i) => (
              <div key={i} style={{display:'flex',gap:10,alignItems:'flex-start',marginBottom:i<2?8:0}}>
                <span style={{color:accent,fontWeight:700,flexShrink:0,marginTop:1}}>{i+1}.</span>
                <span style={{fontSize:13,color:'#374151',lineHeight:1.5}}>{t}</span>
              </div>
            ))}
          </div>

          {/* Instagram link */}
          {boutique.instagram && (
            <a
              href={`https://instagram.com/${boutique.instagram.replace('@','')}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{display:'inline-flex',alignItems:'center',gap:8,padding:'12px 20px',borderRadius:12,background:'linear-gradient(135deg,#f9a8d4 0%,#c084fc 100%)',color:'#fff',fontWeight:700,fontSize:14,textDecoration:'none',marginBottom:16,boxShadow:'0 2px 12px rgba(192,132,252,0.25)'}}
            >
              <span style={{fontSize:18}}>📸</span>
              Follow us @{boutique.instagram.replace('@','')}
            </a>
          )}

          {/* ICS calendar reminder */}
          <div style={{marginBottom:20}}>
            <button
              onClick={() => downloadICS(boutique.name)}
              style={{display:'inline-flex',alignItems:'center',gap:8,padding:'12px 20px',borderRadius:12,border:`1.5px solid ${accentM}`,background:'#fff',color:accent,fontWeight:600,fontSize:14,cursor:'pointer',transition:'background 0.15s'}}
              onMouseOver={e=>e.currentTarget.style.background=accentL}
              onMouseOut={e=>e.currentTarget.style.background='#fff'}
            >
              <span style={{fontSize:18}}>📅</span>
              Add 24-hour follow-up reminder to calendar
            </button>
          </div>

          {/* Contact line */}
          {boutique.phone && (
            <div style={{fontSize:13,color:'#9ca3af',marginBottom:20}}>
              Questions? Call{' '}
              <a href={`tel:${boutique.phone}`} style={{color:accent,fontWeight:600,textDecoration:'none'}}>{boutique.phone}</a>
            </div>
          )}

          {/* ── Waitlist join section ── */}
          <div style={{borderTop:'1px solid #f3f4f6',paddingTop:20,marginTop:4}}>
            {!wlDone ? (
              <>
                <div style={{fontSize:13,color:'#6b7280',marginBottom:10}}>
                  Also interested in another date?
                </div>
                {!showWaitlist ? (
                  <button
                    onClick={() => { setShowWaitlist(true); setWlName(name); setWlPhone(phone); setWlEmail(email); }}
                    style={{background:'none',border:'none',padding:0,cursor:'pointer',color:accent,fontWeight:600,fontSize:14,textDecoration:'underline',textUnderlineOffset:3}}>
                    Join our waitlist →
                  </button>
                ) : (
                  <div style={{textAlign:'left'}}>
                    <div style={{fontSize:13,fontWeight:600,color:'#374151',marginBottom:12}}>Join our waitlist</div>
                    {wlError && <div style={{background:'#fef2f2',color:'#dc2626',borderRadius:8,padding:'8px 12px',fontSize:13,marginBottom:10}}>{wlError}</div>}
                    <div style={{display:'flex',flexDirection:'column',gap:10}}>
                      <input
                        value={wlName} onChange={e=>setWlName(e.target.value)}
                        placeholder="Your name *"
                        style={inputSt(accent)}
                      />
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                        <input
                          value={wlPhone} onChange={e=>setWlPhone(e.target.value)}
                          placeholder="Phone"
                          style={inputSt(accent)}
                        />
                        <input
                          value={wlEmail} onChange={e=>setWlEmail(e.target.value)}
                          placeholder="Email"
                          style={inputSt(accent)}
                        />
                      </div>
                      <input
                        type='date' value={wlDate} onChange={e=>setWlDate(e.target.value)}
                        style={inputSt(accent)}
                      />
                      <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:13,color:'#374151'}}>
                        <input type='checkbox' checked={wlFlexible} onChange={e=>setWlFlexible(e.target.checked)}
                          style={{accentColor:accent,width:16,height:16}}/>
                        I'm flexible on dates
                      </label>
                      <button
                        onClick={submitWaitlist}
                        disabled={wlSubmitting}
                        style={{height:46,borderRadius:12,border:'none',background:wlSubmitting?'#e5e7eb':accent,color:wlSubmitting?'#9ca3af':'#fff',fontSize:14,fontWeight:700,cursor:wlSubmitting?'default':'pointer',transition:'opacity 0.15s'}}>
                        {wlSubmitting ? 'Joining…' : 'Join waitlist'}
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div style={{textAlign:'center',color:accent,fontWeight:600,fontSize:14}}>
                ✓ You're on the waitlist! We'll reach out when a spot opens up.
              </div>
            )}
          </div>
        </div>

        <div style={{marginTop:24,fontSize:12,color:'#d1d5db',textAlign:'center'}}>
          Powered by <span style={{fontWeight:600,color:'#9ca3af'}}>Belori</span>
        </div>
      </div>
    </>
  )

  // ─── Progress bar + label ───────────────────────────────────────────────────
  const STEP_LABELS = ['Event Type', 'Date & Venue', 'Services', 'Contact', 'Review']
  const pct = ((step - 1) / (TOTAL_STEPS - 1)) * 100

  const ProgressBar = () => (
    <div style={{padding:'0 0 4px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
        <span style={{fontSize:12,fontWeight:600,color:accent}}>Step {step} of {TOTAL_STEPS}</span>
        <span style={{fontSize:12,color:'#9ca3af'}}>{STEP_LABELS[step-1]}</span>
      </div>
      <div style={{height:4,background:'#f3f4f6',borderRadius:4,overflow:'hidden'}}>
        <div style={{height:'100%',width:`${pct}%`,background:`linear-gradient(90deg,${accentM},${accent})`,borderRadius:4,transition:'width 0.35s cubic-bezier(.4,0,.2,1)'}}/>
      </div>
    </div>
  )

  // ─── Field label component ──────────────────────────────────────────────────
  const Label = ({children, optional}) => (
    <div style={{fontSize:12,fontWeight:600,color:'#374151',marginBottom:7}}>
      {children}{optional && <span style={{fontWeight:400,color:'#9ca3af'}}> (optional)</span>}
    </div>
  )

  // ─── Shared nav buttons ─────────────────────────────────────────────────────
  const NavRow = ({onBack, onNext, nextLabel='Continue', nextDisabled=false}) => (
    <div style={{display:'flex',gap:10,marginTop:8}}>
      {onBack && (
        <button onClick={onBack}
          style={{flex:'0 0 auto',padding:'0 20px',height:50,borderRadius:13,border:'1.5px solid #e5e7eb',background:'#fff',color:'#6b7280',fontSize:14,fontWeight:600,cursor:'pointer',minWidth:80}}>
          ← Back
        </button>
      )}
      <button onClick={onNext} disabled={nextDisabled}
        style={{flex:1,height:50,borderRadius:13,border:'none',background:nextDisabled?'#e5e7eb':accent,color:nextDisabled?'#9ca3af':'#fff',fontSize:15,fontWeight:700,cursor:nextDisabled?'default':'pointer',transition:'opacity 0.15s',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
        {nextLabel}
      </button>
    </div>
  )

  return (
    <div style={{minHeight:'100vh',background:`linear-gradient(150deg,${accentL} 0%,#fff 55%)`,fontFamily:'Inter,system-ui,sans-serif'}}>

      {/* ── Header ── */}
      <div style={{padding:'28px 16px 0',textAlign:'center',maxWidth:480,margin:'0 auto'}}>
        {boutique.logo_url
          ? <img src={boutique.logo_url} alt={boutique.name} style={{height:56,objectFit:'contain',marginBottom:10,borderRadius:8}}/>
          : <div style={{width:60,height:60,borderRadius:'50%',background:`linear-gradient(135deg,${accent},${accentM})`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:28,margin:'0 auto 12px',boxShadow:`0 4px 16px ${accent}44`}}>🌸</div>
        }
        <div style={{fontSize:24,fontWeight:800,color:'#111',letterSpacing:'-0.01em'}}>{boutique.name}</div>
        <div style={{fontSize:14,color:'#9ca3af',marginTop:4,marginBottom:4}}>Request a consultation</div>
      </div>

      {/* ── Wizard card ── */}
      <div style={{maxWidth:480,margin:'20px auto 48px',padding:'0 16px'}}>
        <div style={CARD}>
          <div style={{padding:'24px 24px 0'}}>
            <ProgressBar/>
          </div>

          {/* ── Step 1: Event type ── */}
          {step === 1 && (
            <div style={{padding:'20px 24px 28px'}}>
              <div style={{fontSize:19,fontWeight:800,color:'#111',marginBottom:4}}>What type of event?</div>
              <div style={{fontSize:13,color:'#9ca3af',marginBottom:20}}>Select the option that fits your celebration</div>

              <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:24}}>
                {EVENT_TYPES.map(t => {
                  const active = eventType === t.id
                  return (
                    <button key={t.id} onClick={() => setEventType(t.id)}
                      style={{display:'flex',alignItems:'center',gap:16,padding:'16px 18px',borderRadius:14,border:`2px solid ${active?accent:'#e5e7eb'}`,background:active?accentL:'#fff',cursor:'pointer',textAlign:'left',transition:'all 0.15s',minHeight:64,width:'100%'}}>
                      <span style={{fontSize:28,flexShrink:0}}>{t.icon}</span>
                      <div>
                        <div style={{fontSize:15,fontWeight:active?700:500,color:active?accent:'#111',marginBottom:2}}>{t.label}</div>
                        <div style={{fontSize:12,color:'#9ca3af'}}>{t.desc}</div>
                      </div>
                      {active && (
                        <div style={{marginLeft:'auto',width:20,height:20,borderRadius:'50%',background:accent,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                          <svg width="11" height="8" viewBox="0 0 11 8" fill="none"><polyline points="1,4 4,7 10,1" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>

              <NavRow onNext={() => setStep(2)} nextLabel="Continue →"/>
            </div>
          )}

          {/* ── Step 2: Date, venue, guests ── */}
          {step === 2 && (
            <div style={{padding:'20px 24px 28px'}}>
              <div style={{fontSize:19,fontWeight:800,color:'#111',marginBottom:4}}>Event details</div>
              <div style={{fontSize:13,color:'#9ca3af',marginBottom:20}}>Help us prepare for your consultation</div>

              <div style={{marginBottom:16}}>
                <Label optional>Approximate event date</Label>
                <input type="date" value={eventDate} onChange={e => handleDateChange(e.target.value)}
                  style={{...inputSt(accent)}}
                  onFocus={e=>e.target.style.borderColor=accent} onBlur={e=>e.target.style.borderColor='#e5e7eb'}/>
                {dateHint && (
                  <div style={{marginTop:10,background:accentL,borderRadius:10,padding:'10px 14px',fontSize:13,color:'#374151',lineHeight:1.5,display:'flex',gap:10,alignItems:'flex-start'}}>
                    <span style={{fontSize:16,flexShrink:0}}>💕</span>
                    <span>We'd love to be part of your special day! We'll confirm availability within 24 hours.</span>
                  </div>
                )}
              </div>

              <div style={{marginBottom:16}}>
                <Label optional>Venue or location</Label>
                <input type="text" value={venue} onChange={e => setVenue(e.target.value)} placeholder="e.g. Grand Ballroom, The Garden Estate…"
                  style={{...inputSt(accent)}}
                  onFocus={e=>e.target.style.borderColor=accent} onBlur={e=>e.target.style.borderColor='#e5e7eb'}/>
              </div>

              <div style={{marginBottom:24}}>
                <Label optional>Estimated guest count</Label>
                <input type="number" min="1" max="2000" value={guestCount} onChange={e => setGuestCount(e.target.value)} placeholder="e.g. 150"
                  style={{...inputSt(accent)}}
                  onFocus={e=>e.target.style.borderColor=accent} onBlur={e=>e.target.style.borderColor='#e5e7eb'}/>
              </div>

              <NavRow onBack={() => setStep(1)} onNext={() => setStep(3)} nextLabel="Continue →"/>
            </div>
          )}

          {/* ── Step 3: Services ── */}
          {step === 3 && (
            <div style={{padding:'20px 24px 28px'}}>
              <div style={{fontSize:19,fontWeight:800,color:'#111',marginBottom:4}}>Services of interest</div>
              <div style={{fontSize:13,color:'#9ca3af',marginBottom:20}}>Select all that apply — no commitment required</div>

              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:24}}>
                {/* Filter the static SERVICES catalog by what the boutique
                    actually offers (returned by the Edge Function based on
                    their enabled modules). Falls back to the full list for
                    boutiques whose Edge Function predates this field. */}
                {SERVICES
                  .filter(s => !boutique?.offered_services || boutique.offered_services.includes(s.id))
                  .map(s => {
                    const active = services.includes(s.id)
                    return (
                      <button key={s.id} onClick={() => toggleService(s.id)}
                        style={{display:'flex',alignItems:'center',gap:10,padding:'14px 14px',borderRadius:13,border:`2px solid ${active?accent:'#e5e7eb'}`,background:active?accentL:'#fff',cursor:'pointer',textAlign:'left',transition:'all 0.15s',minHeight:52,width:'100%'}}>
                        <span style={{fontSize:20,flexShrink:0}}>{s.icon}</span>
                        <span style={{fontSize:13,fontWeight:active?700:400,color:active?accent:'#374151',lineHeight:1.2}}>{s.label}</span>
                      </button>
                    )
                  })}
              </div>

              <NavRow onBack={() => setStep(2)} onNext={() => setStep(4)} nextLabel="Continue →"/>
            </div>
          )}

          {/* ── Step 4: Contact info ── */}
          {step === 4 && (
            <div style={{padding:'20px 24px 28px'}}>
              <div style={{fontSize:19,fontWeight:800,color:'#111',marginBottom:4}}>Your contact info</div>
              <div style={{fontSize:13,color:'#9ca3af',marginBottom:20}}>How should {boutique.name} reach you?</div>

              <div style={{marginBottom:14}}>
                <Label>Your full name *</Label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your name"
                  style={{...inputSt(accent)}}
                  onFocus={e=>e.target.style.borderColor=accent} onBlur={e=>e.target.style.borderColor='#e5e7eb'}/>
              </div>

              <div style={{marginBottom:14}}>
                <Label optional>Partner's name</Label>
                <input type="text" value={partnerName} onChange={e => setPartnerName(e.target.value)} placeholder="Partner, spouse, or honoree"
                  style={{...inputSt(accent)}}
                  onFocus={e=>e.target.style.borderColor=accent} onBlur={e=>e.target.style.borderColor='#e5e7eb'}/>
              </div>

              <div style={{marginBottom:14}}>
                <Label optional>Email address</Label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com"
                  style={{...inputSt(accent)}}
                  onFocus={e=>e.target.style.borderColor=accent} onBlur={e=>e.target.style.borderColor='#e5e7eb'}/>
              </div>

              <div style={{marginBottom:24}}>
                <Label optional>Phone number</Label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 (555) 000-0000"
                  style={{...inputSt(accent)}}
                  onFocus={e=>e.target.style.borderColor=accent} onBlur={e=>e.target.style.borderColor='#e5e7eb'}/>
              </div>

              <NavRow onBack={() => setStep(3)} onNext={() => { if (!name.trim()) { setError('Please enter your name.'); return } if (!email.trim() && !phone.trim()) { setError('Please enter at least an email or phone number.'); return } setError(''); setStep(5) }} nextLabel="Continue →"/>

              {error && <div style={{marginTop:12,background:'#fef2f2',border:'1px solid #fecaca',borderRadius:10,padding:'10px 14px',fontSize:13,color:'#dc2626'}}>{error}</div>}
            </div>
          )}

          {/* ── Step 5: Message + submit ── */}
          {step === 5 && (
            <div style={{padding:'20px 24px 28px'}}>
              <div style={{fontSize:19,fontWeight:800,color:'#111',marginBottom:4}}>Anything else?</div>
              <div style={{fontSize:13,color:'#9ca3af',marginBottom:20}}>Add a note, question, or special request</div>

              {/* Summary card */}
              <div style={{background:'#f9fafb',borderRadius:14,padding:'14px 16px',marginBottom:20,fontSize:13,color:'#374151',lineHeight:1.7}}>
                {eventType && <div><span style={{fontWeight:600,color:'#111'}}>Event:</span> {EVENT_TYPES.find(t=>t.id===eventType)?.label || eventType}</div>}
                {eventDate && <div><span style={{fontWeight:600,color:'#111'}}>Date:</span> {new Date(eventDate + 'T12:00:00').toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})}</div>}
                {venue && <div><span style={{fontWeight:600,color:'#111'}}>Venue:</span> {venue}</div>}
                {guestCount && <div><span style={{fontWeight:600,color:'#111'}}>Guests:</span> {guestCount}</div>}
                {services.length > 0 && <div><span style={{fontWeight:600,color:'#111'}}>Services:</span> {services.map(id=>SERVICES.find(s=>s.id===id)?.label).join(', ')}</div>}
                <div><span style={{fontWeight:600,color:'#111'}}>Contact:</span> {name}{partnerName ? ` & ${partnerName}` : ''}{email ? ` · ${email}` : ''}{phone ? ` · ${phone}` : ''}</div>
              </div>

              <div style={{marginBottom:20}}>
                <Label optional>Message or notes</Label>
                <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4}
                  placeholder="Anything you'd like us to know before your consultation…"
                  style={{...inputSt(accent),minHeight:110,resize:'vertical'}}
                  onFocus={e=>e.target.style.borderColor=accent} onBlur={e=>e.target.style.borderColor='#e5e7eb'}/>
              </div>

              {error && <div style={{marginBottom:14,background:'#fef2f2',border:'1px solid #fecaca',borderRadius:10,padding:'10px 14px',fontSize:13,color:'#dc2626'}}>{error}</div>}

              <NavRow
                onBack={() => setStep(4)}
                onNext={submit}
                nextLabel={submitting ? 'Sending…' : '🌸 Send my request'}
                nextDisabled={submitting}
              />
            </div>
          )}

        </div>

        {/* ── Footer ── */}
        <div style={{textAlign:'center',marginTop:24,padding:'0 16px'}}>
          {(boutique.phone || boutique.email) && (
            <div style={{fontSize:13,color:'#9ca3af',marginBottom:10,lineHeight:1.7}}>
              {boutique.phone && (
                <span>📞 <a href={`tel:${boutique.phone}`} style={{color:'#9ca3af',textDecoration:'none'}}>{boutique.phone}</a></span>
              )}
              {boutique.phone && boutique.email && <span style={{margin:'0 8px'}}>·</span>}
              {boutique.email && (
                <span>✉️ <a href={`mailto:${boutique.email}`} style={{color:'#9ca3af',textDecoration:'none'}}>{boutique.email}</a></span>
              )}
            </div>
          )}
          <div style={{fontSize:12,color:'#d1d5db'}}>
            Powered by <span style={{fontWeight:600,color:'#9ca3af'}}>Belori</span>
            {boutique.instagram && (
              <span>
                {' · '}
                <a href={`https://instagram.com/${boutique.instagram.replace('@','')}`} target="_blank" rel="noopener noreferrer"
                  style={{color:'#9ca3af',textDecoration:'none'}}>
                  @{boutique.instagram.replace('@','')}
                </a>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
