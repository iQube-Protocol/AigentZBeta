-- 20260930070000_qubetalk_publication_execution.sql
--
-- QubeTalk Communications Membrane — Publishing + Engagement, closing the
-- loop the schema already declared (20260930040000) but nothing yet
-- executed. services/qubetalk/publications.ts and services/qubetalk/
-- engagement.ts already fully implement PublicationQube/EngagementQube
-- against the existing qubetalk_publications/qubetalk_publication_projections/
-- qubetalk_engagements tables — this migration adds the four columns their
-- own logic needs but the original substrate never provisioned, plus one
-- idempotency guard. No new table (N1/N2) — every addition is a nullable
-- column or index on an existing table.
--
-- All statements additive/idempotent (ADD COLUMN IF NOT EXISTS, CREATE INDEX
-- IF NOT EXISTS) per this repo's migration-safety convention. No destructive
-- change to any existing table.

-- ═══════════════════════════════════════════════════════════════════════
-- 1. qubetalk_publications.body — the actual distributable excerpt/caption
--    text. Distinct from source_content_ref (a reference back to the
--    canonical content living in its originating cartridge/Codex, §11 of the
--    Publishing+Engagement brief — QubeTalk owns the publishing act, never
--    the canonical content itself). Nullable: a publication whose channel(s)
--    only need source_content_ref (e.g. a pure link-share) has no need for
--    body text.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.qubetalk_publications
  ADD COLUMN IF NOT EXISTS body text;

-- ═══════════════════════════════════════════════════════════════════════
-- 2. qubetalk_publication_projections.destination_ref — where THIS
--    projection actually publishes to (e.g. a Discord channel id/invite),
--    supplied at projection-creation time. Distinct from
--    external_publication_id/url, which are filled in AFTER a successful
--    publish with what the transport returned — destination_ref is the
--    caller's intent, those two are the transport's result.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.qubetalk_publication_projections
  ADD COLUMN IF NOT EXISTS destination_ref text;

-- ═══════════════════════════════════════════════════════════════════════
-- 3. qubetalk_engagements — duplicate webhook/poll delivery of the SAME
--    external engagement must not create a duplicate row. Same idempotency
--    pattern already established for passport_peer_messages'
--    external_message_id (20260930040000 §4.5) — a partial unique index so
--    a manually-recorded engagement (external_engagement_id NULL) is never
--    constrained.
-- ═══════════════════════════════════════════════════════════════════════

CREATE UNIQUE INDEX IF NOT EXISTS qubetalk_engagements_external_idempotency_uidx
  ON public.qubetalk_engagements (publication_projection_id, external_engagement_id)
  WHERE external_engagement_id IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════
-- 4. qubetalk_conversations.origin_engagement_id — provenance for
--    "publishing becomes conversation" (§9 of the brief): when
--    convertEngagementToConversation creates a new conversation,
--    qubetalk_engagements.converted_conversation_id already points FROM the
--    engagement TO the conversation; this is the reverse pointer, so a
--    Runtime/aigentMe surface displaying the conversation can show "this
--    began as a comment on Publication Y" without a second lookup table.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.qubetalk_conversations
  ADD COLUMN IF NOT EXISTS origin_engagement_id uuid REFERENCES public.qubetalk_engagements (id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS qubetalk_conversations_origin_engagement_idx
  ON public.qubetalk_conversations (origin_engagement_id) WHERE origin_engagement_id IS NOT NULL;

COMMENT ON COLUMN public.qubetalk_publications.body IS
  'Distributable excerpt/caption text actually sent to channels. Distinct from source_content_ref (a reference to canonical content QubeTalk never duplicates).';
COMMENT ON COLUMN public.qubetalk_publication_projections.destination_ref IS
  'Caller-supplied target for this projection (e.g. a Discord channel id/invite) — the publish intent, resolved at execution time. external_publication_id/url are the transport''s result, filled in only after a successful publish.';
COMMENT ON COLUMN public.qubetalk_conversations.origin_engagement_id IS
  'Set only when this conversation originated from converting a publication engagement to a private conversation (services/qubetalk/engagement.ts convertEngagementToConversation) — the reverse of qubetalk_engagements.converted_conversation_id, for provenance display.';

-- ═══════════════════════════════════════════════════════════════════════
-- 5. activity_receipts CHECK-constraint rebuild — one new action type,
--    'qubetalk_publication_projection_published', the per-destination
--    success receipt symmetric with the already-declared
--    'qubetalk_publication_projection_failed' (§12 of the Publishing +
--    Engagement brief: "projection success/failure" are both
--    receipt-worthy). Wholesale rebuild per the drift-incident regression
--    guard (tests/activity-receipts-action-type-parity.test.ts) — carried
--    forward verbatim from 20260930040000 plus this one addition.
-- ═══════════════════════════════════════════════════════════════════════

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
    -- New this migration.
    'qubetalk_publication_projection_published'
));
