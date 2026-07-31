-- CFS-035 Observatory amendment — persisted shadow observations.
--
-- The Invariant Engine's shadow runners (runShadow / runValueShadow) record a
-- comparison between each Invariant Decision Node's projection and the incumbent
-- heuristic. Those observations were in-memory (per-instance) — this table gives
-- them history so the Constitutional Observatory's Platform Health reads a real
-- time series (projection accuracy over time) rather than a per-instance snapshot.
--
-- Writes are best-effort and fire-and-forget from the hot path (observe-only,
-- never blocks or throws). Reads are T1-safe: node id + score meta only, never
-- a personaId (observations carry no persona data).

create table if not exists invariant_shadow_observations (
  id             uuid primary key default gen_random_uuid(),
  node_id        text not null,
  kind           text not null check (kind in ('rank', 'value')),
  -- rank nodes (discovery, nbe): Kendall-like agreement in [0,1], 1 = faithful
  rank_agreement double precision,
  top_agreement  boolean,
  -- value nodes (standing, journey): projected − incumbent
  value_delta    double precision,
  item_count     integer,
  cited_ids      text[] not null default '{}',
  observed_at    timestamptz not null default now()
);

-- Health reads the most-recent-first slice per node.
create index if not exists idx_iso_node_time
  on invariant_shadow_observations (node_id, observed_at desc);

comment on table invariant_shadow_observations is
  'CFS-035 Constitutional Observatory — persisted shadow observations (projection vs incumbent). Best-effort, T1-safe, observe-only.';
