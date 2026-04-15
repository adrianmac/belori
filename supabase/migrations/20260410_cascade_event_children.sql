-- Fix D-2: event_inventory records are meaningless without their parent event.
-- Change event_id FK from SET NULL (or no action) to CASCADE so that deleting
-- an event automatically removes its decoration/inventory assignments.
--
-- appointments: already handled — keep SET NULL so standalone appointments remain.
-- alteration_jobs: keep SET NULL (jobs may outlive the event for billing purposes).
-- expenses / quotes: keep SET NULL (financial records should persist for audit).

ALTER TABLE event_inventory
  DROP CONSTRAINT IF EXISTS event_inventory_event_id_fkey,
  ADD CONSTRAINT event_inventory_event_id_fkey
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
