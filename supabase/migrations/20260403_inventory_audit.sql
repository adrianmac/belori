CREATE TABLE IF NOT EXISTS inventory_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  boutique_id uuid REFERENCES boutiques(id) ON DELETE CASCADE NOT NULL,
  inventory_id uuid REFERENCES inventory(id) ON DELETE CASCADE NOT NULL,
  action text NOT NULL,  -- 'checked_out' | 'checked_in' | 'status_change' | 'created' | 'updated' | 'cleaned' | 'damaged' | 'reserved'
  prev_status text,
  new_status text,
  user_name text,
  event_id uuid REFERENCES events(id) ON DELETE SET NULL,
  client_name text,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE inventory_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bm_ial_select" ON inventory_audit_log USING (boutique_id = my_boutique_id());
CREATE POLICY "bm_ial_insert" ON inventory_audit_log FOR INSERT WITH CHECK (boutique_id = my_boutique_id());
