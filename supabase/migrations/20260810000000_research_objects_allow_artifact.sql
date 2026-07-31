-- 20260810000000_research_objects_allow_artifact.sql
--
-- Widen research_objects.object_kind to accept 'artifact' — the FrozenArtifact
-- rows PRD-EPI-001 §2 introduces (crystal-version, arm-config, task-set,
-- answer-key, judge-config, analysis-config, interpretation-table,
-- execution-run, research-package). Reuses the existing durable-lab-record
-- table (object_kind/object_id/payload/lifecycle_state/receipt_id) rather than
-- creating a parallel table: a FrozenArtifact's extra fields (kind, phase,
-- experimentId, contentHash, commitmentHash, signedBy) live in `payload`,
-- exactly as ResearchExperiment/ResearchFinding/ResearchPublication already do
-- for the other three object_kind values.
--
-- object_id for an artifact row is the FrozenArtifact.id (e.g.
-- 'EXP-P1:crystal-version:v1') — still unique per (object_kind, object_id),
-- so the existing UNIQUE constraint needs no change.
--
-- Additive/idempotent (CFS-010 §3): DROP ... IF EXISTS + ADD is re-runnable.

ALTER TABLE public.research_objects
  DROP CONSTRAINT IF EXISTS research_objects_object_kind_check,
  ADD CONSTRAINT research_objects_object_kind_check
    CHECK (object_kind IN ('experiment', 'finding', 'publication', 'artifact'));

COMMENT ON TABLE public.research_objects IS
  'CCRL working research objects (experiments/findings/publications/artifacts) persisted from operator-approved copilot proposals (CFS-019 C2.2) and PRD-EPI-001 frozen artifacts (§2). Upsert key: (object_kind, object_id). receipt_id = the research_lifecycle_transition receipt recorded on approve/freeze.';
