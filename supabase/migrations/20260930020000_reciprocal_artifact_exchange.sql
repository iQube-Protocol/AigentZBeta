-- 20260930020000_reciprocal_artifact_exchange.sql
--
-- Reciprocal Artifact Exchange (PRD-IRL-AX-001) — a GENERIC IRL capability
-- for a bilateral, receipted exchange of independently frozen research
-- artifacts between two collaborating parties, gated by a reciprocal
-- disclosure policy and a lightweight signing ritual. NOT architecture- or
-- OCSGA-specific: the first dogfood instance (IRL-AX-001, CI/IRL × OCSGA) is
-- seeded separately, never baked into this schema.
--
-- REUSE, NOT DUPLICATION (inv.engineering.036/037):
--   - invitation/claim lifecycle mirrors x409_invitations (20260724000000) —
--     a bearer capability code stored ONLY as a sha256 hash, one claim.
--   - identity resolution reuses the spine (getActivePersona) — no parallel
--     persona resolver.
--   - constitutional receipts ride the EXISTING activity_receipts table via
--     createActivityReceipt (services/receipts/activityReceiptService.ts) —
--     this migration only extends its action_type CHECK, per the ONE
--     permitted unilateral DVN-pipeline change (CLAUDE.md "DVN Pipeline
--     Protection"). No new receipt table, no new anchoring mechanism.
--   - QubeTalk reuses services/qubetalk/peerChannel.ts's existing peer
--     channel primitive (qubetalk_channel_id references that channel's id;
--     no new messaging table).
--
-- WHY DEDICATED TABLES RATHER THAN THE GENERIC `research_objects` JSONB
-- table (services/research/lifecycle.ts): that table is explicitly scoped
-- to the durable lab record for approved research objects/artifacts with NO
-- identity/party columns at all (by design — it is T2-safe by construction).
-- This capability needs typed, indexed, per-party columns (party slot,
-- signature state, disclosure gating, versioned artifact supersession) that
-- a jsonb blob table cannot express without every consumer re-deriving the
-- same shape from an untyped payload — exactly the illegibility
-- services/research/reviewerAgreement.ts's own header names as the reason
-- NOT to force a different-shaped concept into an existing table.
--
-- T0/T2 DISCIPLINE: persona ids are stored server-side only (same exposure
-- class as access_grants / reviewer_agreement_authorizations — owner-scoped
-- rows, service-role RLS, never a client-side read). Receipts and any
-- chain/DVN-bound payload carry personaPublicRef commitments only, never a
-- raw persona id — enforced in services/research/reciprocalExchange.ts, not
-- in this schema (the schema's own RLS has no client policies at all).
--
-- All statements are idempotent (CREATE TABLE IF NOT EXISTS, ON CONFLICT DO
-- NOTHING/UPDATE where relevant) per this repo's migration-safety convention.

-- ─── 1. The exchange record ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.reciprocal_exchanges (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exchange_type               text NOT NULL DEFAULT 'independent-artifact-comparison'
                                 CHECK (exchange_type IN ('independent-artifact-comparison')),
  title                       text NOT NULL,
  purpose                     text NOT NULL,
  research_question           text,

  -- Party A (initiator) is always a resolved persona at creation time — a
  -- human constitutional act, same discipline as /api/participation/claim.
  initiator_persona_id        uuid NOT NULL,
  -- Party B (counterparty) is null until the exchange's own invite code is
  -- claimed (B_JOINED). Never guessed/pre-filled.
  counterparty_persona_id     uuid,

  research_space_id           uuid,
  cohort_id                   uuid,

  status                      text NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
                                'DRAFT','A_DEPOSITED','INVITED','B_JOINED','B_DEPOSITED',
                                'READY_TO_SIGN','A_SIGNED','B_SIGNED','EXCHANGED',
                                'RECEIPT_ACKNOWLEDGED','COMPARISON_OPEN','COMPLETED',
                                'DECLINED','WITHDRAWN_PRE_EXCHANGE','ARTIFACT_REPLACEMENT_REQUIRED',
                                'SIGNATURE_EXPIRED','DISPUTED','REVOKED_ACCESS_POST_EXCHANGE'
                              )),

  disclosure_policy           text NOT NULL DEFAULT 'RECIPROCAL_AFTER_BOTH_DEPOSIT'
                                 CHECK (disclosure_policy IN (
                                   'RECIPROCAL_AFTER_BOTH_DEPOSIT','IMMEDIATE_ON_DEPOSIT','MANIFEST_BEFORE_CONTENT'
                                 )),
  comparison_policy           text,

  -- IP / confidentiality (PRD §16) — explicit, never inferred.
  confidentiality_class       text NOT NULL DEFAULT 'confidential-bilateral',
  permitted_purpose           text NOT NULL,
  ownership_declaration       text NOT NULL DEFAULT
    'Each deposited artifact remains owned and governed by its originating party. Recording this exchange confers no ownership transfer.',
  derivative_analysis_permitted boolean NOT NULL DEFAULT true,
  publication_permitted       boolean NOT NULL DEFAULT false,
  retention_policy             text,
  agreement_ref                text,

  -- The exchange's own bearer invitation for Party B — mirrors
  -- x409_invitations' pattern of a self-contained code bound to ONE object,
  -- rather than overloading access_invitations (which is domain/role
  -- scoped, not exchange-scoped). Hash only; raw code shown once.
  invite_code_hash             text,
  invite_expires_at            timestamptz,

  -- QubeTalk peer channel id (services/qubetalk/peerChannel.ts) — set once
  -- Party B joins and a channel is opened between the two principals.
  qubetalk_channel_id          uuid,

  parent_experiment_id         text,
  derived_experiment_id        text,

  created_at                   timestamptz NOT NULL DEFAULT now(),
  updated_at                   timestamptz NOT NULL DEFAULT now(),
  opened_at                    timestamptz,
  completed_at                 timestamptz
);

CREATE INDEX IF NOT EXISTS reciprocal_exchanges_initiator_idx
  ON public.reciprocal_exchanges (initiator_persona_id, status);
CREATE INDEX IF NOT EXISTS reciprocal_exchanges_counterparty_idx
  ON public.reciprocal_exchanges (counterparty_persona_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS reciprocal_exchanges_invite_code_hash_idx
  ON public.reciprocal_exchanges (invite_code_hash) WHERE invite_code_hash IS NOT NULL;

ALTER TABLE public.reciprocal_exchanges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS reciprocal_exchanges_service_all ON public.reciprocal_exchanges;
CREATE POLICY reciprocal_exchanges_service_all ON public.reciprocal_exchanges
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── 2. Per-party deposited artifacts (PRD §7) ───────────────────────────────

CREATE TABLE IF NOT EXISTS public.exchange_artifacts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exchange_id           uuid NOT NULL REFERENCES public.reciprocal_exchanges(id) ON DELETE CASCADE,
  party                 text NOT NULL CHECK (party IN ('A','B')),
  title                 text NOT NULL,
  artifact_class        text NOT NULL,
  description           text,
  -- Monotonic per (exchange_id, party) — a replacement is a NEW row with the
  -- version incremented and supersedes_artifact_id set; the superseded row
  -- is NEVER updated or deleted (immutable frozen artifact, PRD §17/§21).
  version               integer NOT NULL DEFAULT 1,
  source_type           text NOT NULL CHECK (source_type IN ('upload','repository-commit','immutable-reference','manifest')),
  -- For repository-commit: repo-relative path + pinned commit SHA. For
  -- upload/immutable-reference/manifest: the reference string appropriate to
  -- that source type (storage path, CID, manifest URI). NEVER a mutable
  -- branch URL for a Git-backed artifact (PRD §7).
  source_reference      text NOT NULL,
  content_hash          text,
  repository_commit     text,
  storage_reference     text,
  mime_type             text,
  confidentiality_class text NOT NULL DEFAULT 'confidential-bilateral',
  ownership_declaration text NOT NULL,
  rights_for_exchange   text NOT NULL,
  supersedes_artifact_id uuid REFERENCES public.exchange_artifacts(id),
  deposited_at          timestamptz NOT NULL DEFAULT now(),
  deposit_receipt_id    uuid
);

CREATE INDEX IF NOT EXISTS exchange_artifacts_exchange_party_idx
  ON public.exchange_artifacts (exchange_id, party, version DESC);

ALTER TABLE public.exchange_artifacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS exchange_artifacts_service_all ON public.exchange_artifacts;
CREATE POLICY exchange_artifacts_service_all ON public.exchange_artifacts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── 3. Attestations — freeze declarations, instrument signatures, receipt
--        acknowledgments (PRD §8, §9, §18) — append-only, never edited. ─────

CREATE TABLE IF NOT EXISTS public.exchange_attestations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exchange_id     uuid NOT NULL REFERENCES public.reciprocal_exchanges(id) ON DELETE CASCADE,
  party           text NOT NULL CHECK (party IN ('A','B')),
  act_type        text NOT NULL CHECK (act_type IN ('freeze_declaration','instrument_signature','receipt_acknowledgment')),
  -- The artifact VERSION this attestation covers (null for
  -- receipt_acknowledgment, which covers the exchange as a whole). Pins
  -- validity so an ARTIFACT_REPLACEMENT invalidates a stale attestation
  -- WITHOUT deleting or editing this row — see services/research/
  -- reciprocalExchange.ts's `isAttestationCurrent`.
  artifact_version integer,
  -- 'principal' | 'delegated_agent' — resolved SERVER-SIDE from
  -- resolveConstitutionalContext, never from client input. freeze_declaration
  -- and instrument_signature MUST be 'principal' (enforced in the service,
  -- not just here) — an agent's action must never stand in for the required
  -- human attestation (CLAUDE.md "Authority / Agent discipline").
  actor_type      text NOT NULL DEFAULT 'principal' CHECK (actor_type IN ('principal','delegated_agent')),
  statement_text  text NOT NULL,
  attested_at     timestamptz NOT NULL DEFAULT now(),
  receipt_id      uuid,
  CONSTRAINT exchange_attestations_principal_required_acts
    CHECK (act_type NOT IN ('freeze_declaration','instrument_signature') OR actor_type = 'principal')
);

CREATE INDEX IF NOT EXISTS exchange_attestations_exchange_party_idx
  ON public.exchange_attestations (exchange_id, party, act_type);

ALTER TABLE public.exchange_attestations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS exchange_attestations_service_all ON public.exchange_attestations;
CREATE POLICY exchange_attestations_service_all ON public.exchange_attestations
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── 4. The bilateral Exchange Receipt (PRD §10) — structured, immutable ────

CREATE TABLE IF NOT EXISTS public.exchange_receipts (
  id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exchange_id                     uuid NOT NULL UNIQUE REFERENCES public.reciprocal_exchanges(id) ON DELETE CASCADE,
  -- The activity_receipts row this rides on for DVN anchoring — ONE receipt
  -- mechanism, never a parallel one (createActivityReceipt, action_type
  -- 'exchange_crossed').
  activity_receipt_id             uuid,
  party_a_artifact_id             uuid NOT NULL REFERENCES public.exchange_artifacts(id),
  party_b_artifact_id             uuid NOT NULL REFERENCES public.exchange_artifacts(id),
  party_a_artifact_version        integer NOT NULL,
  party_b_artifact_version        integer NOT NULL,
  party_a_fingerprint             text,
  party_b_fingerprint             text,
  party_a_freeze_attestation_id   uuid NOT NULL REFERENCES public.exchange_attestations(id),
  party_b_freeze_attestation_id   uuid NOT NULL REFERENCES public.exchange_attestations(id),
  party_a_signature_attestation_id uuid NOT NULL REFERENCES public.exchange_attestations(id),
  party_b_signature_attestation_id uuid NOT NULL REFERENCES public.exchange_attestations(id),
  disclosure_policy               text NOT NULL,
  confidentiality_class_ref       text NOT NULL,
  purpose                         text NOT NULL,
  crossed_at                      timestamptz NOT NULL DEFAULT now(),
  -- PRD §10's human-readable compression, generated ONCE at crossing and
  -- frozen here — must never assert informational isolation (guarded in the
  -- service by assertNoIsolationClaim before this row is written).
  human_readable_summary          text NOT NULL
);

ALTER TABLE public.exchange_receipts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS exchange_receipts_service_all ON public.exchange_receipts;
CREATE POLICY exchange_receipts_service_all ON public.exchange_receipts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── 5. Comparison workspace shell (PRD §15) — read-only, immutably linked ──

CREATE TABLE IF NOT EXISTS public.exchange_comparisons (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exchange_id           uuid NOT NULL UNIQUE REFERENCES public.reciprocal_exchanges(id) ON DELETE CASCADE,
  party_a_artifact_id   uuid NOT NULL REFERENCES public.exchange_artifacts(id),
  party_b_artifact_id   uuid NOT NULL REFERENCES public.exchange_artifacts(id),
  opened_at             timestamptz NOT NULL DEFAULT now(),
  opened_by_persona_id  uuid NOT NULL,
  status                text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed'))
);

ALTER TABLE public.exchange_comparisons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS exchange_comparisons_service_all ON public.exchange_comparisons;
CREATE POLICY exchange_comparisons_service_all ON public.exchange_comparisons
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── 6. Derivative lineage (PRD §15, §21) — never mutates frozen sources ────

CREATE TABLE IF NOT EXISTS public.exchange_derivatives (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comparison_id         uuid NOT NULL REFERENCES public.exchange_comparisons(id) ON DELETE CASCADE,
  exchange_id           uuid NOT NULL REFERENCES public.reciprocal_exchanges(id) ON DELETE CASCADE,
  title                 text NOT NULL,
  description           text NOT NULL,
  -- Lineage pointer — the frozen exchange_artifacts rows this derivative was
  -- produced from. The referenced rows are NEVER updated by this table.
  source_artifact_ids   uuid[] NOT NULL,
  classification        text CHECK (classification IN ('COMPATIBLE','AMBIGUOUS','CONFLICTING','REDUNDANT','UNRESOLVED')),
  compatibility_kind    text CHECK (compatibility_kind IN ('DISCOVERED','CREATED')),
  created_by_persona_id uuid NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS exchange_derivatives_comparison_idx ON public.exchange_derivatives (comparison_id);

ALTER TABLE public.exchange_derivatives ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS exchange_derivatives_service_all ON public.exchange_derivatives;
CREATE POLICY exchange_derivatives_service_all ON public.exchange_derivatives
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── 7. activity_receipts CHECK-constraint rebuild — new action types ───────
--
-- Wholesale rebuild per the drift-incident regression guard
-- (tests/activity-receipts-action-type-parity.test.ts): every migration that
-- extends services/receipts/activityReceiptService.ts's ActivityActionType
-- union must ALSO rebuild this constraint with the COMPLETE current list,
-- carried forward verbatim from 20260930010100 plus the eleven new
-- 'exchange_*' types this capability introduces.

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
    -- Reciprocal Artifact Exchange (PRD-IRL-AX-001, this migration).
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
    'exchange_access_revoked'
));
