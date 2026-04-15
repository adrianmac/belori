-- Critical performance indexes: boutique_id on all core tables.
--
-- Without these, every query that enforces RLS via my_boutique_id() causes a
-- full sequential scan across ALL boutiques' rows. At 50+ boutiques with 300+
-- events each, a single event list query scans 15,000+ rows to return 300.
--
-- These indexes also accelerate the real-time subscription filter evaluation
-- and all Inngest automation queries that run on boutiques.automations.
--
-- Composite indexes on (boutique_id, event_date) and (boutique_id, status)
-- support the most common secondary sort/filter patterns.

-- Core operational tables
CREATE INDEX IF NOT EXISTS idx_events_boutique_id
  ON events(boutique_id);

CREATE INDEX IF NOT EXISTS idx_events_boutique_date
  ON events(boutique_id, event_date);

CREATE INDEX IF NOT EXISTS idx_events_boutique_status
  ON events(boutique_id, status);

CREATE INDEX IF NOT EXISTS idx_clients_boutique_id
  ON clients(boutique_id);

CREATE INDEX IF NOT EXISTS idx_appointments_boutique_id
  ON appointments(boutique_id);

CREATE INDEX IF NOT EXISTS idx_appointments_boutique_date
  ON appointments(boutique_id, date);

CREATE INDEX IF NOT EXISTS idx_payment_milestones_boutique_id
  ON payment_milestones(boutique_id);

CREATE INDEX IF NOT EXISTS idx_payment_milestones_boutique_due
  ON payment_milestones(boutique_id, due_date);

CREATE INDEX IF NOT EXISTS idx_payment_milestones_event_id
  ON payment_milestones(event_id);

CREATE INDEX IF NOT EXISTS idx_alteration_jobs_boutique_id
  ON alteration_jobs(boutique_id);

CREATE INDEX IF NOT EXISTS idx_inventory_boutique_id
  ON inventory(boutique_id);

CREATE INDEX IF NOT EXISTS idx_inventory_boutique_status
  ON inventory(boutique_id, status);

-- Supporting tables
CREATE INDEX IF NOT EXISTS idx_notes_boutique_id
  ON notes(boutique_id);

CREATE INDEX IF NOT EXISTS idx_tasks_boutique_id
  ON tasks(boutique_id);

CREATE INDEX IF NOT EXISTS idx_event_services_boutique_id
  ON event_services(boutique_id);

CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_boutique_id
  ON loyalty_transactions(boutique_id);

CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_client_id
  ON loyalty_transactions(client_id);

CREATE INDEX IF NOT EXISTS idx_pipeline_leads_boutique_id
  ON pipeline_leads(boutique_id);

CREATE INDEX IF NOT EXISTS idx_client_interactions_boutique_id
  ON client_interactions(boutique_id);

CREATE INDEX IF NOT EXISTS idx_client_tasks_boutique_id
  ON client_tasks(boutique_id);
