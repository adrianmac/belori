import React, { useEffect, useRef } from 'react';
import { D } from '../lib/couture.jsx';

const SHORTCUTS = [
  { section: 'Navigation' },
  { keys: ['⌘K', 'Ctrl+K'],  desc: 'Open the command palette' },
  { keys: ['?'],              desc: 'Show this list of shortcuts' },
  { keys: ['Esc'],            desc: 'Close a modal or menu' },
  { section: 'Quick jumps' },
  { keys: ['G', 'D'],         desc: 'Go to Dashboard' },
  { keys: ['G', 'E'],         desc: 'Go to Events' },
  { keys: ['G', 'C'],         desc: 'Go to Clients' },
  { keys: ['G', 'P'],         desc: 'Go to Payments' },
  { keys: ['G', 'S'],         desc: 'Go to Settings' },
  { section: 'In lists' },
  { keys: ['↑', '↓'],        desc: 'Move selection up / down' },
  { keys: ['↵'],              desc: 'Open the selected item' },
  { section: 'In modals' },
  { keys: ['↵'],              desc: 'Submit or confirm' },
  { keys: ['Esc'],            desc: 'Cancel and close' },
  { section: 'Calendar' },
  { keys: ['←', '→'],        desc: 'Previous or next period' },
  { keys: ['T'],              desc: 'Jump to today' },
];

// Focus trap & escape handler for the modal
function useModalA11y(onClose) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const previous = document.activeElement;
    const focusable = () => [...el.querySelectorAll('button:not([disabled])')];
    // Focus first button (the close button) on open
    focusable()[0]?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
      if (e.key !== 'Tab') return;
      const list = focusable();
      if (!list.length) return;
      const first = list[0], last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (previous && typeof previous.focus === 'function') previous.focus();
    };
  }, [onClose]);
  return ref;
}

export default function KeyboardShortcutsModal({ onClose }) {
  const ref = useModalA11y(onClose);

  return (
    <div
      role="presentation"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(28,17,24,0.45)',
        backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 2000, padding: 16,
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="kbd-modal-title"
        style={{
          background: D.cardWarm,
          border: `1px solid ${D.border}`,
          width: 500, maxHeight: '88dvh',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 28px 80px -12px rgba(28,17,24,0.28), 0 1px 3px rgba(28,17,24,0.08)',
          overflow: 'hidden',
          fontFamily: D.sans,
        }}
      >
        {/* Top gold hairline */}
        <div aria-hidden="true" style={{ height: 2, background: D.gold }} />

        {/* Header */}
        <div style={{
          padding: '22px 28px 16px',
          borderBottom: `1px solid ${D.border}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          flexShrink: 0,
          background: D.cardWarm,
        }}>
          <div>
            <div className="couture-smallcaps" style={{
              color: D.goldDark, letterSpacing: '0.28em', marginBottom: 6,
            }}>
              Keyboard
            </div>
            <h2
              id="kbd-modal-title"
              style={{
                fontFamily: D.serif, fontStyle: 'italic', fontWeight: 400,
                fontSize: 24, color: D.ink, margin: 0, lineHeight: 1.1,
                letterSpacing: '0.005em',
              }}
            >
              A guide to shortcuts.
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close keyboard shortcuts"
            style={{
              background: 'transparent', border: 'none', fontSize: 22, cursor: 'pointer',
              color: D.inkMid, lineHeight: 1, padding: '4px 8px',
              transition: 'color 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = D.ink}
            onMouseLeave={e => e.currentTarget.style.color = D.inkMid}
          >×</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 28px 20px' }}>
          {SHORTCUTS.map((s, i) => {
            if (s.section) return (
              <div
                key={i}
                style={{
                  fontFamily: D.sans, fontSize: 9, fontWeight: 600,
                  color: D.goldDark,
                  textTransform: 'uppercase', letterSpacing: '0.24em',
                  marginTop: i > 0 ? 20 : 10,
                  marginBottom: 10,
                  paddingBottom: 6,
                  borderBottom: `1px solid ${D.border}`,
                }}
              >
                {s.section}
              </div>
            );
            return (
              <div
                key={i}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 0',
                }}
              >
                <span style={{ fontSize: 13, color: D.ink, fontFamily: D.sans }}>
                  {s.desc}
                </span>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  {s.keys.map((k, ki) => (
                    <React.Fragment key={ki}>
                      {ki > 0 && (
                        <span style={{
                          fontSize: 9, color: D.inkLight, alignSelf: 'center',
                          textTransform: 'uppercase', letterSpacing: '0.12em', padding: '0 4px',
                        }}>or</span>
                      )}
                      <kbd style={{
                        background: D.card,
                        border: `1px solid ${D.border}`,
                        borderBottom: `2px solid ${D.inkHair}`,
                        padding: '3px 9px',
                        fontSize: 11,
                        fontFamily: "ui-monospace, 'DM Mono', Menlo, monospace",
                        color: D.ink,
                        whiteSpace: 'nowrap',
                        fontWeight: 500,
                      }}>{k}</kbd>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 28px',
          borderTop: `1px solid ${D.border}`,
          background: D.bg,
          flexShrink: 0,
        }}>
          <div className="couture-smallcaps" style={{
            fontSize: 9, color: D.inkLight, textAlign: 'center',
            letterSpacing: '0.22em',
          }}>
            Shortcuts work when no input is focused
          </div>
        </div>
      </div>
    </div>
  );
}
