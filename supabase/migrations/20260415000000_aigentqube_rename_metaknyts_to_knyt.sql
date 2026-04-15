-- Patch: metaKnyts and KNYT are the same cartridge.
-- Remove the redundant "metaKnyts" entry from cartridgeOverlays on Aigent Z and Kn0w1.
-- The canonical overlay name is "KNYT".

UPDATE registry_assets
SET metadata = jsonb_set(
  metadata,
  '{cartridgeOverlays}',
  (
    SELECT jsonb_agg(elem)
    FROM jsonb_array_elements(metadata->'cartridgeOverlays') AS elem
    WHERE elem::text != '"metaKnyts"'
  )
),
updated_at = now()
WHERE asset_id IN ('aigentqube-aigent-z', 'aigentqube-kn0w1')
  AND metadata->'cartridgeOverlays' @> '["metaKnyts"]'::jsonb;
