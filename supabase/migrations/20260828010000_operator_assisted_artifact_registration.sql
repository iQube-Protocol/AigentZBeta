-- 20260828010000_operator_assisted_artifact_registration.sql
--
-- Operator-assisted artifact registration for Reciprocal Artifact Exchange.
-- Adds support for a third party (administrator) to register Party B's artifact
-- on behalf of a principal who holds an active research-lab grant and verified
-- Passport, pending the principal's own attestation before freeze/sign proceed.
--
-- Enforces byte-level provenance verification (server-computed SHA-256) and
-- records three distinct evidentiary identities: bound principal, registering
-- operator, and delegated executing agent (where applicable).
--
-- All modifications are idempotent.

-- Add operator-assisted registration fields to exchange_artifacts
ALTER TABLE public.exchange_artifacts
  ADD COLUMN IF NOT EXISTS registering_operator_persona_id uuid,
  ADD COLUMN IF NOT EXISTS authority_basis text,
  ADD COLUMN IF NOT EXISTS pending_principal_attestation boolean NOT NULL DEFAULT false;

-- Constraint: operator-assisted provenance fields are present/absent together.
-- If one is set, all must be set (pending_principal_attestation gates freeze/sign).
ALTER TABLE public.exchange_artifacts
  ADD CONSTRAINT operator_assisted_provenance_coherence
    CHECK (
      (registering_operator_persona_id IS NOT NULL AND authority_basis IS NOT NULL)
      OR
      (registering_operator_persona_id IS NULL AND authority_basis IS NULL)
    );

-- Extend origin_channel enum to include operator-assisted
ALTER TYPE public.evidence_origin_channel RENAME TO evidence_origin_channel_v1;
CREATE TYPE public.evidence_origin_channel AS ENUM (
  'native-ui',
  'mcp',
  'operator-assisted'
);
ALTER TABLE public.exchange_artifacts
  ALTER COLUMN origin_channel TYPE public.evidence_origin_channel
    USING origin_channel::text::public.evidence_origin_channel;
DROP TYPE public.evidence_origin_channel_v1;

-- Extend activity_receipts action_type enum to include operator-assisted actions
ALTER TYPE public.activity_action_type RENAME TO activity_action_type_v1;
CREATE TYPE public.activity_action_type AS ENUM (
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
  'exchange_counterparty_joined',
  'exchange_artifact_deposited',
  'exchange_artifact_replaced',
  'exchange_freeze_declared',
  'exchange_instrument_signed',
  'exchange_receipt_acknowledged',
  'exchange_comparison_opened',
  'exchange_derivative_created',
  'exchange_artifact_registered_operator_assisted',
  'exchange_operator_assisted_artifact_confirmed'
);
ALTER TABLE public.activity_receipts
  ALTER COLUMN action_type TYPE public.activity_action_type
    USING action_type::text::public.activity_action_type;
DROP TYPE public.activity_action_type_v1;

-- Index for lookups on operator-assisted artifacts
CREATE INDEX IF NOT EXISTS exchange_artifacts_pending_attestation_idx
  ON public.exchange_artifacts (exchange_id, pending_principal_attestation)
  WHERE pending_principal_attestation = true;
