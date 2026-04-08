-- Commission rate per staff member (stored in boutique_members)
ALTER TABLE boutique_members ADD COLUMN IF NOT EXISTS commission_rate numeric(5,2) DEFAULT 0;

-- Commission records per event
CREATE TABLE IF NOT EXISTS commission_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  boutique_id uuid REFERENCES boutiques(id) ON DELETE CASCADE NOT NULL,
  event_id uuid REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  member_id uuid REFERENCES boutique_members(id) ON DELETE SET NULL,
  member_name text NOT NULL,
  event_total numeric(10,2) NOT NULL DEFAULT 0,
  commission_rate numeric(5,2) NOT NULL DEFAULT 0,
  commission_amount numeric(10,2) NOT NULL DEFAULT 0,
  paid boolean DEFAULT false,
  paid_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE commission_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bm_cr_select" ON commission_records USING (boutique_id = my_boutique_id());
CREATE POLICY "bm_cr_insert" ON commission_records FOR INSERT WITH CHECK (boutique_id = my_boutique_id());
CREATE POLICY "bm_cr_update" ON commission_records FOR UPDATE USING (boutique_id = my_boutique_id());
CREATE POLICY "bm_cr_delete" ON commission_records FOR DELETE USING (boutique_id = my_boutique_id());
