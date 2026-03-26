-- ChannelQube — binds a workflow to a QubeTalk channel + thread for agent coordination
-- Invocation events are posted to the bound channel so other agents can observe

CREATE TABLE IF NOT EXISTS workflow_channel_qubes (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id          UUID        NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
  tenant_id            TEXT        NOT NULL,
  channel_name         TEXT        NOT NULL,   -- QubeTalk channel, e.g. "metame-runtime-thinclient"
  thread               TEXT        NOT NULL DEFAULT 'dev-exec',
  participating_agents TEXT[]      NOT NULL DEFAULT '{}',
  policy_ref           TEXT,                   -- optional ref to QubeTalk policy evaluation
  active               BOOLEAN     NOT NULL DEFAULT true,
  created_by           TEXT        NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workflow_id)
);

CREATE INDEX IF NOT EXISTS idx_workflow_channel_qubes_tenant ON workflow_channel_qubes(tenant_id);
