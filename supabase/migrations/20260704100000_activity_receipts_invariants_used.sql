-- 20260704100000_activity_receipts_invariants_used.sql
--
-- CFS-008 §2 measurement instrumentation (Chrysalis Foundation, Phase 5).
--
-- Adds invariants_used to activity_receipts so every grounded execution
-- records WHICH validated invariants it was grounded in — the receipt-spine
-- half of the reuse-count metric ("times an invariant appears in reasoning
-- paths of successful executions"). The invariant-side half (times_used /
-- Reach, Law XII adoption-class) is already accumulated by recordUsage via
-- citeInvariants; this column makes the same fact queryable FROM the receipt,
-- joining executions to the knowledge they spent.
--
-- Mirrors the agents_invoked / tools_used / iqubes_used array pattern.
-- Additive-only (CFS-010 §3); idempotent, re-runnable.

ALTER TABLE public.activity_receipts
  ADD COLUMN IF NOT EXISTS invariants_used text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.activity_receipts.invariants_used IS
  'Invariant ids this receipted act was grounded in (CFS-008 §2 reuse-count instrumentation). Empty for ungrounded acts.';

-- Reuse-count queries filter on membership; a GIN index keeps
-- "which executions used invariant X" cheap as the spine grows.
CREATE INDEX IF NOT EXISTS activity_receipts_invariants_used_idx
  ON public.activity_receipts USING gin (invariants_used);
