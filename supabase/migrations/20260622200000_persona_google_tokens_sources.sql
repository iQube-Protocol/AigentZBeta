-- Extend persona_google_tokens source constraint to include sheets and contacts.
-- The original migration only listed the first 5 sources; sheets was added later
-- without updating the constraint, and contacts was added in the contacts-import
-- session on 2026-06-22.

ALTER TABLE public.persona_google_tokens
  DROP CONSTRAINT IF EXISTS persona_google_tokens_source_check;

-- The UNIQUE constraint references the column but not the check — drop the old
-- inline check that was defined directly on the column definition.
-- Postgres stores column-level CHECKs as unnamed or auto-named constraints;
-- find and drop any remaining source check before re-adding.
DO $$
DECLARE
  con_name text;
BEGIN
  SELECT conname INTO con_name
  FROM pg_constraint
  WHERE conrelid = 'public.persona_google_tokens'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%source%';
  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.persona_google_tokens DROP CONSTRAINT %I', con_name);
  END IF;
END $$;

ALTER TABLE public.persona_google_tokens
  ADD CONSTRAINT persona_google_tokens_source_check
    CHECK (source IN ('gmail', 'calendar', 'drive', 'docs', 'slides', 'sheets', 'contacts'));
