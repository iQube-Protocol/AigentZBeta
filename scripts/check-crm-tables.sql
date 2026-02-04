-- =============================================================================
-- Check CRM Tables in Public Schema
-- =============================================================================

-- Check if crm_personas exists in public schema
SELECT table_name, table_schema 
FROM information_schema.tables 
WHERE table_name IN ('crm_personas', 'crm_tenants')
ORDER BY table_schema, table_name;

-- If crm_personas exists, show structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'crm_personas' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check if we have any personas
SELECT COUNT(*) as persona_count FROM public.crm_personas;

-- Show sample personas if they exist
SELECT id, display_name, email, tenant_id, external_user_id 
FROM public.crm_personas 
LIMIT 5;
