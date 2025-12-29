-- Enable RLS if using Supabase with anon client for some reads
alter table did_identities enable row level security;
alter table content_assets enable row level security;
alter table asset_policies enable row level security;
alter table x402_transactions enable row level security;
alter table entitlements enable row level security;

-- Basic policies (service-role bypasses RLS). Tighten to your needs.
drop policy if exists owner_can_read_assets on content_assets;
create policy owner_can_read_assets on content_assets
  for select using (true);

-- Enable RLS on quotes (tenant-scoped streaming)
alter table quotes enable row level security;

-- Tenant-aware helper expression: extract tenant_id text from Supabase JWT claims
-- Using current_setting('request.jwt.claims', true) to avoid error when missing

-- Quotes: tenant-aware select/insert
drop policy if exists quotes_select on quotes;
drop policy if exists quotes_insert on quotes;
drop policy if exists quotes_select_tenant on quotes;
drop policy if exists quotes_insert_tenant on quotes;
create policy quotes_select_tenant on quotes
  for select using (
    (coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb->>'tenant_id') = tenant_id::text
  );
create policy quotes_insert_tenant on quotes
  for insert with check (
    (coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb->>'tenant_id') = tenant_id::text
  );

-- x402_transactions: tenant-aware read/insert (service role bypasses RLS for AA API)
drop policy if exists x402_select_tenant on x402_transactions;
drop policy if exists x402_insert_tenant on x402_transactions;
create policy x402_select_tenant on x402_transactions
  for select using (
    (coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb->>'tenant_id') = tenant_id::text
  );
create policy x402_insert_tenant on x402_transactions
  for insert with check (
    (coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb->>'tenant_id') = tenant_id::text
  );

drop policy if exists quotes_select on quotes;
create policy quotes_select on quotes
  for select using (true);

drop policy if exists quotes_insert on quotes;
create policy quotes_insert on quotes
  for insert with check (true);

drop policy if exists owner_can_insert_assets on content_assets;
create policy owner_can_insert_assets on content_assets
  for insert with check (true);

drop policy if exists owner_can_update_assets on content_assets;
create policy owner_can_update_assets on content_assets
  for update using (true);

drop policy if exists anyone_can_read_published on asset_policies;
create policy anyone_can_read_published on asset_policies
  for select using (true);
