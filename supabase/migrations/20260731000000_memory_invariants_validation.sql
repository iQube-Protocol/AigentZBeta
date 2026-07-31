-- 20260731000000_memory_invariants_validation.sql
--
-- CFS-045-A1 Partnership Memory (ratified 2026-07-19): the human-validation
-- tier. Memory records validated products of human–machine reasoning — the
-- two-tier promotion separates machine-promoted working inference (`active`)
-- from partnership-ratified memory (`human_validated`).
--
-- Review bookkeeping: validated_at is stamped on BOTH review actions
-- (validate AND reject), so reviewed = validated_at IS NOT NULL and
-- acceptance rate = human_validated ÷ reviewed — no extra column needed.

ALTER TABLE public.memory_invariants
  ADD COLUMN IF NOT EXISTS human_validated boolean NOT NULL DEFAULT false;

ALTER TABLE public.memory_invariants
  ADD COLUMN IF NOT EXISTS validated_at timestamptz;
