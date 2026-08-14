-- Add series_scope column to track the series/scope context for canonical and operational assets
ALTER TABLE codex_media_assets
ADD COLUMN IF NOT EXISTS series_scope TEXT;

-- Index for efficient queries by series_scope
CREATE INDEX IF NOT EXISTS idx_codex_media_assets_series_scope
ON codex_media_assets(series_scope);

-- Composite index for common queries (series + scope)
CREATE INDEX IF NOT EXISTS idx_codex_media_assets_series_and_scope
ON codex_media_assets(series, series_scope);

COMMENT ON COLUMN codex_media_assets.series_scope IS 'Series scope context: canonical/constitutional-internet, canonical/horizen, etc. for canonical assets. Null for operational content.';
