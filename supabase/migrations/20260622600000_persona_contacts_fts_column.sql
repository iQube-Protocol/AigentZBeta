-- Add a generated tsvector column `fts` to persona_contacts so that
-- Supabase's .textSearch('fts', ...) queries work correctly.
-- The GIN index from the original migration targeted the expression directly;
-- this migration drops that index and recreates it on the named column.

ALTER TABLE public.persona_contacts
  ADD COLUMN IF NOT EXISTS fts tsvector
    GENERATED ALWAYS AS (
      to_tsvector('english',
        coalesce(display_name, '') || ' ' ||
        coalesce(first_name, '') || ' ' ||
        coalesce(last_name, '') || ' ' ||
        coalesce(email, '') || ' ' ||
        coalesce(organization, '') || ' ' ||
        coalesce(job_title, '')
      )
    ) STORED;

-- Drop the expression-based index from the original migration (if it exists)
-- and replace with one on the named column.
DROP INDEX IF EXISTS idx_persona_contacts_search;

CREATE INDEX IF NOT EXISTS idx_persona_contacts_fts
  ON public.persona_contacts USING gin(fts);
