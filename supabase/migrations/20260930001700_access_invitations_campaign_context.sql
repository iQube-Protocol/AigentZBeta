-- Threshold Cohort Activation Phase A (2026-08-05 canonical Agent Bench plan).
-- Adds campaign context to access_invitations rather than building a second
-- invitation system for the Constitutional Admission Package (§3/§4 of the
-- plan). Nullable: every existing invitation type (passport, research-lab,
-- venture-lab, metame-studio, developer-studio) has none of these and is
-- unaffected.

ALTER TABLE public.access_invitations
  ADD COLUMN IF NOT EXISTS campaign_id TEXT,
  ADD COLUMN IF NOT EXISTS external_agent_ref TEXT,
  ADD COLUMN IF NOT EXISTS requested_service_domain TEXT;

CREATE INDEX IF NOT EXISTS idx_access_invitations_campaign_id
  ON public.access_invitations (campaign_id);
CREATE INDEX IF NOT EXISTS idx_access_invitations_external_agent_ref
  ON public.access_invitations (external_agent_ref);
