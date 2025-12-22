-- ============================================================================
-- Episode Metadata Support for metaKnyts Codex
-- ============================================================================
-- 
-- This adds a table for rich episode metadata that can be:
-- 1. Uploaded via JSON file
-- 2. Updated over time (versioned)
-- 3. Used by the copilot to display correct titles, characters, etc.
-- 
-- IMPORTANT: Episode numbering convention:
-- - Database uses 1-indexed (episode_number = 1, 2, 3...)
-- - Documentation uses 0-indexed ("Episode #0", "Episode #1"...)
-- - display_number field stores the documentation number
-- ============================================================================

-- 1. Create episode_metadata table
CREATE TABLE IF NOT EXISTS episode_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Episode identification
  episode_number INTEGER NOT NULL,           -- Database index (1-based)
  display_number VARCHAR(20),                -- Documentation number (e.g., "#0", "#1")
  series VARCHAR(100) NOT NULL DEFAULT 'metaKnyts',
  
  -- Core metadata
  title VARCHAR(255) NOT NULL,               -- Episode title
  subtitle VARCHAR(255),                     -- Optional subtitle
  synopsis TEXT,                             -- Episode summary/description
  release_date DATE,                         -- Original release date
  
  -- Characters (JSONB for flexibility)
  main_characters JSONB DEFAULT '[]',        -- [{name, role, description}]
  supporting_characters JSONB DEFAULT '[]',  -- [{name, role, description}]
  
  -- Story elements
  themes JSONB DEFAULT '[]',                 -- ["theme1", "theme2"]
  locations JSONB DEFAULT '[]',              -- [{name, description}]
  key_events JSONB DEFAULT '[]',             -- [{event, significance}]
  
  -- Production metadata
  writer VARCHAR(255),
  artist VARCHAR(255),
  colorist VARCHAR(255),
  letterer VARCHAR(255),
  editor VARCHAR(255),
  
  -- Additional metadata (flexible)
  extra_metadata JSONB DEFAULT '{}',
  
  -- Versioning
  version INTEGER NOT NULL DEFAULT 1,
  is_current BOOLEAN NOT NULL DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure only one current version per episode
  CONSTRAINT unique_current_episode UNIQUE (episode_number, series, is_current) 
    DEFERRABLE INITIALLY DEFERRED
);

-- 2. Create indexes
CREATE INDEX IF NOT EXISTS idx_episode_metadata_episode 
  ON episode_metadata(episode_number, series);
  
CREATE INDEX IF NOT EXISTS idx_episode_metadata_current 
  ON episode_metadata(episode_number, series) 
  WHERE is_current = true;

CREATE INDEX IF NOT EXISTS idx_episode_metadata_characters 
  ON episode_metadata USING GIN (main_characters);

-- 3. Function to get current episode metadata
CREATE OR REPLACE FUNCTION get_episode_metadata(
  p_episode_number INTEGER,
  p_series VARCHAR DEFAULT 'metaKnyts'
)
RETURNS TABLE (
  id UUID,
  episode_number INTEGER,
  display_number VARCHAR(20),
  title VARCHAR(255),
  subtitle VARCHAR(255),
  synopsis TEXT,
  release_date DATE,
  main_characters JSONB,
  supporting_characters JSONB,
  themes JSONB,
  locations JSONB,
  key_events JSONB,
  writer VARCHAR(255),
  artist VARCHAR(255),
  extra_metadata JSONB,
  version INTEGER,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    em.id,
    em.episode_number,
    em.display_number,
    em.title,
    em.subtitle,
    em.synopsis,
    em.release_date,
    em.main_characters,
    em.supporting_characters,
    em.themes,
    em.locations,
    em.key_events,
    em.writer,
    em.artist,
    em.extra_metadata,
    em.version,
    em.updated_at
  FROM episode_metadata em
  WHERE em.episode_number = p_episode_number
    AND em.series = p_series
    AND em.is_current = true;
END;
$$ LANGUAGE plpgsql;

-- 4. Function to get all current episode metadata for a series
CREATE OR REPLACE FUNCTION get_all_episode_metadata(
  p_series VARCHAR DEFAULT 'metaKnyts'
)
RETURNS TABLE (
  episode_number INTEGER,
  display_number VARCHAR(20),
  title VARCHAR(255),
  subtitle VARCHAR(255),
  synopsis TEXT,
  main_characters JSONB,
  themes JSONB,
  version INTEGER,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    em.episode_number,
    em.display_number,
    em.title,
    em.subtitle,
    em.synopsis,
    em.main_characters,
    em.themes,
    em.version,
    em.updated_at
  FROM episode_metadata em
  WHERE em.series = p_series
    AND em.is_current = true
  ORDER BY em.episode_number;
END;
$$ LANGUAGE plpgsql;

-- 5. Function to upsert episode metadata (creates new version if exists)
CREATE OR REPLACE FUNCTION upsert_episode_metadata(
  p_episode_number INTEGER,
  p_series VARCHAR,
  p_title VARCHAR,
  p_display_number VARCHAR DEFAULT NULL,
  p_subtitle VARCHAR DEFAULT NULL,
  p_synopsis TEXT DEFAULT NULL,
  p_release_date DATE DEFAULT NULL,
  p_main_characters JSONB DEFAULT '[]',
  p_supporting_characters JSONB DEFAULT '[]',
  p_themes JSONB DEFAULT '[]',
  p_locations JSONB DEFAULT '[]',
  p_key_events JSONB DEFAULT '[]',
  p_writer VARCHAR DEFAULT NULL,
  p_artist VARCHAR DEFAULT NULL,
  p_colorist VARCHAR DEFAULT NULL,
  p_letterer VARCHAR DEFAULT NULL,
  p_editor VARCHAR DEFAULT NULL,
  p_extra_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  v_existing_version INTEGER;
  v_new_id UUID;
BEGIN
  -- Get current version number
  SELECT version INTO v_existing_version
  FROM episode_metadata
  WHERE episode_number = p_episode_number
    AND series = p_series
    AND is_current = true;
  
  -- Mark existing as not current
  UPDATE episode_metadata
  SET is_current = false, updated_at = NOW()
  WHERE episode_number = p_episode_number
    AND series = p_series
    AND is_current = true;
  
  -- Insert new version
  INSERT INTO episode_metadata (
    episode_number, series, display_number, title, subtitle, synopsis,
    release_date, main_characters, supporting_characters, themes,
    locations, key_events, writer, artist, colorist, letterer, editor,
    extra_metadata, version, is_current
  ) VALUES (
    p_episode_number, p_series, 
    COALESCE(p_display_number, '#' || (p_episode_number - 1)::TEXT),
    p_title, p_subtitle, p_synopsis,
    p_release_date, p_main_characters, p_supporting_characters, p_themes,
    p_locations, p_key_events, p_writer, p_artist, p_colorist, p_letterer, p_editor,
    p_extra_metadata, COALESCE(v_existing_version, 0) + 1, true
  )
  RETURNING id INTO v_new_id;
  
  RETURN v_new_id;
END;
$$ LANGUAGE plpgsql;

-- 6. Add comments
COMMENT ON TABLE episode_metadata IS 'Rich metadata for each episode including title, characters, themes, and production credits. Versioned for updates.';
COMMENT ON COLUMN episode_metadata.episode_number IS 'Database index (1-based). Episode 1 = Episode #0 in documentation.';
COMMENT ON COLUMN episode_metadata.display_number IS 'Documentation number (e.g., #0, #1). Auto-generated as episode_number - 1 if not provided.';
COMMENT ON COLUMN episode_metadata.main_characters IS 'JSON array of main characters: [{name, role, description, powers}]';
COMMENT ON COLUMN episode_metadata.is_current IS 'Only one version per episode can be current. Old versions kept for history.';

-- ============================================================================
-- Done!
-- 
-- Usage:
-- 1. Upload JSON with episode metadata via API
-- 2. Copilot queries get_episode_metadata(episode_number) for display
-- 3. Updates create new versions, old versions preserved
-- 4. Episode #0 in docs = episode_number 1 in database
-- ============================================================================
