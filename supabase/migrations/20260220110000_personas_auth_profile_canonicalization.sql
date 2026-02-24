-- Canonicalize personas.auth_profile_id to CRM auth profile IDs.
-- Goal: the same user email should resolve to one canonical UID across tenants/clients.

CREATE OR REPLACE FUNCTION public.canonicalize_persona_auth_profile_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  incoming_auth_uuid UUID;
  auth_email TEXT;
  canonical_auth_profile_id UUID;
BEGIN
  IF NEW.auth_profile_id IS NULL OR btrim(NEW.auth_profile_id::text) = '' THEN
    RETURN NEW;
  END IF;

  -- If already a CRM auth profile id, keep as-is.
  PERFORM 1
  FROM public.crm_auth_profiles cap
  WHERE cap.id::text = NEW.auth_profile_id::text
  LIMIT 1;

  IF FOUND THEN
    RETURN NEW;
  END IF;

  -- If the incoming id is not a UUID, we cannot map it through auth.users.
  BEGIN
    incoming_auth_uuid := NEW.auth_profile_id::uuid;
  EXCEPTION WHEN OTHERS THEN
    RETURN NEW;
  END;

  -- Resolve auth.users email from the incoming auth UID.
  SELECT lower(u.email)
  INTO auth_email
  FROM auth.users u
  WHERE u.id = incoming_auth_uuid
  LIMIT 1;

  IF auth_email IS NULL OR auth_email = '' THEN
    RETURN NEW;
  END IF;

  -- Reuse existing canonical CRM auth profile by email if present.
  SELECT cap.id
  INTO canonical_auth_profile_id
  FROM public.crm_auth_profiles cap
  WHERE lower(cap.email) = auth_email
  LIMIT 1;

  -- Create one if missing.
  IF canonical_auth_profile_id IS NULL THEN
    INSERT INTO public.crm_auth_profiles (
      email,
      email_verified,
      is_active,
      oauth_providers
    )
    VALUES (
      auth_email,
      TRUE,
      TRUE,
      '{}'::jsonb
    )
    ON CONFLICT (email) DO UPDATE
      SET updated_at = now()
    RETURNING id INTO canonical_auth_profile_id;
  END IF;

  IF canonical_auth_profile_id IS NOT NULL THEN
    NEW.auth_profile_id := canonical_auth_profile_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS personas_canonicalize_auth_profile_id ON public.personas;

CREATE TRIGGER personas_canonicalize_auth_profile_id
BEFORE INSERT OR UPDATE OF auth_profile_id ON public.personas
FOR EACH ROW
EXECUTE FUNCTION public.canonicalize_persona_auth_profile_id();
