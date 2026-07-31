-- 20260930000600_marketa_agent_admission_assessments.sql
--
-- GJR-MKT-001 (Marketa External-Agent Constitutional Eligibility Engine),
-- Phase 4 — operator ruling 2026-07-31 §8: "Create a durable
-- admission-assessment record rather than storing only a mutable field on
-- the agent... Assessments are append-only or superseding, never silently
-- overwritten."
--
-- SUPERSEDE, NEVER DELETE — the exact same discipline just built for
-- Independent Review (services/research/independentReviewStore.ts's
-- markReviewSuperseded, 20260930000000_independent_review_receipt_type.sql).
-- A reassessment (control proof added, Pulse enabled, Agent Card corrected,
-- registry identity resolved, contradiction cleared — §9) inserts a NEW row
-- and sets `superseded_by` on the OLD one; the old row's own fields are
-- never mutated. `supersedes_assessment_id` on the new row points backward
-- so the full chain is walkable either direction.
--
-- ONE CURRENT ASSESSMENT PER SUBJECT: the partial unique index below allows
-- at most one row per (subject_aigent_iqube_id) with `superseded_by IS NULL`
-- — mirrors agent_identity_bindings' uq_agent_identity_bindings_active
-- (20260905000000), same rationale: two simultaneously-current assessments
-- for one candidate would leave nothing downstream able to choose between
-- them.
--
-- evidence_snapshot_hash is the commitment services/marketa/
-- externalAgentAdmissionEvidence.ts computes over its own assembled
-- evidence — the assessment is always traceable to the EXACT evidence it
-- was decided from ("Evidence Before Decision").

BEGIN;

CREATE TABLE IF NOT EXISTS public.marketa_agent_admission_assessments (
  assessment_id            TEXT PRIMARY KEY,

  subject_aigent_iqube_id  TEXT NOT NULL,
  mode                     TEXT NOT NULL CHECK (mode IN ('DRAFT', 'FINAL')),
  decision                 TEXT NOT NULL CHECK (decision IN (
    'DRAFT_ELIGIBLE', 'DRAFT_BLOCKED', 'RECOMMENDED', 'NOT_RECOMMENDED', 'REFUSED', 'QUARANTINED'
  )),
  policy_version           TEXT NOT NULL,
  evidence_snapshot_hash   TEXT NOT NULL,

  satisfied_rules          JSONB NOT NULL DEFAULT '[]'::jsonb,
  missing_rules            JSONB NOT NULL DEFAULT '[]'::jsonb,
  failed_rules             JSONB NOT NULL DEFAULT '[]'::jsonb,
  evidence_refs            JSONB NOT NULL DEFAULT '[]'::jsonb,

  rationale                TEXT NOT NULL,

  actor_persona_id         UUID NOT NULL,
  receipt_ref              TEXT,

  supersedes_assessment_id TEXT REFERENCES public.marketa_agent_admission_assessments(assessment_id),
  superseded_by            TEXT REFERENCES public.marketa_agent_admission_assessments(assessment_id),

  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- At most one CURRENT (non-superseded) assessment per subject.
CREATE UNIQUE INDEX IF NOT EXISTS uq_marketa_admission_assessments_current
  ON public.marketa_agent_admission_assessments (subject_aigent_iqube_id)
  WHERE superseded_by IS NULL;

CREATE INDEX IF NOT EXISTS idx_marketa_admission_assessments_subject_history
  ON public.marketa_agent_admission_assessments (subject_aigent_iqube_id, created_at DESC);

COMMENT ON TABLE public.marketa_agent_admission_assessments IS
  'GJR-MKT-001 Phase 4 — append-only/superseding admission-eligibility assessments. Never overwritten; a reassessment inserts a new row and sets superseded_by on the prior current row.';
COMMENT ON COLUMN public.marketa_agent_admission_assessments.evidence_snapshot_hash IS
  'Commitment over the exact ExternalAgentAdmissionEvidence this decision was made from (services/marketa/externalAgentAdmissionEvidence.ts) — never a hash of anything else.';

-- RLS — service-role only. No client-facing route reads this table directly
-- yet (Phase 5 wires the Claim-stage surface); the engine runs server-side
-- via the service-role Supabase client, mirroring
-- partner_authorization_requests (20260930000500).
ALTER TABLE public.marketa_agent_admission_assessments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS marketa_admission_assessments_service_only ON public.marketa_agent_admission_assessments;
CREATE POLICY marketa_admission_assessments_service_only ON public.marketa_agent_admission_assessments
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─── New receipt action types: the three GJR-MKT-001 §12 types not already
-- present (marketa_eligibility_recommended already exists, added by the
-- PRD-GJR-001 migration 20260930000300) ───────────────────────────────────
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
    -- GJR-MKT-001 Phase 4 (2026-07-31) — the three remaining §12 receipt types.
    'marketa_eligibility_assessed',
    'marketa_eligibility_refused',
    'marketa_eligibility_quarantined'
));

COMMIT;
