import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

const C = {
  rosa: '#C9697A', rosaPale: '#FDF5F6', rosaDeep: '#A84D5D',
  ink: '#1C1012', gray: '#6B7280', border: '#E5E7EB',
  white: '#FFFFFF', ivory: '#F8F4F0', red: '#B91C1C', redBg: '#FEE2E2',
  green: '#15803D', greenBg: '#DCFCE7', grayBg: '#F3F4F6',
}
const inp = { width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 14, color: C.ink, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }
const lbl = { fontSize: 12, fontWeight: 500, color: C.ink, display: 'block', marginBottom: 6 }

const ROLE_LABELS = { owner: 'Owner', coordinator: 'Coordinator', front_desk: 'Front Desk', seamstress: 'Seamstress', decorator: 'Decorator' }

export default function JoinInvite() {
  const { token } = useParams()
  const { session, reloadBoutique } = useAuth()
  const navigate = useNavigate()

  const [invite, setInvite] = useState(null)
  const [inviteLoading, setInviteLoading] = useState(true)
  const [inviteError, setInviteError] = useState('')

  // auth form state
  const [mode, setMode] = useState('login') // 'login' | 'signup' | 'check_email' | 'accepting'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)

  // ── 1. Load invite details ─────────────────────────────────────────────────
  useEffect(() => {
    supabase.rpc('get_invite_by_token', { p_token: token }).then(({ data, error }) => {
      if (error || !data || data.length === 0) {
        setInviteError('This invite link is invalid or has expired.')
      } else {
        const inv = data[0]
        if (!inv.is_valid) setInviteError('This invite link has expired or already been used.')
        else {
          setInvite(inv)
          setEmail(inv.email)
        }
      }
      setInviteLoading(false)
    })
  }, [token])

  // ── 2. When session arrives (login, or email-confirmed redirect), accept ───
  useEffect(() => {
    if (!session || !invite || mode === 'accepting') return
    setMode('accepting')
    acceptInvite()
  }, [session?.user?.id, invite?.token])

  async function acceptInvite() {
    setAuthLoading(true)
    setAuthError('')
    const { data, error } = await supabase.rpc('accept_invite', { p_token: token })
    if (error || data?.error) {
      setAuthError(error?.message || data?.error || 'Failed to accept invite')
      setAuthLoading(false)
      setMode('login')
      return
    }
    await reloadBoutique(session.user.id)
    navigate('/', { replace: true })
  }

  // ── 3. Handle auth form submit ─────────────────────────────────────────────
  async function handleAuth(e) {
    e.preventDefault()
    setAuthError('')
    setAuthLoading(true)

    if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // Redirect back to this exact URL after email confirmation
          // so the token is preserved and acceptInvite() fires automatically
          emailRedirectTo: window.location.href,
          data: { full_name: name.trim() || undefined },
        },
      })
      if (error) {
        setAuthError(error.message)
        setAuthLoading(false)
        return
      }
      if (!data.session) {
        // Email confirmation required — show waiting screen
        setMode('check_email')
        setAuthLoading(false)
      }
      // If data.session exists (email confirm disabled),
      // onAuthStateChange fires → useEffect above calls acceptInvite()
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setAuthError(error.message)
        setAuthLoading(false)
      }
      // On success: onAuthStateChange → session set → useEffect above fires
    }
  }

  // ── Screens ────────────────────────────────────────────────────────────────
  if (inviteLoading) return <Screen><Spinner text="Loading invite…" /></Screen>

  if (inviteError) return (
    <Screen>
      <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: 36, maxWidth: 400, textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>🔒</div>
        <div style={{ fontSize: 17, fontWeight: 600, color: C.ink, marginBottom: 8 }}>Invalid invite</div>
        <div style={{ fontSize: 13, color: C.gray, lineHeight: 1.6 }}>{inviteError}</div>
        <Link to="/login" style={{ display: 'inline-block', marginTop: 20, fontSize: 13, color: C.rosa, fontWeight: 500 }}>Go to login →</Link>
      </div>
    </Screen>
  )

  if (mode === 'accepting') return <Screen><Spinner text="Joining your boutique…" /></Screen>

  if (mode === 'check_email') return (
    <Screen>
      <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: 36, maxWidth: 420, textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>📧</div>
        <div style={{ fontSize: 17, fontWeight: 600, color: C.ink, marginBottom: 8 }}>Check your email</div>
        <div style={{ fontSize: 13, color: C.gray, lineHeight: 1.7, marginBottom: 20 }}>
          We sent a confirmation link to <strong style={{ color: C.ink }}>{email}</strong>.<br/>
          Click it to confirm your account — you'll be brought right back here to complete joining <strong style={{ color: C.ink }}>{invite.boutique_name}</strong>.
        </div>
        <div style={{ fontSize: 12, color: C.gray, padding: '12px 16px', borderRadius: 8, background: C.grayBg }}>
          Didn't receive it? Check your spam folder, or{' '}
          <button onClick={() => setMode('signup')} style={{ background: 'none', border: 'none', color: C.rosa, cursor: 'pointer', fontSize: 12, fontWeight: 500, padding: 0 }}>
            try again
          </button>.
        </div>
      </div>
    </Screen>
  )

  return (
    <Screen>
      <div style={{ width: '100%', maxWidth: 420, padding: '0 16px' }}>
        {/* Logo + headline */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 48, height: 48, background: C.ink, borderRadius: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <svg viewBox="0 0 32 32" fill="none" style={{ width: 28, height: 28 }}>
              <path d="M7 25V7l18 18V7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div style={{ fontSize: 20, fontWeight: 600, color: C.ink }}>You've been invited</div>
          <div style={{ fontSize: 13, color: C.gray, marginTop: 4 }}>
            Join <strong style={{ color: C.ink }}>{invite.boutique_name}</strong> as{' '}
            <strong style={{ color: C.ink }}>{ROLE_LABELS[invite.role] || invite.role}</strong>
          </div>
        </div>

        <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: 28, boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
          {/* Auth toggle */}
          <div style={{ display: 'flex', marginBottom: 20, borderRadius: 8, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
            {[['login', 'Sign in'], ['signup', 'Create account']].map(([m, label]) => (
              <button key={m} onClick={() => { setMode(m); setAuthError('') }}
                style={{ flex: 1, padding: '8px', border: 'none', background: mode === m ? C.rosaPale : 'transparent', color: mode === m ? C.rosa : C.gray, fontSize: 13, fontWeight: mode === m ? 600 : 400, cursor: 'pointer', transition: 'all 0.15s' }}>
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {authError && (
              <div style={{ background: C.redBg, color: C.red, padding: '10px 14px', borderRadius: 8, fontSize: 13, lineHeight: 1.5 }}>
                {authError}
              </div>
            )}

            {mode === 'signup' && (
              <div>
                <label style={lbl}>Your name</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Maria González" style={inp} />
              </div>
            )}

            <div>
              <label style={lbl}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required style={inp} />
            </div>

            <div>
              <label style={lbl}>
                Password{' '}
                {mode === 'signup' && <span style={{ fontWeight: 400, color: C.gray }}>(at least 8 characters)</span>}
              </label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={mode === 'signup' ? 8 : undefined} style={inp} />
            </div>

            <button type="submit" disabled={authLoading}
              style={{ background: authLoading ? C.gray : C.rosa, color: C.white, border: 'none', borderRadius: 8, padding: '11px', fontSize: 14, fontWeight: 500, cursor: authLoading ? 'default' : 'pointer', marginTop: 4, transition: 'background 0.15s' }}>
              {authLoading
                ? 'Please wait…'
                : mode === 'login'
                  ? 'Sign in & join boutique'
                  : 'Create account & join'}
            </button>
          </form>
        </div>

        {mode === 'login' && (
          <div style={{ textAlign: 'center', marginTop: 14, fontSize: 12, color: C.gray }}>
            Don't have an account?{' '}
            <button onClick={() => { setMode('signup'); setAuthError('') }}
              style={{ background: 'none', border: 'none', color: C.rosa, cursor: 'pointer', fontSize: 12, fontWeight: 500, padding: 0 }}>
              Create one
            </button>
          </div>
        )}
      </div>
    </Screen>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function Screen({ children }) {
  return (
    <div style={{ minHeight: '100vh', background: C.ivory, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '-apple-system,BlinkMacSystemFont,"Inter","Segoe UI",sans-serif' }}>
      {children}
    </div>
  )
}

function Spinner({ text }) {
  return (
    <div style={{ textAlign: 'center', color: C.gray }}>
      <div style={{ width: 32, height: 32, border: `3px solid ${C.border}`, borderTopColor: C.rosa, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ fontSize: 13 }}>{text}</div>
    </div>
  )
}
