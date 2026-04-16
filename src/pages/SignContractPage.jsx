import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import DOMPurify from 'dompurify'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY

const PRIMARY = '#C9697A'
const ROSA_PALE = '#FDF5F6'

export default function SignContractPage() {
  const { token } = useParams()
  const navigate = useNavigate()
  const canvasRef = useRef(null)
  const [contract, setContract]     = useState(null)
  const [boutique, setBoutique]     = useState(null)
  const [loading, setLoading]       = useState(true)
  const [notFound, setNotFound]     = useState(false)
  const [step, setStep]             = useState('read')  // read | sign | done
  const [signerName, setSignerName] = useState('')
  const [isDrawing, setIsDrawing]   = useState(false)
  const [hasSig, setHasSig]         = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState('')

  useEffect(() => {
    if (!token) { setNotFound(true); setLoading(false); return }
    fetch(`${SUPABASE_URL}/functions/v1/get-contract?token=${token}`, {
      headers: { apikey: SUPABASE_ANON },
    })
      .then(r => r.json())
      .then(({ contract: c, error }) => {
        if (error || !c) { setNotFound(true) }
        else { setContract(c); setBoutique(c.boutique) }
        setLoading(false)
      })
      .catch(() => { setNotFound(true); setLoading(false) })
  }, [token])

  // ── Canvas drawing ─────────────────────────────────────────────────────────
  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect()
    const src = e.touches ? e.touches[0] : e
    return { x: (src.clientX - rect.left) * (canvas.width / rect.width), y: (src.clientY - rect.top) * (canvas.height / rect.height) }
  }

  const startDraw = (e) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const { x, y } = getPos(e, canvas)
    ctx.beginPath()
    ctx.moveTo(x, y)
    setIsDrawing(true)
    setHasSig(true)
  }

  const draw = (e) => {
    e.preventDefault()
    if (!isDrawing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const { x, y } = getPos(e, canvas)
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#1C1012'
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const endDraw = () => setIsDrawing(false)

  const clearSig = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
    setHasSig(false)
  }

  const submit = async () => {
    if (!signerName.trim()) { setError('Please enter your full name'); return }
    if (!hasSig) { setError('Please draw your signature'); return }
    setError('')
    setSubmitting(true)
    const canvas = canvasRef.current
    const sigData = canvas.toDataURL('image/png')
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/sign-contract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON },
        body: JSON.stringify({ token, signed_by_name: signerName.trim(), signature_data: sigData }),
      })
      const data = await res.json()
      if (!res.ok || data.error) { setError(data.error || 'Signing failed. Please try again.'); setSubmitting(false); return }
      setStep('done')
    } catch {
      setError('Network error. Please try again.')
      setSubmitting(false)
    }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F9FAFB', fontFamily: 'Inter,system-ui,sans-serif' }}>
      <div style={{ textAlign: 'center', color: '#9ca3af' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
        <div style={{ fontSize: 14 }}>Loading contract…</div>
      </div>
    </div>
  )

  if (notFound) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F9FAFB', fontFamily: 'Inter,system-ui,sans-serif', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 340 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#111', marginBottom: 8 }}>Contract not found</div>
        <div style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.6 }}>This signing link is invalid or has expired. Please contact the boutique for a new link.</div>
      </div>
    </div>
  )

  if (contract?.status === 'signed') return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F9FAFB', fontFamily: 'Inter,system-ui,sans-serif', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 360, background: '#fff', borderRadius: 16, padding: 32, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#111', marginBottom: 8 }}>Already signed</div>
        <div style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.6 }}>
          This contract was signed by <strong>{contract.signed_by_name}</strong> on{' '}
          {new Date(contract.signed_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.
        </div>
      </div>
    </div>
  )

  if (step === 'done') return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F9FAFB', fontFamily: 'Inter,system-ui,sans-serif', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 380, background: '#fff', borderRadius: 20, padding: '40px 32px', boxShadow: '0 8px 40px rgba(0,0,0,0.1)' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 28 }}>✅</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#111', marginBottom: 8 }}>Contract signed!</div>
        <div style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.7, marginBottom: 24 }}>
          Thank you, <strong>{signerName}</strong>. Your signature has been recorded and the boutique has been notified.
        </div>
        <div style={{ fontSize: 12, color: '#9ca3af' }}>
          Signed {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} via Belori
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', fontFamily: 'Inter,system-ui,sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #E5E7EB', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 28, height: 28, borderRadius: 7, background: PRIMARY, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="16" height="16" viewBox="0 0 32 32" fill="none"><path d="M7 25V7l18 18V7" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#111', lineHeight: 1 }}>Belori</div>
          {boutique?.name && <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}>{boutique.name}</div>}
        </div>
        <div style={{ flex: 1 }}/>
        <div style={{ fontSize: 11, color: '#9ca3af' }}>E-signature</div>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '20px 16px 40px' }}>
        {/* Title */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#111', marginBottom: 4 }}>{contract.title}</div>
          {boutique && <div style={{ fontSize: 12, color: '#6b7280' }}>{boutique.name}{boutique.address ? ` · ${boutique.address}` : ''}</div>}
        </div>

        {step === 'read' && (
          <>
            {/* Contract body */}
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', padding: '20px 24px', marginBottom: 16, boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
              {contract.body_html && /<[a-z][\s\S]*>/i.test(contract.body_html) ? (
                <div
                  style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.8 }}
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(contract.body_html) }}
                />
              ) : (
                <div style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
                  {contract.body_html || 'No contract body provided.'}
                </div>
              )}
            </div>
            <button onClick={() => setStep('sign')}
              style={{ width: '100%', padding: '16px', borderRadius: 12, border: 'none', background: PRIMARY, color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
              I have read the contract — Continue to sign →
            </button>
          </>
        )}

        {step === 'sign' && (
          <>
            {/* Name field */}
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', padding: 20, marginBottom: 12, boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Your full legal name</div>
              <input
                value={signerName}
                onChange={e => setSignerName(e.target.value)}
                placeholder="Enter your full name exactly as it appears on your ID"
                style={{ width: '100%', padding: '12px 14px', borderRadius: 9, border: '1.5px solid #E5E7EB', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            {/* Signature pad */}
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', padding: 20, marginBottom: 12, boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Draw your signature</div>
                {hasSig && <button onClick={clearSig} style={{ fontSize: 11, color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}>Clear</button>}
              </div>
              <canvas
                ref={canvasRef}
                width={560} height={160}
                onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
                onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw}
                style={{ width: '100%', height: 140, borderRadius: 8, border: `2px dashed ${hasSig ? PRIMARY : '#D1D5DB'}`, background: hasSig ? '#FAFAFA' : '#F9FAFB', cursor: 'crosshair', display: 'block', touchAction: 'none' }}
              />
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6, textAlign: 'center' }}>Use your finger or mouse to draw your signature</div>
            </div>

            {/* Legal notice */}
            <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: 11, color: '#92400E', lineHeight: 1.6 }}>
              By clicking "Sign contract", you agree that this electronic signature is legally equivalent to your handwritten signature and that you have read and agree to the terms above.
            </div>

            {error && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: 12, color: '#DC2626' }}>{error}</div>}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep('read')}
                style={{ flex: 1, padding: '14px', borderRadius: 12, border: '1.5px solid #E5E7EB', background: '#fff', color: '#374151', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
                ← Back
              </button>
              <button onClick={submit} disabled={submitting}
                style={{ flex: 2, padding: '14px', borderRadius: 12, border: 'none', background: submitting ? '#D1D5DB' : PRIMARY, color: '#fff', fontSize: 14, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer' }}>
                {submitting ? 'Signing…' : '✍ Sign contract'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
