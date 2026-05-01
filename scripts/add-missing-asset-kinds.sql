-- =============================================================================
-- Add missing values to codex_asset_kind enum
-- =============================================================================
-- The original schema (scripts/create-codex-content-tables.sql) defined the
-- codex_asset_kind enum without `ra_badge`, `cover_motion`, or `bundle_pack`,
-- but the upload modal lets operators upload these kinds. Without the enum
-- values, every such upload fails with:
--   "invalid input value for enum codex_asset_kind: ..."
--
-- Run this once in the Supabase SQL editor. Each ALTER TYPE ADD VALUE must
-- be a separate statement (Postgres restriction) — paste all three lines.
-- =============================================================================

ALTER TYPE codex_asset_kind ADD VALUE IF NOT EXISTS 'ra_badge';
ALTER TYPE codex_asset_kind ADD VALUE IF NOT EXISTS 'cover_motion';
ALTER TYPE codex_asset_kind ADD VALUE IF NOT EXISTS 'bundle_pack';
