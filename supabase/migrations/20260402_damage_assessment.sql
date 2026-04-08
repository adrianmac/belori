-- Damage reports table
create table if not exists damage_reports (
  id uuid primary key default gen_random_uuid(),
  boutique_id uuid references boutiques(id) on delete cascade,
  inventory_id uuid references inventory(id) on delete cascade,
  event_id uuid references events(id) on delete set null,
  client_id uuid references clients(id) on delete set null,
  reported_by text,
  severity text default 'minor' check (severity in ('minor','moderate','severe','total_loss')),
  description text,
  repair_cost numeric(10,2),
  deposit_deduction numeric(10,2) default 0,
  photos text[], -- array of photo URLs
  status text default 'open' check (status in ('open','repaired','written_off','disputed')),
  reported_at timestamptz default now(),
  resolved_at timestamptz,
  notes text
);
alter table damage_reports enable row level security;
create policy "boutique members" on damage_reports using (boutique_id = my_boutique_id());
