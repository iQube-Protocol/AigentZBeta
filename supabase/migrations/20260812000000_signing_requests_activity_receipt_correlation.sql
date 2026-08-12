-- 20260812000000_signing_requests_activity_receipt_correlation.sql
--
-- SmartWallet Durable Correlation — Phase A Closure (2026-08-12)
--
-- Establishes the join between signing_requests (wallet ceremony outcomes) and
-- activity_receipts (observable completed acts). A signing request that is approved
-- triggers a bounded custody act (signature, transaction execution, delegation approval);
-- that act is receipted in activity_receipts. This migration adds the FK so the two
-- tables can be joined to trace: approval ceremony → custody act → receipt.
--
-- The `related_activity_receipt_id` is written when the approval is processed and
-- the downstream act completes. It is read by the completed-act projection to map
-- signing decisions back to their consequences.

ALTER TABLE public.signing_requests
ADD COLUMN IF NOT EXISTS related_activity_receipt_id uuid REFERENCES public.activity_receipts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_signing_requests_activity_receipt_correlation
  ON public.signing_requests (related_activity_receipt_id);

COMMENT ON COLUMN public.signing_requests.related_activity_receipt_id IS
  'References the activity_receipt written when this signing request''s approved act completes. Enables tracing from approval ceremony to custody act outcome.';
