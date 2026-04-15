import React, { useState, useEffect, useRef, useCallback } from 'react';
import { C } from '../../lib/colors';
import { inputSt, LBL, PrimaryBtn, GhostBtn, useToast } from '../../lib/ui.jsx';
import { supabase } from '../../lib/supabase';

// ─── Phone formatting helpers ────────────────────────────────────────────────

function stripNonDigits(str) {
  return str.replace(/\D/g, '');
}

function formatPhone(digits) {
  if (!digits) return '';
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  // 11+ digits — show with country code prefix
  return `+${digits.slice(0, digits.length - 10)} (${digits.slice(-10, -7)}) ${digits.slice(-7, -4)}-${digits.slice(-4)}`;
}

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() || '?';
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ─── Client row ──────────────────────────────────────────────────────────────

function ClientRow({ client, onSelect }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(client)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onSelect(client); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 14px',
        cursor: 'pointer',
        background: hovered ? C.rosaPale : C.white,
        borderBottom: `1px solid ${C.border}`,
        transition: 'background 0.12s ease',
      }}
    >
      {/* Avatar */}
      <div style={{
        width: 36,
        height: 36,
        borderRadius: '50%',
        background: C.rosaPale,
        color: C.rosaText,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 13,
        fontWeight: 700,
        flexShrink: 0,
        border: `1px solid ${C.petal}`,
      }}>
        {getInitials(client.name)}
      </div>

      {/* Details */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: C.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {client.name}
        </div>
        <div style={{ fontSize: 12, color: C.gray, marginTop: 1 }}>
          {client.phone}
        </div>
        {client.email && (
          <div style={{ fontSize: 11, color: C.gray, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {client.email}
          </div>
        )}
      </div>

      {/* Chevron hint */}
      <span style={{ fontSize: 14, color: C.rosaLight, flexShrink: 0 }}>›</span>
    </div>
  );
}

// ─── Inline spinner ──────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 0' }}>
      <div style={{
        width: 20,
        height: 20,
        borderRadius: '50%',
        border: `2px solid ${C.border}`,
        borderTopColor: C.rosa,
        animation: 'beloriSpin 0.7s linear infinite',
      }} />
      <style>{`@keyframes beloriSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function ClientPhoneLookup({ onClientSelected, boutiqueId }) {
  const toast = useToast();
  const phoneInputRef = useRef(null);

  // Phone input state
  const [rawDigits, setRawDigits] = useState('');
  const [displayPhone, setDisplayPhone] = useState('');

  // Search state
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false); // true once a search has resolved

  // Create form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [createPhone, setCreatePhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [createErr, setCreateErr] = useState('');

  // Autofocus phone input on mount
  useEffect(() => {
    phoneInputRef.current?.focus();
  }, []);

  // Debounced search
  const searchTimerRef = useRef(null);

  const runSearch = useCallback(async (digits) => {
    if (!boutiqueId) return;
    setLoading(true);
    setSearched(false);
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, phone, email')
        .eq('boutique_id', boutiqueId)
        .ilike('phone', `%${digits}%`)
        .limit(5);

      if (error) throw error;
      setResults(data || []);
    } catch (e) {
      console.error('ClientPhoneLookup search error:', e);
      setResults([]);
    } finally {
      setLoading(false);
      setSearched(true);
    }
  }, [boutiqueId]);

  function handlePhoneChange(e) {
    const raw = stripNonDigits(e.target.value);
    setRawDigits(raw);
    setDisplayPhone(formatPhone(raw));
    setSearched(false);
    setShowCreateForm(false);
    setResults([]);

    // Clear previous debounce
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

    if (raw.length >= 7) {
      searchTimerRef.current = setTimeout(() => runSearch(raw), 300);
    } else {
      setLoading(false);
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  // Reset create phone when rawDigits changes
  useEffect(() => {
    setCreatePhone(formatPhone(rawDigits));
  }, [rawDigits]);

  // ── Create new client ──
  async function handleCreateClient(e) {
    e.preventDefault();
    setCreateErr('');

    if (!firstName.trim()) {
      setCreateErr('First name is required / Se requiere el nombre');
      return;
    }
    if (!lastName.trim()) {
      setCreateErr('Last name is required / Se requiere el apellido');
      return;
    }

    setSaving(true);
    try {
      const fullName = `${firstName.trim()} ${lastName.trim()}`;
      const phoneToSave = stripNonDigits(createPhone) || rawDigits;

      const { data, error } = await supabase
        .from('clients')
        .insert({
          boutique_id: boutiqueId,
          name: fullName,
          phone: createPhone || formatPhone(rawDigits),
        })
        .select('id, name, phone, email')
        .single();

      if (error) throw error;

      toast(`Client created: ${fullName}`);
      onClientSelected(data);
    } catch (e) {
      console.error('ClientPhoneLookup create error:', e);
      setCreateErr(e.message || 'Failed to create client / No se pudo crear el cliente');
      setSaving(false);
    }
  }

  const hasMinDigits = rawDigits.length >= 7;
  const noResults = searched && hasMinDigits && results.length === 0 && !loading;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* ── Phone input ── */}
      <div style={{ marginBottom: 12 }}>
        <label htmlFor="cpl-phone" style={LBL}>Phone number / Número de teléfono</label>
        <input
          id="cpl-phone"
          ref={phoneInputRef}
          type="tel"
          inputMode="numeric"
          value={displayPhone}
          onChange={handlePhoneChange}
          placeholder="(555) 000-0000"
          autoComplete="tel"
          style={{
            ...inputSt,
            fontSize: 16,
            letterSpacing: '0.02em',
          }}
          aria-describedby="phone-lookup-hint"
        />
        <div id="phone-lookup-hint" style={{ fontSize: 11, color: C.gray, marginTop: 4 }}>
          Type 7+ digits to search / Escriba 7+ dígitos para buscar
        </div>
      </div>

      {/* ── Loading ── */}
      {loading && <Spinner />}

      {/* ── Results list ── */}
      {!loading && results.length > 0 && (
        <div style={{
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          marginBottom: 8,
        }}>
          <div style={{
            fontSize: 11,
            color: C.gray,
            fontWeight: 600,
            padding: '6px 14px',
            background: C.grayBg,
            borderBottom: `1px solid ${C.border}`,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            {results.length} match{results.length !== 1 ? 'es' : ''} found
          </div>
          {results.map(client => (
            <ClientRow
              key={client.id}
              client={client}
              onSelect={onClientSelected}
            />
          ))}
        </div>
      )}

      {/* ── No results state ── */}
      {noResults && !showCreateForm && (
        <div style={{
          padding: '18px 16px',
          background: C.grayBg,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
        }}>
          <div style={{ fontSize: 28, lineHeight: 1 }}>🔍</div>
          <div style={{ fontSize: 13, color: C.gray, lineHeight: 1.5 }}>
            No profile found
            <br />
            <span style={{ fontSize: 11 }}>No se encontró ningún perfil</span>
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            style={{
              background: 'none',
              border: `1px solid ${C.rosa}`,
              borderRadius: 8,
              color: C.rosaText,
              fontSize: 13,
              fontWeight: 600,
              padding: '7px 16px',
              cursor: 'pointer',
              marginTop: 4,
            }}
          >
            + Create new client profile
          </button>
        </div>
      )}

      {/* ── Inline create form ── */}
      {showCreateForm && (
        <div style={{
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        }}>
          {/* Form header */}
          <div style={{
            padding: '10px 16px',
            background: C.rosaPale,
            borderBottom: `1px solid ${C.petal}`,
          }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: C.ink }}>
              Create a new client profile
            </div>
            <div style={{ fontSize: 11, color: C.rosaText, marginTop: 2 }}>
              Crear un nuevo perfil de cliente
            </div>
          </div>

          <form onSubmit={handleCreateClient} style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* First + Last name row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label htmlFor="cpl-first-name" style={LBL}>First name / Nombre *</label>
                <input
                  id="cpl-first-name"
                  type="text"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  required
                  autoFocus
                  placeholder="Maria"
                  style={inputSt}
                />
              </div>
              <div>
                <label htmlFor="cpl-last-name" style={LBL}>Last name / Apellido *</label>
                <input
                  id="cpl-last-name"
                  type="text"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  required
                  placeholder="García"
                  style={inputSt}
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label htmlFor="cpl-create-phone" style={LBL}>Phone / Teléfono</label>
              <input
                id="cpl-create-phone"
                type="tel"
                value={createPhone}
                onChange={e => setCreatePhone(e.target.value)}
                style={inputSt}
              />
            </div>

            {/* Spelling warning */}
            <div style={{
              fontSize: 12,
              color: C.amber,
              fontStyle: 'italic',
              lineHeight: 1.4,
            }}>
              Verify spelling before saving / Verifique la ortografía antes de guardar
            </div>

            {/* Error */}
            {createErr && (
              <div style={{
                fontSize: 12,
                color: C.red,
                background: C.redBg,
                border: `1px solid ${C.dangerBorder}`,
                borderRadius: 7,
                padding: '7px 10px',
                lineHeight: 1.5,
              }}>
                {createErr}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 2 }}>
              <GhostBtn
                label="Cancel"
                onClick={() => setShowCreateForm(false)}
                disabled={saving}
              />
              <PrimaryBtn
                label={saving ? 'Saving…' : 'Save client / Guardar cliente'}
                onClick={handleCreateClient}
                disabled={saving}
              />
            </div>

          </form>
        </div>
      )}
    </div>
  );
}
