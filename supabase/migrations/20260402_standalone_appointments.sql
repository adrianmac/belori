-- Add client_name and client_phone to appointments for walk-ins / no-event bookings
alter table appointments add column if not exists client_name text;
alter table appointments add column if not exists client_phone text;
alter table appointments add column if not exists client_id uuid references clients(id) on delete set null;
-- event_id should already be nullable — ensure it is
alter table appointments alter column event_id drop not null;
