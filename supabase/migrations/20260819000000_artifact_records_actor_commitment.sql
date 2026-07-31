-- 20260819000000 — Actor commitment + taxonomy fields on artifact_records
-- (SPEC-MMC-002 §6.2, Phase 2 — "close the ownership + taxonomy gaps")
--
-- Phase 1 (PRD-MMC-IMPL-007) named the ownership gap: `produce-software`
-- (app/api/artifact/produce-software/route.ts) computes a T2-safe
-- `actorCommitment = sha256('artifact:actor:' + personaId).slice(0,16)` but
-- never persists it — SaveArtifactRecordInput had no such column, and every
-- row was stamped `delegate: 'operator'`, a generic literal with no honest
-- way to attribute a software production to the citizen who produced it.
-- This migration closes that gap additively, mirroring the exact shape of
-- 20260714000000_artifact_records_cited_invariants.sql (a single additive
-- ALTER TABLE for new nullable columns, no backfill, no destructive change):
--
--   actor_commitment — the SAME T2-safe, one-way, deterministic commitment
--     already computed server-side by every produce-* route
--     (produce-software, produce-research, composition/publish,
--     homecoming/agent/produce all share the identical
--     sha256('artifact:actor:' + personaId).slice(0,16) formula). NEVER the
--     personaId itself, never round-tripped to the browser — server-side
--     filtering only (see services/artifact/artifactRecordStore.ts's
--     actorCommitmentFor + the new `mine` route). Re-derivable from
--     personaId alone (no secret storage needed), so a caller who lost the
--     value can always recompute it. Old rows keep NULL — they are
--     genuinely not attributable and MUST NOT be backfilled with a guess
--     (CLAUDE.md "No Guessing or Hallucinating").
--   artefact_type    — SPEC-MMC-002 §3 taxonomy (application / agent /
--     capability / cartridge / tool / workflow / code_project), a REAL
--     field now instead of an inferred label. Nullable; not backfilled.
--   runtime_host     — where the artifact runs, when known (SPEC-MMC-002 §3
--     "Runtime or host" — modeled by nothing today). Nullable.
--   permissions      — a real per-artefact ACL/visibility model
--     (SPEC-MMC-002 §3 "Permissions" — today: persona-level access only).
--     jsonb so the shape can evolve without another migration. Nullable.
--
-- Additive + safe: rows written before this migration read all four new
-- columns as NULL. No existing column, constraint, or row is touched.

ALTER TABLE public.artifact_records
  ADD COLUMN IF NOT EXISTS actor_commitment TEXT,
  ADD COLUMN IF NOT EXISTS artefact_type TEXT,
  ADD COLUMN IF NOT EXISTS runtime_host TEXT,
  ADD COLUMN IF NOT EXISTS permissions JSONB;

-- A caller (the mySoftware "mine" read) filters by this column — index it.
CREATE INDEX IF NOT EXISTS idx_artifact_records_actor_commitment
  ON public.artifact_records (actor_commitment);

COMMENT ON COLUMN public.artifact_records.actor_commitment IS
  'T2-safe one-way commitment sha256(''artifact:actor:'' + personaId).slice(0,16) — the ONLY subject handle this table carries for per-persona attribution. NEVER the raw personaId; never serialised to the client. NULL on rows produced before this migration (genuinely unattributable — not backfilled, per CLAUDE.md No Guessing).';
COMMENT ON COLUMN public.artifact_records.artefact_type IS
  'SPEC-MMC-002 §3 taxonomy: application | agent | capability | cartridge | tool | workflow | code_project. Nullable — set only by a caller that actually knows the type, never inferred.';
COMMENT ON COLUMN public.artifact_records.runtime_host IS
  'Where the artifact runs, when known (SPEC-MMC-002 §3 "Runtime or host"). Nullable — not modeled by any producer yet.';
COMMENT ON COLUMN public.artifact_records.permissions IS
  'Per-artefact ACL/visibility model (SPEC-MMC-002 §3 "Permissions"), jsonb so the shape can evolve without a further migration. Nullable — today access is persona-level only (no per-artefact ACL exists).';
