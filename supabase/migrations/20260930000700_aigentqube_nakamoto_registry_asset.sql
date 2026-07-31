-- 20260930000700_aigentqube_nakamoto_registry_asset.sql
--
-- Agent-selectable Register stage (2026-07-31, operator ruling): Aigent
-- Nakamoto is the dry-run agent for the Horizen registration flow (MoneyPenny
-- stays the demo agent). Mirrors 20260930000400's exact pattern for
-- MoneyPenny — Nakamoto needs the same persisted AigentQube record, never a
-- second, differently-shaped seed.
--
-- Description sourced from services/homecoming/agentHomecoming.ts's
-- HOMECOMING_DELEGATE_SPECS.nakamoto (already-authored, ratified text) and
-- her specialist-router role (services/agents/specialistRouter.ts,
-- 'decentralisation_brief' — self-custody, censorship-resistance,
-- Qripto-protocol policy). Nothing here is invented.
--
-- No wallet address stored here — same reasoning as MoneyPenny's migration:
-- her keys live in agent_keys (services/identity/agentKeyService.ts,
-- scripts/register-agent-keys.ts already carries an 'aigent-nakamoto' /
-- 'nakamoto@aigent' entry), read directly by the adapter at hydrate time.
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
  'Constitutional delegate for Bitcoin, the COYN ecosystem, risk, and decentralisation briefs. Operates under bounded delegation within the Human Agency System; advises and analyses, never transacts or acts outside its granted scope.',
  '1.0.0',
  'L4_PRODUCTION_APPROVED',
  'published',
  'human_approval_required',
  'skill',
  '{"input": {"message": "string", "personaId": "string", "mode": "string"}, "output": {"response": "string", "artifacts": "array", "receipts": "array"}}',
  '[{"name": "decentralisation_brief", "scope": "conversational"}, {"name": "policy_framing", "scope": "content"}, {"name": "chat", "scope": "conversational"}]',
  '["bitcoin", "coyn", "risk", "decentralisation", "delegate", "agentiq-native"]',
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
    "skillCount": 2,
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

ON CONFLICT (asset_id) DO UPDATE SET
  name               = EXCLUDED.name,
  description        = EXCLUDED.description,
  trust_band         = EXCLUDED.trust_band,
  publication_status = EXCLUDED.publication_status,
  capabilities       = EXCLUDED.capabilities,
  tags               = EXCLUDED.tags,
  metadata           = EXCLUDED.metadata,
  updated_at         = now();

INSERT INTO iqube_id_map (source, source_id, primitive_type, synthetic, notes)
VALUES ('registry_asset', 'aigentqube-nakamoto', 'AigentQube', false,
        'Agent-selectable Register stage — Nakamoto''s canonical AigentQube, backing her Horizen ERC-8004 external-registry binding (dry-run agent, per operator ruling 2026-07-31)')
ON CONFLICT (source, source_id) DO NOTHING;
