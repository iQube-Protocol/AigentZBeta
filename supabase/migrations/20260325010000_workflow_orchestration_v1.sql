-- Workflow Orchestration v1
-- Phase 0: foundation schema for workflow definitions, bindings, runs, and trace events

-- Workflow definitions (templates / configurations)
CREATE TABLE IF NOT EXISTS workflow_definitions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   TEXT        NOT NULL,
  name        TEXT        NOT NULL,
  description TEXT,
  adapter     TEXT        NOT NULL,  -- 'n8n' | 'langchain' | 'inline'
  config      JSONB       NOT NULL DEFAULT '{}',
  status      TEXT        NOT NULL DEFAULT 'draft', -- draft | active | archived
  created_by  TEXT        NOT NULL,  -- persona_id
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Per-persona bindings to a workflow
CREATE TABLE IF NOT EXISTS workflow_bindings (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID        NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
  tenant_id   TEXT        NOT NULL,
  persona_id  TEXT        NOT NULL,
  role        TEXT        NOT NULL DEFAULT 'executor', -- owner | executor | observer
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workflow_id, persona_id)
);

-- Run instances
CREATE TABLE IF NOT EXISTS workflow_runs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id  UUID        NOT NULL REFERENCES workflow_definitions(id),
  tenant_id    TEXT        NOT NULL,
  triggered_by TEXT        NOT NULL,  -- persona_id
  status       TEXT        NOT NULL DEFAULT 'pending', -- pending | running | completed | failed | cancelled
  input        JSONB,
  output       JSONB,
  error        TEXT,
  started_at   TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trace events within a run
CREATE TABLE IF NOT EXISTS workflow_run_events (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id     UUID        NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  event_type TEXT        NOT NULL,  -- step_start | step_end | adapter_call | error | log
  step_name  TEXT,
  data       JSONB,
  ts         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_tenant ON workflow_definitions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow      ON workflow_runs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_run_events_run     ON workflow_run_events(run_id);
