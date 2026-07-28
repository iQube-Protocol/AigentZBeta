-- Capability Standing correction receipts (operator ruling, 2026-07-28).
--
-- WHY A NEW ACTION TYPE. Capability Standing is written to a MONOTONE ledger:
-- `Math.max(existing.capability, newScore)`. That rule protects earned history
-- from ordinary signal fluctuation and is correct. It also means a score
-- inflated by a DEFECTIVE FORMULA can never come down through the ordinary
-- accrual path — every correction is discarded as `delta <= 0`.
--
-- The operator's ruling draws the line:
--
--   "Monotone accrual protects earned history from ordinary signal
--    fluctuation; it does not prohibit an attributable correction of a
--    defective scoring function."
--
-- `standing_corrected` is therefore a DISTINCT act from `standing_accrued`,
-- not a variant of it. Ordinary accrual can only raise; only a correction can
-- lower, and a correction must name the superseded formula version it is
-- correcting. Sharing one action type would make the two indistinguishable in
-- the receipt trail — which is exactly what an auditor needs to tell apart.
--
-- THIS LIST WAS GENERATED FROM 20260824000100 BY SCRIPT, NOT HAND-TRANSCRIBED.
-- A hand-copied constraint list dropped two types earlier today and failed the
-- operator's run. Regenerate; never retype.

ALTER TABLE public.activity_receipts
  DROP CONSTRAINT IF EXISTS activity_receipts_action_type_check;

ALTER TABLE public.activity_receipts
  ADD CONSTRAINT activity_receipts_action_type_check CHECK (
    action_type IN (
    'intent_queued',
    'specialist_consulted',
    'artifact_created',
    'artifact_published',
    'artifact_sent',
    'approval_granted',
    'approval_rejected',
    'experience_model_updated',
    'session_started',
    'session_completed',
    'passport_application_submitted',
    'passport_issued',
    'passport_status_changed',
    'passport_revoked',
    'passport_privilege_changed',
    'passport_infraction_recorded',
    'governance_decision_ratified',
    'governance_decision_amended',
    'governance_authority_exercised',
    'governance_escalation_triggered',
    'experience_task_completed',
    'agent_revocation_state_changed',
    'agent_delegated',
    'agent_delegation_revoked',
    'operator_action_logged',
    'standing_document_added',
    'plan_purchased',
    'plan_renewed',
    'invariant_discovered',
    'invariant_validated',
    'invariant_canonized',
    'invariant_superseded',
    'invariant_qube_published',
    'knowledge_curated',
    'consequence_forecast_recorded',
    'knowledge_evolved',
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
    'qubetalk_artifact_shared',
    'qubetalk_artifact_opened',
    'qubetalk_artifact_copied',
    'finance_authoritative_execution',
    'capability_deprecated',
    'canonical_plate_composed',
    'plan_cancelled',
    'workspace_report_published',
    'standing_corrected'
  )
);
