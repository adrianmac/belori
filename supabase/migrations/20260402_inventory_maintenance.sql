create table if not exists inventory_maintenance (
  id uuid primary key default gen_random_uuid(),
  boutique_id uuid references boutiques(id) on delete cascade,
  inventory_id uuid references inventory(id) on delete cascade,
  type text not null check (type in ('cleaning','repair','inspection','alteration')),
  notes text,
  performed_by text,
  performed_at date not null default current_date,
  cost numeric(10,2),
  created_at timestamptz default now()
);
create index if not exists inventory_maintenance_boutique_id_idx on inventory_maintenance(boutique_id);
create index if not exists inventory_maintenance_inventory_id_idx on inventory_maintenance(inventory_id);
alter table inventory_maintenance enable row level security;
do $$ begin
  create policy "boutique members" on inventory_maintenance for all using (boutique_id = my_boutique_id());
exception when duplicate_object then null;
end $$;
