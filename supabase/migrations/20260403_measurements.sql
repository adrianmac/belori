CREATE TABLE IF NOT EXISTS client_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  boutique_id uuid REFERENCES boutiques(id) ON DELETE CASCADE NOT NULL,
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  bust numeric(5,1),
  waist numeric(5,1),
  hips numeric(5,1),
  height numeric(5,1),
  shoe_size text,
  notes text,
  taken_at timestamptz DEFAULT now(),
  taken_by_name text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE client_measurements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bm_cm_select" ON client_measurements USING (boutique_id = my_boutique_id());
CREATE POLICY "bm_cm_insert" ON client_measurements FOR INSERT WITH CHECK (boutique_id = my_boutique_id());
CREATE POLICY "bm_cm_update" ON client_measurements FOR UPDATE USING (boutique_id = my_boutique_id());
CREATE POLICY "bm_cm_delete" ON client_measurements FOR DELETE USING (boutique_id = my_boutique_id());
