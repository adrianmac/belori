-- Staff availability/shifts
create table if not exists staff_availability (
  id uuid primary key default gen_random_uuid(),
  boutique_id uuid references boutiques(id) on delete cascade not null,
  staff_id uuid references boutique_members(user_id) on delete cascade,
  day_of_week int check (day_of_week between 0 and 6), -- 0=Sun
  start_time time,
  end_time time,
  available boolean default true,
  created_at timestamptz default now()
);
alter table staff_availability enable row level security;
do $$ begin
  create policy "boutique members" on staff_availability for all using (boutique_id = my_boutique_id());
exception when duplicate_object then null; end $$;

-- Commission settings per staff member
alter table boutique_members add column if not exists commission_pct numeric(5,2) default 0;
alter table boutique_members add column if not exists commission_type text default 'none' check (commission_type in ('none','percent','flat'));
alter table boutique_members add column if not exists commission_flat numeric(10,2) default 0;
