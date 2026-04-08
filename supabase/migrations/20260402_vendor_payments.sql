alter table boutique_vendors add column if not exists total_paid numeric(10,2) default 0;
alter table boutique_vendors add column if not exists payment_terms text;
alter table boutique_vendors add column if not exists notes text;

create table if not exists vendor_payments (
  id uuid primary key default gen_random_uuid(),
  boutique_id uuid references boutiques(id) on delete cascade not null,
  vendor_id uuid references boutique_vendors(id) on delete cascade not null,
  event_id uuid references events(id) on delete set null,
  amount numeric(10,2) not null,
  description text,
  paid_date date not null default current_date,
  payment_method text default 'bank_transfer',
  receipt_url text,
  created_at timestamptz default now()
);
alter table vendor_payments enable row level security;
do $$ begin
  create policy "boutique members" on vendor_payments for all using (boutique_id = my_boutique_id());
exception when duplicate_object then null; end $$;
create index if not exists vendor_payments_boutique_id_idx on vendor_payments(boutique_id);
create index if not exists vendor_payments_vendor_id_idx on vendor_payments(vendor_id);
