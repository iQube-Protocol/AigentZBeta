-- 20260930010200_moneypenny_confidential_consequence_projection_capability.sql
--
-- Phase 3, item 5 (2026-08-23 operator directive, verbatim): "Before Stage
-- 3.3 activation, register the canonical MoneyPenny
-- CONFIDENTIAL_CONSEQUENCE_PROJECTION capability descriptor in Agent Bench
-- rather than aliasing bounded_financial_execution or changing Gate 2."
--
-- Gate 2's authoritative-mode exception is frozen to the single capability
-- id CONFIDENTIAL_CONSEQUENCE_PROJECTION
-- (services/registry/capabilityInvocationGates.ts's
-- CONSEQUENCE_PROJECTION_GATED_CAPABILITY). The live MoneyPenny Agent Bench
-- registry seed (20260930000400_aigentqube_moneypenny_registry_asset.sql)
-- never carried a descriptor by this exact name — its closest entry was
-- bounded_financial_execution, a documented, already-tracked "data change,
-- needs live credentials" gap
-- (docs/vela/VELA_EARLY_ACCESS_HANDOFF.md §6; see
-- services/financialServices/serviceCatalog.ts's MONEYPENNY_RUNTIME
-- comment). Without this row, `resolveCapabilityProviders(
-- 'CONFIDENTIAL_CONSEQUENCE_PROJECTION')` resolves zero providers for
-- MoneyPenny no matter what Gate 2 permits.
--
-- This migration registers the REAL descriptor additively — mirroring the
-- exact shallow jsonb-array-concatenation mechanism already used by
-- 20260810010000_kn0w1_horizen_admission_fields.sql,
-- 20260810000000_nakamoto_runtime_endpoint.sql and
-- 20260930002300_moneypenny_runtime_endpoint.sql — touching ONLY the
-- `capabilities` and `tags` columns and leaving every existing capability
-- (financial_advisory, financial_structure_design,
-- bounded_financial_execution, chat) and every existing metadata key
-- completely untouched. It does NOT alias bounded_financial_execution to
-- the new id, and it does NOT touch Gate 2 or any other capability's
-- authoritative-mode eligibility — the operator's explicit constraint.
--
-- `scope: 'system'` mirrors bounded_financial_execution's own scope (both
-- are execution-class capabilities, never conversational/content).

UPDATE registry_assets
SET
  capabilities = capabilities || jsonb_build_array(
    jsonb_build_object('name', 'CONFIDENTIAL_CONSEQUENCE_PROJECTION', 'scope', 'system')
  ),
  tags = tags || jsonb_build_array('confidential-consequence-projection', 'vela'),
  updated_at = now()
WHERE asset_id = 'aigentqube-moneypenny'
  AND NOT (capabilities @> '[{"name": "CONFIDENTIAL_CONSEQUENCE_PROJECTION"}]'::jsonb);
