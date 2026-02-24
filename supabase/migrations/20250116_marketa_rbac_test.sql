-- Test script to verify Marketa RBAC schema works correctly
-- Run this after the main migration to verify everything is working

-- ============================================================================
-- 1. TEST BASIC TABLE CREATION
-- ============================================================================

-- Test marketa schema exists
SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'marketa';

-- Test tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'marketa' 
ORDER BY table_name;

-- ============================================================================
-- 2. TEST RLS POLICIES
-- ============================================================================

-- Test RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'marketa' 
ORDER BY tablename;

-- Test RLS policies exist
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'marketa' 
ORDER BY tablename, policyname;

-- ============================================================================
-- 3. TEST TYPE CASTING IN VIEWS
-- ============================================================================

-- Test tenant partner view works
SELECT * FROM marketa.v_tenant_partners LIMIT 1;

-- Test tenant campaign performance view works  
SELECT * FROM marketa.v_tenant_campaign_performance LIMIT 1;

-- Test tenant audience summary view works
SELECT * FROM marketa.v_tenant_audience_summary LIMIT 1;

-- ============================================================================
-- 4. TEST FUNCTIONS
-- ============================================================================

-- Test tenant isolation function
SELECT marketa.get_current_tenant_id();

-- Test tenant access function (should return false for no context)
SELECT marketa.can_access_tenant('test-tenant');

-- ============================================================================
-- 5. TEST TRIGGERS
-- ============================================================================

-- Test triggers exist
SELECT event_object_table, trigger_name, action_timing, action_condition, action_statement
FROM information_schema.triggers 
WHERE trigger_schema = 'marketa'
ORDER BY event_object_table, trigger_name;

-- ============================================================================
-- 6. TEST BASIC DATA OPERATIONS
-- ============================================================================

-- Test inserting a test partner (should work with proper tenant context)
-- Note: This will fail without proper RLS context, which is expected

-- Show sample data structure
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'marketa' 
  AND table_name = 'partners'
ORDER BY ordinal_position;

-- ============================================================================
-- 7. VERIFICATION SUMMARY
-- ============================================================================

SELECT 'Marketa RBAC Schema Verification Complete' as status,
       (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'marketa') as tables_created,
       (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'marketa') as policies_created,
       (SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_schema = 'marketa') as triggers_created;
