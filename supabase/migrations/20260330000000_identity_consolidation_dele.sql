-- Identity Consolidation for dele@metame.com
-- ---------------------------------------------------------------------------
-- Goal: Find every UUID and persona associated with dele@metame.com across
-- all identity surfaces, merge them under one canonical crm_auth_profiles
-- entry, and link all auth profile UUIDs so the personas API returns the
-- full set regardless of which UUID a persona was created under.
--
-- Safe to re-run (all inserts use ON CONFLICT DO NOTHING / DO UPDATE).
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  v_email            TEXT := 'dele@metame.com';
  v_canonical_id     UUID;
  v_supabase_uid     UUID;
  v_other_profile_id UUID;
  rec                RECORD;
BEGIN

  -- -------------------------------------------------------------------------
  -- 1. Ensure canonical crm_auth_profiles entry exists for this email
  -- -------------------------------------------------------------------------
  INSERT INTO public.crm_auth_profiles (email, email_verified, is_active, oauth_providers)
  VALUES (v_email, TRUE, TRUE, '{}')
  ON CONFLICT (email) DO UPDATE SET
    email_verified = TRUE,
    is_active      = TRUE,
    updated_at     = now()
  RETURNING id INTO v_canonical_id;

  -- If INSERT returned nothing (row already existed before RETURNING), fetch it.
  IF v_canonical_id IS NULL THEN
    SELECT id INTO v_canonical_id
    FROM public.crm_auth_profiles
    WHERE lower(email) = lower(v_email)
    LIMIT 1;
  END IF;

  RAISE NOTICE 'canonical crm_auth_profiles.id = %', v_canonical_id;

  -- -------------------------------------------------------------------------
  -- 2. Ensure the email alias row exists
  -- -------------------------------------------------------------------------
  INSERT INTO public.crm_auth_profile_emails
    (auth_profile_id, email, email_normalized, is_primary, is_verified, status)
  VALUES
    (v_canonical_id, v_email, lower(v_email), TRUE, TRUE, 'active')
  ON CONFLICT (email_normalized) DO UPDATE SET
    auth_profile_id = v_canonical_id,
    is_primary      = TRUE,
    is_verified     = TRUE,
    status          = 'active',
    updated_at      = now();

  -- -------------------------------------------------------------------------
  -- 3. Find the Supabase auth.users UUID for this email
  -- -------------------------------------------------------------------------
  SELECT id INTO v_supabase_uid
  FROM auth.users
  WHERE lower(email) = lower(v_email)
  LIMIT 1;

  RAISE NOTICE 'supabase auth.users.id = %', v_supabase_uid;

  -- -------------------------------------------------------------------------
  -- 4. If Supabase UUID differs from canonical, create a CRM profile for it
  --    and link it to canonical via crm_auth_profile_links.
  -- -------------------------------------------------------------------------
  IF v_supabase_uid IS NOT NULL AND v_supabase_uid <> v_canonical_id THEN

    -- Ensure the supabase UUID has a crm_auth_profiles row (may be synthetic)
    INSERT INTO public.crm_auth_profiles (id, email, email_verified, is_active, oauth_providers)
    VALUES (
      v_supabase_uid,
      concat(v_supabase_uid::text, '@supabase.auth.local'),
      FALSE, TRUE, '{}'
    )
    ON CONFLICT (id) DO NOTHING;

    -- Merge: canonical owns the supabase UUID profile
    INSERT INTO public.crm_auth_profile_links
      (owner_auth_profile_id, linked_auth_profile_id, relationship_mode, active)
    VALUES
      (v_canonical_id, v_supabase_uid, 'merged', TRUE)
    ON CONFLICT (owner_auth_profile_id, linked_auth_profile_id) DO UPDATE SET
      active             = TRUE,
      relationship_mode  = 'merged',
      updated_at         = now();

    -- Re-assign personas that carry the supabase UUID to the canonical
    UPDATE public.personas
    SET auth_profile_id = v_canonical_id
    WHERE auth_profile_id = v_supabase_uid;

    GET DIAGNOSTICS rec = ROW_COUNT;
    RAISE NOTICE 'Reassigned % persona(s) from supabase UUID to canonical', rec;
  END IF;

  -- -------------------------------------------------------------------------
  -- 5. Find any OTHER crm_auth_profiles entries referencing this email via
  --    email aliases, and link them to canonical.
  -- -------------------------------------------------------------------------
  FOR rec IN
    SELECT DISTINCT cap.id
    FROM public.crm_auth_profiles cap
    WHERE lower(cap.email) = lower(v_email)
      AND cap.id <> v_canonical_id
    UNION
    SELECT DISTINCT cae.auth_profile_id
    FROM public.crm_auth_profile_emails cae
    WHERE lower(cae.email_normalized) = lower(v_email)
      AND cae.auth_profile_id <> v_canonical_id
  LOOP
    v_other_profile_id := rec.id;
    RAISE NOTICE 'Linking orphan profile % → canonical', v_other_profile_id;

    INSERT INTO public.crm_auth_profile_links
      (owner_auth_profile_id, linked_auth_profile_id, relationship_mode, active)
    VALUES
      (v_canonical_id, v_other_profile_id, 'merged', TRUE)
    ON CONFLICT (owner_auth_profile_id, linked_auth_profile_id) DO UPDATE SET
      active = TRUE, updated_at = now();

    -- Re-assign personas on orphan profile → canonical
    UPDATE public.personas
    SET auth_profile_id = v_canonical_id
    WHERE auth_profile_id = v_other_profile_id;
  END LOOP;

  -- -------------------------------------------------------------------------
  -- 6. Find any personas whose crm_persona links this email via crm_personas
  -- -------------------------------------------------------------------------
  FOR rec IN
    SELECT DISTINCT cp.identity_persona_id AS persona_id
    FROM public.crm_personas cp
    WHERE lower(cp.email) = lower(v_email)
      AND cp.identity_persona_id IS NOT NULL
  LOOP
    -- Ensure these personas are owned by canonical
    UPDATE public.personas
    SET auth_profile_id = v_canonical_id
    WHERE id = rec.persona_id
      AND (auth_profile_id IS NULL OR auth_profile_id <> v_canonical_id);
  END LOOP;

  -- -------------------------------------------------------------------------
  -- 7. Grant knyt admin/steward/correspondent roles to any persona now
  --    owned by canonical (world = 21sats).  Safe re-run via ON CONFLICT.
  -- -------------------------------------------------------------------------
  FOR rec IN
    SELECT id FROM public.personas
    WHERE auth_profile_id = v_canonical_id
  LOOP
    INSERT INTO public.knyt_persona_roles (persona_id, role, world_id)
    VALUES
      (rec.id, 'knyt:admin',         '21sats'),
      (rec.id, 'knyt:steward',       '21sats'),
      (rec.id, 'knyt:correspondent', '21sats')
    ON CONFLICT (persona_id, role, world_id) DO NOTHING;
  END LOOP;

  RAISE NOTICE 'Identity consolidation complete for %', v_email;
END $$;
