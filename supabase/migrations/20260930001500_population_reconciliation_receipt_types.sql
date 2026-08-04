-- 20260930001500_population_reconciliation_receipt_types.sql
--
-- Population Reconciliation Board (al, 2026-08-04, Track 2 Stage 5) — the two
-- executable treatments an operator applies to a promoted candidate the
-- Stage 4 -> Stage 5 handover could not account for ("17 declared, 15
-- received, 0 excluded, 2 unaccounted for"). One receipt per resolved
-- record, never a single batch receipt, so a partial batch failure
-- discloses exactly which records were treated and which were not.
--
-- See services/research/populationReconciliation.ts and
-- services/invariants/discoveryEngine.ts's
-- repairPromotedCandidateInvariantLink / excludeCandidateFromCrystal.

BEGIN;

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
    'bitcent_treasury_etch_executed',
    'agent_card_discovered',
    'horizen_agent_registered',
    'horizen_pnl_transparency_enabled',
    'agent_card_enriched',
    'agent_control_proven',
    'marketa_eligibility_recommended',
    'operator_passport_validated',
    'agent_sponsorship_recorded',
    'agent_delegate_passport_issued',
    'aigentme_activated',
    'experienceqube_focus_disposition_recorded',
    'journey_completed',
    'horizen_pulse_authorized',
    'marketa_eligibility_assessed',
    'marketa_eligibility_refused',
    'marketa_eligibility_quarantined',
    -- Wallet Signing Topology (operator ruling 2026-08-01) — Register vertical slice.
    'principal_registration_mandate_signed',
    'agent_registry_transaction_signed',
    'horizen_registration_submitted',
    'horizen_registration_confirmed',
    'agent_registry_binding_recorded',
    -- Wallet repair (operator ruling 2026-08-02) — single-persona pilot repair.
    'address_only_placeholder_superseded',
    'external_wallet_binding_migrated',
    'principal_wallet_provisioned',
    'principal_wallet_control_proven',
    'external_wallet_control_proven',
    -- Trust dimensions (operator ruling 2026-08-03).
    'trust_dimension_incremented',
    -- Population Reconciliation Board (al, 2026-08-04) — Track 2 Stage 5.
    'population_record_repaired',
    'population_record_excluded'
));

COMMIT;
