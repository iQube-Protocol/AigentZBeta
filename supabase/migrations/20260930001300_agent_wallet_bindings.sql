-- 20260930001300_agent_wallet_bindings.sql
--
-- Agent purpose-bound wallet bindings (operator directive, 2026-08-09 —
-- Horizen Pilot Closure part 2: "Authorize a dedicated Nakamoto trading
-- wallet").
--
-- `agent_keys` is structurally ONE ROW PER agent_id: `AgentKeyService`
-- upserts/reads keyed by `agent_id` alone, and every production call site
-- (Register/Verify/Claim routes, registrationClient.ts) resolves it as
-- `agent.runtimeAgentId`'s single canonical wallet — the agent-control /
-- ERC-8004 owner-wallet custody path (see registrableAgents.ts's own
-- doctrine: "the ONE agent-wallet custody path, never a parallel one").
-- That row is NOT extended, expanded, or reinterpreted here to hold a
-- second wallet.
--
-- Horizen's Verifiable-PnL service requires a wallet distinct from the
-- ERC-8004 owner wallet for trading/PnL disclosure (server-enforced rule,
-- confirmed live on two fetches of AGENTS.md: "tradingWallet MUST differ
-- from ownerWallet... rejected with 400 INVALID_INPUT" — because the
-- trading wallet's PnL is published on a public leaderboard and linking
-- the owner wallet would deanonymize the owner). This table is the
-- SMALLEST generic structure that names that second (and future) purpose
-- without a Nakamoto-specific field or table: an agent may hold more than
-- one purpose-bound wallet, one row per (agent_runtime_id, wallet_role).
-- This pass instantiates exactly one: aigent-nakamoto / trading.
--
-- Mirrors the shape of linked_external_wallets (20260930001100) and
-- signing_requests (20260930000800) — generic binding tables that record a
-- relationship and a status, never a secret.
--
-- NEVER KEY MATERIAL. This table holds a public address and a pointer
-- (`custody_ref`) to where the encrypted private key actually lives — a
-- SEPARATE row in the EXISTING agent_keys table, kept by the SAME
-- AgentKeyService AES-256-CBC mechanism the canonical owner wallet uses,
-- addressed by a namespaced key ("<runtimeAgentId>::wallet::<role>") that
-- can never collide with a real runtimeAgentId. See
-- services/wallet/agentPurposeWalletService.ts (the only reader/writer).

BEGIN;

CREATE TABLE IF NOT EXISTS public.agent_wallet_bindings (
  id                    TEXT PRIMARY KEY,

  agent_runtime_id      TEXT NOT NULL,

  -- 'owner' is named in the CHECK even though it is never written through
  -- this table today (the owner wallet lives solely in agent_keys,
  -- addressed directly by runtimeAgentId) — naming it here is what makes
  -- adding a real owner-role row through this path, should that ever be
  -- wanted, a deliberate schema decision rather than a silent widening.
  -- 'settlement' and 'treasury' are named for the same reason: named now,
  -- instantiated later, per the operator's explicit fast-follow framing.
  wallet_role           TEXT NOT NULL CHECK (wallet_role IN ('owner', 'trading', 'settlement', 'treasury')),

  address               TEXT NOT NULL,
  network               TEXT NOT NULL,
  chain_id              INTEGER,

  -- Points into agent_keys.agent_id — never the key itself. See header.
  custody_ref           TEXT NOT NULL,

  status                TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_agent_wallet_bindings_agent_role
  ON public.agent_wallet_bindings (agent_runtime_id, wallet_role);

CREATE INDEX IF NOT EXISTS idx_agent_wallet_bindings_agent
  ON public.agent_wallet_bindings (agent_runtime_id, status);

COMMENT ON TABLE public.agent_wallet_bindings IS
  'Purpose-bound agent wallet directory (operator directive 2026-08-09). One constitutional control wallet stays in agent_keys, addressed directly by runtimeAgentId; a bounded capability wallet (trading/settlement/treasury) gets a row here naming its role, public address, and a custody_ref pointer into a SEPARATE agent_keys row. Never key material.';
COMMENT ON COLUMN public.agent_wallet_bindings.custody_ref IS
  'The agent_keys.agent_id row holding this wallet''s encrypted private key — namespaced as "<runtimeAgentId>::wallet::<role>" so it can never collide with a real runtimeAgentId. The private key itself never appears in this table.';

ALTER TABLE public.agent_wallet_bindings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agent_wallet_bindings_service_only ON public.agent_wallet_bindings;
CREATE POLICY agent_wallet_bindings_service_only ON public.agent_wallet_bindings
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMIT;
