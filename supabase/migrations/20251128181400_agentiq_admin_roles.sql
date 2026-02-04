-- ============================================================================
-- AgentiQ CRM Phase 1d: Admin Role Hierarchy
-- ============================================================================
-- 
-- ADMIN HIERARCHY (outside → inside):
--
-- 1. UBER ADMINS (Estate-wide, outside hierarchy)
--    - Estate-wide admin rights across entire AgentiQ platform
--    - Can manage ALL franchises and ALL tenants
--    - Can create/remove Super Admins at any layer
--    - Sits OUTSIDE the application hierarchy
--
-- 2. CATEGORY UBER ADMINS (Domain-specific estate-wide)
--    - Uber admin rights confined to their domain category
--    - E.g., "Content Marketing Uber Admin", "Ecommerce Uber Admin"
--    - Cross-cutting across platform, franchises, and tenants within domain
--
-- 3. SUPER ADMINS (Platform/Franchise/Tenant level)
--    - Platform Super Admin: Admin rights across entire platform
--    - Franchise Super Admin: Admin rights across all franchise's tenants
--    - Tenant Super Admin: Admin rights within single tenant
--
-- 4. CATEGORY ADMINS (Domain-specific at their access level)
--    - Domain-specific rights (Social, Content, Sales, etc.)
--    - Scoped to their platform/franchise/tenant access level
--
-- ============================================================================

-- ============================================================================
-- ADMIN DOMAIN CATEGORIES
-- ============================================================================

CREATE TABLE IF NOT EXISTS crm_admin_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,  -- Icon identifier for UI
  color TEXT, -- Color code for UI
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default categories
INSERT INTO crm_admin_categories (slug, name, description, icon, color) VALUES
  ('content', 'Content', 'Content creation, publishing, and management', 'file-text', '#3B82F6'),
  ('marketing', 'Marketing', 'Marketing campaigns, analytics, and outreach', 'megaphone', '#8B5CF6'),
  ('sales', 'Sales', 'Sales pipelines, leads, and conversions', 'trending-up', '#10B981'),
  ('social', 'Social', 'Social media management and engagement', 'share-2', '#EC4899'),
  ('ecommerce', 'E-Commerce', 'Product catalog, orders, and payments', 'shopping-cart', '#F59E0B'),
  ('support', 'Support', 'Customer support and ticketing', 'headphones', '#06B6D4'),
  ('analytics', 'Analytics', 'Data analysis and reporting', 'bar-chart-2', '#6366F1'),
  ('finance', 'Finance', 'Financial operations and treasury', 'dollar-sign', '#22C55E'),
  ('operations', 'Operations', 'Platform operations and infrastructure', 'settings', '#64748B'),
  ('identity', 'Identity', 'Identity, personas, and access management', 'user-check', '#EF4444')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- ADMIN ROLES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS crm_admin_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- The admin account (linked to platform account or auth profile)
  platform_account_id UUID REFERENCES crm_platform_accounts(id) ON DELETE CASCADE,
  auth_profile_id UUID REFERENCES crm_auth_profiles(id) ON DELETE CASCADE,
  kybe_did TEXT,  -- For quick lookups
  
  -- Role type
  role_type TEXT NOT NULL CHECK (role_type IN (
    'uber_admin',           -- Estate-wide, outside hierarchy
    'category_uber_admin',  -- Domain-specific estate-wide
    'platform_super_admin', -- Platform-level super admin
    'franchise_super_admin',-- Franchise-level super admin
    'tenant_super_admin',   -- Tenant-level super admin
    'category_admin'        -- Domain-specific at access level
  )),
  
  -- Scope (NULL for uber_admin = estate-wide)
  franchise_id UUID REFERENCES crm_franchises(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES crm_tenants(id) ON DELETE CASCADE,
  
  -- Category (for category_uber_admin and category_admin)
  category_id UUID REFERENCES crm_admin_categories(id) ON DELETE CASCADE,
  
  -- Permissions (JSONB for flexibility)
  permissions JSONB DEFAULT '{
    "read": true,
    "write": true,
    "delete": false,
    "manage_users": false,
    "manage_admins": false,
    "manage_settings": false,
    "view_audit_logs": true,
    "export_data": false
  }',
  
  -- Who granted this role
  granted_by_admin_role_id UUID REFERENCES crm_admin_roles(id),
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Expiration (optional)
  expires_at TIMESTAMPTZ,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  suspended_at TIMESTAMPTZ,
  suspension_reason TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_scope CHECK (
    -- Uber admin: no scope restrictions
    (role_type = 'uber_admin' AND franchise_id IS NULL AND tenant_id IS NULL AND category_id IS NULL)
    -- Category uber admin: must have category, no franchise/tenant scope
    OR (role_type = 'category_uber_admin' AND category_id IS NOT NULL AND franchise_id IS NULL AND tenant_id IS NULL)
    -- Platform super admin: no franchise/tenant scope
    OR (role_type = 'platform_super_admin' AND franchise_id IS NULL AND tenant_id IS NULL)
    -- Franchise super admin: must have franchise, no tenant
    OR (role_type = 'franchise_super_admin' AND franchise_id IS NOT NULL AND tenant_id IS NULL)
    -- Tenant super admin: must have tenant
    OR (role_type = 'tenant_super_admin' AND tenant_id IS NOT NULL)
    -- Category admin: must have category
    OR (role_type = 'category_admin' AND category_id IS NOT NULL)
  )
);

-- Unique index: one role per scope per person (using COALESCE for nullable columns)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_admin_role ON crm_admin_roles (
  COALESCE(platform_account_id, '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE(auth_profile_id, '00000000-0000-0000-0000-000000000000'::uuid),
  role_type,
  COALESCE(franchise_id, '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE(category_id, '00000000-0000-0000-0000-000000000000'::uuid)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_admin_roles_platform_account ON crm_admin_roles(platform_account_id);
CREATE INDEX IF NOT EXISTS idx_admin_roles_auth_profile ON crm_admin_roles(auth_profile_id);
CREATE INDEX IF NOT EXISTS idx_admin_roles_kybe_did ON crm_admin_roles(kybe_did);
CREATE INDEX IF NOT EXISTS idx_admin_roles_type ON crm_admin_roles(role_type);
CREATE INDEX IF NOT EXISTS idx_admin_roles_franchise ON crm_admin_roles(franchise_id);
CREATE INDEX IF NOT EXISTS idx_admin_roles_tenant ON crm_admin_roles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_admin_roles_category ON crm_admin_roles(category_id);
CREATE INDEX IF NOT EXISTS idx_admin_roles_active ON crm_admin_roles(is_active) WHERE is_active = TRUE;

-- ============================================================================
-- ADMIN ROLE HIERARCHY VIEW
-- ============================================================================
-- Shows the complete admin hierarchy with resolved names

CREATE OR REPLACE VIEW crm_admin_roles_expanded AS
SELECT
  ar.id,
  ar.kybe_did,
  ar.role_type,
  ar.permissions,
  ar.is_active,
  ar.expires_at,
  ar.created_at,
  -- Platform account info
  pa.display_name AS admin_display_name,
  pa.account_type AS platform_account_type,
  -- Category info
  ac.slug AS category_slug,
  ac.name AS category_name,
  -- Franchise info
  f.slug AS franchise_slug,
  f.name AS franchise_name,
  -- Tenant info
  t.slug AS tenant_slug,
  t.name AS tenant_name,
  -- Computed scope description
  CASE ar.role_type
    WHEN 'uber_admin' THEN 'Estate-wide (all platforms, franchises, tenants)'
    WHEN 'category_uber_admin' THEN 'Estate-wide for ' || ac.name || ' domain'
    WHEN 'platform_super_admin' THEN 'Platform-wide (all franchises and tenants)'
    WHEN 'franchise_super_admin' THEN 'Franchise: ' || f.name || ' (all tenants)'
    WHEN 'tenant_super_admin' THEN 'Tenant: ' || t.name
    WHEN 'category_admin' THEN ac.name || ' admin at ' || 
      COALESCE('Tenant: ' || t.name, 'Franchise: ' || f.name, 'Platform')
    ELSE 'Unknown'
  END AS scope_description,
  -- Computed access level (for sorting/filtering)
  CASE ar.role_type
    WHEN 'uber_admin' THEN 1
    WHEN 'category_uber_admin' THEN 2
    WHEN 'platform_super_admin' THEN 3
    WHEN 'franchise_super_admin' THEN 4
    WHEN 'tenant_super_admin' THEN 5
    WHEN 'category_admin' THEN 6
    ELSE 99
  END AS access_level
FROM crm_admin_roles ar
LEFT JOIN crm_platform_accounts pa ON pa.id = ar.platform_account_id
LEFT JOIN crm_admin_categories ac ON ac.id = ar.category_id
LEFT JOIN crm_franchises f ON f.id = ar.franchise_id
LEFT JOIN crm_tenants t ON t.id = ar.tenant_id
WHERE ar.is_active = TRUE
  AND (ar.expires_at IS NULL OR ar.expires_at > NOW());

-- ============================================================================
-- ADMIN ACCESS CHECK FUNCTION
-- ============================================================================
-- Checks if an admin has access to a specific resource

CREATE OR REPLACE FUNCTION check_admin_access(
  p_kybe_did TEXT,
  p_action TEXT,  -- 'read', 'write', 'delete', 'manage_users', etc.
  p_franchise_id UUID DEFAULT NULL,
  p_tenant_id UUID DEFAULT NULL,
  p_category_slug TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  v_has_access BOOLEAN := FALSE;
  v_category_id UUID;
BEGIN
  -- Get category ID if slug provided
  IF p_category_slug IS NOT NULL THEN
    SELECT id INTO v_category_id FROM crm_admin_categories WHERE slug = p_category_slug;
  END IF;

  -- Check for uber admin (estate-wide access)
  SELECT TRUE INTO v_has_access
  FROM crm_admin_roles ar
  WHERE ar.kybe_did = p_kybe_did
    AND ar.role_type = 'uber_admin'
    AND ar.is_active = TRUE
    AND (ar.expires_at IS NULL OR ar.expires_at > NOW())
    AND (ar.permissions->>p_action)::boolean = TRUE;
  
  IF v_has_access THEN RETURN TRUE; END IF;

  -- Check for category uber admin (if category specified)
  IF v_category_id IS NOT NULL THEN
    SELECT TRUE INTO v_has_access
    FROM crm_admin_roles ar
    WHERE ar.kybe_did = p_kybe_did
      AND ar.role_type = 'category_uber_admin'
      AND ar.category_id = v_category_id
      AND ar.is_active = TRUE
      AND (ar.expires_at IS NULL OR ar.expires_at > NOW())
      AND (ar.permissions->>p_action)::boolean = TRUE;
    
    IF v_has_access THEN RETURN TRUE; END IF;
  END IF;

  -- Check for platform super admin
  SELECT TRUE INTO v_has_access
  FROM crm_admin_roles ar
  WHERE ar.kybe_did = p_kybe_did
    AND ar.role_type = 'platform_super_admin'
    AND ar.is_active = TRUE
    AND (ar.expires_at IS NULL OR ar.expires_at > NOW())
    AND (ar.permissions->>p_action)::boolean = TRUE;
  
  IF v_has_access THEN RETURN TRUE; END IF;

  -- Check for franchise super admin (if franchise specified)
  IF p_franchise_id IS NOT NULL OR p_tenant_id IS NOT NULL THEN
    -- Get franchise from tenant if needed
    DECLARE
      v_franchise_id UUID := p_franchise_id;
    BEGIN
      IF v_franchise_id IS NULL AND p_tenant_id IS NOT NULL THEN
        SELECT franchise_id INTO v_franchise_id FROM crm_tenants WHERE id = p_tenant_id;
      END IF;
      
      SELECT TRUE INTO v_has_access
      FROM crm_admin_roles ar
      WHERE ar.kybe_did = p_kybe_did
        AND ar.role_type = 'franchise_super_admin'
        AND ar.franchise_id = v_franchise_id
        AND ar.is_active = TRUE
        AND (ar.expires_at IS NULL OR ar.expires_at > NOW())
        AND (ar.permissions->>p_action)::boolean = TRUE;
      
      IF v_has_access THEN RETURN TRUE; END IF;
    END;
  END IF;

  -- Check for tenant super admin (if tenant specified)
  IF p_tenant_id IS NOT NULL THEN
    SELECT TRUE INTO v_has_access
    FROM crm_admin_roles ar
    WHERE ar.kybe_did = p_kybe_did
      AND ar.role_type = 'tenant_super_admin'
      AND ar.tenant_id = p_tenant_id
      AND ar.is_active = TRUE
      AND (ar.expires_at IS NULL OR ar.expires_at > NOW())
      AND (ar.permissions->>p_action)::boolean = TRUE;
    
    IF v_has_access THEN RETURN TRUE; END IF;
  END IF;

  -- Check for category admin (if category specified)
  IF v_category_id IS NOT NULL THEN
    SELECT TRUE INTO v_has_access
    FROM crm_admin_roles ar
    WHERE ar.kybe_did = p_kybe_did
      AND ar.role_type = 'category_admin'
      AND ar.category_id = v_category_id
      AND ar.is_active = TRUE
      AND (ar.expires_at IS NULL OR ar.expires_at > NOW())
      AND (ar.permissions->>p_action)::boolean = TRUE
      -- Category admin must also have matching scope
      AND (
        ar.tenant_id = p_tenant_id
        OR ar.franchise_id = p_franchise_id
        OR (ar.franchise_id IS NULL AND ar.tenant_id IS NULL)  -- Platform-level category admin
      );
    
    IF v_has_access THEN RETURN TRUE; END IF;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- GET USER ADMIN ROLES FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_admin_roles(p_kybe_did TEXT)
RETURNS TABLE (
  role_id UUID,
  role_type TEXT,
  category_name TEXT,
  franchise_name TEXT,
  tenant_name TEXT,
  scope_description TEXT,
  permissions JSONB,
  access_level INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    are.id,
    are.role_type,
    are.category_name,
    are.franchise_name,
    are.tenant_name,
    are.scope_description,
    are.permissions,
    are.access_level
  FROM crm_admin_roles_expanded are
  WHERE are.kybe_did = p_kybe_did
  ORDER BY are.access_level;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ADMIN ROLE AUDIT LOG
-- ============================================================================

CREATE TABLE IF NOT EXISTS crm_admin_role_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_role_id UUID REFERENCES crm_admin_roles(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN (
    'created', 'updated', 'suspended', 'reactivated', 'expired', 'deleted'
  )),
  old_values JSONB,
  new_values JSONB,
  performed_by_kybe_did TEXT,
  performed_by_admin_role_id UUID REFERENCES crm_admin_roles(id),
  reason TEXT,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_role_audit_role ON crm_admin_role_audit(admin_role_id);
CREATE INDEX IF NOT EXISTS idx_admin_role_audit_performed_by ON crm_admin_role_audit(performed_by_kybe_did);
CREATE INDEX IF NOT EXISTS idx_admin_role_audit_action ON crm_admin_role_audit(action);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE crm_admin_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_admin_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_admin_role_audit ENABLE ROW LEVEL SECURITY;

-- Categories: readable by all authenticated users
CREATE POLICY "admin_categories_read" ON crm_admin_categories
  FOR SELECT USING (TRUE);

-- Admin roles: only uber admins can see all, others see their own
CREATE POLICY "admin_roles_access" ON crm_admin_roles
  FOR ALL USING (
    -- Own roles
    kybe_did = auth.uid()::text
    -- Or is uber admin
    OR check_admin_access(auth.uid()::text, 'read', NULL, NULL, NULL)
  );

-- Audit logs: only admins with view_audit_logs permission
CREATE POLICY "admin_role_audit_access" ON crm_admin_role_audit
  FOR SELECT USING (
    check_admin_access(auth.uid()::text, 'view_audit_logs', NULL, NULL, NULL)
  );

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Updated at trigger
CREATE TRIGGER set_updated_at_admin_categories
  BEFORE UPDATE ON crm_admin_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_admin_roles
  BEFORE UPDATE ON crm_admin_roles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Audit trigger for admin role changes
CREATE OR REPLACE FUNCTION audit_admin_role_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO crm_admin_role_audit (admin_role_id, action, new_values)
    VALUES (NEW.id, 'created', to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.is_active = TRUE AND NEW.is_active = FALSE THEN
      INSERT INTO crm_admin_role_audit (admin_role_id, action, old_values, new_values, reason)
      VALUES (NEW.id, 'suspended', to_jsonb(OLD), to_jsonb(NEW), NEW.suspension_reason);
    ELSIF OLD.is_active = FALSE AND NEW.is_active = TRUE THEN
      INSERT INTO crm_admin_role_audit (admin_role_id, action, old_values, new_values)
      VALUES (NEW.id, 'reactivated', to_jsonb(OLD), to_jsonb(NEW));
    ELSE
      INSERT INTO crm_admin_role_audit (admin_role_id, action, old_values, new_values)
      VALUES (NEW.id, 'updated', to_jsonb(OLD), to_jsonb(NEW));
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO crm_admin_role_audit (admin_role_id, action, old_values)
    VALUES (OLD.id, 'deleted', to_jsonb(OLD));
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_admin_roles
  AFTER INSERT OR UPDATE OR DELETE ON crm_admin_roles
  FOR EACH ROW EXECUTE FUNCTION audit_admin_role_changes();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE crm_admin_categories IS 'Domain categories for category-specific admin roles (Content, Marketing, Sales, etc.)';
COMMENT ON TABLE crm_admin_roles IS 'Admin role assignments with hierarchical access control';
COMMENT ON TABLE crm_admin_role_audit IS 'Audit log for all admin role changes';
COMMENT ON FUNCTION check_admin_access IS 'Check if a user has admin access for a specific action and scope';
COMMENT ON FUNCTION get_user_admin_roles IS 'Get all admin roles for a user';
COMMENT ON VIEW crm_admin_roles_expanded IS 'Expanded view of admin roles with resolved names and scope descriptions';
