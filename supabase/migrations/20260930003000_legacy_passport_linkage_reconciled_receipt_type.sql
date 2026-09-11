-- 20260930003000_legacy_passport_linkage_reconciled_receipt_type.sql
--
-- Adds `legacy_passport_linkage_reconciled` — legacy Passport/personhood
-- linkage reconciliation (operator-directed, 2026-08-15).
--
-- A Citizen or Participant Passport issued before its kybe_identity_id /
-- root_identity_id anchors were written (the same issuance gap
-- loadUsablePassportByKybe's own header documents — "kybe_identity_id is
-- NULL on every ppc-* row in this deployment") had those two columns filled
-- via services/passport/legacyPassportLinkageRepair.ts, resolved through the
-- persona-cluster walk in resolveClusterPrincipalForPersona (never by
-- assuming root_identity.auth_user_id == personas.auth_profile_id — live
-- evidence disproves that equality). This is NOT §A.5 Passport consolidation:
-- no reissuance, no status transition, no new Passport row. Forward-looking
-- only: describes the RECONCILIATION act, dated to when it happened.
--
-- Wholesale CHECK-constraint rebuild per the drift-incident regression guard
-- (tests/activity-receipts-action-type-parity.test.ts) — every migration
-- that extends services/receipts/activityReceiptService.ts's
-- ActivityActionType union must ALSO rebuild this constraint with the
-- complete current list, never just append without the full set.

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
    'population_record_excluded',
    -- Governed Capability Invocation (Phase 4, 2026-08-06).
    'capability_invocation_requested',
    'capability_invocation_authorized',
    'capability_invocation_refused',
    'capability_invocation_completed',
    -- Receipted constitutional state (operator directive, 2026-08-08).
    'pulse_enrollment_verified',
    'pulse_commitment_verified',
    'reconciliation_discrepancy_recorded',
    -- P&L, independent of Pulse admission (operator directive, 2026-08-08).
    'pnl_service_verified',
    -- Threshold Journey — Orient stage (operator spec, 2026-08-09).
    'orientation_ritual_completed',
    -- Horizen Pilot Closure, part C (2026-08-09).
    'pnl_service_registered',
    -- Constitutional State Model Correction (operator-ratified, 2026-08-11).
    'agent_registry_activated',
    -- Aletheon Homecoming Stage 1 preflight (operator-directed, 2026-08-15).
    'agent_delegate_stood_up',
    -- Chrysalis Homecoming constitutional anchoring repair (operator-directed, 2026-08-15).
    'agent_delegation_anchor_repaired',
    -- Legacy Passport/personhood linkage reconciliation (operator-directed, 2026-08-15) — see this migration's own header.
    'legacy_passport_linkage_reconciled'
));

COMMIT;
