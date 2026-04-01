-- Add execution_id to workflow_runs for tracking the adapter-side execution handle
-- e.g. Make scenario execution ID, n8n execution ID, etc.
ALTER TABLE workflow_runs ADD COLUMN IF NOT EXISTS execution_id TEXT;
CREATE INDEX IF NOT EXISTS idx_workflow_runs_execution_id ON workflow_runs(execution_id) WHERE execution_id IS NOT NULL;
