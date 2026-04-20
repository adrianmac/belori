import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { sendInngestEvent } from '../lib/inngest'
import {
  D, injectCoutureFonts, forceLightTheme, OrnamentRule, Wordmark,
  coutureInput, couturePrimaryBtn, coutureGhostBtn, coutureLabel,
} from '../lib/couture.jsx'

// ─── Brand color presets — curated for the couture palette ─────────────────
const BRAND_PRESETS = [
  { name: 'Champagne',  hex: '#B08A4E' },   // our house gold
  { name: 'Rose',       hex: '#C06070' },   // dusty heritage rose
  { name: 'Bordeaux',   hex: '#8B3A4A' },
  { name: 'Mauve',      hex: '#9B6B83' },
  { name: 'Sage',       hex: '#6FAE8A' },
  { name: 'Terracotta', hex: '#C27B5A' },
  { name: 'Slate',      hex: '#5E7A8A' },
  { name: 'Midnight',   hex: '#3A4E7A' },
  { name: 'Lavender',   hex: '#8B7BC8' },
  { name: 'Ink',        hex: '#1C1118' },
  { name: 'Berry',      hex: '#8B3A7A' },
  { name: 'Charcoal',   hex: '#5A5A6A' },
]

function hexToPale(hex) {
  if (!hex || !/^#[0-9A-Fa-f]{6}$/.test(hex)) return '#FBF5E9'
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const m = (c) => Math.round(c * 0.10 + 255 * 0.90)
  return `rgb(${m(r)},${m(g)},${m(b)})`
}

// ─── Live brand preview — restyled editorial ──────────────────────────────
const BrandPreview = ({ color, name }) => {
  const pale = hexToPale(color)
  return (
    <div style={{
      background: D.bg,
      border: `1px solid ${D.border}`,
      padding: 18,
      borderRadius: 2,
      position: 'relative',
    }}>
      <div className="couture-smallcaps" style={{ color: D.inkLight, marginBottom: 14, letterSpacing: '0.22em' }}>
        Live Preview
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {/* Nav preview */}
        <div style={{ background: D.cardWarm, padding: 14, borderRadius: 2, border: `1px solid ${D.border}` }}>
          <div className="couture-smallcaps" style={{ color: D.inkLight, marginBottom: 10, fontSize: 9, letterSpacing: '0.18em' }}>
            Navigation
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 9px', background: pale, borderLeft: `2px solid ${color}`, marginBottom: 5 }}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.5"><rect x="1" y="2" width="14" height="12"/><path d="M5 1v2M11 1v2M1 6h14" strokeLinecap="round"/></svg>
            <span style={{ fontSize: 11, color, fontWeight: 500 }}>Events</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 9px' }}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke={D.inkLight} strokeWidth="1.5"><circle cx="8" cy="5" r="3"/><path d="M2 14c0-3.314 2.686-5 6-5s6 1.686 6 5" strokeLinecap="round"/></svg>
            <span style={{ fontSize: 11, color: D.inkLight }}>Clients</span>
          </div>
        </div>
        {/* Button + stat preview */}
        <div style={{ background: D.cardWarm, padding: 14, borderRadius: 2, border: `1px solid ${D.border}` }}>
          <div className="couture-smallcaps" style={{ color: D.inkLight, marginBottom: 10, fontSize: 9, letterSpacing: '0.18em' }}>
            Actions
          </div>
          <div style={{
            padding: '10px 12px', background: color,
            fontSize: 10, color: D.cardWarm, fontWeight: 500,
            textAlign: 'center', marginBottom: 10,
            textTransform: 'uppercase', letterSpacing: '0.16em',
          }}>
            + New event
          </div>
          <div style={{ padding: '8px 10px', border: `1px solid ${D.border}`, borderRadius: 2 }}>
            <div className="couture-smallcaps" style={{ color: D.inkLight, fontSize: 8 }}>
              Total events
            </div>
            <div className="couture-display" style={{ fontSize: 24, color, lineHeight: 1.1, marginTop: 2 }}>14</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Step indicator — Roman numeral + hairline ────────────────────────────
const StepDots = ({ step }) => (
  <div style={{ display: 'flex', gap: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 28 }}>
    {[
      { n: 0, label: 'I', title: 'Details' },
      { n: 1, label: 'II', title: 'Brand' },
    ].map((s, i) => {
      const active = s.n === step
      const done = s.n < step
      return (
        <div key={s.n} style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div className="couture-display" style={{
              fontSize: 28,
              color: active ? D.goldDark : done ? D.gold : D.inkLight,
              opacity: active ? 1 : done ? 0.8 : 0.4,
              lineHeight: 1,
              transition: 'all 0.3s',
            }}>{s.label}</div>
            <div className="couture-smallcaps" style={{
              color: active ? D.ink : D.inkLight,
              fontSize: 9, letterSpacing: '0.22em',
            }}>{s.title}</div>
          </div>
          {i === 0 && (
            <span style={{
              width: 30, height: 1,
              background: done ? D.gold : D.inkHair,
              opacity: done ? 1 : 0.5,
            }} />
          )}
        </div>
      )
    })}
  </div>
)

export default function Onboarding() {
  const { session, boutique, reloadBoutique } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [brandColor, setBrandColor] = useState('#B08A4E')   // champagne default now
  const [customHex, setCustomHex] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const colorPickerRef = useRef(null)

  useEffect(() => { injectCoutureFonts(); forceLightTheme() }, [])

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

    // Check boutique name availability
    const { data: nameExists, error: nameError } = await supabase.rpc('check_boutique_name_exists', { p_name: name.trim() })
    if (nameError) { setError('Unable to verify boutique name. Please try again.'); setLoading(false); return }
    if (nameExists) { setError('A boutique with this name already exists. Please choose a different name.'); setLoading(false); return }

    const { error: rpcError } = await supabase.rpc('create_boutique_for_user', {
      p_user_id: session.user.id,
      p_boutique_name: name.trim(),
      p_owner_email: session.user.email,
    })
    if (rpcError) { setError(rpcError.message); setLoading(false); return }

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
  }

  function handleColorSelect(hex) { setBrandColor(hex); setCustomHex('') }
  function handleCustomHex(val) {
    setCustomHex(val)
    const cleaned = val.startsWith('#') ? val : '#' + val
    if (/^#[0-9A-Fa-f]{6}$/.test(cleaned)) setBrandColor(cleaned)
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.15fr)',
      fontFamily: D.sans,
      background: D.bg,
      color: D.ink,
    }}>
      <style>{`
        @media (max-width: 860px) {
          .couture-onboard-grid { grid-template-columns: 1fr !important; }
          .couture-onboard-left { display: none !important; }
        }
      `}</style>

      {/* ─── LEFT — EDITORIAL WELCOME ─────────────────────────────────────── */}
      <aside className="couture-onboard-left couture-grain" style={{
        position: 'relative',
        background: `linear-gradient(160deg, #F3EBDE 0%, ${D.bg} 50%, ${D.bgDeep} 100%)`,
        borderRight: `1px solid ${D.border}`,
        padding: '56px 56px 48px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        overflow: 'hidden',
      }}>
        <header className="couture-smallcaps" style={{ color: D.gold, letterSpacing: '0.32em' }}>
          Chapter one
        </header>

        <div className="couture-fade-up" style={{ maxWidth: 440 }}>
          <div className="couture-smallcaps" style={{ color: D.goldDark, marginBottom: 22, letterSpacing: '0.38em' }}>
            Your atelier
          </div>
          <h1 className="couture-display" style={{
            fontSize: 'clamp(48px, 6vw, 80px)',
            lineHeight: 1.0,
            color: D.ink,
            margin: 0,
            fontWeight: 400,
          }}>
            A name.<br/>
            A color.<br/>
            <span className="couture-serif-i" style={{ color: D.goldDark, fontStyle: 'italic' }}>
              A beginning.
            </span>
          </h1>
          <p className="couture-serif" style={{
            fontSize: 17, lineHeight: 1.65, color: D.inkMid,
            marginTop: 24, maxWidth: 400, fontStyle: 'italic', fontWeight: 300,
          }}>
            Tell us who you are, choose the color that will carry your house forward, and
            we'll set the first stitches in place.
          </p>

          <div style={{ marginTop: 36, paddingTop: 22, borderTop: `1px solid ${D.inkHair}` }}>
            <div className="couture-smallcaps" style={{ color: D.inkLight, marginBottom: 6, letterSpacing: '0.22em' }}>
              What happens next
            </div>
            <div className="couture-serif" style={{ fontSize: 15, color: D.ink, fontStyle: 'italic', fontWeight: 400 }}>
              Your dashboard, a calendar, a client ledger — all ready the moment you're done.
            </div>
          </div>
        </div>

        <footer className="couture-smallcaps" style={{ color: D.inkLight, textAlign: 'left' }}>
          No card required · sixty seconds
        </footer>

        {/* Watermark fleuron */}
        <svg width="420" height="420" viewBox="0 0 200 200" fill="none" aria-hidden="true"
          style={{ position: 'absolute', right: -120, top: '35%', opacity: 0.05, color: D.ink, pointerEvents: 'none' }}>
          <path d="M100 20c0 30 20 50 50 50-30 0-50 20-50 50 0-30-20-50-50-50 30 0 50-20 50-50z" fill="currentColor"/>
          <circle cx="100" cy="100" r="3" fill="currentColor"/>
        </svg>
      </aside>

      {/* ─── RIGHT — FORM ─────────────────────────────────────────────────── */}
      <main style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '56px 32px', background: D.cardWarm,
      }}>
        <div style={{ width: '100%', maxWidth: 480 }}>
          <div className="couture-fade-up" style={{ textAlign: 'center', marginBottom: 36 }}>
            <Wordmark size={36} />
          </div>

          <StepDots step={step} />

          {/* ── STEP 0 — Details ──────────────────────────────────────────── */}
          {step === 0 && (
            <div className="couture-fade-up couture-fade-up-2">
              <div style={{ textAlign: 'center', marginBottom: 28 }}>
                <h2 className="couture-serif-i" style={{
                  fontSize: 28, color: D.ink, margin: 0, fontWeight: 400, fontStyle: 'italic',
                }}>
                  The boutique's name.
                </h2>
                <p style={{ fontSize: 13, color: D.inkMid, marginTop: 8 }}>
                  It will appear on every contract, invoice, and confirmation.
                </p>
              </div>

              {error && (
                <div role="alert" style={{
                  background: D.dangerBg, color: D.danger,
                  padding: '12px 14px', borderLeft: `2px solid ${D.danger}`,
                  fontSize: 13, marginBottom: 16,
                }}>{error}</div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div>
                  <label style={coutureLabel}>Boutique name</label>
                  <input
                    type="text" value={name} onChange={e => setName(e.target.value)}
                    placeholder="Bella Bridal & Events"
                    className="couture-input" style={coutureInput}
                    autoFocus onKeyDown={e => e.key === 'Enter' && handleNext()}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={coutureLabel}>Phone <span style={{ color: D.inkLight, textTransform: 'none', letterSpacing: 0, marginLeft: 4 }}>optional</span></label>
                    <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(555) 000-0000" className="couture-input" style={coutureInput} />
                  </div>
                  <div>
                    <label style={coutureLabel}>City <span style={{ color: D.inkLight, textTransform: 'none', letterSpacing: 0, marginLeft: 4 }}>optional</span></label>
                    <input type="text" value={city} onChange={e => setCity(e.target.value)} placeholder="San Antonio" className="couture-input" style={coutureInput} />
                  </div>
                </div>
              </div>

              <button
                onClick={handleNext}
                className="couture-primary-btn"
                style={{ ...couturePrimaryBtn, marginTop: 26 }}
              >
                Continue — Choose your brand
              </button>
            </div>
          )}

          {/* ── STEP 1 — Brand color ──────────────────────────────────────── */}
          {step === 1 && (
            <div className="couture-fade-up couture-fade-up-2">
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <h2 className="couture-serif-i" style={{
                  fontSize: 28, color: D.ink, margin: 0, fontWeight: 400, fontStyle: 'italic',
                }}>
                  Your house color.
                </h2>
                <p style={{ fontSize: 13, color: D.inkMid, marginTop: 8, lineHeight: 1.6 }}>
                  The color of{' '}
                  <span className="couture-serif-i" style={{ color: D.ink, fontStyle: 'italic' }}>{name}</span>.
                  &nbsp;You can refine it later.
                </p>
              </div>

              <BrandPreview color={brandColor} name={name} />

              {/* Preset swatches */}
              <div style={{ marginTop: 22 }}>
                <div className="couture-smallcaps" style={{ color: D.inkMid, marginBottom: 14, letterSpacing: '0.18em' }}>
                  Curated palette
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>
                  {BRAND_PRESETS.map(p => {
                    const isSelected = brandColor.toLowerCase() === p.hex.toLowerCase()
                    return (
                      <button key={p.hex} onClick={() => handleColorSelect(p.hex)} title={p.name}
                        style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                          background: 'none', border: 'none', cursor: 'pointer', padding: '4px 2px',
                        }}>
                        <div style={{
                          width: 34, height: 34,
                          background: p.hex,
                          border: isSelected ? `2px solid ${D.ink}` : `2px solid transparent`,
                          boxShadow: isSelected ? `0 0 0 2px ${D.cardWarm}, 0 0 0 3px ${p.hex}` : 'none',
                          transition: 'all 0.2s cubic-bezier(.22,.61,.36,1)',
                          transform: isSelected ? 'scale(1.1)' : 'scale(1)',
                        }} />
                        <span style={{
                          fontSize: 9, color: isSelected ? D.ink : D.inkLight,
                          fontWeight: isSelected ? 600 : 400, lineHeight: 1,
                          textTransform: 'uppercase', letterSpacing: '0.1em',
                        }}>{p.name}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Custom hex */}
              <div style={{
                marginTop: 20, display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px', background: D.bg, border: `1px solid ${D.border}`,
              }}>
                <button onClick={() => colorPickerRef.current?.click()} title="Open color picker"
                  style={{
                    width: 32, height: 32, background: brandColor,
                    border: `1px solid ${D.inkHair}`, cursor: 'pointer', flexShrink: 0,
                    padding: 0, minHeight: 'unset', minWidth: 'unset',
                  }}
                />
                <input ref={colorPickerRef} type="color" value={brandColor}
                  onChange={e => handleColorSelect(e.target.value)}
                  style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
                />
                <div style={{ flex: 1 }}>
                  <div className="couture-smallcaps" style={{ color: D.inkLight, marginBottom: 2, fontSize: 9 }}>
                    Custom hex
                  </div>
                  <input
                    type="text" value={customHex || brandColor}
                    onChange={e => handleCustomHex(e.target.value)}
                    placeholder="#B08A4E"
                    style={{
                      ...coutureInput,
                      padding: '4px 8px', fontSize: 12,
                      background: 'transparent', border: 'none',
                    }}
                  />
                </div>
              </div>

              {error && (
                <div role="alert" style={{
                  background: D.dangerBg, color: D.danger,
                  padding: '12px 14px', borderLeft: `2px solid ${D.danger}`,
                  fontSize: 13, marginTop: 16,
                }}>{error}</div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 26 }}>
                <button
                  onClick={() => { setStep(0); setError('') }}
                  className="couture-ghost-btn"
                  style={{ ...coutureGhostBtn, flex: '0 0 auto' }}
                >
                  ← Back
                </button>
                <button
                  onClick={handleCreate} disabled={loading}
                  className="couture-primary-btn"
                  style={{ ...couturePrimaryBtn, flex: 1 }}
                >
                  {loading
                    ? 'Opening…'
                    : `Open ${name ? `"${name.length > 14 ? name.slice(0, 14) + '…' : name}"` : 'your atelier'}`}
                </button>
              </div>
            </div>
          )}

          <div className="couture-fade-up couture-fade-up-4" style={{ marginTop: 44, textAlign: 'center' }}>
            <OrnamentRule width={30} />
            <div className="couture-smallcaps" style={{ marginTop: 14, color: D.inkLight, letterSpacing: '0.3em' }}>
              {step === 0 ? 'Step I of II' : 'Step II of II · You can refine this later in Settings'}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
