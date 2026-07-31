-- ============================================================================
-- codex_tabs.type CHECK constraint extension — admit the 'template' literal.
--
-- BUG FIX: Phase 5 + Phase 6 added 'template' to the TS CodexTabType union
-- and the wizard writes `type = 'template'` rows, but the underlying CHECK
-- constraint on `codex_tabs.type` was never extended — the original
-- migration (supabase/migrations/20250101_codex_registry.sql:30) constrained
-- it to ('static', 'dynamic', 'liquid-ui'). Every wizard save fails with:
--
--   new row for relation "codex_tabs" violates check constraint
--   "codex_tabs_type_check"
--
-- This migration:
--   1. Drops the legacy constraint.
--   2. Re-adds it with 'template' admitted.
--
-- Idempotent — uses IF EXISTS so re-running is safe. Cheap operation; no
-- table rewrite (CHECK constraints are validated row-by-row but the table
-- is small).
-- ============================================================================

ALTER TABLE public.codex_tabs DROP CONSTRAINT IF EXISTS codex_tabs_type_check;

ALTER TABLE public.codex_tabs
  ADD CONSTRAINT codex_tabs_type_check
  CHECK (type IN ('static', 'dynamic', 'liquid-ui', 'template'));

COMMENT ON CONSTRAINT codex_tabs_type_check ON public.codex_tabs IS
  'Allowed tab type discriminator. Mirrors types/codex.ts CodexTabType union. ''template'' admitted 2026-06-02 (Phase 5 of myCartridge PRD) when TabRenderer dispatched to TAB_TEMPLATES.';
