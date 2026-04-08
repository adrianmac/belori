import React, { useState, useEffect, useRef } from 'react'
import { C } from '../lib/colors'
import { Topbar, PrimaryBtn, GhostBtn, Badge, useToast } from '../lib/ui.jsx'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { getDressQrUrl, generateQRSvg, generateQRDataUrl } from '../lib/qrUtils'

const CAT_LABELS = {
  bridal_gown: 'Bridal', quince_gown: 'Quinceañera', veil: 'Veil',
  tiara: 'Tiara', jewelry: 'Jewelry', shoes: 'Shoes', bolero: 'Bolero',
  gloves: 'Gloves', decoration: 'Decoration', chair: 'Chair',
  table_linen: 'Table Linen', lighting: 'Lighting', other: 'Other',
}

const STATUS_CFG = {
  available: { label: 'Available', col: '#15803D', bg: '#F0FDF4' },
  reserved:  { label: 'Reserved',  col: '#1D4ED8', bg: '#EFF6FF' },
  rented:    { label: 'Rented',    col: '#C9697A', bg: '#FDF5F6' },
  picked_up: { label: 'Picked Up', col: '#7C3AED', bg: '#F5F3FF' },
  returned:  { label: 'Returned',  col: '#92400E', bg: '#FFFBEB' },
  cleaning:  { label: 'Cleaning',  col: '#0369A1', bg: '#F0F9FF' },
  damaged:   { label: 'Damaged',   col: '#B91C1C', bg: '#FEF2F2' },
}

// ── Inline QR preview (renders SVG from qrcode library) ──────────────────────
const QRPreview = ({ dressId, size = 80 }) => {
  const [svg, setSvg] = useState('')
  useEffect(() => {
    let cancelled = false
    generateQRSvg(getDressQrUrl(dressId), size).then(s => { if (!cancelled) setSvg(s) })
    return () => { cancelled = true }
  }, [dressId, size])
  if (!svg) return (
    <div style={{ width: size, height: size, background: '#f3f4f6', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: 10, color: '#9ca3af' }}>...</div>
    </div>
  )
  return <div dangerouslySetInnerHTML={{ __html: svg }} style={{ width: size, height: size, borderRadius: 6, overflow: 'hidden', flexShrink: 0 }}/>
}

// ── Single-dress print modal ───────────────────────────────────────────────────
const SingleQRModal = ({ dress, onClose }) => {
  const toast = useToast()
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [size, setSize] = useState('small')
  const qrUrl = getDressQrUrl(dress.id)

  useEffect(() => {
    generateQRDataUrl(qrUrl, 400).then(setQrDataUrl)
  }, [qrUrl])

  const printLabel = () => {
    const isLarge = size === 'large'
    const w = isLarge ? '3in' : '2in', h = isLarge ? '4in' : '2in'
    const qrSz = isLarge ? '2.2in' : '1.5in'
    const html = `
      <html><head><title>QR Label — #${dress.sku}</title>
      <style>
        @page { size: ${w} ${h}; margin: 0; }
        body { margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
        .label { width:${w};height:${h};display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:8px;border:1px solid #E5E7EB;border-radius:8px;font-family:Inter,sans-serif;box-sizing:border-box; }
        img { width:${qrSz};height:${qrSz};object-fit:contain; }
        .sku { font-family:'Courier New',monospace;font-size:${isLarge?'13px':'10px'};font-weight:700;color:#1C1012;text-align:center;margin-top:4px; }
        .name { font-size:${isLarge?'10px':'8px'};color:#6B7280;text-align:center;margin-top:2px; }
        .brand { font-size:7px;color:#9E7880;font-weight:500;letter-spacing:.05em;margin-top:4px; }
      </style></head>
      <body><div class="label">
        <img src="${qrDataUrl}"/>
        <div class="sku">#${dress.sku}</div>
        <div class="name">${(dress.name||'').slice(0,24)}</div>
        ${isLarge ? `<div class="name">Size ${dress.size||'—'} · ${CAT_LABELS[dress.category]||dress.category}</div>` : ''}
        <div class="brand">■ BELORI</div>
      </div></body></html>`
    const w_ = window.open('', '_blank')
    w_.document.write(html)
    w_.document.close()
    w_.onload = () => { w_.print() }
  }

  const downloadPNG = () => {
    const a = document.createElement('a')
    a.href = qrDataUrl
    a.download = `belori-qr-${dress.sku}.png`
    a.click()
    toast('QR code downloaded ✓')
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 16, width: 360, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: C.ink }}>Print label — #{dress.sku}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: C.gray }}>×</button>
        </div>
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          {/* QR preview */}
          <div style={{ background: '#fafafa', borderRadius: 12, padding: 16, border: `1px solid ${C.border}` }}>
            {qrDataUrl ? <img src={qrDataUrl} style={{ width: 160, height: 160 }} alt="QR Code"/> : <div style={{ width: 160, height: 160, background: '#f3f4f6', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 12 }}>Generating…</div>}
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'monospace', fontWeight: 700, color: C.ink }}>#{dress.sku}</div>
            <div style={{ fontSize: 12, color: C.gray, marginTop: 2 }}>{dress.name}</div>
          </div>

          {/* Label size */}
          <div style={{ width: '100%' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.gray, marginBottom: 8 }}>Label size</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[['small', 'Small', '2"×2"', 'Hanger tag'], ['large', 'Large', '3"×4"', 'Garment bag']].map(([v, l, s, sub]) => (
                <button key={v} onClick={() => setSize(v)}
                  style={{ padding: '10px 12px', borderRadius: 10, border: `2px solid ${size === v ? C.rosa : C.border}`, background: size === v ? C.rosaPale : '#fff', cursor: 'pointer', textAlign: 'left', minHeight: 'unset', minWidth: 'unset' }}>
                  <div style={{ fontSize: 12, fontWeight: size === v ? 700 : 500, color: size === v ? C.rosa : C.ink }}>{l} <span style={{ fontSize: 10, fontWeight: 400 }}>({s})</span></div>
                  <div style={{ fontSize: 10, color: C.gray, marginTop: 2 }}>{sub}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div style={{ padding: '12px 20px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 8 }}>
          <GhostBtn label="Download PNG" onClick={downloadPNG}/>
          <PrimaryBtn label="Print now" onClick={printLabel}/>
        </div>
      </div>
    </div>
  )
}

// ── Main QR Codes Page ─────────────────────────────────────────────────────────
export default function QRCodesPage({ setScreen }) {
  const { boutique } = useAuth()
  const toast = useToast()
  const [inventory, setInventory] = useState([])
  const [loading, setLoading]     = useState(true)
  const [selected, setSelected]   = useState(new Set())
  const [catFilter, setCatFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [printModal, setPrintModal] = useState(null)  // dress object for single print

  useEffect(() => {
    if (!boutique) return
    supabase.from('inventory').select('id,sku,name,category,size,color,status').eq('boutique_id', boutique.id).order('sku')
      .then(({ data }) => { setInventory(data || []); setLoading(false) })
  }, [boutique?.id])

  const CATS = ['all', ...new Set(inventory.map(d => d.category).filter(Boolean))]
  const STATUSES = ['all', ...new Set(inventory.map(d => d.status).filter(Boolean))]

  const filtered = inventory.filter(d =>
    (catFilter === 'all' || d.category === catFilter) &&
    (statusFilter === 'all' || d.status === statusFilter)
  )

  const toggleSelect = (id) => setSelected(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })
  const selectAll = () => setSelected(new Set(filtered.map(d => d.id)))
  const clearAll  = () => setSelected(new Set())

  const printBatch = async (ids) => {
    if (ids.length === 0) { toast('Select at least one dress', 'error'); return }
    toast('Generating labels…')
    const dresses = inventory.filter(d => ids.includes(d.id))

    // Generate all QR data URLs in parallel
    const qrUrls = await Promise.all(dresses.map(d => generateQRDataUrl(getDressQrUrl(d.id), 300)))

    const COLS = 3
    const labelsHtml = dresses.map((d, i) => `
      <div class="label">
        <img src="${qrUrls[i]}" class="qr"/>
        <div class="sku">#${d.sku}</div>
        <div class="name">${(d.name||'').slice(0,22)}</div>
        <div class="brand">■ BELORI</div>
      </div>`).join('')

    const html = `<html><head><title>Belori QR Labels</title>
      <style>
        @page { size: letter; margin: 0.4in; }
        body { font-family: Inter,sans-serif; margin: 0; }
        .grid { display: grid; grid-template-columns: repeat(${COLS}, 1fr); gap: 12px; }
        .label { display:flex;flex-direction:column;align-items:center;padding:10px 8px;border:1px solid #E5E7EB;border-radius:8px;page-break-inside:avoid; }
        .qr { width:100%;max-width:120px;height:auto; }
        .sku { font-family:'Courier New',monospace;font-size:10px;font-weight:700;color:#1C1012;margin-top:4px;text-align:center; }
        .name { font-size:8px;color:#6B7280;text-align:center;margin-top:2px; }
        .brand { font-size:7px;color:#9E7880;margin-top:4px; }
      </style></head>
      <body><div class="grid">${labelsHtml}</div></body></html>`

    const w = window.open('', '_blank')
    w.document.write(html)
    w.document.close()
    w.onload = () => w.print()
  }

  const selectedArr = [...selected]

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Topbar
        title="QR Code Labels"
        subtitle={`${inventory.length} items in inventory${selected.size > 0 ? ` · ${selected.size} selected` : ''}`}
        actions={
          <>
            <GhostBtn label="← Back to inventory" onClick={() => setScreen('inventory')}/>
            {selected.size > 0 && <PrimaryBtn label={`Print ${selected.size} label${selected.size !== 1 ? 's' : ''}`} onClick={() => printBatch(selectedArr)}/>}
            {selected.size === 0 && <PrimaryBtn label="Print all" onClick={() => printBatch(inventory.map(d => d.id))}/>}
          </>
        }
      />

      {/* Filter bar */}
      <div style={{ padding: '10px 20px', background: '#fff', borderBottom: `1px solid ${C.border}`, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Category filter */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {CATS.slice(0, 6).map(c => (
            <button key={c} onClick={() => setCatFilter(c)}
              style={{ padding: '4px 10px', borderRadius: 20, border: `1px solid ${catFilter === c ? C.rosa : C.border}`, background: catFilter === c ? C.rosaPale : '#fff', color: catFilter === c ? C.rosa : C.gray, fontSize: 11, fontWeight: catFilter === c ? 600 : 400, cursor: 'pointer', minHeight: 'unset', minWidth: 'unset' }}>
              {c === 'all' ? 'All categories' : (CAT_LABELS[c] || c)}
            </button>
          ))}
        </div>
        <div style={{ width: 1, height: 20, background: C.border, margin: '0 4px' }}/>
        {/* Status filter */}
        {STATUSES.slice(0, 5).map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            style={{ padding: '4px 10px', borderRadius: 20, border: `1px solid ${statusFilter === s ? C.rosa : C.border}`, background: statusFilter === s ? C.rosaPale : '#fff', color: statusFilter === s ? C.rosa : C.gray, fontSize: 11, fontWeight: statusFilter === s ? 600 : 400, cursor: 'pointer', minHeight: 'unset', minWidth: 'unset' }}>
            {s === 'all' ? 'All statuses' : (STATUS_CFG[s]?.label || s)}
          </button>
        ))}
        <div style={{ flex: 1 }}/>
        {filtered.length > 0 && (
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={selectAll} style={{ fontSize: 11, color: C.rosa, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>Select all ({filtered.length})</button>
            {selected.size > 0 && <button onClick={clearAll} style={{ fontSize: 11, color: C.gray, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>Clear</button>}
          </div>
        )}
      </div>

      {/* Grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: C.gray, padding: 60, fontSize: 14 }}>Loading inventory…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', color: C.gray, padding: 60 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
            <div style={{ fontSize: 14 }}>No items match the current filters</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {filtered.map(dress => {
              const isSelected = selected.has(dress.id)
              const cfg = STATUS_CFG[dress.status] || STATUS_CFG.available
              return (
                <div key={dress.id}
                  style={{ background: '#fff', border: `2px solid ${isSelected ? C.rosa : C.border}`, borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 10, transition: 'border-color 0.15s', cursor: 'pointer', boxShadow: isSelected ? `0 0 0 3px ${C.rosaPale}` : 'none' }}
                  onClick={() => toggleSelect(dress.id)}>
                  {/* QR preview + checkbox */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <QRPreview dressId={dress.id} size={72}/>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: C.ink }}>#{dress.sku}</div>
                      <div style={{ fontSize: 11, color: C.gray, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dress.name}</div>
                      {dress.size && <div style={{ fontSize: 10, color: C.gray, marginTop: 1 }}>Size {dress.size}</div>}
                      <div style={{ marginTop: 6, display: 'inline-block', padding: '2px 7px', borderRadius: 20, background: cfg.bg, color: cfg.col, fontSize: 10, fontWeight: 600 }}>{cfg.label}</div>
                    </div>
                    <div style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${isSelected ? C.rosa : C.border}`, background: isSelected ? C.rosa : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {isSelected && <svg width="10" height="10" viewBox="0 0 10 10"><polyline points="1.5,5 4,7.5 8.5,2.5" stroke="#fff" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                  </div>
                  {/* Print button */}
                  <button onClick={(e) => { e.stopPropagation(); setPrintModal(dress) }}
                    style={{ width: '100%', padding: '7px 0', borderRadius: 8, border: `1px solid ${C.border}`, background: '#fff', color: C.gray, fontSize: 11, fontWeight: 500, cursor: 'pointer', minHeight: 'unset', minWidth: 'unset', transition: 'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = C.rosa; e.currentTarget.style.color = C.rosa }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.gray }}>
                    🖨 Print label
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {printModal && <SingleQRModal dress={printModal} onClose={() => setPrintModal(null)}/>}
    </div>
  )
}
