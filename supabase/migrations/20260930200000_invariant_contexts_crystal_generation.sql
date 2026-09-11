-- 20260930200000_invariant_contexts_crystal_generation.sql
--
-- Generation-identity repair (2026-09-05, RES-2026-09-05-TRACK2-MEMBERSHIP-
-- RECOVERY-GENERATION-BLIND-001 / CI-2026-09-05-MEMBERSHIP-RECOVERY-MUST-
-- BOUND-GENERATION-001).
--
-- invariant_contexts(domain) conflates every Crystal generation ever
-- assigned into a domain: nothing distinguished the 15-member vP1
-- predecessor batch (assigned 2026-08-04) from the 53-member v2 successor
-- batch (assigned 2026-09-05T10:06:41.303889Z, receipt
-- b28284b6-7b26-4362-b89b-c866fa690967) once both landed in
-- 'financial-risk-value-systems'. resolveFrozenPredecessorContext
-- (services/research/crystalCohortMembership.ts) inferred predecessor
-- membership from a domain-scoped, time-unbounded read, so the successor
-- batch was silently absorbed into "frozen predecessor membership" the
-- moment it was assigned, collapsing Track 2's successor-cohort view from
-- 58 to 5.
--
-- This migration adds an explicit, durable generation identity —
-- crystal_generation_id, valued with the ASSIGNING crystal-version
-- artifact's own research_objects.object_id (e.g. 'EXP-P1/crystal-vP1'),
-- never a freeform 'v1'/'v2' label — and backfills the two EXISTING EXP-P1
-- clusters MECHANICALLY, from the exact assignment timestamps already
-- verified against the live substrate (read-only, before this migration):
--
--   15 rows, invariant_contexts.created_at on 2026-08-04 (the vP1 freeze
--     predecessor batch)                          -> 'EXP-P1/crystal-vP1'
--   53 rows, invariant_contexts.created_at =
--     2026-09-05 10:06:41.303889+00 (the Stage 8 successor assignment,
--     receipt b28284b6-7b26-4362-b89b-c866fa690967) -> 'EXP-P1/crystal-vP2'
--
-- No other row's crystal_generation_id is touched or inferred — every row
-- outside these two exact, timestamp-verified clusters keeps NULL, honestly,
-- until its own generation is known. Each population is asserted against its
-- expected count BEFORE any write, and the migration RAISEs rather than
-- silently backfilling a different set of rows if the live data no longer
-- matches what was verified.
--
-- A research_objects row for 'EXP-P1/crystal-vP2' is also provisioned at
-- `draft` lifecycle (mirroring services/research/artifacts.ts::upsertArtifact's
-- own payload shape) so the successor generation is a real, first-class
-- object from this migration onward, not merely a label — the SAME
-- crystal-version artifact model 'EXP-P1/crystal-vP1' (frozen) already uses.
--
-- Additive-only (CFS-010 §3); idempotent, re-runnable. Does not alter any
-- invariant's statement, namespace, semantic type, status, provenance,
-- standing, reach, or any edge/relationship — only the NEW
-- crystal_generation_id column, on rows already assigned to
-- 'financial-risk-value-systems'.

-- ── 1. The column + index ────────────────────────────────────────────────
ALTER TABLE public.invariant_contexts
  ADD COLUMN IF NOT EXISTS crystal_generation_id text;

COMMENT ON COLUMN public.invariant_contexts.crystal_generation_id IS
  'The research_objects.object_id of the crystal-version artifact (kind=crystal-version) this membership was assigned under, e.g. ''EXP-P1/crystal-vP1'' — NEVER a freeform ''v1''/''v2'' label. NULL for non-crystal contexts and for rows not yet backfilled. Resolved via services/research/artifacts.ts::ensureCurrentCrystalGenerationId; read via services/research/crystalCohortMembership.ts::resolveFrozenPredecessorContext. See RES-2026-09-05-TRACK2-MEMBERSHIP-RECOVERY-GENERATION-BLIND-001.';

CREATE INDEX IF NOT EXISTS idx_invariant_contexts_generation
  ON public.invariant_contexts (domain, crystal_generation_id);

-- ── 2. Provision the successor generation as a first-class object ───────
-- Mirrors upsertArtifact's exact payload shape (services/research/artifacts.ts)
-- for a freshly-provisioned, never-frozen crystal-version artifact.
INSERT INTO public.research_objects (object_kind, object_id, payload, lifecycle_state)
VALUES (
  'artifact',
  'EXP-P1/crystal-vP2',
  jsonb_build_object(
    'kind', 'crystal-version',
    'phase', 'protocol',
    'experimentId', 'EXP-P1',
    'contentHash', NULL,
    'commitmentHash', NULL,
    'frozenAt', NULL,
    'signedBy', '[]'::jsonb
  ),
  'draft'
)
ON CONFLICT (object_kind, object_id) DO NOTHING;

-- ── 3. Mechanical backfill, exact clusters only, assertion-guarded ───────
DO $$
DECLARE
  predecessor_total int;
  successor_total int;
BEGIN
  -- Assert the predecessor population BEFORE writing anything — a
  -- population that no longer matches what was verified live must stop
  -- the migration, never silently backfill a different set of rows.
  SELECT count(*) INTO predecessor_total
  FROM public.invariant_contexts
  WHERE domain = 'financial-risk-value-systems'
    AND created_at >= '2026-08-04 00:00:00+00'
    AND created_at <  '2026-08-05 00:00:00+00';
  IF predecessor_total <> 15 THEN
    RAISE EXCEPTION
      'crystal_generation_id backfill: expected exactly 15 predecessor (vP1) rows in financial-risk-value-systems dated 2026-08-04, found %. Refusing to guess — verify the live cluster before re-running.',
      predecessor_total;
  END IF;

  UPDATE public.invariant_contexts
  SET crystal_generation_id = 'EXP-P1/crystal-vP1'
  WHERE domain = 'financial-risk-value-systems'
    AND created_at >= '2026-08-04 00:00:00+00'
    AND created_at <  '2026-08-05 00:00:00+00'
    AND crystal_generation_id IS DISTINCT FROM 'EXP-P1/crystal-vP1';

  SELECT count(*) INTO successor_total
  FROM public.invariant_contexts
  WHERE domain = 'financial-risk-value-systems'
    AND created_at = '2026-09-05 10:06:41.303889+00';
  IF successor_total <> 53 THEN
    RAISE EXCEPTION
      'crystal_generation_id backfill: expected exactly 53 successor (vP2) rows in financial-risk-value-systems at the Stage 8 assignment timestamp 2026-09-05 10:06:41.303889+00, found %. Refusing to guess — verify the live cluster before re-running.',
      successor_total;
  END IF;

  UPDATE public.invariant_contexts
  SET crystal_generation_id = 'EXP-P1/crystal-vP2'
  WHERE domain = 'financial-risk-value-systems'
    AND created_at = '2026-09-05 10:06:41.303889+00'
    AND crystal_generation_id IS DISTINCT FROM 'EXP-P1/crystal-vP2';
END $$;
