-- Phase 3.2 — Alias-anchored receipt attribution columns.
--
-- Every receipt-eligible AccessDecision now lands a row with T2-only
-- attribution (alias commitment + cohort id) so the privacy contract
-- holds when receipts are batched onto Bitcoin in Phase 3.4. The Phase
-- 1 placeholder ('__phase1_pending_alias__') is replaced by real
-- HMAC-SHA256 commitments via services/identity/cohortAliasService.
--
-- Idempotent: every column add uses IF NOT EXISTS.
-- Backfill is a no-op — no receipts have shipped on chain yet.

BEGIN;

ALTER TABLE orchestration_events
  ADD COLUMN IF NOT EXISTS actor_alias_commitment text,
  ADD COLUMN IF NOT EXISTS cohort_id              text,
  ADD COLUMN IF NOT EXISTS receipt_mode           text,
  ADD COLUMN IF NOT EXISTS on_chain_tx_id         text,
  ADD COLUMN IF NOT EXISTS inscription_id         text,
  ADD COLUMN IF NOT EXISTS inscribed_at           timestamptz;

-- receipt_mode CHECK — only enforce on values we set; NULL allowed for
-- legacy rows that predate this column.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'orchestration_events_receipt_mode_check'
  ) THEN
    ALTER TABLE orchestration_events
      ADD CONSTRAINT orchestration_events_receipt_mode_check
      CHECK (receipt_mode IS NULL OR receipt_mode IN ('sync','async-batched','none'));
  END IF;
END $$;

-- Indexes for the Phase 3.4 batcher — pulls
--   WHERE receipt_mode != 'none' AND on_chain_tx_id IS NULL
-- on each cron tick, so a partial index keeps the scan tight even as
-- the events table grows.
CREATE INDEX IF NOT EXISTS idx_orchestration_events_pending_inscription
  ON orchestration_events (created_at)
  WHERE receipt_mode IS NOT NULL
    AND receipt_mode <> 'none'
    AND on_chain_tx_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_orchestration_events_alias_commitment
  ON orchestration_events (actor_alias_commitment)
  WHERE actor_alias_commitment IS NOT NULL;

COMMIT;
