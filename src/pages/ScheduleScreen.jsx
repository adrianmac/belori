import React, { useState } from 'react'
import { C } from '../lib/colors'
import { Topbar } from '../lib/ui.jsx'
import AppointmentsScreen from './AppointmentsScreen'
import Calendar from './Calendar'
import StaffCalendar from './StaffCalendar'

const TABS = [
  { id: 'day',      label: 'Appointments', labelEs: 'Citas' },
  { id: 'calendar', label: 'Calendar',     labelEs: 'Calendario' },
  { id: 'staff',    label: 'Staff',        labelEs: 'Personal' },
]

export default function ScheduleScreen({ setScreen, setSelectedEvent, events = [], staff = [], clients = [] }) {
  const [activeTab, setActiveTab] = useState('day')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Unified topbar */}
      <Topbar title="Schedule / Horario" />

      {/* Tab strip */}
      <div style={{
        display: 'flex', gap: 4, padding: '10px 16px',
        borderBottom: `1px solid ${C.border}`,
        background: C.white, flexShrink: 0,
      }}>
        {TABS.map(tab => {
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '6px 16px',
                borderRadius: 20,
                border: 'none',
                cursor: 'pointer',
                fontWeight: active ? 600 : 400,
                fontSize: 13,
                background: active ? C.rosaText : C.grayBg,
                color: active ? C.white : C.gray,
                transition: 'all 0.15s ease',
              }}
            >
              {tab.label}
              <span style={{ display: 'block', fontSize: 10, fontWeight: 400, opacity: 0.75, lineHeight: 1 }}>
                {tab.labelEs}
              </span>
            </button>
          )
        })}
      </div>

      {/* Active tab content */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {activeTab === 'day' && (
          <AppointmentsScreen setScreen={setScreen} setSelectedEvent={setSelectedEvent} hideTopbar />
        )}
        {activeTab === 'calendar' && (
          <Calendar
            events={events}
            staff={staff}
            clients={clients}
            setScreen={setScreen}
            setSelectedEvent={setSelectedEvent}
            hideTopbar
          />
        )}
        {activeTab === 'staff' && (
          <StaffCalendar hideTopbar />
        )}
      </div>
    </div>
  )
}
