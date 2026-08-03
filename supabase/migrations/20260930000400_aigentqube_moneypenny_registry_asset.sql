-- 20260930000400_aigentqube_moneypenny_registry_asset.sql
--
-- PRD-GJR-001 (Guided Journey Runtime), operator ruling 2026-07-31: MoneyPenny
-- must not appear as an agent-shaped entry in the iQube Registry backed only
-- by a wallet key row and a hand-authored Agent Card. She needs an actual,
-- persisted AigentQube record, following the exact same registry_assets
-- pattern as the four agents already seeded this way (aigent-z, kn0w1,
-- marketa, aigent-c — see 20260414000000_aigentqube_registry_assets.sql and
-- 20260415010000_aigentqube_add_aigent_c.sql).
--
-- external_registry_bindings (types/registry-canonical.ts's new
-- ExternalAgentRegistryBinding shape) records her Horizen ERC-8004 presence
-- as PENDING, honestly — token_id/registry_alias stay null until a real
-- registration transaction broadcasts (confirmed absent everywhere in this
-- codebase via a dedicated audit, 2026-07-31: scripts/register-moneypenny-horizen.ts
-- has never been executed to completion; identity_registry_contract below is
-- the real Base Sepolia contract address from
-- services/horizen/identity.ts's HORIZEN_NETWORK_FACTS, not a placeholder).
--
-- No wallet address is stored here — deliberately. MoneyPenny's wallet keys
-- already live in agent_keys (services/identity/agentKeyService.ts); storing
-- a second copy in registry_assets.metadata would be exactly the
-- parallel-implementation defect CLAUDE.md's inv.engineering.036/037 forbid.
-- The adapter reads agent_keys directly at hydrate time instead (see
-- services/registry/adapters/aigentQubeAdapter.ts).
--
-- Also seeds the corresponding iqube_id_map row (source='registry_asset',
-- source_id='aigentqube-moneypenny') so she is actually reachable through
-- aigentQubeAdapter.list()/resolveIQube() — the four prior agents were
-- seeded into registry_assets WITHOUT a matching iqube_id_map row, so this
-- migration does not skip that step for MoneyPenny.

INSERT INTO registry_assets (
  asset_id, tenant_id, asset_class, name, slug, description,
  current_version, trust_band, publication_status, policy_class,
  wrapper_strategy, interface_schema, capabilities, tags, metadata, created_by
) VALUES
(
  'aigentqube-moneypenny',
  'platform',
  'AigentQube',
  'Aigent MoneyPenny',
  'aigent-moneypenny',
  'The Constitutional Financial Services Agent (PRD-MPY-001). MoneyPenny is the financial-services specialization of the platform''s constitutional reasoning pipeline. She operates in three modes: Advisor (grounded, cited financial guidance — read-only), Architect (designs pricing models, fee splits, settlement-terms, delegation envelopes and agreement templates), and Runtime (executes financial actions within bounded, receipted, delegated authority). MoneyPenny is a delegate, never a principal.',
  '1.0.0',
  'L4_PRODUCTION_APPROVED',
  'published',
  'human_approval_required',
  'skill',
  '{"input": {"message": "string", "personaId": "string", "mode": "string"}, "output": {"response": "string", "artifacts": "array", "receipts": "array"}}',
  '[{"name": "financial_advisory", "scope": "conversational"}, {"name": "financial_structure_design", "scope": "content"}, {"name": "bounded_financial_execution", "scope": "system"}, {"name": "chat", "scope": "conversational"}]',
  '["finance", "advisory", "architect", "runtime", "delegate", "agentiq-native"]',
  '{
    "agentiq_native": true,
    "badge": "M",
    "trust_composite": 82,
    "source": "agentiq_core",
    "personaKey": "aigent-moneypenny",
    "modelPreference": "claude-sonnet-4-6",
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
        "agent_card_url": "/api/agents/moneypenny/agent-card.json"
      }
    ]
  }',
  'agentiq-system'
)

-- A RE-RUN MUST NOT UN-REGISTER A REGISTERED AGENT (2026-08-03) — see the
-- identical guard and its full reasoning in
-- 20260930000700_aigentqube_nakamoto_registry_asset.sql. EXCLUDED.metadata
-- carries `token_id: null`; a blind overwrite would erase a confirmed
-- on-chain registration from the projection every surface reads.
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
VALUES ('registry_asset', 'aigentqube-moneypenny', 'AigentQube', false,
        'PRD-GJR-001 Stage 1 — MoneyPenny''s canonical AigentQube, backing her Horizen ERC-8004 external-registry binding')
ON CONFLICT (source, source_id) DO NOTHING;
