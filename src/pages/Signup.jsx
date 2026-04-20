import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate, Link } from 'react-router-dom'
import { sendInngestEvent } from '../lib/inngest'
import { supabase } from '../lib/supabase'
import {
  D, injectCoutureFonts, forceLightTheme, OrnamentRule, Wordmark,
  coutureInput, couturePrimaryBtn, coutureLabel,
} from '../lib/couture.jsx'

export default function Signup() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [boutiqueName, setBoutiqueName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => { injectCoutureFonts(); forceLightTheme() }, [])

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
      <div style={{
        minHeight: '100vh', background: D.bg, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        fontFamily: D.sans, padding: 24,
      }}>
        <div className="couture-fade-up" style={{
          background: D.cardWarm,
          border: `1px solid ${D.border}`,
          padding: '56px 44px',
          maxWidth: 460,
          width: '100%',
          textAlign: 'center',
          boxShadow: D.shadowLg,
        }}>
          <div style={{ display: 'inline-flex', width: 56, height: 56, borderRadius: '50%',
            background: D.goldLight, color: D.goldDark, alignItems: 'center', justifyContent: 'center',
            border: `1px solid ${D.goldBorder}`, marginBottom: 20,
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z"/>
            </svg>
          </div>
          <h1 className="couture-serif-i" style={{
            fontSize: 32, color: D.ink, margin: 0, fontWeight: 400, fontStyle: 'italic',
          }}>
            Your invitation awaits.
          </h1>
          <OrnamentRule width={30} style={{ marginTop: 18, marginBottom: 20 }} />
          <p className="couture-serif" style={{
            fontSize: 16, color: D.inkMid, lineHeight: 1.65, fontWeight: 300,
          }}>
            We've dispatched a confirmation to<br />
            <span style={{ color: D.ink, fontWeight: 500 }}>{email}</span>.<br />
            Follow the link to open your atelier.
          </p>
        </div>
      </div>
    )
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

      {/* ─── LEFT — MANIFESTO ──────────────────────────────────────────────── */}
      <aside className="couture-auth-left couture-grain" style={{
        position: 'relative',
        background: `linear-gradient(155deg, ${D.bgDeep} 0%, ${D.bg} 55%, #F6EFE4 100%)`,
        borderRight: `1px solid ${D.border}`,
        padding: '56px 56px 48px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        overflow: 'hidden',
      }}>
        <header className="couture-smallcaps" style={{ color: D.gold, letterSpacing: '0.32em' }}>
          Belori &nbsp;·&nbsp; For the boutique
        </header>

        <div className="couture-fade-up" style={{ maxWidth: 520 }}>
          <div className="couture-smallcaps" style={{ color: D.goldDark, marginBottom: 24, letterSpacing: '0.38em' }}>
            Open your atelier
          </div>
          <h1 className="couture-display" style={{
            fontSize: 'clamp(54px, 6.6vw, 84px)',
            lineHeight: 1.0,
            color: D.ink,
            margin: 0,
            fontWeight: 400,
          }}>
            Every gown has<br />
            <span className="couture-serif-i" style={{ color: D.goldDark, fontStyle: 'italic' }}>
              a story.
            </span>
          </h1>
          <p className="couture-serif" style={{
            fontSize: 18, lineHeight: 1.6, color: D.inkMid,
            marginTop: 24, maxWidth: 420, fontStyle: 'italic', fontWeight: 300,
          }}>
            Begin yours with Belori — a quietly luminous software for the shops
            that dress the most important days in a person's life.
          </p>

          {/* Editorial feature trio */}
          <div style={{ marginTop: 40, display: 'flex', flexDirection: 'column', gap: 18 }}>
            {[
              { kicker: 'I', title: 'A ledger for every bride', body: 'Events, fittings, alterations, and milestones — kept in one calm place.' },
              { kicker: 'II', title: 'An atelier that remembers', body: 'Notes, photographs, measurements, and preferences follow each guest.' },
              { kicker: 'III', title: 'A boutique that runs itself', body: 'Quiet automations remind, confirm, and close the loop — so you can create.' },
            ].map((f, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'flex-start', gap: 20,
                paddingTop: 14, borderTop: `1px solid ${D.inkHair}`,
              }}>
                <div className="couture-display" style={{
                  fontSize: 28, color: D.goldDark, lineHeight: 1, minWidth: 32,
                }}>{f.kicker}</div>
                <div>
                  <div className="couture-serif" style={{ fontSize: 16, color: D.ink, fontWeight: 500, marginBottom: 2 }}>
                    {f.title}
                  </div>
                  <div style={{ fontSize: 13, color: D.inkMid, fontFamily: D.sans, lineHeight: 1.5 }}>
                    {f.body}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <footer style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'flex-end', paddingTop: 24,
        }}>
          <div className="couture-smallcaps" style={{ color: D.inkLight }}>
            No card required
          </div>
          <div className="couture-smallcaps" style={{ color: D.inkLight }}>
            14 days complimentary
          </div>
        </footer>
      </aside>

      {/* ─── RIGHT — FORM ─────────────────────────────────────────────────── */}
      <main style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '56px 32px', background: D.cardWarm,
      }}>
        <div style={{ width: '100%', maxWidth: 420 }}>
          <div className="couture-fade-up" style={{ textAlign: 'center', marginBottom: 36 }}>
            <Wordmark size={40} />
            <OrnamentRule width={28} style={{ marginTop: 18, marginBottom: 20 }} />
            <h2 className="couture-serif-i" style={{
              fontSize: 24, color: D.ink, margin: 0, fontWeight: 400, fontStyle: 'italic',
            }}>
              Open your atelier.
            </h2>
            <p style={{ fontSize: 13, color: D.inkMid, marginTop: 8, fontFamily: D.sans }}>
              Sixty seconds. Then we'll send a welcome note.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="couture-fade-up couture-fade-up-2"
            style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

            {error && (
              <div role="alert" style={{
                background: D.dangerBg, color: D.danger,
                padding: '12px 14px', borderLeft: `2px solid ${D.danger}`,
                fontSize: 13, fontFamily: D.sans,
              }}>
                {error}
                {error.includes('already exists') && (
                  <span> <Link to="/login" className="couture-link" style={{ color: D.danger, fontWeight: 600 }}>Sign in instead</Link></span>
                )}
              </div>
            )}

            <div>
              <label htmlFor="signup-boutique" style={coutureLabel}>Boutique name</label>
              <input
                id="signup-boutique" type="text" value={boutiqueName}
                onChange={e => setBoutiqueName(e.target.value)} required autoComplete="organization"
                placeholder="Bella Bridal & Events"
                className="couture-input" style={coutureInput}
              />
            </div>
            <div>
              <label htmlFor="signup-email" style={coutureLabel}>Email</label>
              <input
                id="signup-email" type="email" value={email}
                onChange={e => setEmail(e.target.value)} required autoComplete="email"
                className="couture-input" style={coutureInput}
              />
            </div>
            <div>
              <label htmlFor="signup-password" style={coutureLabel}>Password</label>
              <input
                id="signup-password" type="password" value={password}
                onChange={e => setPassword(e.target.value)} required minLength={8} autoComplete="new-password"
                placeholder="At least 8 characters"
                className="couture-input" style={coutureInput}
              />
            </div>

            <button
              type="submit" disabled={loading}
              className="couture-primary-btn"
              style={{ ...couturePrimaryBtn, marginTop: 10 }}
            >
              {loading ? 'Opening…' : 'Open the Atelier'}
            </button>
          </form>

          <div className="couture-fade-up couture-fade-up-3" style={{
            textAlign: 'center', marginTop: 26,
            fontSize: 13, color: D.inkMid, fontFamily: D.sans,
          }}>
            Already have an account?{' '}
            <Link to="/login" className="couture-link" style={{ color: D.ink, fontWeight: 500 }}>
              Sign in
            </Link>
          </div>

          <div className="couture-fade-up couture-fade-up-4" style={{ marginTop: 44, textAlign: 'center' }}>
            <OrnamentRule width={30} />
            <div className="couture-smallcaps" style={{ marginTop: 14, color: D.inkLight, letterSpacing: '0.3em' }}>
              14 days · no card required
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
