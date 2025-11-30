-- AgentiQ CRM: Phase 1 Schema Migration
-- Multi-tenant CRM for Qriptonian and Kn0w1 applications
-- Supports: Personas, Contributions, Engagement, Entitlements, Rewards, Segments
-- 
-- Run in Supabase SQL editor or via migration tool
-- Non-breaking, additive only

-- ============================================================================
-- 1. CRM PERSONAS
-- Represents a "persona view" of a user for a given tenant, linked to DIDQube
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.crm_personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  
  -- References to identity primitives (DIDQube integration)
  kybe_did TEXT,
  root_did_proxy_id TEXT,
  persona_state TEXT NOT NULL DEFAULT 'pseudonymous' 
    CHECK (persona_state IN ('anonymous', 'pseudonymous', 'identifiable')),
  
  -- Optional external/user references
  external_user_id TEXT,
  display_name TEXT,
  email TEXT,
  
  -- Optional: Link to existing persona table
  persona_dataqube_id UUID REFERENCES public.persona(id) ON DELETE SET NULL,
  
  -- Meta
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_personas_tenant ON public.crm_personas (tenant_id);
CREATE INDEX IF NOT EXISTS idx_crm_personas_kybe_did ON public.crm_personas (kybe_did);
CREATE INDEX IF NOT EXISTS idx_crm_personas_external_user ON public.crm_personas (external_user_id);

-- ============================================================================
-- 2. CRM CONTRIBUTIONS
-- Records units of "knowledge work" attributable to a persona
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.crm_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  persona_id UUID NOT NULL REFERENCES public.crm_personas(id) ON DELETE CASCADE,
  
  -- Qube / ClusterQube references (text for now; FK to registry later)
  qube_id TEXT,
  clusterqube_id TEXT,
  
  -- Contribution details
  contribution_type TEXT NOT NULL,
  -- Units: "word count", "minutes", or just 1 per event
  units NUMERIC(18,6) NOT NULL DEFAULT 1,
  base_pokw_weight NUMERIC(18,6) NOT NULL DEFAULT 1,
  pokw_score NUMERIC(18,6) NOT NULL DEFAULT 0,
  
  -- Placeholders for future PoR / PoS / PoP integration
  -- These will be populated by dedicated service agents in future phases
  por_score NUMERIC(18,6),  -- Proof of Reputation
  pos_score NUMERIC(18,6),  -- Proof of Stake
  pop_score NUMERIC(18,6),  -- Proof of Participation
  
  -- Metadata
  source TEXT,  -- e.g., 'qriptonian-frontend', 'kn0w1-frontend', 'api'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_contributions_tenant ON public.crm_contributions (tenant_id);
CREATE INDEX IF NOT EXISTS idx_crm_contributions_persona ON public.crm_contributions (persona_id);
CREATE INDEX IF NOT EXISTS idx_crm_contributions_clusterqube ON public.crm_contributions (clusterqube_id);
CREATE INDEX IF NOT EXISTS idx_crm_contributions_type ON public.crm_contributions (contribution_type);
CREATE INDEX IF NOT EXISTS idx_crm_contributions_created ON public.crm_contributions (created_at);

-- ============================================================================
-- 3. CRM ENGAGEMENT EVENTS
-- Events like view, complete, comment, share, etc.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.crm_engagement_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  persona_id UUID NOT NULL REFERENCES public.crm_personas(id) ON DELETE CASCADE,
  
  -- Qube / ClusterQube references
  qube_id TEXT,
  clusterqube_id TEXT,
  
  -- Event details
  event_type TEXT NOT NULL,  -- 'view', 'complete', 'comment', 'share', 'like'
  weight NUMERIC(18,6) NOT NULL DEFAULT 1,
  pokw_delta NUMERIC(18,6) NOT NULL DEFAULT 0,
  
  -- Metadata
  source TEXT,
  metadata JSONB,  -- Additional event-specific data
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_engagement_tenant ON public.crm_engagement_events (tenant_id);
CREATE INDEX IF NOT EXISTS idx_crm_engagement_persona ON public.crm_engagement_events (persona_id);
CREATE INDEX IF NOT EXISTS idx_crm_engagement_clusterqube ON public.crm_engagement_events (clusterqube_id);
CREATE INDEX IF NOT EXISTS idx_crm_engagement_type ON public.crm_engagement_events (event_type);
CREATE INDEX IF NOT EXISTS idx_crm_engagement_created ON public.crm_engagement_events (created_at);

-- ============================================================================
-- 4. CRM ENTITLEMENTS
-- Access rights to ClusterQubes and modalities
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.crm_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  persona_id UUID NOT NULL REFERENCES public.crm_personas(id) ON DELETE CASCADE,
  
  -- Content references
  clusterqube_id TEXT NOT NULL,
  qube_id TEXT,
  
  -- Access details
  modality TEXT NOT NULL,  -- 'read', 'watch', 'listen', 'interact'
  access_level TEXT NOT NULL DEFAULT 'full' 
    CHECK (access_level IN ('none', 'preview', 'full')),
  origin TEXT NOT NULL DEFAULT 'manual'  -- 'manual', 'pokw', 'purchase', 'airdrop'
    CHECK (origin IN ('manual', 'pokw', 'purchase', 'airdrop', 'subscription')),
  
  -- Optional expiry
  expires_at TIMESTAMPTZ,
  
  -- Meta
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_entitlements_tenant ON public.crm_entitlements (tenant_id);
CREATE INDEX IF NOT EXISTS idx_crm_entitlements_persona ON public.crm_entitlements (persona_id);
CREATE INDEX IF NOT EXISTS idx_crm_entitlements_clusterqube ON public.crm_entitlements (clusterqube_id);
CREATE INDEX IF NOT EXISTS idx_crm_entitlements_modality ON public.crm_entitlements (modality);
CREATE INDEX IF NOT EXISTS idx_crm_entitlements_expires ON public.crm_entitlements (expires_at);

-- Unique constraint: one entitlement per persona/clusterqube/modality combo
CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_entitlements_unique 
  ON public.crm_entitlements (tenant_id, persona_id, clusterqube_id, modality);

-- ============================================================================
-- 5. CRM REWARDS
-- Ledger of intended and executed token rewards for PoKW
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.crm_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  persona_id UUID NOT NULL REFERENCES public.crm_personas(id) ON DELETE CASCADE,
  
  -- Period for which reward was calculated
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  
  -- PoKW score used for calculation
  pokw_score_used NUMERIC(18,6) NOT NULL,
  
  -- Token details
  token_type TEXT NOT NULL,  -- 'QCT', 'QOYN', 'KNYT'
  amount NUMERIC(36,12) NOT NULL,
  
  -- Status workflow
  status TEXT NOT NULL DEFAULT 'draft' 
    CHECK (status IN ('draft', 'approved', 'paid', 'cancelled')),
  
  -- Blockchain reference (when paid)
  tx_hash TEXT,
  chain_id TEXT,
  
  -- Notes
  notes TEXT,
  
  -- Meta
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_rewards_tenant ON public.crm_rewards (tenant_id);
CREATE INDEX IF NOT EXISTS idx_crm_rewards_persona ON public.crm_rewards (persona_id);
CREATE INDEX IF NOT EXISTS idx_crm_rewards_period ON public.crm_rewards (period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_crm_rewards_status ON public.crm_rewards (status);
CREATE INDEX IF NOT EXISTS idx_crm_rewards_token ON public.crm_rewards (token_type);

-- ============================================================================
-- 6. CRM SEGMENTS
-- Basic dynamic/static segment support
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.crm_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  
  -- Segment details
  name TEXT NOT NULL,
  description TEXT,
  
  -- JSON-based rule definition for future dynamic segments
  rule_definition JSONB,
  is_dynamic BOOLEAN NOT NULL DEFAULT false,
  
  -- Meta
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_segments_tenant ON public.crm_segments (tenant_id);
CREATE INDEX IF NOT EXISTS idx_crm_segments_name ON public.crm_segments (tenant_id, name);

-- ============================================================================
-- 7. CRM SEGMENT MEMBERS
-- Many-to-many relationship between segments and personas
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.crm_segment_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_id UUID NOT NULL REFERENCES public.crm_segments(id) ON DELETE CASCADE,
  persona_id UUID NOT NULL REFERENCES public.crm_personas(id) ON DELETE CASCADE,
  
  -- Meta
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_segment_members_unique 
  ON public.crm_segment_members (segment_id, persona_id);
CREATE INDEX IF NOT EXISTS idx_crm_segment_members_persona 
  ON public.crm_segment_members (persona_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Basic tenant isolation with service_role bypass
-- ============================================================================

-- Enable RLS on all CRM tables
ALTER TABLE public.crm_personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_engagement_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_segment_members ENABLE ROW LEVEL SECURITY;

-- Service role bypass (for AigentZ backend operations)
-- These policies allow service_role to perform all operations

-- CRM Personas policies
DROP POLICY IF EXISTS "crm_personas_service_role" ON public.crm_personas;
CREATE POLICY "crm_personas_service_role" ON public.crm_personas
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "crm_personas_tenant_read" ON public.crm_personas;
CREATE POLICY "crm_personas_tenant_read" ON public.crm_personas
  FOR SELECT USING (true);  -- TODO: Add tenant context check via JWT claim

DROP POLICY IF EXISTS "crm_personas_tenant_write" ON public.crm_personas;
CREATE POLICY "crm_personas_tenant_write" ON public.crm_personas
  FOR INSERT WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- CRM Contributions policies
DROP POLICY IF EXISTS "crm_contributions_service_role" ON public.crm_contributions;
CREATE POLICY "crm_contributions_service_role" ON public.crm_contributions
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "crm_contributions_tenant_read" ON public.crm_contributions;
CREATE POLICY "crm_contributions_tenant_read" ON public.crm_contributions
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "crm_contributions_tenant_write" ON public.crm_contributions;
CREATE POLICY "crm_contributions_tenant_write" ON public.crm_contributions
  FOR INSERT WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- CRM Engagement Events policies
DROP POLICY IF EXISTS "crm_engagement_service_role" ON public.crm_engagement_events;
CREATE POLICY "crm_engagement_service_role" ON public.crm_engagement_events
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "crm_engagement_tenant_read" ON public.crm_engagement_events;
CREATE POLICY "crm_engagement_tenant_read" ON public.crm_engagement_events
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "crm_engagement_tenant_write" ON public.crm_engagement_events;
CREATE POLICY "crm_engagement_tenant_write" ON public.crm_engagement_events
  FOR INSERT WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- CRM Entitlements policies
DROP POLICY IF EXISTS "crm_entitlements_service_role" ON public.crm_entitlements;
CREATE POLICY "crm_entitlements_service_role" ON public.crm_entitlements
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "crm_entitlements_tenant_read" ON public.crm_entitlements;
CREATE POLICY "crm_entitlements_tenant_read" ON public.crm_entitlements
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "crm_entitlements_tenant_write" ON public.crm_entitlements;
CREATE POLICY "crm_entitlements_tenant_write" ON public.crm_entitlements
  FOR ALL WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- CRM Rewards policies
DROP POLICY IF EXISTS "crm_rewards_service_role" ON public.crm_rewards;
CREATE POLICY "crm_rewards_service_role" ON public.crm_rewards
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "crm_rewards_tenant_read" ON public.crm_rewards;
CREATE POLICY "crm_rewards_tenant_read" ON public.crm_rewards
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "crm_rewards_tenant_write" ON public.crm_rewards;
CREATE POLICY "crm_rewards_tenant_write" ON public.crm_rewards
  FOR ALL WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- CRM Segments policies
DROP POLICY IF EXISTS "crm_segments_service_role" ON public.crm_segments;
CREATE POLICY "crm_segments_service_role" ON public.crm_segments
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "crm_segments_tenant_read" ON public.crm_segments;
CREATE POLICY "crm_segments_tenant_read" ON public.crm_segments
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "crm_segments_tenant_write" ON public.crm_segments;
CREATE POLICY "crm_segments_tenant_write" ON public.crm_segments
  FOR ALL WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- CRM Segment Members policies
DROP POLICY IF EXISTS "crm_segment_members_service_role" ON public.crm_segment_members;
CREATE POLICY "crm_segment_members_service_role" ON public.crm_segment_members
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "crm_segment_members_tenant_read" ON public.crm_segment_members;
CREATE POLICY "crm_segment_members_tenant_read" ON public.crm_segment_members
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "crm_segment_members_tenant_write" ON public.crm_segment_members;
CREATE POLICY "crm_segment_members_tenant_write" ON public.crm_segment_members
  FOR ALL WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.crm_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS crm_personas_updated_at ON public.crm_personas;
CREATE TRIGGER crm_personas_updated_at
  BEFORE UPDATE ON public.crm_personas
  FOR EACH ROW EXECUTE FUNCTION public.crm_update_updated_at();

DROP TRIGGER IF EXISTS crm_entitlements_updated_at ON public.crm_entitlements;
CREATE TRIGGER crm_entitlements_updated_at
  BEFORE UPDATE ON public.crm_entitlements
  FOR EACH ROW EXECUTE FUNCTION public.crm_update_updated_at();

DROP TRIGGER IF EXISTS crm_rewards_updated_at ON public.crm_rewards;
CREATE TRIGGER crm_rewards_updated_at
  BEFORE UPDATE ON public.crm_rewards
  FOR EACH ROW EXECUTE FUNCTION public.crm_update_updated_at();

DROP TRIGGER IF EXISTS crm_segments_updated_at ON public.crm_segments;
CREATE TRIGGER crm_segments_updated_at
  BEFORE UPDATE ON public.crm_segments
  FOR EACH ROW EXECUTE FUNCTION public.crm_update_updated_at();

-- ============================================================================
-- SEED DATA: Default tenants
-- ============================================================================

-- Insert default tenants if they don't exist in a tenants table
-- (This assumes a tenants table exists; if not, this is just documentation)
-- INSERT INTO public.tenants (id, slug, name) VALUES 
--   ('qriptonian', 'qriptonian', 'Qriptonian Magazine'),
--   ('kn0w1', 'kn0w1', 'Kn0w1 Application')
-- ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.crm_personas IS 'CRM persona view for multi-tenant identity management. Links to DIDQube primitives.';
COMMENT ON TABLE public.crm_contributions IS 'Records of knowledge work (PoKW) attributable to personas. Ready for PoR/PoS/PoP integration.';
COMMENT ON TABLE public.crm_engagement_events IS 'User engagement events (view, complete, comment, etc.) for PoKW calculation.';
COMMENT ON TABLE public.crm_entitlements IS 'Access rights to ClusterQubes and content modalities.';
COMMENT ON TABLE public.crm_rewards IS 'Token reward ledger for PoKW-based incentives. Supports QCT, QOYN, KNYT.';
COMMENT ON TABLE public.crm_segments IS 'User segments for targeting and analytics.';
COMMENT ON TABLE public.crm_segment_members IS 'Many-to-many relationship between segments and personas.';

COMMENT ON COLUMN public.crm_contributions.por_score IS 'Future: Proof of Reputation score from Aigent_PoR';
COMMENT ON COLUMN public.crm_contributions.pos_score IS 'Future: Proof of Stake score from Aigent_PoS';
COMMENT ON COLUMN public.crm_contributions.pop_score IS 'Future: Proof of Participation score from Aigent_PoP';
