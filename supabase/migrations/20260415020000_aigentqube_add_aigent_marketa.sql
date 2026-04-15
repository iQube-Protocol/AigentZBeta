-- Upsert Aigent Marketa — Ecosystem Diplomat / Campaign + CRM Intelligence
-- Ensures Marketa is in registry_assets with publication_status=published so
-- the Registry Supply tab and AssetDetailPanel both reflect the correct status.
--
-- Run AFTER 20260414000000_aigentqube_registry_assets.sql

INSERT INTO registry_assets (
  asset_id, tenant_id, asset_class, name, slug, description,
  current_version, trust_band, publication_status, policy_class,
  wrapper_strategy, interface_schema, capabilities, tags, metadata, created_by
) VALUES
(
  'aigentqube-marketa',
  'platform',
  'AigentQube',
  'Marketa',
  'aigent-marketa',
  'Ecosystem diplomat and AgentiQ activation agent. Marketa identifies, qualifies, guides, and activates participants — classifying entrants, qualifying partners, managing campaign sequences, and routing into KNYT, Qriptopian, Know1, and Aigent Z.',
  '1.0.0',
  'L3_PRODUCTION_CANDIDATE',
  'published',
  'network_limited',
  'skill',
  '{"input": {"message": "string", "personaId": "string", "campaignId": "string"}, "output": {"response": "string", "crm_action": "object", "nextExperience": "object"}}',
  '[{"name": "ecosystem_diplomacy", "scope": "crm"}, {"name": "campaign_intelligence", "scope": "crm"}, {"name": "onboarding_guidance", "scope": "content"}, {"name": "partner_qualification", "scope": "tasks"}, {"name": "activation_routing", "scope": "system"}, {"name": "chat", "scope": "conversational"}]',
  '["agentiq-native", "agentiq", "ecosystem", "campaign", "crm", "activation", "onboarding", "knyt"]',
  '{
    "agentiq_native": true,
    "badge": "M",
    "trust_composite": 80,
    "source": "agentiq_core",
    "personaKey": "aigent-marketa",
    "modelPreference": "claude-sonnet-4-6",
    "temperature": 0.6,
    "cartridgeOverlays": ["AgentiQ", "KNYT", "Qriptopian"],
    "pricingQc": 0,
    "receiptEmitted": true,
    "trustLevel": "production_candidate",
    "metaMePosture": "standard",
    "skillCount": 6,
    "policyBindings": [
      {"policyId": "crm-data-policy", "policyType": "privacy", "policyName": "CRM Data Privacy Policy", "enforced": true}
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
