-- 20260930000500_partner_authorization_requests.sql
--
-- GJR-VFY-001 (Horizen Transparency Authorization and Wallet-Signing
-- Capability), Phase 1 — operator ruling 2026-07-31: "Add a tracked migration
-- for the authorization records and any required key metadata, but do not
-- redesign agent_keys globally yet."
--
-- ONE ROW PER AUTHORIZATION REQUEST, carried through its own state machine
-- (PREPARED -> AWAITING_SIGNATURE -> SIGNED -> SUBMITTED -> CONFIRMED, or a
-- terminal REFUSED/EXPIRED/QUARANTINED). This is a state machine on one row,
-- not a supersede-chain — unlike Independent Review, one authorization
-- request has one lifecycle, not competing later versions.
--
-- PARTNER-AGNOSTIC SHAPE, HORIZEN-ONLY WRITER. `partner` is a column, not a
-- table name, so a second partner authorization flow never needs a parallel
-- table. Phase 1 only ever writes partner='horizen' rows — see
-- services/horizen/authorizationClient.ts and
-- services/horizen/partnerAuthorizationStore.ts (the only reader/writer).
--
-- NEVER PLAINTEXT KEY MATERIAL. key_ref names the agent_keys row consulted at
-- signing time (services/signing/partnerAuthorizationSigner.ts); the private
-- key itself never crosses into this table, and signature_ref is a
-- COMMITMENT (sha256 of the signature/payload), never the bearer signature
-- itself — same "digest, not the artifact" discipline as
-- agent_identity_bindings.signature_commitment (20260905000000).
--
-- NONCE REPLAY PROTECTION is a real constraint here, not just application
-- logic: UNIQUE (partner, nonce) means a replayed nonce fails at the database
-- layer even if a caller bug tried to skip the application-level check.

BEGIN;

CREATE TABLE IF NOT EXISTS public.partner_authorization_requests (
  authorization_id        TEXT PRIMARY KEY,

  purpose                 TEXT NOT NULL,
  subject_aigent_iqube_id TEXT NOT NULL,
  key_ref                 TEXT NOT NULL,
  partner                 TEXT NOT NULL,
  network                 TEXT NOT NULL,

  payload_hash            TEXT,
  nonce                   TEXT NOT NULL,
  expires_at              TIMESTAMPTZ NOT NULL,

  state                   TEXT NOT NULL DEFAULT 'PREPARED'
    CHECK (state IN (
      'PREPARED', 'AWAITING_SIGNATURE', 'SIGNED', 'SUBMITTED',
      'CONFIRMED', 'REFUSED', 'EXPIRED', 'QUARANTINED'
    )),

  signer_address          TEXT,
  -- sha256 commitment of the produced signature — never the raw signature.
  signature_ref           TEXT,
  -- Partner-assigned submission identifier (e.g. a transaction hash), once submitted.
  submission_ref          TEXT,
  -- Raw partner status text from the authoritative reread, recorded verbatim for audit.
  partner_status          TEXT,
  receipt_ref             TEXT,

  refusal_code            TEXT,
  refusal_detail          TEXT,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The database, not just application logic, refuses a replayed nonce.
CREATE UNIQUE INDEX IF NOT EXISTS uq_partner_authorization_requests_partner_nonce
  ON public.partner_authorization_requests (partner, nonce);

CREATE INDEX IF NOT EXISTS idx_partner_authorization_requests_subject
  ON public.partner_authorization_requests (subject_aigent_iqube_id);

CREATE INDEX IF NOT EXISTS idx_partner_authorization_requests_state
  ON public.partner_authorization_requests (partner, state);

COMMENT ON TABLE public.partner_authorization_requests IS
  'GJR-VFY-001 Phase 1 — durable state machine for a purpose-bound partner authorization request (starting with Horizen Pulse/PnL transparency). Never stores plaintext key material or a raw bearer signature; key_ref/signature_ref are references, not secrets.';
COMMENT ON COLUMN public.partner_authorization_requests.signature_ref IS
  'sha256 commitment of the produced signature, never the signature itself — mirrors agent_identity_bindings.signature_commitment.';
COMMENT ON COLUMN public.partner_authorization_requests.key_ref IS
  'The agent_keys row (agent id) consulted at signing time. The private key never crosses into this table.';

-- RLS — service-role only. No client-facing route reads this table directly
-- in Phase 1 (the Verify UI surface composition is Phase 2); the
-- orchestration in services/horizen/authorizationClient.ts runs server-side
-- exclusively via the service-role Supabase client.
ALTER TABLE public.partner_authorization_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS partner_authorization_requests_service_only ON public.partner_authorization_requests;
CREATE POLICY partner_authorization_requests_service_only ON public.partner_authorization_requests
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─── New receipt action type: horizen_pulse_authorized ───────────────────────
-- The PRD-GJR-001 migration (20260930000300) already added
-- horizen_pnl_transparency_enabled and agent_card_enriched, which cover two of
-- GJR-VFY-001's three canonical receipt types. This is the third and last
-- missing one — the overall Pulse-monitoring authorization confirmation event
-- (signed locally, accepted by Horizen, reread confirms enabled). Added to
-- ANCHORABLE_ACTION_TYPES in services/dvn/activityReceiptDvnPipeline.ts and to
-- ActivityActionType in services/receipts/activityReceiptService.ts in the
-- same change that adds it here — tests/activity-receipts-action-type-parity.test.ts
-- enforces the TS union and this CHECK constraint never drift apart.
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
    -- GJR-VFY-001 Phase 1 (2026-07-31) — the third canonical Horizen receipt type.
    'horizen_pulse_authorized'
));

COMMIT;
