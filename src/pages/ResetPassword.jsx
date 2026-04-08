import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate, Link } from 'react-router-dom'

const C = {
  rosa: '#C9697A', ink: '#1C1012', gray: '#6B7280', border: '#E5E7EB',
  white: '#FFFFFF', ivory: '#F8F4F0', red: '#B91C1C', redBg: '#FEE2E2',
}
const inp = { width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 14, color: C.ink, outline: 'none', boxSizing: 'border-box' }

export default function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)

  // Supabase puts the session in the URL hash when user clicks the reset link
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true)
      else setError('This reset link is invalid or has expired. Please request a new one.')
    })
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) { setError(error.message); return }
    navigate('/dashboard')
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

  return (
    <div style={{ minHeight: '100vh', background: C.ivory, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '-apple-system,BlinkMacSystemFont,"Inter","Segoe UI",sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 400, padding: '0 16px' }}>
        <Logo />
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 20, fontWeight: 600, color: C.ink }}>Set a new password</div>
          <div style={{ fontSize: 13, color: C.gray, marginTop: 4 }}>Choose a strong password for your account</div>
        </div>
        <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: 28 }}>
          {!ready ? (
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <div style={{ fontSize: 14, color: error ? C.red : C.gray, lineHeight: 1.6 }}>
                {error || 'Verifying reset link…'}
              </div>
              {error && (
                <Link to="/forgot-password" style={{ color: C.rosa, fontSize: 13, fontWeight: 500, textDecoration: 'none', marginTop: 16, display: 'block' }}>
                  Request a new link →
                </Link>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {error && (
                <div style={{ background: C.redBg, color: C.red, padding: '10px 14px', borderRadius: 8, fontSize: 13 }}>{error}</div>
              )}
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: C.ink, display: 'block', marginBottom: 6 }}>New password</label>
                <input
                  type="password" value={password} onChange={e => setPassword(e.target.value)} required autoFocus
                  placeholder="At least 8 characters"
                  style={inp}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: C.ink, display: 'block', marginBottom: 6 }}>Confirm password</label>
                <input
                  type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required
                  placeholder="Repeat your password"
                  style={inp}
                />
              </div>
              <button
                type="submit" disabled={loading}
                style={{ background: loading ? C.gray : C.rosa, color: C.white, border: 'none', borderRadius: 8, padding: '11px', fontSize: 14, fontWeight: 500, cursor: loading ? 'default' : 'pointer', marginTop: 4 }}>
                {loading ? 'Saving…' : 'Set new password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
