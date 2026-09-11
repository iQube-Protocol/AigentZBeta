-- Reset the 40 commercialisation institutional-registry rows stuck at
-- 'pending_verification' with no completed run — found 2026-07-28 when the
-- operator ran the (now-real) verification script and got 0/40 verified,
-- every entry with error "cannot start verification from
-- 'pending_verification' — re-open the entry first".
--
-- ROOT CAUSE. verifyInstitutionEntry (services/corpusScout/registryVerification.ts)
-- requires ALLOWED_TRANSITIONS[current].includes('pending_verification')
-- before it will run a verification. 'pending_verification' is NOT in its
-- own allowed-transition list — only ['verified', 'verification_failed',
-- 'insufficient_corpus', 'temporarily_unavailable', 'redirect_changed',
-- 'deprecated'] may enter it, per the deliberate rule "verified is reachable
-- only from pending_verification" (a self-transition would let a caller
-- re-declare pending_verification without ever running anything).
--
-- 20260828000000_corpus_registry_verification.sql's own migration comment
-- reads: "Wave 1 rows move from 'proposed' to 'pending_verification' too —
-- the whole Commercialisation registry is submitted for verification
-- together" — and its wave-2 INSERT set verification_status directly to
-- 'pending_verification' for new rows too. Both were meant as a "queued for
-- verification" marker. But nothing ever actually STARTED a run against
-- these rows — no fetch happened, no outcome was recorded, verified_at is
-- null for all of them. The migration set the state a completed-or-running
-- verification produces, without ever running one. The transition guard
-- then correctly refuses to let a NEW run start from that state, because
-- from its perspective a run might already be in flight.
--
-- THE FIX IS DATA, NOT CODE. The transition table itself is correct and
-- protective — it is exactly what stops "verified" from being reachable by
-- fiat. The defect is that these specific rows were written into a state no
-- real verification run ever produced. Reset them to 'proposed', the
-- documented "never submitted for verification" state, which the same table
-- explicitly allows to transition into 'pending_verification'. This does
-- NOT touch the Law II closure content (traditions, source_tier, status —
-- the institutional-authority ratification status set by
-- scripts/ratify-commercialisation-institutions.js) — only
-- verification_status, verified_at and verification_checked_at.
--
-- SCOPED, defensively: only rows that are actually stuck (pending_verification
-- with no verified_at — i.e. never completed a real run) are touched. A row
-- that somehow does carry a verified_at is left exactly as it is, in case any
-- other domain or a manual correction already resolved it.
--
-- Idempotent: re-running has no effect once these rows have a real
-- verification_status again (proposed rows stay proposed; nothing here
-- matches a non-stuck row).

UPDATE public.corpus_institutional_registry
SET
  verification_status = 'proposed',
  verification_checked_at = NULL,
  updated_at = now()
WHERE domain = 'commercialisation'
  AND verification_status = 'pending_verification'
  AND verified_at IS NULL;
