-- =============================================================================
-- crm_task_templates — editable per-task reward caps
--
-- Adds two columns enabling the admin Tasks & Rewards tab to control
-- per-task rate limits without redeploying the rewardService constant:
--
--   cap_max_per_period   INTEGER (nullable)   — number of grants allowed
--   cap_period_days      INTEGER (nullable)   — sliding-window length in days
--
-- NULL semantics: when both are NULL the task has NO cap (matches the
-- existing `null` REWARD_CAPS entries). When set, rewardService.checkRewardCap
-- prefers these values over the legacy REWARD_CAPS constant.
--
-- Backfill matches the existing REWARD_CAPS constants in
-- services/rewards/rewardService.ts. New constant for
-- BringAKnightQualifiedReferral added per the alpha-readiness audit
-- recommendation (100 referrals per year per persona — limits ref-code farms).
--
-- Idempotent — safe to re-run. Columns guarded by IF NOT EXISTS;
-- backfill is conditional on the column being NULL so existing
-- operator edits via the admin tab are not overwritten on re-run.
-- =============================================================================

ALTER TABLE crm_task_templates
  ADD COLUMN IF NOT EXISTS cap_max_per_period INTEGER;
ALTER TABLE crm_task_templates
  ADD COLUMN IF NOT EXISTS cap_period_days    INTEGER;

-- Backfill defaults — only fill if the operator hasn't already set values.
UPDATE crm_task_templates
   SET cap_max_per_period = 10, cap_period_days = 7
 WHERE tenant_id = 'knyt'
   AND slug = 'knyt:knight-of-attention'
   AND cap_max_per_period IS NULL;

-- Bring-a-Knight: new cap per alpha-readiness audit (100/year).
UPDATE crm_task_templates
   SET cap_max_per_period = 100, cap_period_days = 365
 WHERE tenant_id = 'knyt'
   AND slug = 'knyt:bring-a-knight'
   AND cap_max_per_period IS NULL;

-- Herald-of-the-Order: covers all three variant grants (click/signup/
-- conversion) at the most restrictive shared cap. Conversion is the
-- highest-value variant — 50/year matches the audit recommendation.
UPDATE crm_task_templates
   SET cap_max_per_period = 50, cap_period_days = 365
 WHERE tenant_id = 'knyt'
   AND slug = 'knyt:herald-of-the-order'
   AND cap_max_per_period IS NULL;

COMMENT ON COLUMN crm_task_templates.cap_max_per_period IS
  'Editable reward cap: max grants per persona per cap_period_days window. ' ||
  'NULL = no cap. Read by services/rewards/rewardService.checkRewardCap.';
COMMENT ON COLUMN crm_task_templates.cap_period_days IS
  'Editable reward cap: sliding-window length in days. ' ||
  'NULL = no cap. Paired with cap_max_per_period.';
