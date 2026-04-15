import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'

const C = {
  rosa: '#C9697A', rosaText: '#8B3A4A', ink: '#1C1012', gray: '#6B7280', border: '#E5E7EB',
  white: '#FFFFFF', ivory: '#F8F4F0', red: '#B91C1C', redBg: '#FEE2E2',
  green: '#15803D', greenBg: '#DCFCE7',
}
const inp = { width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 14, color: C.ink, outline: 'none', boxSizing: 'border-box' }

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    setSuccess(true)
  }

  const Logo = () => (
    <div style={{ textAlign: 'center', marginBottom: 32 }}>
      <div style={{ width: 48, height: 48, background: C.ink, borderRadius: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
        <svg viewBox="0 0 32 32" fill="none" style={{ width: 28, height: 28 }}>
          <path d="M7 25V7l18 18V7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div style={{ fontSize: 22, fontWeight: 600, color: C.ink }}>Belori</div>
    </div>
  )

  if (success) {
    return (
      <div style={{ minHeight: '100vh', background: C.ivory, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '-apple-system,BlinkMacSystemFont,"Inter","Segoe UI",sans-serif' }}>
        <div style={{ width: '100%', maxWidth: 400, padding: '0 16px' }}>
          <Logo />
          <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: 28, textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📬</div>
            <div style={{ fontSize: 17, fontWeight: 600, color: C.ink, marginBottom: 8 }}>Check your inbox</div>
            <div style={{ fontSize: 14, color: C.gray, lineHeight: 1.6, marginBottom: 20 }}>
              We sent a password reset link to <strong>{email}</strong>.<br />
              Click the link in the email to set a new password.
            </div>
            <Link to="/login" style={{ color: C.rosaText, fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>
              ← Back to sign in
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: C.ivory, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '-apple-system,BlinkMacSystemFont,"Inter","Segoe UI",sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 400, padding: '0 16px' }}>
        <Logo />
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 20, fontWeight: 600, color: C.ink }}>Forgot your password?</div>
          <div style={{ fontSize: 13, color: C.gray, marginTop: 4 }}>Enter your email and we'll send you a reset link</div>
        </div>
        <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: 28 }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {error && (
              <div style={{ background: C.redBg, color: C.red, padding: '10px 14px', borderRadius: 8, fontSize: 13 }}>{error}</div>
            )}
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: C.ink, display: 'block', marginBottom: 6 }}>Email</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus
                placeholder="you@yourboutique.com"
                style={inp}
              />
            </div>
            <button
              type="submit" disabled={loading}
              style={{ background: loading ? C.gray : C.rosa, color: C.white, border: 'none', borderRadius: 8, padding: '11px', fontSize: 14, fontWeight: 500, cursor: loading ? 'default' : 'pointer', marginTop: 4 }}>
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
          <div style={{ textAlign: 'center', marginTop: 18, fontSize: 13, color: C.gray }}>
            <Link to="/login" style={{ color: C.rosaText, fontWeight: 500, textDecoration: 'none' }}>← Back to sign in</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
