-- =============================================================================
-- Add supabase_title column for editable display titles
-- =============================================================================
-- Run this once in Supabase SQL editor. The codex dashboard now shows two
-- title columns:
--   * Supabase Title  (editable, used by app for display)
--   * Auto-Drive Title (locked at upload time, mirrors what was uploaded)
--
-- Existing rows keep their original `title` (Auto-Drive label) and get a
-- copy of it as the initial editable Supabase title. Edits in the dashboard
-- only modify supabase_title; title stays immutable.
-- =============================================================================

ALTER TABLE codex_media_assets   ADD COLUMN IF NOT EXISTS supabase_title TEXT;
ALTER TABLE master_content_qubes ADD COLUMN IF NOT EXISTS supabase_title TEXT;

UPDATE codex_media_assets   SET supabase_title = title WHERE supabase_title IS NULL;
UPDATE master_content_qubes SET supabase_title = title WHERE supabase_title IS NULL;
