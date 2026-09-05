-- 20260930210000_provider_wallet_bindings.sql
--
-- Factor + Aegis Bankr PRD, Phase 3 — generic, tenant-scoped provider-wallet
-- binding model. No canonical binding for "which EXTERNAL provider (Bankr,
-- and any future one) an agent's wallets are bound to" existed before this
-- migration; `agent_wallet_bindings` (20260930001300) is a DIFFERENT
-- concern — MetaMe's OWN owner/trading/settlement/treasury wallets, keyed
-- by (agent_runtime_id, wallet_role). This table never duplicates those
-- rows: `metame_owner_wallet_address`/`metame_settlement_wallet_address`
-- below are a PROJECTION of what `agent_keys`/`agent_wallet_bindings`
-- already say at binding time (populated by
-- services/financialServices/providers/providerWalletBinding.ts, which
-- READS them from those tables — never accepts them as free-form input),
-- so this migration can never overwrite Factor's canonical MetaMe
-- addresses; it can only reference them.
--
-- RLS: service-role-only, matching every other table in this codebase's
-- migrations (see 20260930190000_factor_aegis_constitution_reconciled.sql).
--
-- Tenant isolation + uniqueness: one binding per (tenant_id,
-- agent_runtime_id, provider) — a re-provision is idempotent (upsert on
-- that key), a revoke never deletes the row (status flips to 'revoked',
-- revoked_at stamped) so history is never lost.

CREATE TABLE IF NOT EXISTS provider_wallet_bindings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  agent_runtime_id TEXT NOT NULL,
  -- Extensible beyond Bankr by construction — never hardcode 'bankr' as an
  -- enum value baked into the schema; the CHECK constraint names only the
  -- providers this codebase actually integrates today.
  provider TEXT NOT NULL CHECK (provider IN ('bankr')),

  -- MetaMe side — REFERENCES ONLY. Populated by reading agent_keys /
  -- agent_wallet_bindings at binding time; never independently settable by
  -- a caller of provisionProviderWalletBinding().
  metame_owner_wallet_address TEXT NOT NULL,
  metame_settlement_wallet_address TEXT,

  -- Provider side — Bankr's own identifiers for this agent.
  provider_org_id TEXT,
  provider_wallet_address TEXT,
  provider_external_profile_id TEXT,

  -- Which Bankr capabilities this binding is allowed to invoke — e.g.
  -- ["token_launch_quote", "token_launch_submit", "wallet_balance"].
  -- Reporting/gating input for Factor's own capability handler (Phase 5);
  -- this table never itself enforces authority — that stays
  -- services/factor/authorityChain.ts's job.
  allowed_capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,

  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),

  -- A REFERENCE to the credential used (e.g. a key id/fingerprint), NEVER
  -- the credential itself — the real key lives only in the Bankr provider
  -- config's env vars (services/financialServices/providers/bankr/
  -- bankrConfig.ts), never in this table, never in a receipt.
  non_secret_credential_ref TEXT,

  -- What was actually checked to establish this binding (e.g. a
  -- capabilities-endpoint probe result, a wallet-ownership proof) — never
  -- asserted, always the record of what was verified and when.
  verification_evidence JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, agent_runtime_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_provider_wallet_bindings_agent ON provider_wallet_bindings (agent_runtime_id);

ALTER TABLE provider_wallet_bindings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS provider_wallet_bindings_service_role ON provider_wallet_bindings;
CREATE POLICY provider_wallet_bindings_service_role ON provider_wallet_bindings
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
