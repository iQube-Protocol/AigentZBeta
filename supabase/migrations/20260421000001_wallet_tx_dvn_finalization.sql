-- Add DVN finalization tracking columns to wallet_transactions
-- Mirrors the provisional/finalized_at pattern on registry_receipts and qc_events

ALTER TABLE wallet_transactions
  ADD COLUMN IF NOT EXISTS provisional BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMPTZ;

-- Back-fill: existing rows that have a dvn_batch_id were already submitted,
-- but we cannot confirm finalization retroactively, so leave them provisional=true.
-- Rows with no dvn_batch_id (not yet submitted) stay provisional=true by default.

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_provisional
  ON wallet_transactions(provisional)
  WHERE provisional = true;
