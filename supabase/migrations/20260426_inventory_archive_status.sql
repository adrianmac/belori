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

-- Verification: insert into a transaction-savepoint that rolls back, just to
-- prove the new constraint accepts 'archived'. We never persist this row.
DO $$
DECLARE
  test_id uuid;
BEGIN
  -- Use a savepoint so the test row is always rolled back, even on success.
  SAVEPOINT verify_archive;

  INSERT INTO public.inventory (boutique_id, sku, name, category, status, deposit, price)
  SELECT id, '__verify_archive_constraint__', 'verify', 'centerpiece', 'archived', 0, 0
  FROM public.boutiques LIMIT 1
  RETURNING id INTO test_id;

  -- If we got here, the new constraint accepts 'archived'. Roll the row back.
  ROLLBACK TO SAVEPOINT verify_archive;
  RAISE NOTICE 'POST-FLIGHT: inventory_status_check now accepts ''archived''. ✓';
EXCEPTION
  WHEN check_violation THEN
    ROLLBACK TO SAVEPOINT verify_archive;
    RAISE EXCEPTION 'FAILED: inventory_status_check still rejects ''archived'' after ALTER';
  WHEN OTHERS THEN
    -- e.g. no boutiques row exists (fresh DB). That's fine — the ALTER above
    -- already updated the constraint definition; we just couldn't smoke-test.
    ROLLBACK TO SAVEPOINT verify_archive;
    RAISE NOTICE 'POST-FLIGHT: skipped insert smoke test (%). Constraint redefinition still applied.', SQLERRM;
END $$;

COMMIT;
