import React, { useState, useEffect, useRef, useCallback } from 'react'
import { C } from '../lib/colors'
import { supabase } from '../lib/supabase'

// ─── HELPERS ────────────────────────────────────────────────────────────────
function getTodayStr() {
  return new Date().toISOString().split('T')[0]
}

function fmtTime(timeStr) {
  if (!timeStr) return ''
  const [h, m] = timeStr.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`
}

function fmtDateFriendly() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  })
}

function fmtClock() {
  return new Date().toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true,
  })
}

const APPT_TYPE_LABELS = {
  fitting: 'Fitting', consultation: 'Consultation', pickup: 'Pickup',
  alteration: 'Alteration check', final_fitting: 'Final fitting',
  payment: 'Payment', other: 'Appointment',
}

const SCREENS = {
  WELCOME: 'welcome',
  NAME_ENTRY: 'name_entry',
  APPT_FOUND: 'appt_found',
  NO_APPT: 'no_appt',
  SUCCESS: 'success',
  PIN: 'pin',
}

// ─── SHARED STYLES ──────────────────────────────────────────────────────────
const BASE = {
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Inter","Segoe UI",sans-serif',
  position: 'relative',
  overflow: 'hidden',
}

const BTN_PRIMARY = {
  display: 'block',
  width: '100%',
  maxWidth: 480,
  padding: '22px 40px',
  borderRadius: 20,
  border: 'none',
  background: 'linear-gradient(135deg, #7C3AED 0%, #C9697A 100%)',
  color: '#fff',
  fontSize: 28,
  fontWeight: 700,
  cursor: 'pointer',
  textAlign: 'center',
  letterSpacing: '-0.3px',
  boxShadow: '0 8px 32px rgba(124,58,237,0.35)',
  transition: 'transform 0.12s, box-shadow 0.12s',
  touchAction: 'manipulation',
  WebkitTapHighlightColor: 'transparent',
}

const BTN_SECONDARY = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '16px 32px',
  borderRadius: 14,
  border: `2px solid ${C.border}`,
  background: C.white,
  color: C.ink,
  fontSize: 20,
  fontWeight: 600,
  cursor: 'pointer',
  touchAction: 'manipulation',
  WebkitTapHighlightColor: 'transparent',
}

const BTN_CONFIRM = {
  display: 'block',
  width: '100%',
  maxWidth: 480,
  padding: '22px 40px',
  borderRadius: 20,
  border: 'none',
  background: 'linear-gradient(135deg, #15803D 0%, #22C55E 100%)',
  color: '#fff',
  fontSize: 26,
  fontWeight: 700,
  cursor: 'pointer',
  textAlign: 'center',
  boxShadow: '0 8px 28px rgba(21,128,61,0.30)',
  touchAction: 'manipulation',
  WebkitTapHighlightColor: 'transparent',
}

// ─── ANIMATED BACKGROUND ────────────────────────────────────────────────────
const bgKeyframes = `
@keyframes kiosk-bg-pan {
  0%   { background-position: 0% 50%; }
  50%  { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
@keyframes kiosk-fade-in {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes kiosk-checkmark {
  0%   { transform: scale(0.4) rotate(-15deg); opacity: 0; }
  60%  { transform: scale(1.15) rotate(3deg); opacity: 1; }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
}
@keyframes kiosk-pulse-ring {
  0%   { transform: scale(1); opacity: 0.6; }
  100% { transform: scale(1.55); opacity: 0; }
}
`

function StyleTag() {
  return <style>{bgKeyframes}</style>
}

// ─── WELCOME SCREEN ─────────────────────────────────────────────────────────
function WelcomeScreen({ boutiqueName, onCheckIn, onFullscreen }) {
  const [clock, setClock] = useState(fmtClock())
  useEffect(() => {
    const iv = setInterval(() => setClock(fmtClock()), 1000)
    return () => clearInterval(iv)
  }, [])

  return (
    <div style={{
      ...BASE,
      background: 'linear-gradient(135deg, #FDF5F6 0%, #F3EEFF 50%, #FDF5F6 100%)',
      backgroundSize: '300% 300%',
      animation: 'kiosk-bg-pan 12s ease infinite',
    }}>
      <StyleTag />
      {/* Decorative blobs */}
      <div style={{ position: 'absolute', top: -120, right: -120, width: 420, height: 420, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -80, left: -80, width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,105,122,0.13) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ textAlign: 'center', animation: 'kiosk-fade-in 0.6s ease both', padding: '0 40px', maxWidth: 600 }}>
        {/* Logo placeholder / boutique name */}
        <div style={{ fontSize: 56, marginBottom: 8 }}>💍</div>
        <div style={{
          fontSize: 38, fontWeight: 800, color: C.ink,
          fontFamily: "'Playfair Display', Georgia, serif",
          marginBottom: 6, letterSpacing: '-0.5px',
        }}>
          {boutiqueName || 'Welcome'}
        </div>
        <div style={{ fontSize: 20, color: C.gray, marginBottom: 8, fontWeight: 400 }}>
          {fmtDateFriendly()}
        </div>
        <div style={{ fontSize: 32, fontWeight: 700, color: C.purple, marginBottom: 52, fontVariantNumeric: 'tabular-nums' }}>
          {clock}
        </div>

        {/* CTA */}
        <button
          style={BTN_PRIMARY}
          onPointerDown={e => { e.currentTarget.style.transform = 'scale(0.97)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(124,58,237,0.25)' }}
          onPointerUp={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 8px 32px rgba(124,58,237,0.35)' }}
          onPointerLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 8px 32px rgba(124,58,237,0.35)' }}
          onClick={onCheckIn}
        >
          👋 Tap to check in
        </button>

        <div style={{ marginTop: 20, fontSize: 15, color: C.inkLight }}>
          Walk-ins welcome — tap above to let us know you're here
        </div>
      </div>

      {/* Fullscreen + Exit controls */}
      <KioskControls onFullscreen={onFullscreen} />
    </div>
  )
}

// ─── NAME ENTRY SCREEN ───────────────────────────────────────────────────────
function NameEntryScreen({ boutiqueId, onFound, onNotFound, onBack }) {
  const [search, setSearch] = useState('')
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!boutiqueId) return
    loadAppointments()
    // Focus input
    setTimeout(() => inputRef.current?.focus(), 300)
  }, [boutiqueId])

  async function loadAppointments() {
    setLoading(true)
    const today = getTodayStr()
    const { data } = await supabase
      .from('appointments')
      .select(`
        id, type, time, status, note, staff_id, client_name, client_phone,
        event:events(
          id, type,
          client:clients(id, name)
        ),
        staff:boutique_members(id, name, initials, color)
      `)
      .eq('boutique_id', boutiqueId)
      .eq('date', today)
      .order('time', { ascending: true, nullsFirst: false })
    setAppointments(data || [])
    setLoading(false)
  }

  const filtered = search.trim()
    ? appointments.filter(a => {
        const clientName = a.event?.client?.name || a.client_name || ''
        return clientName.toLowerCase().includes(search.trim().toLowerCase())
      })
    : appointments.filter(a => a.type !== 'walk_in') // hide walk-ins from check-in list (they're already checked in)

  return (
    <div style={{
      ...BASE,
      background: C.ivory,
      justifyContent: 'flex-start',
      paddingTop: 60,
    }}>
      <StyleTag />

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 40, padding: '0 40px', animation: 'kiosk-fade-in 0.4s ease both' }}>
        <div style={{ fontSize: 44, fontWeight: 800, color: C.ink, marginBottom: 8, fontFamily: "'Playfair Display', Georgia, serif" }}>
          What's your name?
        </div>
        <div style={{ fontSize: 18, color: C.gray }}>
          Search your name below, or tap your appointment card
        </div>
      </div>

      {/* Search input */}
      <div style={{ width: '100%', maxWidth: 560, padding: '0 24px', marginBottom: 32 }}>
        <input
          ref={inputRef}
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Type your name…"
          style={{
            width: '100%',
            padding: '18px 24px',
            fontSize: 26,
            borderRadius: 16,
            border: `2px solid ${search ? C.purple : C.border}`,
            outline: 'none',
            boxSizing: 'border-box',
            fontFamily: 'inherit',
            color: C.ink,
            background: C.white,
            boxShadow: search ? `0 0 0 4px rgba(124,58,237,0.12)` : 'none',
            transition: 'border-color 0.15s, box-shadow 0.15s',
          }}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
      </div>

      {/* Appointment cards */}
      <div style={{ width: '100%', maxWidth: 560, padding: '0 24px', overflowY: 'auto', maxHeight: 'calc(100vh - 340px)', flex: 1 }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: C.gray, fontSize: 18, padding: 40 }}>Loading today's appointments…</div>
        ) : filtered.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {filtered.map(appt => {
              const clientName = appt.event?.client?.name || appt.client_name || 'Unknown'
              const typeLabel = APPT_TYPE_LABELS[appt.type] || appt.type || 'Appointment'
              const staffName = appt.staff?.name || ''
              return (
                <button
                  key={appt.id}
                  onClick={() => onFound(appt)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 18,
                    padding: '20px 24px',
                    borderRadius: 16,
                    border: `2px solid ${C.border}`,
                    background: C.white,
                    cursor: 'pointer',
                    textAlign: 'left',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                    transition: 'border-color 0.1s, box-shadow 0.1s',
                    touchAction: 'manipulation',
                    WebkitTapHighlightColor: 'transparent',
                  }}
                  onPointerDown={e => { e.currentTarget.style.borderColor = C.purple; e.currentTarget.style.boxShadow = `0 4px 20px rgba(124,58,237,0.18)` }}
                  onPointerUp={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)' }}
                  onPointerLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)' }}
                >
                  {/* Avatar */}
                  <div style={{
                    width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
                    background: 'linear-gradient(135deg, #7C3AED, #C9697A)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 22, fontWeight: 700,
                  }}>
                    {clientName.charAt(0).toUpperCase()}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: C.ink, marginBottom: 4 }}>
                      {clientName}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: 13, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                        background: C.purpleBg, color: C.purple,
                      }}>
                        {typeLabel}
                      </span>
                      {appt.time && (
                        <span style={{ fontSize: 14, color: C.gray, fontWeight: 500 }}>
                          {fmtTime(appt.time)}
                        </span>
                      )}
                      {staffName && (
                        <span style={{ fontSize: 13, color: C.inkLight }}>
                          with {staffName}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: 24, color: C.gray, flexShrink: 0 }}>›</div>
                </button>
              )
            })}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 18, color: C.gray, marginBottom: 24 }}>
              {search ? `No appointments found for "${search}"` : 'No appointments scheduled for today'}
            </div>
            <button
              style={{ ...BTN_SECONDARY, margin: '0 auto' }}
              onClick={() => onNotFound(search)}
            >
              I'm a walk-in →
            </button>
          </div>
        )}

        {/* Walk-in option at bottom when results exist */}
        {filtered.length > 0 && (
          <div style={{ textAlign: 'center', marginTop: 32, paddingBottom: 40 }}>
            <div style={{ fontSize: 15, color: C.gray, marginBottom: 12 }}>
              Don't see your name? No appointment?
            </div>
            <button
              style={{ ...BTN_SECONDARY, fontSize: 16, padding: '14px 28px' }}
              onClick={() => onNotFound(search)}
            >
              I'm a walk-in →
            </button>
          </div>
        )}
      </div>

      {/* Back */}
      <div style={{ position: 'absolute', top: 24, left: 24 }}>
        <button style={{ ...BTN_SECONDARY, fontSize: 16, padding: '12px 20px' }} onClick={onBack}>
          ← Back
        </button>
      </div>
    </div>
  )
}

// ─── APPOINTMENT FOUND SCREEN ────────────────────────────────────────────────
function ApptFoundScreen({ boutiqueId, appointment, onConfirm, onNotMe, onBack }) {
  const [loading, setLoading] = useState(false)

  const clientName = appointment?.event?.client?.name || 'Guest'
  const typeLabel = APPT_TYPE_LABELS[appointment?.type] || appointment?.type || 'Appointment'
  const staffName = appointment?.staff?.name || ''

  async function handleConfirm() {
    if (loading) return
    setLoading(true)
    const now = new Date()
    const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })

    // 1. Mark appointment confirmed
    await supabase
      .from('appointments')
      .update({ status: 'confirmed' })
      .eq('id', appointment.id)
      .eq('boutique_id', boutiqueId)

    // 2. Log client interaction
    const clientId = appointment?.event?.client?.id
    const eventId = appointment?.event?.id
    if (clientId) {
      await supabase.from('client_interactions').insert({
        boutique_id: boutiqueId,
        client_id: clientId,
        event_id: eventId || null,
        type: 'note',
        title: 'Client checked in',
        body: `Self check-in via kiosk at ${timeStr}`,
        occurred_at: now.toISOString(),
        is_editable: false,
        author_name: 'Kiosk',
        author_role: 'system',
      })
    }

    setLoading(false)
    onConfirm(clientName)
  }

  return (
    <div style={{ ...BASE, background: C.ivory, padding: '0 40px' }}>
      <StyleTag />
      <div style={{ textAlign: 'center', maxWidth: 560, width: '100%', animation: 'kiosk-fade-in 0.4s ease both' }}>
        {/* Greeting */}
        <div style={{
          width: 100, height: 100, borderRadius: '50%', margin: '0 auto 28px',
          background: 'linear-gradient(135deg, #7C3AED, #C9697A)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 44, fontWeight: 700, color: '#fff',
        }}>
          {clientName.charAt(0).toUpperCase()}
        </div>

        <div style={{ fontSize: 38, fontWeight: 800, color: C.ink, marginBottom: 12, fontFamily: "'Playfair Display', Georgia, serif" }}>
          Hi, {clientName}!
        </div>

        {/* Appointment details */}
        <div style={{
          background: C.white, borderRadius: 20, padding: '24px 28px',
          border: `1px solid ${C.border}`, marginBottom: 36,
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 24 }}>📅</span>
              <span style={{ fontSize: 20, fontWeight: 600, color: C.ink }}>{typeLabel}</span>
              {appointment?.time && (
                <span style={{
                  fontSize: 14, fontWeight: 600, padding: '4px 12px', borderRadius: 20,
                  background: C.purpleBg, color: C.purple, marginLeft: 'auto',
                }}>
                  {fmtTime(appointment.time)}
                </span>
              )}
            </div>
            {staffName && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 24 }}>👤</span>
                <span style={{ fontSize: 18, color: C.ink }}>
                  Your appointment is with <strong>{staffName}</strong>
                </span>
              </div>
            )}
          </div>
        </div>

        {/* CTA */}
        <button
          style={{ ...BTN_CONFIRM, marginBottom: 18, opacity: loading ? 0.7 : 1 }}
          onClick={handleConfirm}
          disabled={loading}
          onPointerDown={e => { if (!loading) { e.currentTarget.style.transform = 'scale(0.97)' } }}
          onPointerUp={e => { e.currentTarget.style.transform = '' }}
          onPointerLeave={e => { e.currentTarget.style.transform = '' }}
        >
          {loading ? 'Checking in…' : '✅ I\'m here!'}
        </button>

        <button
          style={{ ...BTN_SECONDARY, margin: '0 auto', fontSize: 17 }}
          onClick={onNotMe}
        >
          This isn't me →
        </button>
      </div>

      <div style={{ position: 'absolute', top: 24, left: 24 }}>
        <button style={{ ...BTN_SECONDARY, fontSize: 16, padding: '12px 20px' }} onClick={onBack}>
          ← Back
        </button>
      </div>
    </div>
  )
}

// ─── NO APPOINTMENT / WALK-IN SCREEN ────────────────────────────────────────
function NoApptScreen({ boutiqueId, prefillName, onDone, onBack }) {
  const [name, setName] = useState(prefillName || '')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleJoinWaitlist() {
    if (!name.trim()) return
    setSaving(true)

    // Insert to waitlist (existing behavior)
    await supabase.from('waitlist').insert({
      boutique_id: boutiqueId,
      name: name.trim(),
      phone: phone.trim() || null,
      notes: note.trim() || 'Walk-in via kiosk',
      status: 'waiting',
    })

    // Also insert to appointments so walk-ins appear in Calendar
    await supabase.from('appointments').insert({
      boutique_id: boutiqueId,
      event_id: null,
      client_name: name.trim(),
      client_phone: phone.trim() || null,
      client_id: null,
      type: 'walk_in',
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().slice(0, 5),
      note: 'Walk-in via kiosk',
      status: 'walk_in',
    })

    setSaving(false)
    setSaved(true)
    setTimeout(() => onDone(name.trim()), 1800)
  }

  return (
    <div style={{ ...BASE, background: C.ivory, padding: '0 40px' }}>
      <StyleTag />
      <div style={{ textAlign: 'center', maxWidth: 520, width: '100%', animation: 'kiosk-fade-in 0.4s ease both' }}>
        <div style={{ fontSize: 52, marginBottom: 16 }}>😊</div>
        <div style={{ fontSize: 36, fontWeight: 800, color: C.ink, marginBottom: 10, fontFamily: "'Playfair Display', Georgia, serif" }}>
          Welcome! We'll be right with you
        </div>
        <div style={{ fontSize: 17, color: C.gray, marginBottom: 36 }}>
          Enter your name below and our team will assist you shortly
        </div>

        {saved ? (
          <div style={{
            padding: '28px', borderRadius: 20, background: C.greenBg,
            border: `2px solid ${C.green}`, fontSize: 20, fontWeight: 600, color: C.green,
          }}>
            You've been added to our list! Please take a seat. 🛋️
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your name *"
              style={{
                width: '100%', padding: '18px 20px', fontSize: 22, borderRadius: 14,
                border: `2px solid ${name ? C.purple : C.border}`, outline: 'none',
                boxSizing: 'border-box', fontFamily: 'inherit', color: C.ink, background: C.white,
              }}
              autoComplete="off"
            />
            <input
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="Phone (optional)"
              type="tel"
              style={{
                width: '100%', padding: '18px 20px', fontSize: 22, borderRadius: 14,
                border: `2px solid ${C.border}`, outline: 'none',
                boxSizing: 'border-box', fontFamily: 'inherit', color: C.ink, background: C.white,
              }}
              autoComplete="off"
            />
            <button
              style={{
                ...BTN_PRIMARY,
                maxWidth: '100%',
                marginTop: 8,
                opacity: !name.trim() || saving ? 0.55 : 1,
              }}
              onClick={handleJoinWaitlist}
              disabled={!name.trim() || saving}
            >
              {saving ? 'Adding you…' : 'Let us know you\'re here →'}
            </button>
            <div style={{ fontSize: 15, color: C.gray, marginTop: 4 }}>
              Our team will be with you shortly
            </div>
          </div>
        )}
      </div>

      <div style={{ position: 'absolute', top: 24, left: 24 }}>
        <button style={{ ...BTN_SECONDARY, fontSize: 16, padding: '12px 20px' }} onClick={onBack}>
          ← Back
        </button>
      </div>
    </div>
  )
}

// ─── SUCCESS SCREEN ──────────────────────────────────────────────────────────
function SuccessScreen({ clientName, onReturn }) {
  const [countdown, setCountdown] = useState(5)

  useEffect(() => {
    const iv = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(iv); onReturn(); return 0 }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(iv)
  }, [onReturn])

  return (
    <div style={{ ...BASE, background: 'linear-gradient(135deg, #F0FDF4 0%, #FDF5F6 100%)', padding: '0 40px', textAlign: 'center' }}>
      <StyleTag />
      <div style={{ animation: 'kiosk-fade-in 0.5s ease both', maxWidth: 540 }}>
        {/* Animated checkmark */}
        <div style={{ position: 'relative', width: 140, height: 140, margin: '0 auto 32px' }}>
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            background: 'rgba(21,128,61,0.18)',
            animation: 'kiosk-pulse-ring 1.5s ease-out infinite',
          }} />
          <div style={{
            position: 'relative', width: 140, height: 140, borderRadius: '50%',
            background: 'linear-gradient(135deg, #15803D, #22C55E)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 64,
            animation: 'kiosk-checkmark 0.5s cubic-bezier(0.34,1.56,0.64,1) both',
          }}>
            ✓
          </div>
        </div>

        <div style={{
          fontSize: 42, fontWeight: 800, color: C.ink, marginBottom: 14,
          fontFamily: "'Playfair Display', Georgia, serif",
        }}>
          You're checked in, {clientName}!
        </div>

        <div style={{ fontSize: 24, color: C.inkLight, marginBottom: 8 }}>
          🎉 Please take a seat and we'll be with you shortly
        </div>

        <div style={{ fontSize: 40, fontWeight: 800, color: C.green, marginTop: 40, fontVariantNumeric: 'tabular-nums' }}>
          {countdown}
        </div>
        <div style={{ fontSize: 14, color: C.gray }}>Returning to home screen…</div>
      </div>
    </div>
  )
}

// ─── PIN ENTRY MODAL ──────────────────────────────────────────────────────────
function PinModal({ onSuccess, onCancel }) {
  const [digits, setDigits] = useState([])
  const [error, setError] = useState(false)
  const STORED_PIN = localStorage.getItem('belori_kiosk_pin') || '1234'

  function press(d) {
    if (digits.length >= 4) return
    const next = [...digits, d]
    setError(false)
    setDigits(next)
    if (next.length === 4) {
      const entered = next.join('')
      if (entered === STORED_PIN) {
        setTimeout(() => onSuccess(), 200)
      } else {
        setTimeout(() => { setDigits([]); setError(true) }, 400)
      }
    }
  }

  function clear() { setDigits([]); setError(false) }

  const KEYS = [[1,2,3],[4,5,6],[7,8,9],['','0','⌫']]

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999,
    }}>
      <div style={{
        background: C.white, borderRadius: 24, padding: '36px 40px',
        textAlign: 'center', width: 320, boxShadow: '0 24px 64px rgba(0,0,0,0.24)',
      }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: C.ink, marginBottom: 8 }}>
          Exit Kiosk Mode
        </div>
        <div style={{ fontSize: 14, color: C.gray, marginBottom: 24 }}>
          Enter the 4-digit PIN to exit
        </div>

        {/* Dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginBottom: 28 }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{
              width: 18, height: 18, borderRadius: '50%',
              background: digits.length > i
                ? (error ? C.red : C.purple)
                : C.border,
              transition: 'background 0.15s',
            }} />
          ))}
        </div>

        {error && (
          <div style={{ fontSize: 13, color: C.red, marginBottom: 12, fontWeight: 600 }}>
            Incorrect PIN. Try again.
          </div>
        )}

        {/* Keypad */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {KEYS.map((row, ri) => (
            <div key={ri} style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              {row.map((k, ki) => {
                if (k === '') return <div key={ki} style={{ width: 76, height: 56 }} />
                return (
                  <button
                    key={ki}
                    onClick={() => k === '⌫' ? setDigits(d => d.slice(0, -1)) : press(String(k))}
                    style={{
                      width: 76, height: 56, borderRadius: 12,
                      border: `1.5px solid ${C.border}`,
                      background: k === '⌫' ? C.grayBg : C.white,
                      fontSize: k === '⌫' ? 20 : 22,
                      fontWeight: 600, color: C.ink,
                      cursor: 'pointer', touchAction: 'manipulation',
                      WebkitTapHighlightColor: 'transparent',
                    }}
                  >
                    {k}
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        <button
          onClick={onCancel}
          style={{
            marginTop: 20, background: 'none', border: 'none',
            color: C.gray, cursor: 'pointer', fontSize: 14, padding: '8px 16px',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ─── KIOSK CONTROLS (bottom corner) ──────────────────────────────────────────
function KioskControls({ onFullscreen, onExitRequest }) {
  return (
    <div style={{
      position: 'fixed', bottom: 20, right: 20,
      display: 'flex', gap: 10, zIndex: 100,
    }}>
      {onFullscreen && (
        <button
          onClick={onFullscreen}
          title="Toggle fullscreen"
          style={{
            width: 44, height: 44, borderRadius: 10,
            border: `1.5px solid ${C.border}`,
            background: 'rgba(255,255,255,0.85)',
            backdropFilter: 'blur(8px)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, color: C.gray,
            touchAction: 'manipulation',
          }}
        >
          ⛶
        </button>
      )}
      {onExitRequest && (
        <button
          onClick={onExitRequest}
          title="Exit kiosk mode"
          style={{
            height: 44, padding: '0 14px', borderRadius: 10,
            border: `1.5px solid ${C.border}`,
            background: 'rgba(255,255,255,0.85)',
            backdropFilter: 'blur(8px)',
            cursor: 'pointer', fontSize: 12, color: C.gray, fontWeight: 500,
            touchAction: 'manipulation',
          }}
        >
          Exit kiosk
        </button>
      )}
    </div>
  )
}

// ─── MAIN KIOSK PAGE ──────────────────────────────────────────────────────────
export default function KioskPage() {
  const [screen, setScreen] = useState(SCREENS.WELCOME)
  const [selectedAppt, setSelectedAppt] = useState(null)
  const [checkedInName, setCheckedInName] = useState('')
  const [walkinName, setWalkinName] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [boutiqueId, setBoutiqueId] = useState(null)
  const [boutiqueName, setBoutiqueName] = useState('')

  // Resolve boutiqueId from URL param or localStorage (set by staff login)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const fromUrl = params.get('boutique')
    const fromStorage = localStorage.getItem('activeBoutiqueId') || localStorage.getItem('belori_boutique_id')
    const id = fromUrl || fromStorage
    if (id) {
      setBoutiqueId(id)
      // Load boutique name
      supabase.from('boutiques').select('name').eq('id', id).maybeSingle()
        .then(({ data }) => { if (data?.name) setBoutiqueName(data.name) })
    }
  }, [])

  // Store boutiqueId from staff auth if available
  useEffect(() => {
    // Listen for storage changes in case staff logs in from another tab
    const handler = () => {
      const id = localStorage.getItem('activeBoutiqueId') || localStorage.getItem('belori_boutique_id')
      if (id && !boutiqueId) setBoutiqueId(id)
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [boutiqueId])

  function handleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }

  function handleExitConfirmed() {
    setShowPin(false)
    // Navigate to login / home
    window.location.href = '/dashboard'
  }

  const handleReturnToWelcome = useCallback(() => {
    setScreen(SCREENS.WELCOME)
    setSelectedAppt(null)
    setCheckedInName('')
    setWalkinName('')
  }, [])

  if (!boutiqueId) {
    return (
      <div style={{
        ...BASE,
        background: C.ivory,
        gap: 20,
      }}>
        <StyleTag />
        <div style={{ fontSize: 48 }}>🔒</div>
        <div style={{ fontSize: 28, fontWeight: 700, color: C.ink }}>Kiosk not configured</div>
        <div style={{ fontSize: 16, color: C.gray, maxWidth: 380, textAlign: 'center' }}>
          Ask staff to open <strong>Settings → Display → Kiosk Mode</strong> and scan the QR code, or open this page from within the Belori app.
        </div>
        <div style={{ fontSize: 12, color: C.gray, marginTop: 8 }}>
          You can also add <code style={{ background: C.grayBg, padding: '2px 6px', borderRadius: 4 }}>?boutique=YOUR_ID</code> to the URL.
        </div>
        <a href="/login" style={{ marginTop: 8, color: C.purple, fontWeight: 600, fontSize: 15 }}>
          ← Staff login
        </a>
      </div>
    )
  }

  return (
    <>
      {screen === SCREENS.WELCOME && (
        <WelcomeScreen
          boutiqueName={boutiqueName}
          onCheckIn={() => setScreen(SCREENS.NAME_ENTRY)}
          onFullscreen={handleFullscreen}
        />
      )}

      {screen === SCREENS.NAME_ENTRY && (
        <NameEntryScreen
          boutiqueId={boutiqueId}
          onFound={(appt) => { setSelectedAppt(appt); setScreen(SCREENS.APPT_FOUND) }}
          onNotFound={(name) => { setWalkinName(name); setScreen(SCREENS.NO_APPT) }}
          onBack={handleReturnToWelcome}
        />
      )}

      {screen === SCREENS.APPT_FOUND && selectedAppt && (
        <ApptFoundScreen
          boutiqueId={boutiqueId}
          appointment={selectedAppt}
          onConfirm={(name) => { setCheckedInName(name); setScreen(SCREENS.SUCCESS) }}
          onNotMe={() => setScreen(SCREENS.NAME_ENTRY)}
          onBack={() => setScreen(SCREENS.NAME_ENTRY)}
        />
      )}

      {screen === SCREENS.NO_APPT && (
        <NoApptScreen
          boutiqueId={boutiqueId}
          prefillName={walkinName}
          onDone={(name) => { setCheckedInName(name); setScreen(SCREENS.SUCCESS) }}
          onBack={() => setScreen(SCREENS.NAME_ENTRY)}
        />
      )}

      {screen === SCREENS.SUCCESS && (
        <SuccessScreen
          clientName={checkedInName}
          onReturn={handleReturnToWelcome}
        />
      )}

      {/* Global kiosk controls overlay (visible on all non-welcome screens) */}
      {screen !== SCREENS.WELCOME && (
        <KioskControls
          onFullscreen={handleFullscreen}
          onExitRequest={() => setShowPin(true)}
        />
      )}

      {/* Welcome screen controls are embedded in WelcomeScreen */}
      {screen === SCREENS.WELCOME && (
        <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 100 }}>
          <button
            onClick={() => setShowPin(true)}
            style={{
              height: 44, padding: '0 14px', borderRadius: 10,
              border: `1.5px solid ${C.border}`,
              background: 'rgba(255,255,255,0.85)',
              backdropFilter: 'blur(8px)',
              cursor: 'pointer', fontSize: 12, color: C.gray, fontWeight: 500,
              touchAction: 'manipulation',
            }}
          >
            Exit kiosk
          </button>
          <button
            onClick={handleFullscreen}
            title="Toggle fullscreen"
            style={{
              width: 44, height: 44, borderRadius: 10,
              border: `1.5px solid ${C.border}`,
              background: 'rgba(255,255,255,0.85)',
              backdropFilter: 'blur(8px)',
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, color: C.gray,
              touchAction: 'manipulation',
              marginLeft: 8,
            }}
          >
            ⛶
          </button>
        </div>
      )}

      {showPin && (
        <PinModal
          onSuccess={handleExitConfirmed}
          onCancel={() => setShowPin(false)}
        />
      )}
    </>
  )
}
