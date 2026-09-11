-- ============================================================================
-- admin_access_requests — extend with request_type to support a new
-- non-admin "cartridge access" class.
--
-- Phase: refinements pass followup #3 (2026-05-26).
--
-- The alpha access-requests table only modelled the admin path —
-- approval wrote a row into crm_admin_roles. Operator feedback:
-- "Requesting admin access" conflates two distinct workflows. Most
-- requesters want ACCESS to a cartridge (view + use it inside their
-- runtime), NOT admin scope (review queues, partner ops, etc.).
--
-- This migration extends the table to carry the request type so the
-- decide route can branch:
--
--   - 'cartridge_access' → write a persona_activations row (status =
--      'active', granted_via = 'admin') for the cartridge's activation
--      id. Grants visibility to the cartridge surface but NOT to
--      adminOnly tabs.
--   - 'cartridge_admin' → write a crm_admin_roles row with
--      role_type = 'tenant_super_admin' scoped to the cartridge.
--   - 'global_admin'    → write a crm_admin_roles row with
--      role_type = 'platform_super_admin' (null cartridge slug).
--
-- Existing rows are backfilled to 'cartridge_admin' so the audit
-- trail of pre-existing requests stays accurate (they were all
-- admin-scope under the old workflow).
-- ============================================================================

ALTER TABLE public.admin_access_requests
  ADD COLUMN IF NOT EXISTS request_type text NOT NULL DEFAULT 'cartridge_access'
    CHECK (request_type IN ('cartridge_access','cartridge_admin','global_admin'));

-- Backfill: anything created BEFORE this column existed was an admin
-- request under the old workflow. Distinguish by whether the row has
-- a cartridge slug — null = global, present = cartridge admin.
UPDATE public.admin_access_requests
   SET request_type = CASE
     WHEN requested_cartridge_slug IS NULL THEN 'global_admin'
     ELSE 'cartridge_admin'
   END
 WHERE request_type = 'cartridge_access'
   AND requested_at < now() - interval '1 minute';  -- only old rows

-- After the alpha refinements, new rows default to 'cartridge_access'
-- because that's the dominant flow. The route layer overrides when
-- the user explicitly picks admin scope.
ALTER TABLE public.admin_access_requests
  ALTER COLUMN request_type SET DEFAULT 'cartridge_access';

CREATE INDEX IF NOT EXISTS idx_admin_access_requests_request_type
  ON public.admin_access_requests(request_type);

-- Update the unique-pending partial index to include request_type so
-- a persona can have one pending cartridge_access AND one pending
-- cartridge_admin request for the same cartridge (rare but valid:
-- they want access now, admin later).
DROP INDEX IF EXISTS idx_admin_access_requests_pending_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_access_requests_pending_unique
  ON public.admin_access_requests(persona_id, requested_cartridge_slug, request_type)
  WHERE status = 'pending';

COMMENT ON COLUMN public.admin_access_requests.request_type IS
  'cartridge_access | cartridge_admin | global_admin. Default cartridge_access — most requests just want runtime visibility, not admin scope.';
