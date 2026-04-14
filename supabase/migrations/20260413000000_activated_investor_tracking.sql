-- Migration: Activated investor tracking
--
-- Adds two columns to nakamoto_knyt_personas that link investor records
-- to their platform accounts when the same person has both:
--
--   platform_activated_at   — timestamp when the investor created a platform account
--   platform_auth_profile_id — canonical crm_auth_profiles.id for the platform account
--
-- This enables the "activated investor" segmentation:
--   SELECT * WHERE platform_activated_at IS NOT NULL AND "Total-Invested" > 0
--
-- The link is established automatically by /api/wallet/identity/consolidate
-- (fires on every login) and can be backfilled via scripts/backfill_activated_investors.py

ALTER TABLE public."nakamoto_knyt_personas"
  ADD COLUMN IF NOT EXISTS platform_activated_at      TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS platform_auth_profile_id   TEXT        DEFAULT NULL;

COMMENT ON COLUMN public."nakamoto_knyt_personas".platform_activated_at
  IS 'When this investor first activated a platform (metaMe/AigentZ) account. NULL = investor-only, no platform presence.';

COMMENT ON COLUMN public."nakamoto_knyt_personas".platform_auth_profile_id
  IS 'Canonical crm_auth_profiles.id for this investor''s platform account. Used to join to crm_personas and platform activity.';

-- Index: fast query for activated investors
CREATE INDEX IF NOT EXISTS idx_nkp_platform_activated
  ON public."nakamoto_knyt_personas" (platform_activated_at)
  WHERE platform_activated_at IS NOT NULL;

-- Index: lookup by auth profile (used by consolidate hook)
CREATE INDEX IF NOT EXISTS idx_nkp_platform_auth_profile
  ON public."nakamoto_knyt_personas" (platform_auth_profile_id)
  WHERE platform_auth_profile_id IS NOT NULL;
