-- Migration: add last_event_at to ks_backers_staging
-- Tracks the timestamp of the most recent Mailjet engagement event
-- (open, click, bounce, unsub) for a contact, separate from last_sent_at.

ALTER TABLE ks_backers_staging
  ADD COLUMN IF NOT EXISTS last_event_at timestamptz;

COMMENT ON COLUMN ks_backers_staging.last_event_at
  IS 'Timestamp of most recent Mailjet engagement event (open/click/bounce/unsub), written by the webhook handler';
