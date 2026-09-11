-- 20260810010000_kn0w1_horizen_admission_fields.sql
--
-- Horizen Pilot — Know1 Recording Readiness Pass (2026-08-10): upgrades the
-- EXISTING Kn0w1 AigentQube (aigentqube-kn0w1, inserted by
-- 20260414000000_aigentqube_registry_assets.sql and corrected by
-- 20260415030000_aigentqube_add_aigent_know1.sql) to admission-grade —
-- additively, never a duplicate record. Mirrors the exact mechanism
-- 20260930002300_moneypenny_runtime_endpoint.sql and
-- 20260810000000_nakamoto_runtime_endpoint.sql already used for the other
-- two registrable agents: a shallow `metadata || jsonb_build_object(...)`
-- merge that touches ONLY the keys named here and leaves every other key
-- already on this row (agentiq_native, badge, trust_composite, source,
-- personaKey, modelPreference, temperature, cartridgeOverlays, pricingQc,
-- receiptEmitted, trustLevel, metaMePosture, skillCount, policyBindings)
-- completely untouched.
--
-- Three admission-grade gaps closed, per services/horizen/agentPreflight.ts's
-- own Identity-block checks (the authoritative "is this AigentQube
-- admission-grade" answer in this repo):
--
--   1. metadata.runtime — endpoint/health descriptor
--      (services/registry/runtimeDescriptor.ts). `endpoint` points at Know1's
--      OWN real, live runtime surface — app/api/codex/chat/route.ts, which
--      defaults `persona` to 'aigent-kn0w1' — never a generic invoke route he
--      does not have (same principle as MoneyPenny's migration pointing at
--      her own /api/moneypenny/chat). `health` points at the paired, real GET
--      route added alongside this migration:
--      app/api/agents/kn0w1/health/route.ts. Host is dev-beta.aigentz.me —
--      the same confirmed, already-documented dev deployment host the
--      MoneyPenny/Nakamoto migrations use — never invented per CLAUDE.md's
--      No-Guessing rule.
--
--   2. metadata.external_registry_bindings — the ERC-8004/Horizen
--      pre-registration binding, mirroring Nakamoto's exact shape
--      (20260930000700_aigentqube_nakamoto_registry_asset.sql). Starts
--      PENDING, honestly — token_id/registry_alias stay null until a real
--      Horizen registration transaction broadcasts for Know1 specifically.
--      This migration does NOT register Know1 on Horizen — it only gives the
--      Register/Verify/Claim routes a persistent carrier to write into, if
--      and when that registration happens.
--
--   3. metadata.knyt_financial_context — the new knowledge-grade capability
--      (operator ruling, 2026-08-10): Know1 provides contextual intelligence
--      across the $KNYT/QriptoCENT lifecycle WITHOUT acquiring transactional
--      or execution authority. Explicitly marks Verifiable P&L as
--      not_applicable rather than a stuck pending/failed requirement — P&L
--      stays non-gating to constitutional Ratify either way (unchanged
--      platform behaviour), and this is additive optionality: if Know1 is
--      later granted Horizen Verifiable P&L participation, that is a new,
--      explicit capability/observer extension, never something inherited
--      from this migration.
--
-- Also appends (via jsonb array concatenation, `||` on the top-level
-- `capabilities`/`tags` columns — NOT part of `metadata`) one new capability
-- entry and two new tags, in the same {"name", "scope"} shape the five
-- existing capabilities already use.
--
-- No wallet address stored here — same reasoning as every other agent's
-- migration: agent_keys is a separate table, read directly by the adapter at
-- hydrate time, never duplicated into registry_assets.metadata. Whether a
-- real agent_keys row exists for aigent-kn0w1 is verified LIVE via
-- services/horizen/agentPreflight.ts's 'agent-key' check
-- (GET /api/journey/moneypenny-horizen/preflight?agentSlug=kn0w1) —
-- this migration neither creates nor assumes that row.

UPDATE registry_assets
SET
  metadata = metadata || jsonb_build_object(
    'runtime', jsonb_build_object(
      'endpoint', 'https://dev-beta.aigentz.me/api/codex/chat',
      'health', 'https://dev-beta.aigentz.me/api/agents/kn0w1/health',
      'protocol', 'https',
      'version', '1'
    ),
    'external_registry_bindings', jsonb_build_array(
      jsonb_build_object(
        'protocol', 'erc-8004',
        'registry', 'horizen',
        'network', 'base-sepolia',
        'identity_registry_contract', '0x8004A818BFB912233c491871b3d84c89A494BD9e',
        'token_id', NULL,
        'registry_alias', NULL,
        'status', 'pending-registration',
        'agent_card_url', '/api/agents/kn0w1/agent-card.json'
      )
    ),
    'knyt_financial_context', jsonb_build_object(
      'scope', 'knowledge_interpretation_guidance',
      'not', 'transaction_execution',
      'covers', jsonb_build_array(
        'knyt_earning_via_quests_and_contribution',
        'knyt_utility_and_value_flows',
        'bitcent_qriptocent_relationships',
        'rewards_marketplace_treasury_participation',
        'contextual_fs_implications_of_knyt_activity',
        'handoff_to_moneypenny_for_transactional_execution'
      ),
      'authority_boundary', 'Know1 may explain, contextualize and reason about $KNYT/QriptoCENT financial activity. It does not execute trades, custody funds, settle transactions or operate the Financial Services runtime. Those actions remain delegated to MoneyPenny.',
      'fs_role', 'knowledge_context',
      'operational_fs_role_holder', 'aigent-moneypenny',
      'verifiable_pnl', 'not_applicable',
      'verifiable_pnl_note', 'Know1 is a knowledge/context agent, not a trading/execution agent. Verifiable P&L is not currently required or configured for Know1''s admission; P&L stays non-gating to constitutional Ratify. Future Horizen Verifiable P&L participation, if chosen, must be separately ratified and separately evidenced.'
    )
  ),
  capabilities = capabilities || jsonb_build_array(
    jsonb_build_object('name', 'knyt_financial_context', 'scope', 'knowledge')
  ),
  tags = tags || jsonb_build_array('knyt-financial-context', 'horizen-admission'),
  updated_at = now()
WHERE asset_id = 'aigentqube-kn0w1';
