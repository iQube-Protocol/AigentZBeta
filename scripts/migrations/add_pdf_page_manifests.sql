-- Add pages_ready columns to existing tables
ALTER TABLE codex_media_assets
  ADD COLUMN IF NOT EXISTS pages_ready BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pages_count INTEGER;

ALTER TABLE master_content_qubes
  ADD COLUMN IF NOT EXISTS pages_ready BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pages_count INTEGER;

-- Create manifest table for pre-rendered PDF pages
CREATE TABLE IF NOT EXISTS pdf_page_manifests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auto_drive_cid TEXT NOT NULL UNIQUE,
  source_pdf_lite_url TEXT NOT NULL,
  pages_count INTEGER NOT NULL,
  bucket TEXT NOT NULL,
  base_path TEXT NOT NULL,
  width INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pdf_page_manifests_cid ON pdf_page_manifests(auto_drive_cid);

-- Add comment
COMMENT ON TABLE pdf_page_manifests IS 'Tracks pre-rendered PDF page images stored in Supabase Storage';
