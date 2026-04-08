import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const FONT = '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif'
const SERIF = '"Playfair Display", Georgia, serif'

const EVENT_TYPES = [
  { value: '', label: 'Select event type…' },
  { value: 'wedding', label: 'Wedding' },
  { value: 'quince', label: 'Quinceañera' },
  { value: 'baptism', label: 'Baptism' },
  { value: 'birthday', label: 'Birthday' },
  { value: 'other', label: 'Other' },
]

// Lighten a hex color by mixing it toward white
function lighten(hex, amount = 0.88) {
  const n = parseInt((hex || '#C9697A').replace('#', ''), 16)
  const r = Math.round(((n >> 16) & 255) * (1 - amount) + 255 * amount)
  const g = Math.round(((n >> 8) & 255) * (1 - amount) + 255 * amount)
  const b = Math.round((n & 255) * (1 - amount) + 255 * amount)
  return `rgb(${r},${g},${b})`
}

function darken(hex, amount = 0.12) {
  const n = parseInt((hex || '#C9697A').replace('#', ''), 16)
  const r = Math.max(0, Math.round(((n >> 16) & 255) * (1 - amount)))
  const g = Math.max(0, Math.round(((n >> 8) & 255) * (1 - amount)))
  const b = Math.max(0, Math.round((n & 255) * (1 - amount)))
  return `rgb(${r},${g},${b})`
}

const fieldSt = (accent) => ({
  width: '100%',
  padding: '10px 12px',
  borderRadius: 8,
  border: '1.5px solid #E5E7EB',
  fontSize: 14,
  color: '#1C1012',
  fontFamily: FONT,
  outline: 'none',
  background: '#fff',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s',
})

const LBL = ({ children, required }) => (
  <div style={{ fontSize: 12, fontWeight: 600, color: '#4A2030', marginBottom: 5, letterSpacing: 0.2 }}>
    {children}{required && <span style={{ color: '#C9697A', marginLeft: 2 }}>*</span>}
  </div>
)

// Detect if the form is embedded inside an iframe
const inIframe = typeof window !== 'undefined' && window !== window.parent

export default function LeadForm() {
  const { boutiqueId } = useParams()
  const [boutique, setBoutique] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState({})
  const [focusedField, setFocusedField] = useState(null)

  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    eventType: '',
    eventDate: '',
    budget: '',
    heardAbout: '',
    message: '',
  })

  useEffect(() => {
    if (!boutiqueId) { setNotFound(true); setLoading(false); return }
    supabase
      .from('boutiques')
      .select('name, primary_color, booking_url')
      .eq('id', boutiqueId)
      .single()
      .then(({ data, error }) => {
        if (error || !data) setNotFound(true)
        else setBoutique(data)
        setLoading(false)
      })
  }, [boutiqueId])

  const accent = boutique?.primary_color || '#C9697A'
  const accentLight = lighten(accent, 0.9)
  const accentDark = darken(accent, 0.1)

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const validate = () => {
    const errs = {}
    if (!form.name.trim()) errs.name = 'Full name is required'
    if (!form.phone.trim()) errs.phone = 'Phone number is required'
    return errs
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setErrors({})
    setSubmitting(true)

    const notesArr = [
      form.heardAbout ? `Source: ${form.heardAbout}` : null,
      form.message || null,
    ].filter(Boolean)

    const leadPayload = {
      boutique_id: boutiqueId,
      lead_name: form.name.trim(),
      lead_phone: form.phone.trim(),
      stage: 'inquiry',
      event_type: form.eventType || null,
      estimated_event_date: form.eventDate || null,
      estimated_value: form.budget ? Number(form.budget) : null,
      source: 'lead_form',
      notes: notesArr.length > 0 ? notesArr.join('\n') : null,
    }

    const { error: leadError } = await supabase.from('pipeline_leads').insert(leadPayload)

    if (leadError) {
      setErrors({ submit: 'Something went wrong. Please try again.' })
      setSubmitting(false)
      return
    }

    // Best-effort client creation — don't block on failure
    try {
      await supabase.from('clients').insert({
        boutique_id: boutiqueId,
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || null,
      })
    } catch (_) {
      // Silently ignore — RLS may block anon inserts
    }

    setSubmitted(true)
    setSubmitting(false)

    // Notify the parent window (embed widget) that the lead was submitted
    if (inIframe) {
      window.parent.postMessage({ type: 'belori:lead_submitted' }, '*')
    }
  }

  const inputStyle = (field) => ({
    ...fieldSt(accent),
    borderColor: errors[field] ? '#B91C1C' : focusedField === field ? accent : '#E5E7EB',
    boxShadow: focusedField === field ? `0 0 0 3px ${lighten(accent, 0.8)}` : 'none',
  })

  const onFocus = (field) => () => setFocusedField(field)
  const onBlur = () => setFocusedField(null)

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: inIframe ? 'auto' : '100vh', background: inIframe ? '#fff' : '#F8F4F0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, padding: inIframe ? '40px 0' : 0 }}>
        <div style={{ textAlign: 'center', color: '#9E7880' }}>
          <div style={{ fontSize: 32, marginBottom: 8, animation: 'spin 1s linear infinite' }}>✿</div>
          <div style={{ fontSize: 14 }}>Loading…</div>
        </div>
      </div>
    )
  }

  // ── Not found ────────────────────────────────────────────────────────────────
  if (notFound) {
    return (
      <div style={{ minHeight: inIframe ? 'auto' : '100vh', background: inIframe ? '#fff' : '#F8F4F0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, gap: 12, padding: 24 }}>
        <div style={{ fontSize: 48, fontFamily: SERIF, color: '#C9697A', fontWeight: 400 }}>404</div>
        <div style={{ fontSize: 18, fontWeight: 600, color: '#1C1012' }}>Boutique not found</div>
        <div style={{ fontSize: 14, color: '#6B7280', textAlign: 'center' }}>This link may be invalid or expired. Please contact the boutique directly.</div>
      </div>
    )
  }

  // ── Thank you screen ─────────────────────────────────────────────────────────
  if (submitted) {
    // In iframe: compact success with no outer wrapper padding so the modal uses full height
    if (inIframe) {
      return (
        <div style={{ background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, padding: '40px 24px', textAlign: 'center', minHeight: 400 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: accentLight, border: `2px solid ${accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 24 }}>
            ✓
          </div>
          <div style={{ fontSize: 22, fontFamily: SERIF, color: accent, fontWeight: 700, marginBottom: 10 }}>
            Thank you!
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#1C1012', marginBottom: 8 }}>
            {boutique.name} will be in touch soon.
          </div>
          <div style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6, maxWidth: 320 }}>
            We've received your inquiry and will reach out within 24–48 hours.
          </div>
        </div>
      )
    }
    return (
      <div style={{ minHeight: '100vh', background: accentLight, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, padding: 24 }}>
        <div style={{ background: '#fff', borderRadius: 20, padding: '48px 40px', maxWidth: 480, width: '100%', textAlign: 'center', boxShadow: '0 8px 40px rgba(0,0,0,0.08)' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: accentLight, border: `2px solid ${accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 28 }}>
            ✓
          </div>
          <div style={{ fontSize: 28, fontFamily: SERIF, color: accent, fontWeight: 700, marginBottom: 12 }}>
            Thank you!
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#1C1012', marginBottom: 10 }}>
            {boutique.name} will be in touch soon.
          </div>
          <div style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.6 }}>
            We've received your inquiry and will reach out within 24–48 hours to discuss your event and next steps.
          </div>
          {boutique.booking_url && (
            <a href={boutique.booking_url} style={{ display: 'inline-block', marginTop: 24, padding: '10px 24px', background: accent, color: '#fff', borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
              Book an appointment
            </a>
          )}
        </div>
      </div>
    )
  }

  // ── Form ─────────────────────────────────────────────────────────────────────
  // When embedded in the widget iframe, strip outer padding/background and hide
  // the boutique name header (the modal already has a "Book a consultation" header).
  if (inIframe) {
    return (
      <div style={{ background: '#fff', fontFamily: FONT, padding: '0 0 16px' }}>
        {/* Accent bar */}
        <div style={{ height: 4, background: `linear-gradient(90deg, ${accent}, ${darken(accent, 0.2)})` }} />
        <form onSubmit={handleSubmit} noValidate style={{ padding: '20px 20px 4px' }}>

          {/* Row 1: Name + Phone */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <LBL required>Full name</LBL>
              <input type="text" value={form.name} onChange={set('name')} onFocus={onFocus('name')} onBlur={onBlur}
                placeholder="Maria Garcia" autoComplete="name" style={inputStyle('name')} />
              {errors.name && <div style={{ fontSize: 11, color: '#B91C1C', marginTop: 4 }}>{errors.name}</div>}
            </div>
            <div>
              <LBL required>Phone</LBL>
              <input type="tel" value={form.phone} onChange={set('phone')} onFocus={onFocus('phone')} onBlur={onBlur}
                placeholder="(555) 000-0000" autoComplete="tel" style={inputStyle('phone')} />
              {errors.phone && <div style={{ fontSize: 11, color: '#B91C1C', marginTop: 4 }}>{errors.phone}</div>}
            </div>
          </div>

          {/* Email */}
          <div style={{ marginBottom: 12 }}>
            <LBL>Email</LBL>
            <input type="email" value={form.email} onChange={set('email')} onFocus={onFocus('email')} onBlur={onBlur}
              placeholder="maria@example.com" autoComplete="email" style={inputStyle('email')} />
          </div>

          {/* Row 2: Event type + Date */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <LBL>Event type</LBL>
              <select value={form.eventType} onChange={set('eventType')} onFocus={onFocus('eventType')} onBlur={onBlur}
                style={{ ...inputStyle('eventType'), cursor: 'pointer', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%236B7280' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}>
                {EVENT_TYPES.map(t => <option key={t.value} value={t.value} disabled={t.value === ''}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <LBL>Event date</LBL>
              <input type="date" value={form.eventDate} onChange={set('eventDate')} onFocus={onFocus('eventDate')} onBlur={onBlur}
                style={inputStyle('eventDate')} />
            </div>
          </div>

          {/* Message */}
          <div style={{ marginBottom: 16 }}>
            <LBL>Message</LBL>
            <textarea value={form.message} onChange={set('message')} onFocus={onFocus('message')} onBlur={onBlur}
              placeholder="Tell us about your vision…" rows={3}
              style={{ ...inputStyle('message'), resize: 'none', minHeight: 72, lineHeight: 1.5 }} />
          </div>

          {errors.submit && (
            <div style={{ marginBottom: 12, padding: '10px 14px', background: '#FEE2E2', borderRadius: 8, fontSize: 13, color: '#B91C1C', border: '1px solid #FECACA' }}>
              {errors.submit}
            </div>
          )}

          <button type="submit" disabled={submitting}
            style={{ width: '100%', padding: '13px 24px', background: submitting ? '#D1D5DB' : accent, color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, fontFamily: FONT, cursor: submitting ? 'not-allowed' : 'pointer', letterSpacing: 0.3 }}
            onMouseEnter={e => { if (!submitting) e.currentTarget.style.background = accentDark }}
            onMouseLeave={e => { if (!submitting) e.currentTarget.style.background = accent }}>
            {submitting ? 'Sending…' : 'Send my inquiry'}
          </button>

          <div style={{ textAlign: 'center', marginTop: 10, fontSize: 11, color: '#9CA3AF' }}>
            Your information is kept private and shared only with {boutique.name}.
          </div>
        </form>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: accentLight, fontFamily: FONT, padding: '32px 16px 64px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: accent, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10 }}>
            {boutique.name}
          </div>
          <h1 style={{ margin: 0, fontSize: 32, fontFamily: SERIF, color: '#1C1012', fontWeight: 700, lineHeight: 1.2, marginBottom: 10 }}>
            Tell us about your event
          </h1>
          <p style={{ margin: 0, fontSize: 15, color: '#6B7280', lineHeight: 1.6 }}>
            Fill out the form below and we'll reach out to discuss how we can make your special day unforgettable.
          </p>
        </div>

        {/* Card */}
        <div style={{ background: '#fff', borderRadius: 20, boxShadow: '0 4px 32px rgba(0,0,0,0.07)', overflow: 'hidden' }}>

          {/* Accent bar */}
          <div style={{ height: 5, background: `linear-gradient(90deg, ${accent}, ${darken(accent, 0.2)})` }} />

          <form onSubmit={handleSubmit} noValidate style={{ padding: '32px 32px 28px' }}>

            {/* Row 1: Name + Phone */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <LBL required>Full name</LBL>
                <input
                  type="text"
                  value={form.name}
                  onChange={set('name')}
                  onFocus={onFocus('name')}
                  onBlur={onBlur}
                  placeholder="Maria Garcia"
                  autoComplete="name"
                  style={inputStyle('name')}
                />
                {errors.name && <div style={{ fontSize: 11, color: '#B91C1C', marginTop: 4 }}>{errors.name}</div>}
              </div>
              <div>
                <LBL required>Phone number</LBL>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={set('phone')}
                  onFocus={onFocus('phone')}
                  onBlur={onBlur}
                  placeholder="(555) 000-0000"
                  autoComplete="tel"
                  style={inputStyle('phone')}
                />
                {errors.phone && <div style={{ fontSize: 11, color: '#B91C1C', marginTop: 4 }}>{errors.phone}</div>}
              </div>
            </div>

            {/* Email */}
            <div style={{ marginBottom: 16 }}>
              <LBL>Email address</LBL>
              <input
                type="email"
                value={form.email}
                onChange={set('email')}
                onFocus={onFocus('email')}
                onBlur={onBlur}
                placeholder="maria@example.com"
                autoComplete="email"
                style={inputStyle('email')}
              />
            </div>

            {/* Row 2: Event type + Date */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <LBL>Event type</LBL>
                <select
                  value={form.eventType}
                  onChange={set('eventType')}
                  onFocus={onFocus('eventType')}
                  onBlur={onBlur}
                  style={{ ...inputStyle('eventType'), cursor: 'pointer', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%236B7280' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
                >
                  {EVENT_TYPES.map(t => (
                    <option key={t.value} value={t.value} disabled={t.value === ''}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <LBL>Estimated event date</LBL>
                <input
                  type="date"
                  value={form.eventDate}
                  onChange={set('eventDate')}
                  onFocus={onFocus('eventDate')}
                  onBlur={onBlur}
                  style={inputStyle('eventDate')}
                />
              </div>
            </div>

            {/* Budget */}
            <div style={{ marginBottom: 16 }}>
              <LBL>Estimated budget</LBL>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: '#9CA3AF', pointerEvents: 'none', fontWeight: 500 }}>$</span>
                <input
                  type="number"
                  value={form.budget}
                  onChange={set('budget')}
                  onFocus={onFocus('budget')}
                  onBlur={onBlur}
                  placeholder="5,000"
                  min="0"
                  style={{ ...inputStyle('budget'), paddingLeft: 24 }}
                />
              </div>
            </div>

            {/* How did you hear about us */}
            <div style={{ marginBottom: 16 }}>
              <LBL>How did you hear about us?</LBL>
              <input
                type="text"
                value={form.heardAbout}
                onChange={set('heardAbout')}
                onFocus={onFocus('heardAbout')}
                onBlur={onBlur}
                placeholder="Instagram, friend referral, Google…"
                style={inputStyle('heardAbout')}
              />
            </div>

            {/* Message */}
            <div style={{ marginBottom: 24 }}>
              <LBL>Message / notes</LBL>
              <textarea
                value={form.message}
                onChange={set('message')}
                onFocus={onFocus('message')}
                onBlur={onBlur}
                placeholder="Tell us more about your vision, any specific services you're interested in, or questions you have…"
                rows={4}
                style={{ ...inputStyle('message'), resize: 'vertical', minHeight: 100, lineHeight: 1.5 }}
              />
            </div>

            {/* Submit error */}
            {errors.submit && (
              <div style={{ marginBottom: 16, padding: '10px 14px', background: '#FEE2E2', borderRadius: 8, fontSize: 13, color: '#B91C1C', border: '1px solid #FECACA' }}>
                {errors.submit}
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={submitting}
              style={{
                width: '100%',
                padding: '14px 24px',
                background: submitting ? '#D1D5DB' : accent,
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 700,
                fontFamily: FONT,
                cursor: submitting ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s, transform 0.1s',
                letterSpacing: 0.3,
              }}
              onMouseEnter={e => { if (!submitting) e.currentTarget.style.background = accentDark }}
              onMouseLeave={e => { if (!submitting) e.currentTarget.style.background = accent }}
            >
              {submitting ? 'Sending…' : 'Send my inquiry'}
            </button>

            <div style={{ textAlign: 'center', marginTop: 14, fontSize: 11, color: '#9CA3AF' }}>
              Your information is kept private and will only be shared with {boutique.name}.
            </div>
          </form>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: 28, fontSize: 12, color: '#9CA3AF' }}>
          Powered by Belori
        </div>
      </div>
    </div>
  )
}
