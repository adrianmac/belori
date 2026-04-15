import React, { useState, useEffect } from 'react';
import { C } from '../lib/colors';
import { Avatar } from '../lib/ui.jsx';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import ClientPhoneLookup from '../components/clients/ClientPhoneLookup';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() || '?';
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ─── Recent client row (compact) ─────────────────────────────────────────────

function RecentClientRow({ client, onSelect }) {
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
        padding: '9px 14px',
        cursor: 'pointer',
        background: hovered ? C.rosaPale : C.white,
        borderBottom: `1px solid ${C.border}`,
        transition: 'background 0.12s ease',
      }}
    >
      <div style={{
        width: 32,
        height: 32,
        borderRadius: '50%',
        background: C.rosaPale,
        color: C.rosaText,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 12,
        fontWeight: 700,
        flexShrink: 0,
        border: `1px solid ${C.petal}`,
      }}>
        {getInitials(client.name)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {client.name}
        </div>
        {client.phone && (
          <div style={{ fontSize: 11, color: C.gray, marginTop: 1 }}>
            {client.phone}
          </div>
        )}
      </div>
      <span style={{ fontSize: 13, color: C.rosaLight, flexShrink: 0 }}>›</span>
    </div>
  );
}

// ─── Selected client card ─────────────────────────────────────────────────────

function SelectedClientCard({ client, onViewProfile, onClear }) {
  return (
    <div style={{
      border: `2px solid ${C.rosa}`,
      borderRadius: 12,
      overflow: 'hidden',
      boxShadow: '0 2px 12px rgba(201,105,122,0.12)',
    }}>
      {/* Card header */}
      <div style={{
        padding: '10px 16px',
        background: C.rosaPale,
        borderBottom: `1px solid ${C.petal}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.rosaText, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Selected client / Cliente seleccionado
        </div>
        <button
          onClick={onClear}
          style={{
            background: 'none',
            border: 'none',
            fontSize: 12,
            color: C.gray,
            cursor: 'pointer',
            padding: '2px 6px',
            textDecoration: 'underline',
          }}
        >
          Clear / Limpiar
        </button>
      </div>

      {/* Client info */}
      <div style={{
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        background: C.white,
      }}>
        <div style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: C.rosaPale,
          color: C.rosaText,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 16,
          fontWeight: 700,
          flexShrink: 0,
          border: `2px solid ${C.petal}`,
        }}>
          {getInitials(client.name)}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: C.ink }}>
            {client.name}
          </div>
          {client.phone && (
            <div style={{ fontSize: 13, color: C.gray, marginTop: 2 }}>
              {client.phone}
            </div>
          )}
          {client.email && (
            <div style={{ fontSize: 12, color: C.gray, marginTop: 1 }}>
              {client.email}
            </div>
          )}
        </div>

        <button
          onClick={onViewProfile}
          style={{
            background: C.rosa,
            color: C.white,
            border: 'none',
            borderRadius: 8,
            padding: '8px 14px',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            flexShrink: 0,
            whiteSpace: 'nowrap',
          }}
        >
          View full profile
        </button>
      </div>
    </div>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ClientLookupScreen({ setScreen }) {
  const { boutique } = useAuth();
  const [selectedClient, setSelectedClient] = useState(null);
  const [recentClients, setRecentClients] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(true);

  // Load recent clients
  useEffect(() => {
    if (!boutique?.id) return;
    loadRecentClients();
  }, [boutique?.id]);

  async function loadRecentClients() {
    setLoadingRecent(true);
    try {
      const { data } = await supabase
        .from('clients')
        .select('id, name, phone, email, created_at')
        .eq('boutique_id', boutique.id)
        .order('created_at', { ascending: false })
        .limit(8);
      setRecentClients(data || []);
    } catch (e) {
      console.error('ClientLookupScreen recent clients error:', e);
    } finally {
      setLoadingRecent(false);
    }
  }

  function handleClientSelected(client) {
    setSelectedClient(client);
    // Scroll to top so the selected card is visible
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleViewProfile() {
    // NovelApp passes setScreen as the navigation handler
    if (setScreen) setScreen('clients');
  }

  function handleClear() {
    setSelectedClient(null);
  }

  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      background: C.ivory,
      padding: '24px 20px 48px',
    }}>
      {/* ── Page header ── */}
      <div style={{ marginBottom: 24, maxWidth: 480 }}>
        <h1 style={{
          margin: 0,
          fontSize: 22,
          fontWeight: 700,
          color: C.ink,
          lineHeight: 1.2,
        }}>
          Client Lookup / Buscar cliente
        </h1>
        <p style={{
          margin: '6px 0 0',
          fontSize: 13,
          color: C.gray,
          lineHeight: 1.5,
        }}>
          Search by phone number to find or create a client profile
          <br />
          <span style={{ fontSize: 11 }}>
            Busca por número de teléfono para encontrar o crear un perfil de cliente
          </span>
        </p>
      </div>

      {/* ── Lookup area (max 480px centered on larger screens) ── */}
      <div style={{ maxWidth: 480 }}>

        {/* Selected client card */}
        {selectedClient && (
          <div style={{ marginBottom: 20 }}>
            <SelectedClientCard
              client={selectedClient}
              onViewProfile={handleViewProfile}
              onClear={handleClear}
            />
          </div>
        )}

        {/* Phone lookup component */}
        {!selectedClient && (
          <div style={{
            background: C.white,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding: '18px 16px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            marginBottom: 28,
          }}>
            <ClientPhoneLookup
              onClientSelected={handleClientSelected}
              boutiqueId={boutique?.id}
            />
          </div>
        )}

        {/* Search again option when client is selected — simple link, not a duplicate lookup */}
        {selectedClient && (
          <button
            onClick={handleClear}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: C.rosaText, fontSize: 12, fontWeight: 500,
              padding: '4px 0', marginBottom: 12, display: 'block',
            }}
          >
            ← Search again / Buscar de nuevo
          </button>
        )}

        {/* ── Recent clients ── */}
        <div>
          <div style={{
            fontSize: 12,
            fontWeight: 700,
            color: C.gray,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom: 10,
          }}>
            Recent clients / Clientes recientes
          </div>

          {loadingRecent ? (
            <div style={{
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              overflow: 'hidden',
              background: C.white,
            }}>
              {[...Array(3)].map((_, i) => (
                <div key={i} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '9px 14px',
                  borderBottom: i < 2 ? `1px solid ${C.border}` : 'none',
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: C.border,
                    animation: 'beloriPulse 1.4s ease-in-out infinite',
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ width: '55%', height: 12, borderRadius: 4, background: C.border, marginBottom: 6 }} />
                    <div style={{ width: '35%', height: 10, borderRadius: 4, background: C.border }} />
                  </div>
                </div>
              ))}
            </div>
          ) : recentClients.length === 0 ? (
            <div style={{
              padding: '24px 16px',
              textAlign: 'center',
              color: C.gray,
              fontSize: 13,
              background: C.white,
              border: `1px solid ${C.border}`,
              borderRadius: 10,
            }}>
              No clients yet / Aún no hay clientes
            </div>
          ) : (
            <div style={{
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              overflow: 'hidden',
              background: C.white,
              boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
            }}>
              {recentClients.map((client, i) => (
                <RecentClientRow
                  key={client.id}
                  client={client}
                  onSelect={handleClientSelected}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes beloriPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }
      `}</style>
    </div>
  );
}
