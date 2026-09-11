-- ============================================================================
-- Extend persona_uploads.use_kind to support standing_document.
--
-- New value:
--   'standing_document' — operator uploaded a proof-of-work document (e.g. a
--                         partner proposal) as a Standing signal. Logged via
--                         /api/assistant/standing-signal, it accrues Personal
--                         Standing and becomes context for aigentMe follow-ups.
--
-- Idempotent — drops the existing constraint and re-adds it with the expanded
-- value list. Safe to re-run.
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
    'venture_iqube',
    'standing_document'
  ));
