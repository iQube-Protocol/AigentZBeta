-- =============================================================================
-- Marketa Database Update Script
-- Updates existing tables to add missing columns
-- =============================================================================

-- Add missing columns to marketa_campaigns if they don't exist
DO $$
BEGIN
    -- Check and add participating_tenants_count
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'marketa_campaigns' 
        AND column_name = 'participating_tenants_count'
        AND table_schema = 'marketa'
    ) THEN
        ALTER TABLE marketa.marketa_campaigns 
        ADD COLUMN participating_tenants_count INTEGER DEFAULT 0;
        RAISE NOTICE 'Added participating_tenants_count column';
    END IF;

    -- Check and add campaign_type
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'marketa_campaigns' 
        AND column_name = 'campaign_type'
        AND table_schema = 'marketa'
    ) THEN
        ALTER TABLE marketa.marketa_campaigns 
        ADD COLUMN campaign_type TEXT NOT NULL DEFAULT 'wpp';
        RAISE NOTICE 'Added campaign_type column';
    END IF;

    -- Check and add secondary_cta
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'marketa_campaigns' 
        AND column_name = 'secondary_cta'
        AND table_schema = 'marketa'
    ) THEN
        ALTER TABLE marketa.marketa_campaigns 
        ADD COLUMN secondary_cta TEXT;
        RAISE NOTICE 'Added secondary_cta column';
    END IF;

    -- Check and add helix_thread
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'marketa_campaigns' 
        AND column_name = 'helix_thread'
        AND table_schema = 'marketa'
    ) THEN
        ALTER TABLE marketa.marketa_campaigns 
        ADD COLUMN helix_thread TEXT DEFAULT 'bridge';
        RAISE NOTICE 'Added helix_thread column';
    END IF;

    -- Check and add sequence_length
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'marketa_campaigns' 
        AND column_name = 'sequence_length'
        AND table_schema = 'marketa'
    ) THEN
        ALTER TABLE marketa.marketa_campaigns 
        ADD COLUMN sequence_length INTEGER DEFAULT 0;
        RAISE NOTICE 'Added sequence_length column';
    END IF;

    -- Check and add created_by_persona_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'marketa_campaigns' 
        AND column_name = 'created_by_persona_id'
        AND table_schema = 'marketa'
    ) THEN
        ALTER TABLE marketa.marketa_campaigns 
        ADD COLUMN created_by_persona_id TEXT;
        RAISE NOTICE 'Added created_by_persona_id column';
    END IF;

    -- Check and add description
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'marketa_campaigns' 
        AND column_name = 'description'
        AND table_schema = 'marketa'
    ) THEN
        ALTER TABLE marketa.marketa_campaigns 
        ADD COLUMN description TEXT;
        RAISE NOTICE 'Added description column';
    END IF;
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

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_campaigns_type ON marketa.marketa_campaigns(campaign_type);
CREATE INDEX IF NOT EXISTS idx_campaigns_created_by ON marketa.marketa_campaigns(created_by_persona_id);
CREATE INDEX IF NOT EXISTS idx_sequence_campaign ON marketa.marketa_sequence_items(campaign_id);
CREATE INDEX IF NOT EXISTS idx_sequence_day ON marketa.marketa_sequence_items(day_number);

-- Enable RLS if not already enabled
ALTER TABLE marketa.marketa_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketa.marketa_sequence_items ENABLE ROW LEVEL SECURITY;

-- Create/Update policies
DROP POLICY IF EXISTS "Enable all access for development" ON marketa.marketa_campaigns;
CREATE POLICY "Enable all access for development" ON marketa.marketa_campaigns FOR ALL USING (true);

DROP POLICY IF EXISTS "Enable all access for development" ON marketa.marketa_sequence_items;
CREATE POLICY "Enable all access for development" ON marketa.marketa_sequence_items FOR ALL USING (true);

-- Insert sample data
INSERT INTO marketa.marketa_campaigns (
  id, 
  tenant_id, 
  name, 
  description, 
  campaign_type,
  status,
  created_by_persona_id,
  participating_tenants_count
) VALUES (
  'test-campaign-1',
  'agq-tenant',
  'Test Campaign',
  'A test campaign for development',
  'custom',
  'draft',
  'test-persona-admin',
  0
) ON CONFLICT (id) DO NOTHING;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '🎉 Marketa database update complete!';
    RAISE NOTICE '✅ Updated marketa_campaigns table with missing columns';
    RAISE NOTICE '✅ Created marketa_sequence_items table';
    RAISE NOTICE '✅ Added indexes and policies';
    RAISE NOTICE '🚀 You can now seed the 21 Awakenings campaign!';
END $$;
