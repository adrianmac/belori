-- ============================================================
-- SECURITY: High-severity RLS fixes — 2026-04-16
-- HIGH-001: purchase_orders / purchase_order_items — INSERT WITH CHECK missing
-- HIGH-002: bridal_party — INSERT WITH CHECK missing
-- HIGH-003: damage_reports — INSERT WITH CHECK missing
-- HIGH-004: boutique_members — UPDATE unrestricted (staff role escalation)
-- ============================================================

-- ─── HIGH-001: purchase_orders ────────────────────────────────────────────────
-- Original policy used USING-only, allowing any authenticated user to INSERT
-- rows for any boutique. Replace with explicit per-operation policies.

DROP POLICY IF EXISTS "boutique members" ON purchase_orders;
DROP POLICY IF EXISTS "bm_purchase_orders_select" ON purchase_orders;
DROP POLICY IF EXISTS "bm_purchase_orders_insert" ON purchase_orders;
DROP POLICY IF EXISTS "bm_purchase_orders_update" ON purchase_orders;
DROP POLICY IF EXISTS "bm_purchase_orders_delete" ON purchase_orders;

CREATE POLICY "bm_purchase_orders_select" ON purchase_orders
  FOR SELECT USING (boutique_id = my_boutique_id());

CREATE POLICY "bm_purchase_orders_insert" ON purchase_orders
  FOR INSERT WITH CHECK (boutique_id = my_boutique_id());

CREATE POLICY "bm_purchase_orders_update" ON purchase_orders
  FOR UPDATE USING (boutique_id = my_boutique_id())
  WITH CHECK (boutique_id = my_boutique_id());

CREATE POLICY "bm_purchase_orders_delete" ON purchase_orders
  FOR DELETE USING (boutique_id = my_boutique_id());

-- ─── HIGH-001b: purchase_order_items ─────────────────────────────────────────

DROP POLICY IF EXISTS "boutique members" ON purchase_order_items;
DROP POLICY IF EXISTS "bm_purchase_order_items_select" ON purchase_order_items;
DROP POLICY IF EXISTS "bm_purchase_order_items_insert" ON purchase_order_items;
DROP POLICY IF EXISTS "bm_purchase_order_items_update" ON purchase_order_items;
DROP POLICY IF EXISTS "bm_purchase_order_items_delete" ON purchase_order_items;

CREATE POLICY "bm_purchase_order_items_select" ON purchase_order_items
  FOR SELECT USING (boutique_id = my_boutique_id());

CREATE POLICY "bm_purchase_order_items_insert" ON purchase_order_items
  FOR INSERT WITH CHECK (boutique_id = my_boutique_id());

CREATE POLICY "bm_purchase_order_items_update" ON purchase_order_items
  FOR UPDATE USING (boutique_id = my_boutique_id())
  WITH CHECK (boutique_id = my_boutique_id());

CREATE POLICY "bm_purchase_order_items_delete" ON purchase_order_items
  FOR DELETE USING (boutique_id = my_boutique_id());

-- ─── HIGH-002: bridal_party ───────────────────────────────────────────────────
-- Original policy used USING-only. Replace with explicit per-operation policies.

DROP POLICY IF EXISTS "boutique members" ON bridal_party;
DROP POLICY IF EXISTS "bm_bridal_party_select" ON bridal_party;
DROP POLICY IF EXISTS "bm_bridal_party_insert" ON bridal_party;
DROP POLICY IF EXISTS "bm_bridal_party_update" ON bridal_party;
DROP POLICY IF EXISTS "bm_bridal_party_delete" ON bridal_party;

CREATE POLICY "bm_bridal_party_select" ON bridal_party
  FOR SELECT USING (boutique_id = my_boutique_id());

CREATE POLICY "bm_bridal_party_insert" ON bridal_party
  FOR INSERT WITH CHECK (boutique_id = my_boutique_id());

CREATE POLICY "bm_bridal_party_update" ON bridal_party
  FOR UPDATE USING (boutique_id = my_boutique_id())
  WITH CHECK (boutique_id = my_boutique_id());

CREATE POLICY "bm_bridal_party_delete" ON bridal_party
  FOR DELETE USING (boutique_id = my_boutique_id());

-- ─── HIGH-003: damage_reports ─────────────────────────────────────────────────
-- Original policy used USING-only. Replace with explicit per-operation policies.

DROP POLICY IF EXISTS "boutique members" ON damage_reports;
DROP POLICY IF EXISTS "bm_damage_reports_select" ON damage_reports;
DROP POLICY IF EXISTS "bm_damage_reports_insert" ON damage_reports;
DROP POLICY IF EXISTS "bm_damage_reports_update" ON damage_reports;
DROP POLICY IF EXISTS "bm_damage_reports_delete" ON damage_reports;

CREATE POLICY "bm_damage_reports_select" ON damage_reports
  FOR SELECT USING (boutique_id = my_boutique_id());

CREATE POLICY "bm_damage_reports_insert" ON damage_reports
  FOR INSERT WITH CHECK (boutique_id = my_boutique_id());

CREATE POLICY "bm_damage_reports_update" ON damage_reports
  FOR UPDATE USING (boutique_id = my_boutique_id())
  WITH CHECK (boutique_id = my_boutique_id());

CREATE POLICY "bm_damage_reports_delete" ON damage_reports
  FOR DELETE USING (boutique_id = my_boutique_id());

-- ─── HIGH-004: boutique_members — restrict UPDATE to owners only ───────────────
-- The original permissive UPDATE policy (USING boutique_id = my_boutique_id())
-- allows any staff member to promote themselves or others to 'owner'.
-- Fix: only members with role = 'owner' may UPDATE any row in the boutique.
-- Staff members lose the ability to self-edit name/initials/color, but this
-- is the correct trade-off; owners manage staff records.

-- Drop ALL existing boutique_members policies so we can restate the full set
-- cleanly. The original schema likely created a single catch-all policy.
DROP POLICY IF EXISTS "boutique members"              ON boutique_members;
DROP POLICY IF EXISTS "Boutique members"              ON boutique_members;
DROP POLICY IF EXISTS "bm_boutique_members_select"   ON boutique_members;
DROP POLICY IF EXISTS "bm_boutique_members_insert"   ON boutique_members;
DROP POLICY IF EXISTS "bm_boutique_members_update"   ON boutique_members;
DROP POLICY IF EXISTS "bm_boutique_members_delete"   ON boutique_members;

-- SELECT: any authenticated member of the boutique can read the member list
CREATE POLICY "bm_boutique_members_select" ON boutique_members
  FOR SELECT USING (boutique_id = my_boutique_id());

-- INSERT: only owners can add new members (invite acceptance is handled via
-- service-role in the invite flow, so this guards direct inserts)
CREATE POLICY "bm_boutique_members_insert" ON boutique_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM boutique_members bm
      WHERE bm.user_id    = auth.uid()
        AND bm.boutique_id = boutique_members.boutique_id
        AND bm.role        = 'owner'
    )
  );

-- UPDATE: only owners may update any member row (prevents role self-escalation)
CREATE POLICY "bm_boutique_members_update" ON boutique_members
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM boutique_members bm
      WHERE bm.user_id    = auth.uid()
        AND bm.boutique_id = boutique_members.boutique_id
        AND bm.role        = 'owner'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM boutique_members bm
      WHERE bm.user_id    = auth.uid()
        AND bm.boutique_id = boutique_members.boutique_id
        AND bm.role        = 'owner'
    )
  );

-- DELETE: only owners can remove members
CREATE POLICY "bm_boutique_members_delete" ON boutique_members
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM boutique_members bm
      WHERE bm.user_id    = auth.uid()
        AND bm.boutique_id = boutique_members.boutique_id
        AND bm.role        = 'owner'
    )
  );
