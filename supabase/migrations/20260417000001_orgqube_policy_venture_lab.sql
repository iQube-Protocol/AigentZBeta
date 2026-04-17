-- ============================================================================
-- OrgQube Policy — Venture Lab α
--
-- Adds a `targets` jsonb column to store intended future state for each
-- governance dimension, alongside the actual/current values. This lets the
-- panel display "actual vs target" for trust floor, posture, exposure, etc.
--
-- Also upserts the canonical Venture Lab α policy row:
--   trust_threshold_min = 25  (experimental — agents/skills not yet hardened)
--   target trust floor  = 70  (declared target once assets are hardened)
--   required_receipts   = per-state-change events, not per minor transaction
-- ============================================================================

ALTER TABLE public.orgqube_policies
  ADD COLUMN IF NOT EXISTS targets jsonb DEFAULT '{}';

INSERT INTO public.orgqube_policies (
  org_id,
  policy_name,
  allowed_agents,
  allowed_skills,
  allowed_cartridges,
  trust_threshold_min,
  skill_budget_posture,
  native_asset_exposure,
  required_receipts,
  targets
) VALUES (
  'venture-lab',
  'Venture Lab α Policy',
  ARRAY['aigent-z', 'aigent-c', 'aigent-kn0w1', 'aigent-marketa', 'metame'],
  ARRAY['*'],
  ARRAY['knyt', 'qriptopian', 'agentiq', 'metame'],
  25,
  'open',
  'none',
  ARRAY['agent:onboard', 'skill:grant', 'treasury:withdrawal', 'cartridge:publish'],
  '{
    "trustThresholdMin": 70,
    "skillBudgetPosture": "conservative",
    "nativeAssetExposure": "limited",
    "requiredReceipts": [
      "agent:onboard",
      "skill:grant",
      "trust:change",
      "treasury:withdrawal",
      "cartridge:publish"
    ]
  }'::jsonb
) ON CONFLICT (org_id) DO UPDATE SET
  policy_name           = EXCLUDED.policy_name,
  trust_threshold_min   = EXCLUDED.trust_threshold_min,
  skill_budget_posture  = EXCLUDED.skill_budget_posture,
  native_asset_exposure = EXCLUDED.native_asset_exposure,
  required_receipts     = EXCLUDED.required_receipts,
  targets               = EXCLUDED.targets,
  updated_at            = now();
