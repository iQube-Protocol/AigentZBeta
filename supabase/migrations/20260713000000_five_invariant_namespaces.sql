-- Five invariant namespaces — seed-crystal drift fix (2026-07-13).
--
-- The seed crystal (canonical-invariants.seed.json) grew to 12 namespaces —
-- sovereignty, cybernetics, interaction, epistemology, representation joined
-- after the CFS-012 narrative widening — but the namespace CHECKs were never
-- widened, so the ingest aborts at the first sovereignty ontology class
-- ("ontology_classes_namespace_check" violation) and the 30 newest seed
-- invariants never land. Same additive pattern as the CFS-011/CFS-012
-- widenings (20260704000000 / 20260704010000).
--
-- Composition laws for the five (CFS-013 §3) are declared PROVISIONALLY in
-- types/invariants.ts COMPOSITION_LAWS — operator confirms before any of
-- these namespaces advances to 'canonical'.

ALTER TABLE public.invariants
  DROP CONSTRAINT IF EXISTS invariants_namespace_check;
ALTER TABLE public.invariants
  ADD CONSTRAINT invariants_namespace_check
  CHECK (namespace IN ('constitutional','reasoning','engineering','experience','capability','style','narrative','sovereignty','cybernetics','interaction','epistemology','representation'));

ALTER TABLE public.ontology_classes
  DROP CONSTRAINT IF EXISTS ontology_classes_namespace_check;
ALTER TABLE public.ontology_classes
  ADD CONSTRAINT ontology_classes_namespace_check
  CHECK (namespace IN ('constitutional','reasoning','engineering','experience','capability','style','narrative','sovereignty','cybernetics','interaction','epistemology','representation'));

ALTER TABLE public.invariant_collections
  DROP CONSTRAINT IF EXISTS invariant_collections_namespace_check;
ALTER TABLE public.invariant_collections
  ADD CONSTRAINT invariant_collections_namespace_check
  CHECK (namespace IS NULL OR namespace IN ('constitutional','reasoning','engineering','experience','capability','style','narrative','sovereignty','cybernetics','interaction','epistemology','representation'));
