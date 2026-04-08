create table if not exists boutique_webhooks (
  id uuid primary key default gen_random_uuid(),
  boutique_id uuid references boutiques(id) on delete cascade not null,
  url text not null,
  label text,
  events text[] not null default '{}',
  active boolean default true,
  secret text,
  created_at timestamptz default now(),
  last_triggered_at timestamptz,
  last_status int
);
alter table boutique_webhooks enable row level security;
do $$ begin
  create policy "boutique members" on boutique_webhooks for all using (boutique_id = my_boutique_id());
exception when duplicate_object then null; end $$;
