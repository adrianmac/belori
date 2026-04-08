import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY
const PRIMARY = '#C9697A'
const ROSA_PALE = '#FDF5F6'

const QUESTIONS = [
  { id: 'ceremony_time',    label: 'What time does the ceremony start?', type: 'text', placeholder: 'e.g. 4:00 PM' },
  { id: 'reception_venue',  label: 'Reception venue name & address', type: 'text', placeholder: 'Venue name, city' },
  { id: 'guest_count',      label: 'Approximate number of guests', type: 'number', placeholder: '100' },
  { id: 'colors',           label: 'Your color palette / theme', type: 'text', placeholder: 'e.g. blush, ivory, sage' },
  { id: 'florals',          label: 'Floral preferences', type: 'text', placeholder: 'e.g. garden roses, peonies, eucalyptus' },
  { id: 'music_vibe',       label: 'Music vibe or genres you love', type: 'text', placeholder: 'e.g. classic Latin, pop, jazz' },
  { id: 'dietary',          label: 'Any dietary restrictions for your party?', type: 'textarea', placeholder: 'List any allergies or restrictions' },
  { id: 'bridal_party',     label: 'Bridal party size (bridesmaids / groomsmen)', type: 'text', placeholder: 'e.g. 4 bridesmaids, 4 groomsmen' },
  { id: 'photographer',     label: 'Photographer / videographer booked?', type: 'select', options: ['Not yet', 'Yes — photographer only', 'Yes — both', 'No — not planning to'] },
  { id: 'must_haves',       label: 'Top 3 must-haves for your big day', type: 'textarea', placeholder: 'What matters most to you?' },
  { id: 'concerns',         label: 'Anything you\'re worried about or want us to know?', type: 'textarea', placeholder: 'Share any concerns or special requests' },
]

export default function Questionnaire() {
  const { eventToken } = useParams()
  const [boutique, setBoutique]   = useState(null)
  const [eventData, setEventData] = useState(null)
  const [loading, setLoading]     = useState(true)
  const [notFound, setNotFound]   = useState(false)
  const [answers, setAnswers]     = useState({})
  const [name, setName]           = useState('')
  const [email, setEmail]         = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone]           = useState(false)
  const [error, setError]         = useState('')

  useEffect(() => {
    if (!eventToken) { setNotFound(true); setLoading(false); return }
    // Load event by portal_token
    fetch(`${SUPABASE_URL}/rest/v1/events?portal_token=eq.${eventToken}&select=id,boutique_id,type,event_date,venue,client:clients(name,email)`, {
      headers: { apikey: SUPABASE_ANON, Accept: 'application/json' },
    })
      .then(r => r.json())
      .then(async rows => {
        const ev = rows?.[0]
        if (!ev) { setNotFound(true); setLoading(false); return }
        setEventData(ev)
        if (ev.client?.name) setName(ev.client.name)
        if (ev.client?.email) setEmail(ev.client.email)

        // Load boutique name
        const br = await fetch(`${SUPABASE_URL}/rest/v1/boutiques?id=eq.${ev.boutique_id}&select=name,phone,instagram`, {
          headers: { apikey: SUPABASE_ANON, Accept: 'application/json' },
        })
        const boutiques = await br.json()
        if (boutiques?.[0]) setBoutique(boutiques[0])
        setLoading(false)
      })
      .catch(() => { setNotFound(true); setLoading(false) })
  }, [eventToken])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) { setError('Please enter your name'); return }
    setError('')
    setSubmitting(true)

    const res = await fetch(`${SUPABASE_URL}/rest/v1/questionnaire_submissions`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        boutique_id: eventData.boutique_id,
        event_id: eventData.id,
        client_name: name.trim(),
        client_email: email.trim() || null,
        answers,
      }),
    })

    if (res.ok || res.status === 201) {
      setDone(true)
    } else {
      setError('Could not submit. Please try again.')
    }
    setSubmitting(false)
  }

  const EVT = { wedding: 'Wedding 💍', quince: 'Quinceañera 👑', party: 'Party 🎉', other: 'Event 🎊' }

  if (loading) return (
    <div style={centered}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>✨</div>
      <div style={{ fontSize: 14, color: '#9CA3AF' }}>Loading your questionnaire…</div>
    </div>
  )

  if (notFound) return (
    <div style={centered}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#111', marginBottom: 8 }}>Questionnaire not found</div>
      <div style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.6 }}>This link is invalid or expired. Please contact your boutique.</div>
    </div>
  )

  if (done) return (
    <div style={centered}>
      <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 28 }}>🎉</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: '#111', marginBottom: 8 }}>Thank you, {name.split(' ')[0]}!</div>
      <div style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.7, maxWidth: 360, textAlign: 'center', marginBottom: 24 }}>
        Your answers have been sent to {boutique?.name || 'your boutique'}. They'll be in touch soon!
      </div>
      {boutique?.instagram && (
        <a href={`https://instagram.com/${boutique.instagram.replace('@','')}`} target="_blank" rel="noopener"
          style={{ fontSize: 13, color: PRIMARY, fontWeight: 500, textDecoration: 'none' }}>
          Follow us on Instagram →
        </a>
      )}
    </div>
  )

  const dateStr = eventData?.event_date
    ? new Date(eventData.event_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : null

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', fontFamily: 'Inter,system-ui,sans-serif', paddingBottom: 48 }}>
      {/* Header */}
      <div style={{ background: PRIMARY, padding: '20px 20px 32px' }}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
            {boutique?.name || 'Belori'}
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
            {EVT[eventData?.type] || 'Event'} Questionnaire
          </div>
          {dateStr && (
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>
              {dateStr}{eventData?.venue ? ` · ${eventData.venue}` : ''}
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 560, margin: '-16px auto 0', padding: '0 16px' }}>
        <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
          {/* Intro */}
          <div style={{ padding: '24px 24px 16px', borderBottom: '1px solid #F3F4F6' }}>
            <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.7 }}>
              Help us make your day perfect! This takes about 5 minutes. Your answers help us coordinate every detail with your vendors and team.
            </div>
          </div>

          <form onSubmit={handleSubmit} style={{ padding: '20px 24px' }}>
            {/* Name + email */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              <div>
                <label style={labelSt}>Your name *</label>
                <input value={name} onChange={e => setName(e.target.value)} required style={inputSt} placeholder="Full name" />
              </div>
              <div>
                <label style={labelSt}>Email (optional)</label>
                <input value={email} onChange={e => setEmail(e.target.value)} type="email" style={inputSt} placeholder="your@email.com" />
              </div>
            </div>

            {/* Questions */}
            {QUESTIONS.map(q => (
              <div key={q.id} style={{ marginBottom: 20 }}>
                <label style={labelSt}>{q.label}</label>
                {q.type === 'textarea' ? (
                  <textarea
                    value={answers[q.id] || ''}
                    onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))}
                    placeholder={q.placeholder}
                    rows={3}
                    style={{ ...inputSt, resize: 'vertical', minHeight: 80 }}
                  />
                ) : q.type === 'select' ? (
                  <select
                    value={answers[q.id] || ''}
                    onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))}
                    style={inputSt}
                  >
                    <option value="">Select…</option>
                    {q.options.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input
                    type={q.type}
                    value={answers[q.id] || ''}
                    onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))}
                    placeholder={q.placeholder}
                    style={inputSt}
                  />
                )}
              </div>
            ))}

            {error && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#DC2626' }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={submitting}
              style={{ width: '100%', padding: 16, borderRadius: 12, border: 'none', background: submitting ? '#D1D5DB' : PRIMARY, color: '#fff', fontSize: 15, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', marginTop: 4 }}>
              {submitting ? 'Submitting…' : '✓ Submit questionnaire'}
            </button>

            <div style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'center', marginTop: 12 }}>
              Your responses go directly to {boutique?.name || 'your boutique'} and are kept private.
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

const centered = {
  minHeight: '100vh', display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center',
  fontFamily: 'Inter,system-ui,sans-serif', padding: 24, textAlign: 'center',
  background: '#F9FAFB',
}
const labelSt = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }
const inputSt = {
  width: '100%', padding: '10px 12px', borderRadius: 9,
  border: '1.5px solid #E5E7EB', fontSize: 13, fontFamily: 'inherit',
  outline: 'none', boxSizing: 'border-box', color: '#111', background: '#fff',
}
