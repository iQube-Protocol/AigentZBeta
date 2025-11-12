-- Enable RLS on core tables
alter table did_identities enable row level security;
alter table content_assets enable row level security;
alter table asset_policies enable row level security;
alter table x402_transactions enable row level security;
alter table entitlements enable row level security;
alter table quotes enable row level security;

-- Basic permissive policies (tighten as needed)
drop policy if exists owner_can_read_assets on content_assets;
create policy owner_can_read_assets on content_assets
  for select using (true);

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
