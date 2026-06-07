-- 20260603100000_activity_receipts_specialist_response.sql
--
-- Adds activity_receipts.specialist_response (jsonb) so the body of a
-- specialist consultation — title, summary, recommendations, suggested
-- artifacts, confidence, source — is durable on the receipt itself.
--
-- Closes the operator-reported gap where myLedger / myWorkspace
-- pills could see that Marketa had been consulted but had no way to
-- read what she actually said. Previously the SpecialistResponse
-- lived only in the chat-stream API payload and was lost when the
-- session closed.
--
-- Idempotent: re-runnable. Column is nullable, default NULL.
-- T0 / privacy: specialist_response is persona-scoped (RLS on the
-- parent row already gates by persona_id) and never leaves the
-- server unsanitized — the API surfaces serialize through the
-- existing T1-safe receipt projection.

ALTER TABLE public.activity_receipts
  ADD COLUMN IF NOT EXISTS specialist_response jsonb;

COMMENT ON COLUMN public.activity_receipts.specialist_response IS
  'SpecialistResponse payload captured at consultation time. Carries title, summary, recommendations[], suggestedArtifacts[], confidence, source. Null for non-consultation receipts.';
