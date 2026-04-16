-- ─────────────────────────────────────────────────────────────────────────────
-- Corrective: Fix Know1 alpha SkillQube trust_band and policy_class values
-- Venture Lab α — Phase 2
--
-- The initial migration (20260416000000) used non-canonical values:
--   trust_band  = 'L1_COMMUNITY'  → correct value: 'L1_EXPERIMENTAL'
--   policy_class = 'open'         → correct value: 'read_only'
--
-- This corrects both values to match the canonical TypeScript TrustBand and
-- PolicyClass types in types/registryIngestion.ts. Safe to re-run (idempotent).
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE registry_assets
SET
  trust_band   = 'L1_EXPERIMENTAL',
  policy_class = 'read_only',
  updated_at   = now()
WHERE
  tenant_id    = 'platform'
  AND asset_class = 'SkillQube'
  AND trust_band  = 'L1_COMMUNITY';

-- Verify: the following should return 0 rows after this migration runs.
-- SELECT asset_id, trust_band, policy_class FROM registry_assets
--   WHERE asset_class = 'SkillQube' AND trust_band = 'L1_COMMUNITY';
