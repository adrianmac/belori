import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate, Link } from 'react-router-dom'
import { sendInngestEvent } from '../lib/inngest'
import { supabase } from '../lib/supabase'

const C = {
  rosa: '#C9697A', rosaHov: '#B85868', rosaPale: '#FDF5F6', rosaText: '#8B3A4A',
  ink: '#1C1012', gray: '#6B7280', border: '#E5E7EB',
  white: '#FFFFFF', ivory: '#F8F4F0', red: '#B91C1C', redBg: '#FEE2E2',
  green: '#15803D', greenBg: '#DCFCE7',
}

export default function Signup() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [boutiqueName, setBoutiqueName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    setLoading(true)

    // Check if email is already registered
    const { data: emailExists, error: checkError } = await supabase.rpc('check_email_exists', { p_email: email.trim().toLowerCase() })
    if (checkError) { setError('Unable to verify email. Please try again.'); setLoading(false); return }
    if (emailExists) { setError('An account with this email already exists.'); setLoading(false); return }

    // Check if boutique name is already taken
    const { data: nameExists, error: nameError } = await supabase.rpc('check_boutique_name_exists', { p_name: boutiqueName.trim() })
    if (nameError) { setError('Unable to verify boutique name. Please try again.'); setLoading(false); return }
    if (nameExists) { setError('A boutique with this name already exists. Please choose a different name.'); setLoading(false); return }

    const { error } = await signUp(email, password, boutiqueName)
    setLoading(false)
    if (error) { setError(error.message); return }
    // Fire onboarding email sequence (fire-and-forget)
    sendInngestEvent('belori/boutique.created', { owner_email: email, boutique_name: boutiqueName })
    setSuccess(true)
  }

  if (success) {
    return (
      <div style={{ minHeight: '100vh', background: '#F8F4F0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '-apple-system,BlinkMacSystemFont,"Inter","Segoe UI",sans-serif' }}>
        <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: 36, maxWidth: 400, textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🎉</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: C.ink, marginBottom: 8 }}>Check your email</div>
          <div style={{ fontSize: 14, color: C.gray, lineHeight: 1.6 }}>
            We sent a confirmation link to <strong>{email}</strong>.<br />
            Click it to activate your account and sign in.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F8F4F0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '-apple-system,BlinkMacSystemFont,"Inter","Segoe UI",sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 420, padding: '0 16px' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 48, height: 48, background: C.ink, borderRadius: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <svg viewBox="0 0 32 32" fill="none" style={{ width: 28, height: 28 }}>
              <path d="M7 25V7l18 18V7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div style={{ fontSize: 22, fontWeight: 600, color: C.ink }}>Start your free trial</div>
          <div style={{ fontSize: 13, color: C.gray, marginTop: 4 }}>Set up your boutique in 60 seconds</div>
        </div>

        <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: 28 }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {error && (
              <div style={{ background: C.redBg, color: C.red, padding: '10px 14px', borderRadius: 8, fontSize: 13 }}>
                {error}
                {error.includes('already exists') && (
                  <span> <Link to="/login" style={{ color: C.red, fontWeight: 600 }}>Sign in instead →</Link></span>
                )}
              </div>
            )}
            <div>
              <label htmlFor="signup-boutique" style={{ fontSize: 12, fontWeight: 500, color: C.ink, display: 'block', marginBottom: 6 }}>Boutique name</label>
              <input
                id="signup-boutique" type="text" value={boutiqueName} onChange={e => setBoutiqueName(e.target.value)} required autoComplete="organization"
                placeholder="e.g. Bella Bridal & Events"
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 14, color: C.ink, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label htmlFor="signup-email" style={{ fontSize: 12, fontWeight: 500, color: C.ink, display: 'block', marginBottom: 6 }}>Email</label>
              <input
                id="signup-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email"
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 14, color: C.ink, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label htmlFor="signup-password" style={{ fontSize: 12, fontWeight: 500, color: C.ink, display: 'block', marginBottom: 6 }}>Password</label>
              <input
                id="signup-password" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} autoComplete="new-password"
                placeholder="At least 8 characters"
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 14, color: C.ink, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <button
              type="submit" disabled={loading}
              style={{ background: loading ? C.gray : C.rosa, color: C.white, border: 'none', borderRadius: 8, padding: '11px', fontSize: 14, fontWeight: 500, cursor: loading ? 'default' : 'pointer', marginTop: 4 }}>
              {loading ? 'Creating account…' : 'Create your boutique →'}
            </button>
          </form>
          <div style={{ textAlign: 'center', marginTop: 18, fontSize: 13, color: C.gray }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: C.rosaText, fontWeight: 500, textDecoration: 'none' }}>Sign in</Link>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 11, color: C.gray }}>
          14-day free trial · No credit card required
        </div>
      </div>
    </div>
  )
}
