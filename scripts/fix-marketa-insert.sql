-- =============================================================================
-- Marketa Database Fix - Correct Sample Data Insert
-- =============================================================================

-- First, let's check what columns exist and their types
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'marketa_campaigns' 
AND table_schema = 'marketa'
ORDER BY ordinal_position;

-- Insert sample data with correct types
INSERT INTO marketa.marketa_campaigns (
  id, 
  tenant_id, 
  name, 
  description, 
  campaign_type,
  status,
  participating_tenants_count
) VALUES (
  'test-campaign-1',
  'agq-tenant',
  'Test Campaign',
  'A test campaign for development',
  'custom',
  'draft',
  0
) ON CONFLICT (id) DO NOTHING;

-- If created_by_persona_id exists and is UUID, we can update it with a real UUID
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'marketa_campaigns' 
        AND column_name = 'created_by_persona_id'
        AND table_schema = 'marketa'
        AND data_type = 'uuid'
    ) THEN
        UPDATE marketa.marketa_campaigns 
        SET created_by_persona_id = gen_random_uuid()
        WHERE id = 'test-campaign-1' AND created_by_persona_id IS NULL;
        RAISE NOTICE 'Updated created_by_persona_id with UUID';
    ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'marketa_campaigns' 
        AND column_name = 'created_by_persona_id'
        AND table_schema = 'marketa'
        AND data_type = 'text'
    ) THEN
        UPDATE marketa.marketa_campaigns 
        SET created_by_persona_id = 'test-persona-admin'
        WHERE id = 'test-campaign-1' AND created_by_persona_id IS NULL;
        RAISE NOTICE 'Updated created_by_persona_id with text';
    END IF;
END $$;

-- Verify the data was inserted
SELECT * FROM marketa.marketa_campaigns WHERE id = 'test-campaign-1';

-- Success message
DO $$
BEGIN
    RAISE NOTICE '🎉 Marketa database fix complete!';
    RAISE NOTICE '✅ Sample data inserted with correct types';
    RAISE NOTICE '🚀 You can now seed the 21 Awakenings campaign!';
END $$;
