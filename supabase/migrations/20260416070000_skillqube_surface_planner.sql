-- ============================================================================
-- Surface Planner SkillQube
-- Venture Lab α — Skill Factory
--
-- Registers the Surface Planning skill for all four core agents:
--   Know1, Marketa, Aigent C, Aigent Z
--
-- The skill lives at /api/skills/surface-plan and determines the optimal
-- Liquid UI rendering configuration (template, columns, thumbnail size,
-- modal size, CopilotKit action) based on content type, display context,
-- and breakpoint.
--
-- Registered once as a platform skill; agents discover it via metadata.agentIds.
-- ============================================================================

INSERT INTO registry_assets (
  asset_id, tenant_id, asset_class, name, slug, description,
  current_version, trust_band, publication_status, policy_class,
  wrapper_strategy, interface_schema, capabilities, tags, metadata, created_by
) VALUES (
  'skillqube-platform-surface-planner',
  'platform',
  'SkillQube',
  'Surface Planner',
  'platform-surface-planner',
  'Determines the optimal rendering configuration for content based on its type (video, image, article, carousel, audio, link), the display context (list, card, modal, detail, preview, embed), and the active breakpoint (mobile, tablet, desktop). Returns a SurfacePlan with template ID, column count, thumbnail aspect ratio, modal size, and the CopilotKit action name to invoke. Used by agents to make smart layout decisions before rendering content surfaces.',
  '0.1.0',
  'L1_EXPERIMENTAL',
  'published',
  'read_only',
  'skill',
  '{
    "input": {
      "contentType": "video | image | article | carousel | audio | link",
      "displayContext": "list | card | modal | detail | preview | embed",
      "breakpoint": "mobile | tablet | desktop",
      "itemCount": "number (optional)",
      "contentTitle": "string (optional)"
    },
    "output": {
      "templateId": "string",
      "columns": "number",
      "thumbnailAspect": "16:9 | 4:3 | 1:1 | 2:3 | 9:16",
      "thumbnailSize": "xs | sm | md | lg | xl | full",
      "modalSize": "sm | md | lg | xl | full",
      "showPlayOverlay": "boolean",
      "showCaption": "boolean",
      "cardDensity": "compact | standard | expanded",
      "layoutVariant": "string",
      "copilotAction": "string",
      "reasoning": "string"
    }
  }',
  '[
    {"name": "surface_plan", "scope": "ui"},
    {"name": "template_select", "scope": "ui"},
    {"name": "layout_decide", "scope": "ui"}
  ]',
  '["surface-planning", "layout", "agui", "copilotkit", "liquid-ui", "template-selection", "responsive", "content-rendering"]',
  '{
    "agentIds": ["aigent-kn0w1", "aigent-marketa", "aigent-c", "aigent-z"],
    "cartridge": "platform",
    "endpoint": "/api/skills/surface-plan",
    "pricingQc": 0,
    "receiptEmitted": false,
    "authorityRequired": "none",
    "aguiProtocol": true,
    "copilotKitCompatible": true,
    "decisionModel": "rule_matrix",
    "liquidUITemplates": [
      "knyt:drawer_grid_1a", "knyt:drawer_grid_2c", "knyt:drawer_grid_3a",
      "knyt:drawer_grid_1c", "knyt:motion_stage_v1", "knyt:drawer_grid_2b"
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
