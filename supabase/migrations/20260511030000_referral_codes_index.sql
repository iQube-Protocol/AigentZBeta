-- =============================================================================
-- referral_codes — reverse-lookup index for share-link referral codes.
--
-- The /api/wallet/tasks/share-link endpoint mints a deterministic per-persona
-- referral code via HMAC-SHA256(REFERRAL_SHARE_SECRET, "<source>|<personaId>|<epoch>").
-- This table stores (code → persona_id) so the signup flow can call
-- /api/referral/resolve-code?ref=<code> and route the new persona's referral
-- attribution to the right referrer without iterating every persona row.
--
-- Per the rep/rewards/tasks ops backlog (2026-05-10_knyt-tasks-operationalization-backlog.md):
-- closes the Bring-a-Knight chain — links generated in the wallet now resolve
-- back to a referrer at signup time.
--
-- Idempotent migration; safe to re-run.
-- =============================================================================

CREATE TABLE IF NOT EXISTS referral_codes (
  code        TEXT PRIMARY KEY,
  persona_id  UUID NOT NULL,
  source      TEXT NOT NULL,
  epoch       TEXT NOT NULL DEFAULT 'v1',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reverse index for "list this persona's codes" + per-source uniqueness.
-- A persona can hold a code per (source, epoch); on epoch rotation the
-- old codes stay (audit trail) but are no longer reachable from
-- new shares.
CREATE INDEX IF NOT EXISTS idx_referral_codes_persona
  ON referral_codes(persona_id, source);
CREATE INDEX IF NOT EXISTS idx_referral_codes_source_epoch
  ON referral_codes(source, epoch);

-- =============================================================================
-- referral_clicks — outbound share-link click tracking
--
-- Each row records one click on a share link (Bring-a-Knight or Herald).
-- Used by analytics aggregation (downstream of this v2 commit) to power
-- per-persona Herald tier progression (HeraldCuriosityClicks reward type).
--
-- Append-only; no FK on referrer_persona_id since orphan codes from
-- rotated epochs may still produce clicks. Analytics cleans up.
-- =============================================================================

CREATE TABLE IF NOT EXISTS referral_clicks (
  id                  BIGSERIAL PRIMARY KEY,
  ref_code            TEXT NOT NULL,
  referrer_persona_id UUID,
  source              TEXT,
  user_agent          TEXT,
  referer             TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_clicks_code
  ON referral_clicks(ref_code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referral_clicks_referrer
  ON referral_clicks(referrer_persona_id, created_at DESC);
