CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  boutique_id uuid REFERENCES boutiques(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(boutique_id, endpoint)
);
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bm_ps_select" ON push_subscriptions USING (boutique_id = my_boutique_id());
CREATE POLICY "bm_ps_insert" ON push_subscriptions FOR INSERT WITH CHECK (boutique_id = my_boutique_id());
CREATE POLICY "bm_ps_delete" ON push_subscriptions FOR DELETE USING (boutique_id = my_boutique_id());
