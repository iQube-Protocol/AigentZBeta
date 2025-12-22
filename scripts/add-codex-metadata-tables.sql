-- ============================================================================
-- metaKnyts Codex Metadata Tables
-- ============================================================================
-- 
-- Four collections matching the JSON export:
-- 1. codex_characters - Character profiles
-- 2. codex_knyt_cards - KNYT card data per character
-- 3. codex_episodes - Episode metadata
-- 4. codex_episode_credits - Production credits per episode
--
-- IMPORTANT: Episode numbering convention:
-- - issue_number uses documentation format (#0, #1, #2...)
-- - Database episode_number is derived: #0 = 1, #1 = 2, etc.
-- ============================================================================

-- 1. Characters table
CREATE TABLE IF NOT EXISTS codex_characters (
  id VARCHAR(100) PRIMARY KEY,              -- slug e.g. "manuel_baptiste"
  digiterra_name VARCHAR(255),              -- e.g. "2Sun", "KnowOne / Kn0w1"
  terra_name VARCHAR(255),                  -- e.g. "Manuel Baptiste"
  profile TEXT,                             -- Terran Profile
  affiliation VARCHAR(255),                 -- e.g. "Cyphapunk", "Fang"
  height VARCHAR(50),                       -- e.g. "6'6""
  weight VARCHAR(50),                       -- e.g. "200lbs"
  origin_ethnicity VARCHAR(255),            -- Origin/Ethnicity
  base VARCHAR(255),                        -- Base location
  
  -- Metadata
  series VARCHAR(100) NOT NULL DEFAULT 'metaKnyts',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. KNYT Cards table
CREATE TABLE IF NOT EXISTS codex_knyt_cards (
  id VARCHAR(100) PRIMARY KEY,              -- e.g. "manuel_baptiste_card"
  character_id VARCHAR(100) REFERENCES codex_characters(id),
  
  powers TEXT,                              -- Powers description
  primary_weapon TEXT,                      -- Primary Weapon
  secondary_weapons TEXT,                   -- Secondary Weapons
  first_appearance VARCHAR(255),            -- e.g. "E0.0 #0 Gen Zero Divided by 1"
  
  -- Metadata
  series VARCHAR(100) NOT NULL DEFAULT 'metaKnyts',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Episodes table
CREATE TABLE IF NOT EXISTS codex_episodes (
  id VARCHAR(100) PRIMARY KEY,              -- e.g. "ep_0_0_0", "ep_1_10_12"
  
  -- Episode identification
  season_number VARCHAR(20),                -- e.g. "0.0", "1.3"
  issue_number VARCHAR(20),                 -- e.g. "#0", "#5" (documentation format)
  episode_number_raw VARCHAR(50),           -- e.g. "1.3 #5"
  episode_number INTEGER,                   -- Database number: #0=1, #1=2, etc.
  
  -- Content
  title VARCHAR(255) NOT NULL,              -- Episode Title
  knytcard_focus VARCHAR(100),              -- Character focus e.g. "Deji"
  synopsis TEXT,                            -- Episode synopsis
  intro_quote TEXT,                         -- Opening quote
  editorial_note TEXT,                      -- Krypto Mail Editorial
  end_quote TEXT,                           -- Closing quote
  
  -- References
  cover_ref VARCHAR(255),                   -- e.g. "E0.1 Cover"
  distribution_channel VARCHAR(255),        -- e.g. "Metaiye Knights App"
  additional_writers TEXT,
  
  -- Production (basic)
  artist VARCHAR(255),
  colorist VARCHAR(255),
  letterer VARCHAR(255),
  
  -- Metadata
  series VARCHAR(100) NOT NULL DEFAULT 'metaKnyts',
  is_current BOOLEAN NOT NULL DEFAULT true,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Episode Credits table
CREATE TABLE IF NOT EXISTS codex_episode_credits (
  id VARCHAR(100) PRIMARY KEY,              -- e.g. "ep_0_0_0_credits"
  episode_id VARCHAR(100) REFERENCES codex_episodes(id),
  
  -- Runtime
  length_raw VARCHAR(50),                   -- e.g. "6.13", "28.5"
  broadcast VARCHAR(100),                   -- e.g. "1 / 6.13", "9 / 28.5"
  
  -- Full creative team
  creators VARCHAR(255),                    -- e.g. "Dele Atanda"
  writers TEXT,                             -- Writers
  artists TEXT,                             -- Panel artists
  colorists TEXT,
  letterers TEXT,
  copy_editing VARCHAR(255),
  graphics_and_digital_edits VARCHAR(255),
  animation VARCHAR(255),
  
  -- Metadata
  series VARCHAR(100) NOT NULL DEFAULT 'metaKnyts',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_codex_characters_series ON codex_characters(series);
CREATE INDEX IF NOT EXISTS idx_codex_characters_affiliation ON codex_characters(affiliation);

CREATE INDEX IF NOT EXISTS idx_codex_knyt_cards_character ON codex_knyt_cards(character_id);
CREATE INDEX IF NOT EXISTS idx_codex_knyt_cards_series ON codex_knyt_cards(series);

CREATE INDEX IF NOT EXISTS idx_codex_episodes_series ON codex_episodes(series);
CREATE INDEX IF NOT EXISTS idx_codex_episodes_number ON codex_episodes(episode_number);
CREATE INDEX IF NOT EXISTS idx_codex_episodes_issue ON codex_episodes(issue_number);

CREATE INDEX IF NOT EXISTS idx_codex_episode_credits_episode ON codex_episode_credits(episode_id);

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Parse issue number to database episode number (#0 -> 1, #1 -> 2, etc.)
CREATE OR REPLACE FUNCTION parse_issue_to_episode_number(p_issue VARCHAR)
RETURNS INTEGER AS $$
BEGIN
  -- Extract number from "#0", "#1", etc. and add 1
  RETURN COALESCE(
    (regexp_match(p_issue, '#(\d+)'))[1]::INTEGER + 1,
    NULL
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Get episode with all related data
CREATE OR REPLACE FUNCTION get_codex_episode_full(
  p_episode_id VARCHAR
)
RETURNS TABLE (
  episode JSONB,
  credits JSONB,
  focus_character JSONB,
  focus_knyt_card JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    to_jsonb(e.*) AS episode,
    to_jsonb(ec.*) AS credits,
    to_jsonb(c.*) AS focus_character,
    to_jsonb(kc.*) AS focus_knyt_card
  FROM codex_episodes e
  LEFT JOIN codex_episode_credits ec ON ec.episode_id = e.id
  LEFT JOIN codex_characters c ON LOWER(c.digiterra_name) LIKE '%' || LOWER(e.knytcard_focus) || '%'
    OR LOWER(c.terra_name) LIKE '%' || LOWER(e.knytcard_focus) || '%'
  LEFT JOIN codex_knyt_cards kc ON kc.character_id = c.id
  WHERE e.id = p_episode_id;
END;
$$ LANGUAGE plpgsql;

-- Get all episodes with basic info for listing
CREATE OR REPLACE FUNCTION get_codex_episodes_list(
  p_series VARCHAR DEFAULT 'metaKnyts'
)
RETURNS TABLE (
  id VARCHAR,
  episode_number INTEGER,
  issue_number VARCHAR,
  season_number VARCHAR,
  title VARCHAR,
  knytcard_focus VARCHAR,
  synopsis TEXT,
  cover_ref VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.episode_number,
    e.issue_number,
    e.season_number,
    e.title,
    e.knytcard_focus,
    e.synopsis,
    e.cover_ref
  FROM codex_episodes e
  WHERE e.series = p_series
    AND e.is_current = true
  ORDER BY e.episode_number;
END;
$$ LANGUAGE plpgsql;

-- Get character with their KNYT card
CREATE OR REPLACE FUNCTION get_codex_character_full(
  p_character_id VARCHAR
)
RETURNS TABLE (
  character_data JSONB,
  knyt_card JSONB,
  episode_appearances JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    to_jsonb(c.*) AS character_data,
    to_jsonb(kc.*) AS knyt_card,
    COALESCE(
      jsonb_agg(DISTINCT jsonb_build_object(
        'id', e.id,
        'title', e.title,
        'issue_number', e.issue_number
      )) FILTER (WHERE e.id IS NOT NULL),
      '[]'::jsonb
    ) AS episode_appearances
  FROM codex_characters c
  LEFT JOIN codex_knyt_cards kc ON kc.character_id = c.id
  LEFT JOIN codex_episodes e ON 
    LOWER(e.knytcard_focus) LIKE '%' || LOWER(SPLIT_PART(c.digiterra_name, ' ', 1)) || '%'
    OR LOWER(e.knytcard_focus) LIKE '%' || LOWER(SPLIT_PART(c.terra_name, ' ', 1)) || '%'
  WHERE c.id = p_character_id
  GROUP BY c.id, kc.id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE codex_characters IS 'Character profiles for metaKnyts universe';
COMMENT ON TABLE codex_knyt_cards IS 'KNYT card data - powers, weapons, first appearance';
COMMENT ON TABLE codex_episodes IS 'Episode metadata - title, synopsis, quotes, production';
COMMENT ON TABLE codex_episode_credits IS 'Full production credits per episode';

COMMENT ON COLUMN codex_episodes.issue_number IS 'Documentation format (#0, #1). Episode #0 is the first episode.';
COMMENT ON COLUMN codex_episodes.episode_number IS 'Database format (1, 2, 3). Derived from issue_number + 1.';

-- ============================================================================
-- Done! Run the import API to populate these tables from JSON.
-- ============================================================================
