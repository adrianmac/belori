create table if not exists email_templates (
  id uuid primary key default gen_random_uuid(),
  boutique_id uuid references boutiques(id) on delete cascade not null,
  name text not null,
  subject text not null,
  body text not null,
  category text default 'general' check (category in ('general','confirmation','reminder','followup','promotion','contract')),
  variables text[] default '{}',
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists email_templates_boutique_idx on email_templates(boutique_id);
alter table email_templates enable row level security;
do $$ begin
  create policy "boutique members" on email_templates for all using (boutique_id = my_boutique_id());
exception when duplicate_object then null;
end $$;
