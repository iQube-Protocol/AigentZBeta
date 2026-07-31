-- Narrative Invariants — Chrysalis Foundation, CFS-012 (2026-07-04).
--
-- A fifth invariant class: fixed STRUCTURAL beats of a story (opening state,
-- inciting realization, constitutional tension, resolution, constitutional
-- transformation) — not plot, not prose, not visuals. Distinct from Style
-- Invariants (CFS-011, cinematographic/visual continuity): narrative beats
-- are sequential and map onto segments proportionally to a fixed arc order,
-- where style/semantic invariants distribute without inherent order.
--
-- Additive: widen the namespace CHECK on the three tables that carry it
-- (same pattern as the CFS-011 'style' migration).

ALTER TABLE public.invariants
  DROP CONSTRAINT IF EXISTS invariants_namespace_check;
ALTER TABLE public.invariants
  ADD CONSTRAINT invariants_namespace_check
  CHECK (namespace IN ('constitutional','reasoning','engineering','experience','capability','style','narrative'));

ALTER TABLE public.ontology_classes
  DROP CONSTRAINT IF EXISTS ontology_classes_namespace_check;
ALTER TABLE public.ontology_classes
  ADD CONSTRAINT ontology_classes_namespace_check
  CHECK (namespace IN ('constitutional','reasoning','engineering','experience','capability','style','narrative'));

ALTER TABLE public.invariant_collections
  DROP CONSTRAINT IF EXISTS invariant_collections_namespace_check;
ALTER TABLE public.invariant_collections
  ADD CONSTRAINT invariant_collections_namespace_check
  CHECK (namespace IS NULL OR namespace IN ('constitutional','reasoning','engineering','experience','capability','style','narrative'));
