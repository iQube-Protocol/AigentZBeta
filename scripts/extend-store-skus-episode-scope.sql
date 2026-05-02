-- =============================================================================
-- Extend store_skus with per-episode scoping + add public episode bundles +
-- single-asset SKU templates so the catalog is complete.
--
-- New column: episode_numbers INT[] — DB-convention episode numbers (0 = GN,
-- 1 = ep#0, 2 = ep#1, …, 13 = ep#12). When NULL, the category grant covers
-- ALL episodes (current behaviour). When set, restricts the grant to those
-- specific episodes only.
--
-- Run once in the Supabase SQL editor.
-- =============================================================================

ALTER TABLE store_skus
  ADD COLUMN IF NOT EXISTS episode_numbers INT[] DEFAULT NULL;

COMMENT ON COLUMN store_skus.episode_numbers IS
  'DB-convention episode numbers this SKU grants. NULL = all episodes (default for category-wide grants like investor bundles). Used to scope partial bundles like bundle-0-2.';

-- ─────────────────────────────────────────────────────────────────────────────
-- Public episode bundles (retail). Episode_numbers in DB convention:
--   bundle-0-2  → pricing eps 0,1,2  → DB 1,2,3
--   bundle-3-7  → pricing eps 3..7   → DB 4..8
--   bundle-8-12 → pricing eps 8..12  → DB 9..13
--   bundle-full → all episodes incl. GN → DB 0..13 (or NULL — same effect)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO store_skus (sku_id, name, description,
  grants_episodes_still, grants_episodes_motion, grants_episodes_print,
  grants_character_cards, grants_gn, episode_numbers) VALUES
  ('bundle-0-2',   'Episodes 0–2',           'Public still bundle: episodes 0,1,2',           true, false, false, false, false, ARRAY[1,2,3]),
  ('bundle-3-7',   'Episodes 3–7',           'Public still bundle: episodes 3,4,5,6,7',       true, false, false, false, false, ARRAY[4,5,6,7,8]),
  ('bundle-8-12',  'Episodes 8–12',          'Public still bundle: episodes 8,9,10,11,12',    true, false, false, false, false, ARRAY[9,10,11,12,13]),
  ('bundle-full',  'Full Season 0–12',       'Public still bundle: GN + all episodes',        true, false, false, false, true,  NULL)
ON CONFLICT (sku_id) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description,
  grants_episodes_still   = EXCLUDED.grants_episodes_still,
  grants_episodes_motion  = EXCLUDED.grants_episodes_motion,
  grants_episodes_print   = EXCLUDED.grants_episodes_print,
  grants_character_cards  = EXCLUDED.grants_character_cards,
  grants_gn               = EXCLUDED.grants_gn,
  episode_numbers         = EXCLUDED.episode_numbers,
  updated_at = NOW();

-- ─────────────────────────────────────────────────────────────────────────────
-- Single-asset SKU templates. These grant a single specific category but the
-- buyer's entitlement carries the exact asset_id, so the resolver matches by
-- direct entitlement (not SKU expansion). Surfaced in the admin table for
-- visibility / catalog completeness.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO store_skus (sku_id, name, description,
  grants_episodes_still, grants_episodes_motion, grants_episodes_print,
  grants_character_cards, grants_gn) VALUES
  ('single-episode-still',     'Single Episode (Still)',  'One still episode PDF',            true,  false, false, false, false),
  ('single-episode-motion',    'Single Episode (Motion)', 'One motion comic episode',         false, true,  false, false, false),
  ('single-character-still',   'Single Character Card',   'One character poster card',        false, false, false, true,  false),
  ('single-character-motion',  'Single Character (Motion)','One motion character card',       false, false, false, true,  false)
ON CONFLICT (sku_id) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description,
  updated_at = NOW();
