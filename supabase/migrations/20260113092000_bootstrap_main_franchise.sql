-- Bootstrap Main Franchise for CRM System
-- This ensures the main franchise exists for tenant applications

-- Insert main franchise if it doesn't exist
insert into crm_franchises (id, slug, name, description, config, is_active)
values (
  gen_random_uuid(),
  'main',
  'Main Franchise',
  'Primary franchise for all tenant applications',
  '{"is_main": true, "auto_approve": false}'::jsonb,
  true
) on conflict (slug) do nothing;

-- Create a default tenant for development/testing
insert into crm_tenants (id, franchise_id, slug, name, description, config, is_active)
select 
  gen_random_uuid(),
  f.id,
  'demo',
  'Demo Organization',
  'Demo tenant for development and testing',
  '{"is_demo": true, "auto_created": true}'::jsonb,
  true
from crm_franchises f 
where f.slug = 'main'
and not exists (
  select 1 from crm_tenants where slug = 'demo'
);
