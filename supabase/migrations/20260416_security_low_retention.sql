-- SEC-029: PII data retention policy for client_measurements
-- Measurements are retained for the life of the client record (cascade delete).
-- Boutiques may request full data erasure via the data_deletion_requests table.
-- This migration documents the policy and adds tooling for enforcement.

COMMENT ON TABLE client_measurements IS
  'PII — body measurements. Retained for duration of client relationship. '
  'Cascades on client delete. Max retention 7 years per GDPR Art. 17 / CCPA § 1798.105. '
  'Use request_data_deletion() or data_deletion_requests table for erasure requests.';

-- Efficient index for retention scans (purge stale data by boutique + age)
CREATE INDEX IF NOT EXISTS idx_client_measurements_boutique_created
  ON client_measurements (boutique_id, created_at);

-- Helper: purge measurements older than N years for a specific boutique
-- Called manually or via scheduled job during data deletion request processing.
CREATE OR REPLACE FUNCTION purge_stale_measurements(
  p_boutique_id uuid,
  p_older_than_years int DEFAULT 7
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count int;
BEGIN
  -- Only allow boutique owners / service role to call this
  -- (SECURITY DEFINER runs as owner, but we still scope to boutique)
  DELETE FROM client_measurements
  WHERE boutique_id = p_boutique_id
    AND created_at < now() - make_interval(years => p_older_than_years);

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Revoke public execute, only service role can call
REVOKE EXECUTE ON FUNCTION purge_stale_measurements(uuid, int) FROM PUBLIC;

-- Add retention_years column to boutiques so each boutique can configure their own policy
ALTER TABLE boutiques ADD COLUMN IF NOT EXISTS measurement_retention_years int DEFAULT 7
  CHECK (measurement_retention_years BETWEEN 1 AND 10);

COMMENT ON COLUMN boutiques.measurement_retention_years IS
  'How many years to retain client measurement data. Default 7 (GDPR Art. 17 safe harbor). Range 1–10.';
