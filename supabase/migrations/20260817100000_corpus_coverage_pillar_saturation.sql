-- 20260817100000_corpus_coverage_pillar_saturation.sql
--
-- Constitutional Discovery amendment §6.1 — Steward saturation confirmation.
-- codexes/packs/agentiq/updates/2026-07-23_prd-ica-001-amendment-constitutional-discovery-domain-architect.md
--
-- "Complete" (§6, algorithmic — assessLaneCoverage() reports every ratified
-- pillar has ≥1 approved source) and "saturated" (has the Institutional
-- Registry for this pillar actually been exhausted?) are different questions:
-- the first is countable, the second is scientific judgment. This migration
-- adds the explicit steward gate for the second question directly onto the
-- pillar row it judges — no new table, per the amendment's own "no new
-- subsystem" instruction.
--
--   Gap Detection reports "complete"        (algorithmic, existing)
--           v
--   Steward confirms saturation             (this migration's columns)
--           v
--   Open Discovery unlocks for that pillar  (not built yet — Phase 3/4)
--
-- Never inferred from a threshold or count — always an explicit steward
-- action (services/corpusScout/domainConstitution.ts::confirmPillarSaturation),
-- recorded with the steward's own persona id (T1-safe self-attribution, same
-- exposure class as ratified_by above). Additive/idempotent (CFS-010 §3).

ALTER TABLE public.corpus_coverage_pillars
  ADD COLUMN IF NOT EXISTS saturation_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS saturation_confirmed_by uuid,
  ADD COLUMN IF NOT EXISTS saturation_confirmed_at timestamptz;

COMMENT ON COLUMN public.corpus_coverage_pillars.saturation_confirmed IS
  'PRD-ICA-001 amendment §6.1 — steward judgment that the Institutional Registry for this pillar is exhausted. Distinct from (and required in addition to) Gap Detection''s algorithmic "≥1 approved source" check. Gates Open Discovery per-pillar once Phase 3/4 build it.';
