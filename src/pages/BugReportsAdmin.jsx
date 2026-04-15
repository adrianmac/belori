import React, { useState, useEffect, useCallback } from 'react'
import { C } from '../lib/colors'
import { Topbar, Card, CardHead, GhostBtn, PrimaryBtn, inputSt, LBL, useToast } from '../lib/ui.jsx'
import { useBugReports } from '../hooks/useBugReports'
import { useAuth } from '../context/AuthContext'

const ADMIN_EMAIL = import.meta.env.VITE_BELORI_ADMIN_EMAIL || ''

const STATUS_CFG = {
  new:         { label: 'New',         color: '#1D4ED8', bg: '#EFF6FF' },
  triaged:     { label: 'Triaged',     color: '#92400E', bg: '#FFFBEB' },
  in_progress: { label: 'In Progress', color: '#6D28D9', bg: '#F5F3FF' },
  fixed:       { label: 'Fixed',       color: '#166534', bg: '#F0FDF4' },
  wont_fix:    { label: "Won't Fix",   color: '#374151', bg: '#F3F4F6' },
}

const SEV_CFG = {
  critical: { label: 'Critical', color: '#B91C1C', bg: '#FEF2F2' },
  high:     { label: 'High',     color: '#92400E', bg: '#FFFBEB' },
  low:      { label: 'Low',      color: '#166534', bg: '#F0FDF4' },
}

const CAT_LABELS = {
  ui_display:     '🎨 UI / Display',
  data_issue:     '📊 Data Issue',
  feature_broken: '⚙️ Feature Broken',
  performance:    '🐢 Performance',
  crash:          '💥 Crash',
  other:          '💬 Other',
}

const STATUSES = ['all', 'new', 'triaged', 'in_progress', 'fixed', 'wont_fix']
const SEVERITIES = ['all', 'critical', 'high', 'low']

function Badge({ value, cfg }) {
  const c = cfg[value] || { label: value, color: '#6B7280', bg: '#F3F4F6' }
  return (
    <span style={{
      fontSize: 11, fontWeight: 600,
      padding: '2px 8px', borderRadius: 999,
      background: c.bg, color: c.color,
      whiteSpace: 'nowrap',
    }}>{c.label}</span>
  )
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

export default function BugReportsAdmin({ setScreen }) {
  const { session, myRole } = useAuth()
  const toast = useToast()
  const { fetchMyReports, updateReport } = useBugReports()

  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterSev, setFilterSev] = useState('all')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [editNotes, setEditNotes] = useState({})   // id → string
  const [saving, setSaving] = useState({})          // id → bool

  const isAdmin = ADMIN_EMAIL
    ? session?.user?.email === ADMIN_EMAIL
    : myRole === 'owner'

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await fetchMyReports()
    if (!error) setReports(data)
    else toast('Could not load bug reports', 'error')
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = reports.filter(r => {
    if (filterStatus !== 'all' && r.status !== filterStatus) return false
    if (filterSev !== 'all' && r.severity !== filterSev) return false
    if (search) {
      const q = search.toLowerCase()
      return r.title?.toLowerCase().includes(q)
          || r.description?.toLowerCase().includes(q)
          || r.boutique_name?.toLowerCase().includes(q)
          || r.screen_name?.toLowerCase().includes(q)
    }
    return true
  })

  async function saveReport(id) {
    setSaving(s => ({ ...s, [id]: true }))
    const r = reports.find(x => x.id === id)
    const { error } = await updateReport(id, {
      status: r.status,
      admin_notes: editNotes[id] ?? r.admin_notes ?? '',
    })
    setSaving(s => ({ ...s, [id]: false }))
    if (error) { toast('Save failed', 'error'); return }
    toast('Saved', 'success')
    load()
  }

  async function setStatus(id, status) {
    setReports(rs => rs.map(r => r.id === id ? { ...r, status } : r))
    const { error } = await updateReport(id, { status })
    if (error) { toast('Update failed', 'error'); load() }
  }

  if (!isAdmin) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: C.gray }}>
        <span style={{ fontSize: 40 }}>🔒</span>
        <span style={{ fontSize: 15, fontWeight: 500, color: C.ink }}>Admin access only</span>
        <span style={{ fontSize: 13 }}>This page is restricted to Belori administrators.</span>
        {setScreen && <GhostBtn onClick={() => setScreen('dashboard')}>← Back</GhostBtn>}
      </div>
    )
  }

  const counts = { total: reports.length, new: 0, critical: 0 }
  reports.forEach(r => {
    if (r.status === 'new') counts.new++
    if (r.severity === 'critical') counts.critical++
  })

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
      <Topbar
        title="Bug Reports"
        subtitle={`${counts.total} total · ${counts.new} new · ${counts.critical} critical`}
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <GhostBtn onClick={load}>↻ Refresh</GhostBtn>
          </div>
        }
      />

      {/* ── Filters ── */}
      <div style={{
        background: C.white, borderBottom: `1px solid ${C.border}`,
        padding: '10px 16px', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center',
        flexShrink: 0,
      }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search title, screen, boutique…"
          style={{ ...inputSt, width: 220, padding: '5px 10px' }}
          aria-label="Search bug reports"
        />
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {STATUSES.map(s => {
            const cfg = STATUS_CFG[s] || { label: 'All', color: C.gray, bg: C.grayBg }
            const active = filterStatus === s
            return (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                aria-pressed={active}
                style={{
                  fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 999, cursor: 'pointer', border: 'none',
                  background: active ? (cfg.bg || '#F3F4F6') : 'transparent',
                  color: active ? (cfg.color || C.ink) : C.gray,
                  outline: active ? `2px solid ${cfg.color || C.border}` : 'none',
                  outlineOffset: -1,
                }}
              >{s === 'all' ? 'All statuses' : STATUS_CFG[s]?.label}</button>
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {SEVERITIES.map(s => {
            const cfg = SEV_CFG[s] || { label: 'All', color: C.gray, bg: C.grayBg }
            const active = filterSev === s
            return (
              <button
                key={s}
                onClick={() => setFilterSev(s)}
                aria-pressed={active}
                style={{
                  fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 999, cursor: 'pointer', border: 'none',
                  background: active ? (cfg.bg || '#F3F4F6') : 'transparent',
                  color: active ? (cfg.color || C.ink) : C.gray,
                  outline: active ? `2px solid ${cfg.color || C.border}` : 'none',
                  outlineOffset: -1,
                }}
              >{s === 'all' ? 'All severity' : cfg.label}</button>
            )
          })}
        </div>
      </div>

      {/* ── Table ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: C.gray, padding: '60px 0', fontSize: 13 }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', color: C.gray, padding: '60px 0', fontSize: 13 }}>
            {reports.length === 0 ? '🎉 No bug reports yet — things are working well!' : 'No reports match these filters.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(r => {
              const expanded = expandedId === r.id
              return (
                <Card key={r.id} style={{ padding: 0, overflow: 'hidden' }}>
                  {/* Row summary */}
                  <button
                    onClick={() => setExpandedId(expanded ? null : r.id)}
                    aria-expanded={expanded}
                    style={{
                      width: '100%', textAlign: 'left', background: 'none', border: 'none',
                      cursor: 'pointer', padding: '12px 16px',
                      display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                    }}
                  >
                    <Badge value={r.severity} cfg={SEV_CFG} />
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: C.ink, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.title}
                    </span>
                    <span style={{ fontSize: 11, color: C.gray, whiteSpace: 'nowrap' }}>{r.boutique_name}</span>
                    <span style={{ fontSize: 11, color: C.gray, whiteSpace: 'nowrap' }}>
                      {r.screen_name ? `📍 ${r.screen_name}` : ''}
                    </span>
                    <Badge value={r.status} cfg={STATUS_CFG} />
                    <span style={{ fontSize: 11, color: C.gray, whiteSpace: 'nowrap' }}>{timeAgo(r.submitted_at)}</span>
                    <span style={{ fontSize: 11, color: C.gray }}>{expanded ? '▲' : '▼'}</span>
                  </button>

                  {/* Expanded detail */}
                  {expanded && (
                    <div style={{ borderTop: `1px solid ${C.border}`, padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {/* Meta row */}
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 11, color: C.gray }}>
                        <span>Category: <b>{CAT_LABELS[r.category] || r.category}</b></span>
                        <span>Role: <b>{r.user_role || '—'}</b></span>
                        <span>Submitted: <b>{new Date(r.submitted_at).toLocaleString()}</b></span>
                        {r.resolved_at && <span>Resolved: <b>{new Date(r.resolved_at).toLocaleString()}</b></span>}
                      </div>

                      {/* Browser */}
                      {r.browser_info && (
                        <div style={{ fontSize: 11, color: C.gray, wordBreak: 'break-all' }}>
                          Browser: {r.browser_info.slice(0, 120)}{r.browser_info.length > 120 ? '…' : ''}
                        </div>
                      )}

                      {/* Description */}
                      <div>
                        <div style={{ ...LBL, marginBottom: 4 }}>Description / Steps</div>
                        <pre style={{
                          margin: 0, fontSize: 12, lineHeight: 1.6,
                          background: '#F8F9FA', border: `1px solid ${C.border}`,
                          borderRadius: 8, padding: '10px 12px',
                          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                          fontFamily: 'inherit', color: C.ink,
                        }}>{r.description}</pre>
                      </div>

                      {/* Status change */}
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                        <label htmlFor={`status-${r.id}`} style={LBL}>Status:</label>
                        <select
                          id={`status-${r.id}`}
                          value={r.status}
                          onChange={e => setStatus(r.id, e.target.value)}
                          style={{ ...inputSt, width: 'auto', padding: '4px 10px' }}
                        >
                          {Object.entries(STATUS_CFG).map(([v, cfg]) => (
                            <option key={v} value={v}>{cfg.label}</option>
                          ))}
                        </select>
                      </div>

                      {/* Admin notes */}
                      <div>
                        <label htmlFor={`notes-${r.id}`} style={{ ...LBL, display: 'block', marginBottom: 4 }}>
                          Admin notes
                        </label>
                        <textarea
                          id={`notes-${r.id}`}
                          value={editNotes[r.id] ?? (r.admin_notes || '')}
                          onChange={e => setEditNotes(n => ({ ...n, [r.id]: e.target.value }))}
                          rows={2}
                          placeholder="Internal notes, fix reference, PR link…"
                          style={{ ...inputSt, width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
                        />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <PrimaryBtn onClick={() => saveReport(r.id)} disabled={saving[r.id]}>
                          {saving[r.id] ? 'Saving…' : 'Save notes'}
                        </PrimaryBtn>
                      </div>
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
