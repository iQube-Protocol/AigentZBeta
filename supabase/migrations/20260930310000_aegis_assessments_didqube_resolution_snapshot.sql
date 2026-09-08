-- 20260930310000_aegis_assessments_didqube_resolution_snapshot.sql
--
-- DiDQube Phase 4 item 2 (execution plan §Phase 4) — Aegis becomes the
-- second consumer of the canonical resolveDiDQube resolver. Purely
-- ADDITIVE: five nullable columns on aegis_assessments, no change to the
-- table's existing business-subject reference (subject_type/subject_ref),
-- no change to any existing constraint, no backfill.
--
-- subject_ref (a factor_case id or a token_launch id, per the existing
-- CHECK) does not itself name a resolvable DiDQube anchor, so these columns
-- are populated ONLY when a caller explicitly supplies an identity-
-- resolution input at createAssessment time (services/aegis/
-- aegisAssessmentService.ts) — never guessed or re-derived from subject_ref.
-- Absent input leaves all five columns NULL, honestly, rather than
-- fabricating a resolution.
--
-- Written ONCE at INSERT time and never updated afterward (verified: no
-- UPDATE statement in aegisAssessmentService.ts touches these columns) --
-- an identity change after the fact requires a NEW, superseding assessment
-- (the same successor pattern supersedes_assessment_id/superseded_by
-- already implements for every other assessment field), never mutating an
-- existing row. This mirrors the Phase 3 successor-credential pattern
-- exactly, using a mechanism this table already had.

BEGIN;

ALTER TABLE public.aegis_assessments
  ADD COLUMN IF NOT EXISTS subject_didqube_id UUID,
  ADD COLUMN IF NOT EXISTS subject_didqube_class TEXT,
  ADD COLUMN IF NOT EXISTS subject_resolution_commitment TEXT,
  ADD COLUMN IF NOT EXISTS subject_resolution_commitment_version TEXT,
  ADD COLUMN IF NOT EXISTS identity_resolution_snapshot_hash TEXT;

ALTER TABLE public.aegis_assessments
  DROP CONSTRAINT IF EXISTS chk_aegis_assessments_subject_didqube_class;
ALTER TABLE public.aegis_assessments
  ADD CONSTRAINT chk_aegis_assessments_subject_didqube_class
  CHECK (subject_didqube_class IS NULL OR subject_didqube_class IN ('natural_person', 'agent'));

COMMENT ON COLUMN public.aegis_assessments.subject_didqube_id IS
  'DiDQube Phase 4 item 2 (2026-09-07). The resolved DiDQube container id (didqubes.didqube_id) for this assessment''s subject, via services/identity/didQubeResolver.ts::resolveDiDQube -- NULL when no identity-resolution input was supplied or the resolution did not reach state=resolved. Never re-derived or updated after this row is created.';
COMMENT ON COLUMN public.aegis_assessments.identity_resolution_snapshot_hash IS
  'Commitment over the resolved DiDQubePrimitive at evidence-lock time (constitutional anchor, current identity primitive, passport credential existence/usability, public commitment) -- services/factor/canonical.ts::commit. A later identity change never mutates this row; it requires a new, superseding assessment (supersedes_assessment_id), exactly mirroring the Phase 3 successor-credential pattern.';

COMMIT;
