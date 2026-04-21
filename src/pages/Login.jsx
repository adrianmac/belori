import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate, Link } from 'react-router-dom'
import {
  D, injectCoutureFonts, forceLightTheme, OrnamentRule, Wordmark,
  coutureInput, couturePrimaryBtn, coutureLabel,
} from '../lib/couture.jsx'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => { injectCoutureFonts(); forceLightTheme() }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await signIn(email, password)
    setLoading(false)
    if (error) setError(error.message)
    else navigate('/dashboard')
  }

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
          .couture-auth-grid { grid-template-columns: 1fr !important; }
          .couture-auth-left { display: none !important; }
        }
      `}</style>

      {/* ─── LEFT — EDITORIAL COVER ───────────────────────────────────────── */}
      <aside className="couture-auth-left couture-grain" style={{
        position: 'relative',
        background: `linear-gradient(155deg, #F3EBDE 0%, ${D.bg} 45%, ${D.bgDeep} 100%)`,
        borderRight: `1px solid ${D.border}`,
        padding: '56px 56px 48px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        overflow: 'hidden',
      }}>
        {/* Top — folio mark */}
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="couture-smallcaps" style={{ color: D.gold, letterSpacing: '0.32em' }}>
            Belori &nbsp;·&nbsp; Atelier
          </div>
          <div className="couture-smallcaps" style={{ color: D.inkLight, letterSpacing: '0.3em' }}>
            Est. MMXXVI
          </div>
        </header>

        {/* Middle — hero typography */}
        <div className="couture-fade-up" style={{ maxWidth: 520 }}>
          <div className="couture-smallcaps" style={{ color: D.goldDark, marginBottom: 28, letterSpacing: '0.38em' }}>
            Volume I
          </div>
          <h1 className="couture-display" style={{
            fontSize: 'clamp(56px, 7.2vw, 96px)',
            lineHeight: 0.96,
            color: D.ink,
            margin: 0,
            fontWeight: 400,
          }}>
            The quiet<br />
            <span className="couture-serif-i" style={{ color: D.goldDark, fontStyle: 'italic' }}>
              language
            </span><br />
            of ceremony.
          </h1>
          <p className="couture-serif" style={{
            fontSize: 18,
            lineHeight: 1.6,
            color: D.inkMid,
            marginTop: 28,
            maxWidth: 420,
            fontStyle: 'italic',
            fontWeight: 300,
          }}>
            A studio for the boutique that measures its days in fittings, flowers, and the
            grace of every bride who walks out the door.
          </p>
        </div>

        {/* Bottom — masthead credits */}
        <footer style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          paddingTop: 32,
          borderTop: `1px solid ${D.inkHair}`,
        }}>
          <div>
            <div className="couture-smallcaps" style={{ color: D.inkLight }}>Issue No.</div>
            <div className="couture-display" style={{ fontSize: 28, color: D.ink, lineHeight: 1, marginTop: 4 }}>
              07
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="couture-smallcaps" style={{ color: D.inkLight }}>For the trade</div>
            <div className="couture-serif-i" style={{ color: D.inkMid, fontSize: 14, marginTop: 4, fontStyle: 'italic' }}>
              bridal · quinceañera · soirée
            </div>
          </div>
        </footer>

        {/* Subtle watermark fleuron */}
        <svg width="420" height="420" viewBox="0 0 200 200" fill="none" aria-hidden="true"
          style={{ position: 'absolute', right: -120, top: '30%', opacity: 0.05, color: D.ink, pointerEvents: 'none' }}>
          <path d="M100 20c0 30 20 50 50 50-30 0-50 20-50 50 0-30-20-50-50-50 30 0 50-20 50-50z"
            fill="currentColor"/>
          <circle cx="100" cy="100" r="3" fill="currentColor"/>
        </svg>
      </aside>

      {/* ─── RIGHT — SIGN IN ───────────────────────────────────────────────── */}
      <main className="couture-auth-grid" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '56px 32px',
        background: D.cardWarm,
      }}>
        <div style={{ width: '100%', maxWidth: 400 }}>
          <div className="couture-fade-up" style={{ textAlign: 'center', marginBottom: 36 }}>
            <Wordmark size={44} />
            <OrnamentRule width={28} style={{ marginTop: 18, marginBottom: 20 }} />
            <h2 className="couture-serif-i" style={{
              fontSize: 26,
              color: D.ink,
              margin: 0,
              fontWeight: 400,
              fontStyle: 'italic',
              letterSpacing: '0.005em',
            }}>
              Bienvenue.
            </h2>
            <p style={{
              fontSize: 13,
              color: D.inkMid,
              marginTop: 8,
              fontFamily: D.sans,
            }}>
              Sign in to your atelier.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="couture-fade-up couture-fade-up-2"
            style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {error && (
              <div role="alert" aria-live="assertive" data-testid="login-error" style={{
                background: D.dangerBg,
                color: D.danger,
                padding: '12px 14px',
                borderLeft: `2px solid ${D.danger}`,
                fontSize: 13,
                fontFamily: D.sans,
              }}>
                {error}
              </div>
            )}

            <div>
              <label htmlFor="login-email" style={coutureLabel}>Email</label>
              <input
                id="login-email" type="email" autoComplete="email"
                value={email} onChange={e => setEmail(e.target.value)} required
                className="couture-input"
                style={coutureInput}
                data-testid="login-email"
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <label htmlFor="login-password" style={coutureLabel}>Password</label>
                <Link to="/forgot-password" className="couture-link" style={{
                  fontSize: 11, fontFamily: D.sans, color: D.inkMid,
                  textTransform: 'uppercase', letterSpacing: '0.14em',
                }}>
                  Forgot?
                </Link>
              </div>
              <input
                id="login-password" type="password" autoComplete="current-password"
                value={password} onChange={e => setPassword(e.target.value)} required
                className="couture-input"
                style={coutureInput}
                data-testid="login-password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="couture-primary-btn"
              style={{ ...couturePrimaryBtn, marginTop: 8 }}
              data-testid="login-submit"
            >
              {loading ? 'Entering…' : 'Enter the Atelier'}
            </button>
          </form>

          <div className="couture-fade-up couture-fade-up-3" style={{
            textAlign: 'center', marginTop: 28,
            fontSize: 13, color: D.inkMid, fontFamily: D.sans,
          }}>
            New here?{' '}
            <Link to="/signup" className="couture-link" style={{
              color: D.ink, fontWeight: 500,
            }}>
              Open an account
            </Link>
          </div>

          <div className="couture-fade-up couture-fade-up-4" style={{
            marginTop: 56,
            textAlign: 'center',
          }}>
            <OrnamentRule width={40} />
            <div className="couture-smallcaps" style={{
              marginTop: 14, color: D.inkLight, letterSpacing: '0.3em',
            }}>
              Crafted for the boutique
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
