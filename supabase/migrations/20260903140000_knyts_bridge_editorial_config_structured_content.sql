-- KNYTS/CI Bridge — structured_content column (CFS content pack editorial
-- coverage completion, 2026-09-03)
--
-- Extends the EXISTING knyts_bridge_editorial_config table with one
-- nullable jsonb column, the same additive shape as infographic_url
-- (20260902010000) — no new table, no forked config store. Carries the
-- CFS stage's topics/understanding-checks/exercise summary/CI+KNYTS
-- contextual lines/asset caption+alt/lesson label as ONE coherent blob per
-- section, written and read atomically through the SAME
-- getKnytsBridgeEditorialSection/upsertKnytsBridgeEditorialSection
-- functions every other field already uses — never a second store, never a
-- partial write of related copy.
--
-- Additive only (IF NOT EXISTS) — safe to run against the live table
-- without touching any existing row/column.

ALTER TABLE knyts_bridge_editorial_config
  ADD COLUMN IF NOT EXISTS structured_content JSONB;
