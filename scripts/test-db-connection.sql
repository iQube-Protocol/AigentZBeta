-- =============================================================================
-- Test Database Connection and Schema
-- =============================================================================

-- Show current database and user
SELECT current_database(), current_user, current_schema();

-- List all schemas
SELECT schema_name 
FROM information_schema.schemata 
ORDER BY schema_name;

-- Check if marketa schema exists
SELECT 'marketa schema exists' as status, schema_name 
FROM information_schema.schemata 
WHERE schema_name = 'marketa';

-- List all tables in marketa schema
SELECT 'marketa tables' as info, table_name 
FROM information_schema.tables 
WHERE table_schema = 'marketa'
ORDER BY table_name;

-- Check if our specific table exists
SELECT 'campaigns table check' as info, table_name, table_schema
FROM information_schema.tables 
WHERE table_name = 'marketa_campaigns';

-- If table exists, show sample data
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'marketa' 
        AND table_name = 'marketa_campaigns'
    ) THEN
        RAISE NOTICE '✅ marketa_campaigns table found in marketa schema';
        -- Show sample data
        PERFORM * FROM marketa.marketa_campaigns LIMIT 1;
    ELSE
        RAISE NOTICE '❌ marketa_campaigns table NOT found';
    END IF;
END $$;
