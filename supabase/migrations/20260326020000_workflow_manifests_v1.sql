-- InputManifestQube — declared input contract for a workflow
-- OutputManifestQube — canonical output contract for a workflow
-- Only one active manifest of each type per workflow at a time

CREATE TABLE IF NOT EXISTS workflow_input_manifests (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID        NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
  tenant_id   TEXT        NOT NULL,
  version     INTEGER     NOT NULL DEFAULT 1,
  fields      JSONB       NOT NULL DEFAULT '[]',
  -- each field: { name, type, required, description?, defaultValue? }
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_by  TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflow_input_manifests_workflow ON workflow_input_manifests(workflow_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_workflow_input_manifests_active
  ON workflow_input_manifests(workflow_id) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS workflow_output_manifests (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id      UUID        NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
  tenant_id        TEXT        NOT NULL,
  version          INTEGER     NOT NULL DEFAULT 1,
  fields           JSONB       NOT NULL DEFAULT '[]',
  -- each field: { name, type, description? }
  success_criteria JSONB       NOT NULL DEFAULT '{}',
  is_active        BOOLEAN     NOT NULL DEFAULT true,
  created_by       TEXT        NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflow_output_manifests_workflow ON workflow_output_manifests(workflow_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_workflow_output_manifests_active
  ON workflow_output_manifests(workflow_id) WHERE is_active = true;
