-- 20260930002600_activity_receipts_agents_invoked_gin_index.sql
--
-- GIN index on activity_receipts.agents_invoked (Final Horizen Projection
-- Reconciliation / URGENT SEQUENCING CORRECTION, 2026-08-09).
--
-- `findAgentReceiptRefs` (services/receipts/activityReceiptService.ts) —
-- the sole reader every agent-scoped journey observer, ops forensics route,
-- and preflight check goes through — filters on
-- `agents_invoked @> ARRAY[runtimeAgentId]` (array containment). The
-- original 20260514000000_activity_receipts.sql migration indexed
-- `action_type` and `created_at` but never `agents_invoked` itself: a
-- plain B-tree index cannot accelerate an array-containment predicate at
-- all, so every one of these lookups falls back to a sequential filter.
--
-- Observed live, 2026-08-09: `GET /api/ops/journey/agent-forensics` timed
-- out on a single-action-type query
-- (`findAgentReceiptRefs failed for action_type "standing_accrued":
-- TimeoutError`) — exactly the class of query this index accelerates.
-- Additive only: no data change, no application code change required, safe
-- to apply independent of everything else in this migration set.
BEGIN;

CREATE INDEX IF NOT EXISTS idx_activity_receipts_agents_invoked
  ON public.activity_receipts USING GIN (agents_invoked);

COMMIT;
