import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import {
  D, injectCoutureFonts, forceLightTheme, OrnamentRule, Wordmark,
  coutureInput, couturePrimaryBtn, coutureLabel,
} from '../lib/couture.jsx'

const ROLE_LABELS = {
  owner: 'Owner', coordinator: 'Coordinator', front_desk: 'Front Desk',
  seamstress: 'Seamstress', decorator: 'Decorator',
}

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

  useEffect(() => { injectCoutureFonts(); forceLightTheme() }, [])

  // ── 1. Load invite details ─────────────────────────────────────────────
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

  // ── 2. When session arrives, accept invite ─────────────────────────────
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

  async function handleAuth(e) {
    e.preventDefault()
    setAuthError('')
    setAuthLoading(true)

    if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.href,
          data: { full_name: name.trim() || undefined },
        },
      })
      if (error) { setAuthError(error.message); setAuthLoading(false); return }
      if (!data.session) { setMode('check_email'); setAuthLoading(false) }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setAuthError(error.message); setAuthLoading(false) }
    }
  }

  // ── Loading state ──────────────────────────────────────────────────────
  if (inviteLoading) {
    return (
      <Centered>
        <CoutureSpinner text="Fetching your invitation…" />
      </Centered>
    )
  }

  // ── Invalid / expired invite ───────────────────────────────────────────
  if (inviteError) return (
    <Centered>
      <div className="couture-fade-up" style={{
        background: D.cardWarm, border: `1px solid ${D.border}`,
        padding: '44px 40px', maxWidth: 440, width: '100%', textAlign: 'center',
        boxShadow: D.shadowLg,
      }}>
        <div style={{ height: 2, background: D.danger, opacity: 0.7, width: 40, margin: '0 auto 28px' }} />
        <div aria-hidden="true" style={{
          display:'flex', alignItems:'center', justifyContent:'center', gap: 10, marginBottom: 18, opacity: 0.75,
        }}>
          <span style={{ height: 1, width: 36, background: `linear-gradient(90deg, transparent, ${D.gold})` }} />
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 0l5 5-5 5-5-5 5-5z" fill={D.gold}/></svg>
          <span style={{ height: 1, width: 36, background: `linear-gradient(270deg, transparent, ${D.gold})` }} />
        </div>
        <h1 className="couture-serif-i" style={{
          fontSize: 28, color: D.ink, margin: 0, fontWeight: 400, fontStyle: 'italic',
        }}>
          This invitation can no longer be honored.
        </h1>
        <p style={{
          fontFamily: D.sans, fontSize: 13, color: D.inkMid,
          lineHeight: 1.65, marginTop: 16, maxWidth: 320, marginLeft: 'auto', marginRight: 'auto',
        }}>{inviteError}</p>
        <Link to="/login" className="couture-link" style={{
          display: 'inline-block', marginTop: 28,
          fontSize: 11, color: D.ink, fontWeight: 500,
          textTransform: 'uppercase', letterSpacing: '0.18em',
          padding: '12px 26px', border: `1px solid ${D.ink}`,
          textDecoration: 'none',
        }}>
          Return to sign in
        </Link>
      </div>
    </Centered>
  )

  // ── Accepting / working ────────────────────────────────────────────────
  if (mode === 'accepting') {
    return (
      <Centered>
        <CoutureSpinner text={`Joining ${invite?.boutique_name ?? 'your boutique'}…`} />
      </Centered>
    )
  }

  // ── Check email ────────────────────────────────────────────────────────
  if (mode === 'check_email') return (
    <Centered>
      <div className="couture-fade-up" style={{
        background: D.cardWarm, border: `1px solid ${D.border}`,
        padding: '44px 40px', maxWidth: 460, width: '100%', textAlign: 'center',
        boxShadow: D.shadowLg,
      }}>
        <div aria-hidden="true" style={{
          display: 'inline-flex', width: 54, height: 54, borderRadius: '50%',
          background: D.goldLight, color: D.goldDark,
          alignItems: 'center', justifyContent: 'center',
          border: `1px solid ${D.goldBorder}`, marginBottom: 18,
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="5" width="18" height="14" rx="1"/>
            <path d="M3 7l9 6 9-6"/>
          </svg>
        </div>
        <h1 className="couture-serif-i" style={{
          fontSize: 28, color: D.ink, margin: 0, fontWeight: 400, fontStyle: 'italic',
        }}>
          A confirmation has been sent.
        </h1>
        <OrnamentRule width={30} style={{ marginTop: 16, marginBottom: 18 }} />
        <p className="couture-serif" style={{
          fontSize: 15, color: D.inkMid, lineHeight: 1.65, fontWeight: 300,
        }}>
          We've sent a link to<br />
          <span style={{ color: D.ink, fontWeight: 500 }}>{email}</span>.<br />
          Follow it to complete joining <span className="couture-serif-i" style={{ color: D.ink, fontStyle: 'italic' }}>{invite.boutique_name}</span>.
        </p>
        <div style={{
          marginTop: 24,
          fontFamily: D.sans, fontSize: 12, color: D.inkMid,
          padding: '12px 16px', border: `1px solid ${D.border}`,
          background: D.bg,
        }}>
          No note in your inbox? Check spam, or{' '}
          <button onClick={() => setMode('signup')} className="couture-link" style={{
            background: 'none', border: 'none',
            color: D.goldDark, cursor: 'pointer',
            fontSize: 12, fontWeight: 500, padding: 0,
            textTransform: 'uppercase', letterSpacing: '0.12em',
          }}>
            send again
          </button>.
        </div>
      </div>
    </Centered>
  )

  // ── Main — accept invite form ──────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh',
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
      fontFamily: D.sans,
      background: D.bg,
      color: D.ink,
    }}>
      <style>{`
        @media (max-width: 860px) {
          .couture-invite-grid { grid-template-columns: 1fr !important; }
          .couture-invite-left { display: none !important; }
        }
      `}</style>

      {/* ─── LEFT — INVITATION CARD ──────────────────────────────────────── */}
      <aside className="couture-invite-left couture-grain" style={{
        position: 'relative',
        background: `linear-gradient(160deg, #F3EBDE 0%, ${D.bg} 50%, ${D.bgDeep} 100%)`,
        borderRight: `1px solid ${D.border}`,
        padding: '56px 56px 48px',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        overflow: 'hidden',
      }}>
        <header className="couture-smallcaps" style={{ color: D.gold, letterSpacing: '0.32em' }}>
          A personal invitation
        </header>

        <div className="couture-fade-up" style={{ maxWidth: 480 }}>
          <div className="couture-smallcaps" style={{ color: D.goldDark, marginBottom: 24, letterSpacing: '0.38em' }}>
            You are invited
          </div>
          <h1 className="couture-display" style={{
            fontSize: 'clamp(50px, 6.4vw, 86px)',
            lineHeight: 1.0,
            color: D.ink,
            margin: 0,
            fontWeight: 400,
          }}>
            Welcome to<br/>
            <span className="couture-serif-i" style={{ color: D.goldDark, fontStyle: 'italic' }}>
              {invite.boutique_name}
            </span>.
          </h1>
          <p className="couture-serif" style={{
            fontSize: 17, lineHeight: 1.65, color: D.inkMid,
            marginTop: 22, maxWidth: 400, fontStyle: 'italic', fontWeight: 300,
          }}>
            You've been invited to join as a{' '}
            <span style={{ color: D.ink, fontStyle: 'normal', fontFamily: D.sans,
              textTransform: 'uppercase', fontSize: 12, letterSpacing: '0.16em', fontWeight: 500 }}>
              {ROLE_LABELS[invite.role] || invite.role}
            </span>. Sign in if you already have an account — or create one in a moment.
          </p>

          {/* Invitation card block */}
          <div style={{
            marginTop: 36, padding: 20,
            background: D.cardWarm, border: `1px solid ${D.border}`,
            position: 'relative',
          }}>
            <div style={{
              position: 'absolute', top: 0, left: 0, height: 2, width: 40,
              background: D.gold,
            }} />
            <div className="couture-smallcaps" style={{ color: D.inkLight, marginBottom: 10, letterSpacing: '0.22em' }}>
              Invitation details
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <span className="couture-smallcaps" style={{ color: D.inkLight, fontSize: 9, minWidth: 56 }}>House</span>
                <span className="couture-serif-i" style={{ color: D.ink, fontSize: 16, fontStyle: 'italic' }}>{invite.boutique_name}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <span className="couture-smallcaps" style={{ color: D.inkLight, fontSize: 9, minWidth: 56 }}>Role</span>
                <span style={{ color: D.ink, fontFamily: D.sans, fontSize: 13, fontWeight: 500 }}>
                  {ROLE_LABELS[invite.role] || invite.role}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <span className="couture-smallcaps" style={{ color: D.inkLight, fontSize: 9, minWidth: 56 }}>Email</span>
                <span style={{ color: D.ink, fontFamily: D.sans, fontSize: 13 }}>{invite.email}</span>
              </div>
            </div>
          </div>
        </div>

        <footer className="couture-smallcaps" style={{ color: D.inkLight }}>
          By joining, you agree to the atelier's terms of service.
        </footer>
      </aside>

      {/* ─── RIGHT — AUTH FORM ───────────────────────────────────────────── */}
      <main style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '56px 32px', background: D.cardWarm,
      }}>
        <div style={{ width: '100%', maxWidth: 400 }}>
          <div className="couture-fade-up" style={{ textAlign: 'center', marginBottom: 32 }}>
            <Wordmark size={40} />
            <OrnamentRule width={28} style={{ marginTop: 18, marginBottom: 20 }} />
            <h2 className="couture-serif-i" style={{
              fontSize: 24, color: D.ink, margin: 0, fontWeight: 400, fontStyle: 'italic',
            }}>
              {mode === 'login' ? 'Welcome back.' : 'Open your account.'}
            </h2>
            <p style={{ fontSize: 13, color: D.inkMid, marginTop: 8 }}>
              {mode === 'login'
                ? 'Sign in to accept your invitation.'
                : 'Create an account to join the boutique.'}
            </p>
          </div>

          {/* Auth toggle — editorial tabs */}
          <div className="couture-fade-up couture-fade-up-1" style={{
            display: 'flex', marginBottom: 24,
            borderBottom: `1px solid ${D.border}`,
          }}>
            {[['login', 'Sign in'], ['signup', 'Create account']].map(([m, label]) => {
              const active = mode === m
              return (
                <button key={m} onClick={() => { setMode(m); setAuthError('') }}
                  style={{
                    flex: 1, padding: '12px 8px', border: 'none',
                    background: 'transparent',
                    color: active ? D.ink : D.inkLight,
                    fontFamily: D.sans,
                    fontSize: 10, fontWeight: active ? 600 : 500,
                    textTransform: 'uppercase', letterSpacing: '0.2em',
                    cursor: 'pointer',
                    borderBottom: active ? `2px solid ${D.gold}` : '2px solid transparent',
                    marginBottom: -1,
                    transition: 'all 0.2s cubic-bezier(.22,.61,.36,1)',
                  }}>
                  {label}
                </button>
              )
            })}
          </div>

          <form onSubmit={handleAuth} className="couture-fade-up couture-fade-up-2"
            style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {authError && (
              <div role="alert" style={{
                background: D.dangerBg, color: D.danger,
                padding: '12px 14px', borderLeft: `2px solid ${D.danger}`,
                fontSize: 13,
              }}>
                {authError}
              </div>
            )}

            {mode === 'signup' && (
              <div>
                <label style={coutureLabel}>Your name</label>
                <input value={name} onChange={e => setName(e.target.value)}
                  placeholder="Maria González"
                  className="couture-input" style={coutureInput} />
              </div>
            )}

            <div>
              <label style={coutureLabel}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                className="couture-input" style={coutureInput} />
            </div>

            <div>
              <label style={coutureLabel}>
                Password{mode === 'signup' && <span style={{ color: D.inkLight, textTransform: 'none', letterSpacing: 0, marginLeft: 6 }}>min. 8 characters</span>}
              </label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                minLength={mode === 'signup' ? 8 : undefined}
                className="couture-input" style={coutureInput} />
            </div>

            <button type="submit" disabled={authLoading}
              className="couture-primary-btn"
              style={{ ...couturePrimaryBtn, marginTop: 6 }}>
              {authLoading
                ? 'Please wait…'
                : mode === 'login'
                  ? 'Sign in & join'
                  : 'Create account & join'}
            </button>
          </form>

          <div className="couture-fade-up couture-fade-up-3" style={{ marginTop: 40, textAlign: 'center' }}>
            <OrnamentRule width={28} />
            <div className="couture-smallcaps" style={{ marginTop: 14, color: D.inkLight, letterSpacing: '0.3em' }}>
              An invitation to {invite.boutique_name}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────
function Centered({ children }) {
  useEffect(() => { injectCoutureFonts(); forceLightTheme() }, [])
  return (
    <div style={{
      minHeight: '100vh', background: D.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, fontFamily: D.sans,
    }}>
      {children}
    </div>
  )
}

function CoutureSpinner({ text }) {
  return (
    <div style={{ textAlign: 'center', color: D.inkMid }}>
      <div className="couture-display" style={{
        fontSize: 32, color: D.ink, letterSpacing: '0.02em',
        animation: 'coutureLoadPulse 2.4s ease-in-out infinite',
      }}>Belori</div>
      <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, opacity: 0.6 }}>
        <span style={{ height: 1, width: 36, background: `linear-gradient(90deg, transparent, ${D.gold})` }} />
        <svg width="6" height="6" viewBox="0 0 10 10" fill="none"><path d="M5 0l5 5-5 5-5-5 5-5z" fill={D.gold}/></svg>
        <span style={{ height: 1, width: 36, background: `linear-gradient(270deg, transparent, ${D.gold})` }} />
      </div>
      <div className="couture-smallcaps" style={{
        marginTop: 14, color: D.inkLight, letterSpacing: '0.28em',
      }}>{text}</div>
      <style>{`@keyframes coutureLoadPulse { 0%,100% { opacity: 1 } 50% { opacity: 0.55 } }`}</style>
    </div>
  )
}
