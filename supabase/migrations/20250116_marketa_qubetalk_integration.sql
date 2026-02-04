-- Marketa QubeTalk Messages Table
-- Stores communication between Marketa and other agents via QubeTalk

CREATE TABLE IF NOT EXISTS marketa.marketa_qubetalk_messages (
  message_id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  
  -- Agent information
  from_agent_id TEXT NOT NULL,
  to_agent_id TEXT,
  
  -- Message content
  message_type TEXT NOT NULL DEFAULT 'text', -- text, content_transfer, iqube_transfer
  content TEXT NOT NULL,
  priority TEXT DEFAULT 'normal', -- low, normal, high
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending', -- pending, sent, delivered, failed
  
  -- iQube references for advanced transfers
  iqube_ref TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_qubetalk_messages_channel ON marketa.marketa_qubetalk_messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_qubetalk_messages_tenant ON marketa.marketa_qubetalk_messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_qubetalk_messages_from_agent ON marketa.marketa_qubetalk_messages(from_agent_id);
CREATE INDEX IF NOT EXISTS idx_qubetalk_messages_to_agent ON marketa.marketa_qubetalk_messages(to_agent_id);
CREATE INDEX IF NOT EXISTS idx_qubetalk_messages_status ON marketa.marketa_qubetalk_messages(status);
CREATE INDEX IF NOT EXISTS idx_qubetalk_messages_created_at ON marketa.marketa_qubetalk_messages(created_at);

 -- RLS (Row Level Security) - Basic policies without CRM dependencies
 -- These will be updated later with proper tenant isolation
 ALTER TABLE marketa.marketa_qubetalk_messages ENABLE ROW LEVEL SECURITY;
 
 DROP POLICY IF EXISTS "Enable read access for all users" ON marketa.marketa_qubetalk_messages;
 CREATE POLICY "Enable read access for all users" ON marketa.marketa_qubetalk_messages
   FOR SELECT USING (true);
 
 DROP POLICY IF EXISTS "Enable insert for all users" ON marketa.marketa_qubetalk_messages;
 CREATE POLICY "Enable insert for all users" ON marketa.marketa_qubetalk_messages
   FOR INSERT WITH CHECK (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION marketa.update_qubetalk_message_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at on messages
DROP TRIGGER IF EXISTS update_qubetalk_message_updated_at ON marketa.marketa_qubetalk_messages;
CREATE TRIGGER update_qubetalk_message_updated_at 
  BEFORE UPDATE ON marketa.marketa_qubetalk_messages 
  FOR EACH ROW EXECUTE FUNCTION marketa.update_qubetalk_message_updated_at();

-- Content Transfer Tracking Table
CREATE TABLE IF NOT EXISTS marketa.marketa_content_transfers (
  transfer_id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  
  -- Transfer information
  from_agent_id TEXT NOT NULL,
  to_agent_id TEXT NOT NULL,
  content_type TEXT NOT NULL, -- campaign, partner, content, iqube
  
  -- Content data
  content_name TEXT NOT NULL,
  content_data JSONB NOT NULL,
  content_metadata JSONB DEFAULT '{}',
  
  -- Transfer status
  status TEXT NOT NULL DEFAULT 'pending', -- pending, sent, delivered, failed
  
  -- iQube references
  iqube_ref TEXT,
  iqube_status TEXT, -- packaged, sealed, delivered, verified
  
  -- Transfer tracking
  transfer_method TEXT DEFAULT 'raw_json', -- raw_json, iqube, encrypted
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ
);

-- Indexes for content transfers
CREATE INDEX IF NOT EXISTS idx_content_transfers_channel ON marketa.marketa_content_transfers(channel_id);
CREATE INDEX IF NOT EXISTS idx_content_transfers_tenant ON marketa.marketa_content_transfers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_content_transfers_from_agent ON marketa.marketa_content_transfers(from_agent_id);
CREATE INDEX IF NOT EXISTS idx_content_transfers_to_agent ON marketa.marketa_content_transfers(to_agent_id);
CREATE INDEX IF NOT EXISTS idx_content_transfers_status ON marketa.marketa_content_transfers(status);
CREATE INDEX IF NOT EXISTS idx_content_transfers_iqube_ref ON marketa.marketa_content_transfers(iqube_ref);

 -- RLS for content transfers - Basic policies without CRM dependencies
 ALTER TABLE marketa.marketa_content_transfers ENABLE ROW LEVEL SECURITY;
 
 DROP POLICY IF EXISTS "Enable read access for all users" ON marketa.marketa_content_transfers;
 CREATE POLICY "Enable read access for all users" ON marketa.marketa_content_transfers
   FOR SELECT USING (true);
 
 DROP POLICY IF EXISTS "Enable insert for all users" ON marketa.marketa_content_transfers;
 CREATE POLICY "Enable insert for all users" ON marketa.marketa_content_transfers
   FOR INSERT WITH CHECK (true);

-- Trigger for updated_at on content transfers
DROP TRIGGER IF EXISTS update_content_transfer_updated_at ON marketa.marketa_content_transfers;
CREATE TRIGGER update_content_transfer_updated_at 
  BEFORE UPDATE ON marketa.marketa_content_transfers 
  FOR EACH ROW EXECUTE FUNCTION marketa.update_qubetalk_message_updated_at();

-- QubeTalk Channels Table
CREATE TABLE IF NOT EXISTS marketa.marketa_qubetalk_channels (
  channel_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  
  -- Channel information
  channel_name TEXT,
  description TEXT,
  channel_type TEXT DEFAULT 'agent_to_agent', -- agent_to_agent, broadcast, group
  
  -- Participants
  participants TEXT[] NOT NULL,
  
  -- Channel configuration
  config JSONB DEFAULT '{}',
  allows_external BOOLEAN DEFAULT true,
  allows_content_transfer BOOLEAN DEFAULT true,
  allows_iqube_transfer BOOLEAN DEFAULT false,
  
  -- Status
  status TEXT DEFAULT 'active', -- active, inactive, archived
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for channels
CREATE INDEX IF NOT EXISTS idx_qubetalk_channels_tenant ON marketa.marketa_qubetalk_channels(tenant_id);
CREATE INDEX IF NOT EXISTS idx_qubetalk_channels_participants ON marketa.marketa_qubetalk_channels USING GIN(participants);
CREATE INDEX IF NOT EXISTS idx_qubetalk_channels_status ON marketa.marketa_qubetalk_channels(status);

 -- RLS for channels - Basic policies without CRM dependencies
 ALTER TABLE marketa.marketa_qubetalk_channels ENABLE ROW LEVEL SECURITY;
 
 DROP POLICY IF EXISTS "Enable read access for all users" ON marketa.marketa_qubetalk_channels;
 CREATE POLICY "Enable read access for all users" ON marketa.marketa_qubetalk_channels
   FOR SELECT USING (true);

-- Trigger for updated_at on channels
DROP TRIGGER IF EXISTS update_qubetalk_channel_updated_at ON marketa.marketa_qubetalk_channels;
CREATE TRIGGER update_qubetalk_channel_updated_at 
  BEFORE UPDATE ON marketa.marketa_qubetalk_channels 
  FOR EACH ROW EXECUTE FUNCTION marketa.update_qubetalk_message_updated_at();

-- =============================================================================
-- MULTI-TENANT CAMPAIGN SUPPORT FOR LVB-AGQ BRIDGE
-- =============================================================================

-- Campaigns Table (AGQ Source of Truth)
CREATE TABLE IF NOT EXISTS marketa.marketa_campaigns (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft', -- draft, active, paused, completed
  phase TEXT DEFAULT 'codex1',
  budget DECIMAL(12,2) DEFAULT 0,
  start_date DATE,
  end_date DATE,
  primary_cta TEXT,
  themes TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'
);

-- Campaign Metrics Table (Performance Data from LVB and AGQ)
CREATE TABLE IF NOT EXISTS marketa.marketa_campaign_metrics (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT NOT NULL REFERENCES marketa.marketa_campaigns(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  
  -- Performance Metrics
  sent INTEGER DEFAULT 0,
  delivered INTEGER DEFAULT 0,
  opened INTEGER DEFAULT 0,
  clicked INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  revenue DECIMAL(12,2) DEFAULT 0,
  cost DECIMAL(12,2) DEFAULT 0,
  
  -- Calculated Rates
  delivery_rate DECIMAL(5,4) GENERATED ALWAYS AS (
    CASE WHEN sent > 0 THEN delivered::DECIMAL / sent ELSE 0 END
  ) STORED,
  open_rate DECIMAL(5,4) GENERATED ALWAYS AS (
    CASE WHEN delivered > 0 THEN opened::DECIMAL / delivered ELSE 0 END
  ) STORED,
  click_rate DECIMAL(5,4) GENERATED ALWAYS AS (
    CASE WHEN opened > 0 THEN clicked::DECIMAL / opened ELSE 0 END
  ) STORED,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}',
  
  UNIQUE(campaign_id, tenant_id)
);

-- Multi-Tenant Campaigns Table (Campaign Deployment Across Partners)
CREATE TABLE IF NOT EXISTS marketa.marketa_multi_tenant_campaigns (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT NOT NULL REFERENCES marketa.marketa_campaigns(id) ON DELETE CASCADE,
  owner_tenant_id TEXT NOT NULL,
  is_multi_tenant BOOLEAN DEFAULT false,
  tenant_count INTEGER DEFAULT 1,
  participating_tenants TEXT[] DEFAULT '{}',
  deployment_status TEXT DEFAULT 'draft', -- draft, deploying, deployed, failed
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'
);

-- Campaign Delivery Logs (Detailed Delivery Tracking)
CREATE TABLE IF NOT EXISTS marketa.marketa_delivery_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT NOT NULL REFERENCES marketa.marketa_campaigns(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  payload_id TEXT,
  platform TEXT NOT NULL, -- email, social, web, etc.
  status TEXT NOT NULL DEFAULT 'pending',
  recipient_count INTEGER DEFAULT 0,
  post_url TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'
);

-- LVB Sync Tracking Table (Track Data Flow from LVB to AGQ)
CREATE TABLE IF NOT EXISTS marketa.marketa_lvb_sync_tracking (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  sync_type TEXT NOT NULL, -- campaign, performance, config
  source_id TEXT, -- campaign_id, metrics_id, etc.
  sync_direction TEXT NOT NULL, -- lvb_to_agq, agq_to_lvb
  sync_status TEXT NOT NULL DEFAULT 'pending', -- pending, success, failed
  data_payload JSONB,
  error_message TEXT,
  lvb_version TEXT,
  lvb_build TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'
);

-- Indexes for Campaigns
CREATE INDEX IF NOT EXISTS idx_campaigns_tenant ON marketa.marketa_campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON marketa.marketa_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_phase ON marketa.marketa_campaigns(phase);
CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON marketa.marketa_campaigns(created_at);

-- Indexes for Campaign Metrics
CREATE INDEX IF NOT EXISTS idx_campaign_metrics_campaign ON marketa.marketa_campaign_metrics(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_metrics_tenant ON marketa.marketa_campaign_metrics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_campaign_metrics_performance ON marketa.marketa_campaign_metrics(delivery_rate, open_rate, click_rate);

-- Indexes for Multi-Tenant Campaigns
CREATE INDEX IF NOT EXISTS idx_multi_tenant_campaigns_owner ON marketa.marketa_multi_tenant_campaigns(owner_tenant_id);
CREATE INDEX IF NOT EXISTS idx_multi_tenant_campaigns_participants ON marketa.marketa_multi_tenant_campaigns USING GIN(participating_tenants);
CREATE INDEX IF NOT EXISTS idx_multi_tenant_campaigns_status ON marketa.marketa_multi_tenant_campaigns(deployment_status);

-- Indexes for Delivery Logs
CREATE INDEX IF NOT EXISTS idx_delivery_logs_campaign ON marketa.marketa_delivery_logs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_delivery_logs_tenant ON marketa.marketa_delivery_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_delivery_logs_status ON marketa.marketa_delivery_logs(status);
CREATE INDEX IF NOT EXISTS idx_delivery_logs_platform ON marketa.marketa_delivery_logs(platform);

-- Indexes for LVB Sync Tracking
CREATE INDEX IF NOT EXISTS idx_lvb_sync_tenant ON marketa.marketa_lvb_sync_tracking(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lvb_sync_type ON marketa.marketa_lvb_sync_tracking(sync_type);
CREATE INDEX IF NOT EXISTS idx_lvb_sync_status ON marketa.marketa_lvb_sync_tracking(sync_status);
CREATE INDEX IF NOT EXISTS idx_lvb_sync_direction ON marketa.marketa_lvb_sync_tracking(sync_direction);

 -- RLS for Campaigns - Basic policies without CRM dependencies
 ALTER TABLE marketa.marketa_campaigns ENABLE ROW LEVEL SECURITY;
 
 DROP POLICY IF EXISTS "Enable read access for all users" ON marketa.marketa_campaigns;
 CREATE POLICY "Enable read access for all users" ON marketa.marketa_campaigns
   FOR SELECT USING (true);
 
 DROP POLICY IF EXISTS "Enable insert for all users" ON marketa.marketa_campaigns;
 CREATE POLICY "Enable insert for all users" ON marketa.marketa_campaigns
   FOR INSERT WITH CHECK (true);

 -- RLS for Campaign Metrics - Basic policies without CRM dependencies
 ALTER TABLE marketa.marketa_campaign_metrics ENABLE ROW LEVEL SECURITY;
 
 DROP POLICY IF EXISTS "Enable read access for all users" ON marketa.marketa_campaign_metrics;
 CREATE POLICY "Enable read access for all users" ON marketa.marketa_campaign_metrics
   FOR SELECT USING (true);

 -- RLS for Multi-Tenant Campaigns - Basic policies without CRM dependencies
 ALTER TABLE marketa.marketa_multi_tenant_campaigns ENABLE ROW LEVEL SECURITY;
 
 DROP POLICY IF EXISTS "Enable read access for all users" ON marketa.marketa_multi_tenant_campaigns;
 CREATE POLICY "Enable read access for all users" ON marketa.marketa_multi_tenant_campaigns
   FOR SELECT USING (true);

 -- RLS for Delivery Logs - Basic policies without CRM dependencies
 ALTER TABLE marketa.marketa_delivery_logs ENABLE ROW LEVEL SECURITY;
 
 DROP POLICY IF EXISTS "Enable read access for all users" ON marketa.marketa_delivery_logs;
 CREATE POLICY "Enable read access for all users" ON marketa.marketa_delivery_logs
   FOR SELECT USING (true);

-- RLS for LVB Sync Tracking
ALTER TABLE marketa.marketa_lvb_sync_tracking ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view sync logs from their tenant only" ON marketa.marketa_lvb_sync_tracking;
CREATE POLICY "Users can view sync logs from their tenant only" ON marketa.marketa_lvb_sync_tracking
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM public.crm_personas 
      WHERE id::text = current_setting('app.current_persona_id', true)
    )
  );

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_campaign_updated_at ON marketa.marketa_campaigns;
CREATE TRIGGER update_campaign_updated_at 
  BEFORE UPDATE ON marketa.marketa_campaigns 
  FOR EACH ROW EXECUTE FUNCTION marketa.update_qubetalk_message_updated_at();

DROP TRIGGER IF EXISTS update_campaign_metrics_updated_at ON marketa.marketa_campaign_metrics;
CREATE TRIGGER update_campaign_metrics_updated_at 
  BEFORE UPDATE ON marketa.marketa_campaign_metrics 
  FOR EACH ROW EXECUTE FUNCTION marketa.update_qubetalk_message_updated_at();

DROP TRIGGER IF EXISTS update_multi_tenant_campaign_updated_at ON marketa.marketa_multi_tenant_campaigns;
CREATE TRIGGER update_multi_tenant_campaign_updated_at 
  BEFORE UPDATE ON marketa.marketa_multi_tenant_campaigns 
  FOR EACH ROW EXECUTE FUNCTION marketa.update_qubetalk_message_updated_at();

DROP TRIGGER IF EXISTS update_delivery_log_updated_at ON marketa.marketa_delivery_logs;
CREATE TRIGGER update_delivery_log_updated_at 
  BEFORE UPDATE ON marketa.marketa_delivery_logs 
  FOR EACH ROW EXECUTE FUNCTION marketa.update_qubetalk_message_updated_at();

DROP TRIGGER IF EXISTS update_lvb_sync_tracking_updated_at ON marketa.marketa_lvb_sync_tracking;
CREATE TRIGGER update_lvb_sync_tracking_updated_at 
  BEFORE UPDATE ON marketa.marketa_lvb_sync_tracking 
  FOR EACH ROW EXECUTE FUNCTION marketa.update_qubetalk_message_updated_at();

-- =============================================================================
-- FUNCTIONS FOR MULTI-TENANT OPERATIONS
-- =============================================================================

-- Function to create multi-tenant campaign deployment
CREATE OR REPLACE FUNCTION marketa.create_multi_tenant_deployment(
  p_campaign_id TEXT,
  p_owner_tenant_id TEXT,
  p_participating_tenants TEXT[]
)
RETURNS TABLE(
  success BOOLEAN,
  deployment_id TEXT,
  message TEXT
) AS $$
DECLARE
  v_deployment_id TEXT;
  v_tenant_count INTEGER;
BEGIN
  -- Validate inputs
  IF p_campaign_id IS NULL OR p_owner_tenant_id IS NULL THEN
    RETURN QUERY SELECT false, NULL, 'Campaign ID and owner tenant ID are required';
    RETURN;
  END IF;
  
  v_tenant_count := COALESCE(array_length(p_participating_tenants, 1), 0);
  
  -- Create multi-tenant campaign record
  INSERT INTO marketa.marketa_multi_tenant_campaigns (
    campaign_id,
    owner_tenant_id,
    is_multi_tenant,
    tenant_count,
    participating_tenants,
    deployment_status
  ) VALUES (
    p_campaign_id,
    p_owner_tenant_id,
    true,
    v_tenant_count + 1, -- Include owner
    array_append(p_participating_tenants, p_owner_tenant_id),
    'deploying'
  ) RETURNING id INTO v_deployment_id;
  
  -- Create metrics records for each participating tenant
  INSERT INTO marketa.marketa_campaign_metrics (campaign_id, tenant_id)
  SELECT 
    p_campaign_id,
    tenant_id
  FROM unnest(array_append(p_participating_tenants, p_owner_tenant_id)) AS tenant_id;
  
  -- Update deployment status
  UPDATE marketa.marketa_multi_tenant_campaigns 
  SET deployment_status = 'deployed'
  WHERE id = v_deployment_id;
  
  RETURN QUERY SELECT 
    true, 
    v_deployment_id, 
    format('Multi-tenant deployment created for %s tenants', v_tenant_count + 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to aggregate performance across all tenants
CREATE OR REPLACE FUNCTION marketa.get_multi_tenant_performance(p_campaign_id TEXT)
RETURNS TABLE(
  total_sent INTEGER,
  total_delivered INTEGER,
  total_opened INTEGER,
  total_clicked INTEGER,
  total_conversions INTEGER,
  total_revenue DECIMAL(12,2),
  avg_delivery_rate DECIMAL(5,4),
  avg_open_rate DECIMAL(5,4),
  avg_click_rate DECIMAL(5,4),
  tenant_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(sent), 0) as total_sent,
    COALESCE(SUM(delivered), 0) as total_delivered,
    COALESCE(SUM(opened), 0) as total_opened,
    COALESCE(SUM(clicked), 0) as total_clicked,
    COALESCE(SUM(conversions), 0) as total_conversions,
    COALESCE(SUM(revenue), 0) as total_revenue,
    COALESCE(AVG(delivery_rate), 0) as avg_delivery_rate,
    COALESCE(AVG(open_rate), 0) as avg_open_rate,
    COALESCE(AVG(click_rate), 0) as avg_click_rate,
    COUNT(*) as tenant_count
  FROM marketa.marketa_campaign_metrics
  WHERE campaign_id = p_campaign_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to sync LVB data and track sync status
CREATE OR REPLACE FUNCTION marketa.track_lvb_sync(
  p_tenant_id TEXT,
  p_sync_type TEXT,
  p_source_id TEXT,
  p_direction TEXT,
  p_data_payload JSONB,
  p_lvb_version TEXT DEFAULT NULL,
  p_lvb_build TEXT DEFAULT NULL
)
RETURNS TEXT AS $$
DECLARE
  v_sync_id TEXT;
BEGIN
  INSERT INTO marketa.marketa_lvb_sync_tracking (
    tenant_id,
    sync_type,
    source_id,
    sync_direction,
    data_payload,
    lvb_version,
    lvb_build,
    sync_status
  ) VALUES (
    p_tenant_id,
    p_sync_type,
    p_source_id,
    p_direction,
    p_data_payload,
    p_lvb_version,
    p_lvb_build,
    'success'
  ) RETURNING id INTO v_sync_id;
  
  -- Update completion timestamp
  UPDATE marketa.marketa_lvb_sync_tracking 
  SET completed_at = now()
  WHERE id = v_sync_id;
  
  RETURN v_sync_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
