-- ============================================================================
-- Constitutional receipt spine: shared-commitment dual-leg anchoring state
-- (operator ruling, 2026-08-08)
--
-- WHY
-- ---
-- `activity_receipts` modelled anchoring as ONE overloaded flag
-- (`receipt_status`: local | dvn_pending | dvn_recorded | dvn_failed) plus a
-- single `dvn_receipt_id`. That schema can only describe the DVN leg — which
-- is precisely why the PoS/Bitcoin leg could go missing for the system's whole
-- history without any row being able to say so.
--
-- Proven live 2026-08-08: of 624 receipts inside the proof_of_state canister's
-- Bitcoin-anchored Merkle batches, ZERO were activity receipts (461 were
-- synthetic `sync_*`/`test_*`/`anchor*` entries). `dvn_recorded` was 0 across
-- all 1,290 rows. The spine had one leg, and the schema could not express the
-- absence of the other.
--
-- THE MODEL THIS INTRODUCES
-- -------------------------
--   one constitutional event
--        -> one deterministic commitment H (commitment_hash)
--        -> two INDEPENDENTLY TRACKED legs:
--             PoS/BTC : pos_receipt_id, pos_status, btc_batch_root, btc_anchor_txid
--             DVN     : dvn_receipt_id, dvn_status
--
-- A receipt is NOT Bitcoin-anchored because its DVN message reached quorum,
-- and NOT DVN-verified because its PoS batch reached Bitcoin. "Canonical"
-- becomes a PROJECTION over both legs' evidence rather than a third ambiguous
-- flag, so nothing here computes or stores it.
--
-- ADDITIVE AND REVERSIBLE. `receipt_status` is deliberately left in place and
-- untouched: every existing reader keeps working unchanged, and the historical
-- populations (120 dvn_failed with no message id = genuine submission
-- failures; 267 dvn_pending WITH message ids = acknowledgement failures) stay
-- exactly as they are. This migration adds the vocabulary needed to tell those
-- apart per leg; it repairs no rows and rewrites no history.
-- ============================================================================

-- ── The shared commitment ───────────────────────────────────────────────────
-- sha256 hex over the receipt's immutable, T2-safe projection
-- (services/receipts/receiptCommitment.ts). The SAME value is passed to
-- proof_of_state.issue_receipt(data_hash) and carried inside the DVN payload,
-- so the two legs reconcile by identity rather than by queue arithmetic.
-- NULL for every historical row: these were written before the commitment
-- existed, and back-filling one would fabricate provenance rather than record
-- it.
ALTER TABLE public.activity_receipts
  ADD COLUMN IF NOT EXISTS commitment_hash text;

-- ── The PoS / Bitcoin leg ───────────────────────────────────────────────────
-- pos_receipt_id : the id proof_of_state.issue_receipt(H) returned.
-- pos_status     : lifecycle of THIS leg alone, never of the receipt overall.
--   pending   = issue_receipt accepted it; awaiting Merkle batching
--   batched   = it appears in a MerkleBatch that has no Bitcoin transaction yet
--   broadcast = a VALID transaction carrying the batch root was serialised and
--               accepted by the Bitcoin network; a real txid exists. NOTHING IS
--               CONFIRMED. (Amendment A2, operator 2026-08-08.) Collapsing this
--               into 'anchored' would be the same error class as 'dvn_recorded'
--               meaning "appeared in a queue": reporting a SUBMISSION as a
--               SETTLEMENT. A broadcast tx can be RBF-replaced (sequence
--               0xfffffffd enables it), evicted from mempools, or never mined.
--   anchored  = that txid appears in a block, at a height READ FROM THE NETWORK
--   failed    = issue_receipt was reached and refused
--   NULL      = this leg has never been attempted
ALTER TABLE public.activity_receipts
  ADD COLUMN IF NOT EXISTS pos_receipt_id text,
  ADD COLUMN IF NOT EXISTS pos_status text,
  ADD COLUMN IF NOT EXISTS btc_batch_root text,
  ADD COLUMN IF NOT EXISTS btc_anchor_txid text;

-- ── The DVN leg ─────────────────────────────────────────────────────────────
-- `dvn_receipt_id` already exists and is unchanged. `dvn_status` splits the
-- DVN half of the old overloaded `receipt_status` into its own column so the
-- two legs can disagree truthfully.
--   submitted = submit_dvn_message returned a message id
--   ready     = per-message readiness evidence obtained from the canister
--               (attestation quorum), NOT merely "the message exists"
--   failed    = the canister was reached and refused
--   NULL      = this leg has never been attempted
ALTER TABLE public.activity_receipts
  ADD COLUMN IF NOT EXISTS dvn_status text;

ALTER TABLE public.activity_receipts
  DROP CONSTRAINT IF EXISTS activity_receipts_pos_status_check;
ALTER TABLE public.activity_receipts
  ADD CONSTRAINT activity_receipts_pos_status_check
  CHECK (pos_status IS NULL OR pos_status IN ('pending', 'batched', 'broadcast', 'anchored', 'failed'));

ALTER TABLE public.activity_receipts
  DROP CONSTRAINT IF EXISTS activity_receipts_dvn_status_check;
ALTER TABLE public.activity_receipts
  ADD CONSTRAINT activity_receipts_dvn_status_check
  CHECK (dvn_status IS NULL OR dvn_status IN ('submitted', 'ready', 'failed'));

-- ── Indexes for the reconciler's own queries ────────────────────────────────
-- The scheduled reconciler asks "which receipts have a leg outstanding?" —
-- partial indexes keep that cheap without carrying the (large) fully-settled
-- majority.
CREATE INDEX IF NOT EXISTS idx_activity_receipts_commitment_hash
  ON public.activity_receipts (commitment_hash)
  WHERE commitment_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_activity_receipts_pos_leg_outstanding
  ON public.activity_receipts (pos_status, created_at)
  WHERE pos_status IS DISTINCT FROM 'anchored';

CREATE INDEX IF NOT EXISTS idx_activity_receipts_dvn_leg_outstanding
  ON public.activity_receipts (dvn_status, created_at)
  WHERE dvn_status IS DISTINCT FROM 'ready';

COMMENT ON COLUMN public.activity_receipts.commitment_hash IS
  'sha256 of the receipt''s immutable T2-safe projection (services/receipts/receiptCommitment.ts). The SAME value is the PoS data_hash and travels in the DVN payload; it is how the two legs are reconciled by identity. NULL on rows predating 2026-08-08.';
COMMENT ON COLUMN public.activity_receipts.pos_status IS
  'proof_of_state leg ONLY: pending|batched|broadcast|anchored|failed. ''broadcast'' = a real txid exists but nothing is confirmed; ''anchored'' = that txid is in a block at a height read from the network. Never implies anything about the DVN leg.';
COMMENT ON COLUMN public.activity_receipts.dvn_status IS
  'cross_chain_service leg ONLY: submitted|ready|failed. ''ready'' requires per-message attestation evidence, never mere message existence.';
