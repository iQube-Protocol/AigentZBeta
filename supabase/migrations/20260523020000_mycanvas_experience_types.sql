-- ============================================================================
-- Add entry_type and meta_json to mycanvas_entries.
--
-- entry_type distinguishes between:
--   'note'               — free-form draft (original default)
--   'experience_origin'  — saved reference to a source Experience Qube
--   'experience_derived' — AI-generated remix content (article / story)
--
-- meta_json carries type-specific payload:
--   experience_origin:  { experienceId: string }
--   experience_derived: { contentId, sourceExperienceId, imageUrl, skill }
--   note:               {} (empty)
-- ============================================================================

ALTER TABLE public.mycanvas_entries
  ADD COLUMN IF NOT EXISTS entry_type text NOT NULL DEFAULT 'note'
    CHECK (entry_type IN ('note', 'experience_origin', 'experience_derived')),
  ADD COLUMN IF NOT EXISTS meta_json  jsonb NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_mycanvas_entries_type
  ON public.mycanvas_entries(persona_id, entry_type);

COMMENT ON COLUMN public.mycanvas_entries.entry_type IS
  'Entry kind: note (free-form draft), experience_origin (source capsule bookmark), experience_derived (AI-generated remix).';
COMMENT ON COLUMN public.mycanvas_entries.meta_json IS
  'Type-specific metadata. experience_origin: {experienceId}. experience_derived: {contentId, sourceExperienceId, imageUrl, skill}.';
