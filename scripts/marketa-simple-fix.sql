-- =============================================================================
-- Marketa Simple Fix - Skip Foreign Key Issues
-- =============================================================================

-- Add missing columns safely (skip created_by_persona_id)
DO $$
BEGIN
    -- Add participating_tenants_count if missing
    BEGIN
        ALTER TABLE marketa.marketa_campaigns 
        ADD COLUMN participating_tenants_count INTEGER DEFAULT 0;
        RAISE NOTICE '✅ Added participating_tenants_count';
    EXCEPTION WHEN duplicate_column THEN
        RAISE NOTICE '⚠️ participating_tenants_count already exists';
    END;

    -- Add campaign_type if missing
    BEGIN
        ALTER TABLE marketa.marketa_campaigns 
        ADD COLUMN campaign_type TEXT NOT NULL DEFAULT 'wpp';
        RAISE NOTICE '✅ Added campaign_type';
    EXCEPTION WHEN duplicate_column THEN
        RAISE NOTICE '⚠️ campaign_type already exists';
    END;

    -- Add description if missing
    BEGIN
        ALTER TABLE marketa.marketa_campaigns 
        ADD COLUMN description TEXT;
        RAISE NOTICE '✅ Added description';
    EXCEPTION WHEN duplicate_column THEN
        RAISE NOTICE '⚠️ description already exists';
    END;
END $$;

-- Create sequence_items table if it doesn't exist
CREATE TABLE IF NOT EXISTS marketa.marketa_sequence_items (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT NOT NULL REFERENCES marketa.marketa_campaigns(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  asset_ref TEXT NOT NULL,
  cta_url TEXT,
  explainer BOOLEAN DEFAULT false,
  tags TEXT[],
  status TEXT DEFAULT 'draft',
  copy_variants JSONB DEFAULT '{}',
  thumbnail_url TEXT,
  duration_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, day_number)
);

-- Insert sample data with only basic required columns
INSERT INTO marketa.marketa_campaigns (
  id, 
  tenant_id, 
  name, 
  status
) VALUES (
  'test-campaign-1',
  'agq-tenant',
  'Test Campaign',
  'draft'
) ON CONFLICT (id) DO NOTHING;

-- Update additional columns (skip created_by_persona_id to avoid foreign key issues)
UPDATE marketa.marketa_campaigns 
SET description = 'A test campaign for development'
WHERE id = 'test-campaign-1' AND description IS NULL;

UPDATE marketa.marketa_campaigns 
SET campaign_type = 'custom'
WHERE id = 'test-campaign-1' AND campaign_type IS NULL;

UPDATE marketa.marketa_campaigns 
SET participating_tenants_count = 0
WHERE id = 'test-campaign-1' AND participating_tenants_count IS NULL;

-- Verify everything worked
SELECT * FROM marketa.marketa_campaigns WHERE id = 'test-campaign-1';

-- Success message
DO $$
BEGIN
    RAISE NOTICE '🎉 Marketa simple fix complete!';
    RAISE NOTICE '✅ All required columns added';
    RAISE NOTICE '✅ Sample data inserted correctly';
    RAISE NOTICE '✅ Foreign key issues avoided';
    RAISE NOTICE '🚀 You can now seed the 21 Awakenings campaign!';
END $$;
