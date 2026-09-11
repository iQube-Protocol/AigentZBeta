-- 20260929000300_qriptocent_settlement_receipt_types.sql
--
-- QriptoCENT cross-denomination settlement (2026-07-29). Adds the twelve
-- consequential action types of the DVN-mediated inter-ledger settlement
-- substrate to the activity_receipts action_type CHECK constraint.
--
-- ─── THE THREE MECHANISMS ARE SEPARATE, AND SO ARE THEIR ACTION TYPES ───────
--
-- SETTLEMENT (moves value between native ledgers, NEVER mints):
--   qriptocent_payment_instruction_accepted    an instruction was accepted
--   qriptocent_settlement_authority_verified   delegated authority + payer balance
--   qriptocent_source_debit_initiated          the payer was debited on the source ledger
--   qriptocent_source_debit_finalised          the debit reached the declared finality policy
--   qriptocent_settlement_message_verified     the DVN settlement message authenticated
--   qriptocent_destination_liquidity_reserved  native destination liquidity earmarked
--   qriptocent_destination_credit_completed    the beneficiary was credited
--   qriptocent_settlement_reconciled           both sides bilaterally reconciled
--   qriptocent_settlement_exception_recorded   expiry, failure, obligation or reversal
--
-- LIQUIDITY ASSURANCE (can slow or refuse a settlement; can never mint):
--   qriptocent_liquidity_proof_verified        the destination liquidity band assessed
--
-- ISSUANCE (creates new native supply against proven reserves — a governed act
-- even when automated, and NEVER disguised as settlement):
--   qriptocent_replenishment_authorised        replenishment authorised against a reserve proof
--   qriptocent_native_issuance_executed        native supply minted, derived from the reference value
--
-- The issuance pair carries its own action types deliberately. Recording a mint
-- under a settlement type would let new supply be read as a payment, which is
-- the exact collapse the constitution prohibits.
--
-- WHY A MIGRATION IS REQUIRED, NOT OPTIONAL. The TypeScript ActivityActionType
-- union and this CHECK constraint are two declarations of one vocabulary.
-- Adding the members to the union alone would typecheck, pass review, and then
-- FAIL AT RUNTIME on the insert -- the drift incident
-- tests/activity-receipts-action-type-parity.test.ts exists to catch. Several
-- call sites wrap the receipt write in an empty catch, so the check violation
-- would be discarded with no log and the receipt AND its DVN anchor lost
-- silently. With no lock pool behind a destination credit, that receipt is the
-- only evidence the credit was backed.
--
-- ALL TWELVE ARE DVN-ANCHORABLE (added to ANCHORABLE_ACTION_TYPES per the one
-- change CLAUDE.md permits in that pipeline without prior approval).
--
-- PHASE 1 EMITS NOTHING LIVE. The substrate is a deterministic simulation and
-- its journal guard THROWS on any attempt to persist or anchor a fixture
-- receipt. This migration installs the vocabulary BEFORE the door opens, not
-- after the first silent loss.
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
    'venture_opportunity_opened',
    'venture_service_completed',
    'venture_completion_assessed',
    'venture_refusal_recorded',
    'venture_obligation_earned',
    'venture_obligation_approved',
    'venture_settlement_simulated',
    'venture_obligation_reversed',
    'venture_opportunity_closed',
    -- QriptoCENT cross-denomination settlement (2026-07-29).
    'qriptocent_payment_instruction_accepted',
    'qriptocent_settlement_authority_verified',
    'qriptocent_source_debit_initiated',
    'qriptocent_source_debit_finalised',
    'qriptocent_settlement_message_verified',
    'qriptocent_destination_liquidity_reserved',
    'qriptocent_destination_credit_completed',
    'qriptocent_settlement_reconciled',
    'qriptocent_settlement_exception_recorded',
    'qriptocent_liquidity_proof_verified',
    'qriptocent_replenishment_authorised',
    'qriptocent_native_issuance_executed'
));
