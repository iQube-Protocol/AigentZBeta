-- 20260606120000_activity_receipts_connector_fields.sql
--
-- Adds three columns to activity_receipts so that artifact_created
-- receipts carry the connector dispatch metadata that was previously
-- computed in create-artifact/route.ts but never persisted.
--
-- Without these columns the IntentChainPanel can only show "Approve doc"
-- on an artifact_created row — it has no connector id to call, so the
-- email / document share never actually executes.
--
-- Idempotent: re-runnable. All columns nullable, default NULL.

ALTER TABLE public.activity_receipts
  ADD COLUMN IF NOT EXISTS action_connector_id    text,
  ADD COLUMN IF NOT EXISTS action_connector_label text,
  ADD COLUMN IF NOT EXISTS action_input           jsonb;

COMMENT ON COLUMN public.activity_receipts.action_connector_id IS
  'Connector to invoke when the operator clicks Send on this artifact (e.g. google.gmail.send, marketa.send-transactional). NULL for runtime-only artifacts.';

COMMENT ON COLUMN public.activity_receipts.action_connector_label IS
  'Human-readable label for the Send button (e.g. "Send draft", "Send via Mailjet"). NULL when no connector.';

COMMENT ON COLUMN public.activity_receipts.action_input IS
  'Input payload forwarded to action_connector_id at dispatch time. NULL when no connector.';
