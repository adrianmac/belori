import React, { useState } from 'react';
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const COLUMNS = [
  { id: 'inquiry', title: 'Inquiry' },
  { id: 'consult', title: 'Consult booked' },
  { id: 'proposal', title: 'Proposal sent' },
  { id: 'contract', title: 'Contract signed' },
  { id: 'won', title: 'Won / Complete' }
];

const STYLES = {
  container: { display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 16, height: '100%', minHeight: 400 },
  column: {
    flex: '0 0 280px',
    background: '#F9FAFB',
    borderRadius: 12,
    border: '1px solid #E5E7EB',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  },
  columnHeader: {
    padding: '12px 16px',
    borderBottom: '1px solid #E5E7EB',
    background: '#F3F4F6',
    fontWeight: 600,
    fontSize: 13,
    color: '#111827',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  card: {
    background: '#FFFFFF',
    padding: 14,
    borderRadius: 8,
    border: '1px solid #E5E7EB',
    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
    marginBottom: 10,
    cursor: 'grab',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    gap: 6
  }
};

const SortableLeadCard = ({ lead }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: lead.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    ...STYLES.card,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{lead.event || 'Unknown Event'}</span>
        <span style={{ padding: '2px 6px', background: '#FEF3C7', color: '#D97706', fontSize: 10, fontWeight: 600, borderRadius: 4 }}>
          {lead.type || 'Wedding'}
        </span>
      </div>
      {(lead.date || lead.value) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6B7280' }}>
          <span>{lead.date || 'TBD'}</span>
          <span style={{ fontWeight: 500, color: '#10B981' }}>{lead.value ? `$${lead.value}` : ''}</span>
        </div>
      )}
      {lead.nextAction && (
        <div style={{ fontSize: 11, color: '#4B5563', background: '#F3F4F6', padding: '6px 8px', borderRadius: 4, marginTop: 4 }}>
          <span style={{ fontWeight: 600, color: '#C9697A' }}>Next:</span> {lead.nextAction}
        </div>
      )}
    </div>
  );
};

const Column = ({ col, leads }) => {
  const colLeads = leads.filter(l => l.stage === col.id);
  return (
    <div style={STYLES.column}>
      <div style={STYLES.columnHeader}>
        {col.title} <span style={{ background: '#E5E7EB', padding: '2px 8px', borderRadius: 10, fontSize: 11 }}>{colLeads.length}</span>
      </div>
      <div style={{ padding: 12, flex: 1, overflowY: 'auto' }}>
        <SortableContext items={colLeads.map(l => l.id)} strategy={horizontalListSortingStrategy}>
          {colLeads.map(lead => (
            <SortableLeadCard key={lead.id} lead={lead} />
          ))}
        </SortableContext>
        {colLeads.length === 0 && (
          <div style={{ padding: 20, textAlign: 'center', color: '#9CA3AF', fontSize: 12 }}>No leads</div>
        )}
      </div>
    </div>
  );
};

export default function PipelineKanban({ initialLeads = [] }) {
  const [leads, setLeads] = useState(initialLeads);
  const [activeId, setActiveId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (event) => {
    setActiveId(event.active.id);
  };

  const handleDragOver = (event) => {
    const { active, over } = event;
    if (!over) return;
    
    // Simplistic handling for moving between columns
    // True dnd-kit kanban requires more complex state updates between lists
    // Here we can rely on handleDragEnd since we just change "stage" property
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    // Is over a column or another card?
    const overId = over.id;
    const isOverColumn = COLUMNS.find(c => c.id === overId);
    
    setLeads(current => {
      const activeIndex = current.findIndex(l => l.id === active.id);
      const newLeads = [...current];
      
      if (isOverColumn) {
        newLeads[activeIndex].stage = overId;
      } else {
        const overIndex = current.findIndex(l => l.id === overId);
        if (overIndex >= 0) {
           newLeads[activeIndex].stage = current[overIndex].stage;
           return arrayMove(newLeads, activeIndex, overIndex);
        }
      }
      return newLeads;
    });
  };

  const activeLead = activeId ? leads.find(l => l.id === activeId) : null;

  return (
    <div style={STYLES.container}>
      <DndContext 
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        {COLUMNS.map(col => (
          <Column key={col.id} col={col} leads={leads} />
        ))}
        
        <DragOverlay>
          {activeLead ? <SortableLeadCard lead={activeLead} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
