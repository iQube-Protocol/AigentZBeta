-- =============================================================================
-- Marketa Final Fix - Check and Add Missing Columns
-- =============================================================================

-- First, let's see what columns currently exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'marketa_campaigns' 
AND table_schema = 'marketa'
ORDER BY ordinal_position;

-- Add missing columns one by one with error handling
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

    -- Add created_by_persona_id if missing
    BEGIN
        ALTER TABLE marketa.marketa_campaigns 
        ADD COLUMN created_by_persona_id TEXT;
        RAISE NOTICE '✅ Added created_by_persona_id';
    EXCEPTION WHEN duplicate_column THEN
        RAISE NOTICE '⚠️ created_by_persona_id already exists';
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

-- Insert sample data with only basic columns that should exist
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

-- Update additional columns if they exist
DO $$
BEGIN
    -- Update description if column exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'marketa_campaigns' 
        AND column_name = 'description'
        AND table_schema = 'marketa'
    ) THEN
        UPDATE marketa.marketa_campaigns 
        SET description = 'A test campaign for development'
        WHERE id = 'test-campaign-1' AND description IS NULL;
    END IF;

    -- Update campaign_type if column exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'marketa_campaigns' 
        AND column_name = 'campaign_type'
        AND table_schema = 'marketa'
    ) THEN
        UPDATE marketa.marketa_campaigns 
        SET campaign_type = 'custom'
        WHERE id = 'test-campaign-1' AND campaign_type IS NULL;
    END IF;

    -- Update created_by_persona_id if column exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'marketa_campaigns' 
        AND column_name = 'created_by_persona_id'
        AND table_schema = 'marketa'
    ) THEN
        UPDATE marketa.marketa_campaigns 
        SET created_by_persona_id = 'test-persona-admin'
        WHERE id = 'test-campaign-1' AND created_by_persona_id IS NULL;
    END IF;

    -- Update participating_tenants_count if column exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'marketa_campaigns' 
        AND column_name = 'participating_tenants_count'
        AND table_schema = 'marketa'
    ) THEN
        UPDATE marketa.marketa_campaigns 
        SET participating_tenants_count = 0
        WHERE id = 'test-campaign-1' AND participating_tenants_count IS NULL;
    END IF;
END $$;

-- Verify everything worked
SELECT * FROM marketa.marketa_campaigns WHERE id = 'test-campaign-1';

-- Success message
DO $$
BEGIN
    RAISE NOTICE '🎉 Marketa final fix complete!';
    RAISE NOTICE '✅ All missing columns added safely';
    RAISE NOTICE '✅ Sample data inserted correctly';
    RAISE NOTICE '🚀 You can now seed the 21 Awakenings campaign!';
END $$;
