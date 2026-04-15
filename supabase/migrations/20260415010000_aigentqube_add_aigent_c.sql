-- Add Aigent C — Customer Guide / Builder Companion
-- Seeds the fourth first-class AigentQube asset, completing the core agent quartet.
--
-- Run AFTER 20260414000000_aigentqube_registry_assets.sql

INSERT INTO registry_assets (
  asset_id, tenant_id, asset_class, name, slug, description,
  current_version, trust_band, publication_status, policy_class,
  wrapper_strategy, interface_schema, capabilities, tags, metadata, created_by
) VALUES
(
  'aigentqube-aigent-c',
  'platform',
  'AigentQube',
  'Aigent C',
  'aigent-c',
  'The customer-facing guide and builder companion. Aigent C faces the user directly, executes NBE dispositions set by Aigent Z, and supports contributors through the creation and submission pathway.',
  '1.0.0',
  'L4_PRODUCTION_APPROVED',
  'published',
  'network_limited',
  'skill',
  '{"input": {"message": "string", "personaId": "string", "nbePlan": "object"}, "output": {"response": "string", "handoffPayload": "object", "receipts": "array"}}',
  '[{"name": "user_guidance", "scope": "conversational"}, {"name": "nbe_execution", "scope": "system"}, {"name": "builder_support", "scope": "content"}, {"name": "contribution_pathway", "scope": "tasks"}, {"name": "chat", "scope": "conversational"}]',
  '["customer-guide", "builder", "nbe", "conversational", "agentiq-native"]',
  '{
    "agentiq_native": true,
    "badge": "C",
    "trust_composite": 85,
    "source": "agentiq_core",
    "personaKey": "aigent-c",
    "modelPreference": "claude-sonnet-4-6",
    "temperature": 0.7,
    "cartridgeOverlays": ["AgentiQ", "KNYT", "Qriptopian"],
    "pricingQc": 0,
    "receiptEmitted": true,
    "trustLevel": "production",
    "metaMePosture": "standard",
    "skillCount": 5,
    "policyBindings": [
      {"policyId": "nbe-execution", "policyType": "behaviour", "policyName": "NBE Execution Policy", "enforced": true}
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
