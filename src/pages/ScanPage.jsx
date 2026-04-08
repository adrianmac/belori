import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const CAT_LABELS = {
  bridal_gown: 'Bridal Gown', quince_gown: 'Quinceañera Gown',
  veil: 'Veil', tiara: 'Tiara', jewelry: 'Jewelry', shoes: 'Shoes',
  bolero: 'Bolero', gloves: 'Gloves', decoration: 'Decoration',
  chair: 'Chair', table_linen: 'Table Linen', lighting: 'Lighting', other: 'Other',
}

const STATUS_CFG = {
  available:  { label: 'Available',   color: '#15803D', bg: '#F0FDF4', dot: '#22C55E' },
  reserved:   { label: 'Reserved',    color: '#1D4ED8', bg: '#EFF6FF', dot: '#60A5FA' },
  rented:     { label: 'Rented',      color: '#C9697A', bg: '#FDF5F6', dot: '#C9697A' },
  picked_up:  { label: 'Picked Up',   color: '#7C3AED', bg: '#F5F3FF', dot: '#A78BFA' },
  returned:   { label: 'Returned',    color: '#92400E', bg: '#FFFBEB', dot: '#FCD34D' },
  cleaning:   { label: 'Cleaning',    color: '#0369A1', bg: '#F0F9FF', dot: '#38BDF8' },
  damaged:    { label: 'Damaged',     color: '#B91C1C', bg: '#FEF2F2', dot: '#F87171' },
}

function getActions(status, isAuthenticated, onAction, setScreen) {
  const navigate = (screen) => onAction(screen)
  switch (status) {
    case 'available':
      return [
        { label: 'Reserve for event', primary: true,  onClick: () => navigate('reserve') },
        { label: 'View in inventory',  primary: false, onClick: () => navigate('inventory') },
      ]
    case 'reserved':
      return [
        { label: 'Mark picked up',     primary: true,  onClick: () => navigate('pickup') },
        { label: 'View rental details', primary: false, onClick: () => navigate('rental') },
        { label: 'View in inventory',  primary: false, onClick: () => navigate('inventory') },
      ]
    case 'rented':
    case 'picked_up':
      return [
        { label: 'Log return',          primary: true,  onClick: () => navigate('return') },
        { label: 'View rental details', primary: false, onClick: () => navigate('rental') },
        { label: 'View event',          primary: false, onClick: () => navigate('event') },
      ]
    case 'returned':
      return [
        { label: 'Send to cleaning',    primary: true,  onClick: () => navigate('cleaning') },
        { label: 'View rental details', primary: false, onClick: () => navigate('rental') },
      ]
    case 'cleaning':
      return [
        { label: 'Mark cleaned & available', primary: true,  onClick: () => navigate('cleaned') },
        { label: 'View in inventory',        primary: false, onClick: () => navigate('inventory') },
      ]
    default:
      return [{ label: 'View in inventory', primary: true, onClick: () => navigate('inventory') }]
  }
}

export default function ScanPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { session, boutique } = useAuth()
  const [dress, setDress]         = useState(null)
  const [client, setClient]       = useState(null)
  const [loading, setLoading]     = useState(true)
  const [notFound, setNotFound]   = useState(false)
  const [actionMsg, setActionMsg] = useState('')
  const [updating, setUpdating]   = useState(false)

  useEffect(() => {
    if (!id) { setNotFound(true); setLoading(false); return }
    supabase
      .from('inventory')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) { setNotFound(true) }
        else {
          setDress(data)
          if (data.client_id) {
            supabase.from('clients').select('name, phone, email').eq('id', data.client_id).single()
              .then(({ data: c }) => setClient(c))
          }
        }
        setLoading(false)
      })
  }, [id])

  const handleAction = async (action) => {
    if (!session) {
      // Redirect to login with return URL
      navigate(`/login?redirect=/scan/${id}`)
      return
    }
    if (action === 'inventory') {
      navigate('/')
      return
    }
    if (action === 'return') {
      setUpdating(true)
      const { error } = await supabase.from('inventory').update({ status: 'returned', return_date_confirmed: new Date().toISOString().split('T')[0] }).eq('id', id)
      setUpdating(false)
      if (!error) { setDress(d => ({ ...d, status: 'returned' })); setActionMsg('Return logged ✓') }
      return
    }
    if (action === 'pickup') {
      setUpdating(true)
      const { error } = await supabase.from('inventory').update({ status: 'picked_up', pickup_date: new Date().toISOString().split('T')[0] }).eq('id', id)
      setUpdating(false)
      if (!error) { setDress(d => ({ ...d, status: 'picked_up' })); setActionMsg('Marked as picked up ✓') }
      return
    }
    if (action === 'cleaning') {
      setUpdating(true)
      const { error } = await supabase.from('inventory').update({ status: 'cleaning' }).eq('id', id)
      setUpdating(false)
      if (!error) { setDress(d => ({ ...d, status: 'cleaning' })); setActionMsg('Sent to cleaning ✓') }
      return
    }
    if (action === 'cleaned') {
      setUpdating(true)
      const { error } = await supabase.from('inventory').update({ status: 'available', last_cleaned: new Date().toISOString().split('T')[0], client_id: null }).eq('id', id)
      setUpdating(false)
      if (!error) { setDress(d => ({ ...d, status: 'available', last_cleaned: new Date().toISOString().split('T')[0] })); setActionMsg('Marked as cleaned & available ✓') }
      return
    }
    setActionMsg('Please open the full app to complete this action.')
  }

  const PRIMARY = '#C9697A'

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fdf8f8', fontFamily: 'Inter,system-ui,sans-serif' }}>
      <div style={{ textAlign: 'center', color: '#9ca3af' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🌸</div>
        <div style={{ fontSize: 14 }}>Loading dress…</div>
      </div>
    </div>
  )

  if (notFound) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fdf8f8', fontFamily: 'Inter,system-ui,sans-serif', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 340 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#111', marginBottom: 8 }}>Dress not found</div>
        <div style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.6 }}>This QR code doesn't match any dress in inventory. It may have been removed.</div>
      </div>
    </div>
  )

  const cfg = STATUS_CFG[dress.status] || STATUS_CFG.available
  const actions = getActions(dress.status, !!session, handleAction)

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', fontFamily: 'Inter,system-ui,sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #E5E7EB', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 28, height: 28, borderRadius: 7, background: PRIMARY, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="16" height="16" viewBox="0 0 32 32" fill="none">
            <path d="M7 25V7l18 18V7" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#111', lineHeight: 1 }}>Belori</div>
          {boutique?.name && <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}>{boutique.name}</div>}
        </div>
        <div style={{ flex: 1 }}/>
        {!session && (
          <button onClick={() => navigate(`/login?redirect=/scan/${id}`)}
            style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: PRIMARY, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', minHeight: 'unset', minWidth: 'unset' }}>
            Sign in
          </button>
        )}
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Dress info card */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E5E7EB', padding: 20, boxShadow: '0 1px 8px rgba(0,0,0,0.05)' }}>
          <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>#{dress.sku}</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#111', marginBottom: 4 }}>{dress.name}</div>
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 14 }}>
            {[dress.size && `Size ${dress.size}`, dress.color, CAT_LABELS[dress.category] || dress.category].filter(Boolean).join(' · ')}
          </div>

          {/* Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 10, background: cfg.bg }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }}/>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: cfg.color }}>{cfg.label}</div>
              {client && (
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 1 }}>
                  {['rented', 'picked_up', 'reserved'].includes(dress.status) ? 'For' : 'Last rented to'}: <strong style={{ color: '#374151' }}>{client.name}</strong>
                </div>
              )}
            </div>
          </div>

          {/* Rental details */}
          {(dress.return_date || dress.pickup_date || dress.last_cleaned) && (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 12, borderTop: '1px solid #F3F4F6' }}>
              {dress.return_date && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: '#9ca3af' }}>Return due</span>
                  <span style={{ color: new Date(dress.return_date) < new Date() ? '#DC2626' : '#374151', fontWeight: 500 }}>
                    {new Date(dress.return_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    {new Date(dress.return_date) < new Date() ? ' — OVERDUE' : ''}
                  </span>
                </div>
              )}
              {dress.pickup_date && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: '#9ca3af' }}>Picked up</span>
                  <span style={{ color: '#374151', fontWeight: 500 }}>{new Date(dress.pickup_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </div>
              )}
              {dress.last_cleaned && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: '#9ca3af' }}>Last cleaned</span>
                  <span style={{ color: '#374151', fontWeight: 500 }}>{new Date(dress.last_cleaned).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </div>
              )}
              {dress.notes && (
                <div style={{ fontSize: 11, color: '#9ca3af', fontStyle: 'italic', marginTop: 4 }}>{dress.notes}</div>
              )}
            </div>
          )}
        </div>

        {/* Action feedback */}
        {actionMsg && (
          <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#15803D', fontWeight: 500 }}>
            ✓ {actionMsg}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {!session && (
            <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#92400E', marginBottom: 4 }}>
              Sign in to take actions on this dress.
            </div>
          )}
          {actions.map((a, i) => (
            <button key={i} onClick={a.onClick} disabled={updating}
              style={{
                width: '100%', padding: '14px 16px', borderRadius: 12,
                border: `1.5px solid ${a.primary ? PRIMARY : '#E5E7EB'}`,
                background: a.primary ? '#FDF5F6' : '#fff',
                color: a.primary ? PRIMARY : '#374151',
                fontSize: 14, fontWeight: a.primary ? 600 : 400,
                cursor: updating ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                minHeight: 'unset', minWidth: 'unset',
                opacity: updating ? 0.7 : 1, transition: 'opacity 0.15s',
              }}>
              <span>{updating && a.primary ? 'Updating…' : a.label}</span>
              <span style={{ fontSize: 16, opacity: 0.6 }}>→</span>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', fontSize: 11, color: '#d1d5db', marginTop: 8 }}>
          Powered by <span style={{ fontWeight: 600, color: '#9ca3af' }}>Belori</span>
        </div>
      </div>
    </div>
  )
}
