-- 20260930220000_token_launches.sql
--
-- Factor + Aegis Bankr PRD, Phase 4 — a PROVIDER-NEUTRAL governed
-- token-launch aggregate. Not a Factor-only table: `beneficiary_agent_
-- runtime_id`/`requesting_principal_persona_id` name WHO the launch is
-- for and who is preparing it; Factor is simply the first, and today only,
-- preparer. `provider` is extensible beyond Bankr the same way
-- provider_wallet_bindings.provider is (a CHECK constraint value, never a
-- hardcoded assumption elsewhere in this schema).
--
-- Modelled on the SAME append-only/superseding + DB-trigger-immutability
-- pattern aegis_assessments (20260930190000) already established — never a
-- second immutability mechanism invented from scratch. A partial unique
-- index enforces "one CURRENT (non-superseded) launch per (tenant,
-- beneficiary, provider)"; a revision creates a NEW row (supersedes_id)
-- and marks the OLD row's superseded_by — the old row is never mutated.
--
-- IMMUTABILITY: once a row's state reaches 'approved' or any state at/after
-- it (submitting/submitted/confirmed), every SPEC-BEARING column is frozen
-- by trg_token_launches_immutable_fn below. If Bankr's own economic terms
-- (fees, chain support, vesting, pairing) genuinely change after approval,
-- the correct act is superseding this row with a NEW version carrying the
-- new terms and a fresh approval — never mutating the approved row. This is
-- the mechanical form of "changed Bankr economics force reapproval"
-- (PRD Phase 8's own acceptance criterion): the OLD approval_hash can never
-- be silently paired with NEW bankr_terms, because the row that carries the
-- old hash cannot be edited to carry new terms at all.
--
-- Deliberately narrow set of fields the trigger allows to still change once
-- approved: `state` itself (the launch must progress
-- submitting -> submitted -> confirmed|failed), the four fill-once
-- provider-outcome fields (bankr_job_id/transaction_hash/token_address/
-- pool_address/explorer_url — set once, from null, never reassigned to a
-- DIFFERENT non-null value), and `superseded_by` (the one column
-- aegis_assessments' own trigger also always permits, for the same reason:
-- recording supersession is not editing the decision).

CREATE TABLE IF NOT EXISTS token_launches (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,

  -- WHO this launch is for, and who is preparing/requesting it. Genuinely
  -- distinct fields (Phase 5's "tokenize another agent" vs "Factor's own
  -- token" journeys both flow through this one table — the self-conflict
  -- disclosure for the latter is application-layer, in
  -- services/factor/tokenLaunchService.ts, never a schema special-case).
  beneficiary_agent_runtime_id TEXT NOT NULL,
  requesting_principal_persona_id TEXT NOT NULL,
  preparing_agent_runtime_id TEXT NOT NULL,

  provider TEXT NOT NULL CHECK (provider IN ('bankr')),
  provider_wallet_binding_id TEXT REFERENCES provider_wallet_bindings(id),

  state TEXT NOT NULL DEFAULT 'draft' CHECK (state IN (
    'draft', 'preparing', 'preflighted', 'aegis_review_pending',
    'revision_required', 'approval_pending', 'approved', 'submitting',
    'submitted', 'confirmed', 'failed', 'cancelled', 'superseded'
  )),

  -- ── The versioned, immutable launch specification (Phase 4's own field list) ──
  execution_mode TEXT NOT NULL DEFAULT 'dry_run' CHECK (execution_mode IN ('dry_run', 'live')),
  chain TEXT NOT NULL,
  token_name TEXT NOT NULL,
  token_symbol TEXT NOT NULL,
  description TEXT,
  utility_claims JSONB NOT NULL DEFAULT '[]'::jsonb,
  image_url TEXT,
  metadata_url TEXT,
  website_url TEXT,
  social_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- PROPOSED fee recipient only (Phase 3 constraint) — the operator must
  -- confirm it explicitly in the final launch specification; this column
  -- alone is never sufficient authorization to route real fees.
  fee_recipient TEXT,
  paired_asset TEXT,
  vesting_config JSONB,
  -- Bankr's own returned economic terms, captured live (never hardcoded —
  -- see services/financialServices/providers/bankr/bankrProviderAdapter.ts::
  -- getTokenLaunchQuote()), with retrieval provenance.
  bankr_terms JSONB,
  bankr_terms_source_url TEXT,
  bankr_terms_retrieved_at TIMESTAMPTZ,
  -- Commitment over bankr_terms at the moment this spec was approved — the
  -- mechanical anchor "changed Bankr economics force reapproval" checks
  -- against; recomputing it against a FRESH quote and comparing is the
  -- token-launch domain service's job (services/factor/
  -- tokenLaunchService.ts), never this schema's.
  bankr_terms_hash TEXT,
  conflict_disclosures JSONB NOT NULL DEFAULT '[]'::jsonb,
  risk_disclosures JSONB NOT NULL DEFAULT '[]'::jsonb,
  aegis_assessment_id TEXT,

  -- Exact specification hash (services/factor/canonical.ts::commit()) over
  -- every spec-bearing field above — the caller's own auditable proof of
  -- exactly what was approved.
  spec_hash TEXT,
  -- Commitment over {specHash, approvedBy, approvedAt} — set only by the
  -- approval act (services/factor/tokenLaunchService.ts), never guessed
  -- or derived elsewhere.
  approval_hash TEXT,
  approved_by_persona_id TEXT,
  approved_at TIMESTAMPTZ,

  idempotency_key TEXT,

  -- Fill-once provider-outcome fields — see the trigger's own comment for
  -- exactly what "fill-once" means here.
  bankr_job_id TEXT,
  transaction_hash TEXT,
  token_address TEXT,
  pool_address TEXT,
  explorer_url TEXT,

  -- Versioning / supersession — same shape as aegis_assessments.
  version INTEGER NOT NULL DEFAULT 1,
  supersedes_id TEXT REFERENCES token_launches(id),
  superseded_by TEXT REFERENCES token_launches(id),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_token_launches_beneficiary ON token_launches (tenant_id, beneficiary_agent_runtime_id);
CREATE INDEX IF NOT EXISTS idx_token_launches_state ON token_launches (state);

-- One CURRENT (non-superseded) launch per (tenant, beneficiary, provider) —
-- a revision must supersede the prior current row before a new one can be
-- current, exactly mirroring aegis_assessments' own partial unique index.
CREATE UNIQUE INDEX IF NOT EXISTS uq_token_launches_current
  ON token_launches (tenant_id, beneficiary_agent_runtime_id, provider)
  WHERE superseded_by IS NULL;

-- Duplicate submission is impossible (Phase 8 acceptance criterion): the
-- SAME idempotency key can never be attached to two distinct rows.
CREATE UNIQUE INDEX IF NOT EXISTS uq_token_launches_idempotency_key
  ON token_launches (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE token_launches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS token_launches_service_only ON token_launches;
CREATE POLICY token_launches_service_only ON token_launches
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION token_launches_immutable_fn()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.state IN ('approved', 'submitting', 'submitted', 'confirmed') THEN
    IF NEW.chain IS DISTINCT FROM OLD.chain
       OR NEW.token_name IS DISTINCT FROM OLD.token_name
       OR NEW.token_symbol IS DISTINCT FROM OLD.token_symbol
       OR NEW.description IS DISTINCT FROM OLD.description
       OR NEW.utility_claims IS DISTINCT FROM OLD.utility_claims
       OR NEW.image_url IS DISTINCT FROM OLD.image_url
       OR NEW.metadata_url IS DISTINCT FROM OLD.metadata_url
       OR NEW.website_url IS DISTINCT FROM OLD.website_url
       OR NEW.social_refs IS DISTINCT FROM OLD.social_refs
       OR NEW.fee_recipient IS DISTINCT FROM OLD.fee_recipient
       OR NEW.paired_asset IS DISTINCT FROM OLD.paired_asset
       OR NEW.vesting_config IS DISTINCT FROM OLD.vesting_config
       OR NEW.bankr_terms IS DISTINCT FROM OLD.bankr_terms
       OR NEW.bankr_terms_hash IS DISTINCT FROM OLD.bankr_terms_hash
       OR NEW.conflict_disclosures IS DISTINCT FROM OLD.conflict_disclosures
       OR NEW.risk_disclosures IS DISTINCT FROM OLD.risk_disclosures
       OR NEW.aegis_assessment_id IS DISTINCT FROM OLD.aegis_assessment_id
       OR NEW.spec_hash IS DISTINCT FROM OLD.spec_hash
       OR NEW.approval_hash IS DISTINCT FROM OLD.approval_hash
    THEN
      RAISE EXCEPTION 'token_launches: row % is % (immutable) — a change to the launch specification requires a NEW superseding version, never an edit to this row', OLD.id, OLD.state;
    END IF;
    -- Fill-once fields: allowed to move from NULL to a value, never
    -- reassigned to a DIFFERENT non-null value.
    IF OLD.bankr_job_id IS NOT NULL AND NEW.bankr_job_id IS DISTINCT FROM OLD.bankr_job_id THEN
      RAISE EXCEPTION 'token_launches: row % bankr_job_id is already set — it cannot be reassigned', OLD.id;
    END IF;
    IF OLD.transaction_hash IS NOT NULL AND NEW.transaction_hash IS DISTINCT FROM OLD.transaction_hash THEN
      RAISE EXCEPTION 'token_launches: row % transaction_hash is already set — it cannot be reassigned', OLD.id;
    END IF;
    IF OLD.token_address IS NOT NULL AND NEW.token_address IS DISTINCT FROM OLD.token_address THEN
      RAISE EXCEPTION 'token_launches: row % token_address is already set — it cannot be reassigned', OLD.id;
    END IF;
    IF OLD.pool_address IS NOT NULL AND NEW.pool_address IS DISTINCT FROM OLD.pool_address THEN
      RAISE EXCEPTION 'token_launches: row % pool_address is already set — it cannot be reassigned', OLD.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_token_launches_immutable ON token_launches;
CREATE TRIGGER trg_token_launches_immutable
  BEFORE UPDATE ON token_launches
  FOR EACH ROW EXECUTE FUNCTION token_launches_immutable_fn();
