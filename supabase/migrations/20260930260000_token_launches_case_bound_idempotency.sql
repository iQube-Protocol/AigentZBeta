-- 20260930260000_token_launches_case_bound_idempotency.sql
--
-- Use Case Zero closure item 4 (2026-09-07 correction, REVISED after
-- operator review of the first version of this migration): the rehearsal
-- idempotency lookup was scoped to (tenant, beneficiary) only —
-- `findLatestTokenLaunchForBeneficiary` — which conflates every case/journey
-- a beneficiary might ever run through, and cannot tell "the same exact
-- specification, asked twice" apart from "a genuinely different
-- specification" (a changed tokenName/tokenSymbol/chain/description would
-- silently resume — and preflight terms for — an unrelated older draft).
--
-- REVISION NOTE (why this migration changed shape): the first version of
-- this migration added a PARTIAL unique index
-- (`... WHERE draft_idempotency_key IS NOT NULL`) and dropped
-- `uq_token_launches_current` outright. Both were wrong:
--   - PostgREST/`supabase-js` `.upsert(row, { onConflict: '<cols>' })`
--     generates a plain column-list `ON CONFLICT (<cols>)` clause. Postgres
--     can only resolve that against an index with NO partial predicate —
--     it cannot infer a partial index as the arbiter. Against the old
--     partial index, the generated `INSERT ... ON CONFLICT
--     (tenant_id, draft_idempotency_key) DO NOTHING` would fail at
--     execution time with "no unique or exclusion constraint matching the
--     ON CONFLICT specification" — a live-only failure the in-memory fake
--     Supabase client used in this repo's first test pass could not catch.
--   - Dropping `uq_token_launches_current` removed the one-current-launch-
--     per-beneficiary invariant entirely, allowing multiple simultaneous
--     non-superseded drafts for the same beneficiary — a real regression
--     services/factor/tokenLaunchService.ts's own application logic
--     (`createOrResumeDraft`) must not be the ONLY thing preventing.
--
-- This (corrected) migration instead:
--   1. Adds `case_ref` — the Factor case (or other journey) this launch
--      rehearsal is bound to. Nullable for pre-existing rows.
--   2. Adds `draft_idempotency_key` — a deterministic commitment
--      (services/factor/canonical.ts::commit()) over
--      {tenantId, caseRef, beneficiaryAgentRuntimeId, chain, tokenName,
--      tokenSymbol, description} — computed at DRAFT time, before Bankr
--      terms exist (distinct from `idempotency_key`, the SUBMISSION-time
--      key set only once a launch is 'approved'). Two identical
--      specifications for the same case always hash to the SAME key; any
--      field changing produces a DIFFERENT key.
--   3. Enforces uniqueness on (tenant_id, draft_idempotency_key) via a
--      FULL, non-partial unique index — Postgres already permits multiple
--      NULL values in an ordinary unique index (NULLs are never considered
--      equal to each other), so no partial predicate is needed to allow
--      old/irrelevant rows to carry a NULL key; PostgREST's `onConflict`
--      inference works correctly against it. `services/factor/
--      tokenLaunchService.ts::reviseWithNewVersion` clears a superseded
--      row's `draft_idempotency_key` back to NULL, so a key is only ever
--      "live" on the one row that currently holds it.
--   4. PRESERVES `uq_token_launches_current` (tenant, beneficiary,
--      provider, WHERE superseded_by IS NULL) exactly as the original
--      20260930220000 migration defined it — the one-current-launch
--      invariant is never removed. This index is never targeted by an
--      `onConflict` upsert (application logic reads it via
--      `findCurrentLaunchForBeneficiary` and decides resume/create/
--      supersede explicitly), so its partial predicate is not a PostgREST
--      inference problem here — it remains a pure DB-level backstop.

ALTER TABLE token_launches
  ADD COLUMN IF NOT EXISTS case_ref TEXT,
  ADD COLUMN IF NOT EXISTS draft_idempotency_key TEXT;

CREATE INDEX IF NOT EXISTS idx_token_launches_case_ref ON token_launches (tenant_id, case_ref);

CREATE UNIQUE INDEX IF NOT EXISTS uq_token_launches_draft_idempotency
  ON token_launches (tenant_id, draft_idempotency_key);
