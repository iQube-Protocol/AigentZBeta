-- WorkflowEngineBinding — engine-specific deployment of a WorkflowDefinition
-- Each row binds one workflow to one execution engine (make, n8n, inline, openClaw, aci)
-- Multiple bindings per workflow are allowed (e.g. make + aci for redundancy)

CREATE TABLE IF NOT EXISTS workflow_engine_bindings (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id           UUID        NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
  tenant_id             TEXT        NOT NULL,
  engine                TEXT        NOT NULL,  -- 'make' | 'n8n' | 'inline' | 'openClaw' | 'aci'
  deployment_mode       TEXT        NOT NULL DEFAULT 'manual',  -- 'auto' | 'manual' | 'scheduled'
  backend_ids           JSONB       NOT NULL DEFAULT '{}',      -- engine-specific IDs (scenario_id, etc.)
  compiled_artifact_ref TEXT,                                    -- optional ref to compiled bundle
  credential_policy     JSONB       NOT NULL DEFAULT '{}',      -- how creds are resolved
  health_state          TEXT        NOT NULL DEFAULT 'unknown',  -- 'healthy' | 'degraded' | 'unreachable' | 'unknown'
  validation_status     TEXT        NOT NULL DEFAULT 'pending',  -- 'pending' | 'valid' | 'invalid' | 'stale'
  last_health_checked_at TIMESTAMPTZ,
  last_validated_at     TIMESTAMPTZ,
  created_by            TEXT        NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflow_engine_bindings_workflow ON workflow_engine_bindings(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_engine_bindings_tenant   ON workflow_engine_bindings(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_workflow_engine_bindings_unique ON workflow_engine_bindings(workflow_id, engine);
