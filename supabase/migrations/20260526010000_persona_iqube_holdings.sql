-- ============================================================================
-- persona_iqube_holdings — per-persona projection of iQube ownership.
--
-- Phase: CRM <-> identity / asset enrichment, followup #1.
--   See codexes/packs/agentiq/updates/2026-05-26_crm-identity-asset-enrichment-plan.md
--
-- iQube Registry (`registry_assets`) is the canonical SoT for the iQube
-- catalog itself. Persona-grain ownership of an iQube instance — which
-- AigentQubes / TalentQubes / DataQubes etc. a persona holds — projects
-- into THIS table. The row carries the linkage + acquisition delta only;
-- bespoke per-instance content (e.g. a TalentQube's skills + history)
-- lives encrypted in the iQube's blakQube and is read via
-- discloseCredential() on the spine, never queried directly.
--
-- One table for all asset classes (matching the shape of
-- persona_activations) so the resolver doesn't have to fan out across
-- five mirror tables. registry_assets.asset_class disambiguates.
--
-- Privacy posture
-- ---------------
--   - persona_id is T0 — server-internal only. The unified resolver
--     `getPersonaAssetGraph` returns counts + slugs + trust bands only
--     (T1); plaintext content (TalentQube blakQube payload, etc.) never
--     touches a SELECT against this table.
--   - Service-role policies only. All reads land via
--     /api/admin/access-requests (enrichment) or /api/admin/persona-360
--     (the inspector tab); both gate on the spine's `cartridgeFlags.isAdmin`.
--
-- Lifecycle
-- ---------
--   This table is the canonical read-side projection. WRITES land when
--   the persona acquires an iQube — minting via the store, an airdrop,
--   an admin grant, an inheritance migration, etc. The next-week iQube
--   workstream is responsible for wiring those writes; until that lands
--   the table is empty and `getPersonaAssetGraph` returns
--   `ownedAssets.iQubes = []` gracefully.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.persona_iqube_holdings (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id           text NOT NULL,
  -- Catalog row that defines the asset class + capabilities.
  -- For one-of-a-kind persona iQubes (a TalentQube bespoke to this
  -- persona), the registry_assets row IS the persona's instance.
  -- For shared-catalog assets (a SkillQube the persona has invoke
  -- rights on), this row references the shared catalog entry and
  -- the per-persona delta lives in capacity_units / metadata.
  registry_asset_id    text NOT NULL REFERENCES public.registry_assets(asset_id) ON DELETE RESTRICT,
  -- Snapshot of registry_assets.asset_class at acquisition time.
  -- Lets the resolver build the graph without a second join when
  -- the catalog mutates underneath; the holding row remembers the
  -- class as-shipped to the persona.
  asset_class          text NOT NULL,
  -- How the persona acquired this holding. The set covers the
  -- alpha acquisition paths; extend as new paths arrive (e.g.
  -- 'cohort-grant', 'partner-import').
  source               text NOT NULL DEFAULT 'self-mint'
    CHECK (source IN (
      'self-mint',
      'minted-via-store',
      'airdrop',
      'partner-grant',
      'admin-grant',
      'inherited',
      'imported'
    )),
  -- For shared-catalog assets — the seat / quota the persona has.
  -- Null for unique instances.
  capacity_units       integer,
  capacity_unit_label  text,
  -- For unique instances — the iQube content anchor (CID, on-chain
  -- token id, FactQube hash). Null for shared-catalog seats.
  instance_anchor      text,
  -- Trust-band snapshot at acquisition. The catalog's current
  -- trust_band can move; what the persona received gets pinned here
  -- so receipts reproduce.
  trust_band           text,
  acquired_at          timestamptz NOT NULL DEFAULT now(),
  revoked_at           timestamptz,
  status               text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','suspended','revoked','expired')),
  -- Anything else the acquisition pathway wants to preserve.
  -- Examples: { "mint_tx_hash": "0x...", "edition": 42, "issuer": "knyt-treasury" }.
  metadata             jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at           timestamptz NOT NULL DEFAULT now(),
  -- A persona can't hold the same registry asset at the same
  -- instance_anchor twice; the (persona, registry, anchor) key
  -- de-duplicates accidental re-mints. Anchor of NULL means the
  -- combination falls back to (persona, registry) only — which is
  -- the right behaviour for shared-seat assets.
  UNIQUE (persona_id, registry_asset_id, instance_anchor)
);

CREATE INDEX IF NOT EXISTS idx_persona_iqube_holdings_persona
  ON public.persona_iqube_holdings(persona_id);
CREATE INDEX IF NOT EXISTS idx_persona_iqube_holdings_class
  ON public.persona_iqube_holdings(asset_class);
CREATE INDEX IF NOT EXISTS idx_persona_iqube_holdings_status
  ON public.persona_iqube_holdings(status);
CREATE INDEX IF NOT EXISTS idx_persona_iqube_holdings_registry_asset
  ON public.persona_iqube_holdings(registry_asset_id);

ALTER TABLE public.persona_iqube_holdings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "persona_iqube_holdings_read_service"  ON public.persona_iqube_holdings;
DROP POLICY IF EXISTS "persona_iqube_holdings_write_service" ON public.persona_iqube_holdings;
CREATE POLICY "persona_iqube_holdings_read_service"  ON public.persona_iqube_holdings FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY "persona_iqube_holdings_write_service" ON public.persona_iqube_holdings FOR ALL    USING (auth.role() = 'service_role');

COMMENT ON TABLE public.persona_iqube_holdings IS
  'Per-persona projection of iQube ownership. Service-role only — all reads via the spine-gated /api/admin/* enrichment routes. The iQube Registry (registry_assets) remains the SoT; this table is the persona-grain projection.';
COMMENT ON COLUMN public.persona_iqube_holdings.persona_id IS
  'T0 — server-internal only. Resolver returns T1-safe projections.';
COMMENT ON COLUMN public.persona_iqube_holdings.trust_band IS
  'Snapshot at acquisition. The catalog row''s trust_band can change; this stays pinned to what the persona received.';
COMMENT ON COLUMN public.persona_iqube_holdings.instance_anchor IS
  'For unique instances — CID / token id / FactQube hash. Null = shared-seat asset. Part of the de-dup unique key.';
