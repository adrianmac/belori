-- invoices
CREATE TABLE IF NOT EXISTS invoices (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  boutique_id      uuid NOT NULL REFERENCES boutiques(id) ON DELETE CASCADE,
  client_id        uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  event_id         uuid REFERENCES events(id) ON DELETE SET NULL,
  invoice_number   text,  -- auto-generated: INV-2026-0001

  status           text DEFAULT 'draft' CHECK (status IN ('draft','sent','partially_paid','paid','cancelled')),

  subtotal_cents   integer DEFAULT 0,
  tax_cents        integer DEFAULT 0,
  include_tax      boolean DEFAULT true,
  total_cents      integer DEFAULT 0,
  paid_cents       integer DEFAULT 0,

  notes            text,
  sent_at          timestamptz,
  cancelled_at     timestamptz,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

-- invoice_items
CREATE TABLE IF NOT EXISTS invoice_items (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  boutique_id      uuid NOT NULL REFERENCES boutiques(id) ON DELETE CASCADE,
  invoice_id       uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  name             text NOT NULL,
  name_es          text,
  price_cents      integer NOT NULL,
  quantity         integer DEFAULT 1,
  is_custom_amount boolean DEFAULT false,
  sort_order       integer DEFAULT 0
);

-- invoice_payment_schedule (deposit + balance milestones)
CREATE TABLE IF NOT EXISTS invoice_payment_schedule (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  boutique_id      uuid NOT NULL REFERENCES boutiques(id) ON DELETE CASCADE,
  invoice_id       uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  label            text NOT NULL,
  label_es         text,
  amount_cents     integer NOT NULL,
  due_date         date,
  status           text DEFAULT 'pending' CHECK (status IN ('pending','paid','overdue')),
  paid_at          timestamptz,
  sort_order       integer DEFAULT 0
);

-- invoice_payments (actual payment records)
CREATE TABLE IF NOT EXISTS invoice_payments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  boutique_id      uuid NOT NULL REFERENCES boutiques(id) ON DELETE CASCADE,
  invoice_id       uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount_cents     integer NOT NULL,
  method           text NOT NULL CHECK (method IN ('card','zelle','cash')),
  reference        text,
  recorded_by_name text,
  recorded_at      timestamptz DEFAULT now()
);

-- invoice_attachments (order form photos)
CREATE TABLE IF NOT EXISTS invoice_attachments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  boutique_id uuid NOT NULL REFERENCES boutiques(id) ON DELETE CASCADE,
  invoice_id  uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  file_url    text NOT NULL,
  file_name   text,
  uploaded_at timestamptz DEFAULT now()
);

-- client_cards_on_file (last 4 digits only — NEVER full card numbers)
CREATE TABLE IF NOT EXISTS client_cards_on_file (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  boutique_id     uuid NOT NULL REFERENCES boutiques(id) ON DELETE CASCADE,
  client_id       uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  last_four       text,
  card_brand      text,
  added_for_invoice_id uuid REFERENCES invoices(id),
  added_at        timestamptz DEFAULT now()
);

-- RLS on all tables
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_payment_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_cards_on_file ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "members_access_invoices" ON invoices FOR ALL USING (is_boutique_member(boutique_id));
CREATE POLICY IF NOT EXISTS "members_access_invoice_items" ON invoice_items FOR ALL USING (is_boutique_member(boutique_id));
CREATE POLICY IF NOT EXISTS "members_access_invoice_payment_schedule" ON invoice_payment_schedule FOR ALL USING (is_boutique_member(boutique_id));
CREATE POLICY IF NOT EXISTS "members_access_invoice_payments" ON invoice_payments FOR ALL USING (is_boutique_member(boutique_id));
CREATE POLICY IF NOT EXISTS "members_access_invoice_attachments" ON invoice_attachments FOR ALL USING (is_boutique_member(boutique_id));
CREATE POLICY IF NOT EXISTS "members_access_client_cards_on_file" ON client_cards_on_file FOR ALL USING (is_boutique_member(boutique_id));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_invoices_boutique ON invoices(boutique_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payment_schedule_invoice ON invoice_payment_schedule(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice ON invoice_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_client_cards_client ON client_cards_on_file(client_id);

-- Auto-number invoices: INV-YYYY-NNNN
CREATE SEQUENCE IF NOT EXISTS invoice_seq;

CREATE OR REPLACE FUNCTION generate_invoice_number(boutique uuid)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  seq_val bigint;
  year_str text;
BEGIN
  seq_val := nextval('invoice_seq');
  year_str := to_char(now(), 'YYYY');
  RETURN 'INV-' || year_str || '-' || lpad(seq_val::text, 4, '0');
END;
$$;
