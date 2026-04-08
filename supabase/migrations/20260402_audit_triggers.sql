-- Function to log audit events
CREATE OR REPLACE FUNCTION log_audit_event()
RETURNS TRIGGER AS $$
DECLARE
  boutique_uuid uuid;
BEGIN
  -- Get boutique_id from the row
  boutique_uuid := COALESCE(NEW.boutique_id, OLD.boutique_id);

  INSERT INTO boutique_audit_log (boutique_id, action, table_name, row_id, before_data, after_data)
  VALUES (
    boutique_uuid,
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN to_jsonb(NEW) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add triggers to key tables
DO $$ BEGIN
  CREATE TRIGGER audit_events AFTER INSERT OR UPDATE OR DELETE ON events
    FOR EACH ROW EXECUTE FUNCTION log_audit_event();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER audit_payment_milestones AFTER INSERT OR UPDATE OR DELETE ON payment_milestones
    FOR EACH ROW EXECUTE FUNCTION log_audit_event();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER audit_clients AFTER INSERT OR UPDATE OR DELETE ON clients
    FOR EACH ROW EXECUTE FUNCTION log_audit_event();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER audit_contracts AFTER INSERT OR UPDATE OR DELETE ON contracts
    FOR EACH ROW EXECUTE FUNCTION log_audit_event();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
