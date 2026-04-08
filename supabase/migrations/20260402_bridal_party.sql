create table if not exists bridal_party (
  id uuid primary key default gen_random_uuid(),
  boutique_id uuid references boutiques(id) on delete cascade,
  event_id uuid references events(id) on delete cascade,
  client_id uuid references clients(id) on delete set null,
  name text not null,
  role text default 'bridesmaid' check (role in ('bride','bridesmaid','maid_of_honor','mother_of_bride','mother_of_groom','flower_girl','other')),
  phone text,
  email text,
  dress_size text,
  color_assigned text,
  fitting_date date,
  fitting_done boolean default false,
  notes text,
  created_at timestamptz default now()
);
alter table bridal_party enable row level security;
create policy "boutique members" on bridal_party using (boutique_id = my_boutique_id());
