-- KNYT CRM DataQube — Foundational First-Class Registration
--
-- Registers the canonical KNYT investor/backer CRM dataset as a DataQube
-- in registry_assets. This is the first DataQube in the platform registry.
--
-- Primary source table: nakamoto_knyt_personas (3,748 rows, cleaned + deduped)
-- Secondary source table: crm_personas (linked by identity_persona_id)
-- Depends on SkillQubes: agentiq-native-crm-data-cleanup, agentiq-native-crm-matrix-prep
--
-- Trust band: L4_PRODUCTION_APPROVED — dataset is cleaned, deduped, validated,
-- actively used by the live campaign pipeline, and skills-governed.
--
-- Run AFTER 20260415000002_agentiq_crm_skills_registry.sql

INSERT INTO registry_assets (
  asset_id, tenant_id, asset_class, name, slug, description,
  current_version, trust_band, publication_status, policy_class,
  wrapper_strategy, interface_schema, capabilities, tags, metadata, created_by
) VALUES (
  'dataqube-knyt-crm',
  'platform',
  'DataQube',
  'KNYT CRM DataQube',
  'dataqube-knyt-crm',
  'Canonical KNYT investor and backer CRM dataset. Primary source: nakamoto_knyt_personas (3,748 cleaned, deduped rows) with enriched profile, social, and investment signals. Secondary: crm_personas linked by identity_persona_id. Powers KNYT campaign cohort assignment, Experience Matrix Y-stage computation, investor outreach sequencing, and the AVL Relationship Builder customer surface. Governed by CRM cleanup and matrix-prep SkillQubes.',
  '1.0.0',
  'L4_PRODUCTION_APPROVED',
  'published',
  'read_only',
  'http',
  '{
    "primary_table": "public.nakamoto_knyt_personas",
    "secondary_table": "public.crm_personas",
    "link_key": "identity_persona_id",
    "row_count": 3748,
    "primary_columns": {
      "id":                    {"type": "uuid",    "description": "Primary key"},
      "user_id":               {"type": "uuid",    "description": "Auth user reference (nullable)"},
      "Email":                 {"type": "text",    "description": "Investor email"},
      "First-Name":            {"type": "text"},
      "Last-Name":             {"type": "text"},
      "Total-Invested":        {"type": "numeric", "description": "Historical investment total USD"},
      "OM-Tier-Status":        {"type": "text",    "description": "Order of Metaiye tier (Keta/Keji/First/Zero/Sat KNYT)"},
      "campaign_cohort":       {"type": "text",    "description": "Assigned campaign cohort (A-F + zero_knyt_legacy)"},
      "investment_amount_band":{"type": "text",    "description": "Band derived from Total-Invested"},
      "matrix_y_stage":        {"type": "text",    "description": "Experience matrix Y-axis stage"},
      "ks_backer":             {"type": "boolean", "description": "Kickstarter backer flag"},
      "campaign_state":        {"type": "text",    "description": "Campaign engagement state"},
      "offer_fit":             {"type": "text",    "description": "Offer fit tag"}
    }
  }',
  '[
    {"name": "list_personas",        "description": "List personas with optional filters (cohort, tier, band, campaign_state)", "inputSchema": {"cohort": "optional", "tier": "optional", "band": "optional", "campaign_state": "optional", "limit": "optional"}},
    {"name": "get_persona",          "description": "Fetch single persona by id or email"},
    {"name": "search_personas",      "description": "Full-text search across first_name, last_name, display_name, fio_handle — all records, not paginated window"},
    {"name": "aggregate_by_cohort",  "description": "Count personas per campaign cohort"},
    {"name": "aggregate_by_tier",    "description": "Count personas per OM-Tier-Status"},
    {"name": "ladder_distribution",  "description": "Stage distribution across patronage and PCS axes"},
    {"name": "pipeline_candidates",  "description": "Return First/Zero stage holders and recruiters for Venture Lab pipeline"}
  ]',
  '["crm", "knyt", "nakamoto", "investor", "backer", "personas", "campaign", "data-source", "foundational", "first-class"]',
  '{
    "agentiq_native":     true,
    "badge":              "A",
    "trust_composite":    82,
    "source":             "nakamoto_crm_pipeline",
    "domain":             "crm",
    "primary_dataset":    "nakamoto_knyt_personas",
    "secondary_dataset":  "crm_personas",
    "row_count":          3748,
    "last_cleaned_at":    "2026-04-16T00:00:00Z",
    "depends_on_skills":  ["agentiq-native-crm-data-cleanup", "agentiq-native-crm-matrix-prep"],
    "query_endpoint":     "/api/crm/investors",
    "search_endpoint":    "/api/runtime/experience/dashboard?view=individual",
    "autodrive_pack":     "knyt",
    "autodrive_manifest": "dataqube.json",
    "autodrive_cid":      null,
    "canonized_at":       "2026-04-16T00:00:00Z",
    "canonized_by":       "aigent-z"
  }',
  'aigent-z'
)
ON CONFLICT (asset_id) DO UPDATE SET
  name               = EXCLUDED.name,
  description        = EXCLUDED.description,
  trust_band         = EXCLUDED.trust_band,
  publication_status = EXCLUDED.publication_status,
  capabilities       = EXCLUDED.capabilities,
  interface_schema   = EXCLUDED.interface_schema,
  tags               = EXCLUDED.tags,
  metadata           = EXCLUDED.metadata,
  updated_at         = now();
