-- 20261001000200_access_grant_capabilities.sql
--
-- IRL Stewardship — capability-scoped participation (items 10-16). Layered
-- STRICTLY ON TOP of `access_grants`: a grant determines what a Persona may
-- ENTER (existing participationAccess.ts, unchanged); a row in this table
-- determines what that Persona may DO once inside, at a specific, narrow
-- resource scope. Neither table implies the other — default-deny is
-- preserved because a grant with zero capability rows confers entry only.
--
-- HIGH-RISK CAPABILITIES ARE NEVER IMPLIED. 'write' and 'run' are ordinary
-- capabilities; ide_ingest / crystal_groom / freeze_unfreeze / canonize /
-- invariant_registry_mutate / protocol_ratify / standing_admin / access_admin
-- are separate, explicit values in the SAME check constraint — granting
-- 'write' inserts a 'write' row, never an 'ide_ingest' row. The service layer
-- (services/research/accessCapabilities.ts) additionally intersects every
-- check against the EXISTING role-authority ceiling in
-- services/research/researchWorkspaceRoles.ts (RESEARCH_WORKSPACE_ROLE_AUTHORITY,
-- whose mayFreeze/mayCanonize/mayGrantStanding/mayEditSourceAssets are literal
-- `false` on every role) — a capability row can never grant what that ceiling
-- already refuses. Two independent gates, never merged into one.
--
-- run_constraints (jsonb) carries the run-type-specific detail item 12 asks
-- for — run type, frozen substrate ref, confirmatory/internal designation,
-- permitted parameters, execution limits — verbatim, no second typed schema
-- (same "recorded blob, no parallel typed copy" precedent as
-- readinessReportAtFreeze / ExecutionRunArtifact.armConfiguration).

BEGIN;

CREATE TABLE IF NOT EXISTS public.access_grant_capabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id uuid NOT NULL REFERENCES public.access_grants(id) ON DELETE CASCADE,
  scope_type text NOT NULL CHECK (scope_type IN (
    'programme', 'experiment', 'review_package', 'crystal_generation', 'run_family', 'artifact'
  )),
  scope_ref text NOT NULL,
  capability text NOT NULL CHECK (capability IN (
    -- ordinary bundles (item 10)
    'read', 'review', 'write', 'run', 'admin',
    -- high-risk, independently gated, never implied (item 10)
    'ide_ingest', 'crystal_groom', 'freeze_unfreeze', 'canonize',
    'invariant_registry_mutate', 'protocol_ratify', 'standing_admin', 'access_admin'
  )),
  run_constraints jsonb,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
  granted_at timestamptz NOT NULL DEFAULT now(),
  granted_by_persona_id uuid NOT NULL,
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by_persona_id uuid,
  reason text,
  receipt_id text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- One active row per (grant, scope, capability) — re-granting an already-
  -- active capability is an amendment (expiry/reason), never a duplicate row.
  UNIQUE (grant_id, scope_type, scope_ref, capability)
);

CREATE INDEX IF NOT EXISTS access_grant_capabilities_grant_idx
  ON public.access_grant_capabilities (grant_id, status);
CREATE INDEX IF NOT EXISTS access_grant_capabilities_scope_idx
  ON public.access_grant_capabilities (scope_type, scope_ref, status);

ALTER TABLE public.access_grant_capabilities ENABLE ROW LEVEL SECURITY;

COMMIT;
