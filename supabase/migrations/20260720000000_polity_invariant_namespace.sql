-- Polity invariant namespace — seed-crystal drift fix (2026-07-17).
--
-- The Polity Papers canonization pass 1 added a 13th namespace, `polity`
-- (inv.polity.160-174, operator-ratified to 'canonical'), to the seed crystal
-- (canonical-invariants.seed.json) but the namespace CHECKs were never widened,
-- so the ingest aborts at the polity ontology class
-- ("ontology_classes_namespace_check" violation) and the 15 polity invariants
-- never land. Same additive pattern as the CFS-011/CFS-012 widenings and the
-- five-namespace fix (20260704000000 / 20260704010000 / 20260713000000).

ALTER TABLE public.invariants
  DROP CONSTRAINT IF EXISTS invariants_namespace_check;
ALTER TABLE public.invariants
  ADD CONSTRAINT invariants_namespace_check
  CHECK (namespace IN ('constitutional','reasoning','engineering','experience','capability','style','narrative','sovereignty','cybernetics','interaction','epistemology','representation','polity'));

ALTER TABLE public.ontology_classes
  DROP CONSTRAINT IF EXISTS ontology_classes_namespace_check;
ALTER TABLE public.ontology_classes
  ADD CONSTRAINT ontology_classes_namespace_check
  CHECK (namespace IN ('constitutional','reasoning','engineering','experience','capability','style','narrative','sovereignty','cybernetics','interaction','epistemology','representation','polity'));

ALTER TABLE public.invariant_collections
  DROP CONSTRAINT IF EXISTS invariant_collections_namespace_check;
ALTER TABLE public.invariant_collections
  ADD CONSTRAINT invariant_collections_namespace_check
  CHECK (namespace IS NULL OR namespace IN ('constitutional','reasoning','engineering','experience','capability','style','narrative','sovereignty','cybernetics','interaction','epistemology','representation','polity'));
