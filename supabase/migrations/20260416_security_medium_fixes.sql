-- SEC-016: ai-suggest rate limiting table
CREATE TABLE IF NOT EXISTS ai_usage_log (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_log_user_time
  ON ai_usage_log(user_id, created_at DESC);

-- No RLS policies = no direct access for anon or authenticated roles.
-- Service-role key (used in edge functions) bypasses RLS.
ALTER TABLE ai_usage_log ENABLE ROW LEVEL SECURITY;

-- SEC-018: sign-contract — IP and user-agent audit columns
ALTER TABLE IF EXISTS contracts
  ADD COLUMN IF NOT EXISTS signed_ip         text,
  ADD COLUMN IF NOT EXISTS signed_user_agent text;
