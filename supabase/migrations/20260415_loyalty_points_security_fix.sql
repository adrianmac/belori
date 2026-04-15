-- Security fix: adjust_loyalty_points previously accepted p_boutique_id as a
-- caller-supplied parameter. Because the function is SECURITY DEFINER (bypasses
-- RLS), any authenticated user could pass a foreign boutique's ID and modify
-- another boutique's client loyalty points.
--
-- Fix: remove p_boutique_id parameter entirely. The function now resolves the
-- boutique internally via my_boutique_id(), which reads from the caller's JWT —
-- the same source of truth used by every RLS policy.
--
-- The WHERE clause now enforces: client must belong to the caller's boutique.
-- No caller can override this.

-- Drop the old signature first (Postgres function overloading requires explicit DROP)
DROP FUNCTION IF EXISTS adjust_loyalty_points(uuid, uuid, integer, text, text);

CREATE OR REPLACE FUNCTION adjust_loyalty_points(
  p_client_id   uuid,
  p_delta       integer,
  p_type        text    DEFAULT 'adjust',
  p_reason      text    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_boutique_id uuid;
  v_new_total   integer;
BEGIN
  -- Resolve boutique from JWT — callers cannot override this
  v_boutique_id := my_boutique_id();

  IF v_boutique_id IS NULL THEN
    RAISE EXCEPTION 'No boutique associated with the current session';
  END IF;

  -- Atomic increment with floor at 0 — single round-trip, no race condition
  UPDATE clients
  SET    loyalty_points = GREATEST(0, loyalty_points + p_delta)
  WHERE  id            = p_client_id
    AND  boutique_id   = v_boutique_id
  RETURNING loyalty_points INTO v_new_total;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Client % not found in boutique %', p_client_id, v_boutique_id;
  END IF;

  -- Record the transaction
  INSERT INTO loyalty_transactions (boutique_id, client_id, delta, type, reason)
  VALUES (v_boutique_id, p_client_id, p_delta, p_type, p_reason)
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('new_total', v_new_total);
END;
$$;

GRANT EXECUTE ON FUNCTION adjust_loyalty_points(uuid, integer, text, text) TO authenticated;
