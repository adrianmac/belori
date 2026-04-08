CREATE TABLE IF NOT EXISTS checklist_templates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  boutique_id uuid REFERENCES boutiques(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('wedding','quince','both')),
  items jsonb NOT NULL DEFAULT '[]', -- [{text, category, is_alert}]
  created_at timestamptz DEFAULT now()
);
ALTER TABLE checklist_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "checklist_templates_boutique" ON checklist_templates
  USING (boutique_id = my_boutique_id()) WITH CHECK (boutique_id = my_boutique_id());
