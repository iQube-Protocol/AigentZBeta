-- ============================================================================
-- AgentiQ CRM Phase 1c: Platform-Level Accounts & Auto-Provisioning
-- ============================================================================
-- 
-- HIERARCHY (top to bottom):
--   AgentiQ Platform Account (optional - platform-level users)
--     └── Franchise (optional - user may have direct tenant access)
--           └── Tenant (application)
--                 └── Persona (auto-created on ANY account signup)
--
-- KEY PRINCIPLES:
-- 1. Users can have accounts at ANY layer independently
-- 2. Any account signup auto-creates persona + registry profile
-- 3. All data exposed to AgentiQ platform per DiDQube policy
-- 4. Kybe DID is the universal identifier across all layers
--
-- ============================================================================

-- ============================================================================
-- UTILITY FUNCTIONS
-- ============================================================================

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- AGENTIQ PLATFORM ACCOUNTS
-- ============================================================================
-- Platform-level accounts that sit ABOVE franchises
-- These are users who have direct AgentiQ platform access

CREATE TABLE IF NOT EXISTS crm_platform_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identity linking (Kybe DID is the universal identifier)
  kybe_did TEXT UNIQUE,
  auth_profile_id UUID REFERENCES crm_auth_profiles(id),
  
  -- Platform account details
  account_type TEXT NOT NULL DEFAULT 'standard' CHECK (account_type IN (
    'standard',      -- Regular platform user
    'operator',      -- Platform operator (can manage franchises)
    'admin',         -- Platform admin
    'super_admin'    -- Full platform access
  )),
  
  -- Display info
  display_name TEXT,
  avatar_url TEXT,
  
  -- Platform-level settings
  settings JSONB DEFAULT '{}',
  
  -- DiDQube compliance
  didqube_consent_given BOOLEAN DEFAULT FALSE,
  didqube_consent_at TIMESTAMPTZ,
  privacy_level TEXT DEFAULT 'standard' CHECK (privacy_level IN (
    'minimal',    -- Minimum data sharing
    'standard',   -- Standard data sharing
    'enhanced'    -- Full data sharing for better experience
  )),
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  suspended_at TIMESTAMPTZ,
  suspension_reason TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_platform_accounts_kybe_did ON crm_platform_accounts(kybe_did);
CREATE INDEX IF NOT EXISTS idx_platform_accounts_auth_profile ON crm_platform_accounts(auth_profile_id);
CREATE INDEX IF NOT EXISTS idx_platform_accounts_type ON crm_platform_accounts(account_type);

-- ============================================================================
-- PLATFORM ACCOUNT → FRANCHISE MEMBERSHIPS
-- ============================================================================
-- Links platform accounts to franchises they have access to
-- A platform account can manage/access multiple franchises

CREATE TABLE IF NOT EXISTS crm_platform_franchise_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_account_id UUID NOT NULL REFERENCES crm_platform_accounts(id) ON DELETE CASCADE,
  franchise_id UUID NOT NULL REFERENCES crm_franchises(id) ON DELETE CASCADE,
  
  -- Access level
  access_role TEXT NOT NULL DEFAULT 'member' CHECK (access_role IN (
    'member',     -- Basic access
    'manager',    -- Can manage franchise settings
    'owner'       -- Full franchise control
  )),
  
  -- Granted by
  granted_by_platform_account_id UUID REFERENCES crm_platform_accounts(id),
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(platform_account_id, franchise_id)
);

CREATE INDEX IF NOT EXISTS idx_platform_franchise_access_account ON crm_platform_franchise_access(platform_account_id);
CREATE INDEX IF NOT EXISTS idx_platform_franchise_access_franchise ON crm_platform_franchise_access(franchise_id);

-- ============================================================================
-- REGISTRY PROFILE (Auto-created for ANY account)
-- ============================================================================
-- This is the unified profile exposed to the AgentiQ platform
-- Created automatically when user signs up at ANY layer

CREATE TABLE IF NOT EXISTS crm_registry_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Universal identifier
  kybe_did TEXT UNIQUE NOT NULL,
  
  -- Links to various account levels (all optional)
  platform_account_id UUID REFERENCES crm_platform_accounts(id),
  auth_profile_id UUID REFERENCES crm_auth_profiles(id),
  
  -- Profile data (aggregated from all layers)
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  
  -- Computed/cached reputation from RQH
  reputation_bucket TEXT CHECK (reputation_bucket IN (
    'unknown', 'new', 'low', 'medium', 'high', 'exceptional'
  )),
  reputation_score_cached NUMERIC(10, 4),
  reputation_updated_at TIMESTAMPTZ,
  
  -- DiDQube compliance settings
  visibility_level TEXT DEFAULT 'standard' CHECK (visibility_level IN (
    'private',    -- Only visible to self and explicit grants
    'standard',   -- Visible to tenants/franchises user belongs to
    'public'      -- Visible across platform (per DiDQube policy)
  )),
  
  -- Aggregated stats (cached, updated periodically)
  total_pokw_all_tenants NUMERIC(20, 4) DEFAULT 0,
  total_contributions_all_tenants INTEGER DEFAULT 0,
  total_rewards_earned JSONB DEFAULT '{"QCT": 0, "QOYN": 0, "KNYT": 0}',
  
  -- Account origin tracking
  origin_layer TEXT NOT NULL CHECK (origin_layer IN (
    'platform',   -- First signed up at AgentiQ platform
    'franchise',  -- First signed up at a franchise
    'tenant'      -- First signed up at a tenant application
  )),
  origin_tenant_id UUID REFERENCES crm_tenants(id),
  origin_franchise_id UUID REFERENCES crm_franchises(id),
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_registry_profiles_kybe_did ON crm_registry_profiles(kybe_did);
CREATE INDEX IF NOT EXISTS idx_registry_profiles_platform ON crm_registry_profiles(platform_account_id);
CREATE INDEX IF NOT EXISTS idx_registry_profiles_auth ON crm_registry_profiles(auth_profile_id);
CREATE INDEX IF NOT EXISTS idx_registry_profiles_visibility ON crm_registry_profiles(visibility_level);

-- ============================================================================
-- REGISTRY PROFILE → PERSONA LINKS
-- ============================================================================
-- Links registry profile to all personas across all tenants

CREATE TABLE IF NOT EXISTS crm_registry_persona_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registry_profile_id UUID NOT NULL REFERENCES crm_registry_profiles(id) ON DELETE CASCADE,
  persona_id UUID NOT NULL REFERENCES crm_personas(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES crm_tenants(id) ON DELETE CASCADE,
  
  -- Is this the primary persona for this tenant?
  is_primary_for_tenant BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  linked_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(registry_profile_id, persona_id)
);

CREATE INDEX IF NOT EXISTS idx_registry_persona_links_profile ON crm_registry_persona_links(registry_profile_id);
CREATE INDEX IF NOT EXISTS idx_registry_persona_links_persona ON crm_registry_persona_links(persona_id);
CREATE INDEX IF NOT EXISTS idx_registry_persona_links_tenant ON crm_registry_persona_links(tenant_id);

-- ============================================================================
-- AUTO-PROVISIONING TRIGGER
-- ============================================================================
-- When a persona is created at ANY layer, auto-create registry profile

CREATE OR REPLACE FUNCTION auto_provision_registry_profile()
RETURNS TRIGGER AS $$
DECLARE
  v_registry_profile_id UUID;
  v_tenant RECORD;
  v_franchise RECORD;
  v_origin_layer TEXT;
BEGIN
  -- Skip if no kybe_did (anonymous persona)
  IF NEW.kybe_did IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Check if registry profile already exists for this kybe_did
  SELECT id INTO v_registry_profile_id
  FROM crm_registry_profiles
  WHERE kybe_did = NEW.kybe_did;
  
  IF v_registry_profile_id IS NULL THEN
    -- Get tenant and franchise info
    SELECT * INTO v_tenant FROM crm_tenants WHERE id = NEW.tenant_id;
    IF v_tenant IS NOT NULL THEN
      SELECT * INTO v_franchise FROM crm_franchises WHERE id = v_tenant.franchise_id;
    END IF;
    
    -- Determine origin layer
    v_origin_layer := 'tenant';  -- Default: persona created at tenant level
    
    -- Create new registry profile
    INSERT INTO crm_registry_profiles (
      kybe_did,
      display_name,
      origin_layer,
      origin_tenant_id,
      origin_franchise_id
    ) VALUES (
      NEW.kybe_did,
      NEW.display_name,
      v_origin_layer,
      NEW.tenant_id,
      v_tenant.franchise_id
    )
    RETURNING id INTO v_registry_profile_id;
  END IF;
  
  -- Link persona to registry profile
  INSERT INTO crm_registry_persona_links (
    registry_profile_id,
    persona_id,
    tenant_id,
    is_primary_for_tenant
  ) VALUES (
    v_registry_profile_id,
    NEW.id,
    NEW.tenant_id,
    TRUE  -- First persona for this tenant is primary
  )
  ON CONFLICT (registry_profile_id, persona_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trg_auto_provision_registry ON crm_personas;
CREATE TRIGGER trg_auto_provision_registry
  AFTER INSERT ON crm_personas
  FOR EACH ROW
  EXECUTE FUNCTION auto_provision_registry_profile();

-- ============================================================================
-- DIDQUBE POLICY COMPLIANCE VIEW
-- ============================================================================
-- View that respects DiDQube privacy settings when exposing data

CREATE OR REPLACE VIEW crm_registry_profiles_public AS
SELECT
  rp.id,
  rp.kybe_did,
  -- Only show display_name if visibility allows
  CASE 
    WHEN rp.visibility_level = 'private' THEN NULL
    ELSE rp.display_name
  END AS display_name,
  CASE 
    WHEN rp.visibility_level = 'private' THEN NULL
    ELSE rp.avatar_url
  END AS avatar_url,
  -- Reputation is always visible (anonymized per DiDQube)
  rp.reputation_bucket,
  -- Stats only visible if not private
  CASE 
    WHEN rp.visibility_level = 'private' THEN NULL
    ELSE rp.total_pokw_all_tenants
  END AS total_pokw,
  rp.visibility_level,
  rp.is_active,
  rp.created_at
FROM crm_registry_profiles rp
WHERE rp.is_active = TRUE;

-- ============================================================================
-- ACCOUNT LAYER SUMMARY VIEW
-- ============================================================================
-- Shows what layers a user has accounts at

CREATE OR REPLACE VIEW crm_user_account_layers AS
SELECT
  rp.kybe_did,
  rp.id AS registry_profile_id,
  pa.id AS platform_account_id,
  pa.account_type AS platform_account_type,
  (
    SELECT json_agg(json_build_object(
      'franchise_id', f.id,
      'franchise_name', f.name,
      'access_role', pfa.access_role
    ))
    FROM crm_platform_franchise_access pfa
    JOIN crm_franchises f ON f.id = pfa.franchise_id
    WHERE pfa.platform_account_id = pa.id
  ) AS franchise_access,
  (
    SELECT json_agg(json_build_object(
      'tenant_id', t.id,
      'tenant_name', t.name,
      'franchise_id', t.franchise_id,
      'persona_id', p.id,
      'persona_display_name', p.display_name
    ))
    FROM crm_registry_persona_links rpl
    JOIN crm_personas p ON p.id = rpl.persona_id
    JOIN crm_tenants t ON t.id = rpl.tenant_id
    WHERE rpl.registry_profile_id = rp.id
  ) AS tenant_personas,
  rp.origin_layer,
  rp.created_at
FROM crm_registry_profiles rp
LEFT JOIN crm_platform_accounts pa ON pa.kybe_did = rp.kybe_did;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE crm_platform_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_platform_franchise_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_registry_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_registry_persona_links ENABLE ROW LEVEL SECURITY;

-- Platform accounts: users can see their own, admins can see all
CREATE POLICY "platform_accounts_self_access" ON crm_platform_accounts
  FOR ALL USING (
    auth.uid()::text = kybe_did 
    OR EXISTS (
      SELECT 1 FROM crm_platform_accounts pa 
      WHERE pa.kybe_did = auth.uid()::text 
      AND pa.account_type IN ('admin', 'super_admin')
    )
  );

-- Platform franchise access: visible to account owner and franchise managers
CREATE POLICY "platform_franchise_access_policy" ON crm_platform_franchise_access
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM crm_platform_accounts pa
      WHERE pa.id = platform_account_id
      AND (pa.kybe_did = auth.uid()::text OR pa.account_type IN ('admin', 'super_admin'))
    )
  );

-- Registry profiles: respect visibility settings
CREATE POLICY "registry_profiles_visibility" ON crm_registry_profiles
  FOR SELECT USING (
    kybe_did = auth.uid()::text  -- Own profile
    OR visibility_level = 'public'  -- Public profiles
    OR (
      visibility_level = 'standard' 
      AND EXISTS (
        -- Same tenant/franchise membership
        SELECT 1 FROM crm_registry_persona_links rpl1
        JOIN crm_registry_persona_links rpl2 ON rpl1.tenant_id = rpl2.tenant_id
        JOIN crm_registry_profiles rp ON rp.id = rpl2.registry_profile_id
        WHERE rpl1.registry_profile_id = crm_registry_profiles.id
        AND rp.kybe_did = auth.uid()::text
      )
    )
  );

-- Registry persona links: visible to profile owner
CREATE POLICY "registry_persona_links_policy" ON crm_registry_persona_links
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM crm_registry_profiles rp
      WHERE rp.id = registry_profile_id
      AND rp.kybe_did = auth.uid()::text
    )
  );

-- ============================================================================
-- UPDATED_AT TRIGGERS
-- ============================================================================

CREATE TRIGGER set_updated_at_platform_accounts
  BEFORE UPDATE ON crm_platform_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_registry_profiles
  BEFORE UPDATE ON crm_registry_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE crm_platform_accounts IS 'AgentiQ platform-level accounts that sit above franchises in the hierarchy';
COMMENT ON TABLE crm_platform_franchise_access IS 'Links platform accounts to franchises they can access/manage';
COMMENT ON TABLE crm_registry_profiles IS 'Unified profile auto-created for ANY account signup, exposed to AgentiQ platform per DiDQube policy';
COMMENT ON TABLE crm_registry_persona_links IS 'Links registry profiles to all personas across all tenants';
COMMENT ON VIEW crm_registry_profiles_public IS 'Public view of registry profiles respecting DiDQube privacy settings';
COMMENT ON VIEW crm_user_account_layers IS 'Summary of what layers a user has accounts at';
