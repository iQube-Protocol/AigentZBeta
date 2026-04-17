-- ============================================================================
-- AgentiQ Platform Native Skill — CRM Import SkillQube Registry Seed
--
-- Registers `agentiq-native-crm-import` — a batch record importer that prepares
-- a CRM CSV (or JSON array) for the default metaMe/KNYT experience matrix and
-- loads it into nakamoto_knyt_personas via the ingestion factory pipeline.
--
-- The skill chains to `agentiq-native-crm-matrix-prep` on successful apply so
-- every new record gets its investment band, cohort, and matrix_y_stage
-- assigned in the same invocation.
--
-- Trust: L3_PRODUCTION_CANDIDATE, Badge A, network_limited.
-- Default: dry_run:true (safe inspection).
--
-- Run AFTER 20260415000002_agentiq_crm_skills_registry.sql
-- ============================================================================

INSERT INTO registry_assets (
  asset_id, tenant_id, asset_class, name, slug, description,
  current_version, trust_band, publication_status, policy_class,
  wrapper_strategy, interface_schema, capabilities, tags, metadata, created_by
) VALUES

(
  'agentiq-native-crm-import',
  'platform',
  'SkillQube',
  'CRM Import',
  'agentiq-native-crm-import',
  'Imports a batch of CRM records (CSV parsed client-side or JSON array) into the canonical nakamoto_knyt_personas dataset, ready for the default metaMe / KNYT experience matrix. Auto-detects common column headers (First/Last Name, Email, KNYT-ID, Total-Invested, OM-Tier-Status, social handles, wallet keys), de-duplicates by email, applies a configurable on_duplicate strategy (skip | merge | overwrite), and chains to the CRM Matrix Prep skill on apply so every new record receives its investment_amount_band, campaign_cohort, and matrix_y_stage in the same invocation. Safe by default — dry_run:true returns a full preview without writes.',
  '1.0.0',
  'L3_PRODUCTION_CANDIDATE',
  'published',
  'network_limited',
  'http',
  '{
    "input": {
      "dry_run":              {"type": "boolean", "default": true,  "description": "Preview without writing"},
      "records":              {"type": "array",   "required": true, "description": "Array of record objects to import (typically CSV rows parsed client-side)"},
      "column_map":           {"type": "object",  "default": {},    "description": "Optional source→canonical column name map; overrides built-in aliases"},
      "on_duplicate":         {"type": "string",  "default": "skip", "enum": ["skip", "merge", "overwrite"], "description": "How to handle rows whose email already exists"},
      "default_cohort":       {"type": "string",  "description": "Fallback campaign_cohort for new records"},
      "default_source_tag":   {"type": "string",  "default": "crm_import", "description": "Tag appended to campaign_tags for new records"},
      "chain_matrix_prep":    {"type": "boolean", "default": true,  "description": "After apply, invoke crm-matrix-prep to assign bands/cohorts/y-stage"},
      "experience_matrix_id": {"type": "string",  "default": "knyt-experience-matrix", "description": "Target experience matrix; reserved for future multi-matrix routing"}
    },
    "output": {
      "dry_run":              {"type": "boolean"},
      "experience_matrix_id": {"type": "string"},
      "on_duplicate":         {"type": "string"},
      "total_records":        {"type": "number"},
      "valid_records":        {"type": "number"},
      "invalid":              {"type": "number"},
      "inserted":             {"type": "number"},
      "updated":              {"type": "number"},
      "inserted_would":       {"type": "number", "description": "Dry-run preview of inserts"},
      "updated_would":        {"type": "number", "description": "Dry-run preview of updates"},
      "skipped":              {"type": "number"},
      "sample_inserts":       {"type": "array",  "description": "First 5 insert candidates"},
      "sample_updates":       {"type": "array",  "description": "First 5 update candidates"},
      "errors":               {"type": "array"},
      "matrix_prep":          {"type": "object", "description": "Pass-through result from chained crm-matrix-prep skill"}
    }
  }',
  '[{"name": "crm_import", "scope": "nakamoto_knyt_personas", "operations": ["record_validation", "column_mapping", "email_deduplication", "batch_upsert", "matrix_prep_chain"]}]',
  '["crm", "import", "csv", "ingestion", "factory", "experience-matrix", "nakamoto", "knyt"]',
  '{
    "agentiq_native":   true,
    "badge":            "A",
    "trust_composite":  70,
    "source":           "agentiq_platform_native",
    "studio_skill_id":  "skill:crm_import",
    "wrapper_endpoint": "/api/skills/crm/import",
    "provider":         "agentiq",
    "dry_run_default":  true,
    "domain":           "crm",
    "dataset":          "nakamoto_knyt_personas",
    "factory_stage":    "intake",
    "chains_to":        ["agentiq-native-crm-matrix-prep"],
    "default_matrix":   "knyt-experience-matrix"
  }',
  'agentiq-system'
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
