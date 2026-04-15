-- AigentQube Registry Assets seed
-- Seeds Aigent Z, Kn0w1, and Marketa as first-class AigentQube registry_assets
-- so they appear in the Ingestion Factory with full detail panel.
--
-- Run AFTER 20260402010000_registry_ingestion_factory_v1.sql

INSERT INTO registry_assets (
  asset_id, tenant_id, asset_class, name, slug, description,
  current_version, trust_band, publication_status, policy_class,
  wrapper_strategy, interface_schema, capabilities, tags, metadata, created_by
) VALUES

-- ─────────────────────────────────────────────────────────────────────────────
-- Aigent Z — System Orchestrator
-- ─────────────────────────────────────────────────────────────────────────────
(
  'aigentqube-aigent-z',
  'platform',
  'AigentQube',
  'Aigent Z',
  'aigent-z',
  'The system orchestrator for the AgentiQ OS. Routes all interactions, enforces metaMe policy, selects NBE dispositions, and coordinates the agent trio. Every session passes through Aigent Z.',
  '1.0.0',
  'L5_CORE_SOVEREIGN',
  'published',
  'human_approval_required',
  'skill',
  '{"input": {"message": "string", "sessionId": "string", "personaId": "string", "appId": "string"}, "output": {"response": "string", "nbePlan": "object", "receipts": "array"}}',
  '[{"name": "orchestration", "scope": "system"}, {"name": "policy_enforcement", "scope": "metame"}, {"name": "nbe_routing", "scope": "global"}, {"name": "chat", "scope": "conversational"}]',
  '["orchestrator", "system", "policy", "agentiq-native"]',
  '{
    "agentiq_native": true,
    "badge": "S",
    "trust_composite": 99,
    "source": "agentiq_core",
    "personaKey": "aigent-z",
    "modelPreference": "claude-sonnet-4-6",
    "temperature": 0.5,
    "cartridgeOverlays": ["KNYT", "Qriptopian", "AgentiQ"],
    "pricingQc": 0,
    "receiptEmitted": true,
    "trustLevel": "sovereign",
    "metaMePosture": "guardian",
    "skillCount": 5,
    "policyBindings": [
      {"policyId": "metame-guardian", "policyType": "behaviour", "policyName": "metaMe Guardian Override", "enforced": true},
      {"policyId": "nbe-routing", "policyType": "behaviour", "policyName": "NBE Routing Policy", "enforced": true}
    ]
  }',
  'agentiq-system'
),

-- ─────────────────────────────────────────────────────────────────────────────
-- Kn0w1 — KNYT Cartridge Lead
-- ─────────────────────────────────────────────────────────────────────────────
(
  'aigentqube-kn0w1',
  'platform',
  'AigentQube',
  'Kn0w1',
  'aigent-kn0w1',
  'Lead intelligence surface of the KNYT cartridge. Explains treasury, rewards, Qc vs $KNYT, 21 Sats, and personal progression. The first agent most participants encounter in the KNYT world.',
  '1.0.0',
  'L4_PRODUCTION_APPROVED',
  'published',
  'network_limited',
  'skill',
  '{"input": {"message": "string", "personaId": "string", "journeyStage": "string"}, "output": {"response": "string", "nextExperience": "object", "receipts": "array"}}',
  '[{"name": "lore", "scope": "knyt"}, {"name": "knyt_treasury", "scope": "analytics"}, {"name": "knyt_rewards", "scope": "tasks"}, {"name": "qc_distinction", "scope": "analytics"}, {"name": "opportunity_shaping", "scope": "content"}, {"name": "story_guide", "scope": "content"}, {"name": "chat", "scope": "conversational"}]',
  '["knyt", "cartridge-lead", "treasury", "rewards", "lore", "agentiq-native"]',
  '{
    "agentiq_native": true,
    "badge": "A",
    "trust_composite": 88,
    "source": "agentiq_core",
    "personaKey": "aigent-kn0w1",
    "modelPreference": "claude-sonnet-4-6",
    "temperature": 0.75,
    "cartridgeOverlays": ["KNYT", "AgentiQ"],
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
),

-- ─────────────────────────────────────────────────────────────────────────────
-- Marketa — Campaign + CRM Intelligence
-- ─────────────────────────────────────────────────────────────────────────────
(
  'aigentqube-marketa',
  'platform',
  'AigentQube',
  'Marketa',
  'aigent-marketa',
  'Campaign and CRM intelligence agent. Manages investor relations, campaign sequencing, email outreach, and Kickstarter backer cohort tracking for the KNYT launch and beyond.',
  '1.0.0',
  'L3_PRODUCTION_CANDIDATE',
  'published',
  'network_limited',
  'skill',
  '{"input": {"message": "string", "personaId": "string", "campaignId": "string"}, "output": {"response": "string", "crm_action": "object"}}',
  '[{"name": "campaign_intelligence", "scope": "crm"}, {"name": "journey_guide", "scope": "content"}, {"name": "content_discovery", "scope": "content"}, {"name": "chat", "scope": "conversational"}]',
  '["campaign", "crm", "outreach", "investor-relations", "agentiq-native"]',
  '{
    "agentiq_native": true,
    "badge": "A",
    "trust_composite": 80,
    "source": "agentiq_core",
    "personaKey": "aigent-marketa",
    "modelPreference": "claude-sonnet-4-6",
    "temperature": 0.6,
    "cartridgeOverlays": ["AgentiQ", "KNYT"],
    "pricingQc": 0,
    "receiptEmitted": false,
    "trustLevel": "production_candidate",
    "metaMePosture": "standard",
    "skillCount": 4,
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
