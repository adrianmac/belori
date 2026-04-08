create table if not exists sms_messages (
  id uuid primary key default gen_random_uuid(),
  boutique_id uuid references boutiques(id) on delete cascade not null,
  client_id uuid references clients(id) on delete cascade,
  direction text not null check (direction in ('inbound','outbound')),
  body text not null,
  status text not null default 'sent' check (status in ('sending','sent','failed','received')),
  twilio_sid text,
  created_at timestamptz default now()
);
create index if not exists sms_messages_boutique_client_idx on sms_messages(boutique_id, client_id);
create index if not exists sms_messages_created_at_idx on sms_messages(created_at desc);
alter table sms_messages enable row level security;
do $$ begin
  create policy "boutique members" on sms_messages for all using (boutique_id = my_boutique_id());
exception when duplicate_object then null;
end $$;
