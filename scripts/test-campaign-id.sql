-- =============================================================================
-- Test Campaign ID Generation
-- =============================================================================

-- Check the table structure to see what's required
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'marketa_campaigns' 
AND table_schema = 'marketa'
ORDER BY ordinal_position;

-- Test inserting a campaign with explicit ID
INSERT INTO marketa.marketa_campaigns (
  id,
  tenant_id, 
  name, 
  description, 
  campaign_type,
  status,
  participating_tenants_count
) VALUES (
  'test-campaign-' || extract(epoch from now())::text,
  'agq-tenant',
  'Test Campaign ID',
  'Testing ID generation',
  'custom',
  'draft',
  0
) ON CONFLICT (id) DO NOTHING;

-- Verify the insert worked
SELECT * FROM marketa.marketa_campaigns WHERE name LIKE 'Test Campaign ID%';

-- Clean up
DELETE FROM marketa.marketa_campaigns WHERE name LIKE 'Test Campaign ID%';
