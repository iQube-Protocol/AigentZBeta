-- 20260930190000_factor_aegis_constitution_reconciled.sql
--
-- Factor + Aegis 0.1 (GJR-FAC-001) — Phase 1 domain schema, RECONCILED onto
-- spec/moneypenny-mpy2-3 (0f1c02ae9). Supersedes the stale-base migration
-- 20260904170000_factor_aegis_constitution.sql from worktree-agent-
-- a97d7b8876cb56eea (never applied to any deployment; that file is not
-- referenced or run by this one — treat it as historical evidence only, per
-- codexes/packs/agentiq/updates/2026-09-04_factor-aegis-0.1-phase1-reconciliation.md
-- section "Keep/adapt/drop mapping").
--
-- WHAT CHANGED FROM THE STALE-BASE VERSION (reconciliation, not a rewrite
-- from scratch):
--   * NO new receipt/audit table. `constitutional_activity_receipts` (the
--     stale-base doc's own PRD-suggested name) and the stale base's own
--     choice of `orchestration_events` are BOTH dropped in favour of the
--     table this current tree already uses for every other constitutional
--     assessment/admission decision: `public.activity_receipts`, via
--     `createActivityReceipt` (services/receipts/activityReceiptService.ts).
--     Precedent: services/marketa/admissionAssessmentRunner.ts writes
--     `marketa_eligibility_assessed`/`_recommended`/`_refused`/`_quarantined`
--     the exact same way. This migration's own action-type additions ride
--     the SAME wholesale-rebuilt CHECK constraint that table already has
--     (tests/activity-receipts-action-type-parity.test.ts enforces this).
--   * `aegis_assessments` is modelled directly on the proven
--     `marketa_agent_admission_assessments` table (20260930000600) — TEXT
--     primary key, append-only/superseding via `supersedes_assessment_id`/
--     `superseded_by`, a partial unique index enforcing "one CURRENT
--     assessment per subject", `evidence_snapshot_hash`, `actor_persona_id`,
--     `receipt_ref`. It is a NEW, SEPARATE table (not an extension of
--     marketa_agent_admission_assessments) because Aegis is a distinct
--     constitutional actor from Marketa, assessing a broader domain
--     (capability/provenance/security/risk/consequence-readiness for
--     MoneyPenny admission — PRD Journey B) under its own policy-version
--     namespace, with a per-dimension findings table Marketa's table has no
--     equivalent of. Reusing Marketa's TABLE would conflate two
--     independent-assessor identities that PRD §2 invariant 2 requires stay
--     independent ("Aegis can assess... Aegis independence must not be
--     compromised"). This is a case of REUSING THE PATTERN, not the row.
--   * `factor_authority_chains` now carries an explicit, nullable
--     `delegation_grant_id` FK into the EXISTING `delegation_grants` table
--     (20260622500000) for `mode = 'direct'` chains — the direct-mode chain
--     is a thin overlay recording chain_mode/subdelegation metadata
--     `delegation_grants` cannot express, not a duplicate of what/allowed-
--     actions/allowed-surfaces that table already owns. `mode =
--     'moneypenny_mediated'` chains have no corresponding delegation_grants
--     row by construction (MoneyPenny -> Factor subdelegation is exactly
--     the case PRD §7 says "introduce an authority-chain representation
--     only if the existing delegation model cannot express principal ->
--     MoneyPenny -> Factor without ambiguity" — confirmed it cannot:
--     delegation_grants is a flat (persona, agent) pair with no mediator
--     field or subdelegation flag).
--   * `factor_cases`, `factor_case_events`, `factor_evidence_items`,
--     `factor_standing_proposals` are unchanged in shape from the stale-base
--     migration — Phase 0 reconnaissance on the CURRENT tree (this pass)
--     confirmed no existing table covers candidate-intake pipeline state,
--     case-scoped pipeline audit, an evidence checklist, or a Factor-side
--     standing PROPOSAL queue. `capability_evidence` (20260713010000) was
--     checked and rejected as a fit — it is dev-loop session capability
--     facts keyed by a goal hash, an unrelated concern.
--   * Standing: `factor_standing_proposals` never writes
--     `services/crm/standingAccrualService.ts`'s tables (the CURRENT tree's
--     real accrual path, successor to the stale tree's
--     crm_persona_reputation/crm_reputation_events) — tested.
--
-- T0/T1/T2: every table below stores raw `UUID` persona/actor ids in
-- server-only (RLS service-role-only) columns, matching the established
-- convention of marketa_agent_admission_assessments and delegation_grants —
-- NOT a hashed commitment. The T0 restriction governs what leaves the
-- server (DVN receipts, chain payloads, T1 JSON); activity_receipts already
-- owns that boundary via the protected DVN pipeline
-- (services/dvn/activityReceiptDvnPipeline.ts, untouched except for the one
-- permitted ANCHORABLE_ACTION_TYPES addition), so this migration does not
-- re-implement persona-ref hashing.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────
-- factor_cases — Journey A candidate-intake pipeline state (PRD §6.1).
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.factor_cases (
  case_id                   TEXT PRIMARY KEY,
  tenant_id                 TEXT NOT NULL,
  owner_persona_id           UUID NOT NULL,
  created_by_persona_id      UUID NOT NULL,
  candidate_identity_key    TEXT NOT NULL,
  candidate_display_name    TEXT NOT NULL,
  candidate_agent_root_did   TEXT,
  candidate_registry_asset_id TEXT,
  source                    TEXT NOT NULL DEFAULT 'operator' CHECK (source IN ('operator', 'marketa_referral', 'registry_import')),
  referral_provenance        JSONB NOT NULL DEFAULT '{}'::jsonb,
  state                     TEXT NOT NULL DEFAULT 'discovered' CHECK (state IN (
    'discovered', 'preparing', 'assessment_pending', 'assessment_in_progress',
    'evidence_remediation', 'assessment_complete', 'registry_ready',
    'admission_pending', 'admitted', 'conditionally_admitted', 'rejected',
    'activation_pending', 'active', 'paused'
  )),
  paused_from_state         TEXT,
  declared_capabilities     JSONB NOT NULL DEFAULT '[]'::jsonb,
  declared_endpoints        JSONB NOT NULL DEFAULT '[]'::jsonb,
  code_provenance            JSONB NOT NULL DEFAULT '{}'::jsonb,
  requested_services         JSONB NOT NULL DEFAULT '[]'::jsonb,
  requested_jurisdictions    JSONB NOT NULL DEFAULT '[]'::jsonb,
  pathway                   TEXT NOT NULL DEFAULT 'registry_only' CHECK (pathway IN ('registry_only', 'full_horizon')),
  current_aegis_assessment_id TEXT,
  authority_chain_id         TEXT,
  idempotency_key            TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_factor_cases_candidate_per_tenant
  ON public.factor_cases (tenant_id, candidate_identity_key);

CREATE UNIQUE INDEX IF NOT EXISTS uq_factor_cases_idempotency
  ON public.factor_cases (tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_factor_cases_state ON public.factor_cases (tenant_id, state, created_at DESC);

COMMENT ON TABLE public.factor_cases IS
  'Factor + Aegis 0.1 (GJR-FAC-001) Journey A — candidate-intake pipeline state machine (PRD §6.1). One row per (tenant, candidate); create-or-resume enforced by uq_factor_cases_candidate_per_tenant.';
COMMENT ON COLUMN public.factor_cases.state IS
  'admitted/conditionally_admitted/rejected are written ONLY by services/moneypenny/admissionAuthority.ts — factorCaseService.ts structurally refuses to set them (PRD §2 invariant 3, tested).';

ALTER TABLE public.factor_cases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS factor_cases_service_only ON public.factor_cases;
CREATE POLICY factor_cases_service_only ON public.factor_cases
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────────────────
-- factor_case_events — case-scoped append-only pipeline audit (distinct
-- from activity_receipts: an internal, high-volume pipeline trail for
-- pause/resume and state-transition replay, not a constitutional receipt).
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.factor_case_events (
  event_id       TEXT PRIMARY KEY,
  case_id        TEXT NOT NULL REFERENCES public.factor_cases(case_id),
  event_type     TEXT NOT NULL,
  from_state     TEXT,
  to_state       TEXT,
  actor_persona_id UUID NOT NULL,
  authority_chain_id TEXT,
  idempotency_key  TEXT,
  metadata       JSONB NOT NULL DEFAULT '{}'::jsonb,
  receipt_ref    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_factor_case_events_idempotency
  ON public.factor_case_events (case_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_factor_case_events_case ON public.factor_case_events (case_id, created_at DESC);

ALTER TABLE public.factor_case_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS factor_case_events_service_only ON public.factor_case_events;
CREATE POLICY factor_case_events_service_only ON public.factor_case_events
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────────────────
-- factor_evidence_items — the candidate evidence checklist (PRD Journey A
-- step 6, Journey B step 1's "immutable evidence snapshot" is assembled
-- FROM the current non-superseded rows here at submission time).
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.factor_evidence_items (
  evidence_item_id TEXT PRIMARY KEY,
  case_id          TEXT NOT NULL REFERENCES public.factor_cases(case_id),
  kind             TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'missing' CHECK (status IN ('missing', 'requested', 'supplied', 'stale', 'contradicted')),
  payload          JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_ref       TEXT,
  supplied_by_persona_id UUID,
  supersedes_evidence_item_id TEXT REFERENCES public.factor_evidence_items(evidence_item_id),
  superseded_by    TEXT REFERENCES public.factor_evidence_items(evidence_item_id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_factor_evidence_items_case
  ON public.factor_evidence_items (case_id, kind)
  WHERE superseded_by IS NULL;

ALTER TABLE public.factor_evidence_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS factor_evidence_items_service_only ON public.factor_evidence_items;
CREATE POLICY factor_evidence_items_service_only ON public.factor_evidence_items
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────────────────
-- aegis_assessments — modelled on marketa_agent_admission_assessments
-- (20260930000600): append-only/superseding, evidence_snapshot_hash,
-- actor_persona_id, receipt_ref. See header note above for why this is a
-- SEPARATE table, not an extension of Marketa's.
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.aegis_assessments (
  assessment_id            TEXT PRIMARY KEY,

  subject_type              TEXT NOT NULL CHECK (subject_type IN ('factor_case', 'agent')),
  subject_ref               TEXT NOT NULL,
  case_id                   TEXT REFERENCES public.factor_cases(case_id),

  state                     TEXT NOT NULL DEFAULT 'draft' CHECK (state IN (
    'draft', 'evidence_locked', 'running', 'review_required', 'ratified', 'failed'
  )),
  decision                  TEXT CHECK (decision IN (
    'admissible', 'admissible_with_conditions', 'insufficient_evidence', 'not_admissible'
  )),
  conditions                 JSONB NOT NULL DEFAULT '[]'::jsonb,
  assessment_hash             TEXT,
  policy_version             TEXT NOT NULL,
  evidence_snapshot          JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence_snapshot_hash     TEXT,

  requested_by_agent_ref     TEXT NOT NULL,
  assessed_by_agent_ref      TEXT NOT NULL DEFAULT 'aigent-aegis',

  rationale                  TEXT,

  actor_persona_id           UUID NOT NULL,
  receipt_ref                 TEXT,

  supersedes_assessment_id   TEXT REFERENCES public.aegis_assessments(assessment_id),
  superseded_by              TEXT REFERENCES public.aegis_assessments(assessment_id),

  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  ratified_at                TIMESTAMPTZ,

  CONSTRAINT chk_aegis_assessments_not_self_assessed CHECK (requested_by_agent_ref <> assessed_by_agent_ref)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_aegis_assessments_current
  ON public.aegis_assessments (subject_type, subject_ref)
  WHERE superseded_by IS NULL;

CREATE INDEX IF NOT EXISTS idx_aegis_assessments_subject_history
  ON public.aegis_assessments (subject_type, subject_ref, created_at DESC);

COMMENT ON TABLE public.aegis_assessments IS
  'Factor + Aegis 0.1 (GJR-FAC-001) Journey B — Aegis independent assessment (PRD §6.2). Append-only/superseding, modelled on marketa_agent_admission_assessments (20260930000600). Ratified rows are immutable at the DB layer (trg_aegis_assessments_immutable below), not only application-layer discipline.';
COMMENT ON COLUMN public.aegis_assessments.evidence_snapshot_hash IS
  'Commitment over the exact factor_evidence_items snapshot this decision was made from (services/factor/canonical.ts) — never a hash of anything else.';
COMMENT ON CONSTRAINT chk_aegis_assessments_not_self_assessed ON public.aegis_assessments IS
  'PRD §2 invariant 2 / §9.10 — Aegis cannot assess itself and a candidate cannot be its own assessor. Defense-in-depth alongside services/aegis/aegisAssessmentService.ts''s application-layer refusal.';

ALTER TABLE public.aegis_assessments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS aegis_assessments_service_only ON public.aegis_assessments;
CREATE POLICY aegis_assessments_service_only ON public.aegis_assessments
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Immutability trigger — once `state = 'ratified'` or 'failed', the
-- decision-bearing columns can never change. A correction creates a NEW row
-- (supersedes_assessment_id) and marks THIS row's superseded_by — that
-- single column is the only one this trigger still permits changing on a
-- terminal row.
CREATE OR REPLACE FUNCTION public.trg_aegis_assessments_immutable_fn()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.state IN ('ratified', 'failed') THEN
    IF NEW.state IS DISTINCT FROM OLD.state
       OR NEW.decision IS DISTINCT FROM OLD.decision
       OR NEW.evidence_snapshot_hash IS DISTINCT FROM OLD.evidence_snapshot_hash
       OR NEW.rationale IS DISTINCT FROM OLD.rationale
       OR NEW.policy_version IS DISTINCT FROM OLD.policy_version
    THEN
      RAISE EXCEPTION 'aegis_assessments: row % is % (immutable) — a correction must create a new superseding assessment, never edit this row', OLD.assessment_id, OLD.state;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_aegis_assessments_immutable ON public.aegis_assessments;
CREATE TRIGGER trg_aegis_assessments_immutable
  BEFORE UPDATE ON public.aegis_assessments
  FOR EACH ROW EXECUTE FUNCTION public.trg_aegis_assessments_immutable_fn();

-- ─────────────────────────────────────────────────────────────────────────
-- aegis_findings — per-dimension findings (PRD Journey B step 4).
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.aegis_findings (
  finding_id      TEXT PRIMARY KEY,
  assessment_id   TEXT NOT NULL REFERENCES public.aegis_assessments(assessment_id),
  dimension       TEXT NOT NULL,
  claim           TEXT NOT NULL,
  evidence_refs   JSONB NOT NULL DEFAULT '[]'::jsonb,
  method          TEXT NOT NULL,
  result          TEXT NOT NULL CHECK (result IN ('pass', 'fail', 'inconclusive')),
  confidence      NUMERIC NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  limitations     TEXT,
  falsification_condition TEXT,
  is_critical     BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aegis_findings_assessment ON public.aegis_findings (assessment_id);

ALTER TABLE public.aegis_findings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS aegis_findings_service_only ON public.aegis_findings;
CREATE POLICY aegis_findings_service_only ON public.aegis_findings
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Findings are immutable once the PARENT assessment is ratified/failed.
CREATE OR REPLACE FUNCTION public.trg_aegis_findings_immutable_fn()
RETURNS TRIGGER AS $$
DECLARE
  parent_state TEXT;
BEGIN
  SELECT state INTO parent_state FROM public.aegis_assessments
    WHERE assessment_id = COALESCE(NEW.assessment_id, OLD.assessment_id);
  IF parent_state IN ('ratified', 'failed') THEN
    RAISE EXCEPTION 'aegis_findings: parent assessment % is % (immutable) — findings cannot be inserted, updated or deleted', COALESCE(NEW.assessment_id, OLD.assessment_id), parent_state;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_aegis_findings_immutable ON public.aegis_findings;
CREATE TRIGGER trg_aegis_findings_immutable
  BEFORE INSERT OR UPDATE OR DELETE ON public.aegis_findings
  FOR EACH ROW EXECUTE FUNCTION public.trg_aegis_findings_immutable_fn();

-- ─────────────────────────────────────────────────────────────────────────
-- factor_authority_chains — the principal -> MoneyPenny -> Factor
-- representation delegation_grants cannot express (see header note).
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.factor_authority_chains (
  chain_id                TEXT PRIMARY KEY,
  principal_persona_id     UUID NOT NULL,
  chain_mode               TEXT NOT NULL CHECK (chain_mode IN ('direct', 'moneypenny_mediated')),
  mediator_agent_ref        TEXT,
  target_agent_ref          TEXT NOT NULL,
  delegation_grant_id       TEXT REFERENCES public.delegation_grants(grant_id),
  subdelegation_permitted    BOOLEAN NOT NULL DEFAULT false,
  allowed_actions            JSONB NOT NULL DEFAULT '[]'::jsonb,
  status                    TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
  expires_at                TIMESTAMPTZ,
  revoked_at                TIMESTAMPTZ,
  revoke_reason              TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_factor_authority_chains_mediator CHECK (
    (chain_mode = 'direct' AND mediator_agent_ref IS NULL)
    OR (chain_mode = 'moneypenny_mediated' AND mediator_agent_ref IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_factor_authority_chains_active
  ON public.factor_authority_chains (principal_persona_id, target_agent_ref, chain_mode)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_factor_authority_chains_principal
  ON public.factor_authority_chains (principal_persona_id, status);

COMMENT ON TABLE public.factor_authority_chains IS
  'PRD §2.1 — the principal -> MoneyPenny -> Factor authority-chain representation. Direct-mode chains reference an existing delegation_grants row (the source of allowed_actions/surfaces truth); mediated-mode chains have none by construction, since MoneyPenny subdelegation is exactly what delegation_grants cannot express (flat persona,agent pairs, no mediator field).';

ALTER TABLE public.factor_authority_chains ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS factor_authority_chains_service_only ON public.factor_authority_chains;
CREATE POLICY factor_authority_chains_service_only ON public.factor_authority_chains
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────────────────
-- factor_standing_proposals — Factor PROPOSES only (PRD Journey F, §2
-- invariant "Factor must never write standing directly"). Never touches
-- services/crm/standingAccrualService.ts's tables (tested).
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.factor_standing_proposals (
  proposal_id         TEXT PRIMARY KEY,
  case_id              TEXT REFERENCES public.factor_cases(case_id),
  subject_agent_ref     TEXT NOT NULL,
  standing_persona_id   UUID,
  proposed_event_kind   TEXT NOT NULL,
  veracity_evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  contribution_evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  risk_of_repair_evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  pulse_pnl_refs         JSONB NOT NULL DEFAULT '[]'::jsonb,
  rationale             TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'accepted', 'rejected')),
  proposed_by_persona_id UUID NOT NULL,
  decided_by_persona_id  UUID,
  decided_at             TIMESTAMPTZ,
  receipt_ref            TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_factor_standing_proposals_evidence CHECK (
    jsonb_array_length(veracity_evidence_refs) > 0
    OR jsonb_array_length(contribution_evidence_refs) > 0
    OR jsonb_array_length(risk_of_repair_evidence_refs) > 0
  )
);

CREATE INDEX IF NOT EXISTS idx_factor_standing_proposals_status
  ON public.factor_standing_proposals (status, created_at DESC);

COMMENT ON TABLE public.factor_standing_proposals IS
  'PRD Journey F — Factor may PROPOSE a standing event, never write standing directly. Distinct from and never a substitute for services/crm/standingAccrualService.ts, the real accrual path. "positive economic outcome alone is insufficient" (PRD) is enforced by chk_factor_standing_proposals_evidence — a proposal carrying no veracity/contribution/risk-of-repair evidence is rejected at the DB layer.';

ALTER TABLE public.factor_standing_proposals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS factor_standing_proposals_service_only ON public.factor_standing_proposals;
CREATE POLICY factor_standing_proposals_service_only ON public.factor_standing_proposals
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────────────────
-- activity_receipts — wholesale CHECK-constraint rebuild (the drift-
-- incident regression guard, tests/activity-receipts-action-type-parity
-- .test.ts, requires every migration extending ActivityActionType to also
-- rebuild this constraint with the COMPLETE current list). Carried forward
-- VERBATIM from 20260930130000_experience_interaction_observed_receipt_type
-- .sql plus exactly the 11 new Factor/Aegis/MoneyPenny-admission entries.
-- ─────────────────────────────────────────────────────────────────────────

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
    'exchange_artifact_registered_operator_assisted',
    'exchange_operator_assisted_artifact_confirmed',
    'experience_interaction_observed',
    -- Factor + Aegis 0.1 (GJR-FAC-001) — new this migration.
    'factor_case_opened',
    'factor_case_state_changed',
    'factor_evidence_recorded',
    'aegis_assessment_requested',
    'aegis_assessment_ratified',
    'aegis_assessment_failed',
    'aegis_assessment_superseded',
    'moneypenny_admission_decided',
    'factor_standing_proposed',
    'factor_authority_chain_established',
    'factor_authority_chain_revoked'
));

COMMIT;
