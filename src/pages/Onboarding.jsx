import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { sendInngestEvent } from '../lib/inngest'

const C = {
  rosa: '#C9697A', ink: '#1C1012', gray: '#6B7280', border: '#E5E7EB',
  white: '#FFFFFF', ivory: '#F8F4F0', red: '#B91C1C', redBg: '#FEE2E2',
}
const inp = {
  width: '100%', padding: '10px 12px', borderRadius: 8,
  border: `1px solid ${C.border}`, fontSize: 14, color: C.ink,
  outline: 'none', boxSizing: 'border-box', background: C.white,
}
const lbl = { fontSize: 12, fontWeight: 500, color: C.ink, display: 'block', marginBottom: 6 }

// ─── Brand color presets ──────────────────────────────────────────────────
const BRAND_PRESETS = [
  { name: 'Rose',       hex: '#C9697A' },
  { name: 'Blush',      hex: '#D4788A' },
  { name: 'Mauve',      hex: '#9B6B83' },
  { name: 'Lavender',   hex: '#8B7BC8' },
  { name: 'Sage',       hex: '#6FAE8A' },
  { name: 'Gold',       hex: '#B8954A' },
  { name: 'Terracotta', hex: '#C27B5A' },
  { name: 'Slate',      hex: '#5E7A8A' },
  { name: 'Berry',      hex: '#8B3A7A' },
  { name: 'Midnight',   hex: '#3A4E7A' },
  { name: 'Charcoal',   hex: '#5A5A6A' },
  { name: 'Champagne',  hex: '#C4A87A' },
]

function hexToPale(hex) {
  if (!hex || !/^#[0-9A-Fa-f]{6}$/.test(hex)) return '#FDF5F6'
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const m = (c) => Math.round(c * 0.10 + 255 * 0.90)
  return `rgb(${m(r)},${m(g)},${m(b)})`
}

// ─── Live brand preview ───────────────────────────────────────────────────
const BrandPreview = ({ color }) => {
  const pale = hexToPale(color)
  return (
    <div style={{ background: C.ivory, borderRadius: 14, padding: 16, border: `1px solid ${C.border}` }}>
      <div style={{ fontSize: 10, color: C.gray, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12, fontWeight: 500 }}>Live Preview</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {/* Nav */}
        <div style={{ background: C.white, borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 10, color: C.gray, marginBottom: 8 }}>Navigation</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 9px', background: pale, borderRadius: 7, marginBottom: 5 }}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.5"><rect x="1" y="2" width="14" height="12" rx="1.5"/><path d="M5 1v2M11 1v2M1 6h14" strokeLinecap="round"/></svg>
            <span style={{ fontSize: 11, color, fontWeight: 500 }}>Events</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 9px', borderRadius: 7 }}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="#9CA3AF" strokeWidth="1.5"><circle cx="8" cy="5" r="3"/><path d="M2 14c0-3.314 2.686-5 6-5s6 1.686 6 5" strokeLinecap="round"/></svg>
            <span style={{ fontSize: 11, color: '#9CA3AF' }}>Clients</span>
          </div>
        </div>
        {/* Button + stat */}
        <div style={{ background: C.white, borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 10, color: C.gray, marginBottom: 8 }}>Buttons & stats</div>
          <div style={{ padding: '8px 12px', background: color, borderRadius: 8, fontSize: 11, color: '#fff', fontWeight: 500, textAlign: 'center', marginBottom: 8 }}>
            + New event
          </div>
          <div style={{ padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 8 }}>
            <div style={{ fontSize: 9, color: C.gray }}>Total events</div>
            <div style={{ fontSize: 20, fontWeight: 700, color, lineHeight: 1.2 }}>14</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Step indicator ────────────────────────────────────────────────────────
const StepDots = ({ step, color }) => (
  <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center', marginBottom: 28 }}>
    {[0, 1].map(i => (
      <div key={i} style={{
        height: 6, borderRadius: 3,
        width: i === step ? 22 : 6,
        background: i === step ? color : i < step ? color : C.border,
        opacity: i < step ? 0.4 : 1,
        transition: 'all 0.3s ease',
      }} />
    ))}
  </div>
)

export default function Onboarding() {
  const { session, boutique, reloadBoutique } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [brandColor, setBrandColor] = useState('#C9697A')
  const [customHex, setCustomHex] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const colorPickerRef = useRef(null)

  // Guard: if user already has a boutique, skip onboarding
  useEffect(() => {
    if (boutique) navigate('/dashboard', { replace: true })
  }, [boutique?.id, navigate])

  function handleNext() {
    if (!name.trim()) { setError('Boutique name is required'); return }
    setError('')
    setStep(1)
    window.scrollTo(0, 0)
  }

  async function handleCreate() {
    setError('')
    setLoading(true)

    // Check if boutique name is already taken
    const { data: nameExists, error: nameError } = await supabase.rpc('check_boutique_name_exists', { p_name: name.trim() })
    if (nameError) { setError('Unable to verify boutique name. Please try again.'); setLoading(false); return }
    if (nameExists) { setError('A boutique with this name already exists. Please choose a different name.'); setLoading(false); return }

    const { error: rpcError } = await supabase.rpc('create_boutique_for_user', {
      p_user_id: session.user.id,
      p_boutique_name: name.trim(),
      p_owner_email: session.user.email,
    })
    if (rpcError) { setError(rpcError.message); setLoading(false); return }

    // Save branding + contact info
    const { data: memberData } = await supabase
      .from('boutique_members')
      .select('boutique_id')
      .eq('user_id', session.user.id)
      .single()

    if (memberData?.boutique_id) {
      await supabase.from('boutiques').update({
        phone: phone.trim() || null,
        address: city.trim() || null,
        primary_color: brandColor,
      }).eq('id', memberData.boutique_id)
    }

    sendInngestEvent('belori/boutique.created', { owner_email: session.user.email, boutique_name: name.trim() })
    await reloadBoutique(session.user.id)
    // SessionRoute auto-redirects to /dashboard once boutique is loaded
  }

  function handleColorSelect(hex) {
    setBrandColor(hex)
    setCustomHex('')
  }

  function handleCustomHex(val) {
    setCustomHex(val)
    const cleaned = val.startsWith('#') ? val : '#' + val
    if (/^#[0-9A-Fa-f]{6}$/.test(cleaned)) setBrandColor(cleaned)
  }

  const pale = hexToPale(brandColor)

  return (
    <div style={{
      minHeight: '100vh', background: C.ivory,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      fontFamily: '-apple-system,BlinkMacSystemFont,"Inter","Segoe UI",sans-serif',
      paddingTop: 40, paddingBottom: 40,
    }}>
      <div style={{ width: '100%', maxWidth: 500, padding: '0 16px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 44, height: 44, background: C.ink, borderRadius: 11,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10,
          }}>
            <svg viewBox="0 0 32 32" fill="none" style={{ width: 26, height: 26 }}>
              <path d="M7 25V7l18 18V7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.ink }}>Belori</div>
        </div>

        <div style={{ background: C.white, borderRadius: 18, border: `1px solid ${C.border}`, padding: 28, boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>

          <StepDots step={step} color={brandColor} />

          {/* ── STEP 0: Details ─────────────────────────────────────── */}
          {step === 0 && (
            <div>
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: C.ink, marginBottom: 6 }}>Welcome to Belori 👋</div>
                <div style={{ fontSize: 13, color: C.gray, lineHeight: 1.5 }}>Let's get your boutique set up. It only takes a minute.</div>
              </div>

              {error && (
                <div style={{ background: '#FEE2E2', color: C.red, padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={lbl}>Boutique name <span style={{ color: C.rosa }}>*</span></label>
                  <input
                    type="text" value={name} onChange={e => setName(e.target.value)}
                    placeholder="e.g. Bella Bridal & Events"
                    style={inp} autoFocus
                    onKeyDown={e => e.key === 'Enter' && handleNext()}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={lbl}>Phone <span style={{ fontSize: 11, color: C.gray, fontWeight: 400 }}>(optional)</span></label>
                    <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(555) 000-0000" style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>City <span style={{ fontSize: 11, color: C.gray, fontWeight: 400 }}>(optional)</span></label>
                    <input type="text" value={city} onChange={e => setCity(e.target.value)} placeholder="San Antonio" style={inp} />
                  </div>
                </div>
              </div>

              <button onClick={handleNext} style={{
                width: '100%', marginTop: 22,
                padding: '12px', borderRadius: 10, border: 'none',
                background: brandColor, color: '#fff',
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
                transition: 'all 0.2s',
              }}>
                Next — Choose your brand →
              </button>
            </div>
          )}

          {/* ── STEP 1: Brand color ─────────────────────────────────── */}
          {step === 1 && (
            <div>
              <div style={{ textAlign: 'center', marginBottom: 22 }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: C.ink, marginBottom: 6 }}>Your brand color</div>
                <div style={{ fontSize: 13, color: C.gray, lineHeight: 1.5 }}>Pick a color that represents <strong>{name}</strong>. You can always change it in Settings.</div>
              </div>

              {/* Live preview */}
              <BrandPreview color={brandColor} />

              {/* Preset swatches */}
              <div style={{ marginTop: 20, marginBottom: 4 }}>
                <div style={{ fontSize: 12, color: C.gray, fontWeight: 500, marginBottom: 12 }}>Choose a preset</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
                  {BRAND_PRESETS.map(p => {
                    const isSelected = brandColor.toLowerCase() === p.hex.toLowerCase()
                    return (
                      <button key={p.hex} onClick={() => handleColorSelect(p.hex)} title={p.name}
                        style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                          background: 'none', border: 'none', cursor: 'pointer', padding: '4px 2px',
                        }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: '50%',
                          background: p.hex,
                          border: isSelected ? `3px solid ${C.ink}` : '3px solid transparent',
                          boxShadow: isSelected ? `0 0 0 2px ${hexToPale(p.hex)}` : 'none',
                          transition: 'all 0.15s',
                          transform: isSelected ? 'scale(1.15)' : 'scale(1)',
                        }} />
                        <span style={{ fontSize: 9, color: isSelected ? C.ink : C.gray, fontWeight: isSelected ? 600 : 400, lineHeight: 1 }}>{p.name}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Custom color */}
              <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: C.ivory, borderRadius: 10, border: `1px solid ${C.border}` }}>
                <button onClick={() => colorPickerRef.current?.click()}
                  style={{
                    width: 30, height: 30, borderRadius: 7, background: brandColor,
                    border: `2px solid ${C.border}`, cursor: 'pointer', flexShrink: 0,
                    padding: 0, minHeight: 'unset', minWidth: 'unset',
                  }}
                />
                <input ref={colorPickerRef} type="color" value={brandColor}
                  onChange={e => handleColorSelect(e.target.value)}
                  style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: C.gray, marginBottom: 2 }}>Custom hex color</div>
                  <input
                    type="text" value={customHex || brandColor}
                    onChange={e => handleCustomHex(e.target.value)}
                    placeholder="#C9697A"
                    style={{ ...inp, padding: '4px 8px', fontSize: 12, width: '100%', background: 'transparent', border: 'none' }}
                  />
                </div>
              </div>

              {error && (
                <div style={{ background: '#FEE2E2', color: C.red, padding: '10px 14px', borderRadius: 8, fontSize: 13, marginTop: 14 }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
                <button onClick={() => { setStep(0); setError('') }}
                  style={{ padding: '12px 20px', borderRadius: 10, border: `1px solid ${C.border}`, background: C.white, color: C.gray, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
                  ← Back
                </button>
                <button onClick={handleCreate} disabled={loading}
                  style={{
                    flex: 1, padding: '12px', borderRadius: 10, border: 'none',
                    background: loading ? C.gray : brandColor, color: '#fff',
                    fontSize: 14, fontWeight: 600, cursor: loading ? 'default' : 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}>
                  {loading ? (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 0.8s linear infinite' }}>
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round"/>
                      </svg>
                      Creating your boutique…
                    </>
                  ) : (
                    `Create ${name || 'boutique'} →`
                  )}
                </button>
              </div>
              <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
            </div>
          )}

        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 11, color: C.gray }}>
          {step === 0
            ? '14-day free trial · No credit card required'
            : 'You can customize your branding anytime in Settings'}
        </div>
      </div>
    </div>
  )
}
