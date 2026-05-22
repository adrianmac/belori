import React, { useState, useEffect, useRef, useCallback } from 'react'
import { C } from '../lib/colors'
import { Topbar, PrimaryBtn, GhostBtn, inputSt, useToast } from '../lib/ui'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { useSmsMessages } from '../hooks/useSmsMessages'

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function fmtTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  const diffMs = now - d
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffDays === 0) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } else if (diffDays === 1) {
    return 'Yesterday'
  } else if (diffDays < 7) {
    return d.toLocaleDateString([], { weekday: 'short' })
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function fmtFullTime(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleString([], {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function truncate(str, n = 42) {
  if (!str) return ''
  return str.length > n ? str.slice(0, n) + '…' : str
}

// ─── NEW CONVERSATION MODAL ───────────────────────────────────────────────────

function NewConversationModal({ onClose, onSelect, existingClientIds }) {
  const { boutique } = useAuth()
  const [query, setQuery] = useState('')
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!boutique) return
    if (query.trim().length < 1) {
      setClients([])
      return
    }
    const timer = setTimeout(() => search(), 300)
    return () => clearTimeout(timer)
  }, [query, boutique?.id])

  async function search() {
    setLoading(true)
    const { data } = await supabase
      .from('clients')
      .select('id, name, phone')
      .eq('boutique_id', boutique.id)
      .ilike('name', `%${query.trim()}%`)
      .order('name')
      .limit(20)
    setClients(data || [])
    setLoading(false)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000,
    }} onClick={onClose}>
      <div style={{
        background: C.white, borderRadius: 12, padding: 24, width: 400,
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontWeight: 600, fontSize: 16, color: C.ink }}>New Conversation</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: C.gray, lineHeight: 1 }} aria-label="Close">×</button>
        </div>
        <input
          autoFocus
          style={{ ...inputSt, marginBottom: 12 }}
          placeholder="Search client by name…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <div style={{ maxHeight: 280, overflowY: 'auto' }}>
          {loading && (
            <div style={{ padding: '12px 0', textAlign: 'center', color: C.gray, fontSize: 13 }}>Searching…</div>
          )}
          {!loading && query.trim() && clients.length === 0 && (
            <div style={{ padding: '12px 0', textAlign: 'center', color: C.gray, fontSize: 13 }}>No clients found</div>
          )}
          {!loading && !query.trim() && (
            <div style={{ padding: '12px 0', textAlign: 'center', color: C.gray, fontSize: 13 }}>Type a name to search clients</div>
          )}
          {clients.map(c => (
            <div
              key={c.id}
              onClick={() => onSelect(c)}
              style={{
                padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = C.rosaPale}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ fontWeight: 500, color: C.ink, fontSize: 14 }}>{c.name}</span>
              <span style={{ color: C.gray, fontSize: 12 }}>{c.phone || 'No phone'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── LEFT PANEL — CLIENT LIST ─────────────────────────────────────────────────

function ClientList({ threads, loading, selectedId, onSelect, onNewConversation, searchQuery, onSearchChange }) {
  return (
    <div style={{
      width: 280, flexShrink: 0, borderRight: `1px solid ${C.border}`,
      display: 'flex', flexDirection: 'column', background: C.white, height: '100%',
    }}>
      {/* Header */}
      <div style={{ padding: '14px 14px 10px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: C.ink }}>Messages</span>
          <button
            onClick={onNewConversation}
            title="New Conversation"
            style={{
              background: C.rosa, color: C.white, border: 'none', borderRadius: 7,
              padding: '5px 11px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            + New
          </button>
        </div>
        <input
          style={{ ...inputSt, fontSize: 13, padding: '7px 10px' }}
          placeholder="Search conversations…"
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
        />
      </div>

      {/* Thread list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && (
          <div style={{ padding: 20, textAlign: 'center', color: C.gray, fontSize: 13 }}>Loading…</div>
        )}
        {!loading && threads.length === 0 && (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: C.gray, fontSize: 13, lineHeight: 1.5 }}>
            No SMS conversations yet.<br />Start a new conversation with a client.
          </div>
        )}
        {threads.map(t => {
          const isSelected = t.client_id === selectedId
          const isUnread = t.direction === 'inbound'
          return (
            <div
              key={t.client_id}
              onClick={() => onSelect(t)}
              style={{
                padding: '11px 14px',
                background: isSelected ? C.rosaPale : 'transparent',
                borderLeft: isSelected ? `3px solid ${C.rosa}` : '3px solid transparent',
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = C.grayBg }}
              onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  {isUnread && (
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.rosa, flexShrink: 0 }} />
                  )}
                  <span style={{
                    fontWeight: isUnread ? 700 : 500,
                    fontSize: 13, color: C.ink,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{t.name}</span>
                </div>
                <span style={{ fontSize: 11, color: C.gray, flexShrink: 0, marginLeft: 6 }}>{fmtTime(t.created_at)}</span>
              </div>
              <div style={{
                fontSize: 12, color: C.gray,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                paddingLeft: isUnread ? 14 : 0,
              }}>
                {t.direction === 'outbound' ? 'You: ' : ''}{truncate(t.body, 38)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── MESSAGE BUBBLE ───────────────────────────────────────────────────────────

function MessageBubble({ msg }) {
  const isOut = msg.direction === 'outbound'
  const isFailed = msg.status === 'failed'
  const isSending = msg.status === 'sending'

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: isOut ? 'flex-end' : 'flex-start',
      marginBottom: 12,
    }}>
      <div style={{
        maxWidth: '72%',
        background: isOut ? C.rosa : C.white,
        color: isOut ? C.white : C.ink,
        borderRadius: isOut ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
        padding: '9px 14px',
        fontSize: 14,
        lineHeight: 1.45,
        boxShadow: isOut ? 'none' : `0 1px 3px rgba(0,0,0,0.09)`,
        border: isOut ? 'none' : `1px solid ${C.border}`,
        opacity: isSending ? 0.65 : 1,
        wordBreak: 'break-word',
      }}>
        {msg.body}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
        <span style={{ fontSize: 11, color: C.gray }}>{fmtFullTime(msg.created_at)}</span>
        {isSending && <span style={{ fontSize: 11, color: C.gray }}>Sending…</span>}
        {isFailed && <span style={{ fontSize: 11, color: C.red }}>⚠ Failed</span>}
      </div>
    </div>
  )
}

// ─── RIGHT PANEL — CONVERSATION ───────────────────────────────────────────────

function ConversationPanel({ client }) {
  const { messages, loading, sendSms } = useSmsMessages(client?.id || null)
  const { addToast } = useToast()
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)
  const textareaRef = useRef(null)

  // Scroll to bottom when messages change
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  async function handleSend() {
    const body = draft.trim()
    if (!body || sending) return
    setSending(true)
    setDraft('')
    const result = await sendSms(body)
    if (result?.error) {
      addToast('Failed to send message. Please try again.', 'error')
    }
    setSending(false)
    textareaRef.current?.focus()
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (!client) {
    return (
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: C.ivory, flexDirection: 'column', gap: 10,
      }}>
        <div style={{ fontSize: 36 }}>💬</div>
        <div style={{ color: C.gray, fontSize: 14 }}>Select a conversation from the left</div>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.ivory, minWidth: 0 }}>
      {/* Conversation header */}
      <div style={{
        padding: '14px 20px', background: C.white,
        borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', gap: 12,
        flexShrink: 0,
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: '50%',
          background: C.rosaPale, color: C.rosaText,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: 14, flexShrink: 0,
        }}>
          {client.name?.charAt(0)?.toUpperCase() || '?'}
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 15, color: C.ink }}>{client.name}</div>
          <div style={{ fontSize: 12, color: C.gray }}>{client.phone || 'No phone number'}</div>
        </div>
      </div>

      {/* Messages area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 8px' }}>
        {loading && (
          <div style={{ textAlign: 'center', color: C.gray, fontSize: 13, padding: 20 }}>Loading…</div>
        )}
        {!loading && messages.length === 0 && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', height: '100%', gap: 8, paddingTop: 40,
          }}>
            <div style={{ fontSize: 32 }}>📨</div>
            <div style={{ color: C.gray, fontSize: 13 }}>No messages yet. Say hello!</div>
          </div>
        )}
        {messages.map(msg => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div style={{
        padding: '12px 16px', background: C.white,
        borderTop: `1px solid ${C.border}`,
        display: 'flex', gap: 10, alignItems: 'flex-end',
        flexShrink: 0,
      }}>
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
          rows={2}
          style={{
            ...inputSt,
            resize: 'none',
            lineHeight: 1.45,
            padding: '9px 12px',
            fontSize: 14,
            flex: 1,
          }}
        />
        <button
          onClick={handleSend}
          disabled={!draft.trim() || sending}
          style={{
            background: draft.trim() && !sending ? C.rosa : C.border,
            color: draft.trim() && !sending ? C.white : C.gray,
            border: 'none', borderRadius: 10, padding: '9px 18px',
            fontSize: 14, fontWeight: 600, cursor: draft.trim() && !sending ? 'pointer' : 'default',
            transition: 'background 0.2s, color 0.2s',
            flexShrink: 0, alignSelf: 'flex-end',
          }}
        >
          {sending ? 'Sending…' : 'Send'}
        </button>
      </div>
    </div>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function SmsInboxPage() {
  const { boutique } = useAuth()
  const [threads, setThreads] = useState([])        // [{ client_id, name, phone, body, direction, created_at }]
  const [threadsLoading, setThreadsLoading] = useState(true)
  const [selectedClient, setSelectedClient] = useState(null)  // { id, name, phone }
  const [searchQuery, setSearchQuery] = useState('')
  const [showNewModal, setShowNewModal] = useState(false)

  // Load all threads (last message per client)
  const loadThreads = useCallback(async () => {
    if (!boutique) return
    setThreadsLoading(true)
    const { data } = await supabase
      .from('sms_messages')
      .select('*, client:clients(id, name, phone)')
      .eq('boutique_id', boutique.id)
      .order('created_at', { ascending: false })

    if (data) {
      // Group by client_id — keep only the most recent message per client
      const seen = new Set()
      const grouped = []
      for (const row of data) {
        if (!row.client_id || seen.has(row.client_id)) continue
        seen.add(row.client_id)
        grouped.push({
          client_id: row.client_id,
          name: row.client?.name || 'Unknown',
          phone: row.client?.phone || '',
          body: row.body,
          direction: row.direction,
          created_at: row.created_at,
        })
      }
      setThreads(grouped)
    }
    setThreadsLoading(false)
  }, [boutique?.id])

  useEffect(() => { loadThreads() }, [loadThreads])

  // Realtime: refresh thread list when any new message arrives
  useEffect(() => {
    if (!boutique) return
    const channel = supabase
      .channel('sms-inbox-list')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'sms_messages',
      }, () => loadThreads())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [boutique?.id, loadThreads])

  const filteredThreads = searchQuery.trim()
    ? threads.filter(t => t.name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : threads

  function handleSelectThread(t) {
    setSelectedClient({ id: t.client_id, name: t.name, phone: t.phone })
  }

  function handleNewConversationSelect(client) {
    setShowNewModal(false)
    setSelectedClient(client)
    // Add to threads list if not already present
    setThreads(prev => {
      if (prev.find(t => t.client_id === client.id)) return prev
      return [{ client_id: client.id, name: client.name, phone: client.phone, body: '', direction: 'outbound', created_at: new Date().toISOString() }, ...prev]
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: C.ivory }}>
      <Topbar title="SMS Inbox" />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <ClientList
          threads={filteredThreads}
          loading={threadsLoading}
          selectedId={selectedClient?.id}
          onSelect={handleSelectThread}
          onNewConversation={() => setShowNewModal(true)}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
        <ConversationPanel client={selectedClient} />
      </div>

      {showNewModal && (
        <NewConversationModal
          onClose={() => setShowNewModal(false)}
          onSelect={handleNewConversationSelect}
          existingClientIds={threads.map(t => t.client_id)}
        />
      )}
    </div>
  )
}
