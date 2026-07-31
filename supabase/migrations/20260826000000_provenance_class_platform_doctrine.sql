-- Widen corpus_candidate_sources.provenance_class with 'platform-doctrine'.
--
-- Operator ruling 2026-07-27 (evidence provenance vs discovery provenance).
-- The §2a vocabulary had four values; the ruling names a fifth class of
-- evidence — deliberately PROPRIETARY constitutional doctrine (MoneyPenny /
-- Q¢) that is "neither externally established nor intended as general
-- scientific evidence". It is not a weaker platform-derived source; it is
-- evidence offered for a different purpose, and it gets its own experimental
-- population (C) rather than being folded into the ablation (B).
--
-- This is the same additive pattern as the finance-namespace widening
-- (20260721000000): the TypeScript union in services/corpusScout/types.ts is
-- the authority, and this CHECK must never be narrower than it. The drift is
-- the "2026-07-15 constraint-drift incident" bug class — a value the code can
-- produce that the database refuses — so a parity canary pins the two
-- together (tests/evidence-provenance-populations.test.ts).
--
-- Idempotent: safe to re-run.

ALTER TABLE public.corpus_candidate_sources
  DROP CONSTRAINT IF EXISTS corpus_candidate_sources_provenance_class_check;

ALTER TABLE public.corpus_candidate_sources
  ADD CONSTRAINT corpus_candidate_sources_provenance_class_check
  CHECK (provenance_class IS NULL OR provenance_class IN (
    'external-established', 'external-empirical', 'platform-derived', 'platform-hypothesized',
    'platform-doctrine'
  ));

COMMENT ON COLUMN public.corpus_candidate_sources.provenance_class IS
  'Evidence-provenance axis — WHERE THE EVIDENCE CAME FROM (PRD-ICA-001 §0.3; five values as of the operator ruling 2026-07-27). Orthogonal to discovery provenance (WHO DISCOVERED IT) and to review_workflow_status (what the reviewer decided). Induces the EXP-P1 experimental population: external-* -> A, platform-derived|platform-hypothesized -> B, platform-doctrine -> C.';
