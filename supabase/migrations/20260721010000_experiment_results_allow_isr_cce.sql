-- 20260721010000_experiment_results_allow_isr_cce.sql
--
-- Widen the experiment_results CHECK to accept the newly-registered experiment
-- id families so their results can land:
--   • ISR-[0-9]{3}  — Invariant Software Engineering line (ISR-001, ratified 2026-07-21)
--   • CCE-[0-9]{3}  — Constitutional Computing Experiments (CCE-006 / CCE-007, executed)
--
-- The prior constraint (20260721000000) was
--   CHECK (experiment ~ '^(EXP-[0-9]{3}|EXP-P[1-9]|IRV-[0-9]{3}|IPV-[0-9]{3})$')
-- which rejects ISR-* and CCE-* at INSERT (EXP-009 / EXP-010 already pass as
-- EXP-[0-9]{3}). Any publish of an ISR/CCE result — internal (Phase 1, admin
-- route) or external (Phase 2, CFS-042 delegated submission) — would be rejected
-- by Postgres before landing. This is the ISR-001 Phase-1 prerequisite migration
-- (the accurate one; the internal admin route is shape-gated, not allow-listed).
--
-- The application layer remains the source of truth for WHICH ids are legal to
-- publish (route allow-lists); the DB constraint only rejects malformed ids.
--
-- Additive/idempotent (CFS-010 §3): DROP ... IF EXISTS + ADD is re-runnable.

ALTER TABLE public.experiment_results
  DROP CONSTRAINT IF EXISTS experiment_results_experiment_check,
  ADD CONSTRAINT experiment_results_experiment_check
    CHECK (experiment ~ '^(EXP-[0-9]{3}|EXP-P[1-9]|IRV-[0-9]{3}|IPV-[0-9]{3}|ISR-[0-9]{3}|CCE-[0-9]{3})$');
