-- Dev-loop + artifact receipt types (2026-07-15) — the constraint catch-up.
--
-- The activity_receipts action_type CHECK was last rebuilt on 2026-07-03
-- (20260703220000). EVERY receipt type added since then violated it and
-- SILENTLY failed to persist: implementation_pack_generated,
-- deployment_proposed, the three CFS-020 Dev Receipts classes
-- (constitutional_validation_recorded / remediation_recorded /
-- deployment_authorized), research_lifecycle_transition,
-- experiment_result_published, artifact_published, experience_render_validated,
-- and the 2026-07-14 dev-loop additions (implementation_dispatched,
-- validation_override_granted). Operator hit it live: "receipt creation
-- failed — the record is not persisted" on Record remediation — and the
-- merge validation gate could never open because its
-- constitutional_validation_recorded receipt never landed.
--
-- Rebuilds the CHECK with the COMPLETE ActivityActionType union
-- (services/receipts/activityReceiptService.ts) plus the anchorable extras
-- some writers use (venture_blueprint_handoff, standing_accrued).

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
    -- Capability pipeline + CFS-020 CDE Dev Receipts (all post-2026-07-03)
    'implementation_pack_generated',
    'implementation_dispatched',
    'deployment_proposed',
    'constitutional_validation_recorded',
    'remediation_recorded',
    'deployment_authorized',
    'validation_override_granted',
    'research_lifecycle_transition',
    'experiment_result_published',
    -- Anchorable extras written outside the core union
    'venture_blueprint_handoff',
    'standing_accrued'
  ));
