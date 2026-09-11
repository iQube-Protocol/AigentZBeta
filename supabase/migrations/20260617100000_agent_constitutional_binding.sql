-- 20260617100000 — Agent constitutional binding + revocation state
--
-- Option A (autonomous agents) requires every Agent Passport to bind to an
-- explicit, versioned constitution / charter / delegation framework, name its
-- revocation authority, and carry a revocation state. These columns extend
-- agent_root_identity (the existing agent substrate) — no parallel table.
--
-- Sovereignty stays human-only: autonomous agents carry NO kybe identity, are
-- never citizens, and are always identifiable as agents. The binding makes a
-- constitutional mismatch detectable (⇒ automatic suspension) and revocation
-- immediate.

BEGIN;

ALTER TABLE public.agent_root_identity
  ADD COLUMN IF NOT EXISTS constitution_version          text,
  ADD COLUMN IF NOT EXISTS agent_charter_version         text,
  ADD COLUMN IF NOT EXISTS delegation_framework_version  text,
  -- T0 persona id of the authority allowed to revoke (sponsor / admin).
  ADD COLUMN IF NOT EXISTS revocation_authority_persona_id text,
  ADD COLUMN IF NOT EXISTS revocation_state              text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS revocation_state_at           timestamptz,
  ADD COLUMN IF NOT EXISTS revocation_reason             text;

-- Revocation lifecycle states (Agent Charter §Revocation).
ALTER TABLE public.agent_root_identity
  DROP CONSTRAINT IF EXISTS agent_root_identity_revocation_state_check;
ALTER TABLE public.agent_root_identity
  ADD CONSTRAINT agent_root_identity_revocation_state_check
  CHECK (revocation_state IN ('active', 'paused', 'suspended', 'revoked', 'quarantined', 'destroyed'));

COMMENT ON COLUMN public.agent_root_identity.constitution_version IS
  'Polity Constitution version this agent binds to (Agent Charter §Constitutional Binding).';
COMMENT ON COLUMN public.agent_root_identity.revocation_state IS
  'active | paused | suspended | revoked | quarantined | destroyed. revoked/destroyed are terminal.';

CREATE INDEX IF NOT EXISTS idx_agent_root_revocation_state
  ON public.agent_root_identity (revocation_state);

COMMIT;
