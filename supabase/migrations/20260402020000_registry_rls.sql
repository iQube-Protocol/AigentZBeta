-- Registry Ingestion Factory v1.1
-- Add RLS policies for all registry_* tables.
-- Corrected from COD-RLS-001 review (Claude Code, 2026-04-02):
--   - PK column names are intake_id / asset_id / validation_id (not .id)
--   - registry_assets, registry_invocations, registry_receipts have direct tenant_id columns
--   - auth.uid() returns uuid; tenant_id is TEXT → cast required
--   - anon policy uses publication_status column (not status)

-- ─────────────────────────────────────────────────────────────────────────────
-- Enable RLS on all 15 registry tables
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.registry_intakes              enable row level security;
alter table public.registry_sources              enable row level security;
alter table public.registry_assets               enable row level security;
alter table public.registry_asset_versions       enable row level security;
alter table public.registry_policies             enable row level security;
alter table public.registry_validations          enable row level security;
alter table public.registry_validation_artifacts enable row level security;
alter table public.registry_trust_scores         enable row level security;
alter table public.registry_publications         enable row level security;
alter table public.registry_invocations          enable row level security;
alter table public.registry_receipts             enable row level security;
alter table public.registry_tags                 enable row level security;
alter table public.registry_asset_tags           enable row level security;
alter table public.registry_dependencies         enable row level security;
alter table public.registry_reviews              enable row level security;

-- ─────────────────────────────────────────────────────────────────────────────
-- Service-role full bypass on every table
-- ─────────────────────────────────────────────────────────────────────────────
drop policy if exists registry_intakes_service_role_all              on public.registry_intakes;
drop policy if exists registry_sources_service_role_all              on public.registry_sources;
drop policy if exists registry_assets_service_role_all               on public.registry_assets;
drop policy if exists registry_asset_versions_service_role_all       on public.registry_asset_versions;
drop policy if exists registry_policies_service_role_all             on public.registry_policies;
drop policy if exists registry_validations_service_role_all          on public.registry_validations;
drop policy if exists registry_validation_artifacts_service_role_all on public.registry_validation_artifacts;
drop policy if exists registry_trust_scores_service_role_all         on public.registry_trust_scores;
drop policy if exists registry_publications_service_role_all         on public.registry_publications;
drop policy if exists registry_invocations_service_role_all          on public.registry_invocations;
drop policy if exists registry_receipts_service_role_all             on public.registry_receipts;
drop policy if exists registry_tags_service_role_all                 on public.registry_tags;
drop policy if exists registry_asset_tags_service_role_all           on public.registry_asset_tags;
drop policy if exists registry_dependencies_service_role_all         on public.registry_dependencies;
drop policy if exists registry_reviews_service_role_all              on public.registry_reviews;

create policy registry_intakes_service_role_all
  on public.registry_intakes for all to service_role using (true) with check (true);

create policy registry_sources_service_role_all
  on public.registry_sources for all to service_role using (true) with check (true);

create policy registry_assets_service_role_all
  on public.registry_assets for all to service_role using (true) with check (true);

create policy registry_asset_versions_service_role_all
  on public.registry_asset_versions for all to service_role using (true) with check (true);

create policy registry_policies_service_role_all
  on public.registry_policies for all to service_role using (true) with check (true);

create policy registry_validations_service_role_all
  on public.registry_validations for all to service_role using (true) with check (true);

create policy registry_validation_artifacts_service_role_all
  on public.registry_validation_artifacts for all to service_role using (true) with check (true);

create policy registry_trust_scores_service_role_all
  on public.registry_trust_scores for all to service_role using (true) with check (true);

create policy registry_publications_service_role_all
  on public.registry_publications for all to service_role using (true) with check (true);

create policy registry_invocations_service_role_all
  on public.registry_invocations for all to service_role using (true) with check (true);

create policy registry_receipts_service_role_all
  on public.registry_receipts for all to service_role using (true) with check (true);

create policy registry_tags_service_role_all
  on public.registry_tags for all to service_role using (true) with check (true);

create policy registry_asset_tags_service_role_all
  on public.registry_asset_tags for all to service_role using (true) with check (true);

create policy registry_dependencies_service_role_all
  on public.registry_dependencies for all to service_role using (true) with check (true);

create policy registry_reviews_service_role_all
  on public.registry_reviews for all to service_role using (true) with check (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- Authenticated tenant-isolated reads
-- Note: auth.uid() returns uuid; tenant_id is TEXT → cast with ::text
-- ─────────────────────────────────────────────────────────────────────────────

-- registry_intakes: direct tenant_id column
drop policy if exists registry_intakes_tenant_read on public.registry_intakes;
create policy registry_intakes_tenant_read
  on public.registry_intakes for select to authenticated
  using (tenant_id = auth.uid()::text);

-- registry_sources: no tenant_id — join through registry_intakes(intake_id → tenant_id)
drop policy if exists registry_sources_tenant_read on public.registry_sources;
create policy registry_sources_tenant_read
  on public.registry_sources for select to authenticated
  using (
    exists (
      select 1 from public.registry_intakes i
      where i.intake_id = registry_sources.intake_id
        and i.tenant_id = auth.uid()::text
    )
  );

-- registry_assets: direct tenant_id column (no need to join through intakes)
drop policy if exists registry_assets_tenant_read on public.registry_assets;
create policy registry_assets_tenant_read
  on public.registry_assets for select to authenticated
  using (tenant_id = auth.uid()::text);

-- registry_asset_versions: join through registry_assets(asset_id → tenant_id)
drop policy if exists registry_asset_versions_tenant_read on public.registry_asset_versions;
create policy registry_asset_versions_tenant_read
  on public.registry_asset_versions for select to authenticated
  using (
    exists (
      select 1 from public.registry_assets a
      where a.asset_id = registry_asset_versions.asset_id
        and a.tenant_id = auth.uid()::text
    )
  );

-- registry_policies: join through registry_assets(asset_id → tenant_id)
drop policy if exists registry_policies_tenant_read on public.registry_policies;
create policy registry_policies_tenant_read
  on public.registry_policies for select to authenticated
  using (
    exists (
      select 1 from public.registry_assets a
      where a.asset_id = registry_policies.asset_id
        and a.tenant_id = auth.uid()::text
    )
  );

-- registry_validations: join through registry_assets(asset_id → tenant_id)
drop policy if exists registry_validations_tenant_read on public.registry_validations;
create policy registry_validations_tenant_read
  on public.registry_validations for select to authenticated
  using (
    exists (
      select 1 from public.registry_assets a
      where a.asset_id = registry_validations.asset_id
        and a.tenant_id = auth.uid()::text
    )
  );

-- registry_validation_artifacts: join through validations → assets(tenant_id)
drop policy if exists registry_validation_artifacts_tenant_read on public.registry_validation_artifacts;
create policy registry_validation_artifacts_tenant_read
  on public.registry_validation_artifacts for select to authenticated
  using (
    exists (
      select 1
      from public.registry_validations v
      join public.registry_assets a on a.asset_id = v.asset_id
      where v.validation_id = registry_validation_artifacts.validation_id
        and a.tenant_id = auth.uid()::text
    )
  );

-- registry_trust_scores: join through registry_assets(asset_id → tenant_id)
drop policy if exists registry_trust_scores_tenant_read on public.registry_trust_scores;
create policy registry_trust_scores_tenant_read
  on public.registry_trust_scores for select to authenticated
  using (
    exists (
      select 1 from public.registry_assets a
      where a.asset_id = registry_trust_scores.asset_id
        and a.tenant_id = auth.uid()::text
    )
  );

-- registry_publications: join through registry_assets(asset_id → tenant_id)
drop policy if exists registry_publications_tenant_read on public.registry_publications;
create policy registry_publications_tenant_read
  on public.registry_publications for select to authenticated
  using (
    exists (
      select 1 from public.registry_assets a
      where a.asset_id = registry_publications.asset_id
        and a.tenant_id = auth.uid()::text
    )
  );

-- registry_invocations: direct tenant_id column
drop policy if exists registry_invocations_tenant_read on public.registry_invocations;
create policy registry_invocations_tenant_read
  on public.registry_invocations for select to authenticated
  using (tenant_id = auth.uid()::text);

-- registry_receipts: direct tenant_id column
drop policy if exists registry_receipts_tenant_read on public.registry_receipts;
create policy registry_receipts_tenant_read
  on public.registry_receipts for select to authenticated
  using (tenant_id = auth.uid()::text);

-- registry_tags: global read for all authenticated users (no tenant ownership)
drop policy if exists registry_tags_tenant_read on public.registry_tags;
create policy registry_tags_tenant_read
  on public.registry_tags for select to authenticated
  using (true);

-- registry_asset_tags: join through registry_assets(asset_id → tenant_id)
drop policy if exists registry_asset_tags_tenant_read on public.registry_asset_tags;
create policy registry_asset_tags_tenant_read
  on public.registry_asset_tags for select to authenticated
  using (
    exists (
      select 1 from public.registry_assets a
      where a.asset_id = registry_asset_tags.asset_id
        and a.tenant_id = auth.uid()::text
    )
  );

-- registry_dependencies: join through registry_assets(asset_id → tenant_id)
drop policy if exists registry_dependencies_tenant_read on public.registry_dependencies;
create policy registry_dependencies_tenant_read
  on public.registry_dependencies for select to authenticated
  using (
    exists (
      select 1 from public.registry_assets a
      where a.asset_id = registry_dependencies.asset_id
        and a.tenant_id = auth.uid()::text
    )
  );

-- registry_reviews: join through registry_assets(asset_id → tenant_id)
drop policy if exists registry_reviews_tenant_read on public.registry_reviews;
create policy registry_reviews_tenant_read
  on public.registry_reviews for select to authenticated
  using (
    exists (
      select 1 from public.registry_assets a
      where a.asset_id = registry_reviews.asset_id
        and a.tenant_id = auth.uid()::text
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Anon read: published assets only
-- Uses publication_status column (not 'status' — which does not exist on this table)
-- ─────────────────────────────────────────────────────────────────────────────
drop policy if exists registry_assets_anon_published_read on public.registry_assets;
create policy registry_assets_anon_published_read
  on public.registry_assets for select to anon
  using (publication_status = 'published');
