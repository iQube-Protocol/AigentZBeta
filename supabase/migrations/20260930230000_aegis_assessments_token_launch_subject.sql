-- 20260930230000_aegis_assessments_token_launch_subject.sql
--
-- Factor + Aegis Bankr PRD, Phase 4 — widens aegis_assessments.subject_type
-- to admit 'token_launch' (subject_ref = token_launches.id), so Aegis can
-- independently assess a token-launch proposal through the SAME assessment
-- engine (services/aegis/aegisAssessmentService.ts) that already assesses
-- factor_case/agent subjects — never a second, parallel assessment
-- mechanism for this one new subject class. Every existing invariant
-- (self-assessment refusal, critical-finding-blocks-admissible-decision,
-- append-only/superseding, immutability post-ratification) applies
-- unchanged; only the set of valid `subject_type` values grows, additively.

ALTER TABLE public.aegis_assessments DROP CONSTRAINT IF EXISTS aegis_assessments_subject_type_check;
ALTER TABLE public.aegis_assessments
  ADD CONSTRAINT aegis_assessments_subject_type_check
  CHECK (subject_type IN ('factor_case', 'agent', 'token_launch'));
