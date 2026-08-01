-- Independent Reviewer Agreement authorizations (operator ruling, 2026-08-02).
--
-- The durable record behind `collaborationAgreementAuthorized`. The ruling is
-- explicit that this must NOT be "a loose boolean set by the UI" — completion
-- is derived from a row here, and only when every conjunct matches:
--
--   active reviewer principal ∩ experiment ∩ agreement id+version
--                             ∩ current terms hash ∩ package scope
--
-- `agreement_hash` is the reason a materially changed agreement stops
-- authorizing: the hash is PINNED at authorization time, so when the canonical
-- terms change (services/research/reviewerAgreement.ts), previously stored
-- rows no longer match the recomputed hash and the gate refuses until the
-- reviewer authorizes the new version.
--
-- Rows are NEVER deleted or overwritten. Superseding and revocation are status
-- transitions, so v1's consent stays auditable forever — the ruling's
-- "v1 remains auditable / v1 no longer authorizes new submissions".

CREATE TABLE IF NOT EXISTS public.reviewer_agreement_authorizations (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Owner-scoped authorization row. Same exposure class as access_grants,
  -- which this sits beside and is queried the same way. NEVER serialised to a
  -- client or a receipt — those carry reviewer_ref (the T2 sha256/16 handle).
  persona_id         uuid NOT NULL,
  reviewer_ref       text NOT NULL,
  passport_ref       text,

  agreement_id       text NOT NULL,
  agreement_version  text NOT NULL,
  -- sha256 of the agreement's TERMS (identity, scope, clauses, permitted and
  -- prohibited acts) — see agreementHash() for exactly what is covered.
  agreement_hash     text NOT NULL,

  experiment_id      text NOT NULL,
  -- '*' (every package for the experiment) or a JSON array of package refs.
  package_scope      jsonb NOT NULL DEFAULT '"*"'::jsonb,

  conflict_declared  boolean NOT NULL DEFAULT false,
  conflict_statement text,

  authorized_at      timestamptz NOT NULL DEFAULT now(),
  proof_ref          text,
  receipt_id         uuid,

  -- 'active' | 'revoked' | 'superseded'
  status             text NOT NULL DEFAULT 'active',

  CONSTRAINT reviewer_agreement_status_valid
    CHECK (status IN ('active', 'revoked', 'superseded')),
  -- A declared conflict without a statement is not a disclosure.
  CONSTRAINT reviewer_agreement_conflict_stated
    CHECK (NOT conflict_declared OR conflict_statement IS NOT NULL)
);

-- The gate's exact lookup: caller + experiment + active.
CREATE INDEX IF NOT EXISTS reviewer_agreement_auth_persona_experiment_idx
  ON public.reviewer_agreement_authorizations (persona_id, experiment_id, status);

-- Idempotency: one ACTIVE authorization per (persona, agreement, hash). A
-- double-click cannot produce two consents to the same terms; authorizing a
-- NEW version is a different hash and therefore a different row.
CREATE UNIQUE INDEX IF NOT EXISTS reviewer_agreement_auth_unique_active_idx
  ON public.reviewer_agreement_authorizations (persona_id, agreement_id, agreement_hash)
  WHERE status = 'active';

ALTER TABLE public.reviewer_agreement_authorizations ENABLE ROW LEVEL SECURITY;

-- Server-side only: every read and write goes through the service role via
-- services/research/reviewerAgreement.ts, which resolves the caller through
-- the identity spine first. No client-side policy is granted — a reviewer
-- never queries this table directly.
DROP POLICY IF EXISTS reviewer_agreement_auth_service_role ON public.reviewer_agreement_authorizations;
CREATE POLICY reviewer_agreement_auth_service_role
  ON public.reviewer_agreement_authorizations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.reviewer_agreement_authorizations IS
  'Durable record of a reviewer authorizing an experiment-scoped Independent Reviewer Agreement. Authorizes review SUBMISSION only — confers no freeze, publication, canonisation or Standing authority.';
