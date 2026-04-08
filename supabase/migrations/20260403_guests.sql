CREATE TABLE IF NOT EXISTS event_guests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  boutique_id uuid REFERENCES boutiques(id) ON DELETE CASCADE NOT NULL,
  event_id uuid REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  phone text,
  email text,
  rsvp_status text NOT NULL DEFAULT 'invited',  -- invited | confirmed | declined | maybe
  meal_pref text,   -- none | chicken | fish | vegetarian | vegan | kids
  table_number text,
  plus_ones integer DEFAULT 0,
  notes text,
  invited_by text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE event_guests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bm_eg_select" ON event_guests USING (boutique_id = my_boutique_id());
CREATE POLICY "bm_eg_insert" ON event_guests FOR INSERT WITH CHECK (boutique_id = my_boutique_id());
CREATE POLICY "bm_eg_update" ON event_guests FOR UPDATE USING (boutique_id = my_boutique_id());
CREATE POLICY "bm_eg_delete" ON event_guests FOR DELETE USING (boutique_id = my_boutique_id());
