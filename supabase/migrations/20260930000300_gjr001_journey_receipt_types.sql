-- 20260930000300_gjr001_journey_receipt_types.sql
--
-- PRD-GJR-001 (Guided Journey Runtime) — the Horizen x MoneyPenny constitutional
-- admission pilot (codexes/packs/agentiq/updates/2026-07-30_prd-gjr-001-guided-journey-runtime.md).
-- Adds twelve action types to the activity_receipts action_type CHECK constraint,
-- one per genuinely-new step in the journey's ten-step canonical sequence (§3.5)
-- and its aigentMe destination (§5.10, §17). Reconciled 2026-07-31 against the
-- existing vocabulary via Explore-agent research (§22): six of the PRD's
-- eighteen originally-proposed types already existed under different names —
-- agent_delegated, partner_agent_evidence_recorded, finance_authoritative_execution,
-- standing_accrued, agreement_authorized — and are reused directly, not duplicated.
-- These twelve are the confirmed remainder with no existing equivalent:
--
--   agent_card_discovered                horizen_agent_registered
--   horizen_pnl_transparency_enabled      agent_card_enriched
--   agent_control_proven                  marketa_eligibility_recommended
--   operator_passport_validated           agent_sponsorship_recorded
--   agent_delegate_passport_issued        aigentme_activated
--   experienceqube_focus_disposition_recorded   journey_completed
--
-- WHY A MIGRATION IS REQUIRED, NOT OPTIONAL (same rationale as every prior
-- action-type migration in this file's lineage). The TypeScript
-- ActivityActionType union and this CHECK constraint are two declarations of
-- one vocabulary; adding the member to the union alone typechecks but fails at
-- runtime on insert. tests/activity-receipts-action-type-parity.test.ts is the
-- regression guard for this exact drift class.
--
-- All twelve are added to ANCHORABLE_ACTION_TYPES in
-- services/dvn/activityReceiptDvnPipeline.ts per the one change CLAUDE.md
-- permits there without prior approval — every stage of this journey must
-- produce a tamper-evident receipt, since a tamper-evident evidence chain is
-- exactly what the journey exists to demonstrate.
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
    'bitcent_treasury_etch_executed',
    -- PRD-GJR-001 (Guided Journey Runtime) — Horizen x MoneyPenny pilot (2026-07-31).
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
    'journey_completed'
));
