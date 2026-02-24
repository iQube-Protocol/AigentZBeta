-- Multi-email identity controls with merge/segregate support.

-- 1) Canonical email aliases for auth profiles.
CREATE TABLE IF NOT EXISTS public.crm_auth_profile_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_profile_id UUID NOT NULL REFERENCES public.crm_auth_profiles(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  email_normalized TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_auth_profile_emails_email_normalized
  ON public.crm_auth_profile_emails (email_normalized);

CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_auth_profile_emails_profile_email
  ON public.crm_auth_profile_emails (auth_profile_id, email_normalized);

CREATE INDEX IF NOT EXISTS idx_crm_auth_profile_emails_profile
  ON public.crm_auth_profile_emails (auth_profile_id);

-- 2) Profile-to-profile relationship settings (merged vs segregated).
CREATE TABLE IF NOT EXISTS public.crm_auth_profile_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_auth_profile_id UUID NOT NULL REFERENCES public.crm_auth_profiles(id) ON DELETE CASCADE,
  linked_auth_profile_id UUID NOT NULL REFERENCES public.crm_auth_profiles(id) ON DELETE CASCADE,
  relationship_mode TEXT NOT NULL DEFAULT 'merged' CHECK (relationship_mode IN ('merged', 'segregated')),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT crm_auth_profile_links_no_self_link CHECK (owner_auth_profile_id <> linked_auth_profile_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_auth_profile_links_unique
  ON public.crm_auth_profile_links (owner_auth_profile_id, linked_auth_profile_id);

CREATE INDEX IF NOT EXISTS idx_crm_auth_profile_links_owner
  ON public.crm_auth_profile_links (owner_auth_profile_id, active, relationship_mode);

-- 3) Persona-level access overrides for linked profiles.
CREATE TABLE IF NOT EXISTS public.crm_persona_access_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_auth_profile_id UUID NOT NULL REFERENCES public.crm_auth_profiles(id) ON DELETE CASCADE,
  persona_id UUID NOT NULL REFERENCES public.personas(id) ON DELETE CASCADE,
  access_mode TEXT NOT NULL CHECK (access_mode IN ('allow', 'deny')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_persona_access_preferences_unique
  ON public.crm_persona_access_preferences (owner_auth_profile_id, persona_id);

CREATE INDEX IF NOT EXISTS idx_crm_persona_access_preferences_owner
  ON public.crm_persona_access_preferences (owner_auth_profile_id, access_mode);

-- Keep updated_at fields current.
DROP TRIGGER IF EXISTS crm_auth_profile_emails_updated_at ON public.crm_auth_profile_emails;
CREATE TRIGGER crm_auth_profile_emails_updated_at
  BEFORE UPDATE ON public.crm_auth_profile_emails
  FOR EACH ROW EXECUTE FUNCTION public.crm_update_updated_at();

DROP TRIGGER IF EXISTS crm_auth_profile_links_updated_at ON public.crm_auth_profile_links;
CREATE TRIGGER crm_auth_profile_links_updated_at
  BEFORE UPDATE ON public.crm_auth_profile_links
  FOR EACH ROW EXECUTE FUNCTION public.crm_update_updated_at();

DROP TRIGGER IF EXISTS crm_persona_access_preferences_updated_at ON public.crm_persona_access_preferences;
CREATE TRIGGER crm_persona_access_preferences_updated_at
  BEFORE UPDATE ON public.crm_persona_access_preferences
  FOR EACH ROW EXECUTE FUNCTION public.crm_update_updated_at();

-- Backfill canonical email aliases from existing auth profiles.
INSERT INTO public.crm_auth_profile_emails (
  auth_profile_id,
  email,
  email_normalized,
  is_primary,
  is_verified
)
SELECT
  cap.id,
  lower(cap.email),
  lower(cap.email),
  true,
  cap.email_verified
FROM public.crm_auth_profiles cap
WHERE cap.email IS NOT NULL
ON CONFLICT (email_normalized) DO UPDATE
SET
  auth_profile_id = EXCLUDED.auth_profile_id,
  email = EXCLUDED.email,
  is_primary = true,
  is_verified = EXCLUDED.is_verified,
  updated_at = now();
