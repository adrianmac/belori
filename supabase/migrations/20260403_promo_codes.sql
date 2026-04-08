CREATE TABLE IF NOT EXISTS promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  boutique_id uuid REFERENCES boutiques(id) ON DELETE CASCADE NOT NULL,
  code text NOT NULL,
  description text,
  discount_type text NOT NULL DEFAULT 'percent', -- 'percent' | 'fixed'
  discount_value numeric(10,2) NOT NULL,
  max_uses integer, -- null = unlimited
  uses_count integer NOT NULL DEFAULT 0,
  expires_at date,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(boutique_id, code)
);

CREATE TABLE IF NOT EXISTS promo_code_uses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  boutique_id uuid REFERENCES boutiques(id) ON DELETE CASCADE NOT NULL,
  promo_code_id uuid REFERENCES promo_codes(id) ON DELETE CASCADE NOT NULL,
  event_id uuid REFERENCES events(id) ON DELETE SET NULL,
  client_name text,
  discount_applied numeric(10,2) NOT NULL,
  used_at timestamptz DEFAULT now()
);

ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_code_uses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bm_pc" ON promo_codes USING (boutique_id = my_boutique_id());
CREATE POLICY "bm_pc_i" ON promo_codes FOR INSERT WITH CHECK (boutique_id = my_boutique_id());
CREATE POLICY "bm_pc_u" ON promo_codes FOR UPDATE USING (boutique_id = my_boutique_id());
CREATE POLICY "bm_pc_d" ON promo_codes FOR DELETE USING (boutique_id = my_boutique_id());
CREATE POLICY "bm_pcu" ON promo_code_uses USING (boutique_id = my_boutique_id());
CREATE POLICY "bm_pcu_i" ON promo_code_uses FOR INSERT WITH CHECK (boutique_id = my_boutique_id());
