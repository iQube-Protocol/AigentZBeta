-- Finance invariant namespace — PRD-MPY-001 §9 D5 (ratified 2026-07-21).
--
-- Widens the namespace CHECK constraints to admit `finance`, the class of the
-- FS Invariant Library (inv.finance.*) that Agent MoneyPenny (the Constitutional
-- Financial Services Agent) reasons over. The library is DERIVED from the
-- QriptoCENT Constitutional Corpus by the Invariant Discovery Engine (CFS-048)
-- and enters at status 'proposed' — no finance invariant is seeded or canonized
-- by this migration. The namespace + its composition law (COMPOSITION_LAWS in
-- types/invariants.ts: finance => 'normative') are widened ahead of the
-- derivation run so the class exists before any candidate lands (CFS-013 §3).
--
-- Same additive pattern as the polity widening (20260720000000) and the
-- CFS-011/CFS-012 / five-namespace fixes (2026070400.. / 20260713000000).

ALTER TABLE public.invariants
  DROP CONSTRAINT IF EXISTS invariants_namespace_check;
ALTER TABLE public.invariants
  ADD CONSTRAINT invariants_namespace_check
  CHECK (namespace IN ('constitutional','reasoning','engineering','experience','capability','style','narrative','sovereignty','cybernetics','interaction','epistemology','representation','polity','finance'));

ALTER TABLE public.ontology_classes
  DROP CONSTRAINT IF EXISTS ontology_classes_namespace_check;
ALTER TABLE public.ontology_classes
  ADD CONSTRAINT ontology_classes_namespace_check
  CHECK (namespace IN ('constitutional','reasoning','engineering','experience','capability','style','narrative','sovereignty','cybernetics','interaction','epistemology','representation','polity','finance'));

ALTER TABLE public.invariant_collections
  DROP CONSTRAINT IF EXISTS invariant_collections_namespace_check;
ALTER TABLE public.invariant_collections
  ADD CONSTRAINT invariant_collections_namespace_check
  CHECK (namespace IS NULL OR namespace IN ('constitutional','reasoning','engineering','experience','capability','style','narrative','sovereignty','cybernetics','interaction','epistemology','representation','polity','finance'));
