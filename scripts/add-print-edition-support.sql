-- ============================================================================
-- Add Print Edition Support for metaKnyts Comics
-- ============================================================================
-- 
-- Problem: Print comics have 3 different editions (Rare, Epic, Legendary) with
-- different pages, not just different covers. We need to store complete PDFs
-- for each edition type.
--
-- Solution: 
-- 1. Add 'episode_print' content type for print editions
-- 2. Add 'edition_tier' column to distinguish Rare/Epic/Legendary
-- 3. Keep motion comics using the existing cover-based model
--
-- Structure:
-- - Print Comics: 3 complete PDFs per episode (rare, epic, legendary)
-- - Motion Comics: 1 master video + multiple cover variants
-- ============================================================================

-- 1. Add new content type for print editions
DO $$ BEGIN
  -- Drop and recreate the enum with new value
  -- First check if 'episode_print' already exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'episode_print' 
    AND enumtypid = 'master_content_type'::regtype
  ) THEN
    ALTER TYPE master_content_type ADD VALUE 'episode_print';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Add edition_tier column to master_content_qubes
-- This distinguishes between Rare, Epic, and Legendary print editions
DO $$ BEGIN
  ALTER TABLE master_content_qubes 
    ADD COLUMN edition_tier VARCHAR(50);
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

-- Add comment explaining the column
COMMENT ON COLUMN master_content_qubes.edition_tier IS 
  'For episode_print content type: rare, epic, or legendary. NULL for episode_still and episode_motion.';

-- 3. Update the unique constraint to include edition_tier
-- Drop old constraint and create new one
DO $$ BEGIN
  ALTER TABLE master_content_qubes 
    DROP CONSTRAINT IF EXISTS master_content_qubes_episode_number_content_type_series_key;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Create new unique constraint that includes edition_tier
-- This allows: ep1_print_rare, ep1_print_epic, ep1_print_legendary, ep1_still, ep1_motion
CREATE UNIQUE INDEX IF NOT EXISTS idx_master_content_unique 
  ON master_content_qubes(episode_number, content_type, series, COALESCE(edition_tier, ''));

-- 4. Add index for edition_tier queries
CREATE INDEX IF NOT EXISTS idx_master_content_edition_tier 
  ON master_content_qubes(edition_tier) 
  WHERE edition_tier IS NOT NULL;

-- 5. Update the get_codex_status function to include print editions
-- Must drop first because return type is changing
DROP FUNCTION IF EXISTS get_codex_status(character varying);

CREATE OR REPLACE FUNCTION get_codex_status(p_series VARCHAR DEFAULT 'metaKnyts')
RETURNS TABLE (
  episode_number INTEGER,
  has_still_master BOOLEAN,
  has_motion_master BOOLEAN,
  has_print_rare BOOLEAN,
  has_print_epic BOOLEAN,
  has_print_legendary BOOLEAN,
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
  print_rare AS (
    SELECT episode_number, TRUE as has_rare
    FROM master_content_qubes
    WHERE series = p_series AND content_type = 'episode_print' AND edition_tier = 'rare'
  ),
  print_epic AS (
    SELECT episode_number, TRUE as has_epic
    FROM master_content_qubes
    WHERE series = p_series AND content_type = 'episode_print' AND edition_tier = 'epic'
  ),
  print_legendary AS (
    SELECT episode_number, TRUE as has_legendary
    FROM master_content_qubes
    WHERE series = p_series AND content_type = 'episode_print' AND edition_tier = 'legendary'
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
    COALESCE(pr.has_rare, FALSE) as has_print_rare,
    COALESCE(pe.has_epic, FALSE) as has_print_epic,
    COALESCE(pl.has_legendary, FALSE) as has_print_legendary,
    COALESCE(c.cnt, 0) as cover_count,
    COALESCE(ch.cnt, 0) as character_count,
    COALESCE(a.cnt, 0) as total_assets
  FROM episodes e
  LEFT JOIN still_masters sm ON e.ep = sm.episode_number
  LEFT JOIN motion_masters mm ON e.ep = mm.episode_number
  LEFT JOIN print_rare pr ON e.ep = pr.episode_number
  LEFT JOIN print_epic pe ON e.ep = pe.episode_number
  LEFT JOIN print_legendary pl ON e.ep = pl.episode_number
  LEFT JOIN covers c ON e.ep = c.episode_number
  LEFT JOIN characters ch ON e.ep = ch.episode_number
  LEFT JOIN all_assets a ON e.ep = a.episode_number
  ORDER BY e.ep;
END;
$$ LANGUAGE plpgsql;

-- 6. Update global stats function to include print editions
-- Must drop first because return type is changing
DROP FUNCTION IF EXISTS get_codex_global_stats(character varying);

CREATE OR REPLACE FUNCTION get_codex_global_stats(p_series VARCHAR DEFAULT 'metaKnyts')
RETURNS TABLE (
  total_still_masters BIGINT,
  total_motion_masters BIGINT,
  total_print_rare BIGINT,
  total_print_epic BIGINT,
  total_print_legendary BIGINT,
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
    (SELECT COUNT(*) FROM master_content_qubes WHERE series = p_series AND content_type = 'episode_print' AND edition_tier = 'rare'),
    (SELECT COUNT(*) FROM master_content_qubes WHERE series = p_series AND content_type = 'episode_print' AND edition_tier = 'epic'),
    (SELECT COUNT(*) FROM master_content_qubes WHERE series = p_series AND content_type = 'episode_print' AND edition_tier = 'legendary'),
    (SELECT COUNT(*) FROM codex_media_assets WHERE series = p_series AND asset_kind IN ('cover_pdf', 'cover_image')),
    (SELECT COUNT(*) FROM codex_media_assets WHERE series = p_series AND asset_kind = 'character_poster'),
    (SELECT COUNT(*) FROM codex_media_assets WHERE series = p_series AND asset_kind IN ('background_lore_doc', 'powers_sheet', 'twenty_one_sats_concept')),
    (SELECT COUNT(*) FROM codex_media_assets WHERE series = p_series AND asset_kind IN ('game_concept_doc', 'game_still', 'game_video')),
    (SELECT COUNT(*) FROM codex_media_assets WHERE series = p_series AND asset_kind IN ('social_campaign_video', 'social_campaign_image')),
    (SELECT COUNT(*) FROM codex_media_assets WHERE series = p_series);
END;
$$ LANGUAGE plpgsql;

-- 7. Create helper function to select print edition for minting
-- Returns the appropriate print edition based on rarity tier
CREATE OR REPLACE FUNCTION get_print_edition_for_mint(
  p_episode_number INTEGER,
  p_edition_tier VARCHAR,
  p_series VARCHAR DEFAULT 'metaKnyts'
)
RETURNS TABLE (
  master_id VARCHAR,
  title VARCHAR,
  cid TEXT,
  mime_type VARCHAR,
  edition_tier VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id as master_id,
    m.title,
    m.auto_drive_cid as cid,
    m.mime_type,
    m.edition_tier
  FROM master_content_qubes m
  WHERE m.episode_number = p_episode_number
    AND m.series = p_series
    AND m.content_type = 'episode_print'
    AND m.edition_tier = p_edition_tier
    AND m.status = 'active'
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Done! 
-- 
-- New content structure:
-- - episode_still: Single PDF master (legacy, for backward compatibility)
-- - episode_motion: Motion comic video (uses cover variants for minting)
-- - episode_print: Complete print edition PDF (rare, epic, or legendary)
--
-- Upload workflow for print comics:
-- 1. Upload 3 PDFs per episode: rare, epic, legendary
-- 2. Each is a complete comic with different pages
-- 3. Minting selects the appropriate edition based on rarity
--
-- Upload workflow for motion comics:
-- 1. Upload 1 motion comic video per episode
-- 2. Upload multiple cover variants (cover_pdf, cover_image)
-- 3. Minting randomly selects a cover variant
-- ============================================================================
