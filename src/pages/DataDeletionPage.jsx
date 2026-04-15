import React, { useState } from 'react'
import { supabase } from '../lib/supabase'

const FONT = '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif'
const SERIF = '"Playfair Display", Georgia, serif'

const C = {
  rosa:     '#C9697A',
  rosaPale: '#FDF2F4',
  rosaText: '#8B3A4A',
  ink:      '#1C1012',
  gray:     '#6B7280',
  white:    '#FFFFFF',
  border:   '#E5E7EB',
}

const inputSt = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 8,
  border: `1.5px solid ${C.border}`,
  fontSize: 14,
  color: C.ink,
  fontFamily: FONT,
  outline: 'none',
  background: C.white,
  boxSizing: 'border-box',
}

function LBL({ children, required }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 600, color: '#4A2030', marginBottom: 5, letterSpacing: 0.2 }}>
      {children}{required && <span style={{ color: C.rosaText, marginLeft: 2 }}>*</span>}
    </div>
  )
}

const DATA_ITEMS = [
  'Your name, email address, and phone number',
  'Any event or appointment history associated with your account',
  'Photos, notes, and preferences stored on your behalf',
  'Payment history records',
  'All communications and interaction logs',
]

export default function DataDeletionPage() {
  const [step, setStep]           = useState(1) // 1=form, 2=confirm, 3=done
  const [email, setEmail]         = useState('')
  const [name, setName]           = useState('')
  const [reason, setReason]       = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]         = useState('')

  const handleNext = (e) => {
    e.preventDefault()
    if (!email.trim()) { setError('Email address is required.'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Please enter a valid email address.'); return }
    setError('')
    setStep(2)
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setError('')
    const { error: dbError } = await supabase
      .from('data_deletion_requests')
      .insert({ email: email.trim().toLowerCase(), name: name.trim() || null, reason: reason.trim() || null })
    setSubmitting(false)
    if (dbError) {
      setError('Something went wrong. Please try again or contact us directly.')
      return
    }
    setStep(3)
  }

  return (
    <div style={{ minHeight: '100vh', background: C.rosaPale, fontFamily: FONT, padding: '40px 16px 80px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <a href="/" style={{ display: 'inline-block', marginBottom: 20 }}>
            <div style={{ fontSize: 28, fontFamily: SERIF, color: C.rosa, fontWeight: 700, letterSpacing: -0.5 }}>Belori</div>
          </a>
          <h1 style={{ margin: '0 0 10px', fontSize: 26, fontFamily: SERIF, fontWeight: 700, color: C.ink }}>
            Data Deletion Request
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: C.gray, lineHeight: 1.6 }}>
            You have the right to request deletion of your personal data under applicable privacy laws
            (GDPR, CCPA, and others). We will process your request within <strong>30 days</strong>.
          </p>
        </div>

        {/* Step indicators */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 28 }}>
          {[1, 2, 3].map((s, i) => (
            <React.Fragment key={s}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: step >= s ? C.rosa : C.border,
                color: step >= s ? C.white : C.gray,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, flexShrink: 0,
                transition: 'background 0.2s',
              }}>
                {step > s ? '✓' : s}
              </div>
              {i < 2 && <div style={{ height: 2, width: 40, background: step > s ? C.rosa : C.border, borderRadius: 2, transition: 'background 0.2s' }} />}
            </React.Fragment>
          ))}
        </div>

        <div style={{ background: C.white, borderRadius: 20, boxShadow: '0 4px 32px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
          <div style={{ height: 5, background: `linear-gradient(90deg, ${C.rosa}, #B05570)` }} />

          {/* ── Step 1: Form ── */}
          {step === 1 && (
            <form onSubmit={handleNext} noValidate style={{ padding: '28px 28px 24px' }}>
              <h2 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 700, color: C.ink }}>Your information</h2>
              <p style={{ margin: '0 0 20px', fontSize: 13, color: C.gray, lineHeight: 1.5 }}>
                Please provide the email address associated with your data so we can locate and process your request.
              </p>

              <div style={{ marginBottom: 16 }}>
                <LBL required>Email address</LBL>
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError('') }}
                  placeholder="you@example.com"
                  autoComplete="email"
                  style={{ ...inputSt, borderColor: error ? '#B91C1C' : C.border }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <LBL>Full name <span style={{ fontWeight: 400, color: C.gray }}>(optional)</span></LBL>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Maria Garcia"
                  autoComplete="name"
                  style={inputSt}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <LBL>Reason for deletion <span style={{ fontWeight: 400, color: C.gray }}>(optional)</span></LBL>
                <textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="You may optionally tell us why you are requesting deletion…"
                  rows={3}
                  style={{ ...inputSt, resize: 'vertical', lineHeight: 1.5 }}
                />
              </div>

              {error && (
                <div style={{ marginBottom: 16, padding: '10px 14px', background: '#FEE2E2', borderRadius: 8, fontSize: 13, color: '#B91C1C', border: '1px solid #FECACA' }}>
                  {error}
                </div>
              )}

              <button type="submit" style={{
                width: '100%', padding: '13px 24px', background: C.rosa,
                color: C.white, border: 'none', borderRadius: 10,
                fontSize: 15, fontWeight: 700, fontFamily: FONT, cursor: 'pointer', letterSpacing: 0.3,
              }}>
                Continue →
              </button>
            </form>
          )}

          {/* ── Step 2: Confirm ── */}
          {step === 2 && (
            <div style={{ padding: '28px 28px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{ fontSize: 28 }}>⚠️</div>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.ink }}>Confirm your request</h2>
              </div>

              <p style={{ margin: '0 0 6px', fontSize: 14, color: C.ink, lineHeight: 1.6 }}>
                You are requesting deletion of all data associated with:
              </p>
              <div style={{
                padding: '10px 14px', background: C.rosaPale, borderRadius: 8,
                marginBottom: 16, fontSize: 14, fontWeight: 600, color: C.rosaText,
                border: `1px solid #F0C4CB`,
              }}>
                {email}
                {name && <span style={{ fontWeight: 400, color: C.gray, marginLeft: 8 }}>({name})</span>}
              </div>

              <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 600, color: C.ink }}>
                This will permanently delete:
              </p>
              <ul style={{ margin: '0 0 20px', paddingLeft: 20 }}>
                {DATA_ITEMS.map(item => (
                  <li key={item} style={{ fontSize: 13, color: C.gray, lineHeight: 1.8 }}>{item}</li>
                ))}
              </ul>

              <div style={{
                padding: '12px 14px', background: '#FEF3C7', borderRadius: 8,
                border: '1px solid #FDE68A', marginBottom: 20,
                fontSize: 13, color: '#92400E', lineHeight: 1.5,
              }}>
                <strong>This action is irreversible.</strong> Once your data is deleted, it cannot be recovered.
                If you have an active appointment or event, please contact the boutique directly before submitting.
              </div>

              {error && (
                <div style={{ marginBottom: 16, padding: '10px 14px', background: '#FEE2E2', borderRadius: 8, fontSize: 13, color: '#B91C1C', border: '1px solid #FECACA' }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => { setStep(1); setError('') }}
                  style={{
                    flex: 1, padding: '12px 20px', background: C.white,
                    color: C.gray, border: `1.5px solid ${C.border}`,
                    borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: FONT, cursor: 'pointer',
                  }}
                >
                  ← Go back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  style={{
                    flex: 2, padding: '12px 20px',
                    background: submitting ? '#D1D5DB' : '#B91C1C',
                    color: C.white, border: 'none', borderRadius: 10,
                    fontSize: 14, fontWeight: 700, fontFamily: FONT,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  {submitting ? 'Submitting…' : 'Yes, delete my data'}
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Done ── */}
          {step === 3 && (
            <div style={{ padding: '40px 28px 36px', textAlign: 'center' }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: '#DCFCE7', border: '2px solid #16A34A',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 20px', fontSize: 28,
              }}>
                ✓
              </div>
              <h2 style={{ margin: '0 0 12px', fontSize: 20, fontFamily: SERIF, fontWeight: 700, color: C.ink }}>
                Request received
              </h2>
              <p style={{ margin: '0 0 16px', fontSize: 14, color: C.gray, lineHeight: 1.7, maxWidth: 380, marginLeft: 'auto', marginRight: 'auto' }}>
                Your data deletion request has been received. We will process it within{' '}
                <strong style={{ color: C.ink }}>30 days</strong> as required by applicable privacy laws.
              </p>
              <p style={{ margin: '0 0 24px', fontSize: 13, color: C.gray, lineHeight: 1.6 }}>
                A confirmation has been logged. If you have questions, please contact us at the boutique
                directly.
              </p>
              <a href="/" style={{
                display: 'inline-block', padding: '10px 24px',
                background: C.rosaPale, color: C.rosaText,
                borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none',
              }}>
                ← Back to home
              </a>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: 24, fontSize: 12, color: '#9CA3AF' }}>
          Powered by{' '}
          <a href="https://belori.app" target="_blank" rel="noopener noreferrer" style={{ color: C.rosaText, textDecoration: 'none' }}>
            Belori
          </a>
          {' '}· Your privacy matters to us
        </div>
      </div>
    </div>
  )
}
