-- Purchase Orders + line items

create table purchase_orders (
  id uuid primary key default gen_random_uuid(),
  boutique_id uuid references boutiques(id) on delete cascade,
  vendor_id uuid references boutique_vendors(id) on delete set null,
  vendor_name text,
  po_number text,
  status text default 'draft' check (status in ('draft','sent','partial','received','cancelled')),
  order_date date default current_date,
  expected_date date,
  received_date date,
  notes text,
  total_amount numeric(10,2) default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  boutique_id uuid references boutiques(id) on delete cascade,
  po_id uuid references purchase_orders(id) on delete cascade,
  inventory_id uuid references inventory(id) on delete set null,
  item_name text not null,
  sku text,
  quantity_ordered int not null default 1,
  quantity_received int default 0,
  unit_cost numeric(10,2) default 0,
  notes text
);

-- RLS
alter table purchase_orders enable row level security;
create policy "boutique members" on purchase_orders
  using (boutique_id = my_boutique_id());

alter table purchase_order_items enable row level security;
create policy "boutique members" on purchase_order_items
  using (boutique_id = my_boutique_id());
