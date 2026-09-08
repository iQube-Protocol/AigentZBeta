-- 20260930320000_ctp_transition_evidence_didqube_resolution.sql
--
-- DiDQube Phase 4 item 3 (execution plan §Phase 4) — CTP becomes the third
-- consumer of the canonical resolveDiDQube resolver. Purely ADDITIVE: four
-- nullable columns on ctp_transition_evidence, no change to any existing
-- column, constraint, or the table's discriminated SUCCESS/REFUSED shape.
--
-- Populated by services/ctp/subjectIdentityResolution.ts, resolved ONCE per
-- invocation by the Constitutional Runtime (services/ctp/
-- constitutionalRuntime.ts) right after participant resolution, and carried
-- onto BOTH a success receipt and any LATER refusal (one that already knows
-- subjectPersonaId). Never a gate on authority, authorization, or execution
-- — a persona with no resolvable DiDQube leaves all four columns NULL,
-- honestly, exactly like the pattern already shipped for aegis_assessments
-- (20260930310000).

BEGIN;

ALTER TABLE public.ctp_transition_evidence
  ADD COLUMN IF NOT EXISTS subject_didqube_id UUID,
  ADD COLUMN IF NOT EXISTS subject_didqube_class TEXT,
  ADD COLUMN IF NOT EXISTS subject_resolution_commitment TEXT,
  ADD COLUMN IF NOT EXISTS subject_resolution_commitment_version TEXT;

ALTER TABLE public.ctp_transition_evidence
  DROP CONSTRAINT IF EXISTS chk_ctp_transition_evidence_subject_didqube_class;
ALTER TABLE public.ctp_transition_evidence
  ADD CONSTRAINT chk_ctp_transition_evidence_subject_didqube_class
  CHECK (subject_didqube_class IS NULL OR subject_didqube_class IN ('natural_person', 'agent'));

COMMENT ON COLUMN public.ctp_transition_evidence.subject_didqube_id IS
  'DiDQube Phase 4 item 3 (2026-09-07). The resolved DiDQube container id (didqubes.didqube_id) for this transition''s subject, via services/ctp/subjectIdentityResolution.ts -> services/identity/didQubeResolver.ts::resolveDiDQube -- NULL when the persona -> kybe_identity walk found no populated linkage, or the resolution did not reach state=resolved. Additive evidence only; never gates authority/authorization/execution.';

COMMIT;
