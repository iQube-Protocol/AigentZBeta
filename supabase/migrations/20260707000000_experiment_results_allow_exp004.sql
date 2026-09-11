-- 20260707000000_experiment_results_allow_exp004.sql
--
-- Fix the experiment_results CHECK constraint that rejected EXP-004 at insert.
--
-- Field-reported publish failure (2026-07-07): the original migration
-- (20260704120000_experiment_results.sql) pinned the constraint to
-- CHECK (experiment IN ('EXP-001','EXP-002','EXP-003')). EXP-004 (PSE-1, the
-- Sovereignty Drill) was added to the TypeScript publish union (the
-- /api/experiments/results route + services/experiments/publishResult) but the
-- DB CHECK was never widened — so every EXP-004 publish was rejected by
-- Postgres before it could land. The operator hit this in the Experiment Lab.
--
-- Fix: drop the enumerated constraint and re-add a PATTERN constraint that
-- accepts any well-formed EXP-NNN identifier. This future-proofs new
-- experiments (PSE-2..5 and beyond) — a new experiment leg no longer needs a
-- paired DB migration, only its TS union entry. The application layer remains
-- the source of truth for WHICH experiment ids are legal to publish; the DB
-- constraint's job is only to reject malformed identifiers.
--
-- Additive/idempotent (CFS-010 §3): the original migration is already applied
-- and is NOT edited. DROP ... IF EXISTS + ADD is re-runnable.

ALTER TABLE public.experiment_results
  DROP CONSTRAINT IF EXISTS experiment_results_experiment_check,
  ADD CONSTRAINT experiment_results_experiment_check
    CHECK (experiment ~ '^EXP-[0-9]{3}$');
