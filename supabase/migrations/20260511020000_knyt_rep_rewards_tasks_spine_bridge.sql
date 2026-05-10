-- =============================================================================
-- KNYT rep/rewards/tasks → spine bridge schema additions
--
-- Per the decisions doc §7 (CRM table → spine mapping):
--
--   crm_task_templates  → add cohort_id (drives RQH partition convention
--                          per §4 — reputation deltas key off `<cohort_id>:
--                          <persona_id>`)
--   crm_contributions   → add source_event_id (FK to orchestration_events
--                          for the spine receipt that paired with each
--                          state transition)
--   crm_rewards         → add source_event_id + claim_id (deferred-mint
--                          claim record); extend status check to include
--                          'pending_redemption' and 'redeemed' per §5
--                          (Phase C / D of the reward grant lifecycle)
--
-- All FK constraints to orchestration_events use NOT VALID per the same
-- pattern as 20260511010000_fix_user_entitlements_fk.sql — historical
-- rows pre-dating the spine receipts have NULL source_event_id values
-- and the FK should not validate against them.
--
-- This migration is column-additive and idempotent. Re-running it is
-- safe; columns are guarded by IF NOT EXISTS, constraints are
-- recreated via DROP CONSTRAINT IF EXISTS.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 1. crm_task_templates.cohort_id
-- ─────────────────────────────────────────────────────────────────────────
-- The cohort id drives the RQH reputation partition. The 3 General task
-- families (Bring-a-Knight, Knight-of-Attention, Herald-of-the-Order) all
-- use 'knyt:backers' per operator decision (decisions doc §13.1). Living
-- Canon templates use the existing seed cohorts.

ALTER TABLE crm_task_templates
  ADD COLUMN IF NOT EXISTS cohort_id TEXT;

-- Backfill: General task families → knyt:backers
UPDATE crm_task_templates
   SET cohort_id = 'knyt:backers'
 WHERE tenant_id = 'knyt'
   AND slug IN (
     'knyt:bring-a-knight',
     'knyt:knight-of-attention',
     'knyt:herald-of-the-order'
   )
   AND cohort_id IS NULL;

-- Living Canon families → knyt:backers (same default; admin can re-target later)
UPDATE crm_task_templates
   SET cohort_id = 'knyt:backers'
 WHERE tenant_id = 'knyt'
   AND slug IN (
     'knyt:dispatch',
     'knyt:theory',
     'knyt:observation'
   )
   AND cohort_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_crm_task_templates_cohort_id
  ON crm_task_templates (cohort_id) WHERE cohort_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. crm_contributions.source_event_id
-- ─────────────────────────────────────────────────────────────────────────
-- Links each state-changing transition (claimed → submitted, etc.) to the
-- spine OrchestrationEvent that received the alias-anchored receipt.
-- Historical rows have NULL — the FK is added NOT VALID so existing data
-- doesn't block the migration.

ALTER TABLE crm_contributions
  ADD COLUMN IF NOT EXISTS source_event_id UUID;

ALTER TABLE crm_contributions
  DROP CONSTRAINT IF EXISTS crm_contributions_source_event_id_fkey;

ALTER TABLE crm_contributions
  ADD CONSTRAINT crm_contributions_source_event_id_fkey
  FOREIGN KEY (source_event_id) REFERENCES orchestration_events(id) ON DELETE SET NULL
  NOT VALID;

CREATE INDEX IF NOT EXISTS idx_crm_contributions_source_event_id
  ON crm_contributions (source_event_id) WHERE source_event_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. crm_rewards.source_event_id + claim_id + status extension
-- ─────────────────────────────────────────────────────────────────────────
-- source_event_id   — pairs reward grants with the spine OrchestrationEvent
-- claim_id          — links to knyt_claims (deferred-mint pattern from §5).
--                     A reward in 'pending_redemption' status has a
--                     claim_id; redeeming the claim flips status to
--                     'redeemed' and the claim itself completes.
-- status enum       — extended to include 'pending_redemption' and
--                     'redeemed' so the deferred-mint lifecycle is
--                     representable: draft → approved → pending_redemption
--                                                              ↘ redeemed
--                                                              ↘ cancelled

ALTER TABLE crm_rewards
  ADD COLUMN IF NOT EXISTS source_event_id UUID,
  ADD COLUMN IF NOT EXISTS claim_id        UUID;

ALTER TABLE crm_rewards
  DROP CONSTRAINT IF EXISTS crm_rewards_source_event_id_fkey;
ALTER TABLE crm_rewards
  ADD CONSTRAINT crm_rewards_source_event_id_fkey
  FOREIGN KEY (source_event_id) REFERENCES orchestration_events(id) ON DELETE SET NULL
  NOT VALID;

ALTER TABLE crm_rewards
  DROP CONSTRAINT IF EXISTS crm_rewards_status_check;
ALTER TABLE crm_rewards
  ADD CONSTRAINT crm_rewards_status_check
  CHECK (status IN (
    'draft',
    'approved',
    'pending_redemption',
    'redeemed',
    'paid',
    'cancelled'
  ));

CREATE INDEX IF NOT EXISTS idx_crm_rewards_source_event_id
  ON crm_rewards (source_event_id) WHERE source_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_rewards_claim_id
  ON crm_rewards (claim_id) WHERE claim_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────
-- Notes for the operator
-- ─────────────────────────────────────────────────────────────────────────
-- After this migration applies, the spine-bridge schema is in place but
-- no behavioural change ships until Phase D wires the wallet UI to read
-- the new fields and Phase E + F finish the loop. Existing rows continue
-- to function — the NULL columns are tolerated everywhere.
--
-- The NOT VALID FK on source_event_id can later be promoted to VALIDATE
-- once historical rows are either backfilled or the audit window is
-- closed. Tracked in the legacy-persona-migration-style follow-up, not
-- this commit.
