-- ============================================================================
-- Add display_mode and extracted_text to codex_media_assets
-- ============================================================================
-- This migration adds support for:
-- 1. display_mode: How the content should be displayed (pdf, image, video, text_extract)
-- 2. extracted_text: Extracted text content for copilot knowledge base and text display
-- ============================================================================

-- Add display_mode enum
DO $$ BEGIN
  CREATE TYPE content_display_mode AS ENUM (
    'pdf',           -- Display as PDF viewer
    'image',         -- Display as image
    'video',         -- Display as video player
    'text_extract'   -- Extract text and display as formatted text (for copilot)
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add columns to codex_media_assets
ALTER TABLE codex_media_assets 
ADD COLUMN IF NOT EXISTS display_mode content_display_mode DEFAULT 'pdf';

ALTER TABLE codex_media_assets 
ADD COLUMN IF NOT EXISTS extracted_text TEXT;

-- Add index for copilot queries on extracted text
CREATE INDEX IF NOT EXISTS idx_codex_media_assets_extracted_text 
ON codex_media_assets USING gin(to_tsvector('english', extracted_text))
WHERE extracted_text IS NOT NULL;

-- Add index for display mode filtering
CREATE INDEX IF NOT EXISTS idx_codex_media_assets_display_mode 
ON codex_media_assets(display_mode);

-- Comment on columns
COMMENT ON COLUMN codex_media_assets.display_mode IS 'How to display this content: pdf, image, video, or text_extract for copilot-ready text';
COMMENT ON COLUMN codex_media_assets.extracted_text IS 'Extracted text content for copilot knowledge base and text display';
