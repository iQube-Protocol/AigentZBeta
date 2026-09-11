-- 20261001000000_access_grant_amendment_support.sql
--
-- IRL Stewardship — Access Maintenance (item 1): existing `access_grants`
-- rows can now be AMENDED in place (scope/role/expiry changed, suspended,
-- reinstated, revoked) rather than only ever inserted at claim-time. This
-- migration adds exactly the columns/states that amendment needs:
--
--   - 'suspended' status — a REVERSIBLE hold, distinct from 'revoked'
--     (permanent) and 'expired' (time-based). Without it, "suspend" and
--     "revoke" would be indistinguishable, defeating the point of offering
--     both (operator instruction, IRL Stewardship pass).
--   - suspended_at — when the hold was placed, mirroring revoked_at's
--     existing shape.
--   - updated_at — every amendment touches this; NULL/absent means "never
--     amended since grant" (still creation-time equal to granted_at).
--
-- Never rewrites granted_at, source, source_id or receipt_id — those remain
-- the original grant's own provenance. Amendment history lives in the
-- activity_receipts trail (actionInput carries the before/after diff), not
-- in a second parallel audit table (inv.engineering.036/037).

BEGIN;

ALTER TABLE public.access_grants
  DROP CONSTRAINT IF EXISTS access_grants_status_check;

ALTER TABLE public.access_grants
  ADD CONSTRAINT access_grants_status_check
  CHECK (status IN ('active', 'expired', 'revoked', 'suspended'));

ALTER TABLE public.access_grants
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz;

ALTER TABLE public.access_grants
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

COMMIT;
