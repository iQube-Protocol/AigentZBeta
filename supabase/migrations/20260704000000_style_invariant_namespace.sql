-- Style Invariants — Chrysalis Foundation, CFS-011 (2026-07-04).
--
-- A fourth content-bearing invariant class, alongside Knowledge (constitutional),
-- Reasoning, and Experience: invariants that preserve visual/narrative
-- continuity across a multi-segment production rather than semantic meaning.
-- Same computational primitive (CFS-000 §7), new namespace.
--
-- Additive: widen the namespace CHECK on the three tables that carry it.

ALTER TABLE public.invariants
  DROP CONSTRAINT IF EXISTS invariants_namespace_check;
ALTER TABLE public.invariants
  ADD CONSTRAINT invariants_namespace_check
  CHECK (namespace IN ('constitutional','reasoning','engineering','experience','capability','style'));

ALTER TABLE public.ontology_classes
  DROP CONSTRAINT IF EXISTS ontology_classes_namespace_check;
ALTER TABLE public.ontology_classes
  ADD CONSTRAINT ontology_classes_namespace_check
  CHECK (namespace IN ('constitutional','reasoning','engineering','experience','capability','style'));

ALTER TABLE public.invariant_collections
  DROP CONSTRAINT IF EXISTS invariant_collections_namespace_check;
ALTER TABLE public.invariant_collections
  ADD CONSTRAINT invariant_collections_namespace_check
  CHECK (namespace IS NULL OR namespace IN ('constitutional','reasoning','engineering','experience','capability','style'));
