-- Brand-new-user default-persona fallback
--
-- Adds crm_auth_profiles.default_persona_id so the identity spine can
-- resolve a caller's "preferred" persona deterministically when no
-- session token, header, or URL param is present. Without this column,
-- new users fall back to the oldest persona by created_at — which on
-- a fresh seed can resolve to a shared agent persona (e.g. devagent)
-- the user does not own personally.
--
-- Resolver step 3.5 in services/identity/getActivePersona.ts reads this
-- column for the caller AND for every multi-email-merged linked
-- auth_profile. The first non-null value that resolves to an OWNED
-- persona wins. If unset or stale, the resolver falls back to step 4
-- (oldest owned).

ALTER TABLE public.crm_auth_profiles
  ADD COLUMN IF NOT EXISTS default_persona_id UUID REFERENCES public.personas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_crm_auth_profiles_default_persona
  ON public.crm_auth_profiles (default_persona_id)
  WHERE default_persona_id IS NOT NULL;

COMMENT ON COLUMN public.crm_auth_profiles.default_persona_id IS
  'Preferred persona for this auth profile. Resolver step 3.5 in '
  'services/identity/getActivePersona.ts uses this before falling back '
  'to "first owned by created_at" so brand-new users do not inherit a '
  'shared agent persona.';
