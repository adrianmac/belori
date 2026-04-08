import { C } from '../../lib/colors';

export const TIER_CFG = {
  diamond: { bg: '#D4AF37', col: '#1C1012', label: 'Diamond ✦', avatarBg: '#D4AF37', avatarCol: '#1C1012', border: '#D4AF37' },
  vip:     { bg: '#1C1012', col: '#D4AF37', label: 'VIP ★', avatarBg: C.rosaPale, avatarCol: C.rosa, border: '#D4AF37' },
  loyal:   { bg: C.purpleBg, col: C.purple, label: 'Loyal', avatarBg: C.purpleBg, avatarCol: C.purple, border: C.purple },
  regular: { bg: C.blueBg, col: C.blue, label: 'Regular', avatarBg: C.blueBg, avatarCol: C.blue, border: C.blue },
  new:     { bg: '#F3F4F6', col: C.gray, label: 'New', avatarBg: '#F3F4F6', avatarCol: C.gray, border: C.border },
};

export const TIER_THRESHOLDS = { new: [0, 500], regular: [500, 1500], loyal: [1500, 3000], vip: [3000, 5000], diamond: [5000, 5000] };

export const HOW_FOUND_LABELS = { google: 'Google search', instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', referral: 'Referral', walk_in: 'Walk-in', expo: 'Expo / event', returning: 'Returning client', other: 'Other' };

export const NOTE_CAT_CFG = { general: { bg: C.grayBg, col: C.gray }, measurement: { bg: 'var(--bg-info)', col: 'var(--color-info)' }, preference: { bg: C.purpleBg, col: C.purple }, follow_up: { bg: 'var(--bg-warning)', col: 'var(--color-warning)' } };

export const INTERACTION_CFG = {
  note:             { icon: '📝', label: 'Note',           dot: '#3B82F6' },
  call_outbound:    { icon: '📞', label: 'Call (out)',      dot: '#10B981' },
  call_inbound:     { icon: '📲', label: 'Call (in)',       dot: '#10B981' },
  meeting:          { icon: '🤝', label: 'Meeting',         dot: '#8B5CF6' },
  sms_sent:         { icon: '💬', label: 'SMS sent',        dot: '#0891B2' },
  sms_received:     { icon: '💬', label: 'SMS received',    dot: '#0891B2' },
  email_sent:       { icon: '✉️', label: 'Email sent',      dot: '#F59E0B' },
  email_received:   { icon: '📧', label: 'Email received',  dot: '#F59E0B' },
  payment_received: { icon: '💳', label: 'Payment',         dot: '#059669' },
  payment_overdue:  { icon: '⚠️', label: 'Overdue',         dot: '#EF4444' },
  event_created:    { icon: '🎉', label: 'Event created',   dot: 'var(--color-rosa)' },
  follow_up:        { icon: '🔔', label: 'Follow-up',       dot: '#F59E0B' },
  system:           { icon: '⚙️', label: 'System',          dot: '#9CA3AF' },
};

export const PIPELINE_STAGES = [
  { id: 'inquiry',         label: 'Inquiry',          color: '#6B7280' },
  { id: 'consult_booked',  label: 'Consult booked',   color: '#3B82F6' },
  { id: 'proposal_sent',   label: 'Proposal sent',    color: '#F59E0B' },
  { id: 'contract_signed', label: 'Contract signed',  color: '#8B5CF6' },
  { id: 'won',             label: 'Won',               color: '#10B981' },
  { id: 'lost',            label: 'Lost',              color: '#EF4444' },
];

export const TAG_CAT_COLORS = { status: '#8B5CF6', source: '#3B82F6', service: '#F59E0B', internal: '#6B7280', alert: '#EF4444' };
