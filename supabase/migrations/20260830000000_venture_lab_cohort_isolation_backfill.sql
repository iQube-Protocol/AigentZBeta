-- 20260830000000_venture_lab_cohort_isolation_backfill.sql
--
-- Cohort isolation (operator ruling 2026-07-28, Amendment G to
-- codexes/packs/agentiq/updates/2026-07-27_horizen-workspace-phase0-audit.md):
-- "A generic venture-lab membership must never confer access across all pilot
-- cohorts." The read-time gate (services/passport/participationTabGate.ts
-- satisfiesWorkspaceScope, app/api/venture/workspace/[workspaceId]/route.ts)
-- now treats an UNSCOPED venture-lab grant (allowed_experiments NULL/empty) as
-- "no workspace access" rather than "all pilots" — the opposite of the
-- pre-existing research-lab default, which is left untouched (see the
-- decision note in participationTabGate.ts).
--
-- This is a MEANING change, not a schema change, so it needs a one-time data
-- backfill: every currently-active, currently-unscoped venture-lab grant is
-- made explicit for the one pilot that exists today (horizen-pilot-series-001)
-- so no existing Horizen participant loses access the moment the new
-- semantics ship. This is access-preserving by construction — every backfilled
-- row already had, in practice, exactly one pilot to be a member of.
--
-- Idempotent: re-running only touches rows that are still unscoped.

UPDATE public.access_grants
SET allowed_experiments = ARRAY['horizen-pilot-series-001']
WHERE access_domain = 'venture-lab'
  AND status = 'active'
  AND (allowed_experiments IS NULL OR array_length(allowed_experiments, 1) IS NULL);
