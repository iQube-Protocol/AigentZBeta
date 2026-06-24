-- ============================================================================
-- Fix persona_contacts upsert: replace partial unique index with a proper
-- unique constraint that Supabase's .upsert(onConflict: ...) can resolve.
--
-- Root cause: the original idx_persona_contacts_source_dedup was a PARTIAL
-- unique index (WHERE source_id IS NOT NULL). PostgreSQL's
-- INSERT ... ON CONFLICT (col1, col2, col3) cannot target a partial index
-- via column-list syntax — it requires either a plain unique index or a
-- named unique constraint. Supabase's .upsert() uses the column-list form,
-- so every batch was rejected silently, counting all contacts as "skipped".
--
-- The new constraint is non-partial. PostgreSQL NULL semantics mean multiple
-- rows with the same (persona_id, source) but NULL source_id are still
-- allowed — NULLs are never considered equal in unique constraints — so
-- manual contacts without a source_id are unaffected.
-- ============================================================================

-- Drop the partial index that was blocking upserts
DROP INDEX IF EXISTS idx_persona_contacts_source_dedup;

-- Add a plain unique constraint on the same columns — now resolvable by upsert
ALTER TABLE public.persona_contacts
  ADD CONSTRAINT persona_contacts_source_dedup_uniq
  UNIQUE (persona_id, source, source_id);
