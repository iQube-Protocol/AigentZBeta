-- ============================================================================
-- Extend persona_uploads.use_kind to support attachment + iqube paths.
--
-- New values:
--   'email_attachment' — operator uploaded this to attach to an outbound
--                        email (Gmail draft / Marketa). The compose
--                        modals expose an attachment picker that lists
--                        ready uploads, prioritising this kind first.
--   'iqube_payload'    — operator uploaded this to embed inside an
--                        iQube. The iqubeUploadEmbed helper resolves
--                        this reference at iQube assembly time.
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
    'iqube_payload'
  ));
