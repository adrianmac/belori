import React, { useState, useEffect, useCallback, useRef } from 'react';
import { C } from '../lib/colors';
import { Topbar, PrimaryBtn, GhostBtn, Badge, inputSt, LBL, useToast } from '../lib/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabase.js';

// ─── CONSTANTS ─────────────────────────────────────────────────────────────

const PHOTO_TYPES = [
  { value: 'all',         label: 'All types' },
  { value: 'general',     label: 'General',     bg: '#F3F4F6', color: '#374151' },
  { value: 'fitting',     label: 'Fitting',      bg: '#FDF2F8', color: '#9D174D' },
  { value: 'before',      label: 'Before',       bg: '#FEF3C7', color: '#92400E' },
  { value: 'after',       label: 'After',        bg: '#D1FAE5', color: '#065F46' },
  { value: 'event_day',   label: 'Event Day',    bg: '#FCE7F3', color: '#831843' },
  { value: 'inspiration', label: 'Inspiration',  bg: '#EDE9FE', color: '#5B21B6' },
  { value: 'dress',       label: 'Dress',        bg: '#DBEAFE', color: '#1E40AF' },
];

const TYPE_MAP = Object.fromEntries(PHOTO_TYPES.filter(t => t.value !== 'all').map(t => [t.value, t]));

// ─── HELPERS ───────────────────────────────────────────────────────────────

function getExt(file) {
  return file.name.split('.').pop().toLowerCase() || 'jpg';
}

function fmtDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function thisMonth(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

// ─── TYPE BADGE ────────────────────────────────────────────────────────────

function TypeBadge({ type }) {
  const cfg = TYPE_MAP[type] || { label: type, bg: '#F3F4F6', color: '#374151' };
  return (
    <span style={{
      fontSize: 10, padding: '2px 7px', borderRadius: 999,
      background: cfg.bg, color: cfg.color, fontWeight: 600,
      whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.04em',
    }}>
      {cfg.label}
    </span>
  );
}

// ─── LIGHTBOX ──────────────────────────────────────────────────────────────

function Lightbox({ photo, events, onClose, onDelete, onUpdateCaption }) {
  const [editing, setEditing] = useState(false);
  const [caption, setCaption] = useState(photo.caption || '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const eventName = photo.event
    ? (photo.event.client?.name
        ? `${photo.event.client.name} — ${photo.event.type}`
        : photo.event.type)
    : null;

  async function handleSaveCaption() {
    setSaving(true);
    await onUpdateCaption(photo.id, caption);
    setSaving(false);
    setEditing(false);
  }

  async function handleDelete() {
    if (!window.confirm('Delete this photo? This cannot be undone.')) return;
    setDeleting(true);
    await onDelete(photo);
    onClose();
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.88)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: C.white, borderRadius: 12, overflow: 'hidden',
          maxWidth: 900, width: '100%', maxHeight: '90vh',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 25px 60px rgba(0,0,0,0.4)',
        }}
      >
        {/* Image */}
        <div style={{ flex: 1, background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0, overflow: 'hidden' }}>
          <img
            src={photo.url}
            alt={photo.caption || ''}
            style={{ maxWidth: '100%', maxHeight: '65vh', objectFit: 'contain', display: 'block' }}
          />
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 20px', borderTop: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
            {/* Left: caption + meta */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                <TypeBadge type={photo.photo_type} />
                {eventName && (
                  <span style={{ fontSize: 12, color: C.gray }}>{eventName}</span>
                )}
                <span style={{ fontSize: 11, color: C.inkLight }}>{fmtDate(photo.created_at)}</span>
                {photo.uploaded_by && (
                  <span style={{ fontSize: 11, color: C.inkLight }}>by {photo.uploaded_by}</span>
                )}
              </div>

              {editing ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    autoFocus
                    value={caption}
                    onChange={e => setCaption(e.target.value)}
                    placeholder="Add a caption…"
                    style={{ ...inputSt, fontSize: 13 }}
                    onKeyDown={e => { if (e.key === 'Enter') handleSaveCaption(); if (e.key === 'Escape') setEditing(false); }}
                  />
                  <PrimaryBtn onClick={handleSaveCaption} disabled={saving} style={{ whiteSpace: 'nowrap' }}>
                    {saving ? 'Saving…' : 'Save'}
                  </PrimaryBtn>
                  <GhostBtn onClick={() => { setEditing(false); setCaption(photo.caption || ''); }}>Cancel</GhostBtn>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, color: photo.caption ? C.ink : C.gray, fontStyle: photo.caption ? 'normal' : 'italic' }}>
                    {photo.caption || 'No caption'}
                  </span>
                  <button
                    onClick={() => setEditing(true)}
                    style={{ fontSize: 11, color: C.rosa, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    Edit caption
                  </button>
                </div>
              )}
            </div>

            {/* Right: actions */}
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  padding: '7px 14px', borderRadius: 7, border: `1px solid ${C.redBg}`,
                  background: C.redBg, color: C.red, fontSize: 12, fontWeight: 500,
                  cursor: 'pointer', opacity: deleting ? 0.6 : 1,
                }}
              >
                {deleting ? 'Deleting…' : 'Delete photo'}
              </button>
              <button
                onClick={onClose}
                style={{
                  padding: '7px 14px', borderRadius: 7, border: `1px solid ${C.border}`,
                  background: C.white, color: C.ink, fontSize: 12, fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── PHOTO CARD ─────────────────────────────────────────────────────────────

function PhotoCard({ photo, onClick }) {
  const [hovered, setHovered] = useState(false);
  const eventName = photo.event?.client?.name || null;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: 10, overflow: 'hidden', cursor: 'pointer',
        border: `1px solid ${C.border}`,
        background: C.white,
        boxShadow: hovered ? '0 4px 16px rgba(0,0,0,0.12)' : '0 1px 3px rgba(0,0,0,0.06)',
        transform: hovered ? 'translateY(-2px)' : 'none',
        transition: 'box-shadow 0.15s, transform 0.15s',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Image container */}
      <div style={{ position: 'relative', paddingTop: '75%', background: '#F3F4F6', flexShrink: 0 }}>
        <img
          src={photo.url}
          alt={photo.caption || ''}
          loading="lazy"
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover', display: 'block',
          }}
        />
        {/* Hover overlay */}
        {hovered && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0,0,0,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ color: '#fff', fontSize: 13, fontWeight: 500 }}>View</span>
          </div>
        )}
        {/* Type badge overlay */}
        <div style={{ position: 'absolute', top: 8, left: 8 }}>
          <TypeBadge type={photo.photo_type} />
        </div>
      </div>

      {/* Card footer */}
      <div style={{ padding: '8px 10px', flex: 1 }}>
        {photo.caption && (
          <div style={{ fontSize: 12, color: C.ink, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {photo.caption}
          </div>
        )}
        {eventName && (
          <div style={{ fontSize: 11, color: C.gray, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {eventName}
          </div>
        )}
        <div style={{ fontSize: 10, color: C.inkLight, marginTop: photo.caption || eventName ? 2 : 0 }}>
          {fmtDate(photo.created_at)}
        </div>
      </div>
    </div>
  );
}

// ─── UPLOAD PROGRESS ────────────────────────────────────────────────────────

function UploadProgress({ items }) {
  if (!items.length) return null;
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 500,
      background: C.white, border: `1px solid ${C.border}`,
      borderRadius: 10, padding: '12px 16px', minWidth: 260,
      boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
    }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: C.ink, marginBottom: 8 }}>
        Uploading {items.length} photo{items.length > 1 ? 's' : ''}…
      </div>
      {items.map((item, i) => (
        <div key={i} style={{ marginBottom: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.gray, marginBottom: 3 }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{item.name}</span>
            <span>{item.progress}%</span>
          </div>
          <div style={{ height: 4, background: C.border, borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 2,
              background: item.error ? C.red : C.rosa,
              width: `${item.progress}%`,
              transition: 'width 0.2s',
            }} />
          </div>
          {item.error && <div style={{ fontSize: 10, color: C.red, marginTop: 2 }}>{item.error}</div>}
        </div>
      ))}
    </div>
  );
}

// ─── UPLOAD MODAL ─────────────────────────────────────────────────────────

function UploadModal({ events, onClose, onUploadComplete }) {
  const { boutique, session } = useAuth();
  const { addToast } = useToast();
  const fileInputRef = useRef(null);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [selectedType, setSelectedType] = useState('general');
  const [uploading, setUploading] = useState(false);
  const [uploadItems, setUploadItems] = useState([]);
  const [pendingFiles, setPendingFiles] = useState([]);

  function handleFilesChange(e) {
    const files = Array.from(e.target.files || []);
    setPendingFiles(files);
  }

  async function handleUpload() {
    if (!pendingFiles.length) return;
    setUploading(true);

    const items = pendingFiles.map(f => ({ name: f.name, progress: 0, error: null }));
    setUploadItems(items);

    let successCount = 0;
    for (let i = 0; i < pendingFiles.length; i++) {
      const file = pendingFiles[i];
      const ext = getExt(file);
      const path = `${boutique.id}/${selectedEventId || 'general'}/${crypto.randomUUID()}.${ext}`;

      // Update progress to 30% (starting upload)
      setUploadItems(prev => prev.map((it, idx) => idx === i ? { ...it, progress: 30 } : it));

      const { error: uploadError } = await supabase.storage
        .from('event-photos')
        .upload(path, file, { upsert: false });

      if (uploadError) {
        setUploadItems(prev => prev.map((it, idx) => idx === i ? { ...it, progress: 100, error: uploadError.message } : it));
        continue;
      }

      setUploadItems(prev => prev.map((it, idx) => idx === i ? { ...it, progress: 70 } : it));

      const { data: { publicUrl } } = supabase.storage.from('event-photos').getPublicUrl(path);

      const { error: dbError } = await supabase.from('event_photos').insert({
        boutique_id: boutique.id,
        event_id: selectedEventId || null,
        url: publicUrl,
        storage_path: path,
        photo_type: selectedType,
        uploaded_by: session?.user?.email || null,
      });

      if (dbError) {
        setUploadItems(prev => prev.map((it, idx) => idx === i ? { ...it, progress: 100, error: dbError.message } : it));
        continue;
      }

      setUploadItems(prev => prev.map((it, idx) => idx === i ? { ...it, progress: 100 } : it));
      successCount++;
    }

    setUploading(false);

    if (successCount > 0) {
      addToast(`${successCount} photo${successCount > 1 ? 's' : ''} uploaded`, 'success');
      onUploadComplete();
    }

    if (successCount === pendingFiles.length) {
      setTimeout(onClose, 800);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 900,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: C.white, borderRadius: 12,
          padding: 24, width: '100%', maxWidth: 480,
          boxShadow: '0 20px 48px rgba(0,0,0,0.2)',
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 600, color: C.ink, marginBottom: 20 }}>
          Upload Photos
        </div>

        {/* Event picker */}
        <div style={{ marginBottom: 14 }}>
          <div style={LBL}>Link to event (optional)</div>
          <select
            value={selectedEventId}
            onChange={e => setSelectedEventId(e.target.value)}
            style={{ ...inputSt }}
          >
            <option value="">No event — general photo</option>
            {events.map(ev => (
              <option key={ev.id} value={ev.id}>
                {ev.client?.name ? `${ev.client.name} — ` : ''}{ev.type}{ev.event_date ? ` (${fmtDate(ev.event_date)})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Photo type */}
        <div style={{ marginBottom: 14 }}>
          <div style={LBL}>Photo type</div>
          <select
            value={selectedType}
            onChange={e => setSelectedType(e.target.value)}
            style={{ ...inputSt }}
          >
            {PHOTO_TYPES.filter(t => t.value !== 'all').map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* File picker */}
        <div style={{ marginBottom: 20 }}>
          <div style={LBL}>Photos</div>
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${pendingFiles.length ? C.rosa : C.border}`,
              borderRadius: 8, padding: '20px 16px',
              textAlign: 'center', cursor: 'pointer',
              background: pendingFiles.length ? C.rosaPale : C.grayBg,
              transition: 'all 0.15s',
            }}
          >
            {pendingFiles.length ? (
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: C.rosa, marginBottom: 4 }}>
                  {pendingFiles.length} file{pendingFiles.length > 1 ? 's' : ''} selected
                </div>
                <div style={{ fontSize: 11, color: C.gray }}>
                  {pendingFiles.map(f => f.name).join(', ').slice(0, 80)}
                  {pendingFiles.map(f => f.name).join(', ').length > 80 ? '…' : ''}
                </div>
                <div style={{ fontSize: 11, color: C.rosa, marginTop: 6 }}>Click to change</div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 22, marginBottom: 6 }}>📁</div>
                <div style={{ fontSize: 13, color: C.gray }}>Click to select photos</div>
                <div style={{ fontSize: 11, color: C.inkLight, marginTop: 4 }}>JPG, PNG, WebP, GIF — up to 10 MB each</div>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={handleFilesChange}
          />
        </div>

        {/* Upload progress (inline) */}
        {uploadItems.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            {uploadItems.map((item, i) => (
              <div key={i} style={{ marginBottom: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.gray, marginBottom: 3 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 300 }}>{item.name}</span>
                  <span style={{ color: item.error ? C.red : (item.progress === 100 ? C.green : C.gray) }}>
                    {item.error ? 'Error' : item.progress === 100 ? 'Done' : `${item.progress}%`}
                  </span>
                </div>
                <div style={{ height: 4, background: C.border, borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 2,
                    background: item.error ? C.red : item.progress === 100 ? C.green : C.rosa,
                    width: `${item.progress}%`,
                    transition: 'width 0.2s',
                  }} />
                </div>
                {item.error && <div style={{ fontSize: 10, color: C.red, marginTop: 2 }}>{item.error}</div>}
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <GhostBtn onClick={onClose} disabled={uploading}>Cancel</GhostBtn>
          <PrimaryBtn
            onClick={handleUpload}
            disabled={!pendingFiles.length || uploading}
          >
            {uploading ? 'Uploading…' : `Upload ${pendingFiles.length ? pendingFiles.length + ' ' : ''}Photo${pendingFiles.length !== 1 ? 's' : ''}`}
          </PrimaryBtn>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN PAGE ─────────────────────────────────────────────────────────────

export default function PhotoGalleryPage() {
  const { boutique, session } = useAuth();
  const { addToast } = useToast();

  const [photos, setPhotos] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterEventId, setFilterEventId] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [search, setSearch] = useState('');

  // UI state
  const [lightboxPhoto, setLightboxPhoto] = useState(null);
  const [showUpload, setShowUpload] = useState(false);

  // ─── Fetch ──────────────────────────────────────────────────────────────

  const fetchPhotos = useCallback(async () => {
    if (!boutique?.id) return;
    const { data, error } = await supabase
      .from('event_photos')
      .select('*, event:events(id, type, event_date, client:clients(name))')
      .eq('boutique_id', boutique.id)
      .order('created_at', { ascending: false });
    if (!error) setPhotos(data || []);
  }, [boutique?.id]);

  const fetchEvents = useCallback(async () => {
    if (!boutique?.id) return;
    const { data } = await supabase
      .from('events')
      .select('id, type, event_date, client:clients(name)')
      .eq('boutique_id', boutique.id)
      .order('event_date', { ascending: false });
    setEvents(data || []);
  }, [boutique?.id]);

  useEffect(() => {
    async function init() {
      setLoading(true);
      await Promise.all([fetchPhotos(), fetchEvents()]);
      setLoading(false);
    }
    init();
  }, [fetchPhotos, fetchEvents]);

  // ─── Delete ─────────────────────────────────────────────────────────────

  async function handleDelete(photo) {
    if (photo.storage_path) {
      await supabase.storage.from('event-photos').remove([photo.storage_path]);
    }
    const { error } = await supabase.from('event_photos').delete().eq('id', photo.id);
    if (error) {
      addToast('Failed to delete photo', 'error');
    } else {
      addToast('Photo deleted', 'success');
      setPhotos(prev => prev.filter(p => p.id !== photo.id));
    }
  }

  // ─── Update caption ─────────────────────────────────────────────────────

  async function handleUpdateCaption(photoId, caption) {
    const { error } = await supabase
      .from('event_photos')
      .update({ caption })
      .eq('id', photoId);
    if (error) {
      addToast('Failed to save caption', 'error');
    } else {
      setPhotos(prev => prev.map(p => p.id === photoId ? { ...p, caption } : p));
      if (lightboxPhoto?.id === photoId) {
        setLightboxPhoto(prev => ({ ...prev, caption }));
      }
    }
  }

  // ─── Filtered photos ────────────────────────────────────────────────────

  const filtered = photos.filter(p => {
    if (filterEventId && p.event_id !== filterEventId) return false;
    if (filterType !== 'all' && p.photo_type !== filterType) return false;
    if (search) {
      const q = search.toLowerCase();
      const cap = (p.caption || '').toLowerCase();
      const evtName = p.event?.client?.name?.toLowerCase() || '';
      if (!cap.includes(q) && !evtName.includes(q)) return false;
    }
    return true;
  });

  // ─── Stats ──────────────────────────────────────────────────────────────

  const totalPhotos = photos.length;
  const thisMonthCount = photos.filter(p => thisMonth(p.created_at)).length;
  const eventsWithPhotos = new Set(photos.filter(p => p.event_id).map(p => p.event_id)).size;

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Topbar
        title="Photo Gallery"
        subtitle="Event photos & inspiration boards"
        action={
          <PrimaryBtn onClick={() => setShowUpload(true)}>
            + Upload Photos
          </PrimaryBtn>
        }
      />

      <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            { label: 'Total photos', value: totalPhotos },
            { label: 'This month', value: thisMonthCount },
            { label: 'Events with photos', value: eventsWithPhotos },
          ].map(stat => (
            <div key={stat.label} style={{
              background: C.white, border: `1px solid ${C.border}`,
              borderRadius: 10, padding: '12px 18px', minWidth: 130,
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: C.ink }}>{stat.value}</div>
              <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Filter bar */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Event picker */}
          <select
            value={filterEventId}
            onChange={e => setFilterEventId(e.target.value)}
            style={{ ...inputSt, width: 220, fontSize: 12 }}
          >
            <option value="">All events</option>
            {events.map(ev => (
              <option key={ev.id} value={ev.id}>
                {ev.client?.name ? `${ev.client.name} — ` : ''}{ev.type}
              </option>
            ))}
          </select>

          {/* Search */}
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search captions or client…"
            style={{ ...inputSt, width: 220, fontSize: 12 }}
          />

          {/* Type filter pills */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {PHOTO_TYPES.map(t => (
              <button
                key={t.value}
                onClick={() => setFilterType(t.value)}
                style={{
                  padding: '5px 12px', borderRadius: 999, fontSize: 11, fontWeight: 500,
                  cursor: 'pointer', border: 'none', transition: 'all 0.12s',
                  background: filterType === t.value
                    ? (t.value === 'all' ? C.rosa : t.bg)
                    : C.grayBg,
                  color: filterType === t.value
                    ? (t.value === 'all' ? C.white : t.color)
                    : C.gray,
                  outline: filterType === t.value ? `2px solid ${t.value === 'all' ? C.rosa : t.color}` : 'none',
                  outlineOffset: 1,
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: C.gray, fontSize: 13 }}>
            Loading photos…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            height: 280, gap: 12, textAlign: 'center',
          }}>
            <div style={{ fontSize: 48 }}>📸</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: C.ink }}>
              {photos.length === 0 ? 'No photos yet' : 'No photos match your filters'}
            </div>
            <div style={{ fontSize: 13, color: C.gray, maxWidth: 380 }}>
              {photos.length === 0
                ? 'Upload fitting photos, event day shots, or inspiration images.'
                : 'Try adjusting your filters or search term.'}
            </div>
            {photos.length === 0 && (
              <PrimaryBtn onClick={() => setShowUpload(true)} style={{ marginTop: 4 }}>
                + Upload Photos
              </PrimaryBtn>
            )}
          </div>
        ) : (
          <>
            {/* Result count */}
            <div style={{ fontSize: 12, color: C.gray, marginBottom: 12 }}>
              {filtered.length} photo{filtered.length !== 1 ? 's' : ''}
              {(filterEventId || filterType !== 'all' || search) ? ' (filtered)' : ''}
            </div>

            {/* Photo grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 14,
            }}>
              {filtered.map(photo => (
                <PhotoCard
                  key={photo.id}
                  photo={photo}
                  onClick={() => setLightboxPhoto(photo)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Upload modal */}
      {showUpload && (
        <UploadModal
          events={events}
          onClose={() => setShowUpload(false)}
          onUploadComplete={() => fetchPhotos()}
        />
      )}

      {/* Lightbox */}
      {lightboxPhoto && (
        <Lightbox
          photo={lightboxPhoto}
          events={events}
          onClose={() => setLightboxPhoto(null)}
          onDelete={handleDelete}
          onUpdateCaption={handleUpdateCaption}
        />
      )}
    </div>
  );
}
