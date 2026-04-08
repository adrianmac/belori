import React, { useState } from 'react';
import { C, fmt } from '../lib/colors';
import { Topbar, useToast } from '../lib/ui.jsx';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toCSV(rows, cols) {
  const header = cols.map(c => `"${c.label}"`).join(',');
  const body = rows.map(r =>
    cols.map(c => {
      const v = String(r[c.key] ?? '').replace(/"/g, '""');
      return `"${v}"`;
    }).join(',')
  ).join('\n');
  return header + '\n' + body;
}

function downloadBlob(content, filename, mimeType = 'text/csv') {
  const blob = new Blob([content], { type: mimeType });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function buildIIF(paidMilestones, eventsById, clientsById) {
  const lines = [
    '!TRNS\tTRNSID\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tMEMO',
    '!SPL\tSPLID\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tMEMO',
    '!ENDTRNS',
  ];

  paidMilestones.forEach(m => {
    const ev = eventsById[m.event_id];
    const clientName = ev ? (clientsById[ev.client_id]?.name ?? '') : '';
    const date = m.paid_date ?? m.due_date ?? '';
    const amount = Number(m.amount ?? 0).toFixed(2);
    const label = (m.label ?? '').replace(/\t/g, ' ');
    const name = clientName.replace(/\t/g, ' ');

    lines.push(
      `TRNS\t\tINVOICE\t${date}\tAccounts Receivable\t${name}\t${amount}\t${label}`
    );
    lines.push(
      `SPL\t\tINVOICE\t${date}\tSales\t${name}\t-${amount}\t${label}`
    );
    lines.push('ENDTRNS');
  });

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FileBadge({ type }) {
  const isIIF = type === 'IIF';
  return (
    <span style={{
      display: 'inline-block',
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.04em',
      padding: '2px 7px',
      borderRadius: 4,
      background: isIIF ? '#e8f4ff' : '#f0faf0',
      color: isIIF ? '#1a6fb5' : '#2a7a3b',
      border: `1px solid ${isIIF ? '#b3d9f7' : '#b2dfbb'}`,
      textTransform: 'uppercase',
      flexShrink: 0,
    }}>
      {type}
    </span>
  );
}

function ExportCard({ exp, exporting, onExport }) {
  const busy = exporting === exp.id;
  return (
    <div style={{
      background: C.white,
      border: `1px solid ${C.border}`,
      borderRadius: 10,
      padding: '14px 18px',
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      transition: 'box-shadow 0.15s',
    }}>
      {/* Left: icon */}
      <div style={{ fontSize: 24, flexShrink: 0, width: 32, textAlign: 'center' }}>
        {exp.icon}
      </div>

      {/* Middle: text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>
            {exp.label}
          </span>
          <FileBadge type={exp.fileType} />
          {exp.count != null && (
            <span style={{ fontSize: 12, color: C.gray }}>
              {exp.count} records
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: C.gray, marginTop: 3, lineHeight: 1.4 }}>
          {exp.description}
        </div>
      </div>

      {/* Right: button */}
      <button
        onClick={() => onExport(exp)}
        disabled={busy}
        style={{
          flexShrink: 0,
          padding: '7px 16px',
          borderRadius: 8,
          border: `1px solid ${C.border}`,
          background: busy ? C.surface : C.white,
          color: busy ? C.gray : C.ink,
          fontSize: 13,
          fontWeight: 500,
          cursor: busy ? 'default' : 'pointer',
          whiteSpace: 'nowrap',
          opacity: busy ? 0.6 : 1,
          transition: 'opacity 0.15s',
        }}
      >
        {busy ? 'Exporting…' : `↓ Download`}
      </button>
    </div>
  );
}

function SectionHeader({ title }) {
  return (
    <div style={{
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color: C.gray,
      paddingTop: 8,
      paddingBottom: 2,
    }}>
      {title}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function DataExport({ clients = [], events = [], payments = [], inventory = [] }) {
  const toast = useToast();
  const { boutique } = useAuth();
  const [exporting, setExporting] = useState(null);

  // ── Tax section state ────────────────────────────────────────────
  const currentYear = new Date().getFullYear();
  const YEAR_OPTIONS = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3];
  const [taxYear, setTaxYear] = useState(currentYear);
  const [taxLoading, setTaxLoading] = useState(false);
  const [taxData, setTaxData] = useState(null); // { milestones, expenses }

  const fetchTaxData = async () => {
    if (!boutique?.id) { toast('No boutique found', 'warn'); return; }
    setTaxLoading(true);
    setTaxData(null);
    try {
      const [msRes, expRes] = await Promise.all([
        supabase
          .from('payment_milestones')
          .select('amount, paid_date, event_id, events(type, client_id)')
          .eq('boutique_id', boutique.id)
          .eq('status', 'paid')
          .gte('paid_date', `${taxYear}-01-01`)
          .lte('paid_date', `${taxYear}-12-31`),
        supabase
          .from('expenses')
          .select('amount, date, category, description, vendor')
          .eq('boutique_id', boutique.id)
          .gte('date', `${taxYear}-01-01`)
          .lte('date', `${taxYear}-12-31`),
      ]);
      setTaxData({
        milestones: msRes.data || [],
        expenses: expRes.data || [],
      });
    } catch (err) {
      console.error('Tax fetch error', err);
      toast('Failed to load tax data', 'warn');
    } finally {
      setTaxLoading(false);
    }
  };

  // Helpers for tax section
  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  function getMonth(dateStr) {
    if (!dateStr) return -1;
    return new Date(dateStr + 'T00:00:00').getMonth(); // 0-based
  }

  function taxRevenueSummary() {
    if (!taxData) return [];
    return taxData.milestones.map(m => {
      const ev = m.events;
      const clientName = ev ? (clientsById[ev.client_id]?.name ?? '') : '';
      const monthIdx = getMonth(m.paid_date);
      const monthName = monthIdx >= 0 ? MONTH_NAMES[monthIdx] : '';
      return {
        month: monthName,
        event_type: ev?.type ?? '',
        client: clientName,
        amount: `$${Number(m.amount ?? 0).toFixed(2)}`,
        paid_date: m.paid_date ?? '',
      };
    });
  }

  function taxExpenseSummary() {
    if (!taxData) return [];
    return (taxData.expenses || []).map(e => ({
      date: e.date ?? '',
      category: e.category ?? '',
      description: e.description ?? '',
      vendor: e.vendor ?? '',
      amount: `$${Number(e.amount ?? 0).toFixed(2)}`,
    }));
  }

  function buildPLRows() {
    if (!taxData) return [];
    const revenueByMonth = Array(12).fill(0);
    const expensesByMonth = Array(12).fill(0);
    (taxData.milestones || []).forEach(m => {
      const idx = getMonth(m.paid_date);
      if (idx >= 0) revenueByMonth[idx] += Number(m.amount ?? 0);
    });
    (taxData.expenses || []).forEach(e => {
      const idx = getMonth(e.date);
      if (idx >= 0) expensesByMonth[idx] += Number(e.amount ?? 0);
    });
    const rows = MONTH_NAMES.map((name, i) => {
      const rev = revenueByMonth[i];
      const exp = expensesByMonth[i];
      const net = rev - exp;
      const margin = rev > 0 ? Math.round((net / rev) * 100) : 0;
      return { month: name, revenue: `$${rev.toFixed(2)}`, expenses: `$${exp.toFixed(2)}`, net_profit: `$${net.toFixed(2)}`, margin: `${margin}%` };
    });
    const totRev = revenueByMonth.reduce((a, b) => a + b, 0);
    const totExp = expensesByMonth.reduce((a, b) => a + b, 0);
    const totNet = totRev - totExp;
    const totMargin = totRev > 0 ? Math.round((totNet / totRev) * 100) : 0;
    rows.push({ month: 'TOTAL', revenue: `$${totRev.toFixed(2)}`, expenses: `$${totExp.toFixed(2)}`, net_profit: `$${totNet.toFixed(2)}`, margin: `${totMargin}%` });
    return rows;
  }

  function buildFullLedger() {
    if (!taxData) return [];
    const revRows = (taxData.milestones || []).map(m => ({
      date: m.paid_date ?? '',
      type: 'Revenue',
      category: m.events?.type ?? '',
      description: '',
      vendor: '',
      amount: `$${Number(m.amount ?? 0).toFixed(2)}`,
    }));
    const expRows = (taxData.expenses || []).map(e => ({
      date: e.date ?? '',
      type: 'Expense',
      category: e.category ?? '',
      description: e.description ?? '',
      vendor: e.vendor ?? '',
      amount: `-$${Number(e.amount ?? 0).toFixed(2)}`,
    }));
    return [...revRows, ...expRows].sort((a, b) => a.date.localeCompare(b.date));
  }

  // Tax summary numbers for preview
  const taxTotals = (() => {
    if (!taxData) return null;
    const totalRev = (taxData.milestones || []).reduce((s, m) => s + Number(m.amount ?? 0), 0);
    const totalExp = (taxData.expenses || []).reduce((s, e) => s + Number(e.amount ?? 0), 0);
    const netProfit = totalRev - totalExp;
    const margin = totalRev > 0 ? Math.round((netProfit / totalRev) * 100) : 0;

    // Revenue by quarter
    const qRev = [0, 0, 0, 0];
    (taxData.milestones || []).forEach(m => {
      const idx = getMonth(m.paid_date);
      if (idx >= 0) qRev[Math.floor(idx / 3)] += Number(m.amount ?? 0);
    });

    // Top expense category
    const expByCat = {};
    (taxData.expenses || []).forEach(e => {
      const cat = e.category || 'Uncategorized';
      expByCat[cat] = (expByCat[cat] || 0) + Number(e.amount ?? 0);
    });
    const topCatEntry = Object.entries(expByCat).sort((a, b) => b[1] - a[1])[0];

    return { totalRev, totalExp, netProfit, margin, qRev, topCatEntry };
  })();

  // Build lookup maps for IIF and revenue exports
  const eventsById = Object.fromEntries(events.map(e => [e.id, e]));
  const clientsById = Object.fromEntries(clients.map(c => [c.id, c]));

  const paidMilestones = payments.filter(p => p.status === 'paid');

  // Clients that have an email address (for mailing list)
  const emailedClients = clients.filter(c => c.email);

  // Tier helper: simple bucketing by loyalty_points
  function clientTier(pts) {
    const n = Number(pts ?? 0);
    if (n >= 500) return 'Gold';
    if (n >= 200) return 'Silver';
    return 'Bronze';
  }

  // Revenue summary rows (one per paid milestone, enriched)
  function buildRevenueRows() {
    return paidMilestones.map(m => {
      const ev = eventsById[m.event_id];
      const clientName = ev ? (clientsById[ev.client_id]?.name ?? '') : '';
      return {
        date: m.paid_date ?? m.due_date ?? '',
        client: clientName,
        event_type: ev?.type ?? '',
        label: m.label ?? '',
        amount: Number(m.amount ?? 0).toFixed(2),
        payment_method: '—',
      };
    });
  }

  // Mailing list rows
  function buildMailingRows() {
    return emailedClients.map(c => {
      // Sum paid amounts across events for this client
      const clientEventIds = new Set(
        events.filter(e => e.client_id === c.id).map(e => e.id)
      );
      const totalSpent = paidMilestones
        .filter(m => clientEventIds.has(m.event_id))
        .reduce((sum, m) => sum + Number(m.amount ?? 0), 0);

      return {
        name: c.name ?? '',
        email: c.email ?? '',
        phone: c.phone ?? '',
        partner: c.partner_name ?? '',
        tier: clientTier(c.loyalty_points),
        total_spent: totalSpent.toFixed(2),
        loyalty_points: c.loyalty_points ?? 0,
      };
    });
  }

  // -------------------------------------------------------------------
  // Export definitions grouped by section
  // -------------------------------------------------------------------
  const sections = [
    {
      title: 'Client data',
      items: [
        {
          id: 'clients',
          label: 'Clients',
          description: 'All client profiles with contact info, partner, language preference, and loyalty points.',
          icon: '👥',
          fileType: 'CSV',
          count: clients.length,
          run: () => {
            const csv = toCSV(clients, [
              { label: 'Name', key: 'name' },
              { label: 'Phone', key: 'phone' },
              { label: 'Email', key: 'email' },
              { label: 'Partner', key: 'partner_name' },
              { label: 'Loyalty points', key: 'loyalty_points' },
              { label: 'Language', key: 'language_preference' },
              { label: 'Referred by', key: 'referred_by' },
            ]);
            downloadBlob(csv, 'clients.csv');
          },
        },
        {
          id: 'mailing',
          label: 'Client mailing list',
          description: `Clients with email addresses only — ready for Mailchimp or similar. Includes tier and total spent.`,
          icon: '✉️',
          fileType: 'CSV',
          count: emailedClients.length,
          run: () => {
            const rows = buildMailingRows();
            const csv = toCSV(rows, [
              { label: 'Name', key: 'name' },
              { label: 'Email', key: 'email' },
              { label: 'Phone', key: 'phone' },
              { label: 'Partner', key: 'partner' },
              { label: 'Tier', key: 'tier' },
              { label: 'Total Spent', key: 'total_spent' },
              { label: 'Loyalty Points', key: 'loyalty_points' },
            ]);
            downloadBlob(csv, 'client-mailing-list.csv');
          },
        },
      ],
    },
    {
      title: 'Financial',
      items: [
        {
          id: 'payments',
          label: 'Payments',
          description: 'All payment milestones — amounts, due dates, paid dates, and status.',
          icon: '💳',
          fileType: 'CSV',
          count: payments.length,
          run: () => {
            const csv = toCSV(payments, [
              { label: 'Label', key: 'label' },
              { label: 'Amount', key: 'amount' },
              { label: 'Due date', key: 'due_date' },
              { label: 'Status', key: 'status' },
              { label: 'Paid date', key: 'paid_date' },
            ]);
            downloadBlob(csv, 'payments.csv');
          },
        },
        {
          id: 'revenue',
          label: 'Revenue summary',
          description: 'One row per paid milestone with client name, event type, service label, and amount.',
          icon: '📊',
          fileType: 'CSV',
          count: paidMilestones.length,
          run: () => {
            const rows = buildRevenueRows();
            const csv = toCSV(rows, [
              { label: 'Date', key: 'date' },
              { label: 'Client', key: 'client' },
              { label: 'Event Type', key: 'event_type' },
              { label: 'Service Label', key: 'label' },
              { label: 'Amount', key: 'amount' },
              { label: 'Payment Method', key: 'payment_method' },
            ]);
            downloadBlob(csv, 'revenue-summary.csv');
          },
        },
        {
          id: 'quickbooks',
          label: 'QuickBooks (IIF)',
          description: 'Paid milestones as QuickBooks invoice transactions — import directly into QuickBooks Desktop.',
          icon: '🧾',
          fileType: 'IIF',
          count: paidMilestones.length,
          run: () => {
            const iif = buildIIF(paidMilestones, eventsById, clientsById);
            downloadBlob(iif, 'belori-transactions.iif', 'text/plain');
          },
        },
      ],
    },
    {
      title: 'Events',
      items: [
        {
          id: 'events',
          label: 'Events',
          description: 'All events with type, date, venue, guest count, status, and payment totals.',
          icon: '📅',
          fileType: 'CSV',
          count: events.length,
          run: () => {
            const csv = toCSV(events, [
              { label: 'Type', key: 'type' },
              { label: 'Event date', key: 'event_date' },
              { label: 'Venue', key: 'venue' },
              { label: 'Guests', key: 'guests' },
              { label: 'Status', key: 'status' },
              { label: 'Total', key: 'total' },
              { label: 'Paid', key: 'paid' },
            ]);
            downloadBlob(csv, 'events.csv');
          },
        },
      ],
    },
    {
      title: 'Inventory',
      items: [
        {
          id: 'inventory',
          label: 'Inventory',
          description: 'Dress and item catalog with SKU, category, color, size, price, and condition.',
          icon: '👗',
          fileType: 'CSV',
          count: inventory.length,
          run: () => {
            const csv = toCSV(inventory, [
              { label: 'Name', key: 'name' },
              { label: 'SKU', key: 'sku' },
              { label: 'Category', key: 'category' },
              { label: 'Color', key: 'color' },
              { label: 'Size', key: 'size' },
              { label: 'Price', key: 'price' },
              { label: 'Status', key: 'status' },
              { label: 'Condition', key: 'condition' },
            ]);
            downloadBlob(csv, 'inventory.csv');
          },
        },
      ],
    },
  ];

  const handleExport = (exp) => {
    setExporting(exp.id);
    try {
      exp.run();
      toast(`${exp.label} exported`);
    } catch (err) {
      console.error('Export error', err);
      toast('Export failed', 'warn');
    } finally {
      setExporting(null);
    }
  };

  const totalExports = sections.reduce((n, s) => n + s.items.length, 0);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Topbar title="Data export" subtitle="Download your boutique data" />

      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '20px 24px',
        maxWidth: 680,
      }}>
        {/* Intro */}
        <div style={{
          fontSize: 13,
          color: C.gray,
          marginBottom: 20,
          lineHeight: 1.55,
        }}>
          {totalExports} export formats available. CSV files open in Excel, Google Sheets, or Numbers.
          The QuickBooks IIF file imports directly into QuickBooks Desktop via{' '}
          <em>File &rarr; Utilities &rarr; Import &rarr; IIF Files</em>.
        </div>

        {/* Sections */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {sections.map(section => (
            <div key={section.title}>
              <SectionHeader title={section.title} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
                {section.items.map(exp => (
                  <ExportCard
                    key={exp.id}
                    exp={exp}
                    exporting={exporting}
                    onExport={handleExport}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* ── Tax & accounting section ───────────────────────────────── */}
          <div>
            <SectionHeader title="🧾 Tax & accounting" />
            <div style={{
              background: C.white,
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              padding: '18px 20px',
              marginTop: 6,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}>

              {/* Year selector + generate */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: C.ink }}>Tax year</div>
                <select
                  value={taxYear}
                  onChange={e => { setTaxYear(Number(e.target.value)); setTaxData(null); }}
                  style={{ padding: '6px 10px', borderRadius: 7, border: `1px solid ${C.border}`, fontSize: 13, color: C.ink, background: C.white, cursor: 'pointer' }}
                >
                  {YEAR_OPTIONS.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                <button
                  onClick={fetchTaxData}
                  disabled={taxLoading}
                  style={{
                    padding: '7px 18px',
                    borderRadius: 8,
                    border: `1px solid ${C.border}`,
                    background: taxLoading ? C.surface : C.ink,
                    color: taxLoading ? C.gray : C.white,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: taxLoading ? 'default' : 'pointer',
                    opacity: taxLoading ? 0.6 : 1,
                    transition: 'opacity 0.15s',
                  }}
                >
                  {taxLoading ? 'Loading…' : 'Generate'}
                </button>
                {taxData && (
                  <span style={{ fontSize: 12, color: C.gray }}>
                    {taxData.milestones.length} payments · {taxData.expenses.length} expenses
                  </span>
                )}
              </div>

              {/* Preview table */}
              {taxTotals && (
                <div style={{
                  background: C.surface ?? '#f9f9f9',
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, marginBottom: 2 }}>
                    {taxYear} Summary
                  </div>
                  {/* Main metrics */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                    {[
                      { label: 'Total revenue', value: `$${taxTotals.totalRev.toFixed(2)}`, color: '#2a7a3b' },
                      { label: 'Total expenses', value: `$${taxTotals.totalExp.toFixed(2)}`, color: '#b5360a' },
                      { label: 'Net profit', value: `$${taxTotals.netProfit.toFixed(2)}`, color: taxTotals.netProfit >= 0 ? '#2a7a3b' : '#b5360a' },
                      { label: 'Margin', value: `${taxTotals.margin}%`, color: C.ink },
                    ].map(m => (
                      <div key={m.label} style={{ background: C.white, borderRadius: 7, padding: '10px 12px', border: `1px solid ${C.border}` }}>
                        <div style={{ fontSize: 11, color: C.gray, marginBottom: 3 }}>{m.label}</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: m.color }}>{m.value}</div>
                      </div>
                    ))}
                  </div>
                  {/* Quarter breakdown */}
                  <div>
                    <div style={{ fontSize: 11, color: C.gray, marginBottom: 6, fontWeight: 600 }}>Revenue by quarter</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                      {taxTotals.qRev.map((v, i) => (
                        <div key={i} style={{ background: C.white, borderRadius: 7, padding: '8px 10px', border: `1px solid ${C.border}`, textAlign: 'center' }}>
                          <div style={{ fontSize: 11, color: C.gray, marginBottom: 2 }}>Q{i + 1}</div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>${v.toFixed(0)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Top expense category */}
                  {taxTotals.topCatEntry && (
                    <div style={{ fontSize: 12, color: C.gray }}>
                      Top expense category: <strong style={{ color: C.ink }}>{taxTotals.topCatEntry[0]}</strong> — ${taxTotals.topCatEntry[1].toFixed(2)}
                    </div>
                  )}
                  {!taxTotals.topCatEntry && taxData.expenses.length === 0 && (
                    <div style={{ fontSize: 12, color: C.gray, fontStyle: 'italic' }}>No expense data found for {taxYear}.</div>
                  )}
                </div>
              )}

              {/* Export buttons */}
              {taxData && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {[
                    {
                      id: 'tax-revenue',
                      label: 'Revenue summary CSV',
                      icon: '📈',
                      disabled: taxData.milestones.length === 0,
                      run: () => {
                        const rows = taxRevenueSummary();
                        // Monthly totals
                        const byMonth = {};
                        rows.forEach(r => {
                          byMonth[r.month] = (byMonth[r.month] || 0) + parseFloat(r.amount.replace('$', ''));
                        });
                        const totalAmt = rows.reduce((s, r) => s + parseFloat(r.amount.replace('$', '')), 0);
                        const summaryRows = [
                          ...rows,
                          ...Object.entries(byMonth).map(([m, a]) => ({ month: m, event_type: '— Monthly total', client: '', amount: `$${a.toFixed(2)}`, paid_date: '' })),
                          { month: 'ANNUAL TOTAL', event_type: '', client: '', amount: `$${totalAmt.toFixed(2)}`, paid_date: '' },
                        ];
                        const csv = toCSV(summaryRows, [
                          { label: 'Month', key: 'month' },
                          { label: 'Event Type', key: 'event_type' },
                          { label: 'Client', key: 'client' },
                          { label: 'Amount', key: 'amount' },
                          { label: 'Paid Date', key: 'paid_date' },
                        ]);
                        downloadBlob(csv, `revenue-summary-${taxYear}.csv`);
                      },
                    },
                    {
                      id: 'tax-expenses',
                      label: 'Expense summary CSV',
                      icon: '📉',
                      disabled: taxData.expenses.length === 0,
                      run: () => {
                        const rows = taxExpenseSummary();
                        const byCat = {};
                        rows.forEach(r => {
                          byCat[r.category] = (byCat[r.category] || 0) + parseFloat(r.amount.replace('$', ''));
                        });
                        const totalAmt = rows.reduce((s, r) => s + parseFloat(r.amount.replace('$', '')), 0);
                        const summaryRows = [
                          ...rows,
                          ...Object.entries(byCat).map(([cat, a]) => ({ date: '', category: cat + ' (subtotal)', description: '', vendor: '', amount: `$${a.toFixed(2)}` })),
                          { date: 'ANNUAL TOTAL', category: '', description: '', vendor: '', amount: `$${totalAmt.toFixed(2)}` },
                        ];
                        const csv = toCSV(summaryRows, [
                          { label: 'Date', key: 'date' },
                          { label: 'Category', key: 'category' },
                          { label: 'Description', key: 'description' },
                          { label: 'Vendor', key: 'vendor' },
                          { label: 'Amount', key: 'amount' },
                        ]);
                        downloadBlob(csv, `expense-summary-${taxYear}.csv`);
                      },
                    },
                    {
                      id: 'tax-pl',
                      label: 'P&L Summary CSV',
                      icon: '📊',
                      disabled: false,
                      run: () => {
                        const rows = buildPLRows();
                        const csv = toCSV(rows, [
                          { label: 'Month', key: 'month' },
                          { label: 'Revenue', key: 'revenue' },
                          { label: 'Expenses', key: 'expenses' },
                          { label: 'Net Profit', key: 'net_profit' },
                          { label: 'Margin%', key: 'margin' },
                        ]);
                        downloadBlob(csv, `pl-summary-${taxYear}.csv`);
                      },
                    },
                    {
                      id: 'tax-full',
                      label: 'Accountant export (full)',
                      icon: '🗂️',
                      disabled: false,
                      run: () => {
                        const rows = buildFullLedger();
                        const csv = toCSV(rows, [
                          { label: 'Date', key: 'date' },
                          { label: 'Type', key: 'type' },
                          { label: 'Category', key: 'category' },
                          { label: 'Description', key: 'description' },
                          { label: 'Vendor', key: 'vendor' },
                          { label: 'Amount', key: 'amount' },
                        ]);
                        downloadBlob(csv, `accountant-export-${taxYear}.csv`);
                      },
                    },
                  ].map(btn => (
                    <button
                      key={btn.id}
                      onClick={() => {
                        setExporting(btn.id);
                        try {
                          btn.run();
                          toast(`${btn.label} downloaded`);
                        } catch (err) {
                          console.error('Tax export error', err);
                          toast('Export failed', 'warn');
                        } finally {
                          setExporting(null);
                        }
                      }}
                      disabled={btn.disabled || exporting === btn.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '8px 14px',
                        borderRadius: 8,
                        border: `1px solid ${C.border}`,
                        background: (btn.disabled || exporting === btn.id) ? C.surface : C.white,
                        color: btn.disabled ? C.gray : C.ink,
                        fontSize: 13,
                        fontWeight: 500,
                        cursor: (btn.disabled || exporting === btn.id) ? 'default' : 'pointer',
                        opacity: btn.disabled ? 0.5 : 1,
                        transition: 'opacity 0.15s',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <span>{btn.icon}</span>
                      <span>{exporting === btn.id ? 'Exporting…' : `↓ ${btn.label}`}</span>
                    </button>
                  ))}
                </div>
              )}

              {!taxData && !taxLoading && (
                <div style={{ fontSize: 12, color: C.gray, fontStyle: 'italic' }}>
                  Select a year and click Generate to load your tax summary.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer note */}
        <div style={{
          marginTop: 28,
          padding: '12px 16px',
          background: C.surface ?? '#f9f9f9',
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          fontSize: 12,
          color: C.gray,
          lineHeight: 1.5,
        }}>
          All exports are generated client-side — your data never leaves your device during this process.
          Data is scoped to your boutique only.
        </div>
      </div>
    </div>
  );
}
