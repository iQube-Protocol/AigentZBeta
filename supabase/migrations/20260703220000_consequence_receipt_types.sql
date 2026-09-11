-- Consequence Operating Model receipt types — Chrysalis Foundation Phase 3.
-- CFS-006a stage provenance: knowledge_curated (local), consequence_forecast_recorded
-- and knowledge_evolved (DVN-anchorable — the flywheel's constitutional-memory arc).
-- Additive: recreates the activity_receipts action_type CHECK with the complete
-- union (as of 20260703210000) plus the three consequence stage types.

ALTER TABLE activity_receipts
  DROP CONSTRAINT IF EXISTS activity_receipts_action_type_check;

ALTER TABLE activity_receipts
  ADD CONSTRAINT activity_receipts_action_type_check
  CHECK (action_type IN (
    'intent_queued','specialist_consulted','artifact_created','artifact_sent',
    'approval_granted','approval_rejected','experience_model_updated','session_started','session_completed',
    'passport_application_submitted','passport_issued','passport_status_changed',
    'passport_revoked','passport_privilege_changed','passport_infraction_recorded',
    'governance_decision_ratified','governance_decision_amended',
    'governance_authority_exercised','governance_escalation_triggered',
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
    -- Consequence Operating Model (Phase 3; CFS-006a)
    'knowledge_curated',
    'consequence_forecast_recorded',
    'knowledge_evolved'
  ));
