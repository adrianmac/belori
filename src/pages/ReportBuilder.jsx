import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { C, fmt } from '../lib/colors'
import { Topbar } from '../lib/ui.jsx'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// ─── Data source definitions ─────────────────────────────────────────────────
const DATA_SOURCES = {
  events: {
    label: 'Events',
    icon: '📅',
    table: 'events',
    select: 'id, type, event_date, venue, guests, status, total, paid, coordinator_id, created_at',
    clientJoin: true,
    columns: [
      { id: 'client_name', label: 'Client', type: 'text', virtual: true },
      { id: 'type', label: 'Event type', type: 'text' },
      { id: 'event_date', label: 'Event date', type: 'date' },
      { id: 'venue', label: 'Venue', type: 'text' },
      { id: 'guests', label: 'Guests', type: 'number' },
      { id: 'status', label: 'Status', type: 'text' },
      { id: 'total', label: 'Contract value', type: 'currency' },
      { id: 'paid', label: 'Collected', type: 'currency' },
      { id: 'created_at', label: 'Created', type: 'date' },
    ],
  },
  clients: {
    label: 'Clients',
    icon: '👥',
    table: 'clients',
    select: 'id, name, phone, email, loyalty_points, referred_by, created_at',
    columns: [
      { id: 'name', label: 'Name', type: 'text' },
      { id: 'phone', label: 'Phone', type: 'text' },
      { id: 'email', label: 'Email', type: 'text' },
      { id: 'loyalty_points', label: 'Loyalty points', type: 'number' },
      { id: 'referred_by', label: 'Referred by', type: 'text' },
      { id: 'created_at', label: 'Added', type: 'date' },
    ],
  },
  payments: {
    label: 'Payments',
    icon: '💳',
    table: 'payment_milestones',
    select: 'id, label, amount, due_date, paid_date, status, event_id',
    columns: [
      { id: 'label', label: 'Milestone', type: 'text' },
      { id: 'amount', label: 'Amount', type: 'currency' },
      { id: 'due_date', label: 'Due date', type: 'date' },
      { id: 'paid_date', label: 'Paid date', type: 'date' },
      { id: 'status', label: 'Status', type: 'text' },
    ],
  },
  appointments: {
    label: 'Appointments',
    icon: '📆',
    table: 'appointments',
    select: 'id, type, date, time, status, note',
    columns: [
      { id: 'type', label: 'Type', type: 'text' },
      { id: 'date', label: 'Date', type: 'date' },
      { id: 'time', label: 'Time', type: 'text' },
      { id: 'status', label: 'Status', type: 'text' },
      { id: 'note', label: 'Notes', type: 'text' },
    ],
  },
}

const OPERATORS = {
  text:     [{ id: 'ilike', label: 'contains' }, { id: 'eq', label: 'equals' }, { id: 'neq', label: 'not equals' }],
  number:   [{ id: 'eq', label: '=' }, { id: 'gt', label: '>' }, { id: 'lt', label: '<' }, { id: 'gte', label: '>=' }, { id: 'lte', label: '<=' }],
  currency: [{ id: 'gt', label: '>' }, { id: 'lt', label: '<' }, { id: 'gte', label: '>=' }, { id: 'lte', label: '<=' }],
  date:     [{ id: 'gte', label: 'on or after' }, { id: 'lte', label: 'on or before' }, { id: 'eq', label: 'exactly' }],
}

const LS_KEY = 'belori_saved_reports'

function loadSaved() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]') } catch { return [] }
}
function saveSaved(arr) {
  localStorage.setItem(LS_KEY, JSON.stringify(arr))
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtCell(val, type) {
  if (val === null || val === undefined || val === '') return '—'
  if (type === 'currency') return fmt(Number(val))
  if (type === 'date') {
    const d = new Date(val)
    return isNaN(d.getTime()) ? val : d.toLocaleDateString()
  }
  if (type === 'number') return Number(val).toLocaleString()
  return String(val)
}

let _filterIdCounter = 0
function newFilterId() { return ++_filterIdCounter }

// ─── Step labels ─────────────────────────────────────────────────────────────
const STEPS = [
  { num: 1, label: 'Data source' },
  { num: 2, label: 'Columns' },
  { num: 3, label: 'Filters' },
  { num: 4, label: 'Sort' },
]

// ─── Main component ──────────────────────────────────────────────────────────
export default function ReportBuilder() {
  const { boutique } = useAuth()

  const [source, setSource] = useState('events')
  const src = DATA_SOURCES[source]

  // Default first 4 column ids for the current source
  const defaultCols = useCallback(
    (src) => src.columns.slice(0, 4).map(c => c.id),
    []
  )

  const [selectedCols, setSelectedCols] = useState(() => defaultCols(DATA_SOURCES['events']))
  const [filters, setFilters] = useState([])
  const [sortCol, setSortCol] = useState('')
  const [sortDir, setSortDir] = useState('asc')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [hasRun, setHasRun] = useState(false)
  const limit = 100

  const [savedReports, setSavedReports] = useState(loadSaved)
  const [saveNameInput, setSaveNameInput] = useState('')
  const [showSaveModal, setShowSaveModal] = useState(false)

  // When source changes, reset columns/filters/sort/rows
  const handleSourceChange = (key) => {
    setSource(key)
    setSelectedCols(defaultCols(DATA_SOURCES[key]))
    setFilters([])
    setSortCol('')
    setSortDir('asc')
    setRows([])
    setHasRun(false)
    setError(null)
  }

  const toggleCol = (id) => {
    setSelectedCols(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    )
  }

  const addFilter = () => {
    const firstCol = src.columns.find(c => !c.virtual) || src.columns[0]
    const ops = OPERATORS[firstCol.type] || OPERATORS.text
    setFilters(prev => [...prev, { id: newFilterId(), colId: firstCol.id, op: ops[0].id, value: '' }])
  }

  const updateFilter = (fid, patch) => {
    setFilters(prev => prev.map(f => {
      if (f.id !== fid) return f
      const updated = { ...f, ...patch }
      // If column changed, reset op to first valid op for new type
      if (patch.colId && patch.colId !== f.colId) {
        const col = src.columns.find(c => c.id === patch.colId)
        const ops = OPERATORS[col?.type || 'text'] || OPERATORS.text
        updated.op = ops[0].id
        updated.value = ''
      }
      return updated
    }))
  }

  const removeFilter = (fid) => setFilters(prev => prev.filter(f => f.id !== fid))

  const runReport = useCallback(async () => {
    if (!boutique) return
    setLoading(true)
    setError(null)
    setHasRun(true)

    let selectStr = src.select
    if (src.clientJoin) {
      selectStr = src.select + ', clients(name)'
    }

    let q = supabase
      .from(src.table)
      .select(selectStr)
      .eq('boutique_id', boutique.id)
      .limit(limit)

    for (const f of filters) {
      if (!f.value) continue
      const col = src.columns.find(c => c.id === f.colId)
      if (!col || col.virtual) continue
      const val = col.type === 'text' && f.op === 'ilike' ? `%${f.value}%` : f.value
      q = q[f.op](col.id, val)
    }

    if (sortCol) {
      const col = src.columns.find(c => c.id === sortCol)
      if (col && !col.virtual) {
        q = q.order(sortCol, { ascending: sortDir === 'asc' })
      }
    }

    const { data, error: qErr } = await q
    if (qErr) {
      setError(qErr.message)
      setRows([])
    } else {
      // Flatten client join if present
      const flat = (data || []).map(row => {
        if (row.clients) {
          return { ...row, client_name: row.clients?.name || '' }
        }
        return row
      })
      setRows(flat)
    }
    setLoading(false)
  }, [boutique?.id, src, filters, sortCol, sortDir, limit])

  const exportCSV = () => {
    if (!rows.length) return
    const cols = selectedCols
      .map(id => src.columns.find(c => c.id === id))
      .filter(Boolean)
    const header = cols.map(c => `"${c.label}"`).join(',')
    const rowsStr = rows.map(r =>
      cols.map(c => {
        const v = r[c.id]
        if (c.type === 'currency') return `$${Number(v || 0).toFixed(2)}`
        if (c.type === 'date' && v) return new Date(v).toLocaleDateString()
        return `"${v ?? ''}"`
      }).join(',')
    ).join('\n')
    const blob = new Blob([header + '\n' + rowsStr], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `report-${source}-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const openSaveModal = () => {
    setSaveNameInput('')
    setShowSaveModal(true)
  }

  const confirmSave = () => {
    const name = saveNameInput.trim() || `${src.label} report`
    const report = {
      id: Date.now(),
      name,
      source,
      selectedCols,
      filters: filters.map(f => ({ colId: f.colId, op: f.op, value: f.value })),
      sortCol,
      sortDir,
      savedAt: new Date().toISOString(),
    }
    const next = [report, ...savedReports].slice(0, 20)
    setSavedReports(next)
    saveSaved(next)
    setShowSaveModal(false)
  }

  const loadReport = (report) => {
    handleSourceChange(report.source)
    // Defer because handleSourceChange sets state async-ish
    setTimeout(() => {
      setSelectedCols(report.selectedCols || [])
      setSortCol(report.sortCol || '')
      setSortDir(report.sortDir || 'asc')
      const restoredFilters = (report.filters || []).map(f => ({
        ...f,
        id: newFilterId(),
      }))
      setFilters(restoredFilters)
    }, 0)
  }

  const deleteSaved = (id, e) => {
    e.stopPropagation()
    const next = savedReports.filter(r => r.id !== id)
    setSavedReports(next)
    saveSaved(next)
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const activeCols = useMemo(
    () => selectedCols.map(id => src.columns.find(c => c.id === id)).filter(Boolean),
    [selectedCols, src]
  )

  const canExport = rows.length > 0 && activeCols.length > 0
  const sortableColumns = src.columns.filter(c => !c.virtual)

  // ─── Shared styles ─────────────────────────────────────────────────────────
  const selectSt = {
    padding: '6px 10px', borderRadius: 7, border: `1px solid ${C.border}`,
    fontSize: 13, color: C.ink, background: C.white, cursor: 'pointer',
    appearance: 'none', WebkitAppearance: 'none',
  }
  const inputSt = {
    padding: '6px 10px', borderRadius: 7, border: `1px solid ${C.border}`,
    fontSize: 13, color: C.ink, background: C.white, outline: 'none',
    minWidth: 140,
  }
  const sectionHead = {
    fontSize: 11, fontWeight: 700, letterSpacing: '0.07em',
    textTransform: 'uppercase', color: C.gray, marginBottom: 10,
  }
  const sectionCard = {
    background: C.white, borderRadius: 10, border: `1px solid ${C.border}`,
    padding: '16px 18px',
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Topbar ──────────────────────────────────────────────────────── */}
      <Topbar
        title="Report Builder"
        subtitle="Custom queries & exports"
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={openSaveModal}
              style={{
                padding: '7px 14px', borderRadius: 8,
                border: `1px solid ${C.border}`, background: C.white,
                fontSize: 13, fontWeight: 500, color: C.ink, cursor: 'pointer',
              }}
            >
              Save report
            </button>
            <button
              onClick={exportCSV}
              disabled={!canExport}
              style={{
                padding: '7px 14px', borderRadius: 8, border: 'none',
                background: canExport ? C.rosa : C.border,
                color: canExport ? C.white : C.gray,
                fontSize: 13, fontWeight: 600, cursor: canExport ? 'pointer' : 'default',
                transition: 'background 0.15s',
              }}
            >
              Export CSV
            </button>
          </div>
        }
      />

      <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>

        {/* ── Saved reports pills ──────────────────────────────────────── */}
        {savedReports.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ ...sectionHead }}>Saved reports</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {savedReports.map(r => (
                <div
                  key={r.id}
                  onClick={() => loadReport(r)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '5px 10px 5px 12px',
                    borderRadius: 20, border: `1px solid ${C.border}`,
                    background: C.white, cursor: 'pointer', fontSize: 12,
                    color: C.ink, fontWeight: 500,
                    transition: 'border-color 0.12s, box-shadow 0.12s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = C.rosa}
                  onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
                >
                  <span style={{ fontSize: 11, color: C.gray }}>{DATA_SOURCES[r.source]?.icon}</span>
                  {r.name}
                  <button
                    onClick={(e) => deleteSaved(r.id, e)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: C.gray, fontSize: 14, lineHeight: 1, padding: '0 2px',
                      marginLeft: 2,
                    }}
                    title="Remove"
                  >×</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Main builder layout ──────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

          {/* Left: step sidebar */}
          <div style={{
            width: 160, flexShrink: 0,
            display: 'flex', flexDirection: 'column', gap: 4,
          }}>
            {STEPS.map(step => (
              <div
                key={step.num}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 8,
                  background: C.white, border: `1px solid ${C.border}`,
                }}
              >
                <div style={{
                  width: 22, height: 22, borderRadius: '50%',
                  background: C.rosa, color: C.white,
                  fontSize: 11, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>{step.num}</div>
                <span style={{ fontSize: 12, fontWeight: 500, color: C.ink }}>{step.label}</span>
              </div>
            ))}
            <div style={{ marginTop: 4 }}>
              <button
                onClick={runReport}
                disabled={loading || !boutique}
                style={{
                  width: '100%', padding: '11px 0', borderRadius: 8, border: 'none',
                  background: loading ? C.border : C.rosa,
                  color: loading ? C.gray : C.white,
                  fontSize: 13, fontWeight: 700, cursor: loading ? 'default' : 'pointer',
                  transition: 'background 0.15s',
                }}
              >
                {loading ? 'Running…' : 'Run report'}
              </button>
            </div>
          </div>

          {/* Right: builder panels */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>

            {/* Step 1: Data source */}
            <div style={sectionCard}>
              <div style={sectionHead}>1. Data source</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {Object.entries(DATA_SOURCES).map(([key, ds]) => (
                  <button
                    key={key}
                    onClick={() => handleSourceChange(key)}
                    style={{
                      padding: '8px 16px', borderRadius: 8,
                      border: `2px solid ${source === key ? C.rosa : C.border}`,
                      background: source === key ? C.rosaPale : C.white,
                      color: source === key ? C.rosa : C.ink,
                      fontSize: 13, fontWeight: source === key ? 600 : 400,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                      transition: 'border-color 0.12s',
                    }}
                  >
                    <span>{ds.icon}</span>
                    {ds.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Step 2: Columns */}
            <div style={sectionCard}>
              <div style={sectionHead}>2. Columns</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {src.columns.map(col => {
                  const checked = selectedCols.includes(col.id)
                  return (
                    <label
                      key={col.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '6px 12px', borderRadius: 7,
                        border: `1px solid ${checked ? C.rosa : C.border}`,
                        background: checked ? C.rosaPale : C.grayBg,
                        cursor: 'pointer', fontSize: 13, fontWeight: checked ? 500 : 400,
                        color: checked ? C.rosa : C.ink,
                        userSelect: 'none',
                        transition: 'border-color 0.12s, background 0.12s',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleCol(col.id)}
                        style={{ accentColor: C.rosa, cursor: 'pointer' }}
                      />
                      {col.label}
                    </label>
                  )
                })}
              </div>
            </div>

            {/* Step 3: Filters */}
            <div style={sectionCard}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={sectionHead}>3. Filters</div>
                <button
                  onClick={addFilter}
                  style={{
                    padding: '5px 12px', borderRadius: 7,
                    border: `1px solid ${C.border}`, background: C.white,
                    fontSize: 12, fontWeight: 500, color: C.ink, cursor: 'pointer',
                  }}
                >+ Add filter</button>
              </div>
              {filters.length === 0 && (
                <div style={{ fontSize: 13, color: C.gray, fontStyle: 'italic' }}>
                  No filters — all rows will be returned.
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filters.map(f => {
                  const col = src.columns.find(c => c.id === f.colId) || src.columns[0]
                  const ops = OPERATORS[col?.type || 'text'] || OPERATORS.text
                  const filterableCols = src.columns.filter(c => !c.virtual)
                  return (
                    <div key={f.id} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      {/* Column select */}
                      <select
                        value={f.colId}
                        onChange={e => updateFilter(f.id, { colId: e.target.value })}
                        style={selectSt}
                      >
                        {filterableCols.map(c => (
                          <option key={c.id} value={c.id}>{c.label}</option>
                        ))}
                      </select>
                      {/* Operator select */}
                      <select
                        value={f.op}
                        onChange={e => updateFilter(f.id, { op: e.target.value })}
                        style={selectSt}
                      >
                        {ops.map(o => (
                          <option key={o.id} value={o.id}>{o.label}</option>
                        ))}
                      </select>
                      {/* Value input */}
                      <input
                        type={col?.type === 'date' ? 'date' : col?.type === 'number' || col?.type === 'currency' ? 'number' : 'text'}
                        value={f.value}
                        onChange={e => updateFilter(f.id, { value: e.target.value })}
                        placeholder="Value…"
                        style={inputSt}
                      />
                      {/* Remove */}
                      <button
                        onClick={() => removeFilter(f.id)}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: C.gray, fontSize: 18, lineHeight: 1, padding: '0 4px',
                        }}
                        title="Remove filter"
                      >×</button>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Step 4: Sort */}
            <div style={sectionCard}>
              <div style={sectionHead}>4. Sort</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <select
                  value={sortCol}
                  onChange={e => setSortCol(e.target.value)}
                  style={selectSt}
                >
                  <option value="">— No sort —</option>
                  {sortableColumns.map(c => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
                {sortCol && (
                  <button
                    onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
                    style={{
                      padding: '6px 14px', borderRadius: 7,
                      border: `1px solid ${C.border}`, background: C.white,
                      fontSize: 13, fontWeight: 500, color: C.ink, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 5,
                    }}
                  >
                    {sortDir === 'asc' ? '↑ Ascending' : '↓ Descending'}
                  </button>
                )}
              </div>
            </div>

            {/* Results */}
            {(hasRun || loading) && (
              <div style={sectionCard}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginBottom: 12,
                }}>
                  <div style={sectionHead}>
                    {loading
                      ? 'Loading…'
                      : error
                      ? 'Error'
                      : `Results — ${rows.length} row${rows.length !== 1 ? 's' : ''}${rows.length === limit ? ` (limit ${limit})` : ''}`
                    }
                  </div>
                  {!loading && !error && rows.length > 0 && (
                    <span style={{ fontSize: 11, color: C.gray }}>
                      {activeCols.length} column{activeCols.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {loading && (
                  <div style={{ padding: '24px 0', textAlign: 'center', color: C.gray, fontSize: 13 }}>
                    Querying…
                  </div>
                )}

                {error && !loading && (
                  <div style={{
                    background: C.redBg, border: `1px solid #FECACA`,
                    borderRadius: 7, padding: '10px 14px', fontSize: 13, color: C.red,
                  }}>
                    {error}
                  </div>
                )}

                {!loading && !error && rows.length === 0 && (
                  <div style={{ padding: '24px 0', textAlign: 'center', color: C.gray, fontSize: 13 }}>
                    No results matched your filters.
                  </div>
                )}

                {!loading && !error && rows.length > 0 && activeCols.length > 0 && (
                  <div style={{ overflow: 'auto' }}>
                    <table style={{
                      width: '100%', borderCollapse: 'collapse',
                      fontSize: 13, color: C.ink,
                    }}>
                      <thead>
                        <tr>
                          {activeCols.map(col => (
                            <th
                              key={col.id}
                              style={{
                                textAlign: 'left',
                                padding: '8px 12px',
                                borderBottom: `2px solid ${C.border}`,
                                fontWeight: 600, fontSize: 11,
                                textTransform: 'uppercase', letterSpacing: '0.05em',
                                color: C.gray, whiteSpace: 'nowrap',
                                background: C.grayBg,
                              }}
                            >
                              {col.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, ri) => (
                          <tr
                            key={row.id || ri}
                            style={{ background: ri % 2 === 0 ? C.white : C.grayBg }}
                          >
                            {activeCols.map(col => (
                              <td
                                key={col.id}
                                style={{
                                  padding: '8px 12px',
                                  borderBottom: `1px solid ${C.border}`,
                                  whiteSpace: 'nowrap',
                                  maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis',
                                }}
                              >
                                {fmtCell(row[col.id], col.type)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </div>

      {/* ── Save modal ──────────────────────────────────────────────────────── */}
      {showSaveModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 800,
          }}
          onClick={() => setShowSaveModal(false)}
        >
          <div
            style={{
              background: C.white, borderRadius: 12, padding: 24, width: 340,
              boxShadow: '0 8px 32px rgba(0,0,0,0.16)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontWeight: 700, fontSize: 15, color: C.ink, marginBottom: 4 }}>
              Save report
            </div>
            <div style={{ fontSize: 12, color: C.gray, marginBottom: 16 }}>
              Give this report configuration a name so you can reload it later.
            </div>
            <input
              type="text"
              value={saveNameInput}
              onChange={e => setSaveNameInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && confirmSave()}
              placeholder={`${src.label} report`}
              autoFocus
              style={{
                ...inputSt,
                width: '100%', boxSizing: 'border-box', marginBottom: 16,
              }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowSaveModal(false)}
                style={{
                  padding: '8px 16px', borderRadius: 8,
                  border: `1px solid ${C.border}`, background: C.white,
                  fontSize: 13, fontWeight: 500, color: C.ink, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmSave}
                style={{
                  padding: '8px 16px', borderRadius: 8, border: 'none',
                  background: C.rosa, color: C.white,
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
