-- Refunds table
create table if not exists payment_refunds (
  id uuid primary key default gen_random_uuid(),
  boutique_id uuid references boutiques(id) on delete cascade not null,
  event_id uuid references events(id) on delete cascade not null,
  milestone_id uuid references payment_milestones(id) on delete set null,
  amount numeric(10,2) not null,
  reason text,
  refunded_at date not null default current_date,
  created_at timestamptz default now()
);
create index if not exists payment_refunds_boutique_id_idx on payment_refunds(boutique_id);
create index if not exists payment_refunds_event_id_idx on payment_refunds(event_id);
alter table payment_refunds enable row level security;
do $$ begin
  create policy "boutique members" on payment_refunds for all using (boutique_id = my_boutique_id());
exception when duplicate_object then null; end $$;

-- Tips column on events
alter table events add column if not exists tip numeric(10,2) default 0;
