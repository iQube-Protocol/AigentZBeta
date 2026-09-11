-- Add Marketa email routing fields to mobility_cases
-- marketa_forward_email: per-case address Marketa forwards institutional responses to
-- marketa_system_ref: commitment ref used as CustomID for reply attribution (computed server-side)

ALTER TABLE mobility_cases
  ADD COLUMN IF NOT EXISTS marketa_forward_email  text,
  ADD COLUMN IF NOT EXISTS institutional_responses jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN mobility_cases.marketa_forward_email IS
  'Per-case forward address — Marketa routes inbound institutional responses here after evaluation';
COMMENT ON COLUMN mobility_cases.institutional_responses IS
  'Array of institutional response records: { institution_id, institution_name, sender_email, subject, summary, received_at, stage_at_receipt, proposed_next_action }';
