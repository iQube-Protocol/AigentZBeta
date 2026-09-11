-- 20260930000100_research_objects_allow_review.sql
--
-- Widen research_objects.object_kind to accept 'review' — the IRL-REVIEW-001
-- independent-review records the Lab surface creates (SPEC §12: New Review /
-- Review Queue / Review Result).
--
-- Reuses the existing durable-lab-record table exactly as the 'artifact'
-- widening did, and for the same reason: SPEC §12 says "reuse the existing
-- workspace, receipts, evidence and agent-routing primitives — do not build a
-- separate review-management product". A review's fields (frozen package,
-- reviewer assignments with requested AND resolved model ids, coverage,
-- decisions, resolutions, receipt) live in `payload`, exactly as the other four
-- object_kind values already do.
--
-- object_id is the reviewId (e.g. 'review.vP1.ab12cd34ef56'), so the existing
-- UNIQUE (object_kind, object_id) needs no change.
--
-- lifecycle_state carries the queue state the Review Queue view reads:
--   'planned' | 'running' | 'completed' | 'contested' | 'resolved'
-- It is NOT the reviewed asset's lifecycle. A review never changes the asset's
-- state — that is the whole point of the capability (SPEC §1), and the fact
-- that both live in a column called lifecycle_state is a coincidence of the
-- shared table, not a coupling.
--
-- Additive/idempotent (CFS-010 §3): DROP ... IF EXISTS + ADD is re-runnable.

ALTER TABLE public.research_objects
  DROP CONSTRAINT IF EXISTS research_objects_object_kind_check,
  ADD CONSTRAINT research_objects_object_kind_check
    CHECK (object_kind IN ('experiment', 'finding', 'publication', 'artifact', 'review'));

COMMENT ON TABLE public.research_objects IS
  'CCRL working research objects (experiments/findings/publications/artifacts/reviews) persisted from operator-approved copilot proposals (CFS-019 C2.2), PRD-EPI-001 frozen artifacts (§2), and IRL-REVIEW-001 independent reviews (SPEC §12). Upsert key: (object_kind, object_id). receipt_id = the lifecycle/review receipt recorded on approve/freeze/review-completion.';
