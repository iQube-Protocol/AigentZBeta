-- Upsert Know1 — Knowledge Synthesis / KNYT Cartridge Intelligence
-- Ensures Know1 is in registry_assets with publication_status=published so
-- the Registry Supply tab and AssetDetailPanel both reflect the correct status.
--
-- Run AFTER 20260414000000_aigentqube_registry_assets.sql

INSERT INTO registry_assets (
  asset_id, tenant_id, asset_class, name, slug, description,
  current_version, trust_band, publication_status, policy_class,
  wrapper_strategy, interface_schema, capabilities, tags, metadata, created_by
) VALUES
(
  'aigentqube-kn0w1',
  'platform',
  'AigentQube',
  'Know1',
  'aigent-kn0w1',
  'AgentiQ knowledge synthesis and KNYT intelligence agent. Know1 interprets, frames, guides, and activates value from meaning — translating mythos into action, shaping opportunity, interpreting COYN value and treasury logic, and guiding participants into cartridge and runtime paths.',
  '1.0.0',
  'L4_PRODUCTION_APPROVED',
  'published',
  'network_limited',
  'skill',
  '{"input": {"message": "string", "personaId": "string", "journeyStage": "string"}, "output": {"response": "string", "nextExperience": "object", "receipts": "array"}}',
  '[{"name": "knowledge_synthesis", "scope": "content"}, {"name": "lore_translation", "scope": "knyt"}, {"name": "treasury_interpretation", "scope": "analytics"}, {"name": "opportunity_shaping", "scope": "content"}, {"name": "venture_studio_support", "scope": "tasks"}, {"name": "cartridge_guidance", "scope": "system"}, {"name": "chat", "scope": "conversational"}]',
  '["agentiq-native", "agentiq", "know1", "knyt", "treasury", "lore", "knowledge", "synthesis"]',
  '{
    "agentiq_native": true,
    "badge": "K",
    "trust_composite": 88,
    "source": "agentiq_core",
    "personaKey": "aigent-kn0w1",
    "modelPreference": "claude-sonnet-4-6",
    "temperature": 0.75,
    "cartridgeOverlays": ["KNYT", "AgentiQ", "Qriptopian"],
    "pricingQc": 0,
    "receiptEmitted": true,
    "trustLevel": "production",
    "metaMePosture": "explanation-first",
    "skillCount": 7,
    "policyBindings": [
      {"policyId": "knyt-cartridge", "policyType": "behaviour", "policyName": "KNYT Cartridge Policy", "enforced": true},
      {"policyId": "explanation-first", "policyType": "behaviour", "policyName": "Explanation-First Native Asset", "enforced": true}
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
