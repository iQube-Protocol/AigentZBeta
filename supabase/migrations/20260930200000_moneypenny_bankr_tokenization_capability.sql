-- 20260930200000_moneypenny_bankr_tokenization_capability.sql
--
-- Factor + Aegis Bankr PRD, Phase 2 — registers `bankr_tokenization` as a
-- real capability descriptor on MoneyPenny's EXISTING registry_assets row
-- (asset_id='aigentqube-moneypenny'), the same row/pattern
-- 20260930000400_aigentqube_moneypenny_registry_asset.sql seeded
-- financial_advisory/financial_structure_design/bounded_financial_execution
-- onto. This is the ONE mechanism `resolveCapabilityProviders()`
-- (services/registry/capabilityProviderResolution.ts) actually reads —
-- `rowProvidesCapability()` matches a requested capabilityId against
-- `registry_assets.capabilities[].name` (via buildAgentBenchRow's
-- capabilityDescriptors projection), gated on the row's lifecycle state AND
-- an approved/active runtime membership. MoneyPenny already has an
-- APPROVED 'financial-services' runtime membership (the same one
-- financial_advisory/bounded_financial_execution already resolve through),
-- so this migration adds NO new membership — Bankr becomes resolvable
-- purely by extending the capability list on the row that already provides
-- MoneyPenny's other Financial Services.
--
-- Never a second registry mechanism, never a second row: this is additive
-- to the SAME jsonb array, guarded so a re-run cannot duplicate the entry
-- (checks containment before appending).
--
-- IMPORTANT — this migration registers Bankr for DISCOVERY/catalog
-- resolution only. It does NOT make bankr_tokenization operational: Factor's
-- own capability manifest (services/factor/factorCapabilityManifest.ts)
-- independently keeps `bankr_tokenization` at status='planned',
-- handlerKind='none' until Phase 5 wires a real handler, gate, and tests.
-- A capability being resolvable at the registry layer and a capability
-- being ACTIONABLE at the Factor-manifest layer are deliberately two
-- different questions — this migration answers only the first.

UPDATE registry_assets
SET
  capabilities = capabilities || '[{"name": "bankr_tokenization", "scope": "system"}]'::jsonb,
  updated_at = now()
WHERE asset_id = 'aigentqube-moneypenny'
  AND NOT (capabilities @> '[{"name": "bankr_tokenization"}]'::jsonb);
