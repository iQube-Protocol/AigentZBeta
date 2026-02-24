-- AgentiQ Anchor Franchise Setup
-- Establish AgentiQ as the mother ship franchise at the top of the hierarchy

-- First, let's add a column to track the anchor franchise relationship
alter table crm_franchises 
add column if not exists parent_franchise_id uuid references crm_franchises(id);

-- Add column to mark anchor franchises
alter table crm_franchises 
add column if not exists is_anchor boolean default false;

-- Add column for hierarchy level
alter table crm_franchises 
add column if not exists hierarchy_level integer default 1;

-- Create the AgentiQ anchor franchise (mother ship)
insert into crm_franchises (
  id, 
  slug, 
  name, 
  description, 
  config, 
  is_active, 
  is_anchor,
  hierarchy_level,
  parent_franchise_id
) values (
  gen_random_uuid(),
  'agentiq',
  'AgentiQ Platform',
  'The mother ship franchise - anchor platform for all franchises and tenants',
  '{
    "is_anchor": true,
    "is_mother_ship": true,
    "platform_level": "root",
    "governs_franchises": true,
    "governs_tenants": true,
    "system_role": "anchor"
  }'::jsonb,
  true,
  true,
  0, -- Top level
  null -- No parent - it's the anchor
) on conflict (slug) do update set 
  is_anchor = true,
  hierarchy_level = 0,
  parent_franchise_id = null,
  config = '{
    "is_anchor": true,
    "is_mother_ship": true,
    "platform_level": "root",
    "governs_franchises": true,
    "governs_tenants": true,
    "system_role": "anchor"
  }'::jsonb;

-- Update existing franchises to be children of AgentiQ
update crm_franchises 
set 
  parent_franchise_id = (select id from crm_franchises where slug = 'agentiq'),
  hierarchy_level = 1,
  is_anchor = false
where 
  slug != 'agentiq' 
  and parent_franchise_id is null;

-- Create a function to get the full hierarchy path
create or replace function get_franchise_hierarchy_path(franchise_uuid uuid)
returns text[] as $$
declare
  path text[] := array[]::text[];
  current_franchise record;
begin
  -- Start with the given franchise
  select * into current_franchise from crm_franchises where id = franchise_uuid;
  
  if not found then
    return path;
  end if;
  
  -- Build the path from bottom to top
  while current_franchise is not null loop
    path := array_prepend(current_franchise.slug, path);
    
    -- Move to parent
    select * into current_franchise 
    from crm_franchises 
    where id = current_franchise.parent_franchise_id;
  end loop;
  
  return path;
end;
$$ language plpgsql;

-- Create function to check if a franchise can govern another
create or replace function can_govern_franchise(governor_uuid uuid, target_uuid uuid)
returns boolean as $$
declare
  governor_path text[];
  target_path text[];
begin
  -- Get hierarchy paths
  governor_path := get_franchise_hierarchy_path(governor_uuid);
  target_path := get_franchise_hierarchy_path(target_uuid);
  
  -- AgentiQ (anchor) can govern everyone
  if governor_path[1] = 'agentiq' then
    return true;
  end if;
  
  -- Check if governor is higher in hierarchy than target
  return array_length(governor_path, 1) < array_length(target_path, 1);
end;
$$ language plpgsql;

-- Create function to get all franchises under AgentiQ
create or replace function get_agentiq_hierarchy()
returns table (
  franchise_id uuid,
  slug text,
  name text,
  hierarchy_level integer,
  parent_franchise_id uuid,
  is_anchor boolean,
  hierarchy_path text[]
) as $$
begin
  return query
  select 
    f.id,
    f.slug,
    f.name,
    f.hierarchy_level,
    f.parent_franchise_id,
    f.is_anchor,
    get_franchise_hierarchy_path(f.id) as hierarchy_path
  from crm_franchises f
  where f.is_active = true
  order by f.hierarchy_level, f.name;
end;
$$ language plpgsql;

-- Note: Cannot add CHECK constraint with subquery in PostgreSQL
-- Franchise hierarchy validation will be handled at the application level
-- and through triggers if needed

-- Create view for tenant hierarchy including franchise path
create or replace view tenant_hierarchy_view as
select 
  t.id as tenant_id,
  t.slug as tenant_slug,
  t.name as tenant_name,
  t.franchise_id,
  f.slug as franchise_slug,
  f.name as franchise_name,
  f.hierarchy_level as franchise_level,
  f.parent_franchise_id,
  get_franchise_hierarchy_path(f.id) as franchise_hierarchy_path,
  case 
    when f.slug = 'agentiq' then true 
    else false 
  end as is_agentiq_tenant,
  t.is_active,
  t.created_at
from crm_tenants t
join crm_franchises f on t.franchise_id = f.id
where t.is_active = true;

-- Grant permissions
grant usage on schema public to anon, authenticated;
grant select on crm_franchises to anon, authenticated;
grant select on tenant_hierarchy_view to anon, authenticated;

-- Create indexes for hierarchy queries
create index if not exists idx_crm_franchises_parent on crm_franchises(parent_franchise_id);
create index if not exists idx_crm_franchises_hierarchy_level on crm_franchises(hierarchy_level);
create index if not exists idx_crm_franchises_anchor on crm_franchises(is_anchor);

-- Add comment explaining the hierarchy
comment on table crm_franchises is 'AgentiQ Franchise Hierarchy: AgentiQ (anchor) -> Franchises -> Tenants';
comment on column crm_franchises.is_anchor is 'Marks AgentiQ as the mother ship franchise';
comment on column crm_franchises.hierarchy_level is '0 = AgentiQ (anchor), 1 = Child franchises, 2+ = Sub-franchises';
comment on column crm_franchises.parent_franchise_id is 'Links to parent franchise in hierarchy';
