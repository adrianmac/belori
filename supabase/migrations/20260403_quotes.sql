CREATE TABLE IF NOT EXISTS quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  boutique_id uuid REFERENCES boutiques(id) ON DELETE CASCADE NOT NULL,
  event_id uuid REFERENCES events(id) ON DELETE SET NULL,
  client_name text NOT NULL,
  event_type text,
  event_date date,
  venue text,
  expires_at date,
  line_items jsonb DEFAULT '[]',
  milestones jsonb DEFAULT '[]',
  discount_type text DEFAULT 'fixed',
  discount_value numeric(10,2) DEFAULT 0,
  notes text,
  status text DEFAULT 'draft',
  pdf_url text,
  total numeric(10,2),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "boutique_members_quotes" ON quotes
  USING (boutique_id = my_boutique_id());
CREATE POLICY "boutique_members_quotes_insert" ON quotes
  FOR INSERT WITH CHECK (boutique_id = my_boutique_id());
CREATE POLICY "boutique_members_quotes_update" ON quotes
  FOR UPDATE USING (boutique_id = my_boutique_id());
CREATE POLICY "boutique_members_quotes_delete" ON quotes
  FOR DELETE USING (boutique_id = my_boutique_id());
