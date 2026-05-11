-- =============================================================================
-- system_rate_limits — editable per-endpoint rate limits
-- rate_limit_counters — append-only counter rows for sliding-window check
--
-- Per the alpha-readiness audit (2026-05-12_knyt-rep-rewards-tasks-alpha-readiness.md),
-- three public-ish endpoints needed rate limits before live testing:
--   /api/wallet/tasks/share-link     — 30/hour/persona
--   /api/wallet/tasks/track-click    — 10/min/IP
--   /api/referral/resolve-code       — 5/min/IP
--
-- The operator decided these should be EDITABLE via the admin Tasks &
-- Rewards tab so limits can be tuned during alpha without a redeploy.
--
-- system_rate_limits: one row per (endpoint_key, scope). Scope is
-- either 'persona' (subject = personaId) or 'ip' (subject = client IP).
-- Endpoints not present in the table are unlimited (fail-open default).
--
-- rate_limit_counters: append-only event log. The middleware queries
-- COUNT(*) WHERE scope_value = $1 AND created_at >= NOW() - window
-- to evaluate the rolling-window check. A daily cron prunes rows older
-- than the longest configured window so the table stays small.
--
-- Idempotent — re-runnable.
-- =============================================================================

CREATE TABLE IF NOT EXISTS system_rate_limits (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_key    TEXT NOT NULL,
  scope           TEXT NOT NULL CHECK (scope IN ('persona', 'ip')),
  max_requests    INTEGER NOT NULL CHECK (max_requests > 0),
  window_seconds  INTEGER NOT NULL CHECK (window_seconds > 0),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (endpoint_key, scope)
);

CREATE INDEX IF NOT EXISTS idx_system_rate_limits_endpoint
  ON system_rate_limits(endpoint_key) WHERE is_active = TRUE;

-- Seed the 3 endpoints flagged by the alpha-readiness audit.
INSERT INTO system_rate_limits (endpoint_key, scope, max_requests, window_seconds, is_active, notes) VALUES
  ('wallet:tasks:share-link',  'persona', 30, 3600,  TRUE, 'BaK/Herald share-link mint. HMAC-derived so legit re-clicks are idempotent; cap stops scripted enumeration.'),
  ('wallet:tasks:track-click', 'ip',      10, 60,    TRUE, 'Public click-tracking endpoint. Cap stops referrers from self-clicking to inflate Herald counts.'),
  ('referral:resolve-code',    'ip',      5,  60,    TRUE, 'Ref-code reverse lookup. Cap deters code-space enumeration.')
ON CONFLICT (endpoint_key, scope) DO NOTHING;

CREATE TABLE IF NOT EXISTS rate_limit_counters (
  id            BIGSERIAL PRIMARY KEY,
  endpoint_key  TEXT NOT NULL,
  scope         TEXT NOT NULL,
  scope_value   TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Composite index for the rolling-window count query.
CREATE INDEX IF NOT EXISTS idx_rate_limit_counters_lookup
  ON rate_limit_counters(endpoint_key, scope_value, created_at DESC);

-- Convenience cleanup helper. Operator can `SELECT cleanup_rate_limit_counters(7);`
-- or wire a daily cron via pg_cron. Keeps the table bounded.
CREATE OR REPLACE FUNCTION cleanup_rate_limit_counters(retention_days INTEGER DEFAULT 7)
RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
  deleted BIGINT;
BEGIN
  DELETE FROM rate_limit_counters
   WHERE created_at < NOW() - (retention_days || ' days')::INTERVAL;
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;

COMMENT ON TABLE system_rate_limits IS
  'Editable per-endpoint rate limits. Operator-tunable via the admin Tasks & Rewards tab.';
COMMENT ON TABLE rate_limit_counters IS
  'Append-only counter log for sliding-window rate limit checks. Pruned by cleanup_rate_limit_counters().';
