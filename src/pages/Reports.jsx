import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { C, fmt } from '../lib/colors';
import { Topbar, useToast } from '../lib/ui.jsx';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { usePackages } from '../hooks/usePackages';
import UpgradeGate from '../components/UpgradeGate';
import { useInventoryROI } from '../hooks/useInventoryROI';
import { useCommissions } from '../hooks/useCommissions';

export default function Reports({ payments = [], events = [], clients = [], goScreen }) {
  const { boutique } = useAuth();
  const { packages } = usePackages();
  const [period, setPeriod] = useState('all');
  const [hoveredBar, setHoveredBar] = useState(null);
  const [hoveredBar12, setHoveredBar12] = useState(null);
  // payments prop only has unpaid milestones — fetch all (including paid) for revenue stats
  const [paidMilestones, setPaidMilestones] = useState([]);
  const [milestonesLoading, setMilestonesLoading] = useState(false);
  const [milestonesError, setMilestonesError] = useState(null);

  // Section 2: Profit per event
  const [expensesByEvent, setExpensesByEvent] = useState({});

  // Section 3 & 4: Pipeline leads
  const [pipelineLeads, setPipelineLeads] = useState([]);

  // Forecast toggle
  const [forecastMode, setForecastMode] = useState('conservative');

  // NPS Overview
  const [npsOverview, setNpsOverview] = useState([]);

  // Churn risk data
  const [churnData, setChurnData] = useState([]);
  const [churnLoading, setChurnLoading] = useState(false);

  // Advanced analytics — Section A: Heatmap
  const [heatmapData, setHeatmapData] = useState({});
  const [hoveredHeatCell, setHoveredHeatCell] = useState(null);

  // Advanced analytics — Section B: YoY comparison
  const [hoveredYoy, setHoveredYoy] = useState(null); // { monthIdx, which: 'this'|'last' }

  // Advanced analytics — Section C: Profitability ranking (no extra state needed)

  // Damage overview
  const [damageStats, setDamageStats] = useState({ openCount: 0, repairCostYtd: 0, topItem: null, tableExists: true });

  // Dress rental health
  const [rentalHealth, setRentalHealth] = useState({ totalReturns: 0, perfectReturns: 0, damageFeesCollected: 0, damageFeesWaived: 0, loaded: false });

  useEffect(() => {
    // Inject responsive grid styles
    const style = document.createElement('style');
    style.id = 'reports-responsive';
    style.textContent = `.reports-stats { display: grid; grid-template-columns: repeat(6,1fr); gap: 16px; } @media(max-width:900px){ .reports-stats { grid-template-columns: repeat(3,1fr); } } @media(max-width:600px){ .reports-stats { grid-template-columns: repeat(2,1fr); } }`;
    if (!document.getElementById('reports-responsive')) {
      document.head.appendChild(style);
    }
    return () => {
      const el = document.getElementById('reports-responsive');
      if (el) el.remove();
    };
  }, []);

  useEffect(() => {
    if (!boutique) return;
    setMilestonesLoading(true);
    setMilestonesError(null);
    supabase
      .from('payment_milestones')
      .select('id, amount, paid_date, event_id, status, label')
      .eq('boutique_id', boutique.id)
      .eq('status', 'paid')
      .then(({ data, error }) => {
        if (error) setMilestonesError(error.message);
        else setPaidMilestones(data || []);
        setMilestonesLoading(false);
      });
  }, [boutique?.id]);

  // Fetch expenses grouped by event_id
  useEffect(() => {
    if (!boutique) return;
    supabase
      .from('expenses')
      .select('event_id, amount')
      .eq('boutique_id', boutique.id)
      .then(({ data }) => {
        if (!data) return;
        const map = {};
        for (const row of data) {
          if (!row.event_id) continue;
          map[row.event_id] = (map[row.event_id] || 0) + Number(row.amount || 0);
        }
        setExpensesByEvent(map);
      });
  }, [boutique?.id]);

  // Fetch pipeline leads (include estimated_value for pipeline stat)
  useEffect(() => {
    if (!boutique) return;
    supabase
      .from('pipeline_leads')
      .select('id, stage, source, client_id, estimated_value')
      .eq('boutique_id', boutique.id)
      .then(({ data }) => {
        setPipelineLeads(data || []);
      });
  }, [boutique?.id]);

  // Fetch churn risk data
  useEffect(() => {
    if (!boutique) return;
    setChurnLoading(true);
    supabase
      .from('clients')
      .select(`
        id, name, phone, email, loyalty_points,
        client_interactions(occurred_at),
        events(event_date, status)
      `)
      .eq('boutique_id', boutique.id)
      .limit(200)
      .then(({ data }) => {
        setChurnData(data || []);
        setChurnLoading(false);
      });
  }, [boutique?.id]);

  // Fetch NPS overview data
  useEffect(() => {
    if (!boutique) return;
    supabase.from('nps_responses').select('score').eq('boutique_id', boutique.id)
      .then(({ data }) => setNpsOverview(data || []));
  }, [boutique?.id]);

  // Fetch heatmap data (events per day for past 52 weeks)
  useEffect(() => {
    if (!boutique) return;
    const oneYearAgo = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
    supabase.from('events').select('event_date').eq('boutique_id', boutique.id).gte('event_date', oneYearAgo)
      .then(({ data }) => {
        const counts = {};
        for (const ev of data || []) {
          if (ev.event_date) counts[ev.event_date] = (counts[ev.event_date] || 0) + 1;
        }
        setHeatmapData(counts);
      });
  }, [boutique?.id]);

  // Fetch damage overview stats
  useEffect(() => {
    if (!boutique) return;
    const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString();
    supabase
      .from('damage_reports')
      .select('id, status, repair_cost, reported_at, inventory_id, inventory:inventory(name)')
      .eq('boutique_id', boutique.id)
      .then(({ data, error }) => {
        if (error) {
          if (error.code === '42P01' || error.message?.includes('does not exist')) {
            setDamageStats(s => ({ ...s, tableExists: false }));
          }
          return;
        }
        const rows = data || [];
        const openCount = rows.filter(r => r.status === 'open').length;
        const repairCostYtd = rows
          .filter(r => r.reported_at >= yearStart)
          .reduce((s, r) => s + Number(r.repair_cost || 0), 0);
        const itemCounts = {};
        for (const r of rows) {
          const name = r.inventory?.name || r.inventory_id || 'Unknown';
          itemCounts[name] = (itemCounts[name] || 0) + 1;
        }
        const topItem = Object.entries(itemCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
        setDamageStats({ openCount, repairCostYtd, topItem, tableExists: true });
      });
  }, [boutique?.id]);

  // Fetch dress rental health stats from inventory returns
  useEffect(() => {
    if (!boutique) return;
    Promise.all([
      // Returned inventory items (condition data)
      supabase
        .from('inventory')
        .select('id, condition, status, deposit')
        .eq('boutique_id', boutique.id)
        .in('status', ['returned', 'available'])
        .not('return_date', 'is', null),
      // Damage reports for fee data
      supabase
        .from('damage_reports')
        .select('id, status, repair_cost, waived_cost')
        .eq('boutique_id', boutique.id),
    ]).then(([{ data: invData }, { data: dmgData }]) => {
      const returns = invData || [];
      const dmg = dmgData || [];
      const totalReturns = returns.length;
      const perfectReturns = returns.filter(r => !r.condition || r.condition === 'good' || r.condition === 'excellent' || r.condition === 'perfect').length;
      const damageFeesCollected = dmg
        .filter(d => d.status === 'resolved' || d.status === 'closed')
        .reduce((s, d) => s + Number(d.repair_cost || 0), 0);
      const damageFeesWaived = dmg
        .filter(d => d.status === 'waived')
        .reduce((s, d) => s + Number(d.waived_cost || d.repair_cost || 0), 0);
      setRentalHealth({ totalReturns, perfectReturns, damageFeesCollected, damageFeesWaived, loaded: true });
    });
  }, [boutique?.id]);

  const now = new Date();
  const filtered = useMemo(() => {
    if (period === 'all') return paidMilestones;
    const cutoff = new Date();
    if (period === '30d') cutoff.setDate(cutoff.getDate() - 30);
    if (period === '90d') cutoff.setDate(cutoff.getDate() - 90);
    if (period === 'ytd') cutoff.setMonth(0, 1);
    return paidMilestones.filter(p => p.paid_date && new Date(p.paid_date) >= cutoff);
  }, [paidMilestones, period]);

  const totalRevenue = filtered.reduce((s, p) => s + Number(p.amount || 0), 0);
  // payments prop = unpaid milestones from usePayments hook
  const outstanding  = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const overdue      = payments.filter(p => p.due_date && new Date(p.due_date) < now).reduce((s, p) => s + Number(p.amount || 0), 0);
  const totalContract = events.reduce((s, e) => s + Number(e.total || 0), 0);

  // Collection rate: paid / (paid + outstanding)
  const collectionBase = totalRevenue + outstanding;
  const collectionRate = collectionBase > 0
    ? Number((totalRevenue / collectionBase * 100).toFixed(0))
    : null;
  const collectionColor = collectionRate === null ? C.gray
    : collectionRate >= 80 ? C.green
    : collectionRate >= 50 ? C.amber
    : C.red;
  const collectionDisplay = collectionRate === null ? '—' : `${collectionRate}%`;

  const byType = useMemo(() => {
    const map = {};
    for (const e of events) {
      const key = e.type || 'other';
      if (!map[key]) map[key] = { count: 0, revenue: 0 };
      map[key].count++;
      map[key].revenue += Number(e.total || 0);
    }
    return Object.entries(map).sort((a, b) => b[1].revenue - a[1].revenue);
  }, [events]);

  const monthly = useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      const rev = paidMilestones
        .filter(p => p.paid_date?.startsWith(key))
        .reduce((s, p) => s + Number(p.amount || 0), 0);
      months.push({ label, rev });
    }
    return months;
  }, [paidMilestones]);

  const maxMonthly = Math.max(...monthly.map(m => m.rev), 1);

  // 12-month revenue trend
  const monthly12 = useMemo(() => {
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'short' });
      const rev = paidMilestones
        .filter(p => p.paid_date?.startsWith(key))
        .reduce((s, p) => s + Number(p.amount || 0), 0);
      months.push({ label, key, rev });
    }
    return months;
  }, [paidMilestones]);

  const maxMonthly12 = Math.max(...monthly12.map(m => m.rev), 1);

  const last6Sum = monthly12.slice(6).reduce((s, m) => s + m.rev, 0);
  const prev6Sum = monthly12.slice(0, 6).reduce((s, m) => s + m.rev, 0);
  const vsPrior = prev6Sum > 0
    ? Math.round(((last6Sum - prev6Sum) / prev6Sum) * 100)
    : last6Sum > 0 ? 100 : null;

  const topClients = useMemo(() => {
    const map = {};
    for (const p of paidMilestones) {
      const ev = events.find(e => e.id === p.event_id);
      const cid = ev?.client_id;
      if (!cid) continue;
      map[cid] = (map[cid] || 0) + Number(p.amount || 0);
    }
    return Object.entries(map)
      .map(([cid, rev]) => ({ client: clients.find(c => c.id === cid), rev }))
      .filter(r => r.client)
      .sort((a, b) => b.rev - a.rev)
      .slice(0, 5);
  }, [paidMilestones, events, clients]);

  // Events breakdown
  const activeEvents = events.filter(e => e.status !== 'cancelled');
  const thisMonth = now.toISOString().slice(0, 7);
  const eventsThisMonth = events.filter(e => e.event_date?.startsWith(thisMonth)).length;
  const avgEventValue = events.length > 0 ? (totalContract / events.length) : 0;
  const eventsByStatus = useMemo(() => {
    const counts = { planned: 0, confirmed: 0, completed: 0 };
    for (const e of events) {
      if (e.status in counts) counts[e.status]++;
    }
    return counts;
  }, [events]);

  const STATUS_COLORS = {
    planned:   { bg: C.blueBg,   text: C.blue },
    confirmed: { bg: C.greenBg,  text: C.green },
    completed: { bg: C.grayBg,   text: C.gray },
  };

  const packagePerformance = useMemo(() => {
    return packages
      .map(pkg => {
        const bookedEvents = events.filter(e => e.package_id === pkg.id);
        const totalRev = bookedEvents.reduce((s, e) => s + Number(e.total || 0), 0);
        return { ...pkg, bookedCount: bookedEvents.length, totalRevenue: totalRev };
      })
      .sort((a, b) => b.bookedCount - a.bookedCount);
  }, [packages, events]);

  const TYPE_LABELS_PKG = { wedding: 'Wedding', quince: 'Quinceañera', baptism: 'Baptism', birthday: 'Birthday', both: 'All types', other: 'Other' };

  const PERIODS = [['all', 'All time'], ['ytd', 'This year'], ['90d', '90 days'], ['30d', '30 days']];

  const statCard = (label, value, color, sub) => (
    <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: 22, fontWeight: 600, color, lineHeight: 1, marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 12, color: C.gray, fontWeight: 500 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>{sub}</div>}
    </div>
  );

  const TYPE_LABELS = { wedding: 'Wedding', quince: 'Quinceañera', baptism: 'Baptism', birthday: 'Birthday', other: 'Other' };

  // Section 2: Profit per event computation
  const profitRows = useMemo(() => {
    return events
      .map(ev => {
        const revenue = paidMilestones
          .filter(p => p.event_id === ev.id)
          .reduce((s, p) => s + Number(p.amount || 0), 0);
        const expenses = expensesByEvent[ev.id] || 0;
        const profit = revenue - expenses;
        const margin = revenue > 0 ? Math.round((profit / revenue) * 100) : null;
        const client = clients.find(c => c.id === ev.client_id);
        return { ev, client, revenue, expenses, profit, margin };
      })
      .filter(r => r.revenue > 0 || r.expenses > 0)
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 10);
  }, [events, paidMilestones, expensesByEvent, clients]);

  const avgMargin = useMemo(() => {
    const rows = profitRows.filter(r => r.margin !== null);
    if (rows.length === 0) return null;
    return Math.round(rows.reduce((s, r) => s + r.margin, 0) / rows.length);
  }, [profitRows]);

  // Section 5: Staff performance
  const [staffPerf, setStaffPerf] = useState({ evData: [], apptData: [] });

  useEffect(() => {
    if (!boutique) return;
    Promise.all([
      supabase
        .from('events')
        .select('id, total, paid, status, coordinator_id, event_date, coordinator:boutique_members!coordinator_id(name, initials, color)')
        .eq('boutique_id', boutique.id),
      supabase
        .from('appointments')
        .select('id, staff_id, status, staff:boutique_members!staff_id(name)')
        .eq('boutique_id', boutique.id)
        .neq('status', 'cancelled'),
    ]).then(([{ data: evData }, { data: apptData }]) => {
      setStaffPerf({ evData: evData || [], apptData: apptData || [] });
    });
  }, [boutique?.id]);

  const staffRows = useMemo(() => {
    const { evData, apptData } = staffPerf;
    const byStaff = {};
    for (const ev of evData) {
      const key = ev.coordinator_id || 'unassigned';
      const name = ev.coordinator?.name || 'Unassigned';
      const initials = ev.coordinator?.initials || '?';
      const color = ev.coordinator?.color || C.gray;
      if (!byStaff[key]) byStaff[key] = { name, initials, color, events: 0, revenue: 0, completed: 0, appointments: 0 };
      byStaff[key].events++;
      byStaff[key].revenue += Number(ev.paid || 0);
      if (ev.status === 'completed') byStaff[key].completed++;
    }
    for (const appt of apptData) {
      const key = appt.staff_id || 'unassigned';
      if (byStaff[key]) byStaff[key].appointments++;
    }
    return Object.values(byStaff).sort((a, b) => b.revenue - a.revenue);
  }, [staffPerf]);

  // ── Revenue forecast (next 90 days) ────────────────────────────────────────
  const { forecastRows, pipelineValue, collectRate } = useMemo(() => {
    const today = new Date();
    const next90 = new Date(today.getTime() + 90 * 86400000);

    const upcoming = payments.filter(p => {
      if (p.status === 'paid') return false;
      if (!p.due_date) return false;
      const d = new Date(p.due_date + 'T12:00:00');
      return d >= today && d <= next90;
    });

    const byMonth = {};
    for (const p of upcoming) {
      const d = new Date(p.due_date + 'T12:00:00');
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
      if (!byMonth[key]) byMonth[key] = { label, expected: 0, count: 0 };
      byMonth[key].expected += Number(p.amount);
      byMonth[key].count++;
    }

    const overdueRate = payments.filter(p => p.status === 'overdue').length / Math.max(payments.length, 1);
    const rate = Math.max(0.7, 1 - overdueRate);

    const rows = Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => ({
        ...v,
        conservative: v.expected * rate,
        optimistic: v.expected,
      }));

    const ACTIVE_STAGES = ['inquiry', 'consultation', 'proposal', 'booked'];
    const pipeline = pipelineLeads
      .filter(l => ACTIVE_STAGES.includes(l.stage))
      .reduce((s, l) => s + Number(l.estimated_value || 0), 0);

    return { forecastRows: rows, pipelineValue: pipeline, collectRate: rate };
  }, [payments, pipelineLeads]);

  // ── Churn risk scoring ──────────────────────────────────────────────────────
  const churnRows = useMemo(() => {
    return (churnData || []).map(c => {
      const interactions = c.client_interactions || [];
      const evts = c.events || [];

      if (interactions.length === 0 && evts.length === 0) return null;

      const lastInteraction = interactions.length > 0
        ? Math.max(...interactions.map(i => new Date(i.occurred_at).getTime()))
        : null;

      const lastEvent = evts.length > 0
        ? Math.max(...evts.map(e => new Date(e.event_date + 'T12:00:00').getTime()))
        : null;

      const hasUpcoming = evts.some(e =>
        e.status === 'active' || new Date(e.event_date + 'T12:00:00') > new Date()
      );
      if (hasUpcoming) return null;

      const daysSinceInteraction = lastInteraction
        ? (Date.now() - lastInteraction) / 86400000
        : 365;
      const daysSinceEvent = lastEvent
        ? (Date.now() - lastEvent) / 86400000
        : 365;

      if (daysSinceInteraction < 60 && daysSinceEvent < 90) return null;

      const score = Math.min(100,
        Math.min(daysSinceInteraction / 365 * 100, 40) * 0.4 +
        Math.min(daysSinceEvent / 365 * 100, 30) * 0.3 +
        (hasUpcoming ? 0 : 20) +
        (c.loyalty_points > 0 ? 0 : 10)
      );

      const risk = score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low';
      const lastSeenLabel = lastInteraction
        ? Math.round(daysSinceInteraction) + 'd ago'
        : 'Never';
      const lastEventLabel = lastEvent
        ? Math.round(daysSinceEvent) + 'd ago'
        : 'Never';

      return {
        ...c,
        score: Math.round(score),
        risk,
        lastSeenLabel,
        lastEventLabel,
      };
    }).filter(Boolean).sort((a, b) => b.score - a.score);
  }, [churnData]);

  // Section 7: Commission report
  const [commMembers, setCommMembers] = useState([]);
  const [markedPaid, setMarkedPaid] = useState({});
  const toast = useToast();

  // ── Feature 1: Inventory ROI ───────────────────────────────────────────────
  const { data: roiData, loading: roiLoading } = useInventoryROI();

  // ── Feature 2: Enhanced Commission Calculator ─────────────────────────────
  const { staffSummary: commStaff, commissions: allCommRows, loading: commLoading } = useCommissions();
  const [commPeriod, setCommPeriod] = useState('thisMonth');
  const [commExpanded, setCommExpanded] = useState({});
  const [commCustomStart, setCommCustomStart] = useState('');
  const [commCustomEnd, setCommCustomEnd] = useState('');

  // ── Feature 3: Client Lifetime Value ─────────────────────────────────────
  const [ltvClients, setLtvClients] = useState([]);
  const [ltvLoading, setLtvLoading] = useState(false);

  useEffect(() => {
    if (!boutique?.id) return;
    setLtvLoading(true);
    Promise.all([
      supabase
        .from('clients')
        .select('id, name, email, phone')
        .eq('boutique_id', boutique.id),
      supabase
        .from('events')
        .select('id, client_id, event_date, paid, type, status')
        .eq('boutique_id', boutique.id),
      supabase
        .from('loyalty_transactions')
        .select('client_id, delta')
        .eq('boutique_id', boutique.id),
    ]).then(([{ data: cls }, { data: evs }, { data: loyTxns }]) => {
      const allCls = cls || [];
      const allEvs = evs || [];
      const allTxns = loyTxns || [];
      const now = new Date();
      const computed = allCls.map(cl => {
        const clEvs = allEvs.filter(e => e.client_id === cl.id && e.event_date);
        const totalSpend = clEvs.reduce((s, e) => s + Number(e.paid || 0), 0);
        const eventCount = clEvs.length;
        const avgEventValue = eventCount > 0 ? totalSpend / eventCount : 0;
        const sorted = [...clEvs].sort((a, b) => a.event_date < b.event_date ? -1 : 1);
        const firstEventDate = sorted[0]?.event_date || null;
        const lastEventDate = sorted[sorted.length - 1]?.event_date || null;
        const daysSinceFirst = firstEventDate
          ? Math.round((now - new Date(firstEventDate)) / 86400000)
          : null;
        const loyaltyPoints = allTxns.filter(t => t.client_id === cl.id).reduce((s, t) => s + Number(t.delta || 0), 0);
        // Predicted next booking: avg gap between events
        let predictedNext = null;
        if (sorted.length >= 2) {
          let totalGap = 0;
          for (let i = 1; i < sorted.length; i++) {
            totalGap += new Date(sorted[i].event_date) - new Date(sorted[i - 1].event_date);
          }
          const avgGapMs = totalGap / (sorted.length - 1);
          predictedNext = new Date(new Date(lastEventDate).getTime() + avgGapMs).toISOString().slice(0, 10);
        }
        return { ...cl, totalSpend, eventCount, avgEventValue, firstEventDate, lastEventDate, daysSinceFirst, loyaltyPoints, predictedNext, ltv: totalSpend };
      }).filter(c => c.eventCount > 0).sort((a, b) => b.ltv - a.ltv);
      setLtvClients(computed);
      setLtvLoading(false);
    });
  }, [boutique?.id]);

  // ── Feature 4: Tax Reporting ─────────────────────────────────────────────
  const currentYear = new Date().getFullYear();
  const [taxQuarter, setTaxQuarter] = useState(() => {
    const m = new Date().getMonth();
    if (m < 3) return 'Q1';
    if (m < 6) return 'Q2';
    if (m < 9) return 'Q3';
    return 'Q4';
  });
  const [taxYear, setTaxYear] = useState(currentYear);
  const [taxRate, setTaxRate] = useState(8.5);
  const [taxMilestones, setTaxMilestones] = useState([]);
  const [taxLoading, setTaxLoading] = useState(false);

  useEffect(() => {
    if (!boutique?.id) return;
    const qMap = { Q1: [1, 3], Q2: [4, 6], Q3: [7, 9], Q4: [10, 12] };
    const [startM, endM] = qMap[taxQuarter];
    const startDate = `${taxYear}-${String(startM).padStart(2, '0')}-01`;
    const endDate = new Date(taxYear, endM, 0).toISOString().slice(0, 10);
    setTaxLoading(true);
    supabase
      .from('payment_milestones')
      .select('id, amount, paid_date, label, event_id, events(client_id, type, clients(name))')
      .eq('boutique_id', boutique.id)
      .eq('status', 'paid')
      .gte('paid_date', startDate)
      .lte('paid_date', endDate)
      .then(({ data }) => {
        setTaxMilestones(data || []);
        setTaxLoading(false);
      });
  }, [boutique?.id, taxQuarter, taxYear]);

  useEffect(() => {
    if (!boutique) return;
    supabase
      .from('boutique_members')
      .select('user_id, name, initials, color, commission_type, commission_pct, commission_flat')
      .eq('boutique_id', boutique.id)
      .then(({ data }) => setCommMembers(data || []));
  }, [boutique?.id]);

  const commissionRows = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
    const { evData } = staffPerf;
    return commMembers
      .filter(m => m.commission_type && m.commission_type !== 'none')
      .map(m => {
        const allEvs = evData.filter(ev => ev.coordinator_id === m.user_id);
        const monthEvs = allEvs.filter(ev => ev.event_date >= monthStart && ev.event_date <= monthEnd);
        const totalRevenue = allEvs.reduce((s, ev) => s + Number(ev.paid || 0), 0);
        const monthRevenue = monthEvs.reduce((s, ev) => s + Number(ev.paid || 0), 0);
        const earned = m.commission_type === 'percent'
          ? totalRevenue * (Number(m.commission_pct) / 100)
          : allEvs.length * Number(m.commission_flat || 0);
        const monthEarned = m.commission_type === 'percent'
          ? monthRevenue * (Number(m.commission_pct) / 100)
          : monthEvs.length * Number(m.commission_flat || 0);
        const commLabel = m.commission_type === 'percent'
          ? `${m.commission_pct}%`
          : `${fmt(m.commission_flat || 0)}/event`;
        return {
          user_id: m.user_id,
          name: m.name,
          initials: m.initials || '?',
          color: m.color || C.gray,
          commission_type: m.commission_type,
          commLabel,
          events: allEvs.length,
          revenue: totalRevenue,
          earned,
          monthEarned,
        };
      })
      .filter(r => r.events > 0 || true)
      .sort((a, b) => b.earned - a.earned);
  }, [commMembers, staffPerf]);

  // Section 6: Cohort retention
  const [showAllRepeat, setShowAllRepeat] = useState(false);

  const cohortRows = useMemo(() => {
    const byClient = {};
    for (const ev of events) {
      if (!ev.client_id) continue;
      if (!byClient[ev.client_id]) byClient[ev.client_id] = { client: ev.client, eventsArr: [] };
      byClient[ev.client_id].eventsArr.push({ type: ev.type, date: ev.event_date });
    }

    const repeatClients = Object.values(byClient).filter(c => c.eventsArr.length > 1);

    const journeys = {};
    for (const c of repeatClients) {
      const sorted = [...c.eventsArr].sort((a, b) => (a.date || '') < (b.date || '') ? -1 : 1);
      const key = sorted.map(e => TYPE_LABELS[e.type] || e.type || 'Other').join(' → ');
      journeys[key] = (journeys[key] || 0) + 1;
    }

    const typeEvents = {};
    for (const ev of events) {
      if (!typeEvents[ev.type]) typeEvents[ev.type] = { total: 0, clients: new Set() };
      typeEvents[ev.type].total++;
      if (ev.client_id) typeEvents[ev.type].clients.add(ev.client_id);
    }

    const repeatList = repeatClients.map(c => {
      const sorted = [...c.eventsArr].sort((a, b) => (a.date || '') < (b.date || '') ? -1 : 1);
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const gapMonths = first.date && last.date
        ? Math.round((new Date(last.date) - new Date(first.date)) / (1000 * 60 * 60 * 24 * 30))
        : null;
      return {
        name: c.client?.name || '—',
        firstType: TYPE_LABELS[first.type] || first.type || 'Other',
        returnType: TYPE_LABELS[last.type] || last.type || 'Other',
        gapMonths,
      };
    }).sort((a, b) => (b.gapMonths || 0) - (a.gapMonths || 0));

    return {
      repeatClients: repeatClients.length,
      totalClients: Object.keys(byClient).length,
      journeys: Object.entries(journeys).sort((a, b) => b[1] - a[1]),
      repeatList,
    };
  }, [events]);

  // ── Revenue by service line ────────────────────────────────────────────────
  const revenueByService = useMemo(() => {
    const buckets = {
      'Dress Rental': { total: 0, count: 0 },
      'Alterations':  { total: 0, count: 0 },
      'Decoration':   { total: 0, count: 0 },
      'Other':        { total: 0, count: 0 },
    };
    for (const p of paidMilestones) {
      const lbl = (p.label || '').toLowerCase();
      const amt = Number(p.amount || 0);
      if (/dress|rental/.test(lbl)) {
        buckets['Dress Rental'].total += amt;
        buckets['Dress Rental'].count++;
      } else if (/alteration/.test(lbl)) {
        buckets['Alterations'].total += amt;
        buckets['Alterations'].count++;
      } else if (/decor|floral/.test(lbl)) {
        buckets['Decoration'].total += amt;
        buckets['Decoration'].count++;
      } else {
        buckets['Other'].total += amt;
        buckets['Other'].count++;
      }
    }
    const grandTotal = Object.values(buckets).reduce((s, b) => s + b.total, 0);
    return Object.entries(buckets)
      .map(([name, { total, count }]) => ({
        name,
        total,
        count,
        pct: grandTotal > 0 ? Math.round((total / grandTotal) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [paidMilestones]);

  // ── Advanced Section A: Heatmap grid ───────────────────────────────────────
  const heatmapGrid = useMemo(() => {
    const today = new Date();
    const days = [];
    for (let i = 363; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push({
        date: key,
        count: heatmapData[key] || 0,
        label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      });
    }
    const weeks = [];
    for (let w = 0; w < 52; w++) weeks.push(days.slice(w * 7, w * 7 + 7));
    return weeks;
  }, [heatmapData]);

  const heatmapStats = useMemo(() => {
    const allDays = heatmapGrid.flat();
    const activeDays = allDays.filter(d => d.count > 0).length;
    const byMonth = {};
    for (const d of allDays) {
      const mo = d.date.slice(0, 7);
      byMonth[mo] = (byMonth[mo] || 0) + d.count;
    }
    let busiestMonth = null;
    let busiestCount = 0;
    for (const [mo, cnt] of Object.entries(byMonth)) {
      if (cnt > busiestCount) { busiestCount = cnt; busiestMonth = mo; }
    }
    const busiestLabel = busiestMonth
      ? new Date(busiestMonth + '-15').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      : null;
    return { activeDays, busiestLabel, busiestCount };
  }, [heatmapGrid]);

  // Month labels for heatmap top axis
  const heatmapMonthLabels = useMemo(() => {
    const labels = [];
    let lastMonth = null;
    heatmapGrid.forEach((week, wIdx) => {
      const firstDay = week[0];
      if (!firstDay) return;
      const mo = firstDay.date.slice(5, 7);
      if (mo !== lastMonth) {
        labels.push({ wIdx, label: new Date(firstDay.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short' }) });
        lastMonth = mo;
      }
    });
    return labels;
  }, [heatmapGrid]);

  // ── Advanced Section B: Year-over-Year ─────────────────────────────────────
  const yoyData = useMemo(() => {
    const thisYear = new Date().getFullYear();
    const lastYear = thisYear - 1;
    const months = Array.from({ length: 12 }, (_, i) => ({
      label: new Date(2024, i, 1).toLocaleString('en-US', { month: 'short' }),
      thisYear: 0,
      lastYear: 0,
    }));
    for (const m of paidMilestones) {
      if (!m.paid_date) continue;
      const d = new Date(m.paid_date);
      const yr = d.getFullYear();
      const mo = d.getMonth();
      const amt = Number(m.amount || 0);
      if (yr === thisYear) months[mo].thisYear += amt;
      else if (yr === lastYear) months[mo].lastYear += amt;
    }
    return months;
  }, [paidMilestones]);

  const yoyTotals = useMemo(() => ({
    thisYear: yoyData.reduce((s, m) => s + m.thisYear, 0),
    lastYear: yoyData.reduce((s, m) => s + m.lastYear, 0),
  }), [yoyData]);

  const yoyMaxBar = useMemo(() => Math.max(...yoyData.flatMap(m => [m.thisYear, m.lastYear]), 1), [yoyData]);

  const yoyYTicks = useMemo(() => {
    if (yoyMaxBar <= 0) return [0];
    const step = Math.ceil(yoyMaxBar / 4 / 100) * 100 || 1;
    return [0, step, step * 2, step * 3, step * 4].filter(v => v <= yoyMaxBar + step);
  }, [yoyMaxBar]);

  const yoyPct = useMemo(() => {
    if (yoyTotals.lastYear === 0) return yoyTotals.thisYear > 0 ? 100 : null;
    return Math.round(((yoyTotals.thisYear - yoyTotals.lastYear) / yoyTotals.lastYear) * 100);
  }, [yoyTotals]);

  // ── Advanced Section C: Profitability ranking ───────────────────────────────
  const profitRanking = useMemo(() => {
    return events
      .filter(ev => ev.status === 'completed' || Number(ev.paid) > 0)
      .map(ev => {
        const revenue = Number(ev.paid || 0);
        const expenses = Number(expensesByEvent[ev.id] || 0);
        const profit = revenue - expenses;
        const margin = revenue > 0 ? (profit / revenue * 100) : 0;
        const client = clients.find(c => c.id === ev.client_id);
        return { ...ev, revenue, expenses, profit, margin, client };
      })
      .sort((a, b) => b.profit - a.profit);
  }, [events, expensesByEvent, clients]);

  const profitRankingAvg = useMemo(() => {
    const rows = profitRanking.slice(0, 20);
    if (rows.length === 0) return null;
    return {
      revenue: rows.reduce((s, r) => s + r.revenue, 0) / rows.length,
      expenses: rows.reduce((s, r) => s + r.expenses, 0) / rows.length,
      profit: rows.reduce((s, r) => s + r.profit, 0) / rows.length,
      margin: rows.reduce((s, r) => s + r.margin, 0) / rows.length,
    };
  }, [profitRanking]);

  // Section 3: Conversion funnel
  const FUNNEL_STAGES = ['inquiry', 'consultation', 'proposal', 'booked', 'completed'];
  const funnelCounts = useMemo(() => {
    const counts = {};
    for (const stage of FUNNEL_STAGES) counts[stage] = 0;
    for (const lead of pipelineLeads) {
      const s = lead.stage?.toLowerCase();
      if (s && s in counts) counts[s]++;
    }
    // completed = events with status completed
    counts['completed'] = events.filter(e => e.status === 'completed').length;
    return counts;
  }, [pipelineLeads, events]);

  const funnelTop = Math.max(...Object.values(funnelCounts), 1);

  const FUNNEL_LABELS = {
    inquiry: 'Inquiry',
    consultation: 'Consultation',
    proposal: 'Proposal',
    booked: 'Booked',
    completed: 'Completed',
  };

  // Section 4: Acquisition sources
  const SOURCE_COLORS = ['#C9697A', '#7C6FCD', '#3B9EBF', '#45B37A', '#E8953A'];
  const SOURCE_LABELS = {
    instagram: 'Instagram',
    walk_in: 'Walk-in',
    referral: 'Referral',
    lead_form: 'Lead form',
    other: 'Other',
  };

  const sourceCounts = useMemo(() => {
    const map = {};
    for (const lead of pipelineLeads) {
      const src = lead.source || 'other';
      map[src] = (map[src] || 0) + 1;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [pipelineLeads]);

  const sourceMax = Math.max(...sourceCounts.map(([, c]) => c), 1);
  const totalLeads = pipelineLeads.length;

  // Y-axis tick values for 12-month chart
  const yTicks12 = useMemo(() => {
    if (maxMonthly12 <= 0) return [0];
    const step = Math.ceil(maxMonthly12 / 3 / 100) * 100 || 1;
    return [0, step, step * 2, step * 3].filter(v => v <= maxMonthly12 + step);
  }, [maxMonthly12]);

  // ── Feature 2: Commission period filter ────────────────────────────────────
  const filteredCommRows = useMemo(() => {
    const now = new Date();
    let startDate, endDate;
    if (commPeriod === 'thisMonth') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
    } else if (commPeriod === 'lastMonth') {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);
    } else if (commPeriod === 'thisQuarter') {
      const q = Math.floor(now.getMonth() / 3);
      startDate = new Date(now.getFullYear(), q * 3, 1).toISOString().slice(0, 10);
      endDate = new Date(now.getFullYear(), q * 3 + 3, 0).toISOString().slice(0, 10);
    } else if (commPeriod === 'custom') {
      startDate = commCustomStart;
      endDate = commCustomEnd;
    } else {
      return allCommRows;
    }
    if (!startDate || !endDate) return allCommRows;
    return allCommRows.filter(r => r.eventDate >= startDate && r.eventDate <= endDate);
  }, [allCommRows, commPeriod, commCustomStart, commCustomEnd]);

  const filteredCommStaff = useMemo(() => {
    const map = {};
    for (const row of filteredCommRows) {
      if (!map[row.staffId]) {
        map[row.staffId] = {
          staffId: row.staffId,
          staffName: row.staffName,
          staffInitials: row.staffInitials,
          staffColor: row.staffColor,
          commissionRate: row.commissionRate,
          events: [],
          totalRevenue: 0,
          totalCommission: 0,
        };
      }
      map[row.staffId].events.push(row);
      map[row.staffId].totalRevenue += row.revenue;
      map[row.staffId].totalCommission += row.commissionAmount;
    }
    return Object.values(map).sort((a, b) => b.totalCommission - a.totalCommission);
  }, [filteredCommRows]);

  const exportCommCSV = useCallback(() => {
    const rows = [['Staff', 'Event', 'Date', 'Revenue', 'Commission Rate', 'Commission Amount']];
    for (const r of filteredCommRows) {
      rows.push([r.staffName, r.eventName, r.eventDate || '', r.revenue.toFixed(2), `${r.commissionRate}%`, r.commissionAmount.toFixed(2)]);
    }
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `commissions-${commPeriod}.csv`;
    a.click();
  }, [filteredCommRows, commPeriod]);

  // ── Feature 4: Tax breakdown by month ─────────────────────────────────────
  const taxBreakdown = useMemo(() => {
    const qMap = { Q1: [1, 3], Q2: [4, 6], Q3: [7, 9], Q4: [10, 12] };
    const [startM, endM] = qMap[taxQuarter];
    const months = [];
    let running = 0;
    for (let m = startM; m <= endM; m++) {
      const key = `${taxYear}-${String(m).padStart(2, '0')}`;
      const rev = taxMilestones
        .filter(ms => ms.paid_date?.startsWith(key))
        .reduce((s, ms) => s + Number(ms.amount || 0), 0);
      running += rev;
      months.push({ label: new Date(taxYear, m - 1, 1).toLocaleString('en-US', { month: 'long' }), revenue: rev, running });
    }
    return months;
  }, [taxMilestones, taxQuarter, taxYear]);

  const taxGrossRevenue = taxMilestones.reduce((s, m) => s + Number(m.amount || 0), 0);
  const taxEstimated = taxGrossRevenue * (taxRate / 100);

  const exportTaxCSV = useCallback(() => {
    const rows = [['Date', 'Client', 'Event Type', 'Description', 'Amount']];
    for (const ms of taxMilestones) {
      const clientName = ms.events?.clients?.name || '—';
      const evType = ms.events?.type || '—';
      rows.push([ms.paid_date || '', clientName, evType, ms.label || '', Number(ms.amount || 0).toFixed(2)]);
    }
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `tax-report-${taxQuarter}-${taxYear}.csv`;
    a.click();
  }, [taxMilestones, taxQuarter, taxYear]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Topbar title="Reports" subtitle="Financial overview" actions={
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {goScreen && (
            <button
              onClick={() => goScreen('report_builder')}
              style={{
                padding: '6px 13px', borderRadius: 8, border: `1px solid ${C.border}`,
                background: C.white, color: C.ink, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              <span>⚙️</span> Custom report
            </button>
          )}
          <div style={{ display: 'flex', border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
            {PERIODS.map(([v, l]) => (
              <button key={v} onClick={() => setPeriod(v)}
                style={{ padding: '6px 12px', border: 'none', fontSize: 12, cursor: 'pointer', fontWeight: period === v ? 500 : 400,
                  background: period === v ? C.ink : C.white, color: period === v ? C.white : C.gray }}>
                {l}
              </button>
            ))}
          </div>
        </div>
      } />
      <div style={{ flex: 1, overflow: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {milestonesError && (
          <div style={{ background: '#fff0f0', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#b91c1c' }}>
            Failed to load payment data: {milestonesError}
          </div>
        )}
        {milestonesLoading && (
          <div style={{ textAlign: 'center', padding: '12px 0', fontSize: 13, color: C.gray }}>
            Loading payment data…
          </div>
        )}

        {/* Stats row — 6 cards, responsive via injected CSS */}
        <div className="reports-stats">
          {statCard('Revenue collected', fmt(totalRevenue), 'var(--color-success)')}
          {statCard('Outstanding balance', fmt(outstanding), outstanding > 0 ? C.ink : C.gray)}
          {statCard('Overdue', fmt(overdue), overdue > 0 ? 'var(--color-danger)' : C.gray)}
          {statCard('Total contract value', fmt(totalContract), C.ink, `${events.length} events`)}
          {statCard('Collection rate', collectionDisplay, collectionColor)}
          {damageStats.tableExists && statCard(
            'Open damage reports',
            damageStats.openCount > 0 ? damageStats.openCount : '—',
            damageStats.openCount > 0 ? C.red : C.gray,
            damageStats.repairCostYtd > 0
              ? `${fmt(damageStats.repairCostYtd)} repair costs YTD${damageStats.topItem ? ` · ${damageStats.topItem}` : ''}`
              : damageStats.topItem ? `Most: ${damageStats.topItem}` : 'No damage this year',
          )}
        </div>

        {/* NPS Overview card */}
        {(() => {
          if (npsOverview.length === 0) return null;
          const promoters = npsOverview.filter(n => n.score >= 9).length;
          const passives = npsOverview.filter(n => n.score >= 7 && n.score <= 8).length;
          const detractors = npsOverview.filter(n => n.score <= 6).length;
          const total = npsOverview.length;
          const avg = total > 0 ? Math.round((npsOverview.reduce((s, n) => s + (n.score || 0), 0) / total) * 10) / 10 : 0;
          const npsScore = total > 0 ? Math.round(((promoters - detractors) / total) * 100) : 0;
          const npsColor = npsScore >= 50 ? C.green : npsScore >= 0 ? C.amber : C.red;
          return (
            <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: C.ink, marginBottom: 12 }}>⭐ NPS Overview</div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: npsColor, lineHeight: 1 }}>{npsScore > 0 ? '+' : ''}{npsScore}</div>
                  <div style={{ fontSize: 11, color: C.gray, marginTop: 3 }}>NPS score</div>
                </div>
                <div style={{ width: 1, height: 40, background: C.border, flexShrink: 0 }} />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 600, color: C.ink }}>{avg}</div>
                  <div style={{ fontSize: 11, color: C.gray }}>Avg score</div>
                </div>
                <div style={{ width: 1, height: 40, background: C.border, flexShrink: 0 }} />
                <div style={{ display: 'flex', gap: 16 }}>
                  {[{ label: 'Promoters', count: promoters, color: C.green }, { label: 'Passives', count: passives, color: C.amber }, { label: 'Detractors', count: detractors, color: C.red }].map(({ label, count, color }) => (
                    <div key={label} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 18, fontWeight: 600, color }}>{count}</div>
                      <div style={{ fontSize: 11, color: C.gray }}>{label}</div>
                      <div style={{ fontSize: 10, color: C.gray }}>{total > 0 ? Math.round((count / total) * 100) : 0}%</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginLeft: 'auto', fontSize: 11, color: C.gray }}>{total} rating{total !== 1 ? 's' : ''} collected</div>
              </div>
            </div>
          );
        })()}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Monthly revenue bar chart */}
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.ink, marginBottom: 16 }}>Monthly revenue</div>
            {maxMonthly <= 1 && paidMilestones.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 0', gap: 8 }}>
                <div style={{ fontSize: 28 }}>📊</div>
                <div style={{ fontSize: 13, fontWeight: 500, color: C.ink }}>No revenue data yet</div>
                <div style={{ fontSize: 12, color: C.gray }}>Mark payment milestones as paid to see monthly trends</div>
              </div>
            ) : (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 160 }}>
              {monthly.map((m, idx) => {
                const barH = Math.max((m.rev / maxMonthly) * 130, m.rev > 0 ? 4 : 0);
                const isHovered = hoveredBar === idx;
                return (
                  <div key={m.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
                    <div
                      title={m.rev > 0 ? fmt(m.rev) : ''}
                      onMouseEnter={() => setHoveredBar(idx)}
                      onMouseLeave={() => setHoveredBar(null)}
                      style={{
                        width: '100%',
                        background: m.rev > 0 ? 'linear-gradient(to top, #C9697A, #E8B4BB)' : C.grayBg,
                        borderRadius: '4px 4px 2px 2px',
                        height: `${barH}px`,
                        transition: 'height 0.3s, filter 0.15s',
                        minHeight: m.rev > 0 ? 4 : 0,
                        cursor: m.rev > 0 ? 'default' : 'default',
                        filter: isHovered && m.rev > 0 ? 'brightness(1.08)' : 'none',
                        boxShadow: isHovered && m.rev > 0 ? `0 2px 8px rgba(201,105,122,0.35)` : 'none',
                      }}
                    />
                    <div style={{ fontSize: 9, color: C.gray, textAlign: 'center', whiteSpace: 'nowrap' }}>{m.label}</div>
                  </div>
                );
              })}
            </div>
            )}
          </div>

          {/* Revenue by event type */}
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.ink, marginBottom: 16 }}>Revenue by event type</div>
            {byType.length === 0 ? (
              <div style={{ color: C.gray, fontSize: 13, textAlign: 'center', paddingTop: 30 }}>No data yet</div>
            ) : byType.map(([type, data]) => (
              <div key={type} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
                  <span style={{ color: C.ink }}>{TYPE_LABELS[type] || type} <span style={{ color: C.gray }}>({data.count})</span></span>
                  <span style={{ color: C.ink, fontWeight: 500 }}>{fmt(data.revenue)}</span>
                </div>
                <div style={{ height: 6, background: C.grayBg, borderRadius: 3 }}>
                  <div style={{ height: '100%', width: `${(data.revenue / (byType[0][1].revenue || 1)) * 100}%`, background: C.rosa, borderRadius: 3 }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top clients */}
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: C.ink, marginBottom: 16 }}>Top clients by spend</div>
          {topClients.length === 0 ? (
            <div style={{ color: C.gray, fontSize: 13, textAlign: 'center', padding: '20px 0' }}>No payment data yet</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {['Client', 'Total paid'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: C.gray, fontWeight: 500, fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topClients.map((r, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: '10px 12px', color: C.ink }}>{r.client.name}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--color-success)', fontWeight: 500 }}>{fmt(r.rev)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Events breakdown — full width */}
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: C.ink, marginBottom: 16 }}>Events summary</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 16 }}>
            <div style={{ background: C.grayBg, borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ fontSize: 20, fontWeight: 600, color: C.ink, lineHeight: 1, marginBottom: 4 }}>{activeEvents.length}</div>
              <div style={{ fontSize: 12, color: C.gray }}>Active events</div>
            </div>
            <div style={{ background: C.grayBg, borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ fontSize: 20, fontWeight: 600, color: C.ink, lineHeight: 1, marginBottom: 4 }}>{eventsThisMonth}</div>
              <div style={{ fontSize: 12, color: C.gray }}>Events this month</div>
            </div>
            <div style={{ background: C.grayBg, borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ fontSize: 20, fontWeight: 600, color: C.ink, lineHeight: 1, marginBottom: 4 }}>
                {events.length > 0 ? fmt(Math.round(avgEventValue)) : '—'}
              </div>
              <div style={{ fontSize: 12, color: C.gray }}>Avg. event value</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: C.gray, marginRight: 4 }}>By status:</span>
            {Object.entries(eventsByStatus).map(([status, count]) => (
              <span key={status} style={{
                padding: '4px 12px',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 500,
                background: STATUS_COLORS[status]?.bg || C.grayBg,
                color: STATUS_COLORS[status]?.text || C.gray,
              }}>
                {status.charAt(0).toUpperCase() + status.slice(1)} {count}
              </span>
            ))}
          </div>
        </div>
        {/* Package performance */}
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: C.ink, marginBottom: 16 }}>Package performance</div>
          {packagePerformance.length === 0 || packagePerformance.every(p => p.bookedCount === 0) ? (
            <div style={{ color: C.gray, fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
              {packagePerformance.length === 0 ? 'No packages created yet' : 'No events have been booked with a package yet'}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {['Package', 'Event type', 'Base price', 'Events booked', 'Total revenue'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: C.gray, fontWeight: 500, fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {packagePerformance.map((pkg, i) => (
                  <tr key={pkg.id} style={{ borderBottom: i < packagePerformance.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                    <td style={{ padding: '10px 12px', color: C.ink, fontWeight: 500 }}>
                      {pkg.name}
                      {!pkg.active && <span style={{ marginLeft: 6, fontSize: 10, padding: '2px 6px', borderRadius: 999, background: C.grayBg, color: C.gray }}>archived</span>}
                    </td>
                    <td style={{ padding: '10px 12px', color: C.gray }}>{TYPE_LABELS_PKG[pkg.event_type] || pkg.event_type || '—'}</td>
                    <td style={{ padding: '10px 12px', color: C.gray }}>{fmt(pkg.base_price || 0)}</td>
                    <td style={{ padding: '10px 12px', color: pkg.bookedCount > 0 ? C.ink : C.gray, fontWeight: pkg.bookedCount > 0 ? 600 : 400 }}>{pkg.bookedCount}</td>
                    <td style={{ padding: '10px 12px', color: pkg.totalRevenue > 0 ? 'var(--color-success)' : C.gray, fontWeight: pkg.totalRevenue > 0 ? 500 : 400 }}>{pkg.totalRevenue > 0 ? fmt(pkg.totalRevenue) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Section 1: Revenue trend (12 months) ── */}
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.ink }}>📈 Revenue trend (12 months)</div>
            {vsPrior !== null && (
              <div style={{
                fontSize: 12,
                fontWeight: 600,
                color: vsPrior >= 0 ? C.green : C.red,
                background: vsPrior >= 0 ? C.greenBg : '#fff0f0',
                padding: '4px 10px',
                borderRadius: 999,
              }}>
                {vsPrior >= 0 ? '+' : ''}{vsPrior}% vs prior 6 months
              </div>
            )}
          </div>
          {maxMonthly12 <= 1 && paidMilestones.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '36px 0', gap: 8 }}>
              <div style={{ fontSize: 28 }}>📈</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: C.ink }}>No revenue data yet</div>
              <div style={{ fontSize: 12, color: C.gray }}>Paid milestones will appear here as a 12-month trend</div>
            </div>
          ) : (
          <div style={{ display: 'flex', gap: 12 }}>
            {/* Y-axis */}
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: 24, paddingTop: 4 }}>
              {[...yTicks12].reverse().map((tick, i) => (
                <div key={i} style={{ fontSize: 10, color: C.gray, whiteSpace: 'nowrap' }}>{fmt(tick)}</div>
              ))}
            </div>
            {/* Chart area */}
            <div style={{ flex: 1, position: 'relative' }}>
              {/* Horizontal gridlines */}
              <div style={{ position: 'absolute', inset: 0, bottom: 24, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', pointerEvents: 'none' }}>
                {yTicks12.map((_, i) => (
                  <div key={i} style={{ width: '100%', height: 1, background: C.border, opacity: 0.6 }} />
                ))}
              </div>
              {/* Bars + labels */}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 180, position: 'relative' }}>
                {monthly12.map((m, idx) => {
                  const barH = Math.max((m.rev / maxMonthly12) * 150, m.rev > 0 ? 4 : 0);
                  const isHov = hoveredBar12 === idx;
                  return (
                    <div
                      key={m.key}
                      style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end', position: 'relative' }}
                    >
                      {/* Tooltip */}
                      {isHov && m.rev > 0 && (
                        <div style={{
                          position: 'absolute',
                          bottom: 32,
                          left: '50%',
                          transform: 'translateX(-50%)',
                          background: C.ink,
                          color: C.white,
                          fontSize: 11,
                          fontWeight: 500,
                          padding: '4px 8px',
                          borderRadius: 6,
                          whiteSpace: 'nowrap',
                          zIndex: 10,
                          pointerEvents: 'none',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                        }}>
                          {fmt(m.rev)}
                        </div>
                      )}
                      <div
                        onMouseEnter={() => setHoveredBar12(idx)}
                        onMouseLeave={() => setHoveredBar12(null)}
                        style={{
                          width: '100%',
                          background: m.rev > 0 ? C.rosa : C.grayBg,
                          borderRadius: '4px 4px 2px 2px',
                          height: `${barH}px`,
                          minHeight: m.rev > 0 ? 4 : 0,
                          transition: 'filter 0.15s',
                          cursor: 'default',
                          filter: isHov && m.rev > 0 ? 'brightness(1.1)' : 'none',
                          boxShadow: isHov && m.rev > 0 ? `0 2px 8px rgba(201,105,122,0.4)` : 'none',
                        }}
                      />
                      <div style={{ fontSize: 9, color: C.gray, textAlign: 'center', whiteSpace: 'nowrap' }}>{m.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          )}
        </div>

        {/* ── Section 2: Profit per event ── */}
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.ink }}>💰 Profit per event</div>
            {avgMargin !== null && (
              <div style={{ fontSize: 12, color: C.gray }}>
                Avg margin: <span style={{ fontWeight: 600, color: avgMargin >= 0 ? C.green : C.red }}>{avgMargin}%</span>
              </div>
            )}
          </div>
          {profitRows.length === 0 ? (
            <div style={{ color: C.gray, fontSize: 13, textAlign: 'center', padding: '20px 0' }}>No event revenue data yet</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {['Event', 'Date', 'Revenue', 'Expenses', 'Profit', 'Margin'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: C.gray, fontWeight: 500, fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {profitRows.map((r, i) => (
                  <tr key={r.ev.id} style={{ borderBottom: i < profitRows.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                    <td style={{ padding: '10px 12px', color: C.ink, fontWeight: 500 }}>
                      {r.client?.name || '—'}
                    </td>
                    <td style={{ padding: '10px 12px', color: C.gray }}>
                      {r.ev.event_date ? new Date(r.ev.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : '—'}
                    </td>
                    <td style={{ padding: '10px 12px', color: C.ink }}>{fmt(r.revenue)}</td>
                    <td style={{ padding: '10px 12px', color: r.expenses > 0 ? C.red : C.gray }}>
                      {r.expenses > 0 ? fmt(r.expenses) : '—'}
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: r.profit >= 0 ? C.green : C.red }}>
                      {r.profit >= 0 ? '' : '-'}{fmt(Math.abs(r.profit))}
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: 500, color: r.margin === null ? C.gray : r.margin >= 0 ? C.green : C.red }}>
                      {r.margin !== null ? `${r.margin}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              {avgMargin !== null && (
                <tfoot>
                  <tr style={{ borderTop: `2px solid ${C.border}` }}>
                    <td colSpan={5} style={{ padding: '10px 12px', fontSize: 12, color: C.gray, fontWeight: 500 }}>Average margin</td>
                    <td style={{ padding: '10px 12px', fontWeight: 700, color: avgMargin >= 0 ? C.green : C.red }}>{avgMargin}%</td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>

        {/* ── Section 3 & 4: Funnel + Sources side by side ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

          {/* Section 3: Lead conversion funnel */}
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.ink, marginBottom: 16 }}>🔄 Lead conversion funnel</div>
            {totalLeads === 0 && funnelCounts['completed'] === 0 ? (
              <div style={{ color: C.gray, fontSize: 13, textAlign: 'center', padding: '20px 0' }}>No pipeline data yet</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {FUNNEL_STAGES.map((stage, idx) => {
                  const count = funnelCounts[stage] || 0;
                  const pct = funnelTop > 0 ? Math.round((count / funnelTop) * 100) : 0;
                  const prevCount = idx > 0 ? (funnelCounts[FUNNEL_STAGES[idx - 1]] || 0) : null;
                  const dropOff = prevCount !== null && prevCount > 0
                    ? Math.round(((prevCount - count) / prevCount) * 100)
                    : null;
                  return (
                    <div key={stage}>
                      {dropOff !== null && (
                        <div style={{ fontSize: 10, color: C.gray, textAlign: 'right', marginBottom: 2 }}>
                          -{dropOff}% drop-off
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 90, fontSize: 12, color: C.gray, textAlign: 'right', flexShrink: 0 }}>
                          {FUNNEL_LABELS[stage]}
                        </div>
                        <div style={{ flex: 1, height: 28, background: C.grayBg, borderRadius: 6, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            width: `${pct}%`,
                            background: C.rosa,
                            opacity: 1 - idx * 0.12,
                            borderRadius: 6,
                            transition: 'width 0.4s',
                            minWidth: count > 0 ? 4 : 0,
                          }} />
                        </div>
                        <div style={{ width: 48, fontSize: 12, fontWeight: 600, color: C.ink, textAlign: 'right', flexShrink: 0 }}>
                          {count} <span style={{ fontSize: 10, color: C.gray, fontWeight: 400 }}>({pct}%)</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 4: Acquisition sources */}
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: C.ink }}>📣 Acquisition sources</div>
              <div style={{ fontSize: 12, color: C.gray }}>{totalLeads} total lead{totalLeads !== 1 ? 's' : ''}</div>
            </div>
            {sourceCounts.length === 0 ? (
              <div style={{ color: C.gray, fontSize: 13, textAlign: 'center', padding: '20px 0' }}>No source data yet</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {sourceCounts.map(([src, count], idx) => {
                  const pct = Math.round((count / sourceMax) * 100);
                  const color = SOURCE_COLORS[idx % SOURCE_COLORS.length];
                  return (
                    <div key={src} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 80, fontSize: 12, color: C.gray, textAlign: 'right', flexShrink: 0 }}>
                        {SOURCE_LABELS[src] || src}
                      </div>
                      <div style={{ flex: 1, height: 24, background: C.grayBg, borderRadius: 5, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          width: `${pct}%`,
                          background: color,
                          borderRadius: 5,
                          transition: 'width 0.4s',
                          minWidth: count > 0 ? 4 : 0,
                        }} />
                      </div>
                      <div style={{ width: 56, fontSize: 12, fontWeight: 600, color: C.ink, textAlign: 'right', flexShrink: 0 }}>
                        {count} <span style={{ fontSize: 10, color: C.gray, fontWeight: 400 }}>({Math.round((count / (totalLeads || 1)) * 100)}%)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Section 5 & 6: Staff performance + Client retention ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

          {/* Section 5: Staff performance */}
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.ink, marginBottom: 16 }}>👥 Staff performance</div>
            {staffRows.length === 0 ? (
              <div style={{ color: C.gray, fontSize: 13, textAlign: 'center', padding: '20px 0' }}>No coordinator data yet</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                    {['Staff', 'Events', 'Completed', 'Revenue', 'Appts', 'Avg / event'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '6px 8px', color: C.gray, fontWeight: 500, fontSize: 11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {staffRows.map((row, i) => {
                    const isTop = i === 0 && row.revenue > 0;
                    const avg = row.events > 0 ? Math.round(row.revenue / row.events) : null;
                    return (
                      <tr key={row.name + i} style={{
                        borderBottom: `1px solid ${C.border}`,
                        borderLeft: isTop ? `3px solid #F59E0B` : `3px solid transparent`,
                        background: isTop ? '#FFFBEB' : 'transparent',
                      }}>
                        <td style={{ padding: '9px 8px', display: 'flex', alignItems: 'center', gap: 7 }}>
                          <div style={{
                            width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                            background: row.color || C.rosa,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 10, fontWeight: 700, color: C.white,
                          }}>
                            {row.initials}
                          </div>
                          <span style={{ color: C.ink, fontWeight: isTop ? 600 : 400 }}>{row.name}</span>
                        </td>
                        <td style={{ padding: '9px 8px', color: C.ink }}>{row.events}</td>
                        <td style={{ padding: '9px 8px', color: row.completed > 0 ? C.green : C.gray }}>
                          {row.completed > 0 ? `✓ ${row.completed}` : row.completed}
                        </td>
                        <td style={{ padding: '9px 8px', color: row.revenue > 0 ? C.ink : C.gray, fontWeight: row.revenue > 0 ? 500 : 400 }}>
                          {row.revenue > 0 ? fmt(row.revenue) : '—'}
                        </td>
                        <td style={{ padding: '9px 8px', color: C.ink }}>{row.appointments}</td>
                        <td style={{ padding: '9px 8px', color: avg !== null ? C.gray : C.gray }}>
                          {avg !== null ? fmt(avg) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {staffRows.length > 1 && (
                  <tfoot>
                    <tr style={{ borderTop: `2px solid ${C.border}` }}>
                      <td style={{ padding: '9px 8px', fontWeight: 700, color: C.ink }}>Total</td>
                      <td style={{ padding: '9px 8px', fontWeight: 700, color: C.ink }}>
                        {staffRows.reduce((s, r) => s + r.events, 0)}
                      </td>
                      <td style={{ padding: '9px 8px', fontWeight: 700, color: C.green }}>
                        {staffRows.reduce((s, r) => s + r.completed, 0)}
                      </td>
                      <td style={{ padding: '9px 8px', fontWeight: 700, color: C.ink }}>
                        {fmt(staffRows.reduce((s, r) => s + r.revenue, 0))}
                      </td>
                      <td style={{ padding: '9px 8px', fontWeight: 700, color: C.ink }}>
                        {staffRows.reduce((s, r) => s + r.appointments, 0)}
                      </td>
                      <td style={{ padding: '9px 8px', color: C.gray }}>—</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            )}
          </div>

          {/* Section 6: Client retention */}
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.ink, marginBottom: 16 }}>🔄 Client retention</div>

            {/* Summary stat cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 20 }}>
              {[
                { label: 'Unique clients', value: cohortRows.totalClients, color: C.ink },
                { label: 'Repeat clients', value: cohortRows.repeatClients, color: cohortRows.repeatClients > 0 ? C.green : C.gray },
                {
                  label: 'Retention rate',
                  value: cohortRows.totalClients > 0
                    ? `${Math.round((cohortRows.repeatClients / cohortRows.totalClients) * 100)}%`
                    : '—',
                  color: cohortRows.repeatClients > 0 ? C.green : C.gray,
                },
              ].map(s => (
                <div key={s.label} style={{ background: C.grayBg, borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: s.color, lineHeight: 1, marginBottom: 3 }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: C.gray }}>{s.label}</div>
                </div>
              ))}
            </div>

            {cohortRows.repeatClients === 0 ? (
              <div style={{ color: C.gray, fontSize: 13, textAlign: 'center', padding: '16px 0' }}>
                No repeat clients yet — keep building those relationships! 💪
              </div>
            ) : (
              <>
                {/* Booking journeys */}
                {cohortRows.journeys.length > 0 && (
                  <div style={{ marginBottom: 18 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: C.ink, marginBottom: 8 }}>Booking journeys</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                      {cohortRows.journeys.map(([journey, count]) => {
                        const maxJ = cohortRows.journeys[0][1];
                        const barW = Math.round((count / maxJ) * 100);
                        return (
                          <div key={journey} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 130, fontSize: 11, color: C.gray, textAlign: 'right', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {journey}
                            </div>
                            <div style={{ flex: 1, height: 18, background: C.grayBg, borderRadius: 4, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${barW}%`, background: C.rosa, borderRadius: 4, transition: 'width 0.4s', minWidth: 4 }} />
                            </div>
                            <div style={{ width: 64, fontSize: 11, color: C.ink, fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' }}>
                              {count} {count === 1 ? 'family' : 'families'}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Repeat client list */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: C.ink, marginBottom: 8 }}>Returning clients</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                        {['Client', 'First event', 'Return event', 'Gap'].map(h => (
                          <th key={h} style={{ textAlign: 'left', padding: '5px 8px', color: C.gray, fontWeight: 500, fontSize: 11 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(showAllRepeat ? cohortRows.repeatList : cohortRows.repeatList.slice(0, 5)).map((r, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                          <td style={{ padding: '7px 8px', color: C.ink, fontWeight: 500 }}>{r.name}</td>
                          <td style={{ padding: '7px 8px', color: C.gray }}>{r.firstType}</td>
                          <td style={{ padding: '7px 8px', color: C.gray }}>{r.returnType}</td>
                          <td style={{ padding: '7px 8px', color: C.gray }}>
                            {r.gapMonths !== null ? `${r.gapMonths}mo` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {cohortRows.repeatList.length > 5 && (
                    <button
                      onClick={() => setShowAllRepeat(v => !v)}
                      style={{ marginTop: 8, fontSize: 12, color: C.rosa, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 500 }}
                    >
                      {showAllRepeat ? 'Show less' : `Show all ${cohortRows.repeatList.length} clients`}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Section 7: Commission report */}
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, marginTop: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: C.ink, marginBottom: 4 }}>💰 Commission report</div>
          <div style={{ fontSize: 12, color: C.gray, marginBottom: 16 }}>
            Staff with commission plans. "This month" shows earnings for {new Date().toLocaleString('default', {month:'long',year:'numeric'})}.
          </div>
          {commissionRows.length === 0 ? (
            <div style={{ color: C.gray, fontSize: 13, textAlign: 'center', padding: '24px 0' }}>
              No staff commission plans set up yet. Edit a staff member in Settings → Staff to configure commissions.
            </div>
          ) : (
            <>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                    {['Staff member', 'Events', 'Revenue collected', 'Commission rate', 'Total earned', 'This month'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '6px 8px', color: C.gray, fontWeight: 500, fontSize: 11 }}>{h}</th>
                    ))}
                    <th style={{ padding: '6px 8px', width: 110 }}/>
                  </tr>
                </thead>
                <tbody>
                  {commissionRows.map((row, i) => {
                    const isPaid = markedPaid[row.user_id];
                    return (
                      <tr key={row.user_id} style={{ borderBottom: `1px solid ${C.border}` }}>
                        <td style={{ padding: '10px 8px', display: 'flex', alignItems: 'center', gap: 7 }}>
                          <div style={{
                            width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                            background: row.color, display: 'flex', alignItems: 'center',
                            justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff',
                          }}>
                            {row.initials}
                          </div>
                          <span style={{ fontWeight: 500, color: C.ink }}>{row.name}</span>
                        </td>
                        <td style={{ padding: '10px 8px', color: C.ink }}>{row.events}</td>
                        <td style={{ padding: '10px 8px', color: C.ink }}>{row.revenue > 0 ? fmt(row.revenue) : '—'}</td>
                        <td style={{ padding: '10px 8px', color: C.gray }}>{row.commLabel}</td>
                        <td style={{ padding: '10px 8px', color: row.earned > 0 ? C.ink : C.gray, fontWeight: row.earned > 0 ? 600 : 400 }}>
                          {row.earned > 0 ? fmt(row.earned) : '—'}
                        </td>
                        <td style={{ padding: '10px 8px', color: row.monthEarned > 0 ? '#15803D' : C.gray, fontWeight: row.monthEarned > 0 ? 600 : 400 }}>
                          {row.monthEarned > 0 ? fmt(row.monthEarned) : '—'}
                        </td>
                        <td style={{ padding: '10px 8px' }}>
                          {row.monthEarned > 0 && (
                            isPaid ? (
                              <span style={{ fontSize: 11, color: C.green, fontWeight: 500 }}>✓ Paid</span>
                            ) : (
                              <button
                                onClick={() => {
                                  setMarkedPaid(p => ({...p, [row.user_id]: true}));
                                  toast(`Commission marked as paid for ${row.name}`);
                                }}
                                style={{
                                  fontSize: 11, padding: '4px 10px', borderRadius: 6,
                                  border: `1px solid ${C.border}`, background: C.grayBg,
                                  color: C.ink, cursor: 'pointer', whiteSpace: 'nowrap',
                                }}
                              >
                                Mark paid
                              </button>
                            )
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {commissionRows.length > 1 && (
                  <tfoot>
                    <tr style={{ borderTop: `2px solid ${C.border}` }}>
                      <td style={{ padding: '9px 8px', fontWeight: 700, color: C.ink }}>Total</td>
                      <td style={{ padding: '9px 8px', fontWeight: 700, color: C.ink }}>
                        {commissionRows.reduce((s, r) => s + r.events, 0)}
                      </td>
                      <td style={{ padding: '9px 8px', fontWeight: 700, color: C.ink }}>
                        {fmt(commissionRows.reduce((s, r) => s + r.revenue, 0))}
                      </td>
                      <td style={{ padding: '9px 8px', color: C.gray }}>—</td>
                      <td style={{ padding: '9px 8px', fontWeight: 700, color: C.ink }}>
                        {fmt(commissionRows.reduce((s, r) => s + r.earned, 0))}
                      </td>
                      <td style={{ padding: '9px 8px', fontWeight: 700, color: '#15803D' }}>
                        {fmt(commissionRows.reduce((s, r) => s + r.monthEarned, 0))}
                      </td>
                      <td/>
                    </tr>
                  </tfoot>
                )}
              </table>
            </>
          )}
        </div>

        {/* ── Revenue Forecast ── */}
        {(() => {
          const total90 = forecastRows.reduce((s, r) => s + (forecastMode === 'conservative' ? r.conservative : r.optimistic), 0);
          const maxBar = Math.max(...forecastRows.map(r => r.optimistic), 1);
          const collectPct = Math.round(collectRate * 100);
          return (
            <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: C.ink }}>📈 Revenue forecast</div>
                {/* Mode toggle */}
                <div style={{ display: 'flex', border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
                  {[['conservative', 'Conservative'], ['optimistic', 'Optimistic']].map(([v, l]) => (
                    <button key={v} onClick={() => setForecastMode(v)}
                      style={{ padding: '5px 12px', border: 'none', fontSize: 11, cursor: 'pointer', fontWeight: forecastMode === v ? 600 : 400,
                        background: forecastMode === v ? C.ink : C.white, color: forecastMode === v ? C.white : C.gray }}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ fontSize: 12, color: C.gray, marginBottom: 16 }}>
                Next 90 days · {forecastMode === 'conservative'
                  ? `(based on ${collectPct}% collection rate)`
                  : '(full milestone value)'}
              </div>

              {/* Pipeline stat */}
              {pipelineValue > 0 && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: C.grayBg, borderRadius: 8, padding: '6px 12px', marginBottom: 16, fontSize: 12, color: C.ink }}>
                  <span style={{ color: C.gray }}>Pipeline:</span>
                  <span style={{ fontWeight: 600, color: C.ink }}>{fmt(pipelineValue)}</span>
                  <span style={{ color: C.gray }}>potential revenue</span>
                </div>
              )}

              {forecastRows.length === 0 ? (
                <div style={{ color: C.gray, fontSize: 13, textAlign: 'center', padding: '24px 0' }}>
                  No upcoming payment milestones in the next 90 days
                </div>
              ) : (
                <>
                  {/* Summary stat */}
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 20 }}>
                    <div style={{ fontSize: 28, fontWeight: 700, color: C.ink, lineHeight: 1 }}>{fmt(Math.round(total90))}</div>
                    <div style={{ fontSize: 12, color: C.gray }}>expected next 90 days</div>
                  </div>

                  {/* Bar chart */}
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, height: 120, marginBottom: 20 }}>
                    {forecastRows.map((row, idx) => {
                      const val = forecastMode === 'conservative' ? row.conservative : row.optimistic;
                      const barH = Math.max((val / maxBar) * 90, val > 0 ? 4 : 0);
                      return (
                        <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
                          <div style={{ fontSize: 10, color: C.ink, fontWeight: 600 }}>{val > 0 ? fmt(Math.round(val)) : ''}</div>
                          <div style={{
                            width: '100%',
                            background: 'linear-gradient(to top, #7C6FCD, #B8B3E8)',
                            borderRadius: '4px 4px 2px 2px',
                            height: `${barH}px`,
                            minHeight: val > 0 ? 4 : 0,
                          }} />
                          <div style={{ fontSize: 11, color: C.gray, textAlign: 'center', whiteSpace: 'nowrap' }}>{row.label}</div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Detail table */}
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                        {['Month', 'Due (gross)', 'Expected', 'Milestones'].map(h => (
                          <th key={h} style={{ textAlign: 'left', padding: '6px 8px', color: C.gray, fontWeight: 500, fontSize: 11 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {forecastRows.map((row, i) => (
                        <tr key={i} style={{ borderBottom: i < forecastRows.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                          <td style={{ padding: '8px 8px', color: C.ink, fontWeight: 500 }}>{row.label}</td>
                          <td style={{ padding: '8px 8px', color: C.gray }}>{fmt(Math.round(row.optimistic))}</td>
                          <td style={{ padding: '8px 8px', color: C.ink, fontWeight: 600 }}>
                            {fmt(Math.round(forecastMode === 'conservative' ? row.conservative : row.optimistic))}
                          </td>
                          <td style={{ padding: '8px 8px', color: C.gray }}>{row.count}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: `2px solid ${C.border}` }}>
                        <td style={{ padding: '8px 8px', fontWeight: 700, color: C.ink }}>Total</td>
                        <td style={{ padding: '8px 8px', color: C.gray }}>{fmt(Math.round(forecastRows.reduce((s, r) => s + r.optimistic, 0)))}</td>
                        <td style={{ padding: '8px 8px', fontWeight: 700, color: C.ink }}>{fmt(Math.round(total90))}</td>
                        <td style={{ padding: '8px 8px', color: C.gray }}>{forecastRows.reduce((s, r) => s + r.count, 0)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </>
              )}
            </div>
          );
        })()}

        {/* ── Pipeline summary card ── */}
        {(() => {
          const ACTIVE_PIPELINE_STAGES = ['inquiry', 'consultation', 'proposal', 'booked'];
          const STAGE_LABELS = { inquiry: 'Inquiry', consultation: 'Consultation', proposal: 'Quoted', booked: 'Booked' };
          const STAGE_COLORS = { inquiry: '#7C6FCD', consultation: '#3B9EBF', proposal: '#E8953A', booked: C.green };
          const activeLeads = pipelineLeads.filter(l => ACTIVE_PIPELINE_STAGES.includes(l.stage) && !l.converted_at);
          const pipelineTotal = activeLeads.reduce((s, l) => s + Number(l.estimated_value || 0), 0);
          const stageCounts = {};
          const stageValues = {};
          for (const stage of ACTIVE_PIPELINE_STAGES) {
            stageCounts[stage] = activeLeads.filter(l => l.stage === stage).length;
            stageValues[stage] = activeLeads.filter(l => l.stage === stage).reduce((s, l) => s + Number(l.estimated_value || 0), 0);
          }
          const maxStageVal = Math.max(...ACTIVE_PIPELINE_STAGES.map(s => stageValues[s]), 1);
          return (
            <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: C.ink }}>Pipeline summary</div>
                {pipelineTotal > 0 && (
                  <div style={{ fontSize: 12, color: C.gray }}>
                    <span style={{ fontWeight: 700, color: C.ink, fontSize: 14 }}>{fmt(pipelineTotal)}</span>
                    {' '}potential revenue
                  </div>
                )}
              </div>
              <div style={{ fontSize: 12, color: C.gray, marginBottom: 16 }}>Active leads by stage (excluding converted)</div>
              {activeLeads.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px 0', gap: 8 }}>
                  <div style={{ fontSize: 28 }}>🎯</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: C.ink }}>No active pipeline leads</div>
                  <div style={{ fontSize: 12, color: C.gray }}>Add leads in the Clients section to track your pipeline</div>
                </div>
              ) : (
                <>
                  {/* Summary chips */}
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
                    {ACTIVE_PIPELINE_STAGES.map(stage => (
                      <div key={stage} style={{ background: C.grayBg, borderRadius: 8, padding: '10px 14px', minWidth: 100 }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: STAGE_COLORS[stage] || C.ink, lineHeight: 1, marginBottom: 3 }}>
                          {stageCounts[stage]}
                        </div>
                        <div style={{ fontSize: 11, color: C.gray }}>{STAGE_LABELS[stage]}</div>
                        {stageValues[stage] > 0 && (
                          <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>{fmt(stageValues[stage])}</div>
                        )}
                      </div>
                    ))}
                  </div>
                  {/* Horizontal bars per stage */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {ACTIVE_PIPELINE_STAGES.map(stage => {
                      const count = stageCounts[stage];
                      const val = stageValues[stage];
                      const barPct = maxStageVal > 0 ? Math.round((val / maxStageVal) * 100) : 0;
                      const color = STAGE_COLORS[stage] || C.gray;
                      return (
                        <div key={stage} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 90, fontSize: 12, color: C.gray, flexShrink: 0, textAlign: 'right' }}>
                            {STAGE_LABELS[stage]}
                            <span style={{ marginLeft: 5, color: C.ink, fontWeight: 600 }}>({count})</span>
                          </div>
                          <div style={{ flex: 1, height: 22, background: C.grayBg, borderRadius: 5, overflow: 'hidden' }}>
                            <div style={{
                              height: '100%',
                              width: `${barPct}%`,
                              background: color,
                              borderRadius: 5,
                              transition: 'width 0.4s',
                              minWidth: count > 0 ? 4 : 0,
                              opacity: 0.85,
                            }} />
                          </div>
                          <div style={{ width: 70, fontSize: 12, color: C.ink, fontWeight: 500, textAlign: 'right', flexShrink: 0 }}>
                            {val > 0 ? fmt(val) : '—'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          );
        })()}

        {/* ── Dress rental health ── */}
        {damageStats.tableExists && (() => {
          const { totalReturns, perfectReturns, damageFeesCollected, damageFeesWaived, loaded } = rentalHealth;
          const perfectPct = totalReturns > 0 ? Math.round((perfectReturns / totalReturns) * 100) : null;
          const perfectColor = perfectPct === null ? C.gray : perfectPct >= 90 ? C.green : perfectPct >= 70 ? C.amber : C.red;
          return (
            <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: C.ink, marginBottom: 4 }}>Dress rental health</div>
              <div style={{ fontSize: 12, color: C.gray, marginBottom: 16 }}>Return condition and damage fee overview</div>
              {!loaded ? (
                <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 13, color: C.gray }}>Loading rental data…</div>
              ) : totalReturns === 0 && damageFeesCollected === 0 && damageFeesWaived === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px 0', gap: 8 }}>
                  <div style={{ fontSize: 28 }}>👗</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: C.ink }}>No rental return data yet</div>
                  <div style={{ fontSize: 12, color: C.gray }}>Return data will appear once dresses are checked back in</div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                  {[
                    {
                      label: 'Total returns',
                      value: totalReturns > 0 ? totalReturns : '—',
                      color: C.ink,
                      sub: null,
                    },
                    {
                      label: 'Perfect condition',
                      value: perfectPct !== null ? `${perfectPct}%` : '—',
                      color: perfectColor,
                      sub: totalReturns > 0 ? `${perfectReturns} of ${totalReturns} returns` : null,
                    },
                    {
                      label: 'Damage fees collected',
                      value: damageFeesCollected > 0 ? fmt(damageFeesCollected) : '—',
                      color: damageFeesCollected > 0 ? C.red : C.gray,
                      sub: null,
                    },
                    {
                      label: 'Damage fees waived',
                      value: damageFeesWaived > 0 ? fmt(damageFeesWaived) : '—',
                      color: damageFeesWaived > 0 ? C.amber : C.gray,
                      sub: null,
                    },
                  ].map(({ label, value, color, sub }) => (
                    <div key={label} style={{ background: C.grayBg, borderRadius: 10, padding: '14px 16px' }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color, lineHeight: 1, marginBottom: 4 }}>{value}</div>
                      <div style={{ fontSize: 11, color: C.gray }}>{label}</div>
                      {sub && <div style={{ fontSize: 10, color: C.gray, marginTop: 3 }}>{sub}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* ── Client retention risk (at-risk clients) ── */}
        {(() => {
          const highRisk = churnRows.filter(r => r.risk === 'high');
          const medRisk = churnRows.filter(r => r.risk === 'medium');
          const top10 = churnRows.slice(0, 10);
          // Red = high (12+ months), Amber = medium (6–12 months)
          const RISK_COLORS = {
            high:   { bg: '#fef2f2', text: '#dc2626', label: 'Red' },
            medium: { bg: '#fffbeb', text: '#d97706', label: 'Amber' },
          };
          return (
            <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: C.ink }}>At-risk clients</div>
                {churnLoading && <div style={{ fontSize: 11, color: C.gray }}>Loading…</div>}
              </div>
              {churnRows.length > 0 && (
                <div style={{ fontSize: 12, color: C.gray, marginBottom: 16 }}>
                  <span style={{ color: '#dc2626', fontWeight: 600 }}>{highRisk.length}</span> Red (12+ months inactive) &nbsp;·&nbsp;
                  <span style={{ color: '#d97706', fontWeight: 600 }}>{medRisk.length}</span> Amber (6–12 months)
                </div>
              )}
              {!churnLoading && churnRows.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px 0', gap: 8 }}>
                  <div style={{ fontSize: 28 }}>✅</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: C.green }}>No at-risk clients — great retention!</div>
                  <div style={{ fontSize: 12, color: C.gray }}>All active clients have had recent contact or upcoming events</div>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                      {['Client name', 'Last event', 'Days since last contact', 'Risk level', 'Action'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '6px 8px', color: C.gray, fontWeight: 500, fontSize: 11 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {top10.map((row, i) => {
                      const cfg = RISK_COLORS[row.risk] || RISK_COLORS.medium;
                      const boutiqueNameFull = boutique?.name || 'us';
                      const smsTemplate = `Hi ${row.name?.split(' ')[0] || 'there'}, we miss you at ${boutiqueNameFull}! We'd love to help with your next celebration. Reply to schedule a free consultation 💐`;
                      // Extract numeric days from lastSeenLabel (e.g. "182d ago" → 182)
                      const daysSinceContact = row.lastSeenLabel && row.lastSeenLabel !== 'Never'
                        ? row.lastSeenLabel.replace('d ago', ' days')
                        : 'Never';
                      return (
                        <tr
                          key={row.id}
                          style={{ borderBottom: i < top10.length - 1 ? `1px solid ${C.border}` : 'none', cursor: goScreen ? 'pointer' : 'default' }}
                          onClick={goScreen ? () => goScreen('clients') : undefined}
                          title={goScreen ? `Go to ${row.name}'s profile` : undefined}
                        >
                          <td style={{ padding: '9px 8px', color: C.ink, fontWeight: 500 }}>
                            {goScreen ? (
                              <span style={{ color: C.rosa, textDecoration: 'underline', cursor: 'pointer' }}>{row.name}</span>
                            ) : row.name}
                          </td>
                          <td style={{ padding: '9px 8px', color: C.gray }}>{row.lastEventLabel}</td>
                          <td style={{ padding: '9px 8px', color: C.gray }}>{daysSinceContact}</td>
                          <td style={{ padding: '9px 8px' }}>
                            <span style={{
                              display: 'inline-block', padding: '2px 8px', borderRadius: 999,
                              fontSize: 11, fontWeight: 600,
                              background: cfg.bg, color: cfg.text,
                            }}>
                              {cfg.label}
                            </span>
                          </td>
                          <td style={{ padding: '9px 8px' }} onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => {
                                navigator.clipboard?.writeText(smsTemplate).catch(() => {});
                                toast(`SMS template copied for ${row.name?.split(' ')[0]}`);
                              }}
                              style={{
                                fontSize: 11, padding: '4px 10px', borderRadius: 6,
                                border: `1px solid ${C.border}`, background: C.grayBg,
                                color: C.ink, cursor: 'pointer', whiteSpace: 'nowrap',
                              }}
                            >
                              Copy SMS
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          );
        })()}


        {/* ── Advanced Section A: Activity Heatmap ── */}
        <UpgradeGate minPlan="pro" feature="Activity Heatmap">
        {(() => {
          const HEAT_COLORS = ['#E5E7EB', '#BBF7D0', '#4ADE80', '#16A34A'];
          const getHeatColor = (count) => {
            if (count === 0) return HEAT_COLORS[0];
            if (count === 1) return HEAT_COLORS[1];
            if (count === 2) return HEAT_COLORS[2];
            return HEAT_COLORS[3];
          };
          const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          const totalEvents = Object.values(heatmapData).reduce((s, v) => s + v, 0);
          return (
            <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: C.ink }}>Booking activity — last 12 months</div>
                <div style={{ display: 'flex', gap: 16, fontSize: 12, color: C.gray }}>
                  {heatmapStats.activeDays > 0 && (
                    <span><span style={{ fontWeight: 600, color: C.ink }}>{heatmapStats.activeDays}</span> active days</span>
                  )}
                  {heatmapStats.busiestLabel && (
                    <span>Busiest: <span style={{ fontWeight: 600, color: C.ink }}>{heatmapStats.busiestLabel}</span> ({heatmapStats.busiestCount} events)</span>
                  )}
                </div>
              </div>
              <div style={{ fontSize: 12, color: C.gray, marginBottom: 16 }}>Events per day over the past 52 weeks</div>

              {totalEvents === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 0', gap: 8 }}>
                  <div style={{ fontSize: 28 }}>📅</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: C.ink }}>No event activity in the past year</div>
                  <div style={{ fontSize: 12, color: C.gray }}>Create events with future dates to see booking activity here</div>
                </div>
              ) : <>
              {/* Month labels */}
              <div style={{ display: 'flex', marginLeft: 36, marginBottom: 4, position: 'relative', height: 16 }}>
                {heatmapMonthLabels.map(({ wIdx, label }) => (
                  <div
                    key={wIdx + label}
                    style={{
                      position: 'absolute',
                      left: wIdx * 14,
                      fontSize: 10,
                      color: C.gray,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {label}
                  </div>
                ))}
              </div>

              {/* Grid */}
              <div style={{ display: 'flex', gap: 0 }}>
                {/* Day-of-week labels */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginRight: 4, paddingTop: 0 }}>
                  {[0, 1, 2, 3, 4, 5, 6].map(dow => (
                    <div key={dow} style={{ height: 12, fontSize: 9, color: [1, 3, 5].includes(dow) ? C.gray : 'transparent', lineHeight: '12px', textAlign: 'right', width: 28 }}>
                      {DAY_LABELS[dow]}
                    </div>
                  ))}
                </div>

                {/* Week columns */}
                <div style={{ display: 'flex', gap: 2, overflow: 'hidden' }}>
                  {heatmapGrid.map((week, wIdx) => (
                    <div key={wIdx} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {week.map((day, dIdx) => (
                        <div
                          key={day.date}
                          onMouseEnter={() => setHoveredHeatCell({ wIdx, dIdx, label: day.label, count: day.count })}
                          onMouseLeave={() => setHoveredHeatCell(null)}
                          style={{
                            width: 12,
                            height: 12,
                            borderRadius: 2,
                            background: getHeatColor(day.count),
                            cursor: day.count > 0 ? 'default' : 'default',
                            position: 'relative',
                            transition: 'filter 0.1s',
                            filter: hoveredHeatCell?.wIdx === wIdx && hoveredHeatCell?.dIdx === dIdx ? 'brightness(0.88)' : 'none',
                          }}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              {/* Tooltip */}
              {hoveredHeatCell && (
                <div style={{
                  marginTop: 8,
                  fontSize: 12,
                  color: C.gray,
                  height: 18,
                }}>
                  <span style={{ color: C.ink, fontWeight: 500 }}>{hoveredHeatCell.label}</span>
                  {' — '}
                  {hoveredHeatCell.count === 0 ? 'No events' : `${hoveredHeatCell.count} event${hoveredHeatCell.count !== 1 ? 's' : ''}`}
                </div>
              )}
              {!hoveredHeatCell && <div style={{ height: 18, marginTop: 8 }} />}

              {/* Legend */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end', marginTop: 4, fontSize: 11, color: C.gray }}>
                <span>Less</span>
                {HEAT_COLORS.map((c, i) => (
                  <div key={i} style={{ width: 12, height: 12, borderRadius: 2, background: c }} />
                ))}
                <span>More</span>
              </div>
              </>}
            </div>
          );
        })()}
        </UpgradeGate>

        {/* ── Advanced Section B: Year-over-Year Revenue ── */}
        <UpgradeGate minPlan="pro" feature="Year-over-Year Revenue Comparison">
        {(() => {
          const thisYear = new Date().getFullYear();
          const lastYear = thisYear - 1;
          const barAreaH = 160;
          return (
            <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: C.ink }}>📊 Year-over-year comparison</div>
                {yoyPct !== null && (
                  <div style={{
                    fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 999,
                    color: yoyPct >= 0 ? C.green : C.red,
                    background: yoyPct >= 0 ? C.greenBg : '#fff0f0',
                  }}>
                    Revenue: {yoyPct >= 0 ? '+' : ''}{yoyPct}% vs prior year
                  </div>
                )}
              </div>
              <div style={{ fontSize: 12, color: C.gray, marginBottom: 16 }}>
                Monthly revenue — {thisYear} vs {lastYear}
              </div>

              {/* Legend */}
              <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: 12, color: C.gray }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 2, background: C.rosa }} />
                  <span>{thisYear} ({fmt(yoyTotals.thisYear)})</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 2, background: '#E5C9CE' }} />
                  <span>{lastYear} ({fmt(yoyTotals.lastYear)})</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                {/* Y-axis */}
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: 20, paddingTop: 4, minWidth: 44 }}>
                  {[...yoyYTicks].reverse().map((tick, i) => (
                    <div key={i} style={{ fontSize: 10, color: C.gray, whiteSpace: 'nowrap' }}>{fmt(tick)}</div>
                  ))}
                </div>
                {/* Chart area */}
                <div style={{ flex: 1, position: 'relative' }}>
                  {/* Gridlines */}
                  <div style={{ position: 'absolute', inset: 0, bottom: 20, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', pointerEvents: 'none' }}>
                    {yoyYTicks.map((_, i) => (
                      <div key={i} style={{ width: '100%', height: 1, background: C.border, opacity: 0.6 }} />
                    ))}
                  </div>
                  {/* Bars */}
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: barAreaH + 20, position: 'relative' }}>
                    {yoyData.map((m, idx) => {
                      const thisH = Math.max((m.thisYear / yoyMaxBar) * barAreaH, m.thisYear > 0 ? 3 : 0);
                      const lastH = Math.max((m.lastYear / yoyMaxBar) * barAreaH, m.lastYear > 0 ? 3 : 0);
                      const hovThis = hoveredYoy?.monthIdx === idx && hoveredYoy?.which === 'this';
                      const hovLast = hoveredYoy?.monthIdx === idx && hoveredYoy?.which === 'last';
                      return (
                        <div key={m.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end', position: 'relative' }}>
                          {/* Tooltip */}
                          {(hovThis || hovLast) && (
                            <div style={{
                              position: 'absolute',
                              bottom: 28,
                              left: '50%',
                              transform: 'translateX(-50%)',
                              background: C.ink, color: C.white,
                              fontSize: 11, fontWeight: 500,
                              padding: '4px 8px', borderRadius: 6,
                              whiteSpace: 'nowrap', zIndex: 10,
                              pointerEvents: 'none',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                            }}>
                              {hovThis ? `${thisYear}: ${fmt(m.thisYear)}` : `${lastYear}: ${fmt(m.lastYear)}`}
                            </div>
                          )}
                          {/* Two bars side by side */}
                          <div style={{ display: 'flex', gap: 1, alignItems: 'flex-end', width: '100%' }}>
                            <div
                              onMouseEnter={() => setHoveredYoy({ monthIdx: idx, which: 'last' })}
                              onMouseLeave={() => setHoveredYoy(null)}
                              style={{
                                flex: 1, height: `${lastH}px`, minHeight: m.lastYear > 0 ? 3 : 0,
                                background: '#E5C9CE', borderRadius: '3px 3px 1px 1px',
                                transition: 'filter 0.12s',
                                filter: hovLast ? 'brightness(0.88)' : 'none',
                                cursor: m.lastYear > 0 ? 'default' : 'default',
                              }}
                            />
                            <div
                              onMouseEnter={() => setHoveredYoy({ monthIdx: idx, which: 'this' })}
                              onMouseLeave={() => setHoveredYoy(null)}
                              style={{
                                flex: 1, height: `${thisH}px`, minHeight: m.thisYear > 0 ? 3 : 0,
                                background: C.rosa, borderRadius: '3px 3px 1px 1px',
                                transition: 'filter 0.12s',
                                filter: hovThis ? 'brightness(0.88)' : 'none',
                                cursor: m.thisYear > 0 ? 'default' : 'default',
                              }}
                            />
                          </div>
                          <div style={{ fontSize: 9, color: C.gray, textAlign: 'center', whiteSpace: 'nowrap' }}>{m.label}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
        </UpgradeGate>

        {/* ── Advanced Section C: Event Profitability Ranking ── */}
        <UpgradeGate minPlan="pro" feature="Event Profitability Ranking">
        {(() => {
          const top20 = profitRanking.slice(0, 20);
          const podium = profitRanking.slice(0, 3);
          const PODIUM_MEDALS = ['🥇', '🥈', '🥉'];
          const PODIUM_COLORS = ['#F59E0B', '#9CA3AF', '#CD7F32'];
          const marginDot = (margin) => {
            const color = margin >= 60 ? C.green : margin >= 30 ? C.amber : C.red;
            return <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: color, marginRight: 5, verticalAlign: 'middle' }} />;
          };
          return (
            <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: C.ink, marginBottom: 4 }}>🏆 Event profitability ranking</div>
              <div style={{ fontSize: 12, color: C.gray, marginBottom: 16 }}>
                Completed events ranked by net profit (revenue collected minus expenses)
              </div>

              {top20.length === 0 ? (
                <div style={{ color: C.gray, fontSize: 13, textAlign: 'center', padding: '32px 0' }}>
                  No completed events with payment data yet
                </div>
              ) : (
                <>
                  {/* Top 3 podium */}
                  {podium.length > 0 && (
                    <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
                      {podium.map((ev, i) => {
                        const client = ev.client;
                        return (
                          <div
                            key={ev.id}
                            style={{
                              flex: 1, background: i === 0 ? '#FFFBEB' : C.grayBg,
                              border: `1px solid ${i === 0 ? '#F59E0B' : C.border}`,
                              borderRadius: 10, padding: '14px 16px',
                            }}
                          >
                            <div style={{ fontSize: 20, marginBottom: 4 }}>{PODIUM_MEDALS[i]}</div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {client?.name || '—'}
                            </div>
                            <div style={{ fontSize: 11, color: C.gray, marginBottom: 8 }}>
                              {ev.type ? (ev.type.charAt(0).toUpperCase() + ev.type.slice(1)) : ''}
                              {ev.event_date ? ` · ${new Date(ev.event_date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}` : ''}
                            </div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: ev.profit >= 0 ? C.green : C.red, lineHeight: 1 }}>
                              {ev.profit >= 0 ? '' : '-'}{fmt(Math.abs(ev.profit))}
                            </div>
                            <div style={{ fontSize: 11, color: C.gray }}>profit</div>
                            <div style={{ fontSize: 12, color: C.gray, marginTop: 4 }}>
                              {marginDot(ev.margin)}{Math.round(ev.margin)}% margin
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Full table */}
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                          {['#', 'Client', 'Event type', 'Date', 'Revenue', 'Expenses', 'Profit', 'Margin'].map(h => (
                            <th key={h} style={{ textAlign: 'left', padding: '6px 10px', color: C.gray, fontWeight: 500, fontSize: 11, whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {top20.map((ev, i) => {
                          const client = ev.client;
                          const isNeg = ev.profit < 0;
                          return (
                            <tr key={ev.id} style={{ borderBottom: i < top20.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                              <td style={{ padding: '9px 10px', color: C.gray, fontWeight: i < 3 ? 700 : 400 }}>{i + 1}</td>
                              <td style={{ padding: '9px 10px', color: C.ink, fontWeight: 500, whiteSpace: 'nowrap' }}>
                                {client?.name || '—'}
                              </td>
                              <td style={{ padding: '9px 10px', color: C.gray, whiteSpace: 'nowrap' }}>
                                {ev.type ? (ev.type.charAt(0).toUpperCase() + ev.type.slice(1)) : '—'}
                              </td>
                              <td style={{ padding: '9px 10px', color: C.gray, whiteSpace: 'nowrap' }}>
                                {ev.event_date ? new Date(ev.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : '—'}
                              </td>
                              <td style={{ padding: '9px 10px', color: C.ink }}>{fmt(ev.revenue)}</td>
                              <td style={{ padding: '9px 10px', color: ev.expenses > 0 ? C.red : C.gray }}>
                                {ev.expenses > 0 ? fmt(ev.expenses) : '—'}
                              </td>
                              <td style={{ padding: '9px 10px', fontWeight: 600, color: isNeg ? C.red : C.green }}>
                                {isNeg ? '-' : ''}{fmt(Math.abs(ev.profit))}
                              </td>
                              <td style={{ padding: '9px 10px', whiteSpace: 'nowrap' }}>
                                {marginDot(ev.margin)}
                                <span style={{ fontWeight: 500, color: ev.margin >= 60 ? C.green : ev.margin >= 30 ? C.amber : C.red }}>
                                  {Math.round(ev.margin)}%
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      {profitRankingAvg && (
                        <tfoot>
                          <tr style={{ borderTop: `2px solid ${C.border}`, background: C.grayBg }}>
                            <td colSpan={4} style={{ padding: '9px 10px', fontWeight: 600, color: C.gray, fontSize: 11 }}>Averages ({top20.length} events)</td>
                            <td style={{ padding: '9px 10px', color: C.ink, fontWeight: 600 }}>{fmt(Math.round(profitRankingAvg.revenue))}</td>
                            <td style={{ padding: '9px 10px', color: profitRankingAvg.expenses > 0 ? C.red : C.gray, fontWeight: 600 }}>
                              {profitRankingAvg.expenses > 0 ? fmt(Math.round(profitRankingAvg.expenses)) : '—'}
                            </td>
                            <td style={{ padding: '9px 10px', fontWeight: 700, color: profitRankingAvg.profit >= 0 ? C.green : C.red }}>
                              {profitRankingAvg.profit >= 0 ? '' : '-'}{fmt(Math.abs(Math.round(profitRankingAvg.profit)))}
                            </td>
                            <td style={{ padding: '9px 10px' }}>
                              {marginDot(profitRankingAvg.margin)}
                              <span style={{ fontWeight: 600, color: profitRankingAvg.margin >= 60 ? C.green : profitRankingAvg.margin >= 30 ? C.amber : C.red }}>
                                {Math.round(profitRankingAvg.margin)}%
                              </span>
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </>
              )}
            </div>
          );
        })()}
        </UpgradeGate>

        {/* ── Feature 1: Inventory ROI ── */}
        <UpgradeGate minPlan="pro" feature="Inventory ROI">
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.ink, marginBottom: 4 }}>📦 Inventory ROI</div>
            <div style={{ fontSize: 12, color: C.gray, marginBottom: 16 }}>Return on investment for bridal and quinceañera gowns, sorted by ROI.</div>
            {roiLoading ? (
              <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 13, color: C.gray }}>Loading inventory data…</div>
            ) : roiData.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 13, color: C.gray }}>No bridal or quinceañera gowns found in inventory.</div>
            ) : (
              <>
                <div style={{ overflowX: 'auto', marginBottom: 20 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                        {['Dress name', 'SKU', 'Price', 'Rentals', 'Revenue Generated', 'ROI %', 'Util./mo'].map(h => (
                          <th key={h} style={{ textAlign: 'left', padding: '6px 10px', color: C.gray, fontWeight: 500, fontSize: 11, whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {roiData.map(({ item, rentalCount, totalRevenue, roi, utilizationRate, isDeadstock }) => {
                        const roiColor = roi >= 100 ? C.green : roi >= 50 ? C.amber : C.red;
                        return (
                          <tr key={item.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                            <td style={{ padding: '9px 10px', color: C.ink, fontWeight: 500, whiteSpace: 'nowrap' }}>
                              {isDeadstock && <span style={{ marginRight: 5, fontSize: 10, color: C.amber }}>⚠</span>}
                              {item.name}
                            </td>
                            <td style={{ padding: '9px 10px', color: C.gray, fontFamily: 'monospace', fontSize: 11 }}>{item.sku || '—'}</td>
                            <td style={{ padding: '9px 10px', color: C.ink }}>{fmt(item.price)}</td>
                            <td style={{ padding: '9px 10px', color: C.ink }}>{rentalCount}</td>
                            <td style={{ padding: '9px 10px', color: C.ink, fontWeight: totalRevenue > 0 ? 500 : 400 }}>
                              {totalRevenue > 0 ? fmt(Math.round(totalRevenue)) : '—'}
                            </td>
                            <td style={{ padding: '9px 10px' }}>
                              <span style={{ fontWeight: 700, color: roiColor }}>{Math.round(roi)}%</span>
                            </td>
                            <td style={{ padding: '9px 10px', color: C.gray }}>{utilizationRate.toFixed(2)}/mo</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Deadstock alert */}
                {roiData.filter(r => r.isDeadstock).length > 0 && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.amber, marginBottom: 8 }}>⚠ Deadstock Alert — no rentals in last 6 months</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {roiData.filter(r => r.isDeadstock).map(({ item }) => (
                        <div key={item.id} style={{ background: C.amberBg, border: `1px solid ${C.amber}20`, borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
                          <span style={{ fontWeight: 500, color: C.ink }}>{item.name}</span>
                          {item.sku && <span style={{ color: C.gray, marginLeft: 6 }}>#{item.sku}</span>}
                          <span style={{ color: C.amber, marginLeft: 6 }}>{fmt(item.price)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </UpgradeGate>

        {/* ── Feature 2: Commission Calculator ── */}
        <UpgradeGate minPlan="pro" feature="Commission Calculator">
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
            {/* Header row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: C.ink }}>💰 Commission Calculator</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Period selector */}
                <div style={{ display: 'flex', border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
                  {[['thisMonth', 'This Month'], ['lastMonth', 'Last Month'], ['thisQuarter', 'This Quarter'], ['custom', 'Custom']].map(([v, l]) => (
                    <button key={v} onClick={() => setCommPeriod(v)}
                      style={{ padding: '5px 10px', border: 'none', fontSize: 11, cursor: 'pointer', fontWeight: commPeriod === v ? 600 : 400,
                        background: commPeriod === v ? C.ink : C.white, color: commPeriod === v ? C.white : C.gray }}>
                      {l}
                    </button>
                  ))}
                </div>
                <button
                  onClick={exportCommCSV}
                  style={{ padding: '5px 12px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.grayBg, color: C.ink, fontSize: 11, fontWeight: 500, cursor: 'pointer' }}>
                  Export CSV
                </button>
              </div>
            </div>
            {commPeriod === 'custom' && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, fontSize: 12 }}>
                <label style={{ color: C.gray }}>From</label>
                <input type="date" value={commCustomStart} onChange={e => setCommCustomStart(e.target.value)}
                  style={{ padding: '4px 8px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12 }} />
                <label style={{ color: C.gray }}>To</label>
                <input type="date" value={commCustomEnd} onChange={e => setCommCustomEnd(e.target.value)}
                  style={{ padding: '4px 8px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12 }} />
              </div>
            )}
            <div style={{ fontSize: 12, color: C.gray, marginBottom: 16 }}>
              Commissions based on paid milestones. Default rate is 10% unless configured on staff member.
            </div>

            {commLoading ? (
              <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 13, color: C.gray }}>Loading commission data…</div>
            ) : filteredCommStaff.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 13, color: C.gray }}>
                No commission data for this period. Assign a coordinator to events to track commissions.
              </div>
            ) : (
              <>
                {/* Per-staff cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  {filteredCommStaff.map(staff => {
                    const isExpanded = commExpanded[staff.staffId];
                    return (
                      <div key={staff.staffId} style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
                        {/* Card header */}
                        <div
                          onClick={() => setCommExpanded(p => ({ ...p, [staff.staffId]: !p[staff.staffId] }))}
                          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer', background: C.grayBg }}
                        >
                          <div style={{ width: 32, height: 32, borderRadius: '50%', background: staff.staffColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                            {staff.staffInitials}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{staff.staffName}</div>
                            <div style={{ fontSize: 11, color: C.gray }}>{staff.events.length} event{staff.events.length !== 1 ? 's' : ''} · {staff.commissionRate}% rate</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 11, color: C.gray }}>Revenue</div>
                            <div style={{ fontSize: 13, fontWeight: 500, color: C.ink }}>{fmt(Math.round(staff.totalRevenue))}</div>
                          </div>
                          <div style={{ textAlign: 'right', minWidth: 90 }}>
                            <div style={{ fontSize: 11, color: C.gray }}>Commission</div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: C.green }}>{fmt(Math.round(staff.totalCommission))}</div>
                          </div>
                          <div style={{ fontSize: 16, color: C.gray, marginLeft: 4 }}>{isExpanded ? '▲' : '▼'}</div>
                        </div>
                        {/* Expandable event breakdown */}
                        {isExpanded && (
                          <div style={{ overflowX: 'auto', padding: '0 0 4px' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                              <thead>
                                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                                  {['Event', 'Date', 'Revenue', 'Rate', 'Commission'].map(h => (
                                    <th key={h} style={{ textAlign: 'left', padding: '6px 16px', color: C.gray, fontWeight: 500, fontSize: 11 }}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {staff.events.map(ev => (
                                  <tr key={ev.eventId} style={{ borderBottom: `1px solid ${C.border}` }}>
                                    <td style={{ padding: '8px 16px', color: C.ink }}>{ev.eventName}</td>
                                    <td style={{ padding: '8px 16px', color: C.gray, whiteSpace: 'nowrap' }}>
                                      {ev.eventDate ? new Date(ev.eventDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : '—'}
                                    </td>
                                    <td style={{ padding: '8px 16px', color: C.ink }}>{fmt(Math.round(ev.revenue))}</td>
                                    <td style={{ padding: '8px 16px', color: C.gray }}>{ev.commissionRate}%</td>
                                    <td style={{ padding: '8px 16px', fontWeight: 600, color: C.green }}>{fmt(Math.round(ev.commissionAmount))}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Total payout row */}
                {filteredCommStaff.length > 1 && (
                  <div style={{ background: C.grayBg, borderRadius: 8, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>Total Payout</span>
                    <span style={{ fontSize: 18, fontWeight: 700, color: C.green }}>
                      {fmt(Math.round(filteredCommStaff.reduce((s, st) => s + st.totalCommission, 0)))}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </UpgradeGate>

        {/* ── Feature 3: Client Lifetime Value ── */}
        <UpgradeGate minPlan="pro" feature="Client Lifetime Value">
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.ink, marginBottom: 4 }}>👑 Client Lifetime Value</div>
            <div style={{ fontSize: 12, color: C.gray, marginBottom: 16 }}>Total spend, engagement, and predicted future bookings per client.</div>
            {ltvLoading ? (
              <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 13, color: C.gray }}>Loading client data…</div>
            ) : ltvClients.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 13, color: C.gray }}>No client data with paid events found.</div>
            ) : (
              <>
                {/* Top 5 podium */}
                {ltvClients.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.gray, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Top Clients</div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      {ltvClients.slice(0, 5).map((cl, i) => {
                        const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
                        const ltvLabel = cl.ltv >= 5000 ? { emoji: '🏆', color: '#B45309', label: 'Gold' }
                          : cl.ltv >= 2000 ? { emoji: '🥈', color: C.gray, label: 'Silver' }
                          : { emoji: '🥉', color: '#A16207', label: 'Bronze' };
                        return (
                          <div key={cl.id} style={{
                            flex: '1 1 140px', maxWidth: 180, border: `1px solid ${i === 0 ? '#F59E0B' : C.border}`,
                            borderRadius: 10, padding: '14px 16px', background: i === 0 ? '#FFFBEB' : C.white,
                          }}>
                            <div style={{ fontSize: 20, marginBottom: 4 }}>{medals[i]}</div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cl.name}</div>
                            <div style={{ fontSize: 11, color: C.gray, marginBottom: 6 }}>{cl.eventCount} event{cl.eventCount !== 1 ? 's' : ''}</div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: C.ink, lineHeight: 1 }}>{fmt(cl.totalSpend)}</div>
                            <div style={{ fontSize: 10, color: ltvLabel.color, fontWeight: 600, marginTop: 3 }}>{ltvLabel.emoji} {ltvLabel.label}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Full table */}
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                        {['Client', 'Events', 'Total Spent', 'Avg per Event', 'LTV Score', 'Last Event', 'Predicted Next'].map(h => (
                          <th key={h} style={{ textAlign: 'left', padding: '6px 10px', color: C.gray, fontWeight: 500, fontSize: 11, whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ltvClients.map((cl, i) => {
                        const ltvConf = cl.ltv >= 5000
                          ? { emoji: '🏆', color: '#B45309' }
                          : cl.ltv >= 2000
                          ? { emoji: '🥈', color: C.gray }
                          : { emoji: '🥉', color: '#A16207' };
                        return (
                          <tr key={cl.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                            <td style={{ padding: '9px 10px', fontWeight: 500, color: C.ink, whiteSpace: 'nowrap' }}>{cl.name}</td>
                            <td style={{ padding: '9px 10px', color: C.ink }}>{cl.eventCount}</td>
                            <td style={{ padding: '9px 10px', fontWeight: 600, color: C.ink }}>{fmt(cl.totalSpend)}</td>
                            <td style={{ padding: '9px 10px', color: C.gray }}>{fmt(Math.round(cl.avgEventValue))}</td>
                            <td style={{ padding: '9px 10px' }}>
                              <span style={{ fontWeight: 700, color: ltvConf.color }}>{ltvConf.emoji} {fmt(cl.ltv)}</span>
                            </td>
                            <td style={{ padding: '9px 10px', color: C.gray, whiteSpace: 'nowrap' }}>
                              {cl.lastEventDate ? new Date(cl.lastEventDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : '—'}
                            </td>
                            <td style={{ padding: '9px 10px', color: C.gray, whiteSpace: 'nowrap' }}>
                              {cl.predictedNext ? new Date(cl.predictedNext).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </UpgradeGate>

        {/* ── Feature 4: Tax Report ── */}
        <UpgradeGate minPlan="pro" feature="Tax Reporting">
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: C.ink }}>🧾 Tax Report</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Quarter selector */}
                <div style={{ display: 'flex', border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
                  {['Q1', 'Q2', 'Q3', 'Q4'].map(q => (
                    <button key={q} onClick={() => setTaxQuarter(q)}
                      style={{ padding: '5px 10px', border: 'none', fontSize: 11, cursor: 'pointer', fontWeight: taxQuarter === q ? 600 : 400,
                        background: taxQuarter === q ? C.ink : C.white, color: taxQuarter === q ? C.white : C.gray }}>
                      {q}
                    </button>
                  ))}
                </div>
                {/* Year selector */}
                <select
                  value={taxYear}
                  onChange={e => setTaxYear(Number(e.target.value))}
                  style={{ padding: '5px 8px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 11, background: C.white, color: C.ink, cursor: 'pointer' }}>
                  {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                <button
                  onClick={exportTaxCSV}
                  style={{ padding: '5px 12px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.grayBg, color: C.ink, fontSize: 11, fontWeight: 500, cursor: 'pointer' }}>
                  Export for Accountant
                </button>
              </div>
            </div>
            <div style={{ fontSize: 12, color: C.gray, marginBottom: 16 }}>
              Based on paid payment milestones for {taxQuarter} {taxYear}.
            </div>

            {taxLoading ? (
              <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 13, color: C.gray }}>Loading tax data…</div>
            ) : (
              <>
                {/* Summary cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
                  {[
                    { label: 'Gross Revenue', value: fmt(taxGrossRevenue), color: C.ink },
                    { label: 'Taxable Revenue', value: fmt(taxGrossRevenue), color: C.ink },
                    { label: 'Tax Rate', value: (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={0.1}
                          value={taxRate}
                          onChange={e => setTaxRate(Number(e.target.value))}
                          style={{ width: 52, fontSize: 18, fontWeight: 600, border: 'none', borderBottom: `1px solid ${C.border}`, background: 'transparent', color: C.amber, padding: '0 2px', textAlign: 'center' }}
                        />
                        <span style={{ fontSize: 18, fontWeight: 600, color: C.amber }}>%</span>
                      </div>
                    ), color: C.amber },
                    { label: 'Estimated Tax Owed', value: fmt(Math.round(taxEstimated)), color: C.red },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ background: C.grayBg, borderRadius: 10, padding: '14px 16px' }}>
                      <div style={{ fontSize: 11, color: C.gray, marginBottom: 4 }}>{label}</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
                    </div>
                  ))}
                </div>

                {/* Monthly breakdown table */}
                {taxBreakdown.length > 0 && (
                  <div style={{ overflowX: 'auto', marginBottom: 16 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                          {['Month', 'Revenue', 'Est. Tax', 'Running Total'].map(h => (
                            <th key={h} style={{ textAlign: 'left', padding: '6px 10px', color: C.gray, fontWeight: 500, fontSize: 11 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {taxBreakdown.map(row => (
                          <tr key={row.label} style={{ borderBottom: `1px solid ${C.border}` }}>
                            <td style={{ padding: '9px 10px', fontWeight: 500, color: C.ink }}>{row.label}</td>
                            <td style={{ padding: '9px 10px', color: C.ink }}>{row.revenue > 0 ? fmt(Math.round(row.revenue)) : '—'}</td>
                            <td style={{ padding: '9px 10px', color: C.red }}>
                              {row.revenue > 0 ? fmt(Math.round(row.revenue * taxRate / 100)) : '—'}
                            </td>
                            <td style={{ padding: '9px 10px', fontWeight: 600, color: C.ink }}>{fmt(Math.round(row.running))}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ borderTop: `2px solid ${C.border}`, background: C.grayBg }}>
                          <td style={{ padding: '9px 10px', fontWeight: 700, color: C.ink }}>Total</td>
                          <td style={{ padding: '9px 10px', fontWeight: 700, color: C.ink }}>{fmt(taxGrossRevenue)}</td>
                          <td style={{ padding: '9px 10px', fontWeight: 700, color: C.red }}>{fmt(Math.round(taxEstimated))}</td>
                          <td style={{ padding: '9px 10px', fontWeight: 700, color: C.ink }}>{fmt(taxGrossRevenue)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}

                {taxMilestones.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '16px 0', fontSize: 13, color: C.gray }}>
                    No paid milestones found for {taxQuarter} {taxYear}.
                  </div>
                )}

                <div style={{ fontSize: 11, color: C.gray, fontStyle: 'italic', marginTop: 4 }}>
                  This is an estimate only. Consult a tax professional.
                </div>
              </>
            )}
          </div>
        </UpgradeGate>

        {/* ── Revenue by service line ───────────────────────────────────── */}
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, marginTop: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, marginBottom: 16 }}>Revenue by service</div>
          {paidMilestones.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 13, color: C.gray }}>No paid milestones yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {revenueByService.map(row => {
                const SVC_BAR_COLORS = {
                  'Dress Rental': C.rosa,
                  'Alterations':  C.blue || '#3B82F6',
                  'Decoration':   C.green || '#22C55E',
                  'Other':        C.gray,
                };
                const barColor = SVC_BAR_COLORS[row.name] || C.gray;
                return (
                  <div key={row.name}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: C.ink }}>{row.name}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 12, color: C.gray }}>{row.count} milestone{row.count !== 1 ? 's' : ''}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{fmt(Math.round(row.total))}</span>
                        <span style={{ fontSize: 12, fontWeight: 500, color: barColor, minWidth: 32, textAlign: 'right' }}>{row.pct}%</span>
                      </div>
                    </div>
                    <div style={{ height: 8, borderRadius: 4, background: C.border, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${row.pct}%`, background: barColor, borderRadius: 4, transition: 'width 0.4s ease' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
