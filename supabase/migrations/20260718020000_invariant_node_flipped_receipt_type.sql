-- CFS-035 §11 — add the invariant_node_flipped action type to the
-- activity_receipts CHECK constraint.
--
-- The shadow→authoritative flip receipt (services/receipts/activityReceiptService.ts
-- + the /api/invariants/flip route) uses action_type = 'invariant_node_flipped',
-- and it is DVN-anchorable (ANCHORABLE_ACTION_TYPES). Without this the receipt
-- insert violates activity_receipts_action_type_check and the flip's on-chain
-- provenance is silently lost (the flip itself still succeeds — the receipt is
-- best-effort). This migration rebuilds the constraint with the complete union
-- plus the new type. It is the LATEST action-type migration, so re-running it is
-- safe (do NOT re-run an OLDER action-type migration — that would revert the
-- union and drop newer types).

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
    -- Invariant Engine ratification (CFS-035 §11)
    'invariant_node_flipped'
  ));
