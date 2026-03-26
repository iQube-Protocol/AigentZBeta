-- Pipeline Control Plane v1
-- Phase 0: authoritative stage tracking for the experience pipeline

CREATE TABLE IF NOT EXISTS pipeline_runs (
  pipeline_run_id TEXT        PRIMARY KEY,
  tenant_id       TEXT        NOT NULL,
  initiated_by    TEXT        NOT NULL,   -- personaId
  initiated_via   TEXT        NOT NULL,   -- studio-composer | marketa | api | qubetalk | system
  current_stage   TEXT        NOT NULL,
  stage_history   JSONB       NOT NULL DEFAULT '[]',
  identity_envelope JSONB     NOT NULL DEFAULT '{}',
  template_ref    TEXT,
  workflow_ref    TEXT,
  status          TEXT        NOT NULL DEFAULT 'running', -- running | completed | failed | blocked
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  failure_reason  TEXT,
  receipt_refs    JSONB       NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS pipeline_run_events (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id     TEXT        NOT NULL REFERENCES pipeline_runs(pipeline_run_id) ON DELETE CASCADE,
  event_type TEXT        NOT NULL,  -- pipeline.stage.changed | deployment.started | pipeline.completed | etc.
  stage      TEXT,
  data       JSONB,
  ts         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_runs_tenant    ON pipeline_runs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_status    ON pipeline_runs(status);
CREATE INDEX IF NOT EXISTS idx_pipeline_run_events_run ON pipeline_run_events(run_id);
