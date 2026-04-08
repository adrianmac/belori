import React, { useState, useEffect, useMemo } from 'react';
import { C, fmt, EVT_TYPES } from '../lib/colors';
import { Card, CardHead, Topbar, GhostBtn } from '../lib/ui.jsx';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function isoDate(d) {
  return d.toISOString().split('T')[0];
}

function daysBetween(a, b) {
  if (!a || !b) return null;
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}

const RANGE_OPTIONS = [
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
  { label: 'Last 6 months', days: 180 },
  { label: 'All time', days: null },
];

const SOURCE_LABELS = {
  website: 'Website',
  instagram: 'Instagram',
  referral: 'Referral',
  walk_in: 'Walk-in',
  other: 'Other',
};

const STAGE_ORDER = ['lead', 'contacted', 'proposal', 'booked', 'completed'];

// Which stages count as "at least" a given stage
const STAGE_AT_LEAST = {
  lead:      ['lead', 'contacted', 'proposal', 'booked', 'converted', 'completed'],
  contacted: ['contacted', 'proposal', 'booked', 'converted', 'completed'],
  proposal:  ['proposal', 'booked', 'converted', 'completed'],
  booked:    ['booked', 'converted', 'completed'],
  completed: ['completed'],
};

const DROP_OFF_SUGGESTIONS = {
  lead:      'Follow up within 24 hours of new inquiries to improve first-contact rate.',
  contacted: 'Send a personalized proposal template within 48 hours of initial contact.',
  proposal:  'Schedule an in-boutique consultation after sending proposals to increase booking rate.',
  booked:    'Ensure smooth event onboarding with an automated welcome sequence.',
};

// ─── FUNNEL STAGE ROW ────────────────────────────────────────────────────────
const FunnelStageRow = ({ stage, count, total, prevCount, avgDays, icon, label }) => {
  const pctOfFirst = total > 0 ? Math.round((count / total) * 100) : 0;
  const convRate = prevCount != null && prevCount > 0 ? Math.round((count / prevCount) * 100) : null;
  const stageIdx = STAGE_ORDER.indexOf(stage);
  // Funnel shape: each bar is narrower than the previous
  const widthPct = 100 - stageIdx * 12;
  const isFirst = stageIdx === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
      {/* Connector + conversion rate */}
      {stageIdx > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ width: 2, height: 10, background: C.border }} />
          <div style={{
            width: 0, height: 0,
            borderLeft: '6px solid transparent',
            borderRight: '6px solid transparent',
            borderTop: `7px solid ${C.border}`,
          }} />
          {convRate !== null && (
            <div style={{ fontSize: 10, color: C.gray, marginTop: 2, marginBottom: 2 }}>
              {convRate}% converted
            </div>
          )}
        </div>
      )}
      {/* Stage bar */}
      <div style={{
        width: `${widthPct}%`,
        background: isFirst
          ? `linear-gradient(135deg, ${C.rosa}, ${C.rosaHov})`
          : `linear-gradient(135deg, hsl(${348 - stageIdx * 8}, ${50 + stageIdx * 4}%, ${78 - stageIdx * 7}%), hsl(${348 - stageIdx * 8}, ${48 + stageIdx * 4}%, ${72 - stageIdx * 7}%))`,
        borderRadius: 10,
        padding: '12px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        transition: 'width 0.4s ease',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>{icon}</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: isFirst ? C.white : C.ink }}>{label}</div>
            {avgDays != null && (
              <div style={{ fontSize: 10, color: isFirst ? 'rgba(255,255,255,0.75)' : C.gray, marginTop: 1 }}>
                Avg {avgDays}d to book
              </div>
            )}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: isFirst ? C.white : C.ink, lineHeight: 1 }}>{count}</div>
          <div style={{ fontSize: 10, color: isFirst ? 'rgba(255,255,255,0.75)' : C.gray, marginTop: 1 }}>{pctOfFirst}% of total</div>
        </div>
      </div>
    </div>
  );
};

// ─── MINI HORIZONTAL BAR ─────────────────────────────────────────────────────
const HBar = ({ label, value, max, color }) => {
  const pct = max > 0 ? Math.max((value / max) * 100, value > 0 ? 2 : 0) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0' }}>
      <div style={{ width: 110, fontSize: 12, color: C.ink, fontWeight: 500, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
      <div style={{ flex: 1, height: 10, background: C.border, borderRadius: 5, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color || C.rosa, borderRadius: 5, transition: 'width 0.4s ease' }} />
      </div>
      <div style={{ width: 32, textAlign: 'right', fontSize: 12, color: C.gray, flexShrink: 0 }}>{value}</div>
    </div>
  );
};

// ─── MAIN PAGE ───────────────────────────────────────────────────────────────
export default function FunnelPage({ setScreen }) {
  const { boutique } = useAuth();
  const [rangeIdx, setRangeIdx] = useState(1); // default: Last 90 days
  const [leads, setLeads] = useState([]);
  const [completedEvents, setCompletedEvents] = useState(0);
  const [loading, setLoading] = useState(true);

  const range = RANGE_OPTIONS[rangeIdx];

  const cutoffDate = useMemo(() => {
    if (!range.days) return null;
    return isoDate(addDays(new Date(), -range.days));
  }, [range.days]);

  // ── Fetch data ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!boutique?.id) return;
    setLoading(true);

    const leadsQ = supabase
      .from('pipeline_leads')
      .select('id, stage, source, event_type, estimated_value, created_at, converted_at, lost_reason')
      .eq('boutique_id', boutique.id);
    if (cutoffDate) leadsQ.gte('created_at', cutoffDate);

    const eventsQ = supabase
      .from('events')
      .select('id, status, created_at')
      .eq('boutique_id', boutique.id)
      .eq('status', 'completed');
    if (cutoffDate) eventsQ.gte('created_at', cutoffDate);

    Promise.all([leadsQ, eventsQ]).then(([{ data: leadsData }, { data: eventsData }]) => {
      setLeads(leadsData || []);
      setCompletedEvents((eventsData || []).length);
      setLoading(false);
    });
  }, [boutique?.id, cutoffDate]);

  // ── Derived metrics ───────────────────────────────────────────────────────
  const totalLeads = leads.length;

  const stageCount = useMemo(() => {
    const counts = {};
    STAGE_ORDER.forEach(s => {
      counts[s] = leads.filter(l => STAGE_AT_LEAST[s]?.includes(l.stage)).length;
    });
    counts.completed = completedEvents;
    return counts;
  }, [leads, completedEvents]);

  const avgDaysToBooked = useMemo(() => {
    const booked = leads.filter(l =>
      (l.stage === 'booked' || l.stage === 'converted') && l.created_at && l.converted_at
    );
    if (!booked.length) return null;
    const sum = booked.reduce((s, l) => s + (daysBetween(l.created_at, l.converted_at) || 0), 0);
    return Math.round(sum / booked.length);
  }, [leads]);

  const overallConvRate = totalLeads > 0
    ? Math.round((stageCount.booked / totalLeads) * 100)
    : 0;

  const pipelineValue = leads
    .filter(l => !['booked', 'lost', 'converted'].includes(l.stage))
    .reduce((s, l) => s + Number(l.estimated_value || 0), 0);

  const lostLeads = leads.filter(l => l.stage === 'lost');
  const lostReasonCounts = lostLeads.reduce((acc, l) => {
    const r = l.lost_reason || 'Unknown';
    acc[r] = (acc[r] || 0) + 1;
    return acc;
  }, {});
  const topLostReason = Object.entries(lostReasonCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  const dropOffStage = useMemo(() => {
    let maxDrop = 0;
    let maxStage = null;
    for (let i = 1; i < STAGE_ORDER.length; i++) {
      const prev = stageCount[STAGE_ORDER[i - 1]] || 0;
      const curr = stageCount[STAGE_ORDER[i]] || 0;
      if (prev === 0) continue;
      const drop = prev - curr;
      if (drop > maxDrop) { maxDrop = drop; maxStage = STAGE_ORDER[i - 1]; }
    }
    return maxStage;
  }, [stageCount]);

  const dropOffConvRate = dropOffStage != null
    ? ((stageCount[STAGE_ORDER[STAGE_ORDER.indexOf(dropOffStage) + 1]] || 0) /
       Math.max(stageCount[dropOffStage] || 1, 1)) * 100
    : null;

  const sourceStats = useMemo(() => {
    const sources = {};
    leads.forEach(l => {
      const src = l.source || 'other';
      if (!sources[src]) sources[src] = { leads: 0, booked: 0, totalValue: 0 };
      sources[src].leads++;
      if (['booked', 'converted'].includes(l.stage)) sources[src].booked++;
      sources[src].totalValue += Number(l.estimated_value || 0);
    });
    return Object.entries(sources).map(([src, s]) => ({
      source: src,
      label: SOURCE_LABELS[src] || (src.charAt(0).toUpperCase() + src.slice(1)),
      leads: s.leads,
      booked: s.booked,
      rate: s.leads > 0 ? Math.round((s.booked / s.leads) * 100) : 0,
      avgValue: s.leads > 0 ? Math.round(s.totalValue / s.leads) : 0,
    })).sort((a, b) => b.leads - a.leads);
  }, [leads]);

  const typeStats = useMemo(() => {
    const types = {};
    leads.forEach(l => {
      const t = l.event_type || 'other';
      types[t] = (types[t] || 0) + 1;
    });
    return Object.entries(types).map(([type, count]) => ({
      type,
      label: EVT_TYPES[type]?.label || (type.charAt(0).toUpperCase() + type.slice(1)),
      icon: EVT_TYPES[type]?.icon || '•',
      count,
    })).sort((a, b) => b.count - a.count);
  }, [leads]);

  const maxTypeCount = Math.max(...typeStats.map(t => t.count), 1);

  const funnelStages = [
    { stage: 'lead',      icon: '🔍', label: 'Leads' },
    { stage: 'contacted', icon: '📞', label: 'Contacted' },
    { stage: 'proposal',  icon: '📄', label: 'Proposal Sent' },
    { stage: 'booked',    icon: '📅', label: 'Booked' },
    { stage: 'completed', icon: '✅', label: 'Completed' },
  ];

  const SUMMARY = [
    {
      label: 'Overall Conversion',
      val: `${overallConvRate}%`,
      sub: 'Leads → Booked',
      icon: '📈',
      bg: C.greenBg,
    },
    {
      label: 'Avg Days to Book',
      val: avgDaysToBooked != null ? `${avgDaysToBooked}d` : '—',
      sub: 'Lead to booked event',
      icon: '⏱️',
      bg: C.blueBg,
    },
    {
      label: 'Pipeline Value',
      val: fmt(pipelineValue),
      sub: 'Open leads (estimated)',
      icon: '💰',
      bg: C.rosaPale,
    },
    {
      label: 'Lost Leads',
      val: `${lostLeads.length}`,
      sub: topLostReason ? `Top reason: ${topLostReason}` : 'No lost reason data',
      icon: '🚫',
      bg: C.redBg,
    },
  ];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Topbar
        title="Sales Funnel"
        subtitle="Track leads through the booking pipeline"
        actions={
          setScreen
            ? <GhostBtn label="← Dashboard" onClick={() => setScreen('dashboard')} />
            : null
        }
      />

      <div className="page-scroll" style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Date range filter */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {RANGE_OPTIONS.map((opt, i) => (
            <button
              key={i}
              onClick={() => setRangeIdx(i)}
              style={{
                padding: '7px 14px',
                borderRadius: 8,
                border: `1px solid ${rangeIdx === i ? C.rosa : C.border}`,
                background: rangeIdx === i ? C.rosaPale : C.white,
                color: rangeIdx === i ? C.rosaHov : C.gray,
                fontSize: 12,
                fontWeight: rangeIdx === i ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 0.15s',
                minHeight: 'unset',
                minWidth: 'unset',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: C.gray, fontSize: 13 }}>Loading funnel data…</div>
        ) : (
          <>
            {/* Summary stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              {SUMMARY.map((s, i) => (
                <div key={i} style={{ background: s.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                    <span style={{ fontSize: 16 }}>{s.icon}</span>
                    <span style={{ fontSize: 11, color: C.gray }}>{s.label}</span>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: C.ink, lineHeight: 1 }}>{s.val}</div>
                  <div style={{ fontSize: 11, color: C.gray, marginTop: 4 }}>{s.sub}</div>
                </div>
              ))}
            </div>

            {/* Main content grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, alignItems: 'start' }}>

              {/* Left: Funnel + drop-off insight */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Card>
                  <div style={{ padding: '14px 16px 6px', borderBottom: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>Conversion Funnel</div>
                    <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>
                      {totalLeads > 0 ? `${totalLeads} total lead${totalLeads !== 1 ? 's' : ''} in period` : 'No leads in this period'}
                    </div>
                  </div>
                  <div style={{ padding: '16px 20px 20px', display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {totalLeads === 0 ? (
                      <div style={{ textAlign: 'center', padding: '24px 0', color: C.gray, fontSize: 13 }}>
                        No pipeline leads found for this period.<br />
                        <span style={{ fontSize: 11 }}>Add leads via the Clients → Pipeline tab.</span>
                      </div>
                    ) : funnelStages.map((fs, i) => (
                      <FunnelStageRow
                        key={fs.stage}
                        stage={fs.stage}
                        icon={fs.icon}
                        label={fs.label}
                        count={stageCount[fs.stage] || 0}
                        total={totalLeads}
                        prevCount={i > 0 ? (stageCount[funnelStages[i - 1].stage] || 0) : null}
                        avgDays={fs.stage === 'booked' ? avgDaysToBooked : null}
                      />
                    ))}
                  </div>
                </Card>

                {/* Drop-off insight card */}
                {dropOffStage && dropOffConvRate !== null && totalLeads > 0 && (
                  <div style={{
                    background: C.amberBg,
                    border: '1px solid #FDE68A',
                    borderRadius: 12,
                    padding: '14px 16px',
                    display: 'flex',
                    gap: 12,
                    alignItems: 'flex-start',
                  }}>
                    <span style={{ fontSize: 20, flexShrink: 0 }}>⚠️</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.amber }}>
                        Most leads drop off at the{' '}
                        <span style={{ textTransform: 'capitalize' }}>{dropOffStage}</span> stage
                        ({Math.round(dropOffConvRate)}% conversion to next stage)
                      </div>
                      <div style={{ fontSize: 12, color: '#92400E', marginTop: 4 }}>
                        Consider: {DROP_OFF_SUGGESTIONS[dropOffStage] || 'Review your process for this stage.'}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Right: Source breakdown + event type + lost reasons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                {/* Source breakdown table */}
                <Card>
                  <div style={{ padding: '14px 16px 6px', borderBottom: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>Lead Sources</div>
                  </div>
                  <div style={{ padding: '0 0 4px' }}>
                    {/* Header */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 40px 46px 38px 56px', gap: 4, padding: '7px 14px', borderBottom: `1px solid ${C.border}` }}>
                      {['Source', 'Leads', 'Booked', 'Rate', 'Avg $'].map((h, i) => (
                        <div key={i} style={{ fontSize: 10, fontWeight: 600, color: C.gray, textAlign: i > 0 ? 'right' : 'left' }}>{h}</div>
                      ))}
                    </div>
                    {sourceStats.length === 0 ? (
                      <div style={{ padding: '16px', textAlign: 'center', fontSize: 12, color: C.gray }}>No source data available</div>
                    ) : sourceStats.map((s, i) => (
                      <div key={i} style={{
                        display: 'grid', gridTemplateColumns: '1fr 40px 46px 38px 56px', gap: 4,
                        padding: '9px 14px',
                        borderBottom: i < sourceStats.length - 1 ? `1px solid ${C.border}` : 'none',
                        background: i % 2 === 0 ? C.white : C.grayBg,
                      }}>
                        <div style={{ fontSize: 12, fontWeight: 500, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</div>
                        <div style={{ fontSize: 12, color: C.ink, textAlign: 'right' }}>{s.leads}</div>
                        <div style={{ fontSize: 12, color: C.ink, textAlign: 'right' }}>{s.booked}</div>
                        <div style={{
                          fontSize: 12, fontWeight: 500, textAlign: 'right',
                          color: s.rate >= 50 ? C.green : s.rate >= 25 ? C.amber : C.gray,
                        }}>{s.rate}%</div>
                        <div style={{ fontSize: 12, color: C.gray, textAlign: 'right' }}>
                          {s.avgValue > 0 ? fmt(s.avgValue) : '—'}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Event type breakdown */}
                {typeStats.length > 0 && (
                  <Card>
                    <div style={{ padding: '14px 16px 8px', borderBottom: `1px solid ${C.border}` }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>By Event Type</div>
                    </div>
                    <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {typeStats.map((t, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 14, flexShrink: 0, width: 20, textAlign: 'center' }}>{t.icon}</span>
                          <HBar
                            label={t.label}
                            value={t.count}
                            max={maxTypeCount}
                            color={i === 0 ? C.rosa : i === 1 ? C.rosaLight : C.border}
                          />
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {/* Lost reasons */}
                {lostLeads.length > 0 && (
                  <Card>
                    <div style={{ padding: '14px 16px 8px', borderBottom: `1px solid ${C.border}` }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>Lost Reasons</div>
                      <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>{lostLeads.length} lost lead{lostLeads.length !== 1 ? 's' : ''}</div>
                    </div>
                    <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {Object.entries(lostReasonCounts)
                        .sort((a, b) => b[1] - a[1])
                        .map(([reason, count], i) => (
                          <HBar
                            key={i}
                            label={reason}
                            value={count}
                            max={Math.max(...Object.values(lostReasonCounts))}
                            color={C.red}
                          />
                        ))}
                    </div>
                  </Card>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
