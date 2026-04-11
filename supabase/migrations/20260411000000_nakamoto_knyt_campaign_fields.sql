-- Migration: Add KNYT Wheel campaign state/cohort fields to nakamoto_knyt_personas
-- These fields drive campaign segmentation, sequence dispatch, and the dashboard.
-- All columns are nullable and additive — no existing data is touched.
--
-- Run before the KNYT Wheel launch. Apply via Supabase SQL editor or supabase db push.

ALTER TABLE public."nakamoto_knyt_personas"
  ADD COLUMN IF NOT EXISTS campaign_cohort            TEXT         DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS campaign_state             TEXT         DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS offer_fit                  TEXT         DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS message_angle              TEXT         DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS preferred_channel_primary  TEXT         DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS preferred_channel_secondary TEXT        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS reactivation_potential     TEXT         DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS investment_amount_band     TEXT         DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS investor_priority_band     TEXT         DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS kickstarter_clicked_at     TIMESTAMPTZ  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS kickstarter_backed_at      TIMESTAMPTZ  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_campaign_sent_at      TIMESTAMPTZ  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_campaign_sequence     TEXT         DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS campaign_notes             TEXT         DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS campaign_tags              TEXT[]       DEFAULT NULL;

COMMENT ON COLUMN public."nakamoto_knyt_personas".campaign_cohort
  IS 'Campaign segmentation cohort: top_shelf | zero_knyt | reactivation | partner | cold';

COMMENT ON COLUMN public."nakamoto_knyt_personas".campaign_state
  IS 'Campaign funnel state: unsent | sent | opened | clicked | backed | opted_out';

COMMENT ON COLUMN public."nakamoto_knyt_personas".offer_fit
  IS 'Which offer fits this investor best: top_shelf | zero_knyt | general';

COMMENT ON COLUMN public."nakamoto_knyt_personas".message_angle
  IS 'Preferred message angle: equity | community | collectible';

COMMENT ON COLUMN public."nakamoto_knyt_personas".preferred_channel_primary
  IS 'Primary preferred outreach channel (email, sms, telegram, etc.)';

COMMENT ON COLUMN public."nakamoto_knyt_personas".preferred_channel_secondary
  IS 'Secondary preferred outreach channel';

COMMENT ON COLUMN public."nakamoto_knyt_personas".reactivation_potential
  IS 'Likelihood to re-engage: high | medium | low';

COMMENT ON COLUMN public."nakamoto_knyt_personas".investment_amount_band
  IS 'Total investment band: <500 | 500-1999 | 2000-4999 | 5000+';

COMMENT ON COLUMN public."nakamoto_knyt_personas".investor_priority_band
  IS 'Operator-assigned priority tier: tier1 | tier2 | tier3';

COMMENT ON COLUMN public."nakamoto_knyt_personas".kickstarter_clicked_at
  IS 'Timestamp when investor clicked the tracked Kickstarter link';

COMMENT ON COLUMN public."nakamoto_knyt_personas".kickstarter_backed_at
  IS 'Timestamp when investor backed the Kickstarter (set via backer sync or manual update)';

COMMENT ON COLUMN public."nakamoto_knyt_personas".last_campaign_sent_at
  IS 'Timestamp of most recent campaign sequence dispatch to this investor';

COMMENT ON COLUMN public."nakamoto_knyt_personas".last_campaign_sequence
  IS 'Sequence ID of the last campaign dispatched (e.g. knyt_top_shelf_v1)';

COMMENT ON COLUMN public."nakamoto_knyt_personas".campaign_notes
  IS 'Free-text operator notes for this investor during the campaign';

COMMENT ON COLUMN public."nakamoto_knyt_personas".campaign_tags
  IS 'Flexible tag array for campaign micro-segmentation';

-- Indexes for the most-queried campaign fields
CREATE INDEX IF NOT EXISTS idx_nkp_campaign_cohort
  ON public."nakamoto_knyt_personas" (campaign_cohort);

CREATE INDEX IF NOT EXISTS idx_nkp_campaign_state
  ON public."nakamoto_knyt_personas" (campaign_state);

CREATE INDEX IF NOT EXISTS idx_nkp_ks_clicked
  ON public."nakamoto_knyt_personas" (kickstarter_clicked_at)
  WHERE kickstarter_clicked_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_nkp_ks_backed
  ON public."nakamoto_knyt_personas" (kickstarter_backed_at)
  WHERE kickstarter_backed_at IS NOT NULL;
