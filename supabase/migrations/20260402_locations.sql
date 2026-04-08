-- Locations table for multi-location boutiques
create table if not exists boutique_locations (
  id uuid primary key default gen_random_uuid(),
  boutique_id uuid references boutiques(id) on delete cascade not null,
  name text not null,
  address text,
  phone text,
  email text,
  is_primary boolean default false,
  active boolean default true,
  timezone text default 'America/Chicago',
  created_at timestamptz default now()
);
create index if not exists boutique_locations_boutique_id_idx on boutique_locations(boutique_id);
alter table boutique_locations enable row level security;
do $$ begin
  create policy "boutique members" on boutique_locations for all using (boutique_id = my_boutique_id());
exception when duplicate_object then null; end $$;

-- Add location_id to key tables (nullable for backward compatibility)
alter table events add column if not exists location_id uuid references boutique_locations(id) on delete set null;
alter table appointments add column if not exists location_id uuid references boutique_locations(id) on delete set null;
alter table boutique_members add column if not exists primary_location_id uuid references boutique_locations(id) on delete set null;
