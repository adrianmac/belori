import React, { useState, useEffect } from 'react';
import { C } from '../lib/colors';
import { useModules } from '../hooks/useModules.jsx';

const ALL_ACTIONS = [
  {
    key: 'rental',
    label: 'New Rental',
    icon: '👗',
    bg: '#7C3AED',
    bgPale: '#EDE9FE',
    event: 'belori:new-rental',
    screen: 'dress_rentals',
    delay: 150,
    module: 'dress_rental',
  },
  {
    key: 'event',
    label: 'New Event',
    icon: '📅',
    bg: C.rosa,
    bgPale: C.rosaPale,
    event: 'belori:new-event',
    screen: 'events',
    delay: 100,
    module: null, // always visible
  },
  {
    key: 'alteration',
    label: 'New Alteration',
    icon: '✂️',
    bg: '#0D9488',
    bgPale: '#CCFBF1',
    event: 'belori:new-alteration',
    screen: 'alterations',
    delay: 50,
    module: 'alterations',
  },
  {
    key: 'client',
    label: 'New Client',
    icon: '👤',
    bg: '#2563EB',
    bgPale: '#DBEAFE',
    event: 'belori:new-client',
    screen: 'clients',
    delay: 25,
    module: null, // always visible
  },
  {
    key: 'appointment',
    label: 'New Appointment',
    icon: '🗓️',
    bg: '#D97706',
    bgPale: '#FEF3C7',
    event: null,
    screen: 'staff_calendar',
    delay: 0,
    module: null, // always visible
  },
];

export default function QuickActionFAB({ setScreen }) {
  const { isEnabled } = useModules();
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // Stagger visibility on open
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => setVisible(true), 10);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
    }
  }, [open]);

  // Filter actions by module availability
  const actions = ALL_ACTIONS.filter(a => a.module === null || isEnabled(a.module));

  const handleAction = (action) => {
    setScreen(action.screen);
    if (action.event) window.dispatchEvent(new CustomEvent(action.event));
    setOpen(false);
  };

  // Detect mobile (bottom nav present at <768px)
  const fabBottom = isMobile ? 88 : 28;

  const fabStyle = {
    position: 'fixed',
    bottom: fabBottom,
    right: 20,
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 10,
  };

  return (
    <>
      {/* Backdrop — closes FAB on outside click */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999,
            background: 'transparent',
          }}
        />
      )}

      <div style={fabStyle}>
        {/* Action buttons — fan out above FAB */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 10,
          pointerEvents: open ? 'auto' : 'none',
        }}>
          {actions.map((action) => (
            <div
              key={action.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(16px)',
                transition: `opacity 0.22s ease ${action.delay}ms, transform 0.22s ease ${action.delay}ms`,
              }}
            >
              {/* Label pill */}
              <div style={{
                background: C.white,
                color: C.ink,
                fontSize: 12,
                fontWeight: 600,
                padding: '5px 12px',
                borderRadius: 20,
                boxShadow: '0 2px 10px rgba(0,0,0,0.12)',
                whiteSpace: 'nowrap',
                userSelect: 'none',
              }}>
                {action.label}
              </div>

              {/* Action circle */}
              <button
                onClick={(e) => { e.stopPropagation(); handleAction(action); }}
                title={action.label}
                aria-label={action.label}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  background: action.bg,
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                  boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
                  flexShrink: 0,
                  transition: 'transform 0.15s, box-shadow 0.15s',
                  color: C.white,
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.24)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.18)'; }}
              >
                {action.icon}
              </button>
            </div>
          ))}
        </div>

        {/* Main FAB button */}
        <button
          onClick={() => setOpen(o => !o)}
          title="Quick actions"
          aria-label="Quick actions"
          aria-expanded={open}
          aria-haspopup="menu"
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #E88A97 0%, #C9697A 60%, #B05068 100%)',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 18px rgba(201,105,122,0.45)',
            zIndex: 1001,
            transition: 'transform 0.15s, box-shadow 0.15s',
            flexShrink: 0,
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(201,105,122,0.55)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 18px rgba(201,105,122,0.45)'; }}
        >
          <span style={{
            display: 'block',
            fontSize: 26,
            fontWeight: 300,
            color: C.white,
            lineHeight: 1,
            transform: open ? 'rotate(45deg)' : 'rotate(0deg)',
            transition: 'transform 0.22s ease',
            userSelect: 'none',
          }}>+</span>
        </button>
      </div>

    </>
  );
}
