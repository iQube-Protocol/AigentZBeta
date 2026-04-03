-- Migration: Add CSV investor enrichment columns to nakamoto_knyt_personas
-- These columns store data sourced from the investor CSV ledger that does not
-- map to any existing column. All are nullable and additive — no existing data
-- is touched by this migration.
--
-- Run AFTER verifying the diff report from scripts/investor_csv_diff.py.
-- Applied via: Supabase SQL editor or supabase db push

ALTER TABLE public."nakamoto_knyt_personas"
  ADD COLUMN IF NOT EXISTS "csv_investment_status"      TEXT    DEFAULT '',
  ADD COLUMN IF NOT EXISTS "csv_first_committed_date"   TEXT    DEFAULT '',
  ADD COLUMN IF NOT EXISTS "csv_last_disbursed_date"    TEXT    DEFAULT '',
  ADD COLUMN IF NOT EXISTS "csv_transfer_methods"       TEXT    DEFAULT '',
  ADD COLUMN IF NOT EXISTS "csv_transaction_count"      INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "csv_metaknyt_nfts"          TEXT    DEFAULT '',
  ADD COLUMN IF NOT EXISTS "csv_other_nfts"             TEXT    DEFAULT '';

COMMENT ON COLUMN public."nakamoto_knyt_personas"."csv_investment_status"
  IS 'Investment status from CSV ledger (e.g. Invested, Committed). Source: investor CSV.';

COMMENT ON COLUMN public."nakamoto_knyt_personas"."csv_first_committed_date"
  IS 'Earliest Date Committed across all investor CSV transactions. ISO date string.';

COMMENT ON COLUMN public."nakamoto_knyt_personas"."csv_last_disbursed_date"
  IS 'Latest Date Disbursed across all investor CSV transactions. ISO date string.';

COMMENT ON COLUMN public."nakamoto_knyt_personas"."csv_transfer_methods"
  IS 'Comma-separated Funds Transfer Methods from CSV (e.g. wire,credit_card).';

COMMENT ON COLUMN public."nakamoto_knyt_personas"."csv_transaction_count"
  IS 'Number of distinct investment transactions in the CSV ledger for this investor.';

COMMENT ON COLUMN public."nakamoto_knyt_personas"."csv_metaknyt_nfts"
  IS 'metaKnyts NFTs Collected as reported in the investor CSV.';

COMMENT ON COLUMN public."nakamoto_knyt_personas"."csv_other_nfts"
  IS 'No of Other NFTs Collected as reported in the investor CSV.';
