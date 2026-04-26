-- ============================================================================
-- INVENTORY: Add 'archived' to the inventory_status_check constraint
--
-- The Inventory bulk-action UI ships an "Archive" action so boutique owners
-- can hide retired pieces (sold dresses, broken decor, discontinued SKUs)
-- from the working list without deleting the row outright (which would
-- nuke the rental history attached to it).
--
-- The current CHECK allows: available | reserved | picked_up | returned |
-- cleaning | overdue. This migration extends it with 'archived' as a
-- terminal status — items in this state stay queryable for history but
-- are filtered out of every working view by default.
--
-- ─── How to apply ──────────────────────────────────────────────────────────
-- Option A — Supabase Dashboard SQL Editor: paste this file, click Run.
-- Option B — CLI: supabase db push
--
-- Idempotent: safe to re-run.
--
-- ─── Rollback ──────────────────────────────────────────────────────────────
-- Reset any rows that were archived to 'available', then drop and re-add
-- the constraint without 'archived':
--
--   UPDATE inventory SET status = 'available' WHERE status = 'archived';
--   ALTER TABLE inventory DROP CONSTRAINT IF EXISTS inventory_status_check;
--   ALTER TABLE inventory ADD CONSTRAINT inventory_status_check
--     CHECK (status IN ('available','reserved','picked_up','returned',
--                       'cleaning','overdue'));
-- ============================================================================

BEGIN;

-- Pre-flight: log the current row count of would-be-archived items (always 0
-- on the first run, since the value can't yet exist).
DO $$
DECLARE
  archived_count integer;
BEGIN
  SELECT count(*) INTO archived_count FROM inventory WHERE status = 'archived';
  RAISE NOTICE 'PRE-FLIGHT: % inventory rows currently have status=archived', archived_count;
END $$;

-- Drop and re-add the CHECK with the wider allowed set. Postgres doesn't
-- have a "modify constraint" so this is the standard pattern.
ALTER TABLE public.inventory DROP CONSTRAINT IF EXISTS inventory_status_check;

ALTER TABLE public.inventory ADD CONSTRAINT inventory_status_check
  CHECK (status = ANY (ARRAY[
    'available'::text,
    'reserved'::text,
    'picked_up'::text,
    'returned'::text,
    'cleaning'::text,
    'overdue'::text,
    'archived'::text
  ]));

-- Verification: query pg_constraint directly to assert 'archived' is in the
-- allowed set. We can't do an INSERT-then-rollback smoke test in a DO block
-- (PL/pgSQL doesn't support `ROLLBACK TO SAVEPOINT`), but a constraint
-- definition check is just as conclusive — the consrc/pg_get_constraintdef
-- output will literally contain the string 'archived' if the ALTER took.
DO $$
DECLARE
  def text;
BEGIN
  SELECT pg_get_constraintdef(c.oid) INTO def
  FROM pg_constraint c
  JOIN pg_class      t ON t.oid = c.conrelid
  JOIN pg_namespace  n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'inventory'
    AND c.conname = 'inventory_status_check';

  IF def IS NULL THEN
    RAISE EXCEPTION 'FAILED: inventory_status_check constraint not found after ALTER';
  END IF;
  IF def NOT LIKE '%archived%' THEN
    RAISE EXCEPTION 'FAILED: inventory_status_check still rejects ''archived''. Current def: %', def;
  END IF;
  RAISE NOTICE 'POST-FLIGHT: inventory_status_check now allows ''archived''. ✓';
END $$;

COMMIT;
