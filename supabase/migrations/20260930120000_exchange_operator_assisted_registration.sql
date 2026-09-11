-- 20260930120000_exchange_operator_assisted_registration.sql
--
-- Operator-assisted custodial artifact registration for the Reciprocal
-- Artifact Exchange (PRD-IRL-AX-001) — a bound principal who cannot
-- themselves reach a deposit surface (e.g. a client-side bug blocking their
-- own bridge crossing) can, under explicit out-of-band authorization,
-- have an operator register their artifact on their behalf. This is
-- CUSTODIAL REGISTRATION, never principal impersonation: the artifact is
-- attributed to the bound principal, but is BLOCKED from freeze/signature
-- (services/research/reciprocalExchange.ts's declareFreeze/signInstrument)
-- until the bound principal themselves confirms it via
-- confirmOperatorAssistedArtifact — see that file's registerArtifactOperator
-- Assisted / confirmOperatorAssistedArtifact for the enforcing logic. This
-- migration only extends the schema; it changes nothing about how a normal
-- (principal-performed) deposit is written or read.
--
-- REUSE, NOT DUPLICATION (inv.engineering.036/037): this is an ADDITIVE
-- extension of the EXISTING exchange_artifacts table
-- (20260930020000_reciprocal_artifact_exchange.sql) and the EXISTING
-- origin_channel column (20260826010000_exchange_origin_channel.sql) — no
-- new table, no parallel artifact-record shape.
--
-- Idempotent, matching this migration set's own convention.

-- ─── 1. New columns — custodial registration provenance ─────────────────────

ALTER TABLE public.exchange_artifacts
  ADD COLUMN IF NOT EXISTS registering_operator_persona_id uuid,
  ADD COLUMN IF NOT EXISTS authority_basis text,
  ADD COLUMN IF NOT EXISTS pending_principal_attestation boolean NOT NULL DEFAULT false;

-- Data-level integrity: an operator-assisted row MUST carry both the
-- operator's id and the stated authority basis; every other origin_channel
-- MUST NOT set either (custodial registration is the ONLY path that writes
-- them — services/research/reciprocalExchange.ts's registerArtifactOperator
-- Assisted, never depositArtifact).
ALTER TABLE public.exchange_artifacts
  DROP CONSTRAINT IF EXISTS exchange_artifacts_operator_assisted_provenance_check;
ALTER TABLE public.exchange_artifacts
  ADD CONSTRAINT exchange_artifacts_operator_assisted_provenance_check
  CHECK (
    (origin_channel = 'operator-assisted'
      AND registering_operator_persona_id IS NOT NULL
      AND authority_basis IS NOT NULL)
    OR
    (origin_channel <> 'operator-assisted'
      AND registering_operator_persona_id IS NULL
      AND authority_basis IS NULL)
  );

-- ─── 2. origin_channel — add the 'operator-assisted' value ──────────────────
--
-- Rebuilds the CHECK constraint 20260826010000 installed, adding exactly one
-- value. Every existing row (native-ui/mcp) and every existing write path
-- (depositArtifact, declareFreeze, signInstrument — none of which are
-- modified by this migration) is unaffected.

ALTER TABLE public.exchange_artifacts
  DROP CONSTRAINT IF EXISTS exchange_artifacts_origin_channel_check;
ALTER TABLE public.exchange_artifacts
  ADD CONSTRAINT exchange_artifacts_origin_channel_check
  CHECK (origin_channel IN ('native-ui', 'mcp', 'operator-assisted'));

-- ─── 3. activity_receipts CHECK-constraint rebuild — two new action types ───
--
-- Wholesale rebuild per the drift-incident regression guard
-- (tests/activity-receipts-action-type-parity.test.ts): every migration that
-- extends services/receipts/activityReceiptService.ts's ActivityActionType
-- union must ALSO rebuild this constraint with the COMPLETE current list.
-- Carried forward VERBATIM from the last rebuild
-- (20260930090000_activity_receipts_locker_action_types.sql) plus exactly
-- two new 'exchange_*' entries this migration introduces.

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
    'principal_registration_mandate_signed',
    'agent_registry_transaction_signed',
    'horizen_registration_submitted',
    'horizen_registration_confirmed',
    'agent_registry_binding_recorded',
    'address_only_placeholder_superseded',
    'external_wallet_binding_migrated',
    'principal_wallet_provisioned',
    'principal_wallet_control_proven',
    'external_wallet_control_proven',
    'trust_dimension_incremented',
    'population_record_repaired',
    'population_record_excluded',
    'capability_invocation_requested',
    'capability_invocation_authorized',
    'capability_invocation_refused',
    'capability_invocation_completed',
    'pulse_enrollment_verified',
    'pulse_commitment_verified',
    'reconciliation_discrepancy_recorded',
    'pnl_service_verified',
    'orientation_ritual_completed',
    'pnl_service_registered',
    'agent_registry_activated',
    'agent_delegate_stood_up',
    'agent_delegation_anchor_repaired',
    'legacy_passport_linkage_reconciled',
    'implementation_execution_observed',
    'implementation_execution_returned',
    'commerce_action_authorised',
    'commerce_action_refused',
    'commerce_action_unresolved',
    'commerce_execution_bound',
    'commerce_execution_refused',
    'commerce_consequence_recorded',
    'exchange_created',
    'exchange_counterparty_joined',
    'exchange_artifact_deposited',
    'exchange_artifact_replaced',
    'exchange_freeze_declared',
    'exchange_instrument_signed',
    'exchange_crossed',
    'exchange_receipt_acknowledged',
    'exchange_comparison_opened',
    'exchange_derivative_created',
    'exchange_withdrawn',
    'exchange_access_revoked',
    'qubetalk_publication_published',
    'qubetalk_publication_withdrawn',
    'qubetalk_publication_projection_failed',
    'qubetalk_message_agent_sent',
    'qubetalk_group_message_agent_sent',
    'qubetalk_agent_approval_used',
    'qubetalk_endpoint_linked',
    'qubetalk_group_federated',
    'qubetalk_conversation_context_disclosure',
    'qubetalk_publication_projection_published',
    'locker_asset_registered',
    'locker_asset_version_created',
    'locker_roomqube_created',
    'locker_roomqube_member_invited',
    'locker_roomqube_asset_added',
    'locker_roomqube_conversation_opened',
    'locker_share_pack_composed',
    'locker_share_pack_approved',
    'locker_share_pack_sent',
    -- New this migration (operator-assisted custodial registration).
    'exchange_artifact_registered_operator_assisted',
    'exchange_operator_assisted_artifact_confirmed'
));
