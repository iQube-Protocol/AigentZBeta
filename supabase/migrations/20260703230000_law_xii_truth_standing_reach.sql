-- Law XII — Truth, Standing and Reach (CFS-009 amendment, ratified 2026-07-03).
--
-- Standing and Reach are orthogonal constitutional dimensions and shall never
-- be conflated: Standing = validation-class confidence (times_validated,
-- times_contradicted); Reach = adoption (times_referenced, times_used).
-- Truth is never a stored number — it is what validation estimates.
--
-- Also ratifies the 'epistemic' semantic type (Law XII seed invariants
-- inv.constitutional.060-062).
--
-- Additive: one new column + CHECK recreations widened by one enum member.

-- 1. Reach — the adoption dimension, separated out of standing.
ALTER TABLE public.invariants
  ADD COLUMN IF NOT EXISTS reach numeric(5,1) NOT NULL DEFAULT 0
    CHECK (reach >= 0 AND reach <= 100);

-- 2. 'epistemic' semantic type on both tables.
ALTER TABLE public.invariants
  DROP CONSTRAINT IF EXISTS invariants_semantic_type_check;
ALTER TABLE public.invariants
  ADD CONSTRAINT invariants_semantic_type_check
  CHECK (semantic_type IN ('principle','constraint','definition','heuristic','law','epistemic'));

ALTER TABLE public.ontology_classes
  DROP CONSTRAINT IF EXISTS ontology_classes_semantic_type_check;
ALTER TABLE public.ontology_classes
  ADD CONSTRAINT ontology_classes_semantic_type_check
  CHECK (semantic_type IN ('principle','constraint','definition','heuristic','law','epistemic'));

-- 3. Backfill: recompute reach for existing rows from the adoption ledger
--    using the same saturating form as computeReachScore
--    (base = referenced*2 + used*0.5; reach = 100*base/(base+40)), and strip
--    the adoption contribution out of standing by recomputing standing from
--    validation signals only (base = validated*8, penalty 0.15/contradiction
--    capped at 0.8).
UPDATE public.invariants SET
  reach = ROUND(
    (100.0 * (times_referenced * 2 + times_used * 0.5)
      / NULLIF(times_referenced * 2 + times_used * 0.5 + 40, 0))::numeric, 1),
  standing = ROUND(
    ((100.0 * (times_validated * 8) / NULLIF(times_validated * 8 + 40, 0))
      * (1 - LEAST(0.8, times_contradicted * 0.15)))::numeric, 1)
WHERE times_validated > 0 OR times_referenced > 0 OR times_used > 0 OR times_contradicted > 0;
