CREATE TABLE IF NOT EXISTS vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  boutique_id uuid REFERENCES boutiques(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  category text NOT NULL,
  phone text,
  email text,
  website text,
  instagram text,
  rating integer CHECK (rating BETWEEN 1 AND 5),
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS event_vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  boutique_id uuid REFERENCES boutiques(id) ON DELETE CASCADE NOT NULL,
  event_id uuid REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  vendor_id uuid REFERENCES vendors(id) ON DELETE CASCADE NOT NULL,
  role text,
  confirmed boolean DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_vendors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "boutique_members_vendors" ON vendors
  USING (boutique_id = my_boutique_id());

CREATE POLICY "boutique_members_vendors_insert" ON vendors
  FOR INSERT
  WITH CHECK (boutique_id = my_boutique_id());

CREATE POLICY "boutique_members_vendors_update" ON vendors
  FOR UPDATE
  USING (boutique_id = my_boutique_id());

CREATE POLICY "boutique_members_vendors_delete" ON vendors
  FOR DELETE
  USING (boutique_id = my_boutique_id());

CREATE POLICY "boutique_members_event_vendors" ON event_vendors
  USING (boutique_id = my_boutique_id());

CREATE POLICY "boutique_members_event_vendors_insert" ON event_vendors
  FOR INSERT
  WITH CHECK (boutique_id = my_boutique_id());

CREATE POLICY "boutique_members_event_vendors_delete" ON event_vendors
  FOR DELETE
  USING (boutique_id = my_boutique_id());
