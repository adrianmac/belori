-- ─── SEC-020: Enforce positive milestone amounts at DB level ─────────────────
ALTER TABLE payment_milestones
  DROP CONSTRAINT IF EXISTS chk_milestone_amount_positive,
  ADD CONSTRAINT chk_milestone_amount_positive CHECK (amount > 0);

-- ─── SEC-024: Add portal token expiry support ─────────────────────────────────
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS portal_token_expires_at timestamptz;

-- Expire portal tokens for completed/cancelled events (set to 30 days from now for existing)
UPDATE events
  SET portal_token_expires_at = now() + interval '30 days'
  WHERE status IN ('completed', 'cancelled')
    AND portal_token IS NOT NULL
    AND portal_token_expires_at IS NULL;
