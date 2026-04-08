import React, { useState } from 'react'
import { C } from '../lib/colors'

// ─── DATA ────────────────────────────────────────────────────────────────────

const RELEASES = [
  {
    version: '2.0',
    date: 'April 2026',
    label: 'Current',
    items: [
      { status: 'done', category: 'Payments',      text: 'Stripe payment links per milestone' },
      { status: 'done', category: 'Payments',      text: 'Payment plan auto-generator' },
      { status: 'done', category: 'Payments',      text: 'Refund & tip tracking' },
      { status: 'done', category: 'Clients',       text: 'Loyalty points redemption' },
      { status: 'done', category: 'Clients',       text: 'Bulk SMS & email blast' },
      { status: 'done', category: 'Clients',       text: 'Client merge deduplication' },
      { status: 'done', category: 'Clients',       text: 'Client measurements tab' },
      { status: 'done', category: 'Events',        text: 'Day-of runsheet (printable)' },
      { status: 'done', category: 'Events',        text: 'Pre-event questionnaire (client-facing)' },
      { status: 'done', category: 'Events',        text: 'Waitlist management' },
      { status: 'done', category: 'Scheduling',    text: 'Staff calendar (week/month view)' },
      { status: 'done', category: 'Scheduling',    text: 'Staff availability & commission settings' },
      { status: 'done', category: 'Inventory',     text: 'Dress availability calendar (28-day timeline)' },
      { status: 'done', category: 'Inventory',     text: 'Cleaning & maintenance log' },
      { status: 'done', category: 'Inventory',     text: 'Low stock alerts' },
      { status: 'done', category: 'Reports',       text: 'Revenue trend chart (12 months)' },
      { status: 'done', category: 'Reports',       text: 'Profit per event & margin analysis' },
      { status: 'done', category: 'Reports',       text: 'Lead conversion funnel' },
      { status: 'done', category: 'Reports',       text: 'Staff performance report' },
      { status: 'done', category: 'Reports',       text: 'Client retention & repeat booking journeys' },
      { status: 'done', category: 'Reports',       text: 'Tax summary & P&L export' },
      { status: 'done', category: 'Communication', text: 'Email invoice (PDF receipt)' },
      { status: 'done', category: 'Communication', text: 'Email composer from event detail' },
      { status: 'done', category: 'Communication', text: 'Birthday SMS reminders' },
      { status: 'done', category: 'Portal',        text: 'Client portal: pay online, download contract, upload inspiration' },
      { status: 'done', category: 'Settings',      text: 'Contract template editor' },
      { status: 'done', category: 'Settings',      text: 'Spanish language support' },
      { status: 'done', category: 'Technical',     text: 'PWA (installable on mobile)' },
      { status: 'done', category: 'Technical',     text: 'Real-time updates across all screens' },
      { status: 'done', category: 'Technical',     text: 'Optimistic UI (instant feedback)' },
      { status: 'done', category: 'Technical',     text: 'Global ⌘K search' },
      { status: 'done', category: 'Growth',        text: 'Embeddable booking widget (website snippet)' },
      { status: 'done', category: 'Growth',        text: 'Audit log (all changes tracked)' },
    ]
  },
  {
    version: '1.5',
    date: 'March 2026',
    label: 'Previous',
    items: [
      { status: 'done', category: 'Core',          text: 'Multi-tenant SaaS with Row Level Security' },
      { status: 'done', category: 'Core',          text: 'Stripe billing & subscription management' },
      { status: 'done', category: 'Core',          text: 'Module system (33 modules, role-gated)' },
      { status: 'done', category: 'Automations',   text: '9 Inngest automations (SMS, email, reminders)' },
      { status: 'done', category: 'Contracts',     text: 'Digital contracts & e-signature' },
      { status: 'done', category: 'Portal',        text: 'Client self-service portal' },
      { status: 'done', category: 'CRM',           text: 'Pipeline Kanban & lead management' },
      { status: 'done', category: 'Inventory',     text: 'Full inventory management with QR codes' },
      { status: 'done', category: 'Payments',      text: 'Payment milestone billing' },
      { status: 'done', category: 'Communication', text: 'Two-way SMS inbox' },
    ]
  },
  {
    version: '3.0',
    date: 'Coming soon',
    label: 'Upcoming',
    items: [
      { status: 'planned', category: 'Mobile',       text: 'Native iOS & Android app' },
      { status: 'planned', category: 'AI',           text: 'AI event suggestions & client insights' },
      { status: 'planned', category: 'Integrations', text: 'QuickBooks Online live sync' },
      { status: 'planned', category: 'Integrations', text: 'Zapier / webhook outbound triggers' },
      { status: 'planned', category: 'Communication',text: 'WhatsApp Business integration' },
      { status: 'planned', category: 'Growth',       text: 'Referral tracking & partner program' },
      { status: 'planned', category: 'Reports',      text: 'Custom report builder' },
      { status: 'planned', category: 'Marketplace',  text: 'Vendor marketplace directory' },
    ]
  }
]

const CATEGORY_COLORS = {
  Payments:      '#15803D',
  Clients:       '#7C6FCD',
  Events:        '#C9697A',
  Scheduling:    '#3B9EBF',
  Inventory:     '#E8953A',
  Reports:       '#0891B2',
  Communication: '#9333EA',
  Portal:        '#DC2626',
  Settings:      '#6B7280',
  Technical:     '#374151',
  Growth:        '#D97706',
  Core:          '#1D4ED8',
  Automations:   '#7C3AED',
  Contracts:     '#B45309',
  CRM:           '#047857',
  Mobile:        '#9333EA',
  AI:            '#C026D3',
  Integrations:  '#0369A1',
  Marketplace:   '#BE185D',
}

const STATUS_ICON = { done: '✅', planned: '🔷', 'in-progress': '🔄' }

// Group items by category, preserving insertion order of categories
function groupByCategory(items) {
  const map = {}
  const order = []
  for (const item of items) {
    if (!map[item.category]) { map[item.category] = []; order.push(item.category) }
    map[item.category].push(item)
  }
  return order.map(cat => ({ category: cat, items: map[cat] }))
}

// ─── CATEGORY BADGE ──────────────────────────────────────────────────────────
function CatBadge({ category, planned }) {
  const color = CATEGORY_COLORS[category] || C.gray
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      fontSize: 10, fontWeight: 600, lineHeight: 1,
      padding: '3px 8px', borderRadius: 20,
      background: color + (planned ? '18' : '18'),
      color,
      border: planned ? `1px dashed ${color}66` : `1px solid ${color}33`,
      flexShrink: 0,
      whiteSpace: 'nowrap',
    }}>
      {category}
    </span>
  )
}

// ─── SUMMARY BAR ─────────────────────────────────────────────────────────────
function SummaryBar({ items }) {
  const counts = {}
  for (const item of items) counts[item.category] = (counts[item.category] || 0) + 1
  const cats = Object.entries(counts)
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginBottom: 20, fontSize: 11, color: C.gray }}>
      {cats.map(([cat, n]) => (
        <span key={cat} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: CATEGORY_COLORS[cat] || C.gray, display: 'inline-block', flexShrink: 0 }}/>
          <span style={{ color: CATEGORY_COLORS[cat] || C.gray, fontWeight: 500 }}>{cat}</span>
          <span style={{ color: C.gray }}>({n})</span>
        </span>
      ))}
    </div>
  )
}

// ─── RELEASE PANEL ───────────────────────────────────────────────────────────
function ReleasePanel({ release }) {
  const groups = groupByCategory(release.items)
  const isUpcoming = release.label === 'Upcoming'

  return (
    <div>
      <SummaryBar items={release.items} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        {groups.map(({ category, items }) => (
          <div key={category}>
            {/* Category header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ width: 3, height: 16, borderRadius: 2, background: CATEGORY_COLORS[category] || C.gray, flexShrink: 0 }}/>
              <span style={{ fontSize: 12, fontWeight: 700, color: CATEGORY_COLORS[category] || C.gray, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                {category}
              </span>
            </div>
            {/* Items */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {items.map((item, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 12px', borderRadius: 8,
                  background: C.white,
                  border: `1px solid ${C.border}`,
                  opacity: item.status === 'planned' ? 0.7 : 1,
                  marginBottom: 4,
                }}>
                  <span style={{ fontSize: 14, flexShrink: 0 }}>{STATUS_ICON[item.status] || '🔷'}</span>
                  <span style={{ flex: 1, fontSize: 13, color: C.ink, lineHeight: 1.4 }}>{item.text}</span>
                  {item.status === 'planned' && (
                    <span style={{ fontSize: 10, color: C.gray, background: C.grayBg, borderRadius: 4, padding: '2px 6px', flexShrink: 0 }}>planned</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────
export default function RoadmapPage() {
  // Default to the "Current" release tab
  const [activeVersion, setActiveVersion] = useState('2.0')
  const activeRelease = RELEASES.find(r => r.version === activeVersion) || RELEASES[0]

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: C.ivory }}>
      {/* Page header */}
      <div style={{ padding: '20px 28px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: C.ink, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span>🗺</span> Product Roadmap
            </h1>
            <p style={{ fontSize: 13, color: C.gray, margin: '4px 0 0' }}>
              Built with Belori — track what ships and what's next
            </p>
          </div>
          <div style={{ fontSize: 11, color: C.gray, background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, padding: '5px 10px', whiteSpace: 'nowrap' }}>
            Last updated: April 2026
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 6, marginTop: 18, borderBottom: `1px solid ${C.border}`, paddingBottom: 0 }}>
          {RELEASES.map(r => {
            const active = r.version === activeVersion
            const labelColor = r.label === 'Current' ? C.green
              : r.label === 'Upcoming' ? C.blue
              : C.gray
            return (
              <button
                key={r.version}
                onClick={() => setActiveVersion(r.version)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '9px 16px',
                  border: 'none',
                  borderBottom: active ? `2px solid ${C.rosa}` : '2px solid transparent',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  color: active ? C.rosa : C.gray,
                  borderRadius: '8px 8px 0 0',
                  marginBottom: -1,
                  transition: 'all 0.15s',
                  minHeight: 'unset', minWidth: 'unset',
                }}
              >
                <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700 }}>v{r.version}</span>
                <span>{r.label}</span>
                <span style={{
                  fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 999,
                  background: active ? C.rosaPale : C.grayBg,
                  color: active ? C.rosa : labelColor,
                  border: `1px solid ${active ? C.rosa + '44' : C.border}`,
                }}>
                  {r.date}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Content area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
        {/* Release meta */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: C.ink }}>v{activeRelease.version}</span>
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 999,
            background: activeRelease.label === 'Current' ? C.greenBg
              : activeRelease.label === 'Upcoming' ? C.blueBg
              : C.grayBg,
            color: activeRelease.label === 'Current' ? C.green
              : activeRelease.label === 'Upcoming' ? C.blue
              : C.gray,
          }}>
            {activeRelease.label}
          </span>
          <span style={{ fontSize: 12, color: C.gray }}>{activeRelease.date}</span>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: C.gray }}>
            {activeRelease.items.length} feature{activeRelease.items.length !== 1 ? 's' : ''}
          </span>
        </div>

        <ReleasePanel release={activeRelease} />

        {/* Footer */}
        <div style={{
          marginTop: 36, padding: '16px 20px', borderRadius: 12,
          background: C.white, border: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 2 }}>
              Belori is actively developed
            </div>
            <div style={{ fontSize: 12, color: C.gray }}>
              Have a feature request? We'd love to hear from you.
            </div>
          </div>
          <a
            href="mailto:hello@belori.app"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 8,
              background: C.rosa, color: C.white,
              fontSize: 12, fontWeight: 600, textDecoration: 'none',
              flexShrink: 0,
            }}
          >
            Contact us →
          </a>
        </div>
      </div>
    </div>
  )
}
