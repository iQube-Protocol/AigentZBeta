-- =============================================================================
-- Marketa Database Setup Script
-- Run this script to create all necessary Marketa tables
-- =============================================================================

-- Create marketa schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS marketa;

-- =============================================================================
-- Campaigns Table (AGQ Source of Truth)
-- =============================================================================
CREATE TABLE IF NOT EXISTS marketa.marketa_campaigns (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  campaign_type TEXT NOT NULL DEFAULT 'wpp', -- wpp, custom, sequence
  phase TEXT DEFAULT 'codex1',
  status TEXT NOT NULL DEFAULT 'draft', -- draft, active, paused, completed
  budget DECIMAL(12,2) DEFAULT 0,
  start_date DATE,
  end_date DATE,
  primary_cta TEXT,
  secondary_cta TEXT,
  helix_thread TEXT DEFAULT 'bridge', -- bridge, codex, wpp
  sequence_length INTEGER DEFAULT 0,
  themes TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_persona_id TEXT,
  participating_tenants_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'
);

-- =============================================================================
-- Sequence Items Table (for sequence campaigns)
-- =============================================================================
CREATE TABLE IF NOT EXISTS marketa.marketa_sequence_items (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT NOT NULL REFERENCES marketa.marketa_campaigns(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  asset_ref TEXT NOT NULL,
  cta_url TEXT,
  explainer BOOLEAN DEFAULT false,
  tags TEXT[],
  status TEXT DEFAULT 'draft',
  copy_variants JSONB DEFAULT '{}',
  thumbnail_url TEXT,
  duration_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, day_number)
);

-- =============================================================================
-- Multi-Tenant Campaigns Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS marketa.marketa_multi_tenant_campaigns (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT NOT NULL REFERENCES marketa.marketa_campaigns(id) ON DELETE CASCADE,
  participating_tenants TEXT[] DEFAULT '{}',
  deployment_status TEXT DEFAULT 'draft', -- draft, deployed, archived
  tenant_count INTEGER DEFAULT 0,
  deployment_config JSONB DEFAULT '{}',
  deployed_by_persona_id TEXT,
  deployed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- Tenant Campaign Config Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS marketa.marketa_tenant_campaign_configs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT NOT NULL REFERENCES marketa.marketa_campaigns(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  status TEXT DEFAULT 'joined', -- joined, active, paused, left
  current_day INTEGER DEFAULT 1,
  start_date DATE,
  time_of_day TEXT DEFAULT '09:00',
  channels TEXT[] DEFAULT '{linkedin, x}',
  publishing_mode TEXT DEFAULT 'manual', -- make, manual, community
  config JSONB DEFAULT '{}',
  joined_by_persona_id TEXT,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, tenant_id)
);

-- =============================================================================
-- Partner Rewards Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS marketa.marketa_partner_rewards (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT NOT NULL REFERENCES marketa.marketa_campaigns(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  reward_type TEXT NOT NULL, -- knyt_coin, revenue_share, exclusive_content
  reward_value TEXT NOT NULL,
  conditions JSONB DEFAULT '{}',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, tenant_id, reward_type)
);

-- =============================================================================
-- Delivery Logs Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS marketa.marketa_delivery_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT NOT NULL REFERENCES marketa.marketa_campaigns(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  sequence_item_id TEXT REFERENCES marketa.marketa_sequence_items(id) ON DELETE CASCADE,
  platform TEXT NOT NULL, -- linkedin, x, facebook, instagram
  content_type TEXT NOT NULL, -- video, image, text
  status TEXT NOT NULL, -- scheduled, posted, failed
  scheduled_at TIMESTAMPTZ,
  posted_at TIMESTAMPTZ,
  metrics JSONB DEFAULT '{}', -- likes, shares, comments, views
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- Indexes for Performance
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_campaigns_tenant ON marketa.marketa_campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON marketa.marketa_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_phase ON marketa.marketa_campaigns(phase);
CREATE INDEX IF NOT EXISTS idx_campaigns_type ON marketa.marketa_campaigns(campaign_type);
CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON marketa.marketa_campaigns(created_at);
CREATE INDEX IF NOT EXISTS idx_campaigns_created_by ON marketa.marketa_campaigns(created_by_persona_id);

CREATE INDEX IF NOT EXISTS idx_sequence_campaign ON marketa.marketa_sequence_items(campaign_id);
CREATE INDEX IF NOT EXISTS idx_sequence_day ON marketa.marketa_sequence_items(day_number);

CREATE INDEX IF NOT EXISTS idx_delivery_campaign ON marketa.marketa_delivery_logs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_delivery_tenant ON marketa.marketa_delivery_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_delivery_status ON marketa.marketa_delivery_logs(status);

-- =============================================================================
-- RLS Policies (Enable for security)
-- =============================================================================
ALTER TABLE marketa.marketa_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketa.marketa_sequence_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketa.marketa_multi_tenant_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketa.marketa_tenant_campaign_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketa.marketa_partner_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketa.marketa_delivery_logs ENABLE ROW LEVEL SECURITY;

-- Basic policies - allow all access for development
CREATE POLICY "Enable all access for development" ON marketa.marketa_campaigns FOR ALL USING (true);
CREATE POLICY "Enable all access for development" ON marketa.marketa_sequence_items FOR ALL USING (true);
CREATE POLICY "Enable all access for development" ON marketa.marketa_multi_tenant_campaigns FOR ALL USING (true);
CREATE POLICY "Enable all access for development" ON marketa.marketa_tenant_campaign_configs FOR ALL USING (true);
CREATE POLICY "Enable all access for development" ON marketa.marketa_partner_rewards FOR ALL USING (true);
CREATE POLICY "Enable all access for development" ON marketa.marketa_delivery_logs FOR ALL USING (true);

-- =============================================================================
-- Triggers for updated_at
-- =============================================================================
CREATE OR REPLACE FUNCTION marketa.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop triggers if they exist (more robust approach)
DO $$
BEGIN
    -- Drop campaign triggers
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_campaign_updated_at') THEN
        DROP TRIGGER update_campaign_updated_at ON marketa.marketa_campaigns;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_sequence_updated_at') THEN
        DROP TRIGGER update_sequence_updated_at ON marketa.marketa_sequence_items;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_mtc_updated_at') THEN
        DROP TRIGGER update_mtc_updated_at ON marketa.marketa_multi_tenant_campaigns;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_config_updated_at') THEN
        DROP TRIGGER update_config_updated_at ON marketa.marketa_tenant_campaign_configs;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_rewards_updated_at') THEN
        DROP TRIGGER update_rewards_updated_at ON marketa.marketa_partner_rewards;
    END IF;
END $$;

-- Create triggers
CREATE TRIGGER update_campaign_updated_at
    BEFORE UPDATE ON marketa.marketa_campaigns
    FOR EACH ROW
    EXECUTE FUNCTION marketa.handle_updated_at();

CREATE TRIGGER update_sequence_updated_at
    BEFORE UPDATE ON marketa.marketa_sequence_items
    FOR EACH ROW
    EXECUTE FUNCTION marketa.handle_updated_at();

CREATE TRIGGER update_mtc_updated_at
    BEFORE UPDATE ON marketa.marketa_multi_tenant_campaigns
    FOR EACH ROW
    EXECUTE FUNCTION marketa.handle_updated_at();

CREATE TRIGGER update_config_updated_at
    BEFORE UPDATE ON marketa.marketa_tenant_campaign_configs
    FOR EACH ROW
    EXECUTE FUNCTION marketa.handle_updated_at();

CREATE TRIGGER update_rewards_updated_at
    BEFORE UPDATE ON marketa.marketa_partner_rewards
    FOR EACH ROW
    EXECUTE FUNCTION marketa.handle_updated_at();

-- =============================================================================
-- Insert Sample Data for Testing
-- =============================================================================
INSERT INTO marketa.marketa_campaigns (
  id, 
  tenant_id, 
  name, 
  description, 
  campaign_type,
  status,
  created_by_persona_id,
  participating_tenants_count
) VALUES (
  'test-campaign-1',
  'agq-tenant',
  'Test Campaign',
  'A test campaign for development',
  'custom',
  'draft',
  'test-persona-admin',
  0
) ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- Setup Complete Message
-- =============================================================================
DO $$
BEGIN
    RAISE NOTICE '🎉 Marketa database setup complete!';
    RAISE NOTICE '✅ Tables created: marketa_campaigns, marketa_sequence_items, and related tables';
    RAISE NOTICE '✅ Indexes created for performance';
    RAISE NOTICE '✅ RLS policies enabled';
    RAISE NOTICE '✅ Triggers created for updated_at timestamps';
    RAISE NOTICE '🚀 You can now seed the 21 Awakenings campaign!';
END $$;
