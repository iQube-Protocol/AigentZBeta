-- AgentiQ Platform Native Skills — CRM SkillQube Registry Seeds
--
-- Seeds two new CRM-domain SkillQubes into registry_assets:
--   1. agentiq-native-crm-data-cleanup  — audits & normalises CRM tier/dedup issues
--   2. agentiq-native-crm-matrix-prep   — prepares CRM dataset for experience matrix use
--
-- Both are platform-native (tenant='platform'), L3_PRODUCTION_CANDIDATE, Badge A, http wrapper.
-- Default dry_run:true on all mutation operations — safe to invoke for inspection.
--
-- Run AFTER 20260402010000_registry_ingestion_factory_v1.sql

INSERT INTO registry_assets (
  asset_id, tenant_id, asset_class, name, slug, description,
  current_version, trust_band, publication_status, policy_class,
  wrapper_strategy, interface_schema, capabilities, tags, metadata, created_by
) VALUES

(
  'agentiq-native-crm-data-cleanup',
  'platform',
  'SkillQube',
  'CRM Data Cleanup',
  'agentiq-native-crm-data-cleanup',
  'Audits and normalises the nakamoto_knyt_personas CRM dataset. Reports duplicate records by email, non-canonical OM-Tier-Status values, and phantom rows with no identifying data. Optionally applies fixes (dry_run:true by default).',
  '1.0.0',
  'L3_PRODUCTION_CANDIDATE',
  'published',
  'network_limited',
  'http',
  '{
    "input": {
      "dry_run":       {"type": "boolean", "default": true,  "description": "Inspect without writing"},
      "fix_tiers":     {"type": "boolean", "default": true,  "description": "Normalise OM-Tier-Status to canonical form"},
      "merge_dupes":   {"type": "boolean", "default": false, "description": "Delete duplicate rows, keeping richest record"},
      "phantom_report":{"type": "boolean", "default": true,  "description": "Report rows with no name, email, or investment"}
    },
    "output": {
      "dry_run":             {"type": "boolean"},
      "total_rows":          {"type": "number"},
      "tier_report":         {"type": "array",  "description": "Non-canonical tier values with counts and fix targets"},
      "tiers_fixed":         {"type": "number"},
      "tiers_would_fix":     {"type": "number"},
      "dupe_groups":         {"type": "array",  "description": "Duplicate email groups with record counts"},
      "dupes_deleted":       {"type": "number"},
      "dupes_would_delete":  {"type": "number"},
      "phantom_rows":        {"type": "array",  "description": "Rows with no identifying data"},
      "errors":              {"type": "array"}
    }
  }',
  '[{"name": "crm_data_cleanup", "scope": "nakamoto_knyt_personas", "operations": ["tier_normalisation", "deduplication", "phantom_detection"]}]',
  '["crm", "data-cleanup", "normalisation", "deduplication", "nakamoto", "knyt"]',
  '{
    "agentiq_native":   true,
    "badge":            "A",
    "trust_composite":  72,
    "source":           "agentiq_platform_native",
    "studio_skill_id":  "skill:crm_data_cleanup",
    "wrapper_endpoint": "/api/skills/crm/data-cleanup",
    "provider":         "agentiq",
    "dry_run_default":  true,
    "domain":           "crm",
    "dataset":          "nakamoto_knyt_personas"
  }',
  'agentiq-system'
),

(
  'agentiq-native-crm-matrix-prep',
  'platform',
  'SkillQube',
  'CRM Matrix Prep',
  'agentiq-native-crm-matrix-prep',
  'Prepares the nakamoto_knyt_personas CRM dataset for use in the KNYT experience matrix. Derives investment_amount_band, assigns campaign_cohort, normalises tier labels, and computes the matrix Y-stage (observer → collector → curator → correspondent → remixer → creator → steward → franchisee) from engagement signals. Writes computed values back to the table (dry_run:true by default).',
  '1.0.0',
  'L3_PRODUCTION_CANDIDATE',
  'published',
  'network_limited',
  'http',
  '{
    "input": {
      "dry_run":            {"type": "boolean", "default": true,  "description": "Inspect without writing"},
      "assign_bands":       {"type": "boolean", "default": true,  "description": "Derive investment_amount_band from Total-Invested"},
      "assign_cohorts":     {"type": "boolean", "default": true,  "description": "Set campaign_cohort from investment band"},
      "compute_y_stage":    {"type": "boolean", "default": true,  "description": "Compute matrix_y_stage from engagement signals"},
      "overwrite_cohort":   {"type": "boolean", "default": false, "description": "Re-assign cohorts even if already set"},
      "overwrite_y_stage":  {"type": "boolean", "default": false, "description": "Re-compute y_stage even if already set"}
    },
    "output": {
      "dry_run":                {"type": "boolean"},
      "total_rows":             {"type": "number"},
      "bands_set":              {"type": "number"},
      "cohorts_set":            {"type": "number"},
      "y_stages_set":           {"type": "number"},
      "x_stage_distribution":   {"type": "object", "description": "Count per X-axis tier label"},
      "y_stage_distribution":   {"type": "object", "description": "Count per Y-axis stage"},
      "band_distribution":      {"type": "object"},
      "cohort_distribution":    {"type": "object"},
      "errors":                 {"type": "array"}
    }
  }',
  '[{"name": "crm_matrix_prep", "scope": "nakamoto_knyt_personas", "operations": ["band_assignment", "cohort_assignment", "y_stage_computation", "tier_normalisation"]}]',
  '["crm", "matrix", "experience-matrix", "y-stage", "investment-band", "cohort", "nakamoto", "knyt"]',
  '{
    "agentiq_native":   true,
    "badge":            "A",
    "trust_composite":  74,
    "source":           "agentiq_platform_native",
    "studio_skill_id":  "skill:crm_matrix_prep",
    "wrapper_endpoint": "/api/skills/crm/matrix-prep",
    "provider":         "agentiq",
    "dry_run_default":  true,
    "domain":           "crm",
    "dataset":          "nakamoto_knyt_personas",
    "matrix_axes": {
      "x": ["Prospect", "Keta", "Keji", "First", "Zero", "Sat KNYT"],
      "y": ["observer", "collector", "curator", "correspondent", "remixer", "creator", "steward", "franchisee"]
    }
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
