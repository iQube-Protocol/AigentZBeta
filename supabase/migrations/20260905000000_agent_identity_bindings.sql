-- 20260905000000_agent_identity_bindings.sql
--
-- The ERC-8004 identity binding table — metaProof × Horizen Labs pilot,
-- Slice A (operator rulings 2026-07-28).
--
-- WHY A TABLE AND NOT A COLUMN. The operator's ruling opens: "Do not place an
-- unverified token ID directly on a delegation row and call that a binding."
-- A binding has to be able to answer WHO owned the token when the claim was
-- made, HOW the claim was proven, WHEN it took effect, whether ownership has
-- been re-checked recently enough to carry new authority, and whether it is
-- still in force. None of that fits in a `token_id TEXT` column on
-- delegation_grants, and a binding that cannot answer them is exactly the
-- unverified association the ruling forbids.
--
-- THE CHAIN THIS CLOSES:
--   passport holder -> delegation grant -> agent_root_did
--     -> ERC-8004 identity binding (this table) -> network + chain_id + token_id
--
-- NETWORK-QUALIFIED, ALWAYS. tokenId 7866 exists on Base Sepolia AND Base
-- Mainnet and names DIFFERENT agents (Horizen brief 4.4). Every index and every
-- uniqueness rule below is on (network, chain_id, token_id) — never token_id
-- alone. A unique index on token_id would silently merge two unrelated agents.
--
-- FOUR ORTHOGONAL FACETS, FOUR COLUMNS (operator addition 1). ownership
-- verified / operator relationship claimed / delegation active / runtime
-- admission eligible are stored SEPARATELY and none is generated from another.
-- An agent can be wallet-controlled but not passport-claimed, passport-claimed
-- but not delegated, or fully bound but not admitted to the Financial Services
-- Runtime. A single `verified` boolean would force Slices E and G to undo an
-- overcompressed model.
--
-- OWNERSHIP FRESHNESS (operator addition 2). The pilot invariant is NOT
-- "transfers are detected instantly" — REST polling cannot deliver that. It is:
-- "no new consequential action may rely on a binding whose ownership has not
-- been checked within the permitted freshness window." Hence
-- ownership_checked_at / owner_wallet_at_check / ownership_status /
-- ownership_check_source. The window itself is application policy
-- (OWNERSHIP_FRESHNESS_WINDOW_MS in services/horizen/agentBinding.ts), not a
-- constraint here, because it is expected to shorten when Transfer-event
-- indexing lands and must do so without a schema change.
--
-- T0 DISCIPLINE. persona_id, passport_id and agent_root_did are server-internal
-- and NEVER leave this row. Only the sha256/16-hex commitments derived by
-- services/horizen/agentBinding.ts::bindingRefs cross a network or chain
-- boundary. RLS below gates reads to the owning persona; the service role does
-- everything.
--
-- Additive and safe to apply at any time: services/delegation/
-- delegationGrantStore.ts soft-fails to "bindings unreadable" without it, which
-- resolves to the honest `binding_unresolvable` evidence state rather than to a
-- false `unbound` claim.

BEGIN;

CREATE TABLE IF NOT EXISTS public.agent_identity_bindings (
  binding_id                    TEXT PRIMARY KEY,

  -- ── The delegation side of the chain ──
  agent_root_did                TEXT NOT NULL,           -- T0 delegated agent identifier
  persona_id                    UUID NOT NULL,           -- T0 principal
  passport_id                   TEXT NOT NULL,           -- T0 passport the act was taken under
  delegation_grant_id           TEXT NOT NULL,           -- delegation_grants.grant_id

  -- ── The ERC-8004 side, network-qualified ──
  network                       TEXT NOT NULL
    CHECK (network IN ('base-sepolia', 'base-mainnet')),
  chain_id                      INTEGER NOT NULL,
  -- DECIMAL STRING, not a numeric type: an ERC-8004 tokenId is a uint256 and
  -- exceeds every integer type Postgres and JS agree on. identity.ts parses it
  -- with BigInt for exactly this reason; storing it as text keeps that promise.
  token_id                      TEXT NOT NULL
    CHECK (token_id ~ '^[0-9]+$'),
  registry_alias                TEXT NOT NULL,           -- the registry's hex rendering
  -- The IdentityRegistry AS OF binding time. Recorded, not looked up: a binding
  -- made against a superseded registry deployment must still be able to say so.
  identity_registry             TEXT NOT NULL,

  -- ── Proof A: agent control ──
  owner_address_at_binding      TEXT NOT NULL,
  binding_method                TEXT NOT NULL DEFAULT 'operator_claim'
    CHECK (binding_method IN ('operator_claim')),
  claim_message                 TEXT NOT NULL,           -- the exact signed bytes
  claim_nonce                   TEXT NOT NULL,
  -- sha256 of the signature, NOT the signature. The signature is a bearer
  -- artifact; the digest proves which one was verified without keeping a
  -- replayable copy in a durable, potentially chain-anchored record.
  signature_commitment          TEXT NOT NULL,
  claim_verified_at             TIMESTAMPTZ NOT NULL,

  -- ── Proof B: the passport-backed constitutional act ──
  claimed_relationship          BOOLEAN NOT NULL DEFAULT false,
  accepted_responsibility       BOOLEAN NOT NULL DEFAULT false,
  scope_defined                 BOOLEAN NOT NULL DEFAULT false,
  acted_at                      TIMESTAMPTZ NOT NULL,
  receipt_id                    TEXT,                    -- attributable receipt, once written

  -- ── Ownership freshness (operator addition 2) ──
  ownership_checked_at          TIMESTAMPTZ,
  owner_wallet_at_check         TEXT,
  ownership_status              TEXT NOT NULL DEFAULT 'unknown'
    CHECK (ownership_status IN ('matches', 'changed', 'unknown')),
  ownership_check_source        TEXT
    CHECK (ownership_check_source IS NULL OR ownership_check_source IN
      ('registry_read', 'chain_read', 'transfer_event_index')),

  -- ── The four orthogonal facets (operator addition 1) ──
  -- Four plain columns. Deliberately NOT generated: a GENERATED column would be
  -- a derivation, which is the exact collapse the ruling forbids.
  ownership_verified            BOOLEAN NOT NULL DEFAULT false,
  operator_relationship_claimed BOOLEAN NOT NULL DEFAULT false,
  delegation_active             BOOLEAN NOT NULL DEFAULT false,
  runtime_admission_eligible    BOOLEAN NOT NULL DEFAULT false,

  -- ── Effective time + lifecycle ──
  effective_from                TIMESTAMPTZ NOT NULL,
  effective_to                  TIMESTAMPTZ,
  status                        TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'revoked', 'superseded')),
  status_reason                 TEXT,
  superseded_by                 TEXT REFERENCES public.agent_identity_bindings(binding_id),

  -- Receipt or content commitment tying the binding to its attributable record.
  receipt_commitment            TEXT,

  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AT MOST ONE ACTIVE BINDING PER NETWORK-QUALIFIED IDENTITY. Two active
-- bindings for one agent would mean two passports simultaneously claiming
-- constitutional responsibility for it, and nothing downstream could choose
-- between them. Partial, so the full supersession history is retained.
CREATE UNIQUE INDEX IF NOT EXISTS uq_agent_identity_bindings_active
  ON public.agent_identity_bindings (network, chain_id, token_id)
  WHERE status = 'active';

-- The resolution hot path: "every binding for this network-qualified identity".
CREATE INDEX IF NOT EXISTS idx_agent_identity_bindings_identity
  ON public.agent_identity_bindings (network, chain_id, token_id, effective_from DESC);

CREATE INDEX IF NOT EXISTS idx_agent_identity_bindings_persona
  ON public.agent_identity_bindings (persona_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_agent_identity_bindings_grant
  ON public.agent_identity_bindings (delegation_grant_id);

-- The staleness sweep (Phase D re-check worker) reads this ordering.
CREATE INDEX IF NOT EXISTS idx_agent_identity_bindings_ownership_staleness
  ON public.agent_identity_bindings (ownership_checked_at NULLS FIRST)
  WHERE status = 'active';

COMMENT ON TABLE public.agent_identity_bindings IS
  'First-class constitutional binding of a passport-held delegation to a network-qualified ERC-8004 agent identity (metaProof x Horizen Labs pilot). Never bind on token_id alone: the same token_id names different agents on different networks.';
COMMENT ON COLUMN public.agent_identity_bindings.token_id IS
  'Canonical DECIMAL string of a uint256 ERC-8004 tokenId. Text, not numeric: the value exceeds every integer type Postgres and JS agree on.';
COMMENT ON COLUMN public.agent_identity_bindings.ownership_checked_at IS
  'When ownership was last successfully re-checked. NULL means never. The freshness WINDOW is application policy (OWNERSHIP_FRESHNESS_WINDOW_MS), not a constraint here, so Transfer-event indexing can shorten it without a schema change.';
COMMENT ON COLUMN public.agent_identity_bindings.delegation_active IS
  'A fact about the delegation GRANT, never derived from ownership. A token transfer suspends the binding and withholds new authority; it does not rewrite the grant.';

-- ─── RLS — owners read their own bindings; service role does everything ──────
-- Mirrors delegation_grants exactly (migration 20260622500000). Same principal,
-- same tier discipline, so there is one access shape for the whole chain.
ALTER TABLE public.agent_identity_bindings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agent_identity_bindings_owner_read ON public.agent_identity_bindings;
CREATE POLICY agent_identity_bindings_owner_read ON public.agent_identity_bindings
  FOR SELECT USING (
    auth.role() = 'service_role'
    OR persona_id IN (SELECT id FROM public.personas WHERE auth_profile_id = auth.uid())
  );

DROP POLICY IF EXISTS agent_identity_bindings_service_write ON public.agent_identity_bindings;
CREATE POLICY agent_identity_bindings_service_write ON public.agent_identity_bindings
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMIT;
