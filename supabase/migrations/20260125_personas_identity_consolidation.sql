-- Consolidate identity-layer persona fields into canonical `personas` table.
-- This enables API-only thin clients and a single persona source of truth.

-- 1) Allow identity-only personas to exist without custody key material.
-- Wallet flows must enforce presence of `evm_key` where required.
ALTER TABLE personas
  ALTER COLUMN evm_key DROP NOT NULL;

-- 2) Identity state + origin
ALTER TABLE personas
  ADD COLUMN IF NOT EXISTS default_identity_state TEXT,
  ADD COLUMN IF NOT EXISTS world_id_status TEXT,
  ADD COLUMN IF NOT EXISTS app_origin TEXT,
  ADD COLUMN IF NOT EXISTS root_id UUID;

-- 3) FIO registration metadata (identity)
ALTER TABLE personas
  ADD COLUMN IF NOT EXISTS fio_public_key TEXT,
  ADD COLUMN IF NOT EXISTS fio_tx_id TEXT,
  ADD COLUMN IF NOT EXISTS fio_handle_expiration TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fio_registration_status TEXT,
  ADD COLUMN IF NOT EXISTS fio_registered_at TIMESTAMPTZ;

-- 4) External wallet address mappings (public addresses only)
ALTER TABLE personas
  ADD COLUMN IF NOT EXISTS evm_address VARCHAR(42),
  ADD COLUMN IF NOT EXISTS btc_address VARCHAR(64),
  ADD COLUMN IF NOT EXISTS sol_address VARCHAR(44),
  ADD COLUMN IF NOT EXISTS bio TEXT;

CREATE INDEX IF NOT EXISTS idx_personas_evm_address ON personas(evm_address) WHERE evm_address IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_personas_btc_address ON personas(btc_address) WHERE btc_address IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_personas_sol_address ON personas(sol_address) WHERE sol_address IS NOT NULL;

-- 5) Referrals
ALTER TABLE personas
  ADD COLUMN IF NOT EXISTS referred_by_persona_id UUID,
  ADD COLUMN IF NOT EXISTS referrer_persona_id UUID,
  ADD COLUMN IF NOT EXISTS ref_campaign_id TEXT,
  ADD COLUMN IF NOT EXISTS first_paid_purchase_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS referral_locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS referral_method TEXT,
  ADD COLUMN IF NOT EXISTS referral_identifier TEXT;

CREATE INDEX IF NOT EXISTS idx_personas_referred_by ON personas(referred_by_persona_id) WHERE referred_by_persona_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_personas_referrer ON personas(referrer_persona_id) WHERE referrer_persona_id IS NOT NULL;

-- 6) Backfill identity fields from legacy `persona` table by matching fio_handle.
-- NOTE: This is safe to run multiple times.
UPDATE personas p
SET
  default_identity_state = COALESCE(p.default_identity_state, lp.default_identity_state),
  world_id_status = COALESCE(p.world_id_status, lp.world_id_status),
  app_origin = COALESCE(p.app_origin, lp.app_origin),
  root_id = COALESCE(p.root_id, lp.root_id),
  fio_public_key = COALESCE(p.fio_public_key, lp.fio_public_key),
  fio_tx_id = COALESCE(p.fio_tx_id, lp.fio_tx_id),
  fio_handle_expiration = COALESCE(p.fio_handle_expiration, lp.fio_handle_expiration),
  fio_registration_status = COALESCE(p.fio_registration_status, lp.fio_registration_status),
  fio_registered_at = COALESCE(p.fio_registered_at, lp.fio_registered_at),
  evm_address = COALESCE(p.evm_address, lp.evm_address),
  btc_address = COALESCE(p.btc_address, lp.btc_address),
  sol_address = COALESCE(p.sol_address, lp.sol_address),
  bio = COALESCE(p.bio, lp.bio),
  referred_by_persona_id = COALESCE(p.referred_by_persona_id, lp.referred_by_persona_id),
  referrer_persona_id = COALESCE(p.referrer_persona_id, lp.referrer_persona_id),
  ref_campaign_id = COALESCE(p.ref_campaign_id, lp.ref_campaign_id),
  first_paid_purchase_at = COALESCE(p.first_paid_purchase_at, lp.first_paid_purchase_at)
FROM persona lp
WHERE lp.fio_handle IS NOT NULL
  AND p.fio_handle IS NOT NULL
  AND lower(p.fio_handle) = lower(lp.fio_handle);

-- 7) Insert missing personas from legacy `persona` table where none exist in `personas`.
-- Creates identity-only personas with evm_key=NULL and minimal required fields.
INSERT INTO personas (
  id,
  type,
  fio_handle,
  fio_domain,
  root_did,
  display_name,
  avatar_uri,
  evm_key,
  chain_addresses,
  reputation_score,
  reputation_bucket,
  badges,
  status,
  tenant_id,
  auth_profile_id,
  created_at,
  updated_at,
  default_identity_state,
  world_id_status,
  app_origin,
  root_id,
  fio_public_key,
  fio_tx_id,
  fio_handle_expiration,
  fio_registration_status,
  fio_registered_at,
  evm_address,
  btc_address,
  sol_address,
  bio,
  referred_by_persona_id,
  referrer_persona_id,
  ref_campaign_id,
  first_paid_purchase_at,
  discoverable_within_tenant
)
SELECT
  lp.id,
  'PersonaQube',
  lp.fio_handle,
  split_part(lp.fio_handle, '@', 2),
  concat('did:fio:', lp.fio_handle),
  COALESCE(NULLIF(split_part(lp.fio_handle, '@', 1), ''), 'Persona'),
  NULL,
  NULL,
  '{}'::jsonb,
  0,
  0,
  '{}'::text[],
  'active',
  'default',
  NULL,
  COALESCE(lp.created_at, now()),
  now(),
  lp.default_identity_state,
  lp.world_id_status,
  lp.app_origin,
  lp.root_id,
  lp.fio_public_key,
  lp.fio_tx_id,
  lp.fio_handle_expiration,
  lp.fio_registration_status,
  lp.fio_registered_at,
  lp.evm_address,
  lp.btc_address,
  lp.sol_address,
  lp.bio,
  lp.referred_by_persona_id,
  lp.referrer_persona_id,
  lp.ref_campaign_id,
  lp.first_paid_purchase_at,
  false
FROM persona lp
WHERE lp.fio_handle IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM personas p WHERE p.fio_handle IS NOT NULL AND lower(p.fio_handle) = lower(lp.fio_handle)
  );
