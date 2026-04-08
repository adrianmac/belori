import React, { useState, useMemo } from 'react'
import { C } from '../lib/colors'
import { Topbar, PrimaryBtn, GhostBtn, inputSt, LBL, useToast } from '../lib/ui.jsx'
import { useVendors } from '../hooks/useVendors'

// ─── CATEGORY CONFIG ────────────────────────────────────────────────────────
const CATEGORIES = ['florist', 'photographer', 'dj', 'catering', 'videographer', 'hair_makeup', 'venue', 'other']

const CAT_LABELS = {
  florist:      'Florist',
  photographer: 'Photographer',
  dj:           'DJ',
  catering:     'Catering',
  videographer: 'Videographer',
  hair_makeup:  'Hair & Makeup',
  venue:        'Venue',
  other:        'Other',
}

const CAT_COLORS = {
  florist:      { bg: '#FDF2F8', color: '#9D174D' },
  photographer: { bg: C.purpleBg, color: C.purple },
  dj:           { bg: '#FFF7ED', color: '#C2410C' },
  catering:     { bg: C.greenBg, color: C.green },
  videographer: { bg: C.blueBg, color: C.blue },
  hair_makeup:  { bg: '#F0FDFA', color: '#0F766E' },
  venue:        { bg: C.amberBg, color: C.amber },
  other:        { bg: C.grayBg, color: C.gray },
}

const BLANK_FORM = {
  name: '', category: 'florist', phone: '', email: '',
  website: '', instagram: '', rating: null, notes: '',
}

// ─── STAR PICKER ────────────────────────────────────────────────────────────
function StarPicker({ value, onChange }) {
  const [hovered, setHovered] = useState(null)
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <span
          key={n}
          onClick={() => onChange(value === n ? null : n)}
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(null)}
          style={{
            fontSize: 22,
            cursor: 'pointer',
            color: n <= (hovered ?? value ?? 0) ? '#F59E0B' : C.border,
            transition: 'color 0.1s',
            lineHeight: 1,
          }}
        >★</span>
      ))}
    </div>
  )
}

// ─── VENDOR CARD ────────────────────────────────────────────────────────────
function VendorCard({ vendor, onEdit, onDelete }) {
  const cat = CAT_COLORS[vendor.category] || CAT_COLORS.other
  const stars = vendor.rating ? Array.from({ length: 5 }, (_, i) => i < vendor.rating ? '★' : '☆').join('') : null

  return (
    <div style={{
      background: C.white,
      border: `1px solid ${C.border}`,
      borderRadius: 12,
      padding: 16,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{
            display: 'inline-block', fontSize: 10, fontWeight: 600,
            padding: '2px 8px', borderRadius: 999,
            background: cat.bg, color: cat.color,
            marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em',
          }}>
            {CAT_LABELS[vendor.category] || vendor.category}
          </span>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.ink, lineHeight: 1.3 }}>
            {vendor.name}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button onClick={() => onEdit(vendor)}
            style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 7, padding: '4px 8px', cursor: 'pointer', color: C.gray, fontSize: 12, lineHeight: 1 }}
            title="Edit">✏️</button>
          <button onClick={() => onDelete(vendor)}
            style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 7, padding: '4px 8px', cursor: 'pointer', color: C.red, fontSize: 12, lineHeight: 1 }}
            title="Delete">🗑</button>
        </div>
      </div>

      {/* Rating */}
      {stars ? (
        <div style={{ fontSize: 14, color: '#F59E0B', letterSpacing: 1 }}>{stars}</div>
      ) : (
        <div style={{ fontSize: 12, color: C.gray, fontStyle: 'italic' }}>No rating</div>
      )}

      {/* Contact links */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {vendor.phone && (
          <a href={`tel:${vendor.phone}`} style={{ fontSize: 12, color: C.blue, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 11 }}>📞</span> {vendor.phone}
          </a>
        )}
        {vendor.email && (
          <a href={`mailto:${vendor.email}`} style={{ fontSize: 12, color: C.blue, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 11 }}>✉️</span> {vendor.email}
          </a>
        )}
        {vendor.website && (
          <a href={vendor.website.startsWith('http') ? vendor.website : 'https://' + vendor.website}
            target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 12, color: C.blue, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 11 }}>🌐</span> {vendor.website}
          </a>
        )}
        {vendor.instagram && (
          <a href={`https://instagram.com/${vendor.instagram.replace('@', '')}`}
            target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 12, color: '#E1306C', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 11 }}>📷</span> @{vendor.instagram.replace('@', '')}
          </a>
        )}
      </div>

      {/* Notes snippet */}
      {vendor.notes && (
        <div style={{ fontSize: 12, color: C.gray, lineHeight: 1.4, borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>
          {vendor.notes.length > 80 ? vendor.notes.slice(0, 80) + '…' : vendor.notes}
        </div>
      )}
    </div>
  )
}

// ─── ADD / EDIT MODAL ───────────────────────────────────────────────────────
function VendorModal({ vendor, onClose, onSave }) {
  const [form, setForm] = useState(vendor ? { ...vendor } : { ...BLANK_FORM })
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSave() {
    if (!form.name.trim() || !form.category) return
    setSaving(true)
    await onSave(form)
    setSaving(false)
    onClose()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: C.white, borderRadius: 14, width: '100%', maxWidth: 480,
        boxShadow: '0 16px 48px rgba(0,0,0,0.18)', overflow: 'hidden',
      }}>
        {/* Modal header */}
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: C.ink }}>
            {vendor ? 'Edit Vendor' : 'Add Vendor'}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.gray, fontSize: 20, lineHeight: 1, padding: '0 4px' }}>×</button>
        </div>

        {/* Modal body */}
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '70vh', overflowY: 'auto' }}>
          {/* Name */}
          <div>
            <div style={LBL}>Name *</div>
            <input style={inputSt} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Vendor name" autoFocus />
          </div>

          {/* Category */}
          <div>
            <div style={LBL}>Category *</div>
            <select style={inputSt} value={form.category} onChange={e => set('category', e.target.value)}>
              {CATEGORIES.map(c => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
            </select>
          </div>

          {/* Phone & Email */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={LBL}>Phone</div>
              <input style={inputSt} value={form.phone || ''} onChange={e => set('phone', e.target.value)} placeholder="(555) 000-0000" />
            </div>
            <div>
              <div style={LBL}>Email</div>
              <input style={inputSt} value={form.email || ''} onChange={e => set('email', e.target.value)} placeholder="email@example.com" type="email" />
            </div>
          </div>

          {/* Website & Instagram */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={LBL}>Website</div>
              <input style={inputSt} value={form.website || ''} onChange={e => set('website', e.target.value)} placeholder="www.example.com" />
            </div>
            <div>
              <div style={LBL}>Instagram</div>
              <input style={inputSt} value={form.instagram || ''} onChange={e => set('instagram', e.target.value)} placeholder="@handle" />
            </div>
          </div>

          {/* Rating */}
          <div>
            <div style={{ ...LBL, marginBottom: 8 }}>Rating</div>
            <StarPicker value={form.rating} onChange={v => set('rating', v)} />
          </div>

          {/* Notes */}
          <div>
            <div style={LBL}>Notes</div>
            <textarea
              style={{ ...inputSt, minHeight: 72, resize: 'vertical' }}
              value={form.notes || ''}
              onChange={e => set('notes', e.target.value)}
              placeholder="Any notes about this vendor…"
            />
          </div>
        </div>

        {/* Modal footer */}
        <div style={{ padding: '14px 20px', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <GhostBtn label="Cancel" onClick={onClose} />
          <PrimaryBtn label={saving ? 'Saving…' : 'Save'} onClick={handleSave} disabled={saving || !form.name.trim()} />
        </div>
      </div>
    </div>
  )
}

// ─── MAIN PAGE ───────────────────────────────────────────────────────────────
export default function VendorsPage() {
  const { vendors, loading, createVendor, updateVendor, deleteVendor } = useVendors()
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('all')
  const [modal, setModal] = useState(null) // null | 'add' | vendor object
  const [deleteTarget, setDeleteTarget] = useState(null)

  const filtered = useMemo(() => {
    let v = vendors
    if (catFilter !== 'all') v = v.filter(x => x.category === catFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      v = v.filter(x =>
        x.name.toLowerCase().includes(q) ||
        (x.email || '').toLowerCase().includes(q) ||
        (x.phone || '').toLowerCase().includes(q) ||
        (x.notes || '').toLowerCase().includes(q)
      )
    }
    return v
  }, [vendors, catFilter, search])

  async function handleSave(form) {
    const payload = {
      name: form.name.trim(),
      category: form.category,
      phone: form.phone || null,
      email: form.email || null,
      website: form.website || null,
      instagram: form.instagram ? form.instagram.replace('@', '') : null,
      rating: form.rating || null,
      notes: form.notes || null,
    }
    if (form.id) {
      const { error } = await updateVendor(form.id, payload)
      if (error) { toast('Failed to update vendor', 'error'); return }
      toast('Vendor updated')
    } else {
      const { error } = await createVendor(payload)
      if (error) { toast('Failed to add vendor', 'error'); return }
      toast('Vendor added')
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    const { error } = await deleteVendor(deleteTarget.id)
    if (error) { toast('Failed to delete vendor', 'error'); return }
    toast('Vendor deleted')
    setDeleteTarget(null)
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Topbar
        title="Vendors"
        subtitle="Manage your vendor rolodex"
        actions={
          <PrimaryBtn label="+ Add Vendor" onClick={() => setModal('add')} />
        }
      />

      {/* Filters */}
      <div style={{
        padding: '10px 20px',
        background: C.white,
        borderBottom: `1px solid ${C.border}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        flexShrink: 0,
      }}>
        {/* Search */}
        <input
          style={{ ...inputSt, maxWidth: 340 }}
          placeholder="Search vendors…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        {/* Category pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['all', ...CATEGORIES].map(cat => {
            const active = catFilter === cat
            const colors = cat === 'all' ? null : CAT_COLORS[cat]
            return (
              <button
                key={cat}
                onClick={() => setCatFilter(cat)}
                style={{
                  padding: '4px 12px',
                  borderRadius: 999,
                  border: `1px solid ${active ? (colors?.color || C.rosa) : C.border}`,
                  background: active ? (colors?.bg || C.rosaPale) : C.white,
                  color: active ? (colors?.color || C.rosa) : C.gray,
                  fontSize: 12,
                  fontWeight: active ? 600 : 400,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {cat === 'all' ? 'All' : CAT_LABELS[cat]}
              </button>
            )
          })}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: C.gray, padding: 60, fontSize: 14 }}>Loading vendors…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', color: C.gray, padding: 60 }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🤝</div>
            <div style={{ fontSize: 15, fontWeight: 500, color: C.ink, marginBottom: 6 }}>
              {vendors.length === 0 ? 'No vendors yet' : 'No vendors match your search'}
            </div>
            <div style={{ fontSize: 13 }}>
              {vendors.length === 0 ? 'Add your first vendor to start building your rolodex.' : 'Try adjusting your filters.'}
            </div>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 16,
          }}>
            {filtered.map(vendor => (
              <VendorCard
                key={vendor.id}
                vendor={vendor}
                onEdit={v => setModal(v)}
                onDelete={v => setDeleteTarget(v)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {(modal === 'add' || (modal && typeof modal === 'object')) && (
        <VendorModal
          vendor={modal === 'add' ? null : modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}

      {/* Delete Confirm */}
      {deleteTarget && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }} onClick={e => e.target === e.currentTarget && setDeleteTarget(null)}>
          <div style={{
            background: C.white, borderRadius: 14, padding: 24, maxWidth: 360, width: '100%',
            boxShadow: '0 16px 48px rgba(0,0,0,0.18)',
          }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.ink, marginBottom: 8 }}>Delete vendor?</div>
            <div style={{ fontSize: 13, color: C.gray, marginBottom: 20 }}>
              Are you sure you want to delete <strong>{deleteTarget.name}</strong>? This cannot be undone.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <GhostBtn label="Cancel" onClick={() => setDeleteTarget(null)} />
              <PrimaryBtn label="Delete" onClick={handleDelete} colorScheme="danger" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
