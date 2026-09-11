-- KNYTS Bridge — Crossing of the Week
--
-- The smallest new subsystem the KNYTS Bridge campaign needs (approved
-- plan, item 7): a simple announcement record, never a ledger. One row per
-- selected week, pointing at the winning community_generated_content row.
-- No amounts, no running balance, no accrual — just "this crossing was
-- featured for this week."

CREATE TABLE IF NOT EXISTS knyts_bridge_crossing_of_the_week (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- ISO week start (Monday), so at most one winner per week.
  week_start DATE NOT NULL UNIQUE,
  community_content_id UUID NOT NULL REFERENCES community_generated_content(id),
  score INTEGER NOT NULL DEFAULT 0,
  selected_by TEXT NOT NULL DEFAULT 'auto' CHECK (selected_by IN ('auto', 'admin')),
  selected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knyts_bridge_cotw_week_start
  ON knyts_bridge_crossing_of_the_week(week_start DESC);
