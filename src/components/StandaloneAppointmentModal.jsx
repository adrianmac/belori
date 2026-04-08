import React, { useState, useRef, useEffect } from 'react';
import { C } from '../lib/colors';
import { PrimaryBtn, GhostBtn, inputSt, LBL, useToast } from '../lib/ui.jsx';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

const APPT_TYPES = [
  { value: 'consultation', label: 'Consultation' },
  { value: 'measurement', label: 'Measurements' },
  { value: 'fitting', label: 'Fitting' },
  { value: 'pickup', label: 'Pickup' },
  { value: 'return', label: 'Return' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'other', label: 'Other' },
];

export default function StandaloneAppointmentModal({ clients = [], staff = [], onClose, onSaved, initialDate = '' }) {
  const { boutique } = useAuth();
  const toast = useToast();

  const [type, setType] = useState('consultation');
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState('10:00');
  const [staffId, setStaffId] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  // Client search state
  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState(null); // existing client object or null
  const [isWalkIn, setIsWalkIn] = useState(false);            // true when using walk-in name
  const [phone, setPhone] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef(null);
  const dropdownRef = useRef(null);

  // Filter clients by search text
  const filtered = search.trim().length > 0
    ? clients.filter(c => c.name?.toLowerCase().includes(search.trim().toLowerCase())).slice(0, 8)
    : [];
  const showWalkInOption = search.trim().length > 0 && !selectedClient;

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target) &&
        searchRef.current && !searchRef.current.contains(e.target)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearch(val);
    setSelectedClient(null);
    setIsWalkIn(false);
    setPhone('');
    setShowDropdown(true);
  };

  const selectClient = (client) => {
    setSelectedClient(client);
    setIsWalkIn(false);
    setSearch(client.name);
    setPhone(client.phone || '');
    setShowDropdown(false);
  };

  const selectWalkIn = () => {
    setSelectedClient(null);
    setIsWalkIn(true);
    setShowDropdown(false);
  };

  const clearClient = () => {
    setSelectedClient(null);
    setIsWalkIn(false);
    setSearch('');
    setPhone('');
    setShowDropdown(false);
  };

  function formatTime(t) {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
  }

  const save = async () => {
    const clientName = search.trim();
    if (!clientName) return setErr('Enter a client name or walk-in name');
    if (!date) return setErr('Date is required');
    setSaving(true);
    setErr('');
    const clientPhone = phone.trim() || selectedClient?.phone || null;
    const { error } = await supabase.from('appointments').insert({
      boutique_id: boutique.id,
      event_id: null,
      client_id: selectedClient?.id || null,
      client_name: clientName,
      client_phone: clientPhone,
      type,
      date,
      time: time || null,
      note: note.trim() || null,
      staff_id: staffId || null,
      status: 'scheduled',
    });
    setSaving(false);
    if (error) { setErr(error.message); return; }
    // Fire-and-forget confirmation SMS if phone is known
    if (clientPhone) {
      const firstName = clientName.split(' ')[0] || 'there';
      const timeStr = time ? ` at ${formatTime(time)}` : '';
      supabase.functions.invoke('send-sms', {
        body: {
          to: clientPhone,
          message: `Hi ${firstName}, your ${type.replace(/_/g, ' ')} appointment at ${boutique.name} is confirmed for ${date}${timeStr}. Reply STOP to opt out.`,
        },
      }).catch(() => {}); // fire and forget
    }
    toast('Appointment scheduled');
    onSaved();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 16,
    }}>
      <div style={{
        background: C.white, borderRadius: 16, width: 460, maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 20px', borderBottom: `1px solid ${C.border}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
        }}>
          <div>
            <span style={{ fontWeight: 600, fontSize: 15, color: C.ink }}>New appointment</span>
            <span style={{
              marginLeft: 8, fontSize: 10, padding: '2px 7px', borderRadius: 999,
              background: C.rosaPale, color: C.rosa, fontWeight: 500,
            }}>Standalone</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: C.gray, lineHeight: 1 }}>×</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {err && (
            <div style={{ fontSize: 12, color: '#dc2626', background: '#fef2f2', padding: '8px 12px', borderRadius: 7, border: '1px solid #fecaca' }}>
              {err}
            </div>
          )}

          {/* Appointment type */}
          <div>
            <div style={{ ...LBL }}>Appointment type</div>
            <select value={type} onChange={e => setType(e.target.value)} style={{ ...inputSt }}>
              {APPT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          {/* Date + Time */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <div style={{ ...LBL }}>Date *</div>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inputSt }} />
            </div>
            <div>
              <div style={{ ...LBL }}>Time</div>
              <input type="time" value={time} onChange={e => setTime(e.target.value)} style={{ ...inputSt }} />
            </div>
          </div>

          {/* Client search */}
          <div style={{ position: 'relative' }}>
            <div style={{ ...LBL, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Client *</span>
              {(selectedClient || isWalkIn) && (
                <button onClick={clearClient} style={{ fontSize: 11, color: C.rosa, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 500 }}>
                  Clear
                </button>
              )}
            </div>
            <div style={{ position: 'relative' }}>
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={handleSearchChange}
                onFocus={() => search.trim().length > 0 && setShowDropdown(true)}
                placeholder="Search clients or enter a name…"
                style={{
                  ...inputSt,
                  borderColor: selectedClient ? C.rosa : isWalkIn ? C.champagne : C.border,
                  paddingRight: (selectedClient || isWalkIn) ? 32 : 10,
                }}
              />
              {selectedClient && (
                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: C.rosa }}>✓</span>
              )}
              {isWalkIn && (
                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: C.champagne, fontWeight: 600 }}>Walk-in</span>
              )}
            </div>

            {/* Dropdown */}
            {showDropdown && (filtered.length > 0 || showWalkInOption) && (
              <div
                ref={dropdownRef}
                style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                  background: C.white, border: `1px solid ${C.border}`, borderRadius: 8,
                  boxShadow: '0 6px 20px rgba(0,0,0,0.10)', marginTop: 3,
                  maxHeight: 220, overflowY: 'auto',
                }}
              >
                {filtered.map(c => (
                  <div
                    key={c.id}
                    onMouseDown={() => selectClient(c)}
                    style={{
                      padding: '9px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                      borderBottom: `1px solid ${C.border}`,
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = C.rosaPale}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%', background: C.rosaPale,
                      color: C.rosa, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 600, flexShrink: 0,
                    }}>
                      {(c.name || '?').slice(0, 2).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: C.ink }}>{c.name}</div>
                      {c.phone && <div style={{ fontSize: 11, color: C.gray }}>{c.phone}</div>}
                    </div>
                  </div>
                ))}
                {showWalkInOption && (
                  <div
                    onMouseDown={selectWalkIn}
                    style={{
                      padding: '9px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                      background: C.ivory,
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = C.amberBg}
                    onMouseLeave={e => e.currentTarget.style.background = C.ivory}
                  >
                    <span style={{ fontSize: 14 }}>+</span>
                    <span style={{ fontSize: 12, color: C.amber, fontWeight: 500 }}>
                      Use "{search.trim()}" as walk-in
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Phone */}
          <div>
            <div style={{ ...LBL }}>Phone <span style={{ fontWeight: 400, color: C.gray }}>(optional)</span></div>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="e.g. +1 555 000 0000"
              style={{ ...inputSt }}
            />
          </div>

          {/* Staff */}
          <div>
            <div style={{ ...LBL }}>Staff member <span style={{ fontWeight: 400, color: C.gray }}>(optional)</span></div>
            <select value={staffId} onChange={e => setStaffId(e.target.value)} style={{ ...inputSt }}>
              <option value="">Unassigned</option>
              {(staff || []).map(s => <option key={s.id} value={s.id}>{s.name} — {s.role}</option>)}
            </select>
          </div>

          {/* Notes */}
          <div>
            <div style={{ ...LBL }}>Notes <span style={{ fontWeight: 400, color: C.gray }}>(optional)</span></div>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              placeholder="Any details for the appointment…"
              style={{ ...inputSt, resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px', borderTop: `1px solid ${C.border}`,
          display: 'flex', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <GhostBtn label="Cancel" colorScheme="danger" onClick={onClose} />
          <PrimaryBtn label={saving ? 'Saving…' : 'Schedule appointment'} onClick={save} disabled={saving} />
        </div>
      </div>
    </div>
  );
}
