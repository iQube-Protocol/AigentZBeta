-- AgentiQ CRM: Enhanced Schema Migration (Phase 1b)
-- 
-- Adds: Franchises, Tenants hierarchy, Auth Profiles, Wallet Events,
--       Audit Logs, Copilot History, Interest Tags, Reputation Integration
-- 
-- HIERARCHY: Franchise → Tenant → Persona (many-to-many)
-- IDENTITY: Kybe DID → Root DID → Auth Profile → Multiple Personas
-- 
-- Run AFTER 20251128_agentiq_crm.sql
-- Non-breaking, additive only

-- ============================================================================
-- 1. CRM FRANCHISES (Top-level organizational unit)
-- Franchises own Tenants. A franchise represents a major business unit.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.crm_franchises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,  -- e.g., 'iqube-protocol', 'qripto-media'
  name TEXT NOT NULL,
  description TEXT,
  
  -- Branding
  logo_url TEXT,
  primary_color TEXT,
  
  -- Config
  config JSONB DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Meta
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_franchises_slug ON public.crm_franchises (slug);
CREATE INDEX IF NOT EXISTS idx_crm_franchises_active ON public.crm_franchises (is_active);

-- ============================================================================
-- 2. CRM TENANTS (Owned by Franchises)
-- Tenants are applications/sites within a franchise.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.crm_tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  franchise_id UUID NOT NULL REFERENCES public.crm_franchises(id) ON DELETE CASCADE,
  slug TEXT UNIQUE NOT NULL,  -- e.g., 'qriptonian', 'kn0w1'
  name TEXT NOT NULL,
  description TEXT,
  
  -- Config
  domain TEXT,  -- e.g., 'qriptonian.com', 'kn0w1.app'
  config JSONB DEFAULT '{}',
  supported_tokens TEXT[] DEFAULT ARRAY['QCT'],  -- ['QCT', 'QOYN', 'KNYT']
  default_modalities TEXT[] DEFAULT ARRAY['read'],  -- ['read', 'watch', 'listen', 'interact']
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Meta
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_tenants_franchise ON public.crm_tenants (franchise_id);
CREATE INDEX IF NOT EXISTS idx_crm_tenants_slug ON public.crm_tenants (slug);
CREATE INDEX IF NOT EXISTS idx_crm_tenants_active ON public.crm_tenants (is_active);

-- ============================================================================
-- 3. CRM AUTH PROFILES (Master Account - Email/Password)
-- One auth profile can control multiple personas across tenants/franchises.
-- Links to Kybe DID for unified identity.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.crm_auth_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Authentication credentials
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,  -- bcrypt hash, null if OAuth-only
  
  -- OAuth providers (optional)
  oauth_providers JSONB DEFAULT '{}',  -- {"google": "sub_id", "apple": "sub_id"}
  
  -- Identity linking (DIDQube integration)
  kybe_did TEXT UNIQUE,  -- Soul-bound identity
  root_did_proxy_id TEXT,  -- Root DID reference
  
  -- Profile info
  display_name TEXT,
  avatar_url TEXT,
  
  -- Status
  email_verified BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  
  -- Meta
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_auth_profiles_email ON public.crm_auth_profiles (email);
CREATE INDEX IF NOT EXISTS idx_crm_auth_profiles_kybe_did ON public.crm_auth_profiles (kybe_did);

-- ============================================================================
-- 4. CRM PERSONA FRANCHISE MEMBERSHIPS (Many-to-Many)
-- A persona can belong to multiple franchises.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.crm_persona_franchises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id UUID NOT NULL REFERENCES public.crm_personas(id) ON DELETE CASCADE,
  franchise_id UUID NOT NULL REFERENCES public.crm_franchises(id) ON DELETE CASCADE,
  
  -- Membership details
  role TEXT DEFAULT 'member',  -- 'member', 'contributor', 'admin'
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Meta
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_persona_franchises_unique 
  ON public.crm_persona_franchises (persona_id, franchise_id);
CREATE INDEX IF NOT EXISTS idx_crm_persona_franchises_franchise 
  ON public.crm_persona_franchises (franchise_id);

-- ============================================================================
-- 5. CRM AUTH PROFILE PERSONAS (Master Account → Personas)
-- Links auth profiles to the personas they control.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.crm_auth_profile_personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_profile_id UUID NOT NULL REFERENCES public.crm_auth_profiles(id) ON DELETE CASCADE,
  persona_id UUID NOT NULL REFERENCES public.crm_personas(id) ON DELETE CASCADE,
  
  -- Relationship
  is_primary BOOLEAN NOT NULL DEFAULT false,  -- Primary persona for this auth profile
  alias TEXT,  -- Optional friendly name for this persona
  
  -- Meta
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_auth_profile_personas_unique 
  ON public.crm_auth_profile_personas (auth_profile_id, persona_id);
CREATE INDEX IF NOT EXISTS idx_crm_auth_profile_personas_auth 
  ON public.crm_auth_profile_personas (auth_profile_id);
CREATE INDEX IF NOT EXISTS idx_crm_auth_profile_personas_persona 
  ON public.crm_auth_profile_personas (persona_id);

-- ============================================================================
-- 6. CRM WALLET EVENTS (x402 Integration)
-- Tracks ALL wallet transactions for personas.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.crm_wallet_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  persona_id UUID NOT NULL REFERENCES public.crm_personas(id) ON DELETE CASCADE,
  
  -- Wallet reference
  wallet_address TEXT NOT NULL,
  
  -- Transaction details
  event_type TEXT NOT NULL,  -- 'deposit', 'withdrawal', 'transfer_in', 'transfer_out', 
                             -- 'reward_claim', 'purchase', 'nft_mint', 'nft_transfer',
                             -- 'stake', 'unstake', 'fee'
  
  -- Token/Asset details
  token_type TEXT,  -- 'ETH', 'MATIC', 'QCT', 'QOYN', 'KNYT', 'NFT'
  token_address TEXT,  -- Contract address for ERC20/NFT
  amount NUMERIC(36,18),
  
  -- NFT specific
  nft_token_id TEXT,
  nft_metadata JSONB,
  
  -- Blockchain reference
  chain_id TEXT NOT NULL,
  tx_hash TEXT,
  block_number BIGINT,
  
  -- Counterparty (for transfers)
  counterparty_address TEXT,
  counterparty_persona_id UUID REFERENCES public.crm_personas(id),
  
  -- Status
  status TEXT NOT NULL DEFAULT 'confirmed' 
    CHECK (status IN ('pending', 'confirmed', 'failed', 'reverted')),
  
  -- Metadata
  metadata JSONB,
  source TEXT,  -- 'x402', 'manual', 'import'
  
  -- Meta
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_wallet_events_tenant ON public.crm_wallet_events (tenant_id);
CREATE INDEX IF NOT EXISTS idx_crm_wallet_events_persona ON public.crm_wallet_events (persona_id);
CREATE INDEX IF NOT EXISTS idx_crm_wallet_events_wallet ON public.crm_wallet_events (wallet_address);
CREATE INDEX IF NOT EXISTS idx_crm_wallet_events_type ON public.crm_wallet_events (event_type);
CREATE INDEX IF NOT EXISTS idx_crm_wallet_events_chain ON public.crm_wallet_events (chain_id);
CREATE INDEX IF NOT EXISTS idx_crm_wallet_events_tx ON public.crm_wallet_events (tx_hash);
CREATE INDEX IF NOT EXISTS idx_crm_wallet_events_created ON public.crm_wallet_events (created_at);

-- ============================================================================
-- 7. CRM REPUTATION EVENTS (DiDQube/RQH Integration)
-- Tracks reputation changes while complying with DiDQube policy.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.crm_reputation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  persona_id UUID NOT NULL REFERENCES public.crm_personas(id) ON DELETE CASCADE,
  
  -- Reputation details
  event_type TEXT NOT NULL,  -- 'bucket_change', 'flag_received', 'flag_resolved',
                             -- 'dispute_filed', 'dispute_resolved', 'exoneration'
  
  -- RQH bucket info (privacy-preserving: only bucket, not exact score)
  reputation_bucket TEXT,  -- 'green', 'amber', 'red' (from RQH)
  previous_bucket TEXT,
  
  -- Event context
  reason TEXT,
  related_entity_type TEXT,  -- 'contribution', 'engagement', 'transaction', 'flag'
  related_entity_id UUID,
  
  -- DiDQube compliance
  cohort_id TEXT,  -- Cohort reference for privacy
  is_anonymized BOOLEAN NOT NULL DEFAULT true,  -- Complies with DiDQube policy
  
  -- Metadata
  metadata JSONB,
  source TEXT,  -- 'rqh', 'fbc', 'dbc', 'manual'
  
  -- Meta
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_reputation_events_tenant ON public.crm_reputation_events (tenant_id);
CREATE INDEX IF NOT EXISTS idx_crm_reputation_events_persona ON public.crm_reputation_events (persona_id);
CREATE INDEX IF NOT EXISTS idx_crm_reputation_events_type ON public.crm_reputation_events (event_type);
CREATE INDEX IF NOT EXISTS idx_crm_reputation_events_bucket ON public.crm_reputation_events (reputation_bucket);
CREATE INDEX IF NOT EXISTS idx_crm_reputation_events_created ON public.crm_reputation_events (created_at);

-- ============================================================================
-- 8. CRM AUDIT LOGS (Change Tracking)
-- Tracks all modifications to CRM data.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.crm_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT,  -- Null for cross-tenant operations
  
  -- What changed
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  
  -- Change details
  old_values JSONB,
  new_values JSONB,
  changed_fields TEXT[],  -- List of field names that changed
  
  -- Who made the change
  changed_by_persona_id UUID REFERENCES public.crm_personas(id),
  changed_by_auth_profile_id UUID REFERENCES public.crm_auth_profiles(id),
  changed_by_agent_id TEXT,  -- For agent-initiated changes
  
  -- Context
  change_reason TEXT,
  ip_address INET,
  user_agent TEXT,
  
  -- Meta
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_audit_logs_tenant ON public.crm_audit_logs (tenant_id);
CREATE INDEX IF NOT EXISTS idx_crm_audit_logs_table_record ON public.crm_audit_logs (table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_crm_audit_logs_action ON public.crm_audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_crm_audit_logs_created ON public.crm_audit_logs (created_at);
CREATE INDEX IF NOT EXISTS idx_crm_audit_logs_persona ON public.crm_audit_logs (changed_by_persona_id);

-- ============================================================================
-- 9. CRM COPILOT HISTORY (AI Interaction Tracking)
-- Logs CopilotKit interactions for analytics and improvement.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.crm_copilot_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT,
  persona_id UUID REFERENCES public.crm_personas(id),
  
  -- Query details
  query_text TEXT NOT NULL,
  parsed_intent TEXT,
  extracted_entities JSONB,
  
  -- Execution
  tool_calls JSONB,  -- Array of tool invocations
  executed_actions TEXT[],  -- List of actions taken
  
  -- Results
  result_summary TEXT,
  result_count INTEGER,
  execution_time_ms INTEGER,
  
  -- Status
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  
  -- Context
  session_id TEXT,
  conversation_id TEXT,
  
  -- Meta
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_copilot_history_tenant ON public.crm_copilot_history (tenant_id);
CREATE INDEX IF NOT EXISTS idx_crm_copilot_history_persona ON public.crm_copilot_history (persona_id);
CREATE INDEX IF NOT EXISTS idx_crm_copilot_history_intent ON public.crm_copilot_history (parsed_intent);
CREATE INDEX IF NOT EXISTS idx_crm_copilot_history_success ON public.crm_copilot_history (success);
CREATE INDEX IF NOT EXISTS idx_crm_copilot_history_created ON public.crm_copilot_history (created_at);

-- ============================================================================
-- 10. CRM INTEREST TAGS (Normalized Tags)
-- Categorized interest/tag management.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.crm_interest_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Tag details
  slug TEXT UNIQUE NOT NULL,  -- e.g., 'blockchain', 'ai-ml', 'defi'
  name TEXT NOT NULL,
  category TEXT,  -- e.g., 'technology', 'finance', 'lifestyle'
  description TEXT,
  
  -- Hierarchy (optional)
  parent_tag_id UUID REFERENCES public.crm_interest_tags(id),
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Meta
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_interest_tags_slug ON public.crm_interest_tags (slug);
CREATE INDEX IF NOT EXISTS idx_crm_interest_tags_category ON public.crm_interest_tags (category);
CREATE INDEX IF NOT EXISTS idx_crm_interest_tags_parent ON public.crm_interest_tags (parent_tag_id);

-- ============================================================================
-- 11. CRM PERSONA INTERESTS (Many-to-Many)
-- Links personas to their interests.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.crm_persona_interests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id UUID NOT NULL REFERENCES public.crm_personas(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.crm_interest_tags(id) ON DELETE CASCADE,
  
  -- Interest level
  weight NUMERIC(5,2) DEFAULT 1.0,  -- 0.0 to 5.0 scale
  source TEXT DEFAULT 'inferred',  -- 'explicit', 'inferred', 'imported'
  
  -- Meta
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_persona_interests_unique 
  ON public.crm_persona_interests (persona_id, tag_id);
CREATE INDEX IF NOT EXISTS idx_crm_persona_interests_tag 
  ON public.crm_persona_interests (tag_id);

-- ============================================================================
-- ALTER EXISTING TABLES: Add new columns to crm_personas
-- ============================================================================

-- Add wallet address to personas
ALTER TABLE public.crm_personas 
  ADD COLUMN IF NOT EXISTS primary_wallet_address TEXT;

-- Add auth profile reference
ALTER TABLE public.crm_personas 
  ADD COLUMN IF NOT EXISTS auth_profile_id UUID REFERENCES public.crm_auth_profiles(id);

-- Add reputation bucket cache (for quick access without RQH call)
ALTER TABLE public.crm_personas 
  ADD COLUMN IF NOT EXISTS reputation_bucket TEXT DEFAULT 'green';

ALTER TABLE public.crm_personas 
  ADD COLUMN IF NOT EXISTS reputation_bucket_updated_at TIMESTAMPTZ;

-- Add franchise_id for primary franchise
ALTER TABLE public.crm_personas 
  ADD COLUMN IF NOT EXISTS primary_franchise_id UUID REFERENCES public.crm_franchises(id);

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_crm_personas_wallet ON public.crm_personas (primary_wallet_address);
CREATE INDEX IF NOT EXISTS idx_crm_personas_auth_profile ON public.crm_personas (auth_profile_id);
CREATE INDEX IF NOT EXISTS idx_crm_personas_reputation ON public.crm_personas (reputation_bucket);
CREATE INDEX IF NOT EXISTS idx_crm_personas_primary_franchise ON public.crm_personas (primary_franchise_id);

-- ============================================================================
-- ROW LEVEL SECURITY for new tables
-- ============================================================================

ALTER TABLE public.crm_franchises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_auth_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_persona_franchises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_auth_profile_personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_wallet_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_reputation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_copilot_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_interest_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_persona_interests ENABLE ROW LEVEL SECURITY;

-- Service role policies (allow all for backend)
CREATE POLICY "crm_franchises_service_role" ON public.crm_franchises FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "crm_tenants_service_role" ON public.crm_tenants FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "crm_auth_profiles_service_role" ON public.crm_auth_profiles FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "crm_persona_franchises_service_role" ON public.crm_persona_franchises FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "crm_auth_profile_personas_service_role" ON public.crm_auth_profile_personas FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "crm_wallet_events_service_role" ON public.crm_wallet_events FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "crm_reputation_events_service_role" ON public.crm_reputation_events FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "crm_audit_logs_service_role" ON public.crm_audit_logs FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "crm_copilot_history_service_role" ON public.crm_copilot_history FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "crm_interest_tags_service_role" ON public.crm_interest_tags FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "crm_persona_interests_service_role" ON public.crm_persona_interests FOR ALL USING (auth.role() = 'service_role');

-- Read policies (public read for most tables)
CREATE POLICY "crm_franchises_read" ON public.crm_franchises FOR SELECT USING (true);
CREATE POLICY "crm_tenants_read" ON public.crm_tenants FOR SELECT USING (true);
CREATE POLICY "crm_interest_tags_read" ON public.crm_interest_tags FOR SELECT USING (true);

-- Authenticated write policies
CREATE POLICY "crm_auth_profiles_write" ON public.crm_auth_profiles FOR INSERT WITH CHECK (auth.role() IN ('authenticated', 'service_role'));
CREATE POLICY "crm_wallet_events_write" ON public.crm_wallet_events FOR INSERT WITH CHECK (auth.role() IN ('authenticated', 'service_role'));
CREATE POLICY "crm_reputation_events_write" ON public.crm_reputation_events FOR INSERT WITH CHECK (auth.role() IN ('authenticated', 'service_role'));

-- ============================================================================
-- TRIGGERS for updated_at
-- ============================================================================

DROP TRIGGER IF EXISTS crm_franchises_updated_at ON public.crm_franchises;
CREATE TRIGGER crm_franchises_updated_at
  BEFORE UPDATE ON public.crm_franchises
  FOR EACH ROW EXECUTE FUNCTION public.crm_update_updated_at();

DROP TRIGGER IF EXISTS crm_tenants_updated_at ON public.crm_tenants;
CREATE TRIGGER crm_tenants_updated_at
  BEFORE UPDATE ON public.crm_tenants
  FOR EACH ROW EXECUTE FUNCTION public.crm_update_updated_at();

DROP TRIGGER IF EXISTS crm_auth_profiles_updated_at ON public.crm_auth_profiles;
CREATE TRIGGER crm_auth_profiles_updated_at
  BEFORE UPDATE ON public.crm_auth_profiles
  FOR EACH ROW EXECUTE FUNCTION public.crm_update_updated_at();

DROP TRIGGER IF EXISTS crm_interest_tags_updated_at ON public.crm_interest_tags;
CREATE TRIGGER crm_interest_tags_updated_at
  BEFORE UPDATE ON public.crm_interest_tags
  FOR EACH ROW EXECUTE FUNCTION public.crm_update_updated_at();

-- ============================================================================
-- SEED DATA: Default Franchises and Tenants
-- ============================================================================

-- Insert default franchise
INSERT INTO public.crm_franchises (slug, name, description, is_active) VALUES
  ('iqube-protocol', 'iQube Protocol', 'Core iQube Protocol franchise', true),
  ('qripto-media', 'Qripto Media', 'Media and publishing franchise', true)
ON CONFLICT (slug) DO NOTHING;

-- Insert default tenants (will need franchise_id after insert)
-- This is handled in application code or a separate seed script

-- Insert default interest tags
INSERT INTO public.crm_interest_tags (slug, name, category, description) VALUES
  ('blockchain', 'Blockchain', 'technology', 'Interest in blockchain technology'),
  ('ai-ml', 'AI & Machine Learning', 'technology', 'Interest in artificial intelligence and ML'),
  ('defi', 'DeFi', 'finance', 'Interest in decentralized finance'),
  ('nft', 'NFTs', 'technology', 'Interest in non-fungible tokens'),
  ('web3', 'Web3', 'technology', 'Interest in Web3 technologies'),
  ('identity', 'Digital Identity', 'technology', 'Interest in decentralized identity'),
  ('privacy', 'Privacy', 'technology', 'Interest in privacy-preserving technologies'),
  ('gaming', 'Gaming', 'entertainment', 'Interest in gaming and GameFi'),
  ('content-creation', 'Content Creation', 'media', 'Interest in content creation'),
  ('investing', 'Investing', 'finance', 'Interest in investment strategies')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.crm_franchises IS 'Top-level organizational units. Franchises own tenants.';
COMMENT ON TABLE public.crm_tenants IS 'Applications/sites within a franchise. Owned by franchises.';
COMMENT ON TABLE public.crm_auth_profiles IS 'Master accounts with email/password. Can control multiple personas.';
COMMENT ON TABLE public.crm_persona_franchises IS 'Many-to-many: personas can belong to multiple franchises.';
COMMENT ON TABLE public.crm_auth_profile_personas IS 'Links auth profiles to the personas they control.';
COMMENT ON TABLE public.crm_wallet_events IS 'All wallet transactions including x402 integration.';
COMMENT ON TABLE public.crm_reputation_events IS 'Reputation changes from RQH/FBC/DBC. DiDQube policy compliant.';
COMMENT ON TABLE public.crm_audit_logs IS 'Change tracking for all CRM data modifications.';
COMMENT ON TABLE public.crm_copilot_history IS 'CopilotKit interaction logs for analytics.';
COMMENT ON TABLE public.crm_interest_tags IS 'Normalized interest/tag taxonomy.';
COMMENT ON TABLE public.crm_persona_interests IS 'Persona interest associations with weights.';

COMMENT ON COLUMN public.crm_personas.primary_wallet_address IS 'Primary x402 wallet address for this persona.';
COMMENT ON COLUMN public.crm_personas.reputation_bucket IS 'Cached reputation bucket from RQH (green/amber/red).';
COMMENT ON COLUMN public.crm_reputation_events.is_anonymized IS 'True if event complies with DiDQube anonymization policy.';
