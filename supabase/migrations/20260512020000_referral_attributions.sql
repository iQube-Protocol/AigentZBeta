-- =============================================================================
-- referral_attributions — track WHICH share source produced a signup
--
-- The personas table has a referrer_persona_id column but no source —
-- so we can't tell whether a signup came from a Bring-a-Knight share or
-- a Herald-of-the-Order share. The Herald aggregation cron needs that
-- distinction to grant the right reward type (HeraldAudienceSignups +
-- HeraldConversionPayingUser).
--
-- Schema:
--   referrer_persona_id  → who shared the link
--   new_persona_id       → who signed up via the link
--   source               → 'bring-a-knight' | 'herald' | 'bring-a-knight:Twitter' | ...
--                          (matches referral_codes.source so we can join)
--   ref_code             → the literal 16-char HMAC code used
--   created_at           → signup timestamp
--   first_conversion_at  → set when the new_persona makes a qualifying
--                          purchase (mirror of personas.first_paid_purchase_at
--                          but cached here so the aggregation cron has a
--                          single source of truth for Herald grant timing)
--
-- One row per (referrer, new_persona) pair (UNIQUE constraint). Re-runs
-- of the signup flow are idempotent.
--
-- Privacy: server-side only. T0 columns (persona_id pair) never surface
-- in browser-bound JSON — the same pattern as crm_rewards.persona_id.
--
-- Idempotent migration; safe to re-run.
-- =============================================================================

CREATE TABLE IF NOT EXISTS referral_attributions (
  id                   BIGSERIAL PRIMARY KEY,
  referrer_persona_id  UUID NOT NULL,
  new_persona_id       UUID NOT NULL,
  source               TEXT NOT NULL,
  ref_code             TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  first_conversion_at  TIMESTAMPTZ,
  UNIQUE (referrer_persona_id, new_persona_id)
);

CREATE INDEX IF NOT EXISTS idx_referral_attributions_referrer
  ON referral_attributions(referrer_persona_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referral_attributions_source
  ON referral_attributions(source, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referral_attributions_conversion
  ON referral_attributions(referrer_persona_id, first_conversion_at DESC)
  WHERE first_conversion_at IS NOT NULL;

COMMENT ON TABLE referral_attributions IS
  'Per-signup attribution log. Captures the share source (bring-a-knight | herald | platform-suffixed) ' ||
  'so heraldAggregationService can grant HeraldAudienceSignups + HeraldConversionPayingUser correctly.';
