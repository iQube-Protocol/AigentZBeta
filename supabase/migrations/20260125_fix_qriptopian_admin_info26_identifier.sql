DO $$
DECLARE
  e TEXT := 'info+26@metame.com';
  tid UUID;
  apid UUID;
  auth_uid TEXT;
BEGIN
  SELECT id INTO tid FROM public.crm_tenants WHERE slug = 'qriptopian' LIMIT 1;
  SELECT id INTO apid FROM public.crm_auth_profiles WHERE email = e;

  -- If the user exists in Supabase Auth, prefer using auth.users.id as the identifier
  -- because many edge-functions / admin checks key off the Supabase user id.
  SELECT id::text INTO auth_uid FROM auth.users WHERE email = e LIMIT 1;

  IF auth_uid IS NULL THEN
    auth_uid := e;
  END IF;

  -- Ensure the admin role exists (scoped)
  IF NOT EXISTS (
    SELECT 1 FROM public.crm_admin_roles
    WHERE role_type='tenant_super_admin' AND tenant_id=tid AND (auth_profile_id=apid OR kybe_did=auth_uid) AND is_active=TRUE
  ) THEN
    INSERT INTO public.crm_admin_roles (auth_profile_id, kybe_did, role_type, tenant_id, permissions, is_active)
    VALUES (
      apid,
      auth_uid,
      'tenant_super_admin',
      tid,
      jsonb_build_object('read',true,'write',true,'delete',true,'manage_users',true,'manage_admins',true,'manage_settings',true,'view_audit_logs',true,'export_data',true),
      TRUE
    );
  END IF;

  -- Also update any existing role that used the email shim to use auth_uid
  UPDATE public.crm_admin_roles
  SET kybe_did = auth_uid
  WHERE role_type='tenant_super_admin'
    AND tenant_id = tid
    AND auth_profile_id = apid
    AND kybe_did = e;
END $$;
