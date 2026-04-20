import React, { useState, useEffect, useRef } from 'react'
import { C } from '../lib/colors'
import { useToast, inputSt, LBL, PrimaryBtn, GhostBtn } from '../lib/ui.jsx'
import { useBugReports } from '../hooks/useBugReports'
import { useAuth } from '../context/AuthContext'

const CATEGORIES = [
  { value: 'ui_display',     label: '🎨 UI / Display issue' },
  { value: 'data_issue',     label: '📊 Wrong or missing data' },
  { value: 'feature_broken', label: '⚙️ Feature not working' },
  { value: 'performance',    label: '🐢 Slow / performance' },
  { value: 'crash',          label: '💥 App crashed / frozen' },
  { value: 'other',          label: '💬 Other' },
]

const SEVERITIES = [
  { value: 'critical', label: 'Critical',  color: '#B91C1C', bg: '#FEF2F2', desc: "Can't work" },
  { value: 'high',     label: 'High',      color: '#92400E', bg: '#FFFBEB', desc: 'Significant' },
  { value: 'low',      label: 'Low',       color: '#166534', bg: '#F0FDF4', desc: 'Minor' },
]

const EMPTY = { title: '', description: '', category: 'feature_broken', severity: 'high' }

export default function BugReportButton({ currentScreen }) {
  const { boutique } = useAuth()
  const toast = useToast()
  const { submitReport } = useBugReports()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768)
  const dialogRef = useRef(null)
  const firstInputRef = useRef(null)

  // Sync with mobile breakpoint so we stack above the BottomNav-offset FAB
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  // ESC to close
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  // Focus trap — move focus into modal when it opens
  useEffect(() => {
    if (open && firstInputRef.current) {
      setTimeout(() => firstInputRef.current?.focus(), 50)
    }
  }, [open])

  // Return focus to trigger button after close
  const triggerRef = useRef(null)
  const handleClose = () => {
    setOpen(false)
    setTimeout(() => triggerRef.current?.focus(), 50)
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) { toast('Please add a title', 'error'); return }
    if (!form.description.trim()) { toast('Please describe the issue', 'error'); return }
    setSubmitting(true)
    const { error } = await submitReport({ ...form, screenName: currentScreen })
    setSubmitting(false)
    if (error) {
      toast('Failed to submit — try again', 'error')
      return
    }
    setSubmitted(true)
    setTimeout(() => {
      setSubmitted(false)
      setForm(EMPTY)
      handleClose()
    }, 1800)
  }

  if (!boutique) return null

  return (
    <>
      {/* ── Floating trigger button ──
          Pinned to the right side, stacked above the QuickActionFAB so the
          primary "+" action stays at thumb-level. On mobile the FAB is shifted
          up by the BottomNav (88px vs 28px); mirror that offset here.        */}
      <button
        ref={triggerRef}
        onClick={() => { setForm(EMPTY); setSubmitted(false); setOpen(true) }}
        aria-label="Report a bug"
        title="Report a bug"
        style={{
          position: 'fixed',
          // FAB sits at 28/88 with a 56px primary button — stack above with a 12px gap.
          bottom: (isMobile ? 88 : 28) + 56 + 12,
          right: 20,
          zIndex: 950,
          width: 44,
          height: 44,
          borderRadius: '50%',
          border: 'none',
          background: '#374151',
          color: '#fff',
          fontSize: 18,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = '#1F2937'}
        onMouseLeave={e => e.currentTarget.style.background = '#374151'}
      >
        🐛
      </button>

      {/* ── Modal ── */}
      {open && (
        <div
          role="presentation"
          onClick={e => { if (e.target === e.currentTarget) handleClose() }}
          style={{
            position: 'fixed', inset: 0, zIndex: 1200,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="bug-modal-title"
            style={{
              background: C.white,
              borderRadius: 16,
              boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
              width: '100%',
              maxWidth: 480,
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
            }}
          >
            {submitted ? (
              /* ── Success state ── */
              <div style={{ textAlign: 'center', padding: '32px 16px' }}>
                <div style={{ fontSize: 44, marginBottom: 12 }}>✅</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: C.ink, marginBottom: 6 }}>Report submitted!</div>
                <div style={{ fontSize: 13, color: C.gray }}>Thanks for helping improve Belori.</div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h2 id="bug-modal-title" style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.ink }}>
                    Report a bug 🐛
                  </h2>
                  <button
                    type="button"
                    onClick={handleClose}
                    aria-label="Close bug report"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.gray, fontSize: 22, lineHeight: 1, padding: '0 2px' }}
                  >×</button>
                </div>

                {/* Current screen badge */}
                {currentScreen && (
                  <div style={{ fontSize: 11, color: C.gray }}>
                    <span style={{
                      background: C.grayBg || '#F3F4F6',
                      borderRadius: 5,
                      padding: '2px 8px',
                      fontWeight: 500,
                      color: '#374151',
                    }}>
                      📍 Screen: {currentScreen}
                    </span>
                  </div>
                )}

                {/* Title */}
                <div>
                  <label htmlFor="bug-title" style={{ ...LBL, display: 'block', marginBottom: 6 }}>
                    What's broken? <span style={{ color: '#B91C1C' }}>*</span>
                  </label>
                  <input
                    ref={firstInputRef}
                    id="bug-title"
                    value={form.title}
                    onChange={e => set('title', e.target.value)}
                    placeholder="Short title, e.g. 'Save button doesn't work on mobile'"
                    maxLength={120}
                    required
                    style={{ ...inputSt, width: '100%' }}
                  />
                </div>

                {/* Description */}
                <div>
                  <label htmlFor="bug-desc" style={{ ...LBL, display: 'block', marginBottom: 6 }}>
                    Steps to reproduce <span style={{ color: '#B91C1C' }}>*</span>
                  </label>
                  <textarea
                    id="bug-desc"
                    value={form.description}
                    onChange={e => set('description', e.target.value)}
                    placeholder={'1. Go to Events\n2. Click New Event\n3. Fill form and click Save\n4. Nothing happens'}
                    rows={4}
                    required
                    style={{ ...inputSt, width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
                  />
                </div>

                {/* Category */}
                <div>
                  <label htmlFor="bug-cat" style={{ ...LBL, display: 'block', marginBottom: 6 }}>Category</label>
                  <select
                    id="bug-cat"
                    value={form.category}
                    onChange={e => set('category', e.target.value)}
                    style={{ ...inputSt, width: '100%' }}
                  >
                    {CATEGORIES.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>

                {/* Severity */}
                <div>
                  <div style={{ ...LBL, marginBottom: 8 }}>Severity</div>
                  <div style={{ display: 'flex', gap: 8 }} role="group" aria-label="Severity">
                    {SEVERITIES.map(s => (
                      <button
                        key={s.value}
                        type="button"
                        aria-pressed={form.severity === s.value}
                        onClick={() => set('severity', s.value)}
                        style={{
                          flex: 1,
                          padding: '8px 6px',
                          borderRadius: 8,
                          border: form.severity === s.value
                            ? `2px solid ${s.color}`
                            : `2px solid ${C.border}`,
                          background: form.severity === s.value ? s.bg : C.white,
                          cursor: 'pointer',
                          textAlign: 'center',
                          transition: 'all 0.12s',
                        }}
                      >
                        <div style={{ fontSize: 12, fontWeight: 700, color: s.color }}>{s.label}</div>
                        <div style={{ fontSize: 10, color: C.gray, marginTop: 2 }}>{s.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 }}>
                  <GhostBtn onClick={handleClose} type="button">Cancel</GhostBtn>
                  <PrimaryBtn type="submit" disabled={submitting}>
                    {submitting ? 'Sending…' : 'Submit report'}
                  </PrimaryBtn>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
