-- ExecutionReceiptQube — persisted audit receipt for every pipeline execution
-- Closes the ReceiptService.storeReceipt() TODO and gives pipeline_runs.receipt_refs a real target

CREATE TABLE IF NOT EXISTS execution_receipts (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_run_id   TEXT        REFERENCES pipeline_runs(pipeline_run_id) ON DELETE SET NULL,
  workflow_id       UUID        REFERENCES workflow_definitions(id) ON DELETE SET NULL,
  tenant_id         TEXT        NOT NULL,
  receipt_type      TEXT        NOT NULL DEFAULT 'pipeline_completion',
  -- 'pipeline_completion' | 'workflow_invocation' | 'manual'
  status            TEXT        NOT NULL DEFAULT 'pending',
  -- 'pending' | 'completed' | 'failed'
  dvn_message_id    TEXT,
  dvn_submitted_at  TIMESTAMPTZ,
  from_agent_id     TEXT,
  to_agent_id       TEXT,
  task_completed    TEXT,
  policy_evaluation JSONB       NOT NULL DEFAULT '{}',
  result_data       JSONB       NOT NULL DEFAULT '{}',
  metadata          JSONB       NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_execution_receipts_run    ON execution_receipts(pipeline_run_id);
CREATE INDEX IF NOT EXISTS idx_execution_receipts_tenant ON execution_receipts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_execution_receipts_status ON execution_receipts(status);
