-- Add unique constraint to staff_availability so upserts work cleanly
alter table staff_availability
  add constraint if not exists staff_availability_boutique_staff_day_key
  unique (boutique_id, staff_id, day_of_week);

-- Block-out dates (time off, holidays, etc.)
create table if not exists staff_blockouts (
  id uuid primary key default gen_random_uuid(),
  boutique_id uuid references boutiques(id) on delete cascade not null,
  user_id uuid not null,
  start_date date not null,
  end_date date not null,
  reason text,
  created_at timestamptz default now()
);

alter table staff_blockouts enable row level security;
do $$ begin
  create policy "boutique members" on staff_blockouts
    for all using (boutique_id = my_boutique_id());
exception when duplicate_object then null; end $$;
