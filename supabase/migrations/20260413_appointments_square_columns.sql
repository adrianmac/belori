-- Add Square workflow columns to existing appointments table
alter table appointments add column if not exists duration_minutes integer default 60;
alter table appointments add column if not exists cancellation_reason text;
alter table appointments add column if not exists cancelled_at timestamptz;
alter table appointments add column if not exists completed_at timestamptz;
alter table appointments add column if not exists actual_return_at timestamptz;
alter table appointments add column if not exists condition_notes text;
alter table appointments add column if not exists updated_at timestamptz default now();

comment on column appointments.duration_minutes is 'Length of appointment in minutes';
comment on column appointments.actual_return_at is 'For return appointments: when the dress was actually returned';
comment on column appointments.condition_notes is 'For return appointments: condition of returned dress';
