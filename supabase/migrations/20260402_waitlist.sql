create table if not exists waitlist (
  id uuid primary key default gen_random_uuid(),
  boutique_id uuid references boutiques(id) on delete cascade not null,
  name text not null,
  phone text,
  email text,
  event_type text,
  preferred_date date,
  flexible_dates boolean default false,
  notes text,
  status text not null default 'waiting' check (status in ('waiting','contacted','booked','removed')),
  source text default 'manual' check (source in ('manual','booking_form','phone')),
  created_at timestamptz default now(),
  contacted_at timestamptz,
  converted_event_id uuid references events(id) on delete set null
);
create index if not exists waitlist_boutique_id_idx on waitlist(boutique_id);
alter table waitlist enable row level security;
do $$ begin
  create policy "boutique members" on waitlist for all using (boutique_id = my_boutique_id());
exception when duplicate_object then null;
end $$;
