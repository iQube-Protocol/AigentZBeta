-- Migration: Make nakamoto_knyt_personas.user_id nullable
--
-- Rationale:
--   The table is used as a full investor/prospect CRM ledger. Not all records
--   have a platform account (most investors have never logged into the platform).
--   The NOT NULL constraint blocks inserting investor-only rows (added via CSV
--   import, KS backer sync, or campaign prospect creation) that don't yet have
--   a corresponding auth.users row.
--
--   user_id is linked at first login via /api/wallet/identity/consolidate, which
--   stamps platform_activated_at and platform_auth_profile_id at that time.
--   It does NOT need to be NOT NULL to fulfil this purpose.

ALTER TABLE public."nakamoto_knyt_personas"
  ALTER COLUMN user_id DROP NOT NULL;

COMMENT ON COLUMN public."nakamoto_knyt_personas".user_id
  IS 'Auth user UUID. NULL for investor-only records (no platform account yet). Linked at first login by /api/wallet/identity/consolidate.';
