-- =============================================================================
-- store_skus.episode_numbers — convert public bundle scoping from 1-indexed
-- to 0-indexed to match the canonical DB convention (master_content_qubes
-- episode_number 0..12).
--
-- Why: the May 11 seed (20260511000000_store_skus_seed.sql) wrote the
-- public bundles' episode_numbers as 1-indexed arrays (the historical
-- "DB ep = display + 1" convention). The DB has since moved to the
-- canonical 0-indexed convention (episode_number = display_number, 0..12).
-- skuCoversAsset compares sku.episode_numbers against AssetMeta.episodeNumber
-- by literal equality, so the off-by-one drops every public-bundle owner's
-- access to display #0 (the first episode) and wastes a slot on #13.
--
-- Idempotent: writes specific arrays for each sku_id.
-- =============================================================================

BEGIN;

UPDATE store_skus SET episode_numbers = ARRAY[0,1,2]
  WHERE sku_id = 'bundle-0-2';

UPDATE store_skus SET episode_numbers = ARRAY[3,4,5,6,7]
  WHERE sku_id = 'bundle-3-7';

UPDATE store_skus SET episode_numbers = ARRAY[8,9,10,11,12]
  WHERE sku_id = 'bundle-8-12';

UPDATE store_skus SET episode_numbers = ARRAY[0,1,2,3,4,5,6,7,8,9,10,11,12]
  WHERE sku_id = 'bundle-full';

COMMIT;
