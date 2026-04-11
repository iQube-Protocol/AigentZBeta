-- ============================================================================
-- Grant uber_admin to dele@metame.com
--
-- This ensures the estate owner can access all adminOnly content (e.g. the
-- KNYT Experience tab) regardless of which persona or tenant context they
-- are signed in through.
--
-- The record is keyed by:
--   auth_profile_id  → crm_auth_profiles row for the email
--   kybe_did         → Supabase auth.users UUID (if the user already exists)
--
-- Both paths are needed because legacy admin-check code uses kybe_did = email
-- and newer code uses kybe_did = auth.uid() (UUID).
-- ============================================================================

DO $$
DECLARE
  v_email   TEXT    := 'dele@metame.com';
  v_apid    UUID;
  v_uid     TEXT;
  v_full_perms JSONB := jsonb_build_object(
    'read',           true,
    'write',          true,
    'delete',         true,
    'manage_users',   true,
    'manage_admins',  true,
    'manage_settings',true,
    'view_audit_logs',true,
    'export_data',    true
  );
BEGIN
  -- 1. Ensure crm_auth_profile exists for the email
  INSERT INTO public.crm_auth_profiles (email, email_verified, is_active)
  VALUES (v_email, TRUE, TRUE)
  ON CONFLICT (email) DO UPDATE SET is_active = TRUE, email_verified = TRUE;

  SELECT id INTO v_apid FROM public.crm_auth_profiles WHERE email = v_email;

  -- 2. Try to find the Supabase auth UUID for this email
  --    (auth.users is accessible from migrations with service-role context)
  BEGIN
    SELECT id::text INTO v_uid FROM auth.users WHERE email = v_email LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_uid := NULL;  -- auth.users may not be accessible in all contexts
  END;

  -- 3. Insert uber_admin keyed by auth_profile_id (works with email-based checks)
  INSERT INTO public.crm_admin_roles
    (auth_profile_id, kybe_did, role_type, is_active, permissions)
  VALUES
    (v_apid, v_email, 'uber_admin', TRUE, v_full_perms)
  ON CONFLICT DO NOTHING;

  -- 4. If the auth UUID is available, also insert with kybe_did = UUID
  --    (works with RLS-based and newer UUID checks)
  IF v_uid IS NOT NULL AND v_uid <> v_email THEN
    INSERT INTO public.crm_admin_roles
      (auth_profile_id, kybe_did, role_type, is_active, permissions)
    VALUES
      (v_apid, v_uid, 'uber_admin', TRUE, v_full_perms)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
