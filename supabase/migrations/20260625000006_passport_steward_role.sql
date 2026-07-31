-- Steward role on citizen privileges — additive, non-destructive.
--
-- The Stewardship tier (Tier 2) and the Polity Passport Bureau both confer
-- "steward" standing. This column records that elevated role on the citizen's
-- privilege row so downstream surfaces (recommendation rights, "Act as Aigent")
-- can gate on it without re-deriving the source each time.
--
-- This is purely ADDITIVE: it does NOT touch the irrevocable-passport CHECK
-- constraints, the privilege_status enum, or any existing column. The column is
-- nullable — null means "no steward role" (the default for every citizen).
--
-- Source values:
--   'subscription_steward' — earned via a Tier 2 (Stewardship) plan
--   'bureau_steward'       — granted via Polity Passport Bureau cartridge admin
--   'both'                 — holds both

ALTER TABLE public.passport_citizen_privileges
  ADD COLUMN IF NOT EXISTS steward_role text
    CHECK (steward_role IS NULL OR steward_role IN ('subscription_steward','bureau_steward','both'));

ALTER TABLE public.passport_citizen_privileges
  ADD COLUMN IF NOT EXISTS steward_role_updated_at timestamptz;

-- Quick lookup of all active stewards.
CREATE INDEX IF NOT EXISTS idx_passport_privileges_steward_role
  ON public.passport_citizen_privileges (steward_role)
  WHERE steward_role IS NOT NULL;
