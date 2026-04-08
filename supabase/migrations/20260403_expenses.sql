CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  boutique_id uuid REFERENCES boutiques(id) ON DELETE CASCADE NOT NULL,
  event_id uuid REFERENCES events(id) ON DELETE SET NULL,
  category text NOT NULL DEFAULT 'other',
  description text NOT NULL,
  amount numeric(10,2) NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "boutique_members_expenses" ON expenses
  USING (boutique_id = my_boutique_id());
CREATE POLICY "boutique_members_expenses_insert" ON expenses
  FOR INSERT WITH CHECK (boutique_id = my_boutique_id());
CREATE POLICY "boutique_members_expenses_update" ON expenses
  FOR UPDATE USING (boutique_id = my_boutique_id());
CREATE POLICY "boutique_members_expenses_delete" ON expenses
  FOR DELETE USING (boutique_id = my_boutique_id());
