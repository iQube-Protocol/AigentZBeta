-- KNYTS/CI Bridge — infographic_url column (A2 completion, 2026-09-02)
--
-- Extends the EXISTING knyts_bridge_editorial_config table (applied
-- 20260930002700) with one nullable column, the same shape as the existing
-- video_url/poster_url pair — no new table, no forked config store.
-- bridgeContentPlacements.ts's publishPlacement writes into this column for
-- the 'infographic' slot via the SAME upsertKnytsBridgeEditorialSection
-- function video/poster already use.
--
-- Additive only (IF NOT EXISTS) — safe to run against the live table
-- without touching any existing row/column.

ALTER TABLE knyts_bridge_editorial_config
  ADD COLUMN IF NOT EXISTS infographic_url TEXT;
