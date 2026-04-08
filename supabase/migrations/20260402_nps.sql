create table if not exists nps_responses (
  id uuid primary key default gen_random_uuid(),
  boutique_id uuid references boutiques(id) on delete cascade not null,
  client_id uuid references clients(id) on delete cascade,
  event_id uuid references events(id) on delete set null,
  score int check (score between 0 and 10),
  comment text,
  submitted_at timestamptz default now(),
  source text default 'manual' check (source in ('manual','auto','portal'))
);
alter table nps_responses enable row level security;
do $$ begin
  create policy "boutique members" on nps_responses for all using (boutique_id = my_boutique_id());
exception when duplicate_object then null; end $$;
create index if not exists nps_responses_boutique_id_idx on nps_responses(boutique_id);
