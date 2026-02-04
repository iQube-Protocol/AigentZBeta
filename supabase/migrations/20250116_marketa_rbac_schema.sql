/**
 * Marketa Database Schema with RBAC Support
 * 
 * Updated Supabase schema with proper tenant isolation and RBAC policies.
 * Partners can only access their own tenant data through RLS policies.
 */

-- ============================================================================
-- MARKETA SCHEMA WITH RBAC
-- ============================================================================

-- Create marketa schema
CREATE SCHEMA IF NOT EXISTS marketa;

-- ============================================================================
-- CORE ENTITIES WITH TENANT ISOLATION
-- ============================================================================

-- Partners table (tenant-scoped)
CREATE TABLE marketa.partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  role_type TEXT NOT NULL,
  channels JSONB DEFAULT '[]',
  make_webhook_url TEXT,
  brand_constraints JSONB DEFAULT '{}',
  approval_contacts JSONB DEFAULT '[]',
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique partner codes within each tenant
  UNIQUE(tenant_id, code)
);

-- Channel accounts table (tenant-scoped)
CREATE TABLE marketa.channel_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  credentials JSONB NOT NULL,
  webhook_urls JSONB DEFAULT '[]',
  list_ids JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique platform per tenant
  UNIQUE(tenant_id, platform)
);

-- Audience profiles table (tenant-scoped)
CREATE TABLE marketa.audience_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  wallet_address TEXT,
  persona_id TEXT,
  discord_id TEXT,
  telegram_id TEXT,
  whatsapp_id TEXT,
  investment_tier INTEGER DEFAULT 0, -- 0..4
  engagement_tier TEXT DEFAULT 'cold', -- cold|warm|active|advocate
  flags JSONB DEFAULT '{}', -- mythos_bias, logos_bias, builder_flag, partner_affinity
  consent JSONB DEFAULT '{}', -- email_opt_in, sms_opt_in, whatsapp_opt_in
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique email within tenant
  UNIQUE(tenant_id, email)
);

-- Campaigns table (tenant-scoped)
CREATE TABLE marketa.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  phase TEXT NOT NULL, -- codex1, regcf, pre_fairlaunch, fairlaunch
  themes JSONB DEFAULT '[]',
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  primary_cta TEXT,
  proof_points JSONB DEFAULT '[]',
  status TEXT DEFAULT 'draft',
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Packs table (tenant-scoped)
CREATE TABLE marketa.packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  campaign_id UUID REFERENCES marketa.campaigns(id) ON DELETE SET NULL,
  partner_id UUID REFERENCES marketa.partners(id) ON DELETE SET NULL,
  week_of DATE NOT NULL,
  phase TEXT NOT NULL,
  status TEXT DEFAULT 'draft', -- draft, approved, sent
  version INTEGER DEFAULT 1,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pack items table (tenant-scoped via pack)
CREATE TABLE marketa.pack_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id UUID NOT NULL REFERENCES marketa.packs(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL, -- hero, short1, short2, short3, newsletter, community
  thread TEXT NOT NULL, -- mythos, logos, bridge, overlap
  mode TEXT NOT NULL, -- separate, bridge, overlap
  content JSONB NOT NULL,
  platform_variants JSONB DEFAULT '{}',
  utm_links JSONB DEFAULT '[]',
  assets JSONB DEFAULT '[]',
  cta TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Delivery logs table (tenant-scoped)
CREATE TABLE marketa.delivery_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  payload_id TEXT NOT NULL,
  pack_id UUID REFERENCES marketa.packs(id) ON DELETE SET NULL,
  item_id UUID REFERENCES marketa.pack_items(id) ON DELETE SET NULL,
  platform TEXT NOT NULL,
  status TEXT NOT NULL, -- pending, sent, delivered, failed
  post_url TEXT,
  error TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ
);

-- Reward actions table (tenant-scoped)
CREATE TABLE marketa.reward_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  type TEXT NOT NULL, -- grant_knyt_deferred_mint, grant_qc_credit
  profile_id UUID REFERENCES marketa.audience_profiles(id) ON DELETE SET NULL,
  recipient_data JSONB NOT NULL,
  amount DECIMAL(20,8) NOT NULL,
  network TEXT NOT NULL,
  reason TEXT NOT NULL,
  campaign_id UUID REFERENCES marketa.campaigns(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending', -- pending, issued, failed
  transaction_hash TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CRM events table (tenant-scoped)
CREATE TABLE marketa.crm_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  profile_id UUID REFERENCES marketa.audience_profiles(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL, -- sent, opened, clicked, purchased, activated, reward_issued
  campaign_id UUID REFERENCES marketa.campaigns(id) ON DELETE SET NULL,
  channel TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Publish jobs table (tenant-scoped)
CREATE TABLE marketa.publish_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  pack_id UUID NOT NULL REFERENCES marketa.packs(id) ON DELETE CASCADE,
  targets JSONB NOT NULL,
  dry_run BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'pending', -- pending, running, completed, failed
  results JSONB DEFAULT '{}',
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ============================================================================
-- RBAC ACCESS CONTROL TABLES
-- ============================================================================

-- Partner access control (who can access which partner data)
CREATE TABLE marketa.partner_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  persona_id TEXT NOT NULL,
  partner_id UUID REFERENCES marketa.partners(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'viewer', -- admin, editor, viewer
  granted_by TEXT NOT NULL,
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  
  -- Ensure unique persona-partner combination within tenant
  UNIQUE(tenant_id, persona_id, partner_id)
);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all Marketa tables
ALTER TABLE marketa.partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketa.channel_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketa.audience_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketa.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketa.packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketa.pack_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketa.delivery_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketa.reward_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketa.crm_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketa.publish_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketa.partner_access ENABLE ROW LEVEL SECURITY;

-- Partners RLS policies
CREATE POLICY "Users can view partners from their tenant only" ON marketa.partners
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM public.crm_personas 
      WHERE id::text = current_setting('app.current_persona_id', true)
    )
  );

CREATE POLICY "Users can insert partners for their tenant only" ON marketa.partners
  FOR INSERT WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.crm_personas 
      WHERE id::text = current_setting('app.current_persona_id', true)
    )
  );

CREATE POLICY "Users can update partners from their tenant only" ON marketa.partners
  FOR UPDATE USING (
    tenant_id IN (
      SELECT tenant_id FROM public.crm_personas 
      WHERE id::text = current_setting('app.current_persona_id', true)
    )
  );

-- Campaigns RLS policies
CREATE POLICY "Users can view campaigns from their tenant only" ON marketa.campaigns
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM public.crm_personas 
      WHERE id::text = current_setting('app.current_persona_id', true)
    )
  );

CREATE POLICY "Users can manage campaigns for their tenant only" ON marketa.campaigns
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM public.crm_personas 
      WHERE id::text = current_setting('app.current_persona_id', true)
    )
  );

-- Packs RLS policies
CREATE POLICY "Users can view packs from their tenant only" ON marketa.packs
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM public.crm_personas 
      WHERE id::text = current_setting('app.current_persona_id', true)
    )
  );

CREATE POLICY "Users can manage packs for their tenant only" ON marketa.packs
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM public.crm_personas 
      WHERE id::text = current_setting('app.current_persona_id', true)
    )
  );

-- Audience Profiles RLS policies
CREATE POLICY "Users can view profiles from their tenant only" ON marketa.audience_profiles
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM public.crm_personas 
      WHERE id::text = current_setting('app.current_persona_id', true)
    )
  );

CREATE POLICY "Users can manage profiles for their tenant only" ON marketa.audience_profiles
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM public.crm_personas 
      WHERE id::text = current_setting('app.current_persona_id', true)
    )
  );

-- Delivery Logs RLS policies
CREATE POLICY "Users can view delivery logs from their tenant only" ON marketa.delivery_logs
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM public.crm_personas 
      WHERE id::text = current_setting('app.current_persona_id', true)
    )
  );

-- Reward Actions RLS policies
CREATE POLICY "Users can view rewards from their tenant only" ON marketa.reward_actions
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM public.crm_personas 
      WHERE id::text = current_setting('app.current_persona_id', true)
    )
  );

CREATE POLICY "Users can manage rewards for their tenant only" ON marketa.reward_actions
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM public.crm_personas 
      WHERE id::text = current_setting('app.current_persona_id', true)
    )
  );

-- CRM Events RLS policies
CREATE POLICY "Users can view CRM events from their tenant only" ON marketa.crm_events
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM public.crm_personas 
      WHERE id::text = current_setting('app.current_persona_id', true)
    )
  );

CREATE POLICY "Users can create CRM events for their tenant only" ON marketa.crm_events
  FOR INSERT WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.crm_personas 
      WHERE id::text = current_setting('app.current_persona_id', true)
    )
  );

-- ============================================================================
-- VIEWS FOR OPTIMIZED QUERIES
-- ============================================================================

-- View for tenant-specific partner summary
CREATE VIEW marketa.v_tenant_partners AS
SELECT 
  p.*,
  t.name as tenant_name,
  t.franchise_id
FROM marketa.partners p
JOIN public.crm_tenants t ON p.tenant_id = t.id::text;

-- View for tenant-specific campaign performance
CREATE VIEW marketa.v_tenant_campaign_performance AS
SELECT 
  c.*,
  t.name as tenant_name,
  COUNT(DISTINCT pa.id) as pack_count,
  COUNT(DISTINCT dl.id) as delivery_count,
  COUNT(DISTINCT ra.id) as reward_count
FROM marketa.campaigns c
JOIN public.crm_tenants t ON c.tenant_id = t.id::text
LEFT JOIN marketa.packs pa ON c.id = pa.campaign_id
LEFT JOIN marketa.delivery_logs dl ON pa.id = dl.pack_id
LEFT JOIN marketa.reward_actions ra ON c.id = ra.campaign_id
GROUP BY c.id, t.name;

-- View for tenant-specific audience segmentation
CREATE VIEW marketa.v_tenant_audience_summary AS
SELECT 
  ap.tenant_id,
  t.name as tenant_name,
  COUNT(*) as total_profiles,
  COUNT(*) FILTER (WHERE ap.investment_tier >= 3) as high_value_profiles,
  COUNT(*) FILTER (WHERE ap.engagement_tier = 'advocate') as advocate_profiles,
  COUNT(*) FILTER (WHERE ap.flags->>'mythos_bias' = 'true') as mythos_biased_profiles,
  COUNT(*) FILTER (WHERE ap.flags->>'logos_bias' = 'true') as logos_biased_profiles,
  COUNT(*) FILTER (WHERE ap.consent->>'email_opt_in' = 'true') as email_opted_in_profiles
FROM marketa.audience_profiles ap
JOIN public.crm_tenants t ON ap.tenant_id = t.id::text
GROUP BY ap.tenant_id, t.name;

-- ============================================================================
-- FUNCTIONS FOR TENANT ISOLATION
-- ============================================================================

-- Function to get current user's tenant context
CREATE OR REPLACE FUNCTION marketa.get_current_tenant_id()
RETURNS TEXT AS $$
DECLARE
  current_persona_id TEXT;
  tenant_id TEXT;
BEGIN
  -- Get current persona from session variable
  current_persona_id := current_setting('app.current_persona_id', true);
  
  -- Get tenant_id for this persona
  SELECT tenant_id INTO tenant_id
  FROM public.crm_personas
  WHERE id::text = current_persona_id;
  
  RETURN tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user can access tenant data
CREATE OR REPLACE FUNCTION marketa.can_access_tenant(target_tenant_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  user_tenant_id TEXT;
BEGIN
  user_tenant_id := marketa.get_current_tenant_id();
  
  -- Users can access their own tenant
  IF user_tenant_id = target_tenant_id THEN
    RETURN TRUE;
  END IF;
  
  -- Check if user is admin (can access all tenants)
  -- Add admin logic here based on your admin table structure
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Tenant-based indexes for all tables
CREATE INDEX idx_partners_tenant_id ON marketa.partners(tenant_id);
CREATE INDEX idx_campaigns_tenant_id ON marketa.campaigns(tenant_id);
CREATE INDEX idx_packs_tenant_id ON marketa.packs(tenant_id);
CREATE INDEX idx_audience_profiles_tenant_id ON marketa.audience_profiles(tenant_id);
CREATE INDEX idx_delivery_logs_tenant_id ON marketa.delivery_logs(tenant_id);
CREATE INDEX idx_reward_actions_tenant_id ON marketa.reward_actions(tenant_id);
CREATE INDEX idx_crm_events_tenant_id ON marketa.crm_events(tenant_id);
CREATE INDEX idx_publish_jobs_tenant_id ON marketa.publish_jobs(tenant_id);

-- Additional performance indexes
CREATE INDEX idx_packs_campaign_id ON marketa.packs(campaign_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX idx_packs_partner_id ON marketa.packs(partner_id) WHERE partner_id IS NOT NULL;
CREATE INDEX idx_delivery_logs_pack_id ON marketa.delivery_logs(pack_id) WHERE pack_id IS NOT NULL;
CREATE INDEX idx_delivery_logs_item_id ON marketa.delivery_logs(item_id) WHERE item_id IS NOT NULL;
CREATE INDEX idx_audience_profiles_email ON marketa.audience_profiles(email) WHERE email IS NOT NULL;
CREATE INDEX idx_audience_profiles_investment_tier ON marketa.audience_profiles(investment_tier);
CREATE INDEX idx_audience_profiles_engagement_tier ON marketa.audience_profiles(engagement_tier);

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION marketa.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to enforce tenant isolation for packs
CREATE OR REPLACE FUNCTION marketa.enforce_pack_tenant_isolation()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure partner belongs to same tenant
  IF NEW.partner_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM marketa.partners p 
      WHERE p.id = NEW.partner_id AND p.tenant_id = NEW.tenant_id
    ) THEN
      RAISE EXCEPTION 'Partner does not belong to the same tenant';
    END IF;
  END IF;
  
  -- Ensure campaign belongs to same tenant
  IF NEW.campaign_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM marketa.campaigns c 
      WHERE c.id = NEW.campaign_id AND c.tenant_id = NEW.tenant_id
    ) THEN
      RAISE EXCEPTION 'Campaign does not belong to the same tenant';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to enforce tenant isolation for delivery logs
CREATE OR REPLACE FUNCTION marketa.enforce_delivery_log_tenant_isolation()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure pack belongs to same tenant
  IF NEW.pack_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM marketa.packs p 
      WHERE p.id = NEW.pack_id AND p.tenant_id = NEW.tenant_id
    ) THEN
      RAISE EXCEPTION 'Pack does not belong to the same tenant';
    END IF;
  END IF;
  
  -- Ensure pack item belongs to same tenant
  IF NEW.item_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM marketa.pack_items pi 
      JOIN marketa.packs p ON pi.pack_id = p.id
      WHERE pi.id = NEW.item_id AND p.tenant_id = NEW.tenant_id
    ) THEN
      RAISE EXCEPTION 'Pack item does not belong to the same tenant';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to enforce tenant isolation for reward actions
CREATE OR REPLACE FUNCTION marketa.enforce_reward_action_tenant_isolation()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure profile belongs to same tenant
  IF NEW.profile_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM marketa.audience_profiles ap 
      WHERE ap.id = NEW.profile_id AND ap.tenant_id = NEW.tenant_id
    ) THEN
      RAISE EXCEPTION 'Profile does not belong to the same tenant';
    END IF;
  END IF;
  
  -- Ensure campaign belongs to same tenant
  IF NEW.campaign_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM marketa.campaigns c 
      WHERE c.id = NEW.campaign_id AND c.tenant_id = NEW.tenant_id
    ) THEN
      RAISE EXCEPTION 'Campaign does not belong to the same tenant';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to enforce tenant isolation for CRM events
CREATE OR REPLACE FUNCTION marketa.enforce_crm_event_tenant_isolation()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure profile belongs to same tenant
  IF NEW.profile_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM marketa.audience_profiles ap 
      WHERE ap.id = NEW.profile_id AND ap.tenant_id = NEW.tenant_id
    ) THEN
      RAISE EXCEPTION 'Profile does not belong to the same tenant';
    END IF;
  END IF;
  
  -- Ensure campaign belongs to same tenant
  IF NEW.campaign_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM marketa.campaigns c 
      WHERE c.id = NEW.campaign_id AND c.tenant_id = NEW.tenant_id
    ) THEN
      RAISE EXCEPTION 'Campaign does not belong to the same tenant';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to enforce tenant isolation for publish jobs
CREATE OR REPLACE FUNCTION marketa.enforce_publish_job_tenant_isolation()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure pack belongs to same tenant
  IF NOT EXISTS (
    SELECT 1 FROM marketa.packs p 
    WHERE p.id = NEW.pack_id AND p.tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'Pack does not belong to the same tenant';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to enforce tenant isolation for partner access
CREATE OR REPLACE FUNCTION marketa.enforce_partner_access_tenant_isolation()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure partner belongs to same tenant
  IF NOT EXISTS (
    SELECT 1 FROM marketa.partners p 
    WHERE p.id = NEW.partner_id AND p.tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'Partner does not belong to the same tenant';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for tables with updated_at
CREATE TRIGGER update_partners_updated_at 
  BEFORE UPDATE ON marketa.partners 
  FOR EACH ROW EXECUTE FUNCTION marketa.update_updated_at_column();

CREATE TRIGGER update_campaigns_updated_at 
  BEFORE UPDATE ON marketa.campaigns 
  FOR EACH ROW EXECUTE FUNCTION marketa.update_updated_at_column();

CREATE TRIGGER update_packs_updated_at 
  BEFORE UPDATE ON marketa.packs 
  FOR EACH ROW EXECUTE FUNCTION marketa.update_updated_at_column();

CREATE TRIGGER update_audience_profiles_updated_at 
  BEFORE UPDATE ON marketa.audience_profiles 
  FOR EACH ROW EXECUTE FUNCTION marketa.update_updated_at_column();

-- Triggers for tenant isolation enforcement
CREATE TRIGGER enforce_pack_tenant_isolation 
  BEFORE INSERT OR UPDATE ON marketa.packs 
  FOR EACH ROW EXECUTE FUNCTION marketa.enforce_pack_tenant_isolation();

CREATE TRIGGER enforce_delivery_log_tenant_isolation 
  BEFORE INSERT OR UPDATE ON marketa.delivery_logs 
  FOR EACH ROW EXECUTE FUNCTION marketa.enforce_delivery_log_tenant_isolation();

CREATE TRIGGER enforce_reward_action_tenant_isolation 
  BEFORE INSERT OR UPDATE ON marketa.reward_actions 
  FOR EACH ROW EXECUTE FUNCTION marketa.enforce_reward_action_tenant_isolation();

CREATE TRIGGER enforce_crm_event_tenant_isolation 
  BEFORE INSERT OR UPDATE ON marketa.crm_events 
  FOR EACH ROW EXECUTE FUNCTION marketa.enforce_crm_event_tenant_isolation();

CREATE TRIGGER enforce_publish_job_tenant_isolation 
  BEFORE INSERT OR UPDATE ON marketa.publish_jobs 
  FOR EACH ROW EXECUTE FUNCTION marketa.enforce_publish_job_tenant_isolation();

CREATE TRIGGER enforce_partner_access_tenant_isolation 
  BEFORE INSERT OR UPDATE ON marketa.partner_access 
  FOR EACH ROW EXECUTE FUNCTION marketa.enforce_partner_access_tenant_isolation();
