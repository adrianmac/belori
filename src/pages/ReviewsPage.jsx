import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { C } from '../lib/colors';
import { Topbar, PrimaryBtn, GhostBtn, inputSt, LBL, useToast, ConfirmModal } from '../lib/ui.jsx';
import { supabase } from '../lib/supabase.js';

// ─── CONSTANTS ─────────────────────────────────────────────────────────────────
const PLATFORMS = [
  { key: 'internal',    label: 'Internal',     color: C.gray,    bg: C.grayBg },
  { key: 'google',      label: 'Google',       color: '#1D4ED8', bg: '#DBEAFE' },
  { key: 'yelp',        label: 'Yelp',         color: '#B91C1C', bg: '#FEE2E2' },
  { key: 'facebook',    label: 'Facebook',     color: '#1E40AF', bg: '#EFF6FF' },
  { key: 'theknot',     label: 'The Knot',     color: '#9D174D', bg: '#FCE7F3' },
  { key: 'weddingwire', label: 'WeddingWire',  color: '#065F46', bg: '#D1FAE5' },
  { key: 'other',       label: 'Other',        color: '#374151', bg: '#F3F4F6' },
];
const PLATFORM_MAP = Object.fromEntries(PLATFORMS.map(p => [p.key, p]));

const FILTER_TABS = [
  { key: 'all',            label: 'All' },
  { key: 'google',         label: 'Google' },
  { key: 'internal',       label: 'Internal' },
  { key: 'needs_response', label: 'Needs Response' },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const Stars = ({ rating, size = 14 }) => (
  <span style={{ color: '#F59E0B', fontSize: size, letterSpacing: 1 }}>
    {'★'.repeat(Math.max(0, Math.min(5, rating || 0)))}
    {'☆'.repeat(5 - Math.max(0, Math.min(5, rating || 0)))}
  </span>
);

const StarPicker = ({ value, onChange }) => (
  <div style={{ display: 'flex', gap: 4 }}>
    {[1, 2, 3, 4, 5].map(n => (
      <button
        key={n}
        type="button"
        onClick={() => onChange(n)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 2,
          fontSize: 24, color: n <= (value || 0) ? '#F59E0B' : C.border,
          lineHeight: 1, transition: 'color 0.1s',
        }}
      >
        ★
      </button>
    ))}
  </div>
);

const PlatformBadge = ({ platform }) => {
  const p = PLATFORM_MAP[platform] || PLATFORM_MAP.other;
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
      background: p.bg, color: p.color, whiteSpace: 'nowrap',
    }}>
      {p.label}
    </span>
  );
};

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function thisMonth(iso) {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

// ─── LOG REVIEW MODAL ─────────────────────────────────────────────────────────
const BLANK = { rating: 5, platform: 'internal', reviewer_name: '', review_text: '', review_url: '', client_id: '', event_id: '' };

const LogReviewModal = ({ onClose, onSave, saving, clients, events }) => {
  const [form, setForm] = useState({ ...BLANK });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Filter events by chosen client
  const clientEvents = useMemo(() =>
    form.client_id ? events.filter(e => e.client_id === form.client_id) : events,
    [form.client_id, events]
  );

  const valid = form.rating >= 1 && form.rating <= 5;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div style={{ background: C.white, borderRadius: 16, width: 540, maxWidth: '100%', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
        {/* Header */}
        <div style={{ padding: '18px 22px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: C.white, zIndex: 1 }}>
          <span style={{ fontWeight: 600, fontSize: 15, color: C.ink }}>Log Review</span>
          <button aria-label="Close" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: C.gray, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Rating */}
          <div>
            <div id="rev-rating-label" style={LBL}>Rating *</div>
            <StarPicker value={form.rating} onChange={v => set('rating', v)} role="group" aria-labelledby="rev-rating-label" />
          </div>

          {/* Platform */}
          <div>
            <label htmlFor="rev-platform" style={LBL}>Platform</label>
            <select
              id="rev-platform"
              value={form.platform}
              onChange={e => set('platform', e.target.value)}
              style={inputSt}
            >
              {PLATFORMS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          </div>

          {/* Reviewer name */}
          <div>
            <label htmlFor="rev-reviewer-name" style={LBL}>Reviewer Name</label>
            <input
              id="rev-reviewer-name"
              style={inputSt}
              placeholder="e.g. Maria G."
              value={form.reviewer_name}
              onChange={e => set('reviewer_name', e.target.value)}
            />
          </div>

          {/* Review text */}
          <div>
            <label htmlFor="rev-review-text" style={LBL}>Review Text</label>
            <textarea
              id="rev-review-text"
              style={{ ...inputSt, minHeight: 90, resize: 'vertical' }}
              placeholder="Paste or type the review…"
              value={form.review_text}
              onChange={e => set('review_text', e.target.value)}
            />
          </div>

          {/* Review URL */}
          <div>
            <label htmlFor="rev-review-url" style={LBL}>Review URL (optional)</label>
            <input
              id="rev-review-url"
              style={inputSt}
              placeholder="https://…"
              value={form.review_url}
              onChange={e => set('review_url', e.target.value)}
            />
          </div>

          {/* Client */}
          <div>
            <label htmlFor="rev-client" style={LBL}>Client (optional)</label>
            <select
              id="rev-client"
              value={form.client_id}
              onChange={e => { set('client_id', e.target.value); set('event_id', ''); }}
              style={inputSt}
            >
              <option value="">— No client —</option>
              {clients.map(cl => (
                <option key={cl.id} value={cl.id}>{cl.name}</option>
              ))}
            </select>
          </div>

          {/* Event */}
          <div>
            <label htmlFor="rev-event" style={LBL}>Event (optional)</label>
            <select
              id="rev-event"
              value={form.event_id}
              onChange={e => set('event_id', e.target.value)}
              style={inputSt}
            >
              <option value="">— No event —</option>
              {clientEvents.map(ev => (
                <option key={ev.id} value={ev.id}>
                  {ev.type} — {ev.clients?.name || ev.client_name || ''} {ev.event_date ? `(${ev.event_date})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 22px', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <GhostBtn label="Cancel" onClick={onClose} />
          <PrimaryBtn
            label={saving ? 'Saving…' : 'Save Review'}
            disabled={!valid || saving}
            onClick={() => onSave({
              rating: form.rating,
              platform: form.platform,
              reviewer_name: form.reviewer_name.trim() || null,
              review_text: form.review_text.trim() || null,
              review_url: form.review_url.trim() || null,
              client_id: form.client_id || null,
              event_id: form.event_id || null,
            })}
          />
        </div>
      </div>
    </div>
  );
};

// ─── RESPONSE INLINE FORM ─────────────────────────────────────────────────────
const ResponseForm = ({ initialValue, onSave, onCancel, saving }) => {
  const [text, setText] = useState(initialValue || '');
  return (
    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <textarea
        style={{ ...inputSt, minHeight: 70, resize: 'vertical', fontSize: 12 }}
        placeholder="Write your response…"
        value={text}
        onChange={e => setText(e.target.value)}
      />
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <GhostBtn label="Cancel" onClick={onCancel} style={{ fontSize: 12, padding: '4px 12px' }} />
        <PrimaryBtn
          label={saving ? 'Saving…' : 'Save Response'}
          disabled={!text.trim() || saving}
          onClick={() => onSave(text.trim())}
          style={{ fontSize: 12, padding: '4px 12px' }}
        />
      </div>
    </div>
  );
};

// ─── REVIEW CARD ──────────────────────────────────────────────────────────────
const ReviewCard = ({ review, onToggleFeatured, onDelete, onSaveResponse, events }) => {
  const [expanded, setExpanded] = useState(false);
  const [showResponse, setShowResponse] = useState(false);
  const [savingResp, setSavingResp] = useState(false);

  const text = review.review_text || '';
  const truncated = text.length > 220;
  const displayText = truncated && !expanded ? text.slice(0, 220) + '…' : text;

  const linkedEvent = review.event_id
    ? events.find(e => e.id === review.event_id)
    : null;

  const handleSaveResponse = async (respText) => {
    setSavingResp(true);
    await onSaveResponse(review.id, respText);
    setSavingResp(false);
    setShowResponse(false);
  };

  return (
    <div style={{
      background: C.white,
      border: `1px solid ${review.is_featured ? C.rosa : C.border}`,
      borderRadius: 12,
      padding: '16px 18px',
      boxShadow: review.is_featured ? `0 0 0 1px ${C.rosaLight}` : 'none',
    }}>
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Stars rating={review.rating} size={15} />
            <PlatformBadge platform={review.platform} />
            {review.is_featured && (
              <span style={{ fontSize: 10, color: C.rosaText, fontWeight: 600 }}>Featured</span>
            )}
          </div>
          <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: C.ink }}>
              {review.reviewer_name || 'Anonymous'}
            </span>
            <span style={{ fontSize: 11, color: C.gray }}>
              {fmtDate(review.created_at)}
            </span>
            {review.review_url && (
              <a
                href={review.review_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 11, color: C.blue, textDecoration: 'none' }}
              >
                View →
              </a>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button
            title={review.is_featured ? 'Unfeature' : 'Feature this review'}
            onClick={() => onToggleFeatured(review.id, !review.is_featured)}
            style={{
              background: 'none', border: `1px solid ${C.border}`, borderRadius: 6,
              cursor: 'pointer', padding: '4px 8px', fontSize: 13,
              color: review.is_featured ? '#F59E0B' : C.gray,
            }}
          >
            ⭐
          </button>
          <button
            title="Delete review"
            onClick={() => onDelete(review.id)}
            style={{
              background: 'none', border: `1px solid ${C.border}`, borderRadius: 6,
              cursor: 'pointer', padding: '4px 8px', fontSize: 13, color: C.gray,
            }}
          >
            ×
          </button>
        </div>
      </div>

      {/* Review text */}
      {text && (
        <div style={{ fontSize: 13, color: C.inkMid, lineHeight: 1.55, marginBottom: 8 }}>
          "{displayText}"
          {truncated && (
            <button
              onClick={() => setExpanded(!expanded)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.rosaText, fontSize: 12, marginLeft: 6, padding: 0 }}
            >
              {expanded ? 'Show less' : 'Read more'}
            </button>
          )}
        </div>
      )}

      {/* Event link */}
      {linkedEvent && (
        <div style={{ fontSize: 11, color: C.gray, marginBottom: 8 }}>
          Linked event: <span style={{ color: C.ink, fontWeight: 500 }}>
            {linkedEvent.type}{linkedEvent.clients?.name ? ` — ${linkedEvent.clients.name}` : ''}
          </span>
          {linkedEvent.event_date && ` (${linkedEvent.event_date})`}
        </div>
      )}

      {/* Response section */}
      {review.response ? (
        <div style={{ background: C.grayBg, borderRadius: 8, padding: '10px 14px', marginTop: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.gray, marginBottom: 4 }}>
            Your response · {fmtDate(review.responded_at)}
          </div>
          <div style={{ fontSize: 12, color: C.ink, lineHeight: 1.5 }}>{review.response}</div>
          <button
            onClick={() => setShowResponse(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.rosaText, fontSize: 11, padding: 0, marginTop: 6 }}
          >
            Edit response
          </button>
          {showResponse && (
            <ResponseForm
              initialValue={review.response}
              onSave={handleSaveResponse}
              onCancel={() => setShowResponse(false)}
              saving={savingResp}
            />
          )}
        </div>
      ) : (
        <div>
          {!showResponse ? (
            <button
              onClick={() => setShowResponse(true)}
              style={{ background: 'none', border: `1px dashed ${C.border}`, borderRadius: 7, cursor: 'pointer', color: C.gray, fontSize: 12, padding: '6px 12px', width: '100%', textAlign: 'left', marginTop: 4 }}
            >
              + Add response
            </button>
          ) : (
            <ResponseForm
              onSave={handleSaveResponse}
              onCancel={() => setShowResponse(false)}
              saving={savingResp}
            />
          )}
        </div>
      )}
    </div>
  );
};

// ─── REQUEST TEMPLATES CARD ───────────────────────────────────────────────────
const SMS_TEMPLATE = `Hi {{name}}, thank you so much for choosing us for your special day! 🌸 We'd love to hear your thoughts — could you spare a moment to leave us a review? {{review_link}}`;
const EMAIL_TEMPLATE = `Hi {{name}},\n\nThank you for trusting us with your special day! We hope everything was exactly as you dreamed.\n\nIf you have a moment, we'd truly appreciate you sharing your experience:\n{{review_link}}\n\nWith love,\n{{boutique}}`;

const RequestTemplatesCard = ({ googleReviewUrl, onSaveGoogleUrl }) => {
  const [gUrl, setGUrl] = useState(googleReviewUrl || '');
  const [copied, setCopied] = useState(null);
  const [saving, setSaving] = useState(false);

  const copy = (text, key) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const handleSave = async () => {
    setSaving(true);
    await onSaveGoogleUrl(gUrl.trim());
    setSaving(false);
  };

  const smsFilled = SMS_TEMPLATE.replace('{{review_link}}', gUrl || '[your Google review link]');
  const emailFilled = EMAIL_TEMPLATE.replace(/{{review_link}}/g, gUrl || '[your Google review link]');

  return (
    <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 500, fontSize: 14, color: C.ink }}>Review Request Templates</span>
      </div>
      <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Google review URL */}
        <div>
          <label htmlFor="rev-google-url" style={LBL}>Your Google Review Link</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              id="rev-google-url"
              style={{ ...inputSt, flex: 1 }}
              placeholder="https://g.page/your-business/review"
              value={gUrl}
              onChange={e => setGUrl(e.target.value)}
            />
            <PrimaryBtn
              label={saving ? 'Saving…' : 'Save'}
              onClick={handleSave}
              disabled={saving}
              style={{ flexShrink: 0, fontSize: 13, padding: '0 14px' }}
            />
          </div>
        </div>

        {/* SMS template */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: C.ink }}>SMS Template</span>
            <button
              onClick={() => copy(smsFilled, 'sms')}
              style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 6, cursor: 'pointer', fontSize: 11, color: copied === 'sms' ? C.green : C.gray, padding: '3px 10px' }}
            >
              {copied === 'sms' ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <div style={{ background: C.grayBg, borderRadius: 8, padding: '10px 14px', fontSize: 12, color: C.inkMid, lineHeight: 1.55, fontFamily: 'inherit' }}>
            {smsFilled}
          </div>
        </div>

        {/* Email template */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: C.ink }}>Email Template</span>
            <button
              onClick={() => copy(emailFilled, 'email')}
              style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 6, cursor: 'pointer', fontSize: 11, color: copied === 'email' ? C.green : C.gray, padding: '3px 10px' }}
            >
              {copied === 'email' ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <div style={{ background: C.grayBg, borderRadius: 8, padding: '10px 14px', fontSize: 12, color: C.inkMid, lineHeight: 1.55, whiteSpace: 'pre-line', fontFamily: 'inherit' }}>
            {emailFilled}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function ReviewsPage() {
  const { boutique } = useAuth();
  const toast = useToast();

  const [reviews, setReviews] = useState([]);
  const [clients, setClients] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // review id | null

  // ── Load data ────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!boutique?.id) return;
    setLoading(true);
    const [revRes, clRes, evRes] = await Promise.all([
      supabase
        .from('reviews')
        .select('*')
        .eq('boutique_id', boutique.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('clients')
        .select('id, name, phone, email')
        .eq('boutique_id', boutique.id)
        .order('name'),
      supabase
        .from('events')
        .select('id, type, event_date, client_id, clients(name)')
        .eq('boutique_id', boutique.id)
        .order('event_date', { ascending: false }),
    ]);
    if (!revRes.error) setReviews(revRes.data || []);
    if (!clRes.error) setClients(clRes.data || []);
    if (!evRes.error) setEvents(evRes.data || []);
    setLoading(false);
  }, [boutique?.id]);

  useEffect(() => { load(); }, [load]);

  // ── Stats ────────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!reviews.length) return { avg: 0, total: 0, thisMonth: 0, responseRate: 0 };
    const total = reviews.length;
    const avg = reviews.reduce((s, r) => s + (r.rating || 0), 0) / total;
    const monthCount = reviews.filter(r => thisMonth(r.created_at)).length;
    const withResponse = reviews.filter(r => r.response).length;
    const responseRate = total ? Math.round((withResponse / total) * 100) : 0;
    return { avg: Math.round(avg * 10) / 10, total, thisMonth: monthCount, responseRate };
  }, [reviews]);

  // ── Rating distribution ───────────────────────────────────────────────────────
  const ratingDist = useMemo(() => {
    const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.forEach(r => { if (r.rating) counts[r.rating] = (counts[r.rating] || 0) + 1; });
    const max = Math.max(1, ...Object.values(counts));
    return [5, 4, 3, 2, 1].map(n => ({ stars: n, count: counts[n], pct: Math.round((counts[n] / max) * 100) }));
  }, [reviews]);

  // ── Platform breakdown ────────────────────────────────────────────────────────
  const platformCounts = useMemo(() => {
    const counts = {};
    reviews.forEach(r => { counts[r.platform] = (counts[r.platform] || 0) + 1; });
    return PLATFORMS.filter(p => counts[p.key]).map(p => ({ ...p, count: counts[p.key] }));
  }, [reviews]);

  // ── Featured reviews ─────────────────────────────────────────────────────────
  const featuredReviews = useMemo(() => reviews.filter(r => r.is_featured), [reviews]);

  // ── Filter reviews ───────────────────────────────────────────────────────────
  const filteredReviews = useMemo(() => {
    if (filterTab === 'all') return reviews;
    if (filterTab === 'needs_response') return reviews.filter(r => !r.response);
    return reviews.filter(r => r.platform === filterTab);
  }, [reviews, filterTab]);

  // ── Mutations ────────────────────────────────────────────────────────────────
  const handleSaveReview = async (data) => {
    setSaving(true);
    const { error } = await supabase.from('reviews').insert({ ...data, boutique_id: boutique.id });
    setSaving(false);
    if (error) { toast('Failed to save review', 'error'); return; }
    toast('Review logged');
    setShowModal(false);
    load();
  };

  const handleToggleFeatured = async (id, isFeatured) => {
    // Max 3 featured at once
    if (isFeatured && featuredReviews.length >= 3) {
      toast('Max 3 featured reviews allowed. Unfeature one first.', 'warn');
      return;
    }
    const { error } = await supabase.from('reviews').update({ is_featured: isFeatured }).eq('id', id);
    if (error) { toast('Failed to update', 'error'); return; }
    setReviews(rv => rv.map(r => r.id === id ? { ...r, is_featured: isFeatured } : r));
  };

  const handleDelete = (id) => setDeleteConfirm(id);
  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    const { error } = await supabase.from('reviews').delete().eq('id', deleteConfirm);
    setDeleteConfirm(null);
    if (error) { toast('Failed to delete', 'error'); return; }
    toast('Review deleted');
    setReviews(rv => rv.filter(r => r.id !== deleteConfirm));
  };

  const handleSaveResponse = async (id, responseText) => {
    const { error } = await supabase.from('reviews').update({
      response: responseText,
      responded_at: new Date().toISOString(),
    }).eq('id', id);
    if (error) { toast('Failed to save response', 'error'); return; }
    toast('Response saved');
    setReviews(rv => rv.map(r => r.id === id ? { ...r, response: responseText, responded_at: new Date().toISOString() } : r));
  };

  const handleSaveGoogleUrl = async (url) => {
    const { error } = await supabase.from('boutiques').update({ google_review_url: url }).eq('id', boutique.id);
    if (error) {
      // Column may not exist — just show a copy-friendly message
      toast('Copy the link and share it with clients', 'warn');
      return;
    }
    toast('Google review link saved');
  };

  // ─── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: C.grayBg }}>
      <Topbar
        title="Reviews & Reputation"
        subtitle="Collect and manage client reviews"
        actions={
          <PrimaryBtn label="+ Log Review" onClick={() => setShowModal(true)} />
        }
      />

      <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── Stat cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          {[
            {
              label: 'Average Rating',
              value: stats.total ? (
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 26, fontWeight: 600, color: C.ink }}>{stats.avg}</span>
                  <Stars rating={Math.round(stats.avg)} size={16} />
                </div>
              ) : <span style={{ fontSize: 26, fontWeight: 600, color: C.gray }}>—</span>,
            },
            { label: 'Total Reviews', value: <span style={{ fontSize: 26, fontWeight: 600, color: C.ink }}>{stats.total}</span> },
            { label: 'This Month', value: <span style={{ fontSize: 26, fontWeight: 600, color: C.ink }}>{stats.thisMonth}</span> },
            {
              label: 'Response Rate',
              value: <span style={{ fontSize: 26, fontWeight: 600, color: stats.responseRate >= 80 ? C.green : stats.responseRate >= 50 ? C.amber : C.ink }}>{stats.responseRate}%</span>,
            },
          ].map((s, i) => (
            <div key={i} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 18px' }}>
              <div style={{ fontSize: 11, color: C.gray, fontWeight: 500, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
              {s.value}
            </div>
          ))}
        </div>

        {/* ── Dashboard: distribution + platforms + featured ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Rating distribution */}
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.ink, marginBottom: 14 }}>Rating Distribution</div>
            {reviews.length === 0 ? (
              <div style={{ fontSize: 12, color: C.gray }}>No reviews yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {ratingDist.map(({ stars, count, pct }) => (
                  <div key={stars} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 12, color: C.gray, width: 14, textAlign: 'right', flexShrink: 0 }}>{stars}</span>
                    <span style={{ color: '#F59E0B', fontSize: 12, flexShrink: 0 }}>★</span>
                    <div style={{ flex: 1, background: C.border, borderRadius: 3, height: 8, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: '#F59E0B', borderRadius: 3, transition: 'width 0.4s' }} />
                    </div>
                    <span style={{ fontSize: 12, color: C.gray, width: 22, textAlign: 'right', flexShrink: 0 }}>{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Platform breakdown + Featured */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Platform pills */}
            <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 18px' }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: C.ink, marginBottom: 12 }}>By Platform</div>
              {platformCounts.length === 0 ? (
                <div style={{ fontSize: 12, color: C.gray }}>No reviews yet.</div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {platformCounts.map(p => (
                    <span
                      key={p.key}
                      style={{
                        fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 999,
                        background: p.bg, color: p.color, cursor: 'pointer',
                      }}
                      onClick={() => setFilterTab(p.key === filterTab ? 'all' : p.key)}
                    >
                      {p.label} · {p.count}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Featured reviews */}
            <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 18px', flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: C.ink }}>Featured Reviews</span>
                <span style={{ fontSize: 11, color: C.gray }}>{featuredReviews.length}/3</span>
              </div>
              {featuredReviews.length === 0 ? (
                <div style={{ fontSize: 12, color: C.gray, lineHeight: 1.5 }}>
                  Pin up to 3 reviews to feature them prominently.<br />Click the ⭐ on any review below.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {featuredReviews.map(r => (
                    <div key={r.id} style={{ background: C.rosaPale, borderRadius: 8, padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <Stars rating={r.rating} size={13} />
                        <span style={{ fontSize: 11, color: C.inkLight, fontWeight: 500 }}>{r.reviewer_name || 'Anonymous'}</span>
                      </div>
                      {r.review_text && (
                        <div style={{ fontSize: 11, color: C.inkMid, lineHeight: 1.45 }}>
                          "{r.review_text.slice(0, 100)}{r.review_text.length > 100 ? '…' : ''}"
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Review list ── */}
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
          {/* Filter tabs */}
          <div style={{ borderBottom: `1px solid ${C.border}`, padding: '0 18px', display: 'flex', gap: 0 }}>
            {FILTER_TABS.map(tab => {
              const count = tab.key === 'all'
                ? reviews.length
                : tab.key === 'needs_response'
                  ? reviews.filter(r => !r.response).length
                  : reviews.filter(r => r.platform === tab.key).length;
              const active = filterTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setFilterTab(tab.key)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '12px 14px', fontSize: 13,
                    color: active ? C.rosaText : C.gray,
                    borderBottom: active ? `2px solid ${C.rosa}` : '2px solid transparent',
                    fontWeight: active ? 500 : 400,
                    display: 'flex', alignItems: 'center', gap: 6,
                    transition: 'color 0.15s',
                  }}
                >
                  {tab.label}
                  {count > 0 && (
                    <span style={{
                      fontSize: 10, background: active ? C.rosaPale : C.grayBg,
                      color: active ? C.rosaText : C.gray, borderRadius: 999,
                      padding: '1px 6px', fontWeight: 600,
                    }}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* List */}
          <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 40, color: C.gray, fontSize: 13 }}>Loading…</div>
            ) : filteredReviews.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: C.gray, fontSize: 13, lineHeight: 1.6 }}>
                {reviews.length === 0
                  ? 'No reviews logged yet. Start collecting feedback from your clients after each event.'
                  : 'No reviews match this filter.'}
              </div>
            ) : (
              filteredReviews.map(review => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  events={events}
                  onToggleFeatured={handleToggleFeatured}
                  onDelete={handleDelete}
                  onSaveResponse={handleSaveResponse}
                />
              ))
            )}
          </div>
        </div>

        {/* ── Request templates ── */}
        <RequestTemplatesCard
          googleReviewUrl={boutique?.google_review_url || ''}
          onSaveGoogleUrl={handleSaveGoogleUrl}
        />
      </div>

      {/* ── Log review modal ── */}
      {showModal && (
        <LogReviewModal
          onClose={() => setShowModal(false)}
          onSave={handleSaveReview}
          saving={saving}
          clients={clients}
          events={events}
        />
      )}
      {deleteConfirm && (
        <ConfirmModal title="Delete this review?" message="This cannot be undone." confirmLabel="Delete"
          onConfirm={confirmDelete} onCancel={() => setDeleteConfirm(null)} />
      )}
    </div>
  );
}
