-- 20260904000000_partner_agent_evidence_receipt_type.sql
--
-- Adds `partner_agent_evidence_recorded` to the activity_receipts action_type
-- CHECK constraint (metaProof × Horizen Labs pilot, operator ruling
-- 2026-07-28: "wire correlateAgent into the DVN pipeline, emit a metaMe
-- constitutional evidence record").
--
-- WHY A MIGRATION IS REQUIRED, NOT OPTIONAL. The TypeScript
-- `ActivityActionType` union and this CHECK constraint are two declarations of
-- one vocabulary. Adding the member to the union alone would typecheck, pass
-- review, and then FAIL AT RUNTIME on the insert — the drift incident
-- `tests/activity-receipts-action-type-parity.test.ts` exists to catch, and
-- did catch, before this shipped.
--
-- WHAT THE ACTION TYPE RECORDS. A correlated EXTERNAL agent identity: a
-- Horizen Agent Registry record, its canonical network-qualified ERC-8004
-- identity, and (when present) its Pulse enrollment and validation proof —
-- carrying the Agent Card sha256 commitment plus the zkVerify attestation and
-- adapter transaction identifiers of the external proof.
--
-- It is DVN-anchorable (added to ANCHORABLE_ACTION_TYPES per the one change
-- CLAUDE.md permits in that pipeline without prior approval). Anchoring our
-- record of someone else's attestation is the point: it makes the claim "we
-- saw this proof, at this time, for this agent" tamper-evident on our side,
-- independent of the partner's own infrastructure.
--
-- The constraint is rebuilt in full — the established pattern in this repo, so
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
    -- metaProof × Horizen Labs pilot (2026-07-28).
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
    'workspace_report_published'
));
