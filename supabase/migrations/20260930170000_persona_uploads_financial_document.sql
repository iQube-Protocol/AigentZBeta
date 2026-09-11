-- ============================================================================
-- Extend persona_uploads.use_kind to support financial_document.
--
-- New value:
--   'financial_document' — a bank statement / account export the persona
--                          uploaded for MoneyPenny's Financial Profile
--                          capability (SPEC-MPY-002 §5, work package
--                          MPY2-2). Ingested through the EXISTING generic
--                          persona-upload facility (services/uploads/*) —
--                          this is the only schema change MPY2-2 needs on
--                          this table. The raw statement bytes/text live
--                          here (persona_uploads + persona_upload_index),
--                          same as every other use_kind; MPY2-2's own
--                          financial_profile_qubes table (see the paired
--                          migration) stores ONLY derived aggregates, never
--                          a second copy of the raw statement — this table
--                          remains the one truth store for the source
--                          documents (SPEC-MPY-002 §5 hard constraint 2:
--                          "Do NOT create a parallel bank_statements truth
--                          store").
--
-- Idempotent — drops the existing constraint and re-adds it with the
-- expanded value list. Safe to re-run. Mirrors
-- 20260625000000_persona_uploads_standing_document.sql exactly.
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
    'standing_document',
    'financial_document'
  ));
