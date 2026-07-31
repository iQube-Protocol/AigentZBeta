-- Capability lifecycle — Archive (SPEC-MMC-002 §6.3 Phase 3, 2026-07-24) +
-- a drift-fix bundled into the SAME wholesale rebuild this migration was
-- already required to do.
--
-- ── Bug found in this pass (fixed here, not a new invention) ───────────────
-- The `activity_receipts_action_type_check` CHECK constraint was last
-- rebuilt wholesale by 20260719000000_constitutional_agreements.sql. Since
-- then, four action types were added to the TypeScript
-- `ActivityActionType` union (services/receipts/activityReceiptService.ts)
-- AND to `ANCHORABLE_ACTION_TYPES` (services/dvn/activityReceiptDvnPipeline.ts)
-- without a matching CHECK-constraint rebuild:
--   'qubetalk_artifact_shared', 'qubetalk_artifact_opened',
--   'qubetalk_artifact_copied'  (QubeTalk Peer Exchange, 2026-07-21)
--   'finance_authoritative_execution'  (MoneyPenny Runtime, PRD-MPY-001 P4-4)
-- This is exactly the "2026-07-15 constraint-drift incident" class of bug
-- every prior rebuild's own comment warns about: any `createActivityReceipt`
-- call with one of those four action types would hit the CHECK constraint
-- in production and throw (not a soft-fail — `isMissingTable`/
-- `isMissingColumn` don't match a check-violation error), silently losing
-- the receipt AND its DVN anchor. Fixed here by folding all four into this
-- rebuild alongside the new 'capability_deprecated' type this migration was
-- already adding. No DVN pipeline logic, state machine, or canister
-- interaction is touched — this is the SQL enum whitelist only, the same
-- kind of change every migration in this chain has made.
--
-- 'venture_blueprint_handoff' and 'standing_accrued' are retained from the
-- previous rebuild (still used by services/venture/blueprintHandoff.ts and
-- services/crm/standingAccrualService.ts respectively, via a local literal
-- rather than the ActivityActionType union) — removing them would be an
-- unrelated, unverified narrowing this pass has no reason to make.

ALTER TABLE activity_receipts
  DROP CONSTRAINT IF EXISTS activity_receipts_action_type_check;

ALTER TABLE activity_receipts
  ADD CONSTRAINT activity_receipts_action_type_check
  CHECK (action_type IN (
    'intent_queued','specialist_consulted','artifact_created','artifact_published','artifact_sent',
    'approval_granted','approval_rejected','experience_model_updated','session_started','session_completed',
    'passport_application_submitted','passport_issued','passport_status_changed',
    'passport_revoked','passport_privilege_changed','passport_infraction_recorded',
    'governance_decision_ratified','governance_decision_amended',
    'governance_authority_exercised','governance_escalation_triggered',
    'experience_task_completed',
    'agent_revocation_state_changed',
    'agent_delegated','agent_delegation_revoked',
    'operator_action_logged','standing_document_added',
    'plan_purchased','plan_renewed',
    'invariant_discovered','invariant_validated','invariant_canonized','invariant_superseded',
    'invariant_qube_published',
    'knowledge_curated','consequence_forecast_recorded','knowledge_evolved',
    'experience_render_validated',
    'implementation_pack_generated',
    'implementation_dispatched',
    'deployment_proposed',
    'constitutional_validation_recorded',
    'remediation_recorded',
    'deployment_authorized',
    'validation_override_granted',
    'research_lifecycle_transition',
    'experiment_result_published',
    'venture_blueprint_handoff',
    'standing_accrued',
    'capability_registered',
    'capability_operationally_validated',
    'invariant_node_flipped',
    'agreement_formed',
    'agreement_authorized',
    -- Drift fix (see file header) — already-shipped TS/DVN action types that
    -- were missing from this CHECK since their own migrations never rebuilt it.
    'qubetalk_artifact_shared',
    'qubetalk_artifact_opened',
    'qubetalk_artifact_copied',
    'finance_authoritative_execution',
    -- New this migration — Capability lifecycle Archive (SPEC-MMC-002 §6.3).
    'capability_deprecated'
  ));
