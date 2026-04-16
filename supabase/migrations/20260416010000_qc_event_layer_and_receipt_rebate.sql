-- ─────────────────────────────────────────────────────────────────────────────
-- Qc Event Layer + DVN Receipt Rebate Extension
-- Venture Lab α — Phase 2
--
-- 1. qc_events — immutable ledger of all Qc-metered events per persona
-- 2. ALTER registry_receipts — add rebate/finalisation columns (provisional,
--    finalized_at, dispute_status, policy_snapshot, lineage)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. qc_events table ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS qc_events (
  event_id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id       TEXT        NOT NULL,
  action_type      TEXT        NOT NULL,  -- 'reward_granted' | 'skill_invoked' | 'receipt_emitted' | 'session_metered'
  amount_qc        NUMERIC     NOT NULL DEFAULT 0,
  direction        TEXT        NOT NULL,  -- 'credit' | 'debit' | 'meter'
  cartridge_id     TEXT,                  -- e.g. 'knyt'
  skill_id         TEXT,                  -- registry_assets.asset_id of the SkillQube
  receipt_id       TEXT,                  -- registry_receipts.receipt_id
  reward_grant_id  TEXT,                  -- reward_grants.id
  provisional      BOOLEAN     NOT NULL DEFAULT true,
  finalized_at     TIMESTAMPTZ,
  metadata         JSONB       NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS qc_events_persona_id_idx  ON qc_events (persona_id);
CREATE INDEX IF NOT EXISTS qc_events_action_type_idx ON qc_events (action_type);
CREATE INDEX IF NOT EXISTS qc_events_receipt_id_idx  ON qc_events (receipt_id);
CREATE INDEX IF NOT EXISTS qc_events_created_at_idx  ON qc_events (created_at DESC);

-- ── 2. Extend registry_receipts with rebate / DVN finalisation columns ───────
-- Guards: ADD COLUMN IF NOT EXISTS prevents errors on re-run.

ALTER TABLE registry_receipts
  ADD COLUMN IF NOT EXISTS provisional      BOOLEAN     NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS finalized_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dispute_status   TEXT        NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS policy_snapshot  JSONB,
  ADD COLUMN IF NOT EXISTS lineage          JSONB;

-- All existing receipts are provisional by definition (retroactively correct)
-- dispute_status default 'none' is already set above for new rows; existing rows
-- get the column with the DEFAULT value via the ADD COLUMN statement.

COMMENT ON TABLE qc_events IS
  'Immutable Qc event ledger — records every metered, accrued, or rebated Qc event. '
  'All events are provisional until finalized_at is set by DVN confirmation.';

COMMENT ON COLUMN qc_events.action_type IS
  'reward_granted | skill_invoked | receipt_emitted | session_metered';

COMMENT ON COLUMN qc_events.direction IS
  'credit (Qc earned/accrued) | debit (Qc spent) | meter (zero-cost but logged)';

COMMENT ON COLUMN qc_events.provisional IS
  'true until DVN confirms the associated receipt; then set to false and finalized_at populated';

COMMENT ON COLUMN registry_receipts.provisional IS
  'true until DVN anchor confirms; false = finalized and rebate-eligible';

COMMENT ON COLUMN registry_receipts.dispute_status IS
  'none | disputed | resolved | reversed';

COMMENT ON COLUMN registry_receipts.policy_snapshot IS
  'Snapshot of the cartridge/skill policy in effect at receipt creation time';

COMMENT ON COLUMN registry_receipts.lineage IS
  'Actor attribution chain: [{actorId, role, action, timestamp}]';
