-- 20260825000000_governance_ratifications.sql
--
-- The persisted governance ratification record (operator ruling, 2026-07-27).
--
-- "Replace the hardcoded governance decision array as the effective event
--  source with a persisted ratification record, while retaining it temporarily
--  as a compatibility projection if necessary."
--
-- THIS TABLE IS THE EVENT SOURCE. `GOVERNANCE_DECISIONS` in
-- services/governance/governanceDecisionLog.ts becomes SEED data projected over
-- these rows; it is no longer the thing that makes a ratification true.
--
-- ── WHAT IS DELIBERATELY ABSENT ──────────────────────────────────────────
--
-- There is NO `anchor_status` column, and there must never be one. Anchor state
-- is OBSERVED from the referenced activity_receipts row's real `receipt_status`
-- at read time (services/governance/governanceRatification.ts,
-- observeAnchorStatuses). A column here would be a value written at insert time
-- — a hope, not an observation — and a record that claims an anchor it never
-- got is precisely the misrepresentation this whole ruling exists to prevent.
--
-- The two vocabularies are MAPPED, never unified:
--   receipt_status  local | dvn_pending | dvn_recorded | dvn_failed   (the pipeline's)
--   anchorStatus    local | submitted   | anchored     | failed       (governance's)
-- Both are returned to callers. Neither is stored.
--
-- ── T0/T2 DISCIPLINE ─────────────────────────────────────────────────────
--
-- No personaId, authProfileId, rootDid or caseId appears in any column. The
-- ratifying authority is `ratified_by_ref`: a one-way sha256 commitment
-- (`governance:ratifier:<personaId>`, 16 hex chars), the same class of value the
-- DVN pipeline's hashPersonaRef and the Constitutional Agreement primitive's
-- owner_commitment already use. Service-role access only: RLS enabled with no
-- client policies, matching constitutional_agreements and
-- experiment_workspace_items.
--
-- Every statement is additive and idempotent (CFS-010 §3).

CREATE TABLE IF NOT EXISTS public.governance_ratifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The governance decision this act ratifies (GD-014, LAW-XVI, …). One
  -- ratification per decision: a changed document is a NEW decision that
  -- supersedes, never a rewrite of this row.
  decision_id text NOT NULL UNIQUE,

  -- WHAT was ratified. The ruling: "The ratification event must attest to what
  -- was ratified, not merely the decision ID."
  document_id text NOT NULL,
  document_title text NOT NULL,
  document_version text NOT NULL,
  document_path text NOT NULL,

  -- The registered framework this document is, when it is one
  -- (services/polity/constitutionalFrameworkRegistry.ts). Text, not a FK: the
  -- registry is CODE, and a FK would force it into being a table.
  framework_id text,

  -- MANDATORY. sha256 hex of the exact bytes ratified. "The immutable content
  -- hash is mandatory. A CID is preferable when the document is also published
  -- to Autonomys, but anchoring should not silently depend on publication
  -- succeeding."
  content_hash text NOT NULL,

  -- Attached AFTER publication, by attachPublication(). NULL is a normal,
  -- complete state — a ratification whose Autodrive publish failed is still a
  -- valid, receipted, anchorable ratification.
  content_cid text,
  published_at timestamptz,

  -- THE HONESTY FIELD. Which document the hash is of:
  --   as-ratified  the bytes that were actually ratified at ratified_at
  --   as-recorded  the document as it stood at recorded_at, which may differ
  -- A retrospective attestation whose historical bytes are unrecoverable can
  -- only honestly be 'as-recorded'.
  content_hash_scope text NOT NULL DEFAULT 'as-ratified',

  amendment_ids text[] NOT NULL DEFAULT '{}',
  supersedes text[] NOT NULL DEFAULT '{}',
  previous_content_hash text,

  -- T2 one-way commitment of the ratifying authority. NEVER a persona id.
  ratified_by_ref text NOT NULL,
  authority_basis text NOT NULL,

  act text NOT NULL DEFAULT 'ratify',

  -- original     the act itself, performed here and now
  -- retrospective an attestation of a ratification that happened before the
  --               platform could record it (Law XVI, Horizen A-F). Never
  --               presented as having been originally anchored.
  ratification_kind text NOT NULL DEFAULT 'original',

  -- The CONSTITUTIONAL date (historical for a retrospective record) and the
  -- date the PLATFORM recorded it. Two columns because collapsing them is how a
  -- historic ratification gets silently backdated or silently re-dated.
  ratified_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  effective_at timestamptz,

  -- Retrospective only; NULL for an original act, where the question is
  -- meaningless rather than false.
  historical_content_recoverable boolean,
  anchoring_is_retrospective boolean NOT NULL DEFAULT false,

  -- The activity_receipts row created by createGovernanceReceipt(). NULL means
  -- the act was recorded and the receipt write failed — visible and retryable,
  -- never silently successful.
  receipt_id text,

  domain text NOT NULL DEFAULT 'constitutional',
  summary text NOT NULL,

  -- The ConstitutionalObject (types/constitutionalObject.ts, kind
  -- 'ratification'). findForbiddenObjectKey-clean by construction.
  object jsonb NOT NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.governance_ratifications
  DROP CONSTRAINT IF EXISTS governance_ratifications_kind_check;
ALTER TABLE public.governance_ratifications
  ADD CONSTRAINT governance_ratifications_kind_check
  CHECK (ratification_kind IN ('original', 'retrospective'));

ALTER TABLE public.governance_ratifications
  DROP CONSTRAINT IF EXISTS governance_ratifications_act_check;
ALTER TABLE public.governance_ratifications
  ADD CONSTRAINT governance_ratifications_act_check
  CHECK (act IN ('ratify', 'amend'));

ALTER TABLE public.governance_ratifications
  DROP CONSTRAINT IF EXISTS governance_ratifications_hash_scope_check;
ALTER TABLE public.governance_ratifications
  ADD CONSTRAINT governance_ratifications_hash_scope_check
  CHECK (content_hash_scope IN ('as-ratified', 'as-recorded'));

-- A retrospective record MUST answer the recoverability question, and an
-- original act must not pretend to. Enforced in the database as well as the
-- service so a direct insert cannot manufacture a claim about history.
ALTER TABLE public.governance_ratifications
  DROP CONSTRAINT IF EXISTS governance_ratifications_retrospective_honesty_check;
ALTER TABLE public.governance_ratifications
  ADD CONSTRAINT governance_ratifications_retrospective_honesty_check
  CHECK (
    (ratification_kind = 'retrospective'
       AND historical_content_recoverable IS NOT NULL
       AND anchoring_is_retrospective = true)
    OR
    (ratification_kind = 'original'
       AND historical_content_recoverable IS NULL
       AND anchoring_is_retrospective = false)
  );

-- An unrecoverable historical document can only be hashed as-recorded.
ALTER TABLE public.governance_ratifications
  DROP CONSTRAINT IF EXISTS governance_ratifications_hash_scope_honesty_check;
ALTER TABLE public.governance_ratifications
  ADD CONSTRAINT governance_ratifications_hash_scope_honesty_check
  CHECK (
    historical_content_recoverable IS DISTINCT FROM false
    OR content_hash_scope = 'as-recorded'
  );

CREATE INDEX IF NOT EXISTS governance_ratifications_ratified_idx
  ON public.governance_ratifications (ratified_at DESC);

CREATE INDEX IF NOT EXISTS governance_ratifications_document_idx
  ON public.governance_ratifications (document_id, document_version);

CREATE INDEX IF NOT EXISTS governance_ratifications_framework_idx
  ON public.governance_ratifications (framework_id);

CREATE INDEX IF NOT EXISTS governance_ratifications_receipt_idx
  ON public.governance_ratifications (receipt_id);

ALTER TABLE public.governance_ratifications ENABLE ROW LEVEL SECURITY;
