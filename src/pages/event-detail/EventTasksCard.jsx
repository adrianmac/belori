import React, { useState } from 'react';
import { C } from '../../lib/colors';
import { Card, Badge, Avatar, useToast } from '../../lib/ui.jsx';
import { useTaskTemplates } from '../../hooks/useTaskTemplates';
import { supabase } from '../../lib/supabase';
import { useRequiresPlan } from '../../components/UpgradeGate';

const TASK_CAT_COLORS = {
  Planning: { bg: C.purpleBg, col: C.purple },
  Vendor: { bg: C.blueBg, col: C.blue },
  Payment: { bg: '#DCFCE7', col: '#166534' },
  General: { bg: C.grayBg, col: C.gray }
};

const EventTasksCard = ({
  tasks,
  setShowAddTask,
  toggleTask,
  addTask,
  ev,
  staff = [],
}) => {
  const { templates } = useTaskTemplates();
  const toast = useToast();
  const hasPro = useRequiresPlan('pro');
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [applying, setApplying] = useState(false);

  // AI task suggestions
  const [aiTasks, setAiTasks] = useState([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiChecked, setAiChecked] = useState({});
  const [aiError, setAiError] = useState(null);
  const [addingAi, setAddingAi] = useState(false);

  async function getAISuggestions() {
    if (!hasPro) {
      document.dispatchEvent(new CustomEvent('belori:show-upgrade', { detail: { feature: 'AI Task Suggestions', minPlan: 'pro' } }));
      return;
    }
    setAiLoading(true);
    setAiError(null);
    setAiTasks([]);
    try {
      const { data, error } = await supabase.functions.invoke('ai-suggest', {
        body: {
          type: 'task_suggestions',
          eventType: ev.type,
          clientName: ev.client,
          eventDate: ev.event_date,
          venue: ev.venue,
          services: ev.services,
          guests: ev.guests,
        },
      });
      if (error) {
        setAiError('AI features require setup');
        return;
      }
      if (data?.error === 'AI not configured') {
        setAiError('AI features require setup — add ANTHROPIC_API_KEY to Supabase secrets.');
        return;
      }
      if (data?.result) {
        try {
          // Strip markdown code fences if present
          const raw = data.result.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setAiTasks(parsed);
            const initial = {};
            parsed.forEach((_, i) => { initial[i] = true; });
            setAiChecked(initial);
          } else {
            setAiError('AI returned unexpected format. Try again.');
          }
        } catch {
          setAiError('AI returned unexpected format. Try again.');
        }
      }
    } catch {
      setAiError('Could not reach AI service. Check your connection.');
    } finally {
      setAiLoading(false);
    }
  }

  async function addCheckedAiTasks() {
    if (!addTask) return;
    setAddingAi(true);
    const toAdd = aiTasks.filter((_, i) => aiChecked[i]);
    for (const t of toAdd) {
      await addTask({ text: t.text, category: t.category || 'General', alert: t.alert || false });
    }
    setAddingAi(false);
    setAiTasks([]);
    setAiChecked({});
    toast(`Added ${toAdd.length} AI-suggested task${toAdd.length !== 1 ? 's' : ''}`);
  }

  // Filter templates compatible with this event type
  const compatibleTemplates = templates.filter(
    t => t.event_type === null || t.event_type === undefined || t.event_type === '' || t.event_type === (ev && ev.type)
  );

  const applyTemplate = async (tmpl) => {
    if (!addTask) return;
    setApplying(true);
    setShowTemplatePicker(false);
    const taskList = tmpl.tasks || [];
    for (const t of taskList) {
      await addTask({ text: t.text, category: t.category || 'General', priority: t.is_alert ? 'Alert (urgent)' : 'Normal' });
    }
    setApplying(false);
    toast(`Applied "${tmpl.name}" — ${taskList.length} task${taskList.length !== 1 ? 's' : ''} added`);
  };

  return (
    <Card>
      <div className="card-header">
        <div className="card-header-title">
          <span>☰ Event tasks</span>
          <span style={{fontSize:11,color:C.gray,fontWeight:400}}>
            {tasks.filter(t=>t.done).length} of {tasks.length} done
            {tasks.filter(t=>t.alert&&!t.done).length>0?` · ${tasks.filter(t=>t.alert&&!t.done).length} urgent`:''}
          </span>
        </div>
        <div style={{display:'flex',gap:6,alignItems:'center',position:'relative'}}>
          {addTask && (
            <button
              onClick={getAISuggestions}
              disabled={aiLoading}
              style={{padding:'4px 10px',borderRadius:7,border:`1px solid ${C.border}`,background:aiTasks.length>0?C.rosaPale:C.white,color:aiTasks.length>0?C.rosa:C.gray,fontSize:11,fontWeight:500,cursor:'pointer',whiteSpace:'nowrap'}}>
              {aiLoading ? '✨ Thinking…' : '✨ AI suggest'}
            </button>
          )}
          {addTask && compatibleTemplates.length > 0 && (
            <div style={{position:'relative'}}>
              <button
                onClick={() => setShowTemplatePicker(p => !p)}
                disabled={applying}
                style={{padding:'4px 10px',borderRadius:7,border:`1px solid ${C.border}`,background:showTemplatePicker?C.rosaPale:C.white,color:showTemplatePicker?C.rosa:C.gray,fontSize:11,fontWeight:500,cursor:'pointer',whiteSpace:'nowrap'}}>
                {applying ? 'Applying…' : '📋 Apply template'}
              </button>
              {showTemplatePicker && (
                <div style={{position:'absolute',top:'calc(100% + 4px)',right:0,background:C.white,border:`1px solid ${C.border}`,borderRadius:10,boxShadow:'0 4px 16px rgba(0,0,0,0.10)',zIndex:200,minWidth:220,overflow:'hidden'}}>
                  <div style={{padding:'8px 12px 6px',fontSize:10,fontWeight:600,color:C.gray,letterSpacing:'0.06em',textTransform:'uppercase',borderBottom:`1px solid ${C.border}`}}>
                    Choose a template
                  </div>
                  {compatibleTemplates.map(tmpl => (
                    <button
                      key={tmpl.id}
                      onClick={() => applyTemplate(tmpl)}
                      style={{display:'block',width:'100%',textAlign:'left',padding:'9px 12px',background:'none',border:'none',cursor:'pointer',fontSize:12,color:C.ink,borderBottom:`1px solid ${C.border}`}}
                      onMouseEnter={e => e.currentTarget.style.background = C.grayBg}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                      <div style={{fontWeight:500}}>{tmpl.name}</div>
                      <div style={{fontSize:11,color:C.gray,marginTop:1}}>
                        {(tmpl.tasks||[]).length} task{(tmpl.tasks||[]).length !== 1 ? 's' : ''}
                        {tmpl.event_type ? ` · ${tmpl.event_type}` : ''}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <button onClick={() => setShowAddTask(true)} className="card-header-action">+ Add task</button>
        </div>
      </div>

      {/* Close picker on outside click */}
      {showTemplatePicker && (
        <div
          onClick={() => setShowTemplatePicker(false)}
          style={{position:'fixed',inset:0,zIndex:199}}
        />
      )}

      {tasks.length > 0 ? tasks.map((t, i) => {
        const today = new Date().toISOString().slice(0,10);
        const isOverdue = !t.done && t.due_date && t.due_date < today;
        const isDueToday = !t.done && t.due_date && t.due_date === today;
        const assignedMember = t.assigned_to_id ? staff.find(s => s.id === t.assigned_to_id) : null;
        const assignedInitials = assignedMember?.initials || (t.assigned_to_name ? t.assigned_to_name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() : null);
        const assignedColor = assignedMember?.color || C.rosa;
        return (
        <div key={t.id || i} onClick={() => toggleTask(i)} style={{display:'flex',alignItems:'flex-start',gap:10,padding:'9px 16px',borderBottom:i<tasks.length-1?`1px solid ${C.border}`:'none',cursor:'pointer',background:t.alert&&!t.done?'#FEF2F2':undefined}}
          onMouseEnter={e => !t.alert && (e.currentTarget.style.background=C.grayBg)}
          onMouseLeave={e => e.currentTarget.style.background=t.alert&&!t.done?'#FEF2F2':'transparent'}>
          <div style={{width:16,height:16,borderRadius:4,border:`1.5px solid ${t.done?'var(--color-success)':t.alert?'var(--color-danger)':C.border}`,background:t.done?'var(--color-success)':t.alert?'var(--color-danger)':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:1}}>
            {t.done && <svg width="8" height="8" viewBox="0 0 10 10"><path d="M2 5l2.5 2.5L8 2" stroke={C.white} strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:12,color:t.done?C.gray:t.alert?'var(--color-danger)':C.ink,textDecoration:t.done?'line-through':'none',lineHeight:1.45}}>{t.text}</div>
            {(t.due_date || t.done_at) && (
              <div style={{marginTop:3,fontSize:10,color:isOverdue?C.red:isDueToday?C.amber:C.gray}}>
                {t.done && t.done_at
                  ? `Done ${new Date(t.done_at).toLocaleDateString('en-US',{month:'short',day:'numeric'})}${t.done_by_name?` · ${t.done_by_name}`:''}`
                  : t.due_date
                    ? `${isOverdue?'Overdue · ':isDueToday?'Today · ':'Due '}${new Date(t.due_date+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}`
                    : null}
              </div>
            )}
          </div>
          {assignedInitials && <Avatar initials={assignedInitials} size={20} bg={assignedColor} color={C.white} title={t.assigned_to_name||''}/>}
          {t.category && <Badge text={t.category} bg={TASK_CAT_COLORS[t.category]?.bg||C.grayBg} color={TASK_CAT_COLORS[t.category]?.col||C.gray}/>}
        </div>
        );
      }) : <div style={{padding:'20px 16px',textAlign:'center',fontSize:12,color:C.gray}}>No tasks yet.</div>}

      {/* AI error state */}
      {aiError && (
        <div style={{padding:'10px 16px',borderTop:`1px solid ${C.border}`,background:'#FFFBEB',display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
          <span style={{fontSize:12,color:'#92400E'}}>⚠ {aiError}</span>
          <button onClick={() => setAiError(null)} style={{background:'none',border:'none',cursor:'pointer',color:C.gray,fontSize:16,lineHeight:1,padding:0,minHeight:'unset'}}>×</button>
        </div>
      )}

      {/* AI suggested tasks panel */}
      {aiTasks.length > 0 && (
        <div style={{borderTop:`1px solid ${C.border}`,background:'#FDF4FF'}}>
          <div style={{padding:'10px 16px 6px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
            <div style={{fontSize:12,fontWeight:600,color:'#7C3AED'}}>
              ✨ AI suggested tasks for this {ev.type} event
            </div>
            <button onClick={() => { setAiTasks([]); setAiChecked({}); }} style={{background:'none',border:'none',cursor:'pointer',color:C.gray,fontSize:16,lineHeight:1,padding:0,minHeight:'unset'}}>×</button>
          </div>
          {aiTasks.map((t, i) => (
            <div
              key={i}
              onClick={() => setAiChecked(c => ({ ...c, [i]: !c[i] }))}
              style={{display:'flex',alignItems:'flex-start',gap:10,padding:'8px 16px',borderBottom:`1px solid rgba(124,58,237,0.1)`,cursor:'pointer',background:aiChecked[i]?'rgba(124,58,237,0.04)':'transparent'}}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(124,58,237,0.07)'}
              onMouseLeave={e => e.currentTarget.style.background = aiChecked[i] ? 'rgba(124,58,237,0.04)' : 'transparent'}
            >
              <div style={{width:16,height:16,borderRadius:4,border:`1.5px solid ${aiChecked[i]?'#7C3AED':C.borderDark}`,background:aiChecked[i]?'#7C3AED':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:1}}>
                {aiChecked[i] && <svg width="8" height="8" viewBox="0 0 10 10"><path d="M2 5l2.5 2.5L8 2" stroke={C.white} strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>}
              </div>
              <div style={{flex:1,fontSize:12,color:C.ink,lineHeight:1.45}}>{t.text}</div>
              {t.alert && <span style={{fontSize:10,padding:'1px 6px',borderRadius:999,background:'#FEE2E2',color:'#DC2626',fontWeight:500,flexShrink:0}}>Urgent</span>}
              {t.category && (
                <Badge
                  text={t.category}
                  bg={TASK_CAT_COLORS[t.category]?.bg || C.grayBg}
                  color={TASK_CAT_COLORS[t.category]?.col || C.gray}
                />
              )}
            </div>
          ))}
          <div style={{padding:'10px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
            <span style={{fontSize:11,color:'#7C3AED'}}>
              {Object.values(aiChecked).filter(Boolean).length} of {aiTasks.length} selected
            </span>
            <div style={{display:'flex',gap:6}}>
              <button
                onClick={() => { const all = {}; aiTasks.forEach((_, i) => { all[i] = true; }); setAiChecked(all); }}
                style={{padding:'4px 10px',borderRadius:7,border:`1px solid rgba(124,58,237,0.3)`,background:'transparent',color:'#7C3AED',fontSize:11,cursor:'pointer',minHeight:'unset'}}>
                Select all
              </button>
              <button
                onClick={addCheckedAiTasks}
                disabled={addingAi || !Object.values(aiChecked).some(Boolean)}
                style={{padding:'4px 10px',borderRadius:7,border:'none',background:'#7C3AED',color:C.white,fontSize:11,fontWeight:500,cursor:'pointer',minHeight:'unset',opacity:Object.values(aiChecked).some(Boolean)?1:0.4}}>
                {addingAi ? 'Adding…' : '+ Add selected'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};

export default EventTasksCard;
