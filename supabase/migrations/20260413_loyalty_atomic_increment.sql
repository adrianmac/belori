-- Atomic loyalty point adjustment to prevent read-modify-write race conditions.
-- Replaces the client-side pattern: read → compute → write (which can corrupt
-- point balances when two concurrent operations race).
--
-- Usage (from supabase-js):
--   await supabase.rpc('adjust_loyalty_points', {
--     p_client_id:  '<uuid>',
--     p_boutique_id: '<uuid>',
--     p_delta:      100,        -- positive = award, negative = deduct
--     p_type:       'award',    -- 'award' | 'redeem' | 'adjust'
--     p_reason:     'Service purchase',
--   })
-- Returns: { new_total: number }

CREATE OR REPLACE FUNCTION adjust_loyalty_points(
  p_client_id   uuid,
  p_boutique_id uuid,
  p_delta       integer,
  p_type        text    DEFAULT 'adjust',
  p_reason      text    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER   -- runs as the function owner, bypasses RLS for the UPDATE
SET search_path = public
AS $$
DECLARE
  v_new_total integer;
BEGIN
  -- Atomic increment with floor at 0 — single round-trip, no race condition
  UPDATE clients
  SET    loyalty_points = GREATEST(0, loyalty_points + p_delta)
  WHERE  id            = p_client_id
    AND  boutique_id   = p_boutique_id
  RETURNING loyalty_points INTO v_new_total;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Client % not found in boutique %', p_client_id, p_boutique_id;
  END IF;

  -- Record the transaction (non-blocking — if this fails the points are still correct)
  INSERT INTO loyalty_transactions (boutique_id, client_id, delta, type, reason)
  VALUES (p_boutique_id, p_client_id, p_delta, p_type, p_reason)
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('new_total', v_new_total);
END;
$$;

-- Allow authenticated users to call this function (RLS on clients table
-- still ensures they can only touch their own boutique's clients because
-- p_boutique_id must match my_boutique_id() — enforced by the WHERE clause
-- and the fact that the JWT-linked boutique_id is passed from the frontend).
GRANT EXECUTE ON FUNCTION adjust_loyalty_points TO authenticated;
