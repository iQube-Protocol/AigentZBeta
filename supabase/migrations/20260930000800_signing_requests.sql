-- 20260930000800_signing_requests.sql
--
-- Wallet Signing Topology (operator ruling 2026-08-01) — the shared
-- SigningRequest substrate. ONE ROW PER SIGNING REQUEST, carried through its
-- own state machine (pending -> approved -> executed, or a terminal
-- refused/expired). A state machine on one row, not a supersede-chain.
--
-- Deliberately a NEW table, not an extension of partner_authorization_requests
-- (20260930000500): that table is explicitly service-role-only (no client
-- route reads it) and agent-role-only (key_ref, no principal signer concept).
-- This table must be readable by a citizen's own wallet UI (the owner
-- self-view exception, CLAUDE.md) for principal-role requests, which is a
-- genuinely different trust boundary. See types/signingRequest.ts and
-- services/signing/signingRequestStore.ts (the only reader/writer).
--
-- NEVER PLAINTEXT KEY MATERIAL and NEVER a raw agent private key — an
-- agent-role request's "signature" is an explicit approval to invoke a
-- bounded custody service (AgentKeyService via
-- services/signing/partnerAuthorizationSigner.ts's pattern); the key itself
-- never touches this table or the browser. A principal-role request's
-- `signature` column holds a real EIP-191 signature (not a commitment) —
-- unlike partner_authorization_requests' signature_ref, this table's client
-- IS the wallet UI that produced it, so it is not a secret in the same
-- sense a server-custodial signing act's key would be; it is verifiable
-- public evidence of the principal's own act, safe for the principal's own
-- self-view.
--
-- NONCE REPLAY PROTECTION at the database layer: UNIQUE (wallet_ref, nonce).

BEGIN;

CREATE TABLE IF NOT EXISTS public.signing_requests (
  id                        TEXT PRIMARY KEY,

  action_kind               TEXT NOT NULL CHECK (action_kind IN (
    'authorize_registration',
    'sign_registry_transaction',
    'authorize_pulse_disclosure',
    'prove_wallet_control',
    'sign_passport_application',
    'claim_citizen_passport',
    'grant_bounded_delegation',
    'accept_delegation',
    'sign_activation'
  )),
  signer_role               TEXT NOT NULL CHECK (signer_role IN ('principal', 'agent', 'issuer')),

  principal_persona_id      TEXT NOT NULL,
  subject_agent_ref         TEXT,
  subject_aigentqube_id     TEXT,
  authority_credential      TEXT,

  wallet_ref                TEXT NOT NULL,
  network                   TEXT NOT NULL,

  payload                   TEXT NOT NULL,
  payload_hash              TEXT NOT NULL,
  consequence               TEXT NOT NULL,

  nonce                     TEXT NOT NULL,
  expires_at                TIMESTAMPTZ NOT NULL,
  receipt_destination       TEXT NOT NULL,

  status                    TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'executed', 'refused', 'expired')),

  signature                 TEXT,
  signer_address            TEXT,

  refusal_code              TEXT,
  refusal_detail            TEXT,

  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at               TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_signing_requests_wallet_nonce
  ON public.signing_requests (wallet_ref, nonce);

CREATE INDEX IF NOT EXISTS idx_signing_requests_principal_status
  ON public.signing_requests (principal_persona_id, status);

CREATE INDEX IF NOT EXISTS idx_signing_requests_wallet_status
  ON public.signing_requests (wallet_ref, status);

COMMENT ON TABLE public.signing_requests IS
  'Wallet Signing Topology (operator ruling 2026-08-01) — durable state machine for a purpose-bound signing/approval request, principal- or agent-role. Never stores raw agent key material; an agent-role approval triggers a bounded custody service, it does not carry a key.';
COMMENT ON COLUMN public.signing_requests.principal_persona_id IS
  'T0 identifier, exposed only via the owner self-view exception (CLAUDE.md): a route may return a request to the SAME persona it belongs to, never to any other caller, never into a receipt or chain-bound record.';
COMMENT ON COLUMN public.signing_requests.wallet_ref IS
  'Which wallet UI this renders in: literal "principal", or an agent runtimeAgentId (e.g. "aigent-nakamoto").';

-- RLS — service-role only. Client reads go through spine-gated API routes
-- (app/api/signing/requests/**) which enforce the owner self-view/agent-role
-- rules in application code, mirroring partner_authorization_requests'
-- posture (20260930000500).
ALTER TABLE public.signing_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS signing_requests_service_only ON public.signing_requests;
CREATE POLICY signing_requests_service_only ON public.signing_requests
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMIT;
