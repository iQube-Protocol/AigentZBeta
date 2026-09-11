-- ============================================================================
-- Extend persona_uploads.use_kind to support venture_iqube.
--
-- New value:
--   'venture_iqube' — operator uploaded a Venture iQube JSON file
--                     (schemaVersion: 'venture-iqube/v0.1' or 'v0.2').
--                     /api/persona/venture-iqube/ingest will validate
--                     it against the schema and hydrate ExperienceQube
--                     + queue IntentQube rows from the objectives.
--
-- Idempotent — drops the existing constraint and re-adds it with the
-- expanded value list. Safe to re-run.
-- ============================================================================

ALTER TABLE public.persona_uploads
  DROP CONSTRAINT IF EXISTS persona_uploads_use_kind_check;

ALTER TABLE public.persona_uploads
  ADD CONSTRAINT persona_uploads_use_kind_check
  CHECK (use_kind IN (
    'context',
    'tool',
    'workbench',
    'general',
    'email_attachment',
    'iqube_payload',
    'venture_iqube'
  ));
