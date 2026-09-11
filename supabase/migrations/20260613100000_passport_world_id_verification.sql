-- 2026-06-13 — World ID strong-proof upgrade for Citizen Passports.
--
-- Per the 2026-06-13 hackathon-submission plan §Sprint 2. A Citizen
-- Passport that has been upgraded with a World ID proof carries:
--   - passport_grade flipped to 'verified_citizen'
--   - world_id_verification_level ('orb' | 'device')
--   - world_id_nullifier_hash (unique per human-action — used to prevent
--     the same human verifying a second passport)
--   - world_id_verified_at timestamp
--
-- T0 discipline: nullifier_hash is a public, ZK-derived value
-- (commitment-style) — it's safe to store and surface in the credential
-- envelope. It does NOT reveal the underlying human identity.
--
-- Non-verified passports remain first-class citizens (PRD §6.1 — we
-- never demote non-verified). 'verified_citizen' is an additive badge,
-- not a tier.

ALTER TABLE polity_passport_records
  ADD COLUMN IF NOT EXISTS world_id_nullifier_hash text,
  ADD COLUMN IF NOT EXISTS world_id_verification_level text
    CHECK (world_id_verification_level IS NULL OR world_id_verification_level IN ('orb', 'device')),
  ADD COLUMN IF NOT EXISTS world_id_verified_at timestamptz;

-- Each human (nullifier_hash) can verify at most one citizen passport.
-- Re-verifying the same nullifier on a second passport row fails closed.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_pp_records_world_id_nullifier
  ON polity_passport_records(world_id_nullifier_hash)
  WHERE world_id_nullifier_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pp_records_world_id_verified
  ON polity_passport_records(world_id_verified_at)
  WHERE world_id_verified_at IS NOT NULL;

COMMENT ON COLUMN polity_passport_records.world_id_nullifier_hash IS
  'World ID nullifier hash — ZK-derived commitment. T1-safe. Unique per (action, human).';
