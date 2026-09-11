-- Commercialisation invariant namespace — PRD-IDE-002, operator ruling 2026-07-27.
--
-- Widens the namespace CHECK constraints to admit `commercialisation`, the
-- class of the horizontal value-realisation invariants discovered by the
-- Invariant Discovery Engine (CFS-048) across three evidence domains
-- (financial-services, media, human-mobility-services).
--
-- FIRST-CLASS, not nested. The operator's ruling is explicit that the three
-- evidence domains are APPLICATION CONTEXTS for commercialisation, not its
-- parent ontology — so the namespace is `commercialisation`, never
-- `finance.commercialisation`. Nesting would subordinate a cross-domain class
-- to its first application domain and make later portability awkward.
--
-- No invariant is CANONIZED by this migration. The eight members seeded into
-- canonical-invariants.seed.json by the same ruling all carry status
-- 'proposed'; inclusion in the experimental crystal is not ratification. The
-- namespace + its composition law (COMPOSITION_LAWS in types/invariants.ts:
-- commercialisation => 'contextual') are widened so the class exists before
-- any member is ingested (CFS-013 §3).
--
-- Same additive pattern as the finance widening (20260721000000), the polity
-- widening (20260720000000), and the 2026-07-13 five-namespace fix.

ALTER TABLE public.invariants
  DROP CONSTRAINT IF EXISTS invariants_namespace_check;
ALTER TABLE public.invariants
  ADD CONSTRAINT invariants_namespace_check
  CHECK (namespace IN ('constitutional','reasoning','engineering','experience','capability','style','narrative','sovereignty','cybernetics','interaction','epistemology','representation','polity','finance','commercialisation'));

ALTER TABLE public.ontology_classes
  DROP CONSTRAINT IF EXISTS ontology_classes_namespace_check;
ALTER TABLE public.ontology_classes
  ADD CONSTRAINT ontology_classes_namespace_check
  CHECK (namespace IN ('constitutional','reasoning','engineering','experience','capability','style','narrative','sovereignty','cybernetics','interaction','epistemology','representation','polity','finance','commercialisation'));

ALTER TABLE public.invariant_collections
  DROP CONSTRAINT IF EXISTS invariant_collections_namespace_check;
ALTER TABLE public.invariant_collections
  ADD CONSTRAINT invariant_collections_namespace_check
  CHECK (namespace IS NULL OR namespace IN ('constitutional','reasoning','engineering','experience','capability','style','narrative','sovereignty','cybernetics','interaction','epistemology','representation','polity','finance','commercialisation'));
