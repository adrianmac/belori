create table if not exists event_photos (
  id uuid primary key default gen_random_uuid(),
  boutique_id uuid references boutiques(id) on delete cascade not null,
  event_id uuid references events(id) on delete cascade,
  client_id uuid references clients(id) on delete set null,
  url text not null,
  storage_path text,
  caption text,
  photo_type text default 'general' check (photo_type in ('general','fitting','before','after','event_day','inspiration','dress')),
  uploaded_by text,
  created_at timestamptz default now()
);
create index if not exists event_photos_boutique_idx on event_photos(boutique_id);
create index if not exists event_photos_event_idx on event_photos(event_id);
alter table event_photos enable row level security;
do $$ begin
  create policy "boutique members" on event_photos for all using (boutique_id = my_boutique_id());
exception when duplicate_object then null;
end $$;
-- Storage: create bucket if not exists
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-photos', 'event-photos', true, 10485760, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do nothing;
-- Storage RLS
do $$ begin
  create policy "boutique members can upload"
    on storage.objects for insert
    with check (bucket_id = 'event-photos');
exception when duplicate_object then null;
end $$;
do $$ begin
  create policy "public read event photos"
    on storage.objects for select
    using (bucket_id = 'event-photos');
exception when duplicate_object then null;
end $$;
