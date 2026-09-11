-- 20260930000200_bitcent_treasury_receipt_type.sql
--
-- Bitcent (B¢) treasury etch (2026-07-30). Adds one action type to the
-- activity_receipts action_type CHECK constraint: `bitcent_treasury_etch_executed`
-- — the real, testnet Bitcoin Runes etching transaction broadcast under the
-- pilot treasury authority gate (services/treasury/pilotTreasuryAuthority.js),
-- with an authorised mandate (operator passcode + Aigent Nakamoto required-
-- signatory approval + Aigent Kn0w1 observation).
--
-- WHY A MIGRATION IS REQUIRED, NOT OPTIONAL (same rationale as every prior
-- action-type migration in this file's lineage). The TypeScript
-- ActivityActionType union and this CHECK constraint are two declarations of
-- one vocabulary; adding the member to the union alone typechecks but fails at
-- runtime on insert. tests/activity-receipts-action-type-parity.test.ts is the
-- regression guard for this exact drift class.
--
-- Added to ANCHORABLE_ACTION_TYPES per the one change CLAUDE.md permits in
-- services/dvn/activityReceiptDvnPipeline.ts without prior approval.
--
-- The constraint is rebuilt in full — the established pattern in this repo,
-- so the LATEST rebuild is always the complete vocabulary and the parity
-- canary has exactly one file to read.

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
    'qriptocent_native_issuance_executed',
    'independent_review_completed',
    -- Bitcent (B¢) treasury etch (2026-07-30).
    'bitcent_treasury_etch_executed'
));
