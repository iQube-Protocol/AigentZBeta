DO $$
DECLARE
  e TEXT := 'info+26@metame.com';
  fid UUID;
  tid UUID;
  apid UUID;
BEGIN
  INSERT INTO public.crm_auth_profiles (email, email_verified, is_active)
  VALUES (e, TRUE, TRUE)
  ON CONFLICT (email) DO UPDATE SET is_active = TRUE;

  SELECT id INTO apid FROM public.crm_auth_profiles WHERE email = e;
  SELECT id INTO fid FROM public.crm_franchises WHERE slug = 'qripto-media' LIMIT 1;
  IF fid IS NULL THEN SELECT id INTO fid FROM public.crm_franchises ORDER BY created_at ASC LIMIT 1; END IF;

  SELECT id INTO tid FROM public.crm_tenants WHERE slug = 'qriptopian' LIMIT 1;
  IF tid IS NULL THEN
    INSERT INTO public.crm_tenants (franchise_id, slug, name, description, domain, is_active)
    VALUES (fid, 'qriptopian', 'Qriptopian', 'The Qriptopian tenant', 'theqriptopian.netlify.app', TRUE)
    RETURNING id INTO tid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.crm_admin_roles
    WHERE role_type='tenant_super_admin' AND tenant_id=tid AND (auth_profile_id=apid OR kybe_did=e) AND is_active=TRUE
  ) THEN
    INSERT INTO public.crm_admin_roles (auth_profile_id, kybe_did, role_type, tenant_id, permissions, is_active)
    VALUES (
      apid, e, 'tenant_super_admin', tid,
      jsonb_build_object('read',true,'write',true,'delete',true,'manage_users',true,'manage_admins',true,'manage_settings',true,'view_audit_logs',true,'export_data',true),
      TRUE
    );
  END IF;
END $$;
