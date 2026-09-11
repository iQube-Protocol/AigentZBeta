-- 20260930000700_aigentqube_nakamoto_registry_asset.sql
--
-- Agent-selectable Register stage (2026-07-31, operator ruling): Aigent
-- Nakamoto is the dry-run agent for the Horizen registration flow (MoneyPenny
-- stays the demo agent). Mirrors 20260930000400's exact pattern for
-- MoneyPenny — Nakamoto needs the same persisted, metadata-bearing
-- AigentQube record for the identical reason MoneyPenny got hers: the
-- Horizen external_registry_bindings field needs a persistent carrier her
-- PRE-EXISTING code-literal AigentQube representation cannot hold.
--
-- CONFIRMED REAL, NOT INVENTED, BEFORE THIS MIGRATION (operator screenshot,
-- 2026-07-31 — the live deployed app, not this repo's static analysis):
--   - agent_keys wallet row IS real: evm_address
--     0x24BBB9C7aAcB33556D1429a3e1B33f05fAf7D4B9 (scripts/add-missing-
--     agents.ts), fio_handle 'nakamoto@aigent' (scripts/register-agent-
--     keys.ts), a live wallet drawer with real Q¢/chain balances.
--   - She ALREADY appears in the iQube Registry's "Browse iQubes" AigentQube
--     tab today — via services/iqube/legibility/sources/aigentQubeSource.ts's
--     hand-curated PROFILES entry (code:aigentQubeSource source, a
--     DETERMINISTIC SYNTHETIC UUID via syntheticIQubeId(), NOT a
--     registry_assets row — confirmed via services/registry/adapters/
--     aigentQubeAdapter.ts's own comment: "registry_asset path — DB-backed
--     AigentQube (5 rows: aigent-z, kn0w1, marketa, aigent-c, moneypenny)" —
--     Nakamoto is explicitly NOT among those 5). This migration promotes her
--     the same way MoneyPenny was promoted, not a duplicate of a duplicate:
--     aigentQubeAdapter.list() merges BOTH the code-literal source AND
--     registry_asset rows unconditionally (no dedup in that function), so
--     MoneyPenny already carries this same dual-representation today; this
--     migration does not introduce a new class of risk for Nakamoto, only
--     the same one already accepted for MoneyPenny.
--
-- Description/skills sourced from app/data/personas.ts's 'aigent-nakamoto'
-- systemPrompt — THE MOST AUTHORITATIVE, MOST CURRENT source, confirmed live
-- on the deployed platform (operator screenshot, /aigents/aigent-nakamoto's
-- Context Transformation panel) — not the older, narrower descriptions in
-- services/homecoming/agentHomecoming.ts or aigentQubeSource.ts's PROFILES
-- (see app/api/agents/nakamoto/agent-card.json/route.ts's header for the
-- full three-source reconciliation). Nothing here is invented.
--
-- No wallet address stored here — same reasoning as MoneyPenny's migration:
-- her keys live in agent_keys, read directly by the adapter at hydrate time,
-- never duplicated into registry_assets.metadata.
--
-- external_registry_bindings starts PENDING, honestly — token_id/
-- registry_alias stay null until a real Horizen registration transaction
-- broadcasts for Nakamoto specifically.

INSERT INTO registry_assets (
  asset_id, tenant_id, asset_class, name, slug, description,
  current_version, trust_band, publication_status, policy_class,
  wrapper_strategy, interface_schema, capabilities, tags, metadata, created_by
) VALUES
(
  'aigentqube-nakamoto',
  'platform',
  'AigentQube',
  'Aigent Nakamoto',
  'aigent-nakamoto',
  'The platform''s specialist in decentralised technologies broadly, with deep expertise in Bitcoin specifically -- consensus, UTXO/script semantics, layer 2 (Lightning, sidechains, RGB), self-custody, key management, and cypherpunk history. SME on the iQube and Qripto Protocols'' cryptographic primitives (DiD/DiDQube, blakQube, metaQube, tokenQube, cohort attestations, DVN receipts, COYN/Q¢ economics) and the ecosystem-wide policy steward for the iQube Protocol itself. Nakamoto is a delegate, never a principal.',
  '1.0.0',
  'L4_PRODUCTION_APPROVED',
  'published',
  'human_approval_required',
  'skill',
  '{"input": {"message": "string", "personaId": "string", "mode": "string"}, "output": {"response": "string", "artifacts": "array", "receipts": "array"}}',
  '[{"name": "bitcoin_decentralisation_expertise", "scope": "conversational"}, {"name": "iqube_qripto_protocol_sme", "scope": "content"}, {"name": "ecosystem_policy_stewardship", "scope": "system"}, {"name": "chat", "scope": "conversational"}]',
  '["bitcoin", "iqube-protocol", "qripto-protocol", "decentralisation", "policy", "delegate", "agentiq-native"]',
  '{
    "agentiq_native": true,
    "badge": "N",
    "trust_composite": 82,
    "source": "agentiq_core",
    "personaKey": "aigent-nakamoto",
    "modelPreference": "gpt-4o",
    "temperature": 0.6,
    "cartridgeOverlays": ["AgentiQ"],
    "pricingQc": 0,
    "receiptEmitted": true,
    "trustLevel": "production",
    "metaMePosture": "standard",
    "skillCount": 3,
    "policyBindings": [
      {"policyId": "409-authorization-gate", "policyType": "behaviour", "policyName": "Bounded Financial Execution Gate", "enforced": true}
    ],
    "external_registry_bindings": [
      {
        "protocol": "erc-8004",
        "registry": "horizen",
        "network": "base-sepolia",
        "identity_registry_contract": "0x8004A818BFB912233c491871b3d84c89A494BD9e",
        "token_id": null,
        "registry_alias": null,
        "status": "pending-registration",
        "agent_card_url": "/api/agents/nakamoto/agent-card.json"
      }
    ]
  }',
  'agentiq-system'
)

-- A RE-RUN MUST NOT UN-REGISTER A REGISTERED AGENT (2026-08-03).
--
-- `metadata = EXCLUDED.metadata` was a blind overwrite, and EXCLUDED.metadata
-- carries `token_id: null` — so re-running this seed against a database where
-- Nakamoto's registration HAD landed would silently erase a real, confirmed,
-- on-chain ERC-8004 registration from the projection every surface reads.
-- Nakamoto's live registration (tokenId 8798) makes that concrete, not
-- hypothetical. The seed still refreshes descriptive fields; it now preserves
-- the existing bindings array whenever that array already carries a tokenId.
ON CONFLICT (asset_id) DO UPDATE SET
  name               = EXCLUDED.name,
  description        = EXCLUDED.description,
  trust_band         = EXCLUDED.trust_band,
  publication_status = EXCLUDED.publication_status,
  capabilities       = EXCLUDED.capabilities,
  tags               = EXCLUDED.tags,
  metadata           = CASE
    WHEN registry_assets.metadata #>> '{external_registry_bindings,0,token_id}' IS NOT NULL
      THEN EXCLUDED.metadata || jsonb_build_object(
             'external_registry_bindings',
             registry_assets.metadata -> 'external_registry_bindings')
    ELSE EXCLUDED.metadata
  END,
  updated_at         = now();

INSERT INTO iqube_id_map (source, source_id, primitive_type, synthetic, notes)
VALUES ('registry_asset', 'aigentqube-nakamoto', 'AigentQube', false,
        'Agent-selectable Register stage — Nakamoto''s canonical AigentQube, backing her Horizen ERC-8004 external-registry binding (dry-run agent, per operator ruling 2026-07-31)')
ON CONFLICT (source, source_id) DO NOTHING;
