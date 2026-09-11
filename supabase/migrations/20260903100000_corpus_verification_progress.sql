-- 20260903100000_corpus_verification_progress.sql
--
-- Institution verification wall-clock granularity repair (2026-08-31, live
-- 504 on `POST .../acquisition/verify-step` for BIS after the 19-ratified/
-- 0-verified fix shipped in 8360afc64).
--
-- WHY: `verifyInstitutionEntry` (services/corpusScout/registryVerification.ts)
-- chains THREE external-HTTP-heavy operations in one call -- resolve the
-- seed URL, discover document candidates (itself up to 6 sequential page
-- fetches), then fetch+inspect up to 5 candidate documents -- any one of
-- which can independently stall. One HTTP request performing all of that
-- can exceed the hosting request ceiling even though each individual
-- operation is itself bounded by its own retry policy.
--
-- This column is the durable, resumable checkpoint: while an institution's
-- verification is in flight (`verification_status = 'pending_verification'`),
-- `verification_progress` records exactly which phase and cursor the NEXT
-- bounded request should resume from, plus the evidence already accumulated
-- (discovered candidates, qualifying documents found so far). It is cleared
-- the moment a terminal outcome is applied (verified / verification_failed /
-- insufficient_corpus / temporarily_unavailable / redirect_changed) -- it is
-- scratch state for an in-flight run, never a second copy of the durable
-- outcome (`verification_detail` remains that single source of truth).

ALTER TABLE public.corpus_institutional_registry
  ADD COLUMN IF NOT EXISTS verification_progress jsonb;

COMMENT ON COLUMN public.corpus_institutional_registry.verification_progress IS
  'Resumable checkpoint for an in-flight verification run (phase, cursor, discovered candidates, qualifying documents so far) -- services/corpusScout/registryVerification.ts::runVerificationStep. NULL when no run is in flight; always cleared when a terminal outcome is applied.';
