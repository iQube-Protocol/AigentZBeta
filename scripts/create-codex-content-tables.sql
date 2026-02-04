-- ============================================================================
-- KNYT Codex Content Tables + iQube Registry
-- ============================================================================
-- This migration creates tables for:
-- 1. iQube Registry (metaQubes, blakQubes, tokenQubes)
-- 2. Master Content Qubes (episode masters for mintable Scrolls)
-- 3. Codex Media Assets (characters, lore, game media, social assets, covers)
-- 4. Codex Cluster Qube (groups all content as "the Codex")
-- ============================================================================

-- ============================================================================
-- 1. iQube Registry Tables
-- ============================================================================

-- MetaQube: Public metadata for any iQube
CREATE TABLE IF NOT EXISTS iq_meta_qubes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE,
  qube_type VARCHAR(50) NOT NULL, -- 'content', 'media', 'cluster', 'cover', etc.
  series VARCHAR(100), -- e.g., 'metaKnyts', '21Sats'
  episode_number INTEGER,
  tags TEXT[], -- Array of tags for filtering
  description TEXT,
  preview_url TEXT, -- Public preview image/thumbnail
  metadata JSONB DEFAULT '{}', -- Additional flexible metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- BlakQube: Encrypted payload pointer
CREATE TABLE IF NOT EXISTS iq_blak_qubes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payload_pointer TEXT NOT NULL, -- CID from Autonomys/IPFS
  payload_type VARCHAR(100) NOT NULL, -- MIME type
  payload_provider VARCHAR(50) NOT NULL DEFAULT 'autonomys', -- 'autonomys', 'ipfs', 'payload-cms'
  payload_size BIGINT, -- Size in bytes
  encryption_alg VARCHAR(50) NOT NULL DEFAULT 'AES-256-GCM',
  encryption_iv TEXT NOT NULL, -- Base64 encoded IV
  encryption_auth_tag TEXT, -- Base64 encoded auth tag for GCM
  checksum TEXT, -- SHA-256 of original file
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TokenQube: Wrapped encryption key
CREATE TABLE IF NOT EXISTS iq_token_qubes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_ciphertext TEXT NOT NULL, -- Encrypted symmetric key
  key_wrapping_alg VARCHAR(50) NOT NULL DEFAULT 'AES-256-KW', -- Key wrapping algorithm
  wrapped_by VARCHAR(100), -- Identifier of master key used for wrapping
  key_type VARCHAR(50) DEFAULT 'AES-256', -- Type of the wrapped key
  access_policy JSONB DEFAULT '{}', -- Who can unwrap this key
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. Master Content Qubes (Episode Masters)
-- ============================================================================

-- Asset type enum for master content
DO $$ BEGIN
  CREATE TYPE master_content_type AS ENUM ('episode_still', 'episode_motion');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS master_content_qubes (
  id VARCHAR(100) PRIMARY KEY, -- e.g., 'mk_ep01_still', 'mk_ep01_motion'
  title VARCHAR(255) NOT NULL,
  episode_number INTEGER NOT NULL,
  content_type master_content_type NOT NULL,
  series VARCHAR(100) NOT NULL DEFAULT 'metaKnyts',
  
  -- Autonomys storage
  auto_drive_cid TEXT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size BIGINT,
  
  -- Encryption metadata
  encryption_alg VARCHAR(50) NOT NULL DEFAULT 'AES-256-GCM',
  encryption_iv TEXT NOT NULL,
  encryption_auth_tag TEXT,
  
  -- iQube references
  token_qube_id UUID REFERENCES iq_token_qubes(id),
  meta_qube_id UUID REFERENCES iq_meta_qubes(id),
  blak_qube_id UUID REFERENCES iq_blak_qubes(id),
  
  -- Status
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'archived', 'pending'
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(episode_number, content_type, series)
);

-- ============================================================================
-- 3. Codex Media Assets (Generic Assets)
-- ============================================================================

-- Asset kind enum
DO $$ BEGIN
  CREATE TYPE codex_asset_kind AS ENUM (
    'character_poster',
    'powers_sheet',
    'background_lore_doc',
    'game_concept_doc',
    'game_still',
    'game_video',
    'twenty_one_sats_concept',
    'social_campaign_video',
    'social_campaign_image',
    'cover_pdf',
    'cover_image'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS codex_media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  episode_number INTEGER, -- Nullable, only if tied to specific episode
  asset_kind codex_asset_kind NOT NULL,
  series VARCHAR(100) DEFAULT 'metaKnyts',
  
  -- Autonomys storage
  auto_drive_cid TEXT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size BIGINT,
  
  -- Encryption metadata
  encryption_alg VARCHAR(50) NOT NULL DEFAULT 'AES-256-GCM',
  encryption_iv TEXT NOT NULL,
  encryption_auth_tag TEXT,
  
  -- iQube references
  token_qube_id UUID REFERENCES iq_token_qubes(id),
  meta_qube_id UUID REFERENCES iq_meta_qubes(id),
  blak_qube_id UUID REFERENCES iq_blak_qubes(id),
  
  -- Social/sharing flags
  is_shareable BOOLEAN DEFAULT FALSE,
  recommended_task VARCHAR(100), -- e.g., 'post_to_social'
  
  -- Cover-specific fields (for cover_pdf, cover_image)
  variant_name VARCHAR(100),
  rarity_tier VARCHAR(50), -- 'legendary', 'rare', 'common'
  edition_max INTEGER,
  edition_minted INTEGER DEFAULT 0,
  random_weight INTEGER DEFAULT 1, -- Weight for random selection (higher = more likely)
  
  -- Status
  status VARCHAR(50) DEFAULT 'active',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 4. Codex Cluster Qube (Groups all content)
-- ============================================================================

CREATE TABLE IF NOT EXISTS codex_cluster_qubes (
  id VARCHAR(100) PRIMARY KEY, -- e.g., 'metaKnyts_codex_cluster'
  name VARCHAR(255) NOT NULL,
  description TEXT,
  series VARCHAR(100) NOT NULL,
  
  -- iQube reference
  meta_qube_id UUID REFERENCES iq_meta_qubes(id),
  
  -- Aggregated stats (updated periodically)
  total_episodes INTEGER DEFAULT 0,
  total_still_masters INTEGER DEFAULT 0,
  total_motion_masters INTEGER DEFAULT 0,
  total_covers INTEGER DEFAULT 0,
  total_media_assets INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mapping table for cluster children
CREATE TABLE IF NOT EXISTS codex_cluster_children (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id VARCHAR(100) REFERENCES codex_cluster_qubes(id) ON DELETE CASCADE,
  child_type VARCHAR(50) NOT NULL, -- 'master_content', 'media_asset'
  child_id TEXT NOT NULL, -- ID of the child (master_content_qubes.id or codex_media_assets.id)
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(cluster_id, child_type, child_id)
);

-- ============================================================================
-- 5. User Issue Qubes (Placeholder for mint flow)
-- ============================================================================

-- Custody mode enum for Phase 1 (custodial) and Phase 2 (canonical)
DO $$ BEGIN
  CREATE TYPE custody_mode_type AS ENUM ('custodial', 'canonical');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS user_issue_qubes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id TEXT NOT NULL, -- User/persona/Root DID
  owner_type VARCHAR(50) DEFAULT 'persona', -- 'persona', 'did', 'wallet'
  
  episode_number INTEGER NOT NULL,
  master_content_id VARCHAR(100) REFERENCES master_content_qubes(id),
  cover_variant_id UUID REFERENCES codex_media_assets(id),
  
  edition_serial INTEGER NOT NULL, -- e.g., 3 of 21
  edition_total INTEGER, -- Total in this edition run (nullable for unlimited)
  
  -- Purchase info
  price_paid_knyt DECIMAL(18, 8),
  price_paid_qct DECIMAL(18, 8),
  transaction_hash TEXT,
  
  -- Custody mode: Phase 1 = custodial only, Phase 2 = canonical option
  custody_mode custody_mode_type DEFAULT 'custodial',
  canonical_bundle_id UUID, -- FK added after canonical_bundles table created
  
  -- Status
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'revoked', 'transferred'
  
  minted_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 5b. Canonical Bundles (Phase 2 - Self-Custody Support)
-- ============================================================================
-- This table stores exportable bundles for canonical mints
-- Phase 1: Table exists but is not populated
-- Phase 2: Populated when custody_mode = 'canonical'

CREATE TABLE IF NOT EXISTS canonical_bundles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES user_issue_qubes(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL,
  episode_number INTEGER NOT NULL,
  
  -- Content reference (from master_content_qubes)
  cid TEXT NOT NULL,                    -- Autonomys CID for encrypted master payload
  mime_type VARCHAR(100) NOT NULL,
  
  -- Key wrapping (Phase 2: per-issue wrapped key)
  wrapped_key TEXT,                     -- Base64 - symmetric key wrapped with user's public key
  encryption_alg VARCHAR(50) NOT NULL,  -- e.g., 'AES-256-GCM'
  key_wrap_alg VARCHAR(100),            -- e.g., 'X25519-XSalsa20-Poly1305'
  
  -- iQube references
  meta_qube_id UUID REFERENCES iq_meta_qubes(id),
  blak_qube_id UUID REFERENCES iq_blak_qubes(id),
  user_token_qube_id UUID,              -- Reference to user-specific tokenQube (Phase 2)
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(issue_id)
);

-- Add FK constraint now that canonical_bundles exists (skip if already exists)
DO $$ BEGIN
  ALTER TABLE user_issue_qubes 
    ADD CONSTRAINT fk_canonical_bundle 
    FOREIGN KEY (canonical_bundle_id) 
    REFERENCES canonical_bundles(id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 5c. Digital Episode Pricing
-- ============================================================================

CREATE TABLE IF NOT EXISTS digital_episode_pricing (
  episode_number INTEGER PRIMARY KEY,
  series VARCHAR(100) DEFAULT 'metaKnyts',
  
  -- Pricing
  price_knyt DECIMAL(18, 8) NOT NULL,
  price_canonical_knyt DECIMAL(18, 8), -- Premium price for canonical mints (Phase 2)
  currency VARCHAR(10) DEFAULT 'KNYT',
  
  -- Availability
  is_active BOOLEAN DEFAULT TRUE,
  available_from TIMESTAMPTZ,
  available_until TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 6. Indexes for Performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_meta_qubes_series ON iq_meta_qubes(series);
CREATE INDEX IF NOT EXISTS idx_meta_qubes_type ON iq_meta_qubes(qube_type);
CREATE INDEX IF NOT EXISTS idx_meta_qubes_tags ON iq_meta_qubes USING GIN(tags);

CREATE INDEX IF NOT EXISTS idx_master_content_episode ON master_content_qubes(episode_number);
CREATE INDEX IF NOT EXISTS idx_master_content_series ON master_content_qubes(series);
CREATE INDEX IF NOT EXISTS idx_master_content_type ON master_content_qubes(content_type);

CREATE INDEX IF NOT EXISTS idx_media_assets_kind ON codex_media_assets(asset_kind);
CREATE INDEX IF NOT EXISTS idx_media_assets_episode ON codex_media_assets(episode_number);
CREATE INDEX IF NOT EXISTS idx_media_assets_series ON codex_media_assets(series);
CREATE INDEX IF NOT EXISTS idx_media_assets_shareable ON codex_media_assets(is_shareable) WHERE is_shareable = TRUE;

CREATE INDEX IF NOT EXISTS idx_user_issues_owner ON user_issue_qubes(owner_id);
CREATE INDEX IF NOT EXISTS idx_user_issues_episode ON user_issue_qubes(episode_number);
CREATE INDEX IF NOT EXISTS idx_user_issues_master ON user_issue_qubes(master_content_id);
CREATE INDEX IF NOT EXISTS idx_user_issues_custody ON user_issue_qubes(custody_mode);
CREATE INDEX IF NOT EXISTS idx_user_issues_cover ON user_issue_qubes(cover_variant_id);

CREATE INDEX IF NOT EXISTS idx_canonical_bundles_owner ON canonical_bundles(owner_id);
CREATE INDEX IF NOT EXISTS idx_canonical_bundles_episode ON canonical_bundles(episode_number);

CREATE INDEX IF NOT EXISTS idx_pricing_active ON digital_episode_pricing(is_active) WHERE is_active = TRUE;

-- Index for cover selection query (available covers with edition capacity)
CREATE INDEX IF NOT EXISTS idx_media_assets_covers ON codex_media_assets(episode_number, asset_kind) 
  WHERE asset_kind IN ('cover_pdf', 'cover_image');

-- ============================================================================
-- 7. Helper Functions
-- ============================================================================

-- Function to get codex status overview
CREATE OR REPLACE FUNCTION get_codex_status(p_series VARCHAR DEFAULT 'metaKnyts')
RETURNS TABLE (
  episode_number INTEGER,
  has_still_master BOOLEAN,
  has_motion_master BOOLEAN,
  cover_count BIGINT,
  character_count BIGINT,
  total_assets BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH episodes AS (
    SELECT DISTINCT episode_number AS ep
    FROM master_content_qubes
    WHERE series = p_series
    UNION
    SELECT DISTINCT episode_number AS ep
    FROM codex_media_assets
    WHERE series = p_series AND episode_number IS NOT NULL
  ),
  still_masters AS (
    SELECT episode_number, TRUE as has_still
    FROM master_content_qubes
    WHERE series = p_series AND content_type = 'episode_still'
  ),
  motion_masters AS (
    SELECT episode_number, TRUE as has_motion
    FROM master_content_qubes
    WHERE series = p_series AND content_type = 'episode_motion'
  ),
  covers AS (
    SELECT episode_number, COUNT(*) as cnt
    FROM codex_media_assets
    WHERE series = p_series AND asset_kind IN ('cover_pdf', 'cover_image')
    GROUP BY episode_number
  ),
  characters AS (
    SELECT episode_number, COUNT(*) as cnt
    FROM codex_media_assets
    WHERE series = p_series AND asset_kind = 'character_poster'
    GROUP BY episode_number
  ),
  all_assets AS (
    SELECT episode_number, COUNT(*) as cnt
    FROM codex_media_assets
    WHERE series = p_series
    GROUP BY episode_number
  )
  SELECT 
    e.ep as episode_number,
    COALESCE(sm.has_still, FALSE) as has_still_master,
    COALESCE(mm.has_motion, FALSE) as has_motion_master,
    COALESCE(c.cnt, 0) as cover_count,
    COALESCE(ch.cnt, 0) as character_count,
    COALESCE(a.cnt, 0) as total_assets
  FROM episodes e
  LEFT JOIN still_masters sm ON e.ep = sm.episode_number
  LEFT JOIN motion_masters mm ON e.ep = mm.episode_number
  LEFT JOIN covers c ON e.ep = c.episode_number
  LEFT JOIN characters ch ON e.ep = ch.episode_number
  LEFT JOIN all_assets a ON e.ep = a.episode_number
  ORDER BY e.ep;
END;
$$ LANGUAGE plpgsql;

-- Function to get global codex stats
CREATE OR REPLACE FUNCTION get_codex_global_stats(p_series VARCHAR DEFAULT 'metaKnyts')
RETURNS TABLE (
  total_still_masters BIGINT,
  total_motion_masters BIGINT,
  total_covers BIGINT,
  total_characters BIGINT,
  total_lore_docs BIGINT,
  total_game_assets BIGINT,
  total_social_assets BIGINT,
  total_all_assets BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM master_content_qubes WHERE series = p_series AND content_type = 'episode_still'),
    (SELECT COUNT(*) FROM master_content_qubes WHERE series = p_series AND content_type = 'episode_motion'),
    (SELECT COUNT(*) FROM codex_media_assets WHERE series = p_series AND asset_kind IN ('cover_pdf', 'cover_image')),
    (SELECT COUNT(*) FROM codex_media_assets WHERE series = p_series AND asset_kind = 'character_poster'),
    (SELECT COUNT(*) FROM codex_media_assets WHERE series = p_series AND asset_kind IN ('background_lore_doc', 'powers_sheet', 'twenty_one_sats_concept')),
    (SELECT COUNT(*) FROM codex_media_assets WHERE series = p_series AND asset_kind IN ('game_concept_doc', 'game_still', 'game_video')),
    (SELECT COUNT(*) FROM codex_media_assets WHERE series = p_series AND asset_kind IN ('social_campaign_video', 'social_campaign_image')),
    (SELECT COUNT(*) FROM codex_media_assets WHERE series = p_series);
END;
$$ LANGUAGE plpgsql;

-- Function to atomically select and claim a cover for minting
-- Returns the cover asset ID and edition serial, or NULL if no covers available
CREATE OR REPLACE FUNCTION select_and_claim_cover(
  p_episode_number INTEGER,
  p_series VARCHAR DEFAULT 'metaKnyts'
)
RETURNS TABLE (
  asset_id UUID,
  edition_serial INTEGER,
  variant_name VARCHAR,
  rarity_tier VARCHAR,
  edition_max INTEGER
) AS $$
DECLARE
  v_selected_id UUID;
  v_new_edition INTEGER;
  v_variant VARCHAR;
  v_rarity VARCHAR;
  v_max INTEGER;
BEGIN
  -- Select a random available cover with weighted selection
  -- Uses UPDATE ... RETURNING for atomicity
  WITH available_covers AS (
    SELECT 
      id,
      variant_name as vname,
      rarity_tier as rarity,
      edition_max as emax,
      random_weight,
      -- Generate a random score weighted by random_weight
      random() * random_weight as weighted_score
    FROM codex_media_assets
    WHERE episode_number = p_episode_number
      AND series = p_series
      AND asset_kind IN ('cover_pdf', 'cover_image')
      AND (edition_max IS NULL OR edition_minted < edition_max)
      AND status = 'active'
    ORDER BY weighted_score DESC
    LIMIT 1
  )
  UPDATE codex_media_assets c
  SET edition_minted = edition_minted + 1,
      updated_at = NOW()
  FROM available_covers ac
  WHERE c.id = ac.id
  RETURNING c.id, c.edition_minted, ac.vname, ac.rarity, ac.emax
  INTO v_selected_id, v_new_edition, v_variant, v_rarity, v_max;
  
  IF v_selected_id IS NULL THEN
    RETURN; -- No covers available
  END IF;
  
  RETURN QUERY SELECT v_selected_id, v_new_edition, v_variant, v_rarity, v_max;
END;
$$ LANGUAGE plpgsql;

-- Function to get user's owned issues for an episode
CREATE OR REPLACE FUNCTION get_user_issues_for_episode(
  p_owner_id TEXT,
  p_episode_number INTEGER
)
RETURNS TABLE (
  issue_id UUID,
  master_content_id VARCHAR,
  cover_asset_id UUID,
  edition_serial INTEGER,
  edition_total INTEGER,
  custody_mode custody_mode_type,
  minted_at TIMESTAMPTZ,
  cover_title VARCHAR,
  cover_rarity VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id as issue_id,
    u.master_content_id,
    u.cover_variant_id as cover_asset_id,
    u.edition_serial,
    u.edition_total,
    u.custody_mode,
    u.minted_at,
    c.title as cover_title,
    c.rarity_tier as cover_rarity
  FROM user_issue_qubes u
  LEFT JOIN codex_media_assets c ON u.cover_variant_id = c.id
  WHERE u.owner_id = p_owner_id
    AND u.episode_number = p_episode_number
    AND u.status = 'active'
  ORDER BY u.minted_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to update cluster stats
CREATE OR REPLACE FUNCTION update_cluster_stats(p_cluster_id VARCHAR)
RETURNS VOID AS $$
BEGIN
  UPDATE codex_cluster_qubes
  SET 
    total_episodes = (
      SELECT COUNT(DISTINCT episode_number) 
      FROM master_content_qubes 
      WHERE series = (SELECT series FROM codex_cluster_qubes WHERE id = p_cluster_id)
    ),
    total_still_masters = (
      SELECT COUNT(*) 
      FROM master_content_qubes 
      WHERE series = (SELECT series FROM codex_cluster_qubes WHERE id = p_cluster_id)
        AND content_type = 'episode_still'
    ),
    total_motion_masters = (
      SELECT COUNT(*) 
      FROM master_content_qubes 
      WHERE series = (SELECT series FROM codex_cluster_qubes WHERE id = p_cluster_id)
        AND content_type = 'episode_motion'
    ),
    total_covers = (
      SELECT COUNT(*) 
      FROM codex_media_assets 
      WHERE series = (SELECT series FROM codex_cluster_qubes WHERE id = p_cluster_id)
        AND asset_kind IN ('cover_pdf', 'cover_image')
    ),
    total_media_assets = (
      SELECT COUNT(*) 
      FROM codex_media_assets 
      WHERE series = (SELECT series FROM codex_cluster_qubes WHERE id = p_cluster_id)
    ),
    updated_at = NOW()
  WHERE id = p_cluster_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 8. Initial Data: Create metaKnyts Codex Cluster
-- ============================================================================

-- Create the metaKnyts Codex Cluster metaQube
INSERT INTO iq_meta_qubes (id, name, slug, qube_type, series, tags, description)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'metaKnyts Codex',
  'metaknyts-codex',
  'cluster',
  'metaKnyts',
  ARRAY['codex', 'metaknyts', 'knyt', 'scrolls'],
  'The complete metaKnyts Codex containing all episodes, characters, lore, and media assets'
) ON CONFLICT (slug) DO NOTHING;

-- Create the cluster entry
INSERT INTO codex_cluster_qubes (id, name, description, series, meta_qube_id)
VALUES (
  'metaKnyts_codex_cluster',
  'metaKnyts Codex',
  'The complete metaKnyts Codex - 13 episodes as digital Scrolls with motion comics, character posters, lore documents, game concepts, and social media assets',
  'metaKnyts',
  'a0000000-0000-0000-0000-000000000001'
) ON CONFLICT (id) DO UPDATE SET
  description = EXCLUDED.description,
  updated_at = NOW();

-- ============================================================================
-- Done!
-- ============================================================================
