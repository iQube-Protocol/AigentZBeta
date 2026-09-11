-- 20260929000000_venture_substrate_receipt_types.sql
--
-- VL-CT-001 venture substrate (charter R-6, 2026-07-29). Adds the nine
-- consequential action types of the opportunity→liability→settlement chain to
-- the activity_receipts action_type CHECK constraint:
--
--   venture_opportunity_opened      an opportunity was presented for assessment
--   venture_service_completed       an agent completed an authorised service
--   venture_completion_assessed     the seven-link constitutional verdict
--   venture_refusal_recorded        execution correctly declined -- a COMPLETED
--                                   constitutional service, never a failed trade
--   venture_obligation_earned       a liability came into existence
--   venture_obligation_approved     operator approval of an earned obligation
--   venture_settlement_simulated    simulated settlement (no live value moves)
--   venture_obligation_reversed     reversal or dispute of an obligation
--   venture_opportunity_closed      the opportunity reached a terminal state
--
-- WHY A MIGRATION IS REQUIRED, NOT OPTIONAL. The TypeScript
-- `ActivityActionType` union and this CHECK constraint are two declarations of
-- one vocabulary. Adding the members to the union alone would typecheck, pass
-- review, and then FAIL AT RUNTIME on the insert -- the drift incident
-- `tests/activity-receipts-action-type-parity.test.ts` exists to catch. Several
-- call sites wrap the receipt write in an empty catch, so the check violation
-- would be discarded with no log and the receipt AND its DVN anchor lost
-- silently.
--
-- ALL NINE ARE DVN-ANCHORABLE (added to ANCHORABLE_ACTION_TYPES per the one
-- change CLAUDE.md permits in that pipeline without prior approval). The
-- refusal path is the reason anchoring matters here: the claim that a justified
-- refusal was a completed service that earned compensation is otherwise a
-- database row asserting its own truth.
--
-- ORDINARY PREPARATION-COST LINES ARE DELIBERATELY ABSENT. They are batch
-- checkpointed into a recomputable commitment rather than individually
-- receipted -- one receipt per measured work event would drown the
-- consequential events the anchor exists to make findable.
--
-- The constraint is rebuilt in full -- the established pattern in this repo, so
-- the LATEST rebuild is always the complete vocabulary and the parity canary
-- has exactly one file to read.

ALTER TABLE public.activity_receipts
  DROP CONSTRAINT IF EXISTS activity_receipts_action_type_check;

ALTER TABLE public.activity_receipts
  ADD CONSTRAINT activity_receipts_action_type_check
  CHECK (action_type IN (
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
    'operator_action_logged',
    'standing_document_added',
    'partner_agent_evidence_recorded',
    'agent_delegated',
    'agent_delegation_revoked',
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
    'capability_registered',
    'capability_operationally_validated',
    'capability_deprecated',
    'research_lifecycle_transition',
    'experiment_result_published',
    'invariant_node_flipped',
    'agreement_formed',
    'agreement_authorized',
    'qubetalk_artifact_shared',
    'qubetalk_artifact_opened',
    'qubetalk_artifact_copied',
    'finance_authoritative_execution',
    'canonical_plate_composed',
    'plan_cancelled',
    'venture_blueprint_handoff',
    'standing_accrued',
    'standing_corrected',
    'workspace_report_published',
    -- VL-CT-001 venture substrate (2026-07-29).
    'venture_opportunity_opened',
    'venture_service_completed',
    'venture_completion_assessed',
    'venture_refusal_recorded',
    'venture_obligation_earned',
    'venture_obligation_approved',
    'venture_settlement_simulated',
    'venture_obligation_reversed',
    'venture_opportunity_closed'
));
