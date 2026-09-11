-- 20260930001100_linked_external_wallets.sql
--
-- Linked external wallets (operator ruling 2026-08-02, wallet-binding trace #121).
--
-- The trace found the operator's real MetaMask address in
-- `personas.evm_address` — the PRINCIPAL address field — written there by
-- `app/api/iqube/persona/passport/mint` after validating it as well-FORMED.
-- That write path is closed. The address is real and must be preserved, but
-- removed from principal-wallet authority:
--
--   > "Preserve the external wallet relationship but remove it from
--   >  principal-wallet authority."
--
-- DELIBERATELY A NEW TABLE, not an extension of wallet_alias_commitments
-- (20260429000000). That table's own header states it stores ONLY commitment
-- hashes and never plaintext addresses ("the actual wallet address lives in
-- the persona's blakQube"); it is keyed by did_persona_id / root_identity_id
-- for ICP Escrow alias ROTATION (alias_ttl_days, expires_at, status); and it
-- has no column for a provider, a proof reference, or an authority role.
-- Proving control means recovering an address from a signature and COMPARING
-- it — which a commitment hash cannot support. Overloading it would require
-- either storing a plaintext address in a table that forbids one, or giving up
-- the proof ceremony.
--
-- NEVER KEY MATERIAL. This table holds a public address and public evidence
-- about it. An external wallet's key never touches the platform by definition
-- — that is what makes it external.
--
-- See services/wallet/linkedExternalWallet.ts (the only reader/writer).

BEGIN;

CREATE TABLE IF NOT EXISTS public.linked_external_wallets (
  id                          TEXT PRIMARY KEY,

  subject_persona_id          TEXT NOT NULL,

  -- Single-valued today. A CHECK rather than a comment so a second wallet_type
  -- has to be added deliberately, alongside a decision about the column below it.
  wallet_type                 TEXT NOT NULL DEFAULT 'external_linked'
    CHECK (wallet_type = 'external_linked'),

  provider                    TEXT NOT NULL
    CHECK (provider IN ('metamask', 'phantom', 'unisat', 'walletconnect', 'unknown')),
  chain                       TEXT NOT NULL CHECK (chain IN ('evm', 'btc', 'sol')),

  -- Plaintext, lowercased. This is precisely what wallet_alias_commitments
  -- cannot hold, and precisely what the proof ceremony must compare against.
  address                     TEXT NOT NULL,

  control_status              TEXT NOT NULL DEFAULT 'unproven'
    CHECK (control_status IN ('unproven', 'proven')),
  -- The signing_requests id that proved control. NULL while unproven, and
  -- REQUIRED once proven — a proven row with no proof is an assertion.
  proof_ref                   TEXT,
  proven_at                   TIMESTAMPTZ,

  authority_role              TEXT NOT NULL DEFAULT 'execution_instrument'
    CHECK (authority_role = 'execution_instrument'),

  -- Not a default and not administrator-settable. Proving control does not
  -- lift this: the ceiling is the custody model, not the strength of the
  -- evidence. Operator: "Neither may satisfy principal mandate authority."
  may_sign_principal_mandate  BOOLEAN NOT NULL DEFAULT FALSE
    CHECK (may_sign_principal_mandate = FALSE),

  -- Where the binding came from, so a row the platform migrated on the
  -- operator's behalf is never indistinguishable from one they deliberately
  -- linked. 'passport-mint-route' means nobody asked them.
  originating_write_path      TEXT NOT NULL,

  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT linked_external_wallets_proof_complete CHECK (
    (control_status = 'unproven' AND proof_ref IS NULL AND proven_at IS NULL)
    OR
    (control_status = 'proven' AND proof_ref IS NOT NULL AND proven_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_linked_external_wallets_subject_chain_address
  ON public.linked_external_wallets (subject_persona_id, chain, lower(address));

CREATE INDEX IF NOT EXISTS idx_linked_external_wallets_subject
  ON public.linked_external_wallets (subject_persona_id, control_status);

COMMENT ON TABLE public.linked_external_wallets IS
  'Linked external wallets (operator ruling 2026-08-02) — execution instruments held BESIDE the principal wallet, never inside it. Never key material: an external wallet''s key never reaches the platform. The principal-wallet resolver (services/identity/personaAddressResolver.ts) must never read this table.';
COMMENT ON COLUMN public.linked_external_wallets.subject_persona_id IS
  'T0 identifier, exposed only via the owner self-view exception (CLAUDE.md): never into a receipt, a broadcast, or any chain-bound record.';
COMMENT ON COLUMN public.linked_external_wallets.control_status IS
  'Every migrated binding starts unproven. An address submitted to an API route was validated as well-formed, never as controlled — no nonce, no signature, no recovery. Proof requires a fresh nonce, a signature over it, and a recovered address that matches.';
COMMENT ON COLUMN public.linked_external_wallets.may_sign_principal_mandate IS
  'Always FALSE, enforced by CHECK rather than left as a default. A proven external wallet is still not principal custody.';

-- RLS — service-role only. Client reads go through spine-gated API routes that
-- enforce the owner self-view rule in application code, mirroring
-- signing_requests (20260930000800).
ALTER TABLE public.linked_external_wallets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS linked_external_wallets_service_only ON public.linked_external_wallets;
CREATE POLICY linked_external_wallets_service_only ON public.linked_external_wallets
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMIT;
