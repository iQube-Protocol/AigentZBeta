-- 20260930260000_token_launches_case_bound_idempotency.sql
--
-- Use Case Zero closure item 4 (2026-09-07 correction): the rehearsal
-- idempotency lookup was scoped to (tenant, beneficiary) only —
-- `findLatestTokenLaunchForBeneficiary` — which conflates every case/journey
-- a beneficiary might ever run through, and cannot tell "the same exact
-- specification, asked twice" apart from "a genuinely different
-- specification" (a changed tokenName/tokenSymbol/chain/description would
-- silently resume — and preflight terms for — an unrelated older draft).
--
-- This migration:
--   1. Adds `case_ref` — the Factor case (or other journey) this launch
--      rehearsal is bound to. Nullable for pre-existing rows; every NEW
--      draft created via createOrResumeDraft() sets it.
--   2. Adds `draft_idempotency_key` — a deterministic commitment
--      (services/factor/canonical.ts::commit()) over
--      {tenantId, caseRef, beneficiaryAgentRuntimeId, chain, tokenName,
--      tokenSymbol, description} — computed at DRAFT time, before Bankr
--      terms exist (distinct from `idempotency_key`, which is the
--      SUBMISSION-time key set only once a launch is 'approved'). Two
--      identical specifications for the same case always hash to the SAME
--      key; any field changing produces a DIFFERENT key.
--   3. Enforces uniqueness on (tenant_id, draft_idempotency_key) in
--      Postgres — the mechanism that makes createOrResumeDraft() ATOMIC:
--      two concurrent requests with the SAME exact spec race to insert the
--      SAME key, exactly one wins, the loser's `ON CONFLICT DO NOTHING`
--      no-ops, and both callers then read back the SAME single winning row.
--      A DIFFERENT spec computes a DIFFERENT key and therefore always
--      inserts a genuinely NEW row — it can never collide with, resume, or
--      cause a preflight against an older draft's row.
--   4. DROPS `uq_token_launches_current` (tenant, beneficiary, provider) —
--      that constraint enforced "one non-superseded launch per beneficiary"
--      globally, which is exactly what item 4 requires us to STOP doing:
--      a case-bound, exact-spec model deliberately allows multiple
--      concurrent non-superseded drafts for the same beneficiary as long as
--      their case/spec differ. The NEW unique index on
--      (tenant_id, draft_idempotency_key) is the correct, narrower
--      uniqueness guarantee for this model — one row per EXACT
--      (case, spec) pair, not one row per beneficiary.

ALTER TABLE token_launches
  ADD COLUMN IF NOT EXISTS case_ref TEXT,
  ADD COLUMN IF NOT EXISTS draft_idempotency_key TEXT;

CREATE INDEX IF NOT EXISTS idx_token_launches_case_ref ON token_launches (tenant_id, case_ref);

DROP INDEX IF EXISTS uq_token_launches_current;

CREATE UNIQUE INDEX IF NOT EXISTS uq_token_launches_draft_idempotency
  ON token_launches (tenant_id, draft_idempotency_key)
  WHERE draft_idempotency_key IS NOT NULL;
