-- 20260804000300_partner_authorization_request_message_facts.sql
--
-- GJR-VFY-001 Phase 1 correction (al / Horizen brief, 2026-08-04): Horizen's
-- real `enable_pulse_monitoring` tool requires the submission to carry the
-- EXACT agentId, walletAddress and issuedAt that produced the signed
-- `build_pulse_auth_message` message — never regenerated, never re-derived,
-- at submit time. Those three facts previously lived only in memory during
-- prepare and were never persisted, so a request re-loaded from its row
-- (the pattern every other stage already relies on: network, nonce,
-- expiresAt) had no way to recover them for a resumed/retried submit.
--
-- Nullable: existing rows (pre-fix) have none of these and must not be
-- treated as a data-integrity violation — they are simply requests from
-- before this correction landed, and cannot be resubmitted without
-- re-preparing (a fresh nonce/issuedAt/signature) in any case.

BEGIN;

ALTER TABLE public.partner_authorization_requests
  ADD COLUMN IF NOT EXISTS agent_id TEXT,
  ADD COLUMN IF NOT EXISTS wallet_address TEXT,
  ADD COLUMN IF NOT EXISTS issued_at TEXT;

COMMENT ON COLUMN public.partner_authorization_requests.agent_id IS
  'The DECIMAL on-chain agent id used to build the signed Pulse message (services/horizen/authorizationClient.ts) — read back verbatim at submit, never re-derived.';
COMMENT ON COLUMN public.partner_authorization_requests.wallet_address IS
  'The controller wallet that produced the signature — read back verbatim at submit, never re-derived, so a stale/rotated wallet can never silently diverge from what was actually signed.';
COMMENT ON COLUMN public.partner_authorization_requests.issued_at IS
  'The EXACT issuedAt embedded in build_pulse_auth_message''s returned plaintext (never independently regenerated) — enable_pulse_monitoring''s own schema requires this back verbatim, and Horizen''s signature verification depends on reconstructing the identical message server-side.';

COMMIT;
