import React, { useState, useEffect, useRef, useMemo } from 'react';
import { C, fmt } from '../lib/colors';

// ─── NOTIFICATION CENTER ─────────────────────────────────────────────────────
// Derives alerts from live data already loaded in NovelApp — no extra fetches.

function buildAlerts({ events = [], payments = [], inventory = [] }) {
  const alerts = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];

  // Overdue payments
  payments.filter(p => p.status === 'overdue').forEach(p => {
    alerts.push({
      id: `pay-${p.id}`,
      type: 'payment',
      priority: 'high',
      icon: '💳',
      title: `Overdue payment — ${p.client}`,
      body: `${fmt(p.amount)} · ${p.daysLate} day${p.daysLate !== 1 ? 's' : ''} late`,
      screen: 'payments',
    });
  });

  // Dresses due back today or overdue
  inventory.filter(d => ['rented', 'picked_up'].includes(d.status) && d.return_date).forEach(d => {
    const ret = new Date(d.return_date + 'T12:00:00');
    const diff = Math.ceil((ret - today) / 86400000);
    if (diff <= 0) {
      alerts.push({
        id: `return-${d.id}`,
        type: 'return',
        priority: diff < 0 ? 'high' : 'medium',
        icon: '👗',
        title: `${diff < 0 ? 'Overdue return' : 'Return due today'} — ${d.name}`,
        body: diff < 0 ? `${Math.abs(diff)} day${Math.abs(diff) !== 1 ? 's' : ''} overdue` : 'Due back today',
        screen: 'inventory',
      });
    } else if (diff <= 2) {
      alerts.push({
        id: `return-soon-${d.id}`,
        type: 'return',
        priority: 'medium',
        icon: '👗',
        title: `Return due in ${diff} day${diff !== 1 ? 's' : ''} — ${d.name}`,
        body: `Return date: ${new Date(d.return_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
        screen: 'inventory',
      });
    }
  });

  // Events < 14 days with unpaid balance
  events.filter(ev => {
    const days = ev.daysUntil ?? (ev.event_date ? Math.ceil((new Date(ev.event_date + 'T12:00:00') - today) / 86400000) : 999);
    return days >= 0 && days <= 14 && ev.total > 0 && (ev.paid || 0) < (ev.total || 0);
  }).forEach(ev => {
    const unpaid = (ev.total || 0) - (ev.paid || 0);
    const days = ev.daysUntil ?? Math.ceil((new Date(ev.event_date + 'T12:00:00') - today) / 86400000);
    alerts.push({
      id: `event-unpaid-${ev.id}`,
      type: 'event',
      priority: days <= 3 ? 'high' : 'medium',
      icon: days <= 3 ? '🚨' : '⚠️',
      title: `${ev.client} — ${fmt(unpaid)} unpaid`,
      body: `Event in ${days} day${days !== 1 ? 's' : ''}`,
      eventId: ev.id,
      screen: 'event_detail',
    });
  });

  // Events missing a fitting appointment within 30 days
  events.filter(ev => {
    const days = ev.daysUntil ?? 999;
    return days >= 0 && days <= 30 && ev.missingAppointments?.length > 0;
  }).forEach(ev => {
    ev.missingAppointments.slice(0, 1).forEach(appt => {
      alerts.push({
        id: `appt-${ev.id}-${appt.type}`,
        type: 'appointment',
        priority: 'low',
        icon: '📅',
        title: `${appt.type.replace(/_/g, ' ')} not scheduled — ${ev.client}`,
        body: `Event in ${ev.daysUntil} days`,
        eventId: ev.id,
        screen: 'event_detail',
      });
    });
  });

  // Low stock inventory items
  inventory.filter(item => {
    if (item.track === 'consumable') return item.restockPoint > 0 && item.currentStock <= item.restockPoint;
    if (item.track === 'quantity')   return item.minStock > 0 && item.availQty <= item.minStock;
    return false;
  }).forEach(item => {
    const isOut = item.track === 'consumable' ? item.currentStock <= 0 : item.availQty <= 0;
    alerts.push({
      id: `stock-${item.id}`,
      type: 'stock',
      priority: isOut ? 'high' : 'medium',
      icon: '📦',
      title: `${isOut ? 'Out of stock' : 'Low stock'} — ${item.name}`,
      body: item.track === 'consumable'
        ? `${item.currentStock} ${item.unit || 'units'} left · restock at ${item.restockPoint}`
        : `${item.availQty} available · min stock ${item.minStock}`,
      screen: 'inv_full',
    });
  });

  // Sort: high first, then medium, then low
  const order = { high: 0, medium: 1, low: 2 };
  return alerts.sort((a, b) => order[a.priority] - order[b.priority]);
}

const PRIORITY_CFG = {
  high:   { bg: '#FEF2F2', border: '#FECACA', col: '#B91C1C', dot: '#DC2626' },
  medium: { bg: '#FFFBEB', border: '#FDE68A', col: '#92400E', dot: '#D97706' },
  low:    { bg: '#F0F9FF', border: '#BAE6FD', col: '#0369A1', dot: '#0EA5E9' },
};

export function useAlertCount({ events, payments, inventory }) {
  return useMemo(() => buildAlerts({ events, payments, inventory }).length, [events, payments, inventory]);
}

export default function NotificationCenter({ events, payments, inventory, setScreen, setSelectedEvent, onClose }) {
  const alerts = useMemo(() => buildAlerts({ events, payments, inventory }), [events, payments, inventory]);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const handleClick = (alert) => {
    if (alert.eventId) setSelectedEvent(alert.eventId);
    setScreen(alert.screen);
    onClose();
  };

  const highCount = alerts.filter(a => a.priority === 'high').length;
  const midCount = alerts.filter(a => a.priority === 'medium').length;

  return (
    <div ref={ref} style={{
      width: '100%', maxHeight: 'min(480px, calc(100dvh - 120px))', overflowY: 'auto',
      background: C.white, border: `1px solid ${C.border}`,
      borderRadius: 14, boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{ padding: '14px 16px 10px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>Alerts</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {highCount > 0 && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: '#FEE2E2', color: '#B91C1C' }}>{highCount} urgent</span>}
            {midCount > 0 && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: '#FEF3C7', color: '#92400E' }}>{midCount} warning</span>}
            <button aria-label="Close alerts" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.gray, fontSize: 18, lineHeight: 1, padding: 0, marginLeft: 4 }}>×</button>
          </div>
        </div>
        {alerts.length > 0 && <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>{alerts.length} item{alerts.length !== 1 ? 's' : ''} need attention</div>}
      </div>

      {/* Alert list */}
      {alerts.length === 0 ? (
        <div style={{ padding: '36px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>✅</div>
          <div style={{ fontSize: 13, fontWeight: 500, color: C.ink, marginBottom: 4 }}>All clear!</div>
          <div style={{ fontSize: 12, color: C.gray }}>No overdue payments, returns, or urgent events.</div>
        </div>
      ) : alerts.map((alert, i) => {
        const cfg = PRIORITY_CFG[alert.priority];
        return (
          <div key={alert.id} onClick={() => handleClick(alert)}
            style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 14px', cursor: 'pointer', borderBottom: i < alerts.length - 1 ? `1px solid ${C.border}` : 'none', transition: 'background 0.1s' }}
            onMouseEnter={e => e.currentTarget.style.background = cfg.bg}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.dot, flexShrink: 0, marginTop: 5 }}/>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: cfg.bg, border: `1px solid ${cfg.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>
              {alert.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: C.ink, lineHeight: 1.3, marginBottom: 2 }}>{alert.title}</div>
              <div style={{ fontSize: 11, color: C.gray }}>{alert.body}</div>
            </div>
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 6, color: C.gray }}>
              <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </div>
        );
      })}
    </div>
  );
}
