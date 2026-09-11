-- Tracks when a passport holder claims their W3C-VC credential envelope.
-- The credential is always re-buildable from the record (lazy issuance), but
-- this timestamp lets the wallet surface know whether the holder has explicitly
-- claimed + acknowledged the credential.
ALTER TABLE polity_passport_records
  ADD COLUMN IF NOT EXISTS credential_claimed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_pp_records_claimed
  ON polity_passport_records(credential_claimed_at)
  WHERE credential_claimed_at IS NOT NULL;
