-- Fix: research_backlog_items.source_note (CFS-051 schema/seed drift)
--
-- Found by the operator on the first real run of the CFS-051 migrations
-- (2026-07-25):
--
--   ERROR: 42703: column "source_note" of relation "research_backlog_items"
--   does not exist
--   LINE 237: (slug, title, description, priority, status, source_note)
--
-- Root cause: `research_backlog_items` was the ONLY one of the four tables in
-- 20260820000000 whose CREATE TABLE omitted `source_note`. Its three sibling
-- tables (research_candidate_experiments / _principles / _invariants) all
-- declare it, the seed migration (20260820000100) inserts it into all four,
-- and the entire TypeScript layer already reads/writes it:
--
--   - types/researchRegistry.ts       — RegistryCommon.sourceNote (BacklogItem extends it)
--   - services/research/registryStore.ts:68   — rowToCommon reads r.source_note
--   - services/research/registryStore.ts:388  — createBacklogItem inserts source_note
--   - services/research/registryStore.ts:496  — EDITABLE_FIELDS.backlog includes source_note
--
-- So the schema was the outlier, not the seed — the column is genuinely
-- wanted on all four tables. This is the same source-of-truth parity defect
-- class CLAUDE.md's "inv.engineering.036/037" section governs, and the second
-- instance found in two days (the first being the activity_receipts
-- action_type CHECK-constraint drift fixed in 20260724120000).
--
-- Additive, idempotent, non-destructive: adds one nullable column. Existing
-- rows read NULL (honest — they were inserted before the column existed and
-- nothing is backfilled or guessed). Safe to run on a database that already
-- applied the corrected 20260820000000 (the IF NOT EXISTS makes it a no-op).

ALTER TABLE public.research_backlog_items
  ADD COLUMN IF NOT EXISTS source_note text;

COMMENT ON COLUMN public.research_backlog_items.source_note IS
  'Honest provenance note — cites the real repo source used to seed/author this row, or states plainly that no charter exists yet. Mirrors the identical column on the three sibling CFS-051 tables. Added by 20260821000000 after the original CREATE TABLE omitted it (schema/seed drift, found 2026-07-25).';
