-- 20260722000000_experiment_results_generic_id.sql
--
-- Make experiment publishing GLOBAL BY SHAPE (operator direction 2026-07-20).
--
-- Every prior migration widened this CHECK one experiment (family) at a time:
--   20260704120000  CHECK (experiment IN ('EXP-001','EXP-002','EXP-003'))
--   20260707000000  CHECK (experiment ~ '^EXP-[0-9]{3}$')           -- + EXP-004
--   20260721000000  CHECK (experiment ~ '^(EXP-[0-9]{3}|EXP-P[1-9]|IRV-[0-9]{3}|IPV-[0-9]{3})$')
-- so a new experiment (EXP-005/006, and every one after) needed a fresh
-- migration + app-allowlist edit before its completed run could save — the
-- run was silently lost on navigation until then.
--
-- Replace the enumerated-family pattern with a generic experiment-id SHAPE:
-- an uppercase code with at least one hyphenated segment (EXP-006, EXP-P1,
-- IRV-001, IPV-001, and any future family like PSE-001 / CVR-003). The
-- application layer (/api/experiments/results) validates the SAME shape, so
-- app + DB agree. Approval-before-canon is unchanged and enforced elsewhere:
-- the `visibility` column stays 'private' / 'pending' for user submissions and
-- only a steward promotes 'pending' → 'published'. Widening the id shape does
-- NOT widen who can publish to canon.
--
-- Backward-compatible: every id the prior CHECK accepted still matches, so no
-- existing row is invalidated. Idempotent (DROP IF EXISTS + ADD).

ALTER TABLE public.experiment_results
  DROP CONSTRAINT IF EXISTS experiment_results_experiment_check,
  ADD CONSTRAINT experiment_results_experiment_check
    CHECK (experiment ~ '^[A-Z][A-Z0-9]*(-[A-Z0-9]+)+$');
