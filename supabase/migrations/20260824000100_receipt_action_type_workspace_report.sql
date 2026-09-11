-- activity_receipts action_type CHECK — add 'workspace_report_published'
-- (Horizen Phase 3, 2026-07-27).
--
-- Aigent Z's administration of an ExperimentWorkspace writes ONE receipt per
-- run (services/experiments/workspaceReport.ts). The action type is added in
-- the same commit to:
--   - the TypeScript `ActivityActionType` union,
--   - `ANCHORABLE_ACTION_TYPES` in the DVN pipeline (the ONE unilateral change
--     that file permits — no state machine, payload, hashing or canister
--     interaction is touched),
--   - this CHECK constraint.
--
-- All three together, because the 2026-07-15 and 2026-07-26 drift incidents
-- were both caused by a type landing in some of these places and not others:
-- `next.config` sets `typescript.ignoreBuildErrors`, and receipt writes are
-- wrapped in empty catches, so a check violation is discarded in silence and
-- the receipt is simply never written.
--
-- The constraint is rebuilt WHOLESALE, as every migration in this chain is
-- required to do — a constraint cannot be appended to.

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
    'qubetalk_artifact_shared',
    'qubetalk_artifact_opened',
    'qubetalk_artifact_copied',
    'finance_authoritative_execution',
    'capability_deprecated',
    'canonical_plate_composed',
    'plan_cancelled',
    -- Horizen Phase 3 — Aigent Z's daily + weekly workspace report.
    'workspace_report_published'
  ));
