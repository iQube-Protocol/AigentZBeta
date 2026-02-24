-- =============================================================================
-- SmartContentQube v0 + RelationshipQube + Smart Content Library
-- QubeBase (Supabase) Migration
-- =============================================================================
-- 
-- This migration creates the foundation tables for the Smart Content system:
-- 1. smart_content_qubes - Self-aware content objects
-- 2. relationship_qubes - Wave layer connections
-- 3. content_library - User's content library/shelf
-- 4. media_assets - Storage abstraction for content assets
-- 5. content_entitlements - Access grants and purchases
-- 6. content_progress - User progress tracking
--
-- Storage: Supabase Storage initially, extensible to IPFS/Autonomys
-- =============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- ENUMS
-- =============================================================================

-- Content application context
CREATE TYPE smart_content_app AS ENUM (
  'metaKnyts',
  'Qriptopian',
  'AgentiQ'
);

-- Content modality types
CREATE TYPE content_modality AS ENUM (
  'read',
  'watch',
  'listen',
  'interact'
);

-- Identity state levels
CREATE TYPE identity_state AS ENUM (
  'anonymous',
  'pseudo',
  'semi',
  'full'
);

-- Pricing model kinds
CREATE TYPE pricing_kind AS ENUM (
  'payPerPanel',
  'payPerEpisode',
  'payPerStream',
  'payPerArticle',
  'payPerIssue',
  'payPerSeries',
  'subscription',
  'bundle',
  'free'
);

-- Payment currencies
CREATE TYPE payment_currency AS ENUM (
  'QCT',
  'QOYN',
  'KNYT',
  'USDC',
  'ETH',
  'BTC',
  'sats'
);

-- Content structure kinds
CREATE TYPE content_structure_kind AS ENUM (
  'episode',
  'issue',
  'article',
  'series',
  'collection'
);

-- Relationship types
CREATE TYPE relationship_type AS ENUM (
  'sequence',
  'branch',
  'series',
  'collection',
  'reference',
  'prerequisite',
  'questPath',
  'playlist'
);

-- Relationship entity types
CREATE TYPE relationship_entity_type AS ENUM (
  'SmartContentQube',
  'Persona',
  'Agent',
  'Series',
  'Collection',
  'Quest',
  'Shelf'
);

-- Storage providers
CREATE TYPE storage_provider AS ENUM (
  'supabase',
  'ipfs',
  'autonomys',
  'cdn',
  'external'
);

-- Content status
CREATE TYPE content_status AS ENUM (
  'draft',
  'published',
  'archived',
  'scheduled'
);

-- Entitlement scope
CREATE TYPE entitlement_scope AS ENUM (
  'full',
  'preview',
  'rental',
  'subscription'
);

-- Entitlement acquisition type
CREATE TYPE entitlement_acquisition AS ENUM (
  'purchase',
  'subscription',
  'rental',
  'gift',
  'reward',
  'free'
);

-- Library expiry model
CREATE TYPE expiry_model AS ENUM (
  'permanent',
  'rental',
  'subscription',
  'timeLimited',
  'usageLimited'
);

-- =============================================================================
-- MEDIA ASSETS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS media_assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Asset identification
  asset_type VARCHAR(50) NOT NULL, -- image, video, audio, document, etc.
  mime_type VARCHAR(100) NOT NULL,
  
  -- Storage
  storage_provider storage_provider NOT NULL DEFAULT 'supabase',
  storage_uri TEXT NOT NULL, -- Supabase path, IPFS CID, etc.
  storage_bucket VARCHAR(100), -- Supabase bucket name
  
  -- Metadata
  file_name VARCHAR(255),
  size_bytes BIGINT,
  duration_seconds INTEGER, -- For video/audio
  width INTEGER, -- For images/video
  height INTEGER,
  
  -- Thumbnails
  thumbnail_uri TEXT,
  thumbnail_storage_provider storage_provider,
  
  -- Accessibility
  alt_text TEXT,
  
  -- Ownership
  tenant_id VARCHAR(100) NOT NULL,
  creator_root_did VARCHAR(255),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Soft delete
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_media_assets_tenant ON media_assets(tenant_id);
CREATE INDEX idx_media_assets_creator ON media_assets(creator_root_did);
CREATE INDEX idx_media_assets_type ON media_assets(asset_type);

-- =============================================================================
-- SMART CONTENT QUBES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS smart_content_qubes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Core identification
  app smart_content_app NOT NULL,
  title VARCHAR(500) NOT NULL,
  slug VARCHAR(500) NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  description TEXT,
  cover_image_uri TEXT,
  
  -- Ownership
  creator_root_did VARCHAR(255) NOT NULL,
  tenant_id VARCHAR(100) NOT NULL,
  
  -- Identity requirements (JSONB for flexibility)
  identity_requirements JSONB NOT NULL DEFAULT '{
    "minimumIdentifiability": "anonymous",
    "allowedPersonas": [],
    "personaOverridesAllowed": true,
    "requireHumanProof": false,
    "requireAgentDeclare": false
  }'::jsonb,
  
  -- Reputation requirements
  reputation_requirements JSONB NOT NULL DEFAULT '{
    "minBucket": 0,
    "minKnowledgeScore": 0,
    "minTrustScore": 0,
    "warningsOnFailure": true,
    "preferredSkillCategories": []
  }'::jsonb,
  
  -- Reward outcomes (integrates with RewardHub)
  reward_outcomes JSONB NOT NULL DEFAULT '{
    "engagementRewards": [],
    "creatorRoyalties": [],
    "questRewards": [],
    "rewardHubTenantId": ""
  }'::jsonb,
  
  -- Modalities (JSONB for complex nested structure)
  modalities JSONB NOT NULL DEFAULT '{
    "read": {"enabled": false, "panels": [], "textAssets": [], "primaryOn": ["mobile", "desktop"], "readingDirection": "ltr", "estimatedReadMinutes": 0},
    "watch": {"enabled": false, "videoAssets": [], "primaryOn": ["desktop", "tv"], "subtitleTracks": [], "allowPip": true, "allowDownload": false},
    "listen": {"enabled": false, "audioAssets": [], "primaryOn": ["mobile"], "hasTranscript": false, "allowBackground": true},
    "interact": {"enabled": false, "agents": [], "tools": [], "primaryOn": ["desktop"]}
  }'::jsonb,
  
  -- Content structure (episode, issue, article, series)
  structure_kind content_structure_kind,
  structure_data JSONB, -- Specific structure data based on kind
  
  -- Pricing model
  pricing_model JSONB NOT NULL DEFAULT '{
    "primaryCurrency": "QCT",
    "tiers": [],
    "freePreview": {},
    "creatorWalletAddress": "",
    "platformFeePercentage": 10
  }'::jsonb,
  
  -- Access policy
  access_policy JSONB NOT NULL DEFAULT '{
    "entitlementRequired": false,
    "entitlementType": "free",
    "grantedByTxType": [],
    "capabilityTtlSeconds": 86400
  }'::jsonb,
  
  -- Layout hints
  layout_hints JSONB NOT NULL DEFAULT '{
    "defaultCard": {"shape": "portrait", "height": "320px", "width": "240px"},
    "thumbnail": {"size": "medium", "floating": false, "position": "center"},
    "carousels": {"enabled": true, "groupBy": "series", "itemsPerView": 4},
    "responsive": {"mobile": {"layout": "stack"}, "tablet": {"layout": "grid"}, "desktop": {"layout": "split"}, "tv": {"layout": "carousel"}},
    "iframe": {"allowEmbed": false, "allowFullscreen": true}
  }'::jsonb,
  
  -- Menu integration
  menu_integration JSONB NOT NULL DEFAULT '{
    "preferredDrawers": ["contentViewer"],
    "optionalDrawers": ["walletCompact", "agentChat"],
    "showWalletSummary": true,
    "showLibraryStatus": true,
    "showQuestProgress": false,
    "allowUserOverrides": true
  }'::jsonb,
  
  -- Library metadata
  library_metadata JSONB NOT NULL DEFAULT '{
    "category": "Uncategorized",
    "tags": [],
    "recommendedShelf": "Recent",
    "expiryModel": "permanent",
    "expiryDurationSeconds": null,
    "sortPriority": 0,
    "featured": false,
    "contentRating": "G",
    "language": "en",
    "additionalLanguages": []
  }'::jsonb,
  
  -- Linked iQube references
  content_qube_id UUID,
  meta_qube_cid VARCHAR(100),
  
  -- Status
  status content_status NOT NULL DEFAULT 'draft',
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  
  -- Soft delete
  deleted_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT unique_app_slug UNIQUE (app, slug, deleted_at)
);

-- Indexes for smart_content_qubes
CREATE INDEX idx_scq_app ON smart_content_qubes(app);
CREATE INDEX idx_scq_tenant ON smart_content_qubes(tenant_id);
CREATE INDEX idx_scq_creator ON smart_content_qubes(creator_root_did);
CREATE INDEX idx_scq_status ON smart_content_qubes(status);
CREATE INDEX idx_scq_structure ON smart_content_qubes(structure_kind);
CREATE INDEX idx_scq_slug ON smart_content_qubes(slug);
CREATE INDEX idx_scq_featured ON smart_content_qubes((library_metadata->>'featured'));
CREATE INDEX idx_scq_category ON smart_content_qubes((library_metadata->>'category'));

-- Full-text search index
CREATE INDEX idx_scq_search ON smart_content_qubes 
  USING gin(to_tsvector('english', title || ' ' || COALESCE(description, '')));

-- =============================================================================
-- RELATIONSHIP QUBES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS relationship_qubes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Source entity
  source_id UUID NOT NULL,
  source_type relationship_entity_type NOT NULL,
  
  -- Target entity
  target_id UUID NOT NULL,
  target_type relationship_entity_type NOT NULL,
  
  -- Relationship type
  relationship_type relationship_type NOT NULL,
  
  -- Direction
  direction VARCHAR(20) NOT NULL DEFAULT 'unidirectional',
  
  -- Relationship-specific data (varies by type)
  relationship_data JSONB NOT NULL,
  
  -- Metadata
  metadata JSONB NOT NULL DEFAULT '{
    "sortOrder": 0,
    "featured": false
  }'::jsonb,
  
  -- Ownership
  tenant_id VARCHAR(100) NOT NULL,
  created_by VARCHAR(255) NOT NULL,
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Soft delete
  deleted_at TIMESTAMPTZ
);

-- Indexes for relationship_qubes
CREATE INDEX idx_rq_source ON relationship_qubes(source_id, source_type);
CREATE INDEX idx_rq_target ON relationship_qubes(target_id, target_type);
CREATE INDEX idx_rq_type ON relationship_qubes(relationship_type);
CREATE INDEX idx_rq_tenant ON relationship_qubes(tenant_id);
CREATE INDEX idx_rq_status ON relationship_qubes(status);

-- Composite index for graph traversal
CREATE INDEX idx_rq_graph ON relationship_qubes(source_id, target_id, relationship_type);

-- =============================================================================
-- CONTENT LIBRARY TABLE (User's shelf/collection)
-- =============================================================================

CREATE TABLE IF NOT EXISTS content_library (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- User identification
  persona_id UUID NOT NULL,
  root_did VARCHAR(255),
  
  -- Content reference
  content_id UUID NOT NULL REFERENCES smart_content_qubes(id),
  
  -- Shelf/collection
  shelf_name VARCHAR(100) NOT NULL DEFAULT 'Library',
  custom_shelf_id UUID, -- For user-created shelves
  
  -- Position in shelf
  position INTEGER NOT NULL DEFAULT 0,
  
  -- User metadata
  user_rating INTEGER CHECK (user_rating >= 1 AND user_rating <= 5),
  user_notes TEXT,
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  
  -- Progress
  progress_percentage INTEGER NOT NULL DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  last_accessed_at TIMESTAMPTZ,
  time_spent_seconds INTEGER NOT NULL DEFAULT 0,
  
  -- Completion
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  
  -- Timestamps
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT unique_persona_content UNIQUE (persona_id, content_id)
);

-- Indexes for content_library
CREATE INDEX idx_cl_persona ON content_library(persona_id);
CREATE INDEX idx_cl_content ON content_library(content_id);
CREATE INDEX idx_cl_shelf ON content_library(shelf_name);
CREATE INDEX idx_cl_favorite ON content_library(is_favorite);
CREATE INDEX idx_cl_completed ON content_library(completed);
CREATE INDEX idx_cl_last_accessed ON content_library(last_accessed_at DESC);

-- =============================================================================
-- CONTENT ENTITLEMENTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS content_entitlements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- User identification
  persona_id UUID NOT NULL,
  root_did VARCHAR(255),
  
  -- Content reference
  content_id UUID NOT NULL REFERENCES smart_content_qubes(id),
  
  -- Entitlement details
  scope entitlement_scope NOT NULL,
  acquired_via entitlement_acquisition NOT NULL,
  
  -- Transaction reference
  tx_hash VARCHAR(100),
  chain_id INTEGER,
  
  -- Expiration
  expires_at TIMESTAMPTZ, -- NULL = permanent
  
  -- Usage limits
  usage_count INTEGER NOT NULL DEFAULT 0,
  max_usage INTEGER, -- NULL = unlimited
  
  -- TokenQube reference
  token_qube_id UUID,
  capability_token TEXT,
  
  -- Timestamps
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  revoked_at TIMESTAMPTZ,
  revoke_reason TEXT,
  
  -- Constraints
  CONSTRAINT unique_persona_content_scope UNIQUE (persona_id, content_id, scope)
);

-- Indexes for content_entitlements
CREATE INDEX idx_ce_persona ON content_entitlements(persona_id);
CREATE INDEX idx_ce_content ON content_entitlements(content_id);
CREATE INDEX idx_ce_active ON content_entitlements(is_active);
CREATE INDEX idx_ce_expires ON content_entitlements(expires_at);
CREATE INDEX idx_ce_tx ON content_entitlements(tx_hash);

-- =============================================================================
-- CONTENT PROGRESS TABLE (Detailed progress tracking)
-- =============================================================================

CREATE TABLE IF NOT EXISTS content_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- User identification
  persona_id UUID NOT NULL,
  
  -- Content reference
  content_id UUID NOT NULL REFERENCES smart_content_qubes(id),
  
  -- Modality being tracked
  modality content_modality NOT NULL,
  
  -- Progress details
  progress_type VARCHAR(50) NOT NULL, -- 'panel', 'page', 'timestamp', 'percentage'
  progress_value INTEGER NOT NULL, -- Panel number, page number, seconds, or percentage
  progress_max INTEGER, -- Total panels, pages, duration, or 100
  
  -- Session tracking
  session_id UUID,
  session_started_at TIMESTAMPTZ,
  session_duration_seconds INTEGER,
  
  -- Timestamps
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT unique_progress_point UNIQUE (persona_id, content_id, modality, progress_type, progress_value)
);

-- Indexes for content_progress
CREATE INDEX idx_cp_persona ON content_progress(persona_id);
CREATE INDEX idx_cp_content ON content_progress(content_id);
CREATE INDEX idx_cp_modality ON content_progress(modality);
CREATE INDEX idx_cp_recorded ON content_progress(recorded_at DESC);

-- =============================================================================
-- USER SHELVES TABLE (Custom collections)
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_shelves (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- User identification
  persona_id UUID NOT NULL,
  
  -- Shelf details
  name VARCHAR(100) NOT NULL,
  description TEXT,
  cover_image_uri TEXT,
  
  -- Visibility
  is_public BOOLEAN NOT NULL DEFAULT false,
  
  -- Ordering
  position INTEGER NOT NULL DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT unique_persona_shelf_name UNIQUE (persona_id, name)
);

-- Indexes for user_shelves
CREATE INDEX idx_us_persona ON user_shelves(persona_id);
CREATE INDEX idx_us_public ON user_shelves(is_public);

-- =============================================================================
-- SERIES TABLE (For series/collection grouping)
-- =============================================================================

CREATE TABLE IF NOT EXISTS content_series (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Series identification
  title VARCHAR(500) NOT NULL,
  slug VARCHAR(500) NOT NULL,
  description TEXT,
  cover_image_uri TEXT,
  
  -- Ownership
  creator_root_did VARCHAR(255) NOT NULL,
  tenant_id VARCHAR(100) NOT NULL,
  
  -- Series metadata
  total_planned INTEGER,
  published_count INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'ongoing', -- ongoing, completed, hiatus, cancelled
  
  -- App context
  app smart_content_app NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT unique_series_slug UNIQUE (app, slug)
);

-- Indexes for content_series
CREATE INDEX idx_cs_app ON content_series(app);
CREATE INDEX idx_cs_tenant ON content_series(tenant_id);
CREATE INDEX idx_cs_creator ON content_series(creator_root_did);
CREATE INDEX idx_cs_status ON content_series(status);

-- =============================================================================
-- ROW LEVEL SECURITY POLICIES
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE smart_content_qubes ENABLE ROW LEVEL SECURITY;
ALTER TABLE relationship_qubes ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_shelves ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_series ENABLE ROW LEVEL SECURITY;

-- Permissive policies for initial development (tighten in production)

-- Media assets: creators can manage their own, published content is readable
CREATE POLICY "Media assets are viewable by everyone" ON media_assets
  FOR SELECT USING (deleted_at IS NULL);

CREATE POLICY "Media assets are insertable by authenticated users" ON media_assets
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Media assets are updatable by creator" ON media_assets
  FOR UPDATE USING (true);

-- Smart content qubes: published content is readable, creators can manage
CREATE POLICY "Published content is viewable by everyone" ON smart_content_qubes
  FOR SELECT USING (status = 'published' AND deleted_at IS NULL);

CREATE POLICY "Draft content is viewable by creator" ON smart_content_qubes
  FOR SELECT USING (deleted_at IS NULL);

CREATE POLICY "Content is insertable by authenticated users" ON smart_content_qubes
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Content is updatable by creator" ON smart_content_qubes
  FOR UPDATE USING (true);

-- Relationship qubes: active relationships are readable
CREATE POLICY "Active relationships are viewable" ON relationship_qubes
  FOR SELECT USING (status = 'active' AND deleted_at IS NULL);

CREATE POLICY "Relationships are insertable by authenticated users" ON relationship_qubes
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Relationships are updatable by creator" ON relationship_qubes
  FOR UPDATE USING (true);

-- Content library: users can only see their own
CREATE POLICY "Library items are viewable by owner" ON content_library
  FOR SELECT USING (true);

CREATE POLICY "Library items are insertable" ON content_library
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Library items are updatable by owner" ON content_library
  FOR UPDATE USING (true);

CREATE POLICY "Library items are deletable by owner" ON content_library
  FOR DELETE USING (true);

-- Content entitlements: users can only see their own
CREATE POLICY "Entitlements are viewable by owner" ON content_entitlements
  FOR SELECT USING (true);

CREATE POLICY "Entitlements are insertable" ON content_entitlements
  FOR INSERT WITH CHECK (true);

-- Content progress: users can only see their own
CREATE POLICY "Progress is viewable by owner" ON content_progress
  FOR SELECT USING (true);

CREATE POLICY "Progress is insertable" ON content_progress
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Progress is updatable by owner" ON content_progress
  FOR UPDATE USING (true);

-- User shelves: users can manage their own, public shelves are readable
CREATE POLICY "Shelves are viewable by owner or if public" ON user_shelves
  FOR SELECT USING (true);

CREATE POLICY "Shelves are insertable" ON user_shelves
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Shelves are updatable by owner" ON user_shelves
  FOR UPDATE USING (true);

CREATE POLICY "Shelves are deletable by owner" ON user_shelves
  FOR DELETE USING (true);

-- Content series: published series are readable
CREATE POLICY "Series are viewable by everyone" ON content_series
  FOR SELECT USING (true);

CREATE POLICY "Series are insertable by authenticated users" ON content_series
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Series are updatable by creator" ON content_series
  FOR UPDATE USING (true);

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_media_assets_updated_at
  BEFORE UPDATE ON media_assets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_smart_content_qubes_updated_at
  BEFORE UPDATE ON smart_content_qubes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_relationship_qubes_updated_at
  BEFORE UPDATE ON relationship_qubes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_content_library_updated_at
  BEFORE UPDATE ON content_library
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_shelves_updated_at
  BEFORE UPDATE ON user_shelves
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_content_series_updated_at
  BEFORE UPDATE ON content_series
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- SAMPLE DATA (Optional - for testing)
-- =============================================================================

-- Uncomment to insert sample data for testing

/*
-- Sample series
INSERT INTO content_series (id, title, slug, description, creator_root_did, tenant_id, app, status)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'The Qriptopian Chronicles', 'qriptopian-chronicles', 'A journey through the world of decentralized finance', 'did:iq:creator1', 'qriptopian', 'Qriptopian', 'ongoing'),
  ('00000000-0000-0000-0000-000000000002', 'metaKnyts Book 1', 'metaknyts-book-1', 'The first book of the metaKnyts saga', 'did:iq:creator2', 'metaknyts', 'metaKnyts', 'ongoing');

-- Sample smart content
INSERT INTO smart_content_qubes (id, app, title, slug, creator_root_did, tenant_id, status)
VALUES 
  ('00000000-0000-0000-0000-000000000010', 'Qriptopian', 'The Penny is Dead', 'the-penny-is-dead', 'did:iq:creator1', 'qriptopian', 'published'),
  ('00000000-0000-0000-0000-000000000011', 'metaKnyts', 'Episode 1: The Awakening', 'episode-1-awakening', 'did:iq:creator2', 'metaknyts', 'published');
*/

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================
