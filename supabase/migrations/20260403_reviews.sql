create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  boutique_id uuid references boutiques(id) on delete cascade not null,
  client_id uuid references clients(id) on delete set null,
  event_id uuid references events(id) on delete set null,
  rating integer check (rating between 1 and 5),
  platform text default 'internal' check (platform in ('internal','google','yelp','facebook','theknot','weddingwire','other')),
  review_text text,
  reviewer_name text,
  review_url text,
  request_sent_at timestamptz,
  response text,
  responded_at timestamptz,
  is_featured boolean default false,
  created_at timestamptz default now()
);
create index if not exists reviews_boutique_idx on reviews(boutique_id);
alter table reviews enable row level security;
do $$ begin
  create policy "boutique members" on reviews for all using (boutique_id = my_boutique_id());
exception when duplicate_object then null;
end $$;
