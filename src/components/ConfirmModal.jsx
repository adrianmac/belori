import React, { useEffect } from 'react';
import { C } from '../lib/colors';

export default function ConfirmModal({
  open,
  title = 'Confirm',
  message,
  confirmLabel = 'Confirm',
  danger = false,
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') onCancel?.();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 2000, padding: 16,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        aria-describedby={message ? "confirm-modal-desc" : undefined}
        onClick={e => e.stopPropagation()}
        style={{
          background: C.white,
          borderRadius: 12,
          padding: 24,
          maxWidth: 420,
          width: '90vw',
          boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
        }}
      >
        <div id="confirm-modal-title" style={{ fontWeight: 700, fontSize: 15, color: C.ink, marginBottom: 8 }}>
          {title}
        </div>
        {message && (
          <div id="confirm-modal-desc" style={{ fontSize: 13, color: C.gray, lineHeight: 1.5, marginBottom: 20 }}>
            {message}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            autoFocus
            onClick={onCancel}
            onMouseEnter={e => e.currentTarget.style.background = C.grayBg}
            onMouseLeave={e => {
              if (document.activeElement !== e.currentTarget) {
                e.currentTarget.style.background = C.white;
              }
            }}
            onFocus={e => e.currentTarget.style.background = C.grayBg}
            onBlur={e => e.currentTarget.style.background = C.white}
            style={{
              padding: '8px 16px', borderRadius: 8,
              border: `1px solid ${C.border}`,
              background: C.white, color: C.ink,
              fontSize: 13, fontWeight: 500, cursor: 'pointer',
              transition: 'background 0.2s',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
            onMouseLeave={e => {
              if (document.activeElement !== e.currentTarget) {
                e.currentTarget.style.opacity = '1';
              }
            }}
            onFocus={e => e.currentTarget.style.opacity = '0.85'}
            onBlur={e => e.currentTarget.style.opacity = '1'}
            style={{
              padding: '8px 16px', borderRadius: 8,
              border: 'none',
              background: danger ? C.danger : C.rosa,
              color: C.white,
              fontSize: 13, fontWeight: 500, cursor: 'pointer',
              transition: 'opacity 0.2s',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
