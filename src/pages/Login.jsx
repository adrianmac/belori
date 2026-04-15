import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate, Link } from 'react-router-dom'

const C = {
  rosa: '#C9697A', rosaHov: '#B85868', rosaPale: '#FDF5F6', rosaText: '#8B3A4A',
  ink: '#1C1012', gray: '#6B7280', border: '#E5E7EB',
  white: '#FFFFFF', ivory: '#F8F4F0', red: '#B91C1C', redBg: '#FEE2E2',
}

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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
    <div style={{ minHeight: '100vh', background: C.ivory, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '-apple-system,BlinkMacSystemFont,"Inter","Segoe UI",sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 400, padding: '0 16px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 48, height: 48, background: C.ink, borderRadius: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <svg viewBox="0 0 32 32" fill="none" style={{ width: 28, height: 28 }}>
              <path d="M7 25V7l18 18V7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div style={{ fontSize: 22, fontWeight: 600, color: C.ink }}>Belori</div>
          <div style={{ fontSize: 13, color: C.gray, marginTop: 4 }}>Sign in to your boutique</div>
        </div>

        <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: 28 }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {error && (
              <div role="alert" aria-live="assertive" style={{ background: C.redBg, color: C.red, padding: '10px 14px', borderRadius: 8, fontSize: 13 }}>
                {error}
              </div>
            )}
            <div>
              <label htmlFor="login-email" style={{ fontSize: 12, fontWeight: 500, color: C.ink, display: 'block', marginBottom: 6 }}>Email</label>
              <input
                id="login-email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 14, color: C.ink, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label htmlFor="login-password" style={{ fontSize: 12, fontWeight: 500, color: C.ink, display: 'block', marginBottom: 6 }}>Password</label>
              <input
                id="login-password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 14, color: C.ink, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Link to="/forgot-password" style={{ fontSize: 12, color: C.gray, textDecoration: 'none' }}
                onMouseEnter={e => e.target.style.color = C.rosaText}
                onMouseLeave={e => e.target.style.color = C.gray}>
                Forgot password?
              </Link>
            </div>
            <button
              type="submit" disabled={loading}
              style={{ background: loading ? C.gray : C.rosaSolid, color: C.white, border: 'none', borderRadius: 8, padding: '11px', fontSize: 14, fontWeight: 500, cursor: loading ? 'default' : 'pointer', marginTop: 4 }}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
          <div style={{ textAlign: 'center', marginTop: 18, fontSize: 13, color: C.gray }}>
            Don't have an account?{' '}
            <Link to="/signup" style={{ color: C.rosaText, fontWeight: 500, textDecoration: 'none' }}>Create one</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
