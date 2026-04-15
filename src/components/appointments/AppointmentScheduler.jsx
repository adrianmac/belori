import React, { useState, useEffect } from 'react';
import { C } from '../../lib/colors';
import { PrimaryBtn, GhostBtn, inputSt, LBL, useToast } from '../../lib/ui.jsx';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import {
  APPOINTMENT_TYPES,
  getSuggestedDate,
  toDateStr,
  isValidConsultationDay,
  formatApptDateTime,
} from '../../lib/appointmentRules';
import ClientPhoneLookup from '../clients/ClientPhoneLookup';

// ─── TYPE STEP ────────────────────────────────────────────────────────────────

function TypeStep({ onSelect }) {
  const [hovered, setHovered] = useState(null);

  return (
    <div>
      <p style={{ fontSize: 13, color: C.gray, marginTop: 0, marginBottom: 16 }}>
        What kind of appointment would you like to schedule?
        <br />
        <span style={{ fontSize: 11 }}>¿Qué tipo de cita desea programar?</span>
      </p>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 12,
      }}>
        {Object.entries(APPOINTMENT_TYPES).map(([key, cfg]) => {
          const isHov = hovered === key;
          return (
            <button
              key={key}
              onClick={() => onSelect(key)}
              onMouseEnter={() => setHovered(key)}
              onMouseLeave={() => setHovered(null)}
              style={{
                background: isHov ? cfg.bgColor : C.white,
                border: `2px solid ${isHov ? cfg.color : C.border}`,
                borderRadius: 12,
                padding: '16px 14px',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.18s cubic-bezier(0.16,1,0.3,1)',
                transform: isHov ? 'scale(1.02)' : 'scale(1)',
                boxShadow: isHov ? `0 4px 16px ${cfg.color}28` : 'none',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              {/* Icon bubble */}
              <div style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: cfg.bgColor,
                border: `1px solid ${cfg.color}40`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.4rem',
                marginBottom: 4,
              }}>
                {cfg.icon}
              </div>

              {/* Label EN */}
              <div style={{ fontWeight: 700, fontSize: 13, color: C.ink, lineHeight: 1.3 }}>
                {cfg.label}
              </div>

              {/* Label ES */}
              <div style={{ fontSize: 11, color: C.gray, lineHeight: 1.3 }}>
                {cfg.labelEs}
              </div>

              {/* Rule hint */}
              <div style={{
                fontSize: 10,
                color: cfg.color,
                fontStyle: 'italic',
                marginTop: 2,
                lineHeight: 1.4,
              }}>
                {key === 'consultation'
                  ? `Available ${cfg.allowedDaysLabel} / Disponible ${cfg.allowedDaysLabelEs}`
                  : `${cfg.ruleLabel} / ${cfg.ruleLabelEs}`}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── DATE/TIME STEP ───────────────────────────────────────────────────────────

function DateTimeStep({
  selectedType, dateStr, setDateStr,
  timeStr, setTimeStr, duration, setDuration,
  staffId, setStaffId, staffList,
  note, setNote,
  err, setErr,
}) {
  const cfg = APPOINTMENT_TYPES[selectedType];
  const isConsultation = selectedType === 'consultation';

  function handleDateChange(val) {
    setDateStr(val);
    if (isConsultation && val) {
      if (!isValidConsultationDay(val)) {
        setErr('Consultations are available Tuesday, Thursday, and Saturday only / Las consultas están disponibles solo martes, jueves y sábado');
      } else {
        setErr('');
      }
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Type badge row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 14px',
        background: cfg.bgColor,
        borderRadius: 10,
        border: `1px solid ${cfg.color}30`,
      }}>
        <span style={{ fontSize: '1.3rem' }}>{cfg.icon}</span>
        <div>
          <div style={{ fontWeight: 600, fontSize: 13, color: C.ink }}>{cfg.label}</div>
          <div style={{ fontSize: 11, color: C.gray }}>{cfg.labelEs}</div>
        </div>
      </div>

      {/* Rule hint for consultation */}
      {isConsultation && (
        <div style={{
          fontSize: 12,
          color: cfg.color,
          background: cfg.bgColor,
          border: `1px solid ${cfg.color}30`,
          borderRadius: 8,
          padding: '8px 12px',
          fontStyle: 'italic',
        }}>
          Pick a Tuesday, Thursday, or Saturday
          <br />
          <span style={{ fontSize: 11 }}>Elija un martes, jueves o sábado</span>
        </div>
      )}

      {/* Rule hint for other types */}
      {!isConsultation && cfg.ruleLabel && (
        <div style={{
          fontSize: 12,
          color: cfg.color,
          background: cfg.bgColor,
          border: `1px solid ${cfg.color}30`,
          borderRadius: 8,
          padding: '8px 12px',
        }}>
          <span style={{ fontWeight: 500 }}>Suggested: </span>{cfg.ruleLabel}
          <br />
          <span style={{ fontSize: 11, fontStyle: 'italic' }}>{cfg.ruleLabelEs}</span>
        </div>
      )}

      {/* Date + Time row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label htmlFor="asch-date" style={LBL}>Date / Fecha</label>
          <input
            id="asch-date"
            type="date"
            value={dateStr}
            onChange={e => handleDateChange(e.target.value)}
            style={{
              ...inputSt,
              borderColor: err ? C.red : C.border,
            }}
          />
        </div>
        <div>
          <label htmlFor="asch-time" style={LBL}>Time / Hora</label>
          <input
            id="asch-time"
            type="time"
            value={timeStr}
            onChange={e => setTimeStr(e.target.value)}
            style={inputSt}
          />
        </div>
      </div>

      {/* Inline validation error */}
      {err && (
        <div style={{
          fontSize: 12,
          color: C.red,
          background: C.redBg,
          border: `1px solid #FECACA`,
          borderRadius: 8,
          padding: '8px 12px',
          lineHeight: 1.5,
        }}>
          {err}
        </div>
      )}

      {/* Duration + Staff row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label htmlFor="asch-duration" style={LBL}>Duration (min) / Duración</label>
          <input
            id="asch-duration"
            type="number"
            min={5}
            max={480}
            value={duration}
            onChange={e => setDuration(Number(e.target.value))}
            style={inputSt}
          />
        </div>
        <div>
          <label htmlFor="asch-staff" style={LBL}>Staff / Personal</label>
          <select
            id="asch-staff"
            value={staffId}
            onChange={e => setStaffId(e.target.value)}
            style={{ ...inputSt, appearance: 'auto' }}
          >
            <option value="">— Unassigned —</option>
            {staffList.map(s => (
              <option key={s.user_id} value={s.user_id}>
                {s.name || s.initials || s.user_id}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="asch-note" style={LBL}>Notes (optional) / Notas</label>
        <textarea
          id="asch-note"
          value={note}
          onChange={e => setNote(e.target.value)}
          rows={3}
          placeholder="Any special notes for this appointment…"
          style={{ ...inputSt, resize: 'vertical', lineHeight: 1.5 }}
        />
      </div>
    </div>
  );
}

// ─── CONFIRM STEP ─────────────────────────────────────────────────────────────

function ConfirmStep({ selectedType, dateStr, timeStr, duration, staffId, staffList, note }) {
  const cfg = APPOINTMENT_TYPES[selectedType];
  const staffMember = staffList.find(s => s.user_id === staffId);

  const detailRow = (label, value) => value ? (
    <div style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: `1px solid ${C.border}` }}>
      <div style={{ width: 110, fontSize: 12, color: C.gray, flexShrink: 0 }}>{label}</div>
      <div style={{ fontSize: 13, color: C.ink, fontWeight: 500 }}>{value}</div>
    </div>
  ) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p style={{ margin: 0, fontSize: 13, color: C.gray }}>
        Review the appointment details before saving.
        <br />
        <span style={{ fontSize: 11 }}>Revise los detalles antes de guardar.</span>
      </p>

      {/* Summary card */}
      <div style={{
        background: cfg.bgColor,
        border: `1px solid ${cfg.color}40`,
        borderRadius: 12,
        padding: '16px 18px',
      }}>
        {/* Type header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 14,
          paddingBottom: 12,
          borderBottom: `1px solid ${cfg.color}25`,
        }}>
          <div style={{
            width: 42,
            height: 42,
            borderRadius: 10,
            background: C.white,
            border: `1px solid ${cfg.color}40`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.3rem',
            flexShrink: 0,
          }}>
            {cfg.icon}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: C.ink }}>{cfg.label}</div>
            <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>{cfg.labelEs}</div>
          </div>
        </div>

        {/* Detail rows */}
        <div>
          {detailRow('Date / Fecha', formatApptDateTime(dateStr, timeStr))}
          {detailRow('Duration', `${duration} minutes`)}
          {staffMember && detailRow('Staff / Personal', staffMember.name || staffMember.initials)}
          {note && detailRow('Notes / Notas', note)}
        </div>
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function AppointmentScheduler({ eventId, clientId, eventDate, onSave, onClose }) {
  const { boutique } = useAuth();
  const toast = useToast();

  // If clientId is pre-provided (from EventDetail), skip the lookup step (step 0)
  const hasPreloadedClient = Boolean(clientId);
  const [step, setStep] = useState(hasPreloadedClient ? 1 : 0);
  const [resolvedClient, setResolvedClient] = useState(null);
  const [selectedType, setSelectedType] = useState(null);
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('10:00');
  const [duration, setDuration] = useState(60);
  const [staffId, setStaffId] = useState('');
  const [staffList, setStaffList] = useState([]);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  // Load boutique staff on mount
  useEffect(() => {
    if (boutique?.id) loadStaff();
  }, [boutique?.id]);

  async function loadStaff() {
    const { data } = await supabase
      .from('boutique_members')
      .select('user_id, name, initials, color, role')
      .eq('boutique_id', boutique.id)
      .order('name');
    if (data) setStaffList(data);
  }

  // Step 0: client lookup resolved
  function handleClientSelected(client) {
    setResolvedClient(client);
    setStep(1);
  }

  // When a type is selected: pre-fill date/time/duration and advance to step 2
  function selectType(typeKey) {
    const cfg = APPOINTMENT_TYPES[typeKey];
    setSelectedType(typeKey);
    setDuration(cfg.duration);
    setTimeStr(cfg.defaultTime || '10:00');

    const suggested = getSuggestedDate(eventDate, typeKey);
    setDateStr(suggested ? toDateStr(suggested) : '');

    setErr('');
    setStep(2);
  }

  function back() {
    setStep(s => s - 1);
    setErr('');
  }

  function advanceToConfirm() {
    // Validate consultation day before proceeding
    if (selectedType === 'consultation' && dateStr && !isValidConsultationDay(dateStr)) {
      setErr('Consultations are available Tuesday, Thursday, and Saturday only / Las consultas están disponibles solo martes, jueves y sábado');
      return;
    }
    if (!dateStr) {
      setErr('Please select a date / Por favor seleccione una fecha');
      return;
    }
    setErr('');
    setStep(3);
  }

  async function save() {
    setSaving(true);
    setErr('');
    try {
      const { data, error } = await supabase
        .from('appointments')
        .insert({
          boutique_id: boutique.id,
          event_id: eventId || null,
          client_id: resolvedClient?.id || clientId || null,
          type: selectedType,
          date: dateStr,
          time: timeStr || null,
          duration_minutes: duration,
          status: 'scheduled',
          staff_id: staffId || null,
          note: note || null,
        })
        .select()
        .single();

      if (error) throw error;

      toast('Appointment scheduled');
      onSave(data);
    } catch (e) {
      setErr(e.message || 'Failed to save appointment');
      setSaving(false);
    }
  }

  // Keyboard: Escape to close
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Steps differ based on whether we needed client lookup
  // With lookup: 0 = Find client, 1 = Type, 2 = Date & time, 3 = Confirm
  // Without lookup: 1 = Type, 2 = Date & time, 3 = Confirm
  const totalSteps = hasPreloadedClient ? 3 : 4;
  // Visual step number for display (1-based, excluding step 0 from count when pre-loaded)
  const displayStep = hasPreloadedClient ? step : step + 1;

  const breadcrumbSteps = hasPreloadedClient
    ? [
        { n: 1, label: 'Type' },
        { n: 2, label: 'Date & time' },
        { n: 3, label: 'Confirm' },
      ]
    : [
        { n: 0, label: 'Find client / Buscar cliente' },
        { n: 1, label: 'Type' },
        { n: 2, label: 'Date & time' },
        { n: 3, label: 'Confirm' },
      ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.48)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 16,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="appt-scheduler-title"
        style={{
          background: C.white,
          borderRadius: 16,
          width: 520,
          maxWidth: '100%',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
          overflow: 'hidden',
        }}
      >
        {/* ── Header ── */}
        <div style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${C.border}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        }}>
          <div>
            <span id="appt-scheduler-title" style={{ fontWeight: 700, fontSize: 15, color: C.ink }}>
              Schedule appointment
            </span>
            <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>
              Programar cita
            </div>
          </div>

          {/* Step indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {breadcrumbSteps.map(({ n }) => (
                <div
                  key={n}
                  style={{
                    width: n === step ? 20 : 8,
                    height: 8,
                    borderRadius: 4,
                    background: n <= step ? C.rosaSolid : C.border,
                    transition: 'all 0.25s ease',
                  }}
                />
              ))}
            </div>
            <div style={{ fontSize: 11, color: C.gray, whiteSpace: 'nowrap' }}>
              {displayStep} / {totalSteps}
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                background: 'none',
                border: 'none',
                fontSize: 20,
                cursor: 'pointer',
                color: C.gray,
                padding: '0 4px',
                lineHeight: 1,
                marginLeft: 4,
              }}
            >
              ×
            </button>
          </div>
        </div>

        {/* ── Step breadcrumb ── */}
        <div style={{
          padding: '8px 20px',
          background: C.grayBg,
          borderBottom: `1px solid ${C.border}`,
          flexShrink: 0,
          display: 'flex',
          gap: 0,
          overflow: 'hidden',
        }}>
          {breadcrumbSteps.map(({ n, label }, i) => (
            <React.Fragment key={n}>
              {i > 0 && (
                <span style={{ fontSize: 11, color: C.border, padding: '0 6px', alignSelf: 'center' }}>›</span>
              )}
              <span style={{
                fontSize: 11,
                fontWeight: n === step ? 600 : 400,
                color: n < step ? C.rosaText : n === step ? C.ink : C.gray,
              }}>
                {label}
              </span>
            </React.Fragment>
          ))}
        </div>

        {/* ── Body ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {step === 0 && (
            <div>
              <p style={{ margin: '0 0 16px', fontSize: 13, color: C.gray }}>
                Search by phone number to find or create a client profile.
                <br />
                <span style={{ fontSize: 11 }}>Busca por número de teléfono para encontrar o crear un perfil de cliente.</span>
              </p>
              <ClientPhoneLookup
                onClientSelected={handleClientSelected}
                boutiqueId={boutique?.id}
              />
            </div>
          )}
          {step === 1 && (
            <TypeStep onSelect={selectType} />
          )}
          {step === 2 && selectedType && (
            <DateTimeStep
              selectedType={selectedType}
              dateStr={dateStr}
              setDateStr={setDateStr}
              timeStr={timeStr}
              setTimeStr={setTimeStr}
              duration={duration}
              setDuration={setDuration}
              staffId={staffId}
              setStaffId={setStaffId}
              staffList={staffList}
              note={note}
              setNote={setNote}
              err={err}
              setErr={setErr}
            />
          )}
          {step === 3 && selectedType && (
            <ConfirmStep
              selectedType={selectedType}
              dateStr={dateStr}
              timeStr={timeStr}
              duration={duration}
              staffId={staffId}
              staffList={staffList}
              note={note}
            />
          )}

          {/* Global error at bottom of body (for save failures) */}
          {step === 3 && err && (
            <div style={{
              marginTop: 12,
              fontSize: 12,
              color: C.red,
              background: C.redBg,
              border: `1px solid #FECACA`,
              borderRadius: 8,
              padding: '8px 12px',
            }}>
              {err}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{
          padding: '12px 20px',
          borderTop: `1px solid ${C.border}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
          gap: 8,
        }}>
          {step > (hasPreloadedClient ? 1 : 0)
            ? <GhostBtn label="← Back" onClick={back} />
            : <GhostBtn label="Cancel" onClick={onClose} />
          }

          <div style={{ display: 'flex', gap: 8 }}>
            {step === 2 && (
              <PrimaryBtn
                label="Review →"
                onClick={advanceToConfirm}
              />
            )}
            {step === 3 && (
              <PrimaryBtn
                label={saving ? 'Saving…' : 'Schedule appointment'}
                onClick={save}
                disabled={saving}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
