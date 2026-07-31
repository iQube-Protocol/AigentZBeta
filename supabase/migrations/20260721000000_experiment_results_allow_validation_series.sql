-- 20260721000000_experiment_results_allow_validation_series.sql
--
-- Widen the experiment_results CHECK to accept the Validation Programme series.
--
-- The 20260707000000 migration set CHECK (experiment ~ '^EXP-[0-9]{3}$'), which
-- rejects the new series ids at insert: EXP-P1/P2/P3 (Validation Programme,
-- IRL_VALIDATION_ROADMAP.md) and IRV-001 / IPV-001 (Stage-0 instrument
-- validation). Any publish of those ids -- internal (Phase 1, admin route) or
-- external (Phase 2, CFS-042 delegated submission) -- would be rejected by
-- Postgres before landing. Flagged in CFS-042 §8; this is the Phase-1
-- prerequisite migration.
--
-- The application layer remains the source of truth for WHICH ids are legal to
-- publish (route allow-lists); the DB constraint only rejects malformed ids.
--
-- Additive/idempotent (CFS-010 §3): DROP ... IF EXISTS + ADD is re-runnable.

ALTER TABLE public.experiment_results
  DROP CONSTRAINT IF EXISTS experiment_results_experiment_check,
  ADD CONSTRAINT experiment_results_experiment_check
    CHECK (experiment ~ '^(EXP-[0-9]{3}|EXP-P[1-9]|IRV-[0-9]{3}|IPV-[0-9]{3})$');
