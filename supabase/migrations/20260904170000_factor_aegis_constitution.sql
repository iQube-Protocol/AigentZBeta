-- ============================================================================
-- Factor + Aegis 0.1 — domain schema (Phase 1)
-- PRD: FACTOR_AEGIS_MONEYPENNY_PRD_0.1.md
--
-- Delivery posture (PRD header, §15 Phase 0/1): extend existing primitives,
-- do not create a parallel runtime. This migration is additive-only and
-- introduces ONLY the domain objects that have no existing home in this
-- worktree's schema (verified by reconnaissance — see the implementation-map
-- doc committed alongside this migration):
--
--   REUSED, not duplicated:
--     - public.orchestration_events   → immutable observer/audit receipts
--       (generic event_type/metadata, already RLS'd service-role-only; the
--        PRD's suggested `constitutional_activity_receipts` table would
--        duplicate this).
--     - public.activity_receipts      → left untouched; a different, already
--       call-site-committed ledger (Aigent Me session activity) — not
--       widened with Factor/Aegis-specific action types in this pass, to
--       avoid touching its CHECK constraint under concurrent-session risk.
--     - public.registry_assets        → Registry presence (Journey C).
--     - public.crm_persona_reputation / crm_reputation_events → the ONLY
--       place Standing is actually accrued. Factor never writes here
--       directly (PRD §10, invariant 18) — factor_standing_proposals below
--       is a proposal queue a human/operator reviews before any accrual
--       write lands in these tables.
--
--   GENUINELY NEW (no existing table or service found in this worktree, or
--   in the wider platform, covers these — confirmed by a full-repo grep for
--   "Factor"/"Aegis" as agent names returning zero prior art):
--     - factor_cases, factor_case_events, factor_evidence_items
--     - aegis_assessments, aegis_findings
--     - factor_authority_chains   (this worktree has NO delegation_grants
--       table at all — see the implementation-map doc's "worktree staleness"
--       finding — so the principal → MoneyPenny → Factor three-party chain
--       cannot be expressed by any existing structure without ambiguity;
--       PRD §7 explicitly permits a new representation in exactly this case)
--     - factor_standing_proposals (PROPOSE, never write, per PRD §10)
--
-- T0/T1/T2 discipline (CLAUDE.md Identity & Access Spine, mirrored here even
-- though this worktree predates personaReferences.ts): every persona_id
-- column is T0 — RLS-gated service-role-only, never selected into a client
-- response directly. Any column that may end up inside an orchestration_events
-- payload carries a *_ref (sha256-hex16 commitment, see
-- services/factor/identityRefs.ts) instead of a raw persona_id.
-- ============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. factor_cases — Factor's candidate-intake / activation pipeline.
--
-- State machine (PRD §6.1):
--   discovered → preparing → assessment_pending → assessment_in_progress
--     → evidence_remediation | assessment_complete → registry_ready
--     → admission_pending → admitted | conditionally_admitted | rejected
--     → activation_pending → active
--   Any nonterminal state may become 'paused'. Rejection/supersession retain
--   history (rows are never deleted; factor_case_events is the audit trail).
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.factor_cases (
  case_id                   uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id                 text        NOT NULL DEFAULT 'default',

  -- The accountable operator sponsoring this candidate. T0 — RLS-gated.
  owner_persona_id          text        NOT NULL,

  -- Candidate identity. candidate_identity_key is a caller-supplied or
  -- derived stable key (e.g. the candidate's own root DID once known, or a
  -- deterministic hash of the intake payload before one exists) — the
  -- dedupe key that makes "resolve whether the candidate already exists /
  -- create or resume ONE case" (PRD Journey A) enforceable at the DB layer
  -- rather than only in application code.
  candidate_identity_key    text        NOT NULL,
  candidate_display_name    text        NOT NULL,
  candidate_agent_root_did  text,
  candidate_registry_asset_id text,

  source                    text        NOT NULL DEFAULT 'operator'
    CHECK (source IN ('operator', 'marketa_referral', 'registry_import')),
  -- Marketa referral/campaign provenance — retained for attribution, but
  -- Marketa is never the assessor (PRD acceptance criterion 19). Purely
  -- descriptive metadata; no code path may read this to gate an Aegis
  -- decision.
  referral_provenance       jsonb       NOT NULL DEFAULT '{}'::jsonb,

  declared_capabilities     jsonb       NOT NULL DEFAULT '[]'::jsonb,
  declared_endpoints        jsonb       NOT NULL DEFAULT '[]'::jsonb,
  code_provenance           jsonb       NOT NULL DEFAULT '{}'::jsonb,
  requested_services        jsonb       NOT NULL DEFAULT '[]'::jsonb,
  requested_jurisdictions   text[]      NOT NULL DEFAULT '{}',

  pathway                   text        NOT NULL DEFAULT 'registry_only'
    CHECK (pathway IN ('registry_only', 'full_horizon')),

  state                     text        NOT NULL DEFAULT 'discovered'
    CHECK (state IN (
      'discovered', 'preparing', 'assessment_pending', 'assessment_in_progress',
      'evidence_remediation', 'assessment_complete', 'registry_ready',
      'admission_pending', 'admitted', 'conditionally_admitted', 'rejected',
      'activation_pending', 'active', 'paused'
    )),
  -- The state a 'paused' case will resume into — required to make pause/
  -- resume lossless (PRD Journey A step 7: "pause and resume without losing
  -- state").
  paused_from_state         text,

  current_aegis_assessment_id uuid,   -- FK added after aegis_assessments exists
  authority_chain_id        uuid,    -- FK added after factor_authority_chains exists

  -- Command-operation idempotency (PRD §7, §12). A caller retrying
  -- "create case" with the same key gets the same row back, never a dup.
  idempotency_key            text,

  created_by_persona_id      text        NOT NULL,   -- T0, acting principal at creation
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT factor_cases_tenant_candidate_unique UNIQUE (tenant_id, candidate_identity_key),
  CONSTRAINT factor_cases_idempotency_unique UNIQUE (tenant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_factor_cases_owner   ON public.factor_cases(owner_persona_id);
CREATE INDEX IF NOT EXISTS idx_factor_cases_state    ON public.factor_cases(state);
CREATE INDEX IF NOT EXISTS idx_factor_cases_tenant    ON public.factor_cases(tenant_id);

ALTER TABLE public.factor_cases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS factor_cases_read_service  ON public.factor_cases;
DROP POLICY IF EXISTS factor_cases_write_service ON public.factor_cases;
CREATE POLICY factor_cases_read_service  ON public.factor_cases FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY factor_cases_write_service ON public.factor_cases FOR ALL    USING (auth.role() = 'service_role');

COMMENT ON TABLE public.factor_cases IS 'Factor 0.1 candidate-intake/activation pipeline (PRD §6.1, Journey A/C). owner_persona_id/created_by_persona_id are T0.';
COMMENT ON COLUMN public.factor_cases.candidate_identity_key IS 'Dedupe key — enforces "resolve or create ONE case" at the DB layer (PRD Journey A step 3).';

-- ─────────────────────────────────────────────────────────────────────────
-- 2. factor_case_events — append-only audit trail per case.
--
-- Distinct from orchestration_events: this is the DOMAIN-scoped, ordered,
-- case-relative event log the Factor UI pipeline view reads (PRD §5.1
-- "Pipeline"); orchestration_events (reused, unmodified) is the
-- platform-wide observer/audit receipt ledger a constitutional-decision
-- summary is ALSO written to (see services/factor/receipts.ts) — one fact,
-- two projections, never two sources of truth for the same fact.
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.factor_case_events (
  event_id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id              uuid        NOT NULL REFERENCES public.factor_cases(case_id) ON DELETE CASCADE,
  event_type           text        NOT NULL,
  from_state           text,
  to_state              text,
  -- T2-safe commitment only — never a raw persona_id (this row's shape
  -- mirrors what may be echoed into an orchestration_events receipt).
  actor_persona_ref     text        NOT NULL,
  authority_chain_id    uuid,
  payload               jsonb       NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key       text,
  created_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT factor_case_events_idempotency_unique UNIQUE (case_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_factor_case_events_case ON public.factor_case_events(case_id, created_at);

ALTER TABLE public.factor_case_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS factor_case_events_read_service  ON public.factor_case_events;
DROP POLICY IF EXISTS factor_case_events_write_service ON public.factor_case_events;
CREATE POLICY factor_case_events_read_service  ON public.factor_case_events FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY factor_case_events_write_service ON public.factor_case_events FOR ALL    USING (auth.role() = 'service_role');

COMMENT ON TABLE public.factor_case_events IS 'Append-only, case-scoped audit trail. actor_persona_ref is T2 (sha256-hex16), never a raw persona_id.';

-- ─────────────────────────────────────────────────────────────────────────
-- 3. factor_evidence_items — the evidence checklist (PRD Journey A step 6,
--    §5.1 "Evidence": required / supplied / stale / contradicted / missing).
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.factor_evidence_items (
  evidence_id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id                uuid        NOT NULL REFERENCES public.factor_cases(case_id) ON DELETE CASCADE,
  category               text        NOT NULL,
  status                 text        NOT NULL DEFAULT 'missing'
    CHECK (status IN ('missing', 'requested', 'supplied', 'stale', 'contradicted')),
  description            text,
  -- Pointer/commitment to the evidence, never the raw secret/credential
  -- itself (PRD §8.1 "API keys remain server-side... Log neither
  -- credentials nor raw authorization headers" applied generally here).
  evidence_ref           jsonb       NOT NULL DEFAULT '{}'::jsonb,
  supplied_at            timestamptz,
  supplied_by_persona_ref text,
  -- Evidence changed after an assessment locked its snapshot creates a NEW
  -- row (never edits the old one) and marks the prior row 'stale' via
  -- superseded_by — mirrors the assessment-versioning immutability
  -- discipline for the evidence feeding it (PRD Journey B step 7).
  superseded_by          uuid REFERENCES public.factor_evidence_items(evidence_id),
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_factor_evidence_case ON public.factor_evidence_items(case_id, status);

ALTER TABLE public.factor_evidence_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS factor_evidence_read_service  ON public.factor_evidence_items;
DROP POLICY IF EXISTS factor_evidence_write_service ON public.factor_evidence_items;
CREATE POLICY factor_evidence_read_service  ON public.factor_evidence_items FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY factor_evidence_write_service ON public.factor_evidence_items FOR ALL    USING (auth.role() = 'service_role');

COMMENT ON TABLE public.factor_evidence_items IS 'Evidence checklist per Factor case (PRD Journey A/B). Never stores raw secrets — evidence_ref is a pointer/commitment.';

-- ─────────────────────────────────────────────────────────────────────────
-- 4. aegis_assessments — Aegis's evidence-bound, versioned, immutable
--    assessment (PRD Journey B, §6.2).
--
-- State machine: draft → evidence_locked → running → review_required →
--   ratified | failed. Ratified rows are immutable (enforced below by
--   trigger, not only by application code — PRD "Aegis ratification
--   creates a stable assessment hash and immutable receipt" is a hard
--   invariant, defended in depth).
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.aegis_assessments (
  assessment_id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id                  uuid        NOT NULL REFERENCES public.factor_cases(case_id) ON DELETE CASCADE,
  version                  integer     NOT NULL DEFAULT 1,
  supersedes_assessment_id uuid REFERENCES public.aegis_assessments(assessment_id),

  policy_id                text        NOT NULL,
  policy_version            text        NOT NULL,

  -- The immutable evidence snapshot Journey B step 1 requires ("Factor
  -- submits an immutable evidence snapshot to Aegis") plus its
  -- canonicalized-payload hash (PRD §7 "Assessment and receipt hashes must
  -- be derived from canonicalized payloads, not unstable JSON
  -- serialization").
  evidence_snapshot         jsonb       NOT NULL,
  evidence_set_hash          text        NOT NULL,

  state                     text        NOT NULL DEFAULT 'draft'
    CHECK (state IN ('draft', 'evidence_locked', 'running', 'review_required', 'ratified', 'failed')),
  decision                  text
    CHECK (decision IS NULL OR decision IN (
      'admissible', 'admissible_with_conditions', 'insufficient_evidence', 'not_admissible'
    )),
  conditions                 jsonb       NOT NULL DEFAULT '[]'::jsonb,

  -- Set only at ratification; immutable thereafter (trigger below).
  assessment_hash            text,
  ratified_at                timestamptz,
  ratified_by_persona_ref    text,

  -- Self-assessment guard inputs (PRD invariant "Factor cannot assess
  -- itself" / "Aegis... independence must not be compromised by direct
  -- delegation from the candidate it is assessing"). subject_agent_ref is
  -- the candidate being assessed; requested_by_agent_ref is who submitted
  -- the request. Application code refuses when they match, in addition to
  -- this column pair existing to make the refusal auditable.
  subject_agent_ref           text        NOT NULL,
  requested_by_agent_ref      text        NOT NULL,

  immutable                   boolean     NOT NULL DEFAULT false,

  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT aegis_assessments_case_version_unique UNIQUE (case_id, version)
);

CREATE INDEX IF NOT EXISTS idx_aegis_assessments_case  ON public.aegis_assessments(case_id);
CREATE INDEX IF NOT EXISTS idx_aegis_assessments_state ON public.aegis_assessments(state);

ALTER TABLE public.aegis_assessments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS aegis_assessments_read_service  ON public.aegis_assessments;
DROP POLICY IF EXISTS aegis_assessments_write_service ON public.aegis_assessments;
CREATE POLICY aegis_assessments_read_service  ON public.aegis_assessments FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY aegis_assessments_write_service ON public.aegis_assessments FOR ALL    USING (auth.role() = 'service_role');

COMMENT ON TABLE public.aegis_assessments IS 'Aegis 0.1 versioned, evidence-bound assessment (PRD Journey B/§6.2). Ratified rows are immutable — see trg_aegis_assessments_immutable.';

-- Defense-in-depth immutability: once a row's state is 'ratified' (or
-- immutable=true), the fields that constitute the canonical decision may
-- never change. A correction MUST insert a new row with
-- supersedes_assessment_id pointing at this one (application-layer
-- createSuccessorVersion), never an UPDATE of a ratified row.
CREATE OR REPLACE FUNCTION public.factor_aegis_assessment_guard_immutable()
RETURNS trigger AS $$
BEGIN
  IF OLD.state = 'ratified' OR OLD.immutable = true THEN
    IF NEW.decision            IS DISTINCT FROM OLD.decision
       OR NEW.conditions        IS DISTINCT FROM OLD.conditions
       OR NEW.assessment_hash   IS DISTINCT FROM OLD.assessment_hash
       OR NEW.evidence_snapshot IS DISTINCT FROM OLD.evidence_snapshot
       OR NEW.evidence_set_hash IS DISTINCT FROM OLD.evidence_set_hash
       OR NEW.state             IS DISTINCT FROM OLD.state
       OR NEW.ratified_at       IS DISTINCT FROM OLD.ratified_at
       OR NEW.ratified_by_persona_ref IS DISTINCT FROM OLD.ratified_by_persona_ref
    THEN
      RAISE EXCEPTION 'aegis_assessments: row % is ratified/immutable — corrections require a new version (supersedes_assessment_id), never an edit', OLD.assessment_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_aegis_assessments_immutable ON public.aegis_assessments;
CREATE TRIGGER trg_aegis_assessments_immutable
  BEFORE UPDATE ON public.aegis_assessments
  FOR EACH ROW EXECUTE FUNCTION public.factor_aegis_assessment_guard_immutable();

ALTER TABLE public.factor_cases
  ADD CONSTRAINT factor_cases_current_assessment_fk
  FOREIGN KEY (current_aegis_assessment_id) REFERENCES public.aegis_assessments(assessment_id);

-- ─────────────────────────────────────────────────────────────────────────
-- 5. aegis_findings — per-dimension findings (PRD Journey B step 4, §5.2).
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.aegis_findings (
  finding_id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_id            uuid        NOT NULL REFERENCES public.aegis_assessments(assessment_id) ON DELETE CASCADE,
  dimension                 text        NOT NULL,
  claim                     text        NOT NULL,
  evidence_refs             jsonb       NOT NULL DEFAULT '[]'::jsonb,
  method                     text        NOT NULL,
  result                     text        NOT NULL CHECK (result IN ('pass', 'fail', 'conditional', 'inconclusive')),
  confidence                 text        NOT NULL CHECK (confidence IN ('low', 'medium', 'high')),
  limitations                text,
  falsification_condition    text        NOT NULL,
  -- A critical-failure finding must block an 'admissible' decision
  -- regardless of aggregate score (PRD acceptance criterion 5, §5.2 "A
  -- single composite number must not conceal a critical failure").
  is_critical                 boolean     NOT NULL DEFAULT false,
  created_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aegis_findings_assessment ON public.aegis_findings(assessment_id);
CREATE INDEX IF NOT EXISTS idx_aegis_findings_critical_fail
  ON public.aegis_findings(assessment_id)
  WHERE is_critical = true AND result = 'fail';

ALTER TABLE public.aegis_findings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS aegis_findings_read_service  ON public.aegis_findings;
DROP POLICY IF EXISTS aegis_findings_write_service ON public.aegis_findings;
CREATE POLICY aegis_findings_read_service  ON public.aegis_findings FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY aegis_findings_write_service ON public.aegis_findings FOR ALL    USING (auth.role() = 'service_role');

COMMENT ON TABLE public.aegis_findings IS 'Per-dimension Aegis findings (PRD §5.2 dimension list). A critical fail blocks an admissible decision regardless of aggregate score.';

-- Findings on a ratified assessment are immutable too (they are part of the
-- decision the ratification trigger protects) — block INSERT/UPDATE/DELETE
-- once the parent assessment is ratified.
CREATE OR REPLACE FUNCTION public.factor_aegis_findings_guard_immutable()
RETURNS trigger AS $$
DECLARE
  parent_state text;
  parent_immutable boolean;
  target_assessment uuid;
BEGIN
  target_assessment := COALESCE(NEW.assessment_id, OLD.assessment_id);
  SELECT state, immutable INTO parent_state, parent_immutable
    FROM public.aegis_assessments WHERE assessment_id = target_assessment;
  IF parent_state = 'ratified' OR parent_immutable = true THEN
    RAISE EXCEPTION 'aegis_findings: parent assessment % is ratified/immutable — findings cannot change post-ratification', target_assessment;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_aegis_findings_immutable ON public.aegis_findings;
CREATE TRIGGER trg_aegis_findings_immutable
  BEFORE INSERT OR UPDATE OR DELETE ON public.aegis_findings
  FOR EACH ROW EXECUTE FUNCTION public.factor_aegis_findings_guard_immutable();

-- ─────────────────────────────────────────────────────────────────────────
-- 6. factor_authority_chains — direct vs MoneyPenny-mediated delegation
--    chain (PRD §2.1, acceptance criteria 24/25).
--
-- This worktree has NO delegation_grants table (or equivalent) at all —
-- see the implementation-map doc. There is therefore no existing structure
-- that can express principal → MoneyPenny → Factor without ambiguity, which
-- is exactly the condition under which PRD §7 permits a new representation.
-- Direct mode (principal → Factor) is ALSO recorded here rather than split
-- across two different tables, so every Factor action resolves its
-- authority chain through one join, and 'direct' vs 'moneypenny_mediated'
-- are two rows of the same shape rather than two parallel schemas.
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.factor_authority_chains (
  chain_id                    uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id                    text        NOT NULL DEFAULT 'default',

  principal_persona_id          text        NOT NULL,   -- T0, RLS-gated
  mode                           text        NOT NULL CHECK (mode IN ('direct', 'moneypenny_mediated')),

  -- Required, non-null, when mode = 'moneypenny_mediated'; NULL for
  -- 'direct'. Enforced by the CHECK below rather than left implicit.
  mediating_agent_root_did       text,
  delegate_agent_root_did        text        NOT NULL,   -- Factor's (or another delegate's) DID

  -- Explicit flag: mediated mode is refused unless this is true (PRD
  -- acceptance criterion 24 — "fails if subdelegation is absent or
  -- prohibited"). Never inferred from the existence of a MoneyPenny
  -- session (PRD §9.15 — "possession of a MoneyPenny session is not
  -- permission to delegate to Factor").
  subdelegation_permitted         boolean     NOT NULL DEFAULT false,

  allowed_actions                  jsonb       NOT NULL DEFAULT '[]'::jsonb,
  -- Bounded-mandate scope: assets/data, duration, financial limits,
  -- counterparties, approval thresholds, subdelegation rights (PRD Journey
  -- G step 5).
  scope                             jsonb       NOT NULL DEFAULT '{}'::jsonb,

  status                            text        NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'revoked', 'expired')),
  revoked_at                         timestamptz,
  revoke_reason                      text,

  created_by_persona_ref              text        NOT NULL,   -- T2
  created_at                          timestamptz NOT NULL DEFAULT now(),
  updated_at                          timestamptz NOT NULL DEFAULT now(),
  expires_at                          timestamptz NOT NULL,

  CONSTRAINT factor_authority_chains_mediated_requires_mediator
    CHECK (
      (mode = 'direct' AND mediating_agent_root_did IS NULL)
      OR (mode = 'moneypenny_mediated' AND mediating_agent_root_did IS NOT NULL)
    )
);

-- One active chain per (principal, delegate, mode) — a second "active"
-- grant of the same shape must supersede (revoke) the prior one rather than
-- coexist ambiguously. Mirrors delegation_grants' single-active-grant
-- pattern in the more current codebase (see implementation-map doc).
CREATE UNIQUE INDEX IF NOT EXISTS uq_factor_authority_chain_active
  ON public.factor_authority_chains(tenant_id, principal_persona_id, delegate_agent_root_did, mode)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_factor_authority_chains_principal ON public.factor_authority_chains(principal_persona_id);
CREATE INDEX IF NOT EXISTS idx_factor_authority_chains_delegate  ON public.factor_authority_chains(delegate_agent_root_did);

ALTER TABLE public.factor_authority_chains ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS factor_authority_chains_read_service  ON public.factor_authority_chains;
DROP POLICY IF EXISTS factor_authority_chains_write_service ON public.factor_authority_chains;
CREATE POLICY factor_authority_chains_read_service  ON public.factor_authority_chains FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY factor_authority_chains_write_service ON public.factor_authority_chains FOR ALL    USING (auth.role() = 'service_role');

COMMENT ON TABLE public.factor_authority_chains IS 'Direct or MoneyPenny-mediated delegation chain to Factor (PRD §2.1). principal_persona_id is T0.';

ALTER TABLE public.factor_cases
  ADD CONSTRAINT factor_cases_authority_chain_fk
  FOREIGN KEY (authority_chain_id) REFERENCES public.factor_authority_chains(chain_id);

-- ─────────────────────────────────────────────────────────────────────────
-- 7. factor_standing_proposals — Factor PROPOSES standing events; it never
--    writes standing directly (PRD §10, invariant 18, acceptance criterion
--    18). A human/operator reviewer accepts or rejects; only an accepted
--    proposal may be hand-carried into the existing
--    crm_persona_reputation / crm_reputation_events accrual path — that
--    write is intentionally OUT OF SCOPE for this migration/service (it
--    belongs to the existing standing-accrual code path, not to Factor).
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.factor_standing_proposals (
  proposal_id                 uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id                       uuid REFERENCES public.factor_cases(case_id) ON DELETE SET NULL,
  subject_agent_ref              text        NOT NULL,   -- whose standing is being proposed
  proposing_principal_ref        text        NOT NULL,   -- Factor's own ref — never a persona_id
  witnessed_action                text        NOT NULL,
  mandate_authority_chain_id       uuid REFERENCES public.factor_authority_chains(chain_id),
  expected_outcome                  text,
  observed_outcome                  text,
  veracity_evidence                  jsonb       NOT NULL DEFAULT '[]'::jsonb,
  contribution_evidence               jsonb       NOT NULL DEFAULT '[]'::jsonb,
  risk_of_repair_evidence              jsonb       NOT NULL DEFAULT '[]'::jsonb,
  pulse_pnl_refs                        jsonb       NOT NULL DEFAULT '[]'::jsonb,
  receipt_refs                          jsonb       NOT NULL DEFAULT '[]'::jsonb,
  status                                 text        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected')),
  decided_by_persona_ref                  text,
  decided_at                                timestamptz,
  decision_notes                            text,
  created_at                                 timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_factor_standing_proposals_case    ON public.factor_standing_proposals(case_id);
CREATE INDEX IF NOT EXISTS idx_factor_standing_proposals_status  ON public.factor_standing_proposals(status);

ALTER TABLE public.factor_standing_proposals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS factor_standing_proposals_read_service  ON public.factor_standing_proposals;
DROP POLICY IF EXISTS factor_standing_proposals_write_service ON public.factor_standing_proposals;
CREATE POLICY factor_standing_proposals_read_service  ON public.factor_standing_proposals FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY factor_standing_proposals_write_service ON public.factor_standing_proposals FOR ALL    USING (auth.role() = 'service_role');

COMMENT ON TABLE public.factor_standing_proposals IS 'Factor PROPOSES standing events only (PRD §10). Acceptance is a separate, out-of-scope human/operator act that writes crm_persona_reputation via the existing accrual path — this table never does so itself.';

COMMIT;
