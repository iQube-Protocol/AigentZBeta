-- AgentiQ Marketa Partner Platform Enhancement
-- Adds support for custom campaigns, sequence campaigns, partner rewards, and tenant management
-- Preserves existing QubeTalk functionality and adds multi-tenant isolation

-- =============================================================================
-- 1. EXTEND EXISTING CAMPAIGNS TABLE
-- =============================================================================

-- Add new columns to marketa_campaigns for custom and sequence campaigns
ALTER TABLE marketa.marketa_campaigns 
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS campaign_type TEXT DEFAULT 'wpp' CHECK (campaign_type IN ('wpp', 'custom', 'sequence')),
ADD COLUMN IF NOT EXISTS helix_thread TEXT CHECK (helix_thread IN ('mythos', 'logos', 'bridge', 'overlap')),
ADD COLUMN IF NOT EXISTS secondary_cta TEXT,
ADD COLUMN IF NOT EXISTS sequence_length INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS sequence_config JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS asset_refs JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS qrp_smart_action_refs JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS created_by_persona_id UUID REFERENCES public.crm_personas(id),
ADD COLUMN IF NOT EXISTS approved_by_persona_id UUID REFERENCES public.crm_personas(id),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- Add indexes for new campaign fields
CREATE INDEX IF NOT EXISTS idx_campaigns_type ON marketa.marketa_campaigns(campaign_type);
CREATE INDEX IF NOT EXISTS idx_campaigns_helix ON marketa.marketa_campaigns(helix_thread);
CREATE INDEX IF NOT EXISTS idx_campaigns_created_by ON marketa.marketa_campaigns(created_by_persona_id);

-- =============================================================================
-- 2. SEQUENCE CAMPAIGN ITEMS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS marketa.marketa_sequence_items (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  campaign_id TEXT NOT NULL REFERENCES marketa.marketa_campaigns(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  asset_ref TEXT NOT NULL, -- Reference to existing QubeBase content item / Qriptopian clip
  copy_variants JSONB DEFAULT '{}', -- Platform-specific copy variations
  cta_url TEXT, -- Should include UTMs, points to Qriptopian smart action
  explainer BOOLEAN DEFAULT FALSE,
  thumbnail_url TEXT,
  duration_seconds INTEGER,
  tags TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'published', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Unique constraint for sequence items
  UNIQUE(campaign_id, day_number)
);

-- Indexes for sequence items
CREATE INDEX IF NOT EXISTS idx_sequence_items_campaign ON marketa.marketa_sequence_items(campaign_id);
CREATE INDEX IF NOT EXISTS idx_sequence_items_day ON marketa.marketa_sequence_items(campaign_id, day_number);
CREATE INDEX IF NOT EXISTS idx_sequence_items_asset_ref ON marketa.marketa_sequence_items(asset_ref);
CREATE INDEX IF NOT EXISTS idx_sequence_items_status ON marketa.marketa_sequence_items(status);

-- =============================================================================
-- 3. TENANT CAMPAIGN CONFIGURATION TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS marketa.marketa_tenant_campaign_config (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  campaign_id TEXT NOT NULL REFERENCES marketa.marketa_campaigns(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  
  -- Configuration
  start_date DATE NOT NULL,
  time_of_day TEXT NOT NULL DEFAULT '09:00', -- HH:MM format
  channels JSONB DEFAULT '[]', -- ['linkedin','x','discord','newsletter',...]
  publishing_mode TEXT NOT NULL DEFAULT 'manual' CHECK (publishing_mode IN ('make', 'manual', 'community')),
  make_webhook_url TEXT,
  make_webhook_secret TEXT, -- For HMAC signature verification
  brand_constraints JSONB DEFAULT '{}',
  
  -- Status and tracking
  status TEXT NOT NULL DEFAULT 'joined' CHECK (status IN ('joined', 'active', 'paused', 'completed', 'cancelled')),
  current_day INTEGER DEFAULT 0,
  last_dispatch_at TIMESTAMPTZ,
  next_dispatch_at TIMESTAMPTZ,
  
  -- Metadata
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  joined_by_persona_id UUID REFERENCES public.crm_personas(id),
  paused_at TIMESTAMPTZ,
  paused_by_persona_id UUID REFERENCES public.crm_personas(id),
  completed_at TIMESTAMPTZ,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  
  -- Constraints
  UNIQUE(campaign_id, tenant_id),
  CHECK (current_day >= 0),
  CHECK (time_of_day ~ '^\d{2}:\d{2}$')
);

-- Indexes for tenant campaign config
CREATE INDEX IF NOT EXISTS idx_tenant_config_campaign ON marketa.marketa_tenant_campaign_config(campaign_id);
CREATE INDEX IF NOT EXISTS idx_tenant_config_tenant ON marketa.marketa_tenant_campaign_config(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_config_status ON marketa.marketa_tenant_campaign_config(status);
CREATE INDEX IF NOT EXISTS idx_tenant_config_next_dispatch ON marketa.marketa_tenant_campaign_config(next_dispatch_at);
CREATE INDEX IF NOT EXISTS idx_tenant_config_publishing_mode ON marketa.marketa_tenant_campaign_config(publishing_mode);

-- =============================================================================
-- 4. PARTNER REWARDS TABLE (PHASE 1)
-- =============================================================================

CREATE TABLE IF NOT EXISTS marketa.marketa_partner_rewards (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  campaign_id TEXT NOT NULL REFERENCES marketa.marketa_campaigns(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  
  -- Reward details
  reward_type TEXT NOT NULL CHECK (reward_type IN ('coupon', 'claim_link', 'access', 'discount')),
  reward_value TEXT NOT NULL,
  reward_terms TEXT,
  reward_claim_url TEXT,
  reward_code TEXT UNIQUE,
  
  -- Configuration
  active BOOLEAN DEFAULT TRUE,
  max_uses INTEGER,
  current_uses INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ,
  
  -- Metadata
  created_by_persona_id UUID REFERENCES public.crm_personas(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}',
  
  -- Constraints
  CHECK (current_uses >= 0),
  CHECK (max_uses IS NULL OR current_uses <= max_uses),
  UNIQUE(campaign_id, tenant_id, reward_code)
);

-- Indexes for partner rewards
CREATE INDEX IF NOT EXISTS idx_partner_rewards_campaign ON marketa.marketa_partner_rewards(campaign_id);
CREATE INDEX IF NOT EXISTS idx_partner_rewards_tenant ON marketa.marketa_partner_rewards(tenant_id);
CREATE INDEX IF NOT EXISTS idx_partner_rewards_active ON marketa.marketa_partner_rewards(active);
CREATE INDEX IF NOT EXISTS idx_partner_rewards_code ON marketa.marketa_partner_rewards(reward_code);

-- =============================================================================
-- 5. PACK MANAGEMENT TABLES (EXTEND WPP FUNCTIONALITY)
-- =============================================================================

-- Pack workflow tracking for partner approval process
CREATE TABLE IF NOT EXISTS marketa.marketa_pack_workflows (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  pack_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  
  -- Workflow state
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'review', 'approved', 'rejected', 'published', 'archived')),
  current_stage TEXT NOT NULL DEFAULT 'creation' CHECK (current_stage IN ('creation', 'review', 'approval', 'publishing', 'live')),
  
  -- People involved
  created_by_persona_id UUID REFERENCES public.crm_personas(id),
  reviewed_by_persona_id UUID REFERENCES public.crm_personas(id),
  approved_by_persona_id UUID REFERENCES public.crm_personas(id),
  
  -- Content and feedback
  pack_content JSONB DEFAULT '{}',
  review_feedback JSONB DEFAULT '[]',
  edit_requests JSONB DEFAULT '[]',
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Constraints
  UNIQUE(pack_id, tenant_id)
);

-- Indexes for pack workflows
CREATE INDEX IF NOT EXISTS idx_pack_workflows_pack ON marketa.marketa_pack_workflows(pack_id);
CREATE INDEX IF NOT EXISTS idx_pack_workflows_tenant ON marketa.marketa_pack_workflows(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pack_workflows_status ON marketa.marketa_pack_workflows(status);
CREATE INDEX IF NOT EXISTS idx_pack_workflows_stage ON marketa.marketa_pack_workflows(current_stage);

-- =============================================================================
-- 6. EXTEND DELIVERY LOGS FOR NEW CAMPAIGN TYPES
-- =============================================================================

-- Add new columns to delivery logs for enhanced tracking
ALTER TABLE marketa.marketa_delivery_logs 
ADD COLUMN IF NOT EXISTS campaign_type TEXT,
ADD COLUMN IF NOT EXISTS sequence_day INTEGER,
ADD COLUMN IF NOT EXISTS publishing_mode TEXT,
ADD COLUMN IF NOT EXISTS webhook_payload JSONB,
ADD COLUMN IF NOT EXISTS webhook_response JSONB,
ADD COLUMN IF NOT EXISTS webhook_status TEXT,
ADD COLUMN IF NOT EXISTS webhook_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS make_webhook_url TEXT,
ADD COLUMN IF NOT EXISTS correlation_id TEXT;

-- Add indexes for new delivery log fields
CREATE INDEX IF NOT EXISTS idx_delivery_logs_campaign_type ON marketa.marketa_delivery_logs(campaign_type);
CREATE INDEX IF NOT EXISTS idx_delivery_logs_sequence_day ON marketa.marketa_delivery_logs(sequence_day);
CREATE INDEX IF NOT EXISTS idx_delivery_logs_publishing_mode ON marketa.marketa_delivery_logs(publishing_mode);
CREATE INDEX IF NOT EXISTS idx_delivery_logs_webhook_status ON marketa.marketa_delivery_logs(webhook_status);
CREATE INDEX IF NOT EXISTS idx_delivery_logs_correlation_id ON marketa.marketa_delivery_logs(correlation_id);

-- =============================================================================
-- 7. WEBHOOK TESTING AND VALIDATION
-- =============================================================================

-- Webhook test results for partner onboarding
CREATE TABLE IF NOT EXISTS marketa.marketa_webhook_tests (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id TEXT NOT NULL,
  webhook_url TEXT NOT NULL,
  webhook_secret TEXT,
  
  -- Test results
  test_status TEXT NOT NULL CHECK (test_status IN ('pending', 'success', 'failed', 'timeout')),
  response_code INTEGER,
  response_body TEXT,
  response_time_ms INTEGER,
  error_message TEXT,
  
  -- Test payload and signature
  test_payload JSONB NOT NULL,
  signature_header TEXT,
  
  -- Metadata
  tested_by_persona_id UUID REFERENCES public.crm_personas(id),
  tested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'
);

-- Indexes for webhook tests
CREATE INDEX IF NOT EXISTS idx_webhook_tests_tenant ON marketa.marketa_webhook_tests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_webhook_tests_status ON marketa.marketa_webhook_tests(test_status);
CREATE INDEX IF NOT EXISTS idx_webhook_tests_tested_at ON marketa.marketa_webhook_tests(tested_at);

-- =============================================================================
-- 8. UPDATE CAMPAIGN METADATA SCHEMA
-- =============================================================================

-- Add comment to document the expected structure of metadata JSONB
COMMENT ON COLUMN marketa.marketa_campaigns.metadata IS 'JSONB containing: partner_rewards (phase 1), sequence_config, asset_refs, qrp_smart_action_refs, custom_properties, approval_workflow, etc.';

-- =============================================================================
-- 9. TRIGGERS FOR UPDATED_AT
-- =============================================================================

-- Create trigger function for sequence items
CREATE OR REPLACE FUNCTION marketa.update_sequence_item_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function for partner rewards
CREATE OR REPLACE FUNCTION marketa.update_partner_reward_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS update_sequence_item_updated_at ON marketa.marketa_sequence_items;
CREATE TRIGGER update_sequence_item_updated_at 
  BEFORE UPDATE ON marketa.marketa_sequence_items 
  FOR EACH ROW EXECUTE FUNCTION marketa.update_sequence_item_updated_at();

DROP TRIGGER IF EXISTS update_partner_reward_updated_at ON marketa.marketa_partner_rewards;
CREATE TRIGGER update_partner_reward_updated_at 
  BEFORE UPDATE ON marketa.marketa_partner_rewards 
  FOR EACH ROW EXECUTE FUNCTION marketa.update_partner_reward_updated_at();

-- =============================================================================
-- 10. ROW LEVEL SECURITY (RLS) UPDATES
-- =============================================================================

-- Enable RLS on new tables
ALTER TABLE marketa.marketa_sequence_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketa.marketa_tenant_campaign_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketa.marketa_partner_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketa.marketa_pack_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketa.marketa_webhook_tests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sequence items (tenant-scoped via campaign)
DROP POLICY IF EXISTS "Enable sequence item access for tenant users" ON marketa.marketa_sequence_items;
CREATE POLICY "Enable sequence item access for tenant users" ON marketa.marketa_sequence_items
  FOR SELECT USING (
    campaign_id IN (
      SELECT id FROM marketa.marketa_campaigns 
      WHERE tenant_id = current_setting('app.current_tenant_id', true)
    )
  );

-- RLS Policies for tenant campaign config
DROP POLICY IF EXISTS "Enable tenant config access for tenant users" ON marketa.marketa_tenant_campaign_config;
CREATE POLICY "Enable tenant config access for tenant users" ON marketa.marketa_tenant_campaign_config
  FOR ALL USING (
    tenant_id = current_setting('app.current_tenant_id', true)
  );

-- RLS Policies for partner rewards
DROP POLICY IF EXISTS "Enable partner rewards access for tenant users" ON marketa.marketa_partner_rewards;
CREATE POLICY "Enable partner rewards access for tenant users" ON marketa.marketa_partner_rewards
  FOR ALL USING (
    tenant_id = current_setting('app.current_tenant_id', true)
  );

-- RLS Policies for pack workflows
DROP POLICY IF EXISTS "Enable pack workflow access for tenant users" ON marketa.marketa_pack_workflows;
CREATE POLICY "Enable pack workflow access for tenant users" ON marketa.marketa_pack_workflows
  FOR ALL USING (
    tenant_id = current_setting('app.current_tenant_id', true)
  );

-- RLS Policies for webhook tests
DROP POLICY IF EXISTS "Enable webhook test access for tenant users" ON marketa.marketa_webhook_tests;
CREATE POLICY "Enable webhook test access for tenant users" ON marketa.marketa_webhook_tests
  FOR ALL USING (
    tenant_id = current_setting('app.current_tenant_id', true)
  );

-- =============================================================================
-- 11. FUNCTIONS FOR SEQUENCE CAMPAIGN MANAGEMENT
-- =============================================================================

-- Function to get next sequence item for a tenant
CREATE OR REPLACE FUNCTION marketa.get_next_sequence_item(
  p_tenant_id TEXT,
  p_campaign_id TEXT
)
RETURNS TABLE (
  sequence_item_id TEXT,
  day_number INTEGER,
  title TEXT,
  asset_ref TEXT,
  cta_url TEXT,
  copy_variants JSONB,
  explainer BOOLEAN
) AS $$
DECLARE
  v_config RECORD;
  v_current_day INTEGER;
BEGIN
  -- Get tenant config and current day
  SELECT * INTO v_config 
  FROM marketa.marketa_tenant_campaign_config 
  WHERE tenant_id = p_tenant_id AND campaign_id = p_campaign_id AND status = 'active';
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Get next sequence item
  v_current_day := v_config.current_day + 1;
  
  RETURN QUERY
  SELECT 
    si.id,
    si.day_number,
    si.title,
    si.asset_ref,
    si.cta_url,
    si.copy_variants,
    si.explainer
  FROM marketa.marketa_sequence_items si
  WHERE si.campaign_id = p_campaign_id 
    AND si.day_number = v_current_day
    AND si.status = 'ready';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update tenant campaign progress
CREATE OR REPLACE FUNCTION marketa.update_tenant_campaign_progress(
  p_tenant_id TEXT,
  p_campaign_id TEXT,
  p_day_number INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
  v_updated BOOLEAN := FALSE;
BEGIN
  UPDATE marketa.marketa_tenant_campaign_config 
  SET 
    current_day = p_day_number,
    last_dispatch_at = now(),
    next_dispatch_at = start_date + (p_day_number * INTERVAL '1 day') + (time_of_day::TIME)
  WHERE tenant_id = p_tenant_id 
    AND campaign_id = p_campaign_id 
    AND current_day < p_day_number;
  
  v_updated := FOUND;
  RETURN v_updated;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 12. 21 AWAKENINGS SEED DATA (OPTIONAL)
-- =============================================================================

-- Insert 21 Awakenings sequence campaign as seed data (can be removed for production)
DO $$
DECLARE
  v_campaign_id TEXT;
BEGIN
  -- Create the 21 Awakenings campaign
  INSERT INTO marketa.marketa_campaigns (
    id,
    tenant_id,
    name,
    description,
    campaign_type,
    helix_thread,
    sequence_length,
    status,
    primary_cta,
    secondary_cta,
    sequence_config,
    metadata
  ) VALUES (
    '21-awakenings-campaign',
    'agq-tenant',
    '21 Awakenings',
    'A 21-day journey of daily video drops designed to awaken consciousness and inspire transformation.',
    'sequence',
    'mythos',
    21,
    'draft',
    'Begin Your Awakening',
    'Share Your Journey',
    '{"theme": "consciousness", "difficulty": "beginner", "duration_days": 21}',
    '{"creator": "metaProof", "category": "spiritual_growth", "tags": ["meditation", "awakening", "consciousness"]}'
  ) RETURNING id INTO v_campaign_id;
  
  -- Insert sequence items (first 14 from metaKnyts scrolls, remaining as placeholders)
  INSERT INTO marketa.marketa_sequence_items (campaign_id, day_number, title, asset_ref, explainer, status) VALUES
    -- Week 1: Foundation (Days 1-7)
    (v_campaign_id, 1, 'Day 1: The Awakening', 'metaknyts_scroll_1_1', true, 'ready'),
    (v_campaign_id, 2, 'Day 2: Inner Stillness', 'metaknyts_scroll_1_2', false, 'ready'),
    (v_campaign_id, 3, 'Day 3: Mindful Awareness', 'metaknyts_scroll_1_3', false, 'ready'),
    (v_campaign_id, 4, 'Day 4: Heart Opening', 'metaknyts_scroll_1_4', false, 'ready'),
    (v_campaign_id, 5, 'Day 5: Presence Practice', 'metaknyts_scroll_1_5', false, 'ready'),
    (v_campaign_id, 6, 'Day 6: Compassion Rising', 'metaknyts_scroll_1_6', false, 'ready'),
    (v_campaign_id, 7, 'Day 7: Integration', 'metaknyts_scroll_1_7', false, 'ready'),
    
    -- Week 2: Deepening (Days 8-14)
    (v_campaign_id, 8, 'Day 8: Sacred Space', 'metaknyts_scroll_2_1', false, 'ready'),
    (v_campaign_id, 9, 'Day 9: Breath of Life', 'metaknyts_scroll_2_2', false, 'ready'),
    (v_campaign_id, 10, 'Day 10: Body Wisdom', 'metaknyts_scroll_2_3', false, 'ready'),
    (v_campaign_id, 11, 'Day 11: Emotional Freedom', 'metaknyts_scroll_2_4', false, 'ready'),
    (v_campaign_id, 12, 'Day 12: Creative Flow', 'metaknyts_scroll_2_5', false, 'ready'),
    (v_campaign_id, 13, 'Day 13: Inner Guidance', 'metaknyts_scroll_2_6', false, 'ready'),
    (v_campaign_id, 14, 'Day 14: Soul Connection', 'metaknyts_scroll_2_7', false, 'ready'),
    
    -- Week 3: Transformation (Days 15-21) - Placeholders for now
    (v_campaign_id, 15, 'Day 15: Quantum Leap', 'awakenings_day_15', false, 'draft'),
    (v_campaign_id, 16, 'Day 16: Infinite Possibilities', 'awakenings_day_16', false, 'draft'),
    (v_campaign_id, 17, 'Day 17: Divine Timing', 'awakenings_day_17', false, 'draft'),
    (v_campaign_id, 18, 'Day 18: Unity Consciousness', 'awakenings_day_18', false, 'draft'),
    (v_campaign_id, 19, 'Day 19: Miraculous Living', 'awakenings_day_19', false, 'draft'),
    (v_campaign_id, 20, 'Day 20: Service to Others', 'awakenings_day_20', false, 'draft'),
    (v_campaign_id, 21, 'Day 21: Full Awakening', 'awakenings_day_21', false, 'draft');
    
END $$;

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================

-- Add migration completion marker
INSERT INTO marketa.marketa_lvb_sync_tracking (
  tenant_id, 
  sync_type, 
  source_id, 
  sync_direction, 
  sync_status, 
  data_payload, 
  metadata
) VALUES (
  'system',
  'migration',
  '20250117_marketa_partner_platform',
  'system_to_system',
  'success',
  '{"migration": "partner_platform_enhancement", "version": "1.0.0", "features": ["custom_campaigns", "sequence_campaigns", "partner_rewards", "pack_workflows"]}',
  '{"migration_date": "2025-01-17", "description": "Partner platform enhancement with custom campaigns, sequence campaigns, and rewards"}'
);
