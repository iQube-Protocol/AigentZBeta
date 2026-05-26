-- ============================================================================
-- admin_access_requests — persona-initiated requests for cartridge admin access.
--
-- Phase: refinements pass 2026-05-26.
--
-- A persona without any admin grants (`cartridgeFlags.isAdmin = false`
-- AND `cartridgeFlags.adminCartridges = []`) can submit a request to be
-- granted admin scope over a specific cartridge — or platform-wide. A
-- global admin (uber / platform_super) reviews pending requests inside
-- the metaMe Cartridge -> Admin Access Requests tab and either approves
-- (creating the corresponding row in `crm_admin_roles`) or denies.
--
-- Privacy posture
-- ---------------
--   - persona_id is T0 — server-internal only. Never serialised to the
--     browser by the access-requests routes; T1 fields (display label,
--     requested slug, message) are reshaped in the response surface.
--   - decision_reason and message are operator-visible strings — never
--     blob, never PII beyond what the requester chose to share.
--   - service_role policies only. All access lands via the
--     `/api/admin/access-requests/*` endpoints which resolve the
--     active persona via the spine and gate writes on global-admin scope.
--
-- status:
--   - 'pending'  — submitted, awaiting global-admin review.
--   - 'approved' — decision_at + decided_by_persona_id set; the API
--                  also writes a matching crm_admin_roles row.
--   - 'denied'   — decision_at + decided_by_persona_id + decision_reason set.
--   - 'cancelled'— requester withdrew before a decision was made.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.admin_access_requests (
  id                         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  persona_id                 text NOT NULL,
  auth_profile_id            text,
  requester_display_label    text,
  requester_email            text,
  -- The cartridge being requested. `null` indicates a platform-wide
  -- (uber/global) admin request — kept rare and explicitly flagged in
  -- the review UI.
  requested_cartridge_slug   text,
  -- Free-text justification the user types when submitting. Truncated
  -- to 2000 chars at the route layer.
  message                    text,
  status                     text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','denied','cancelled')),
  requested_at               timestamptz NOT NULL DEFAULT now(),
  decided_at                 timestamptz,
  decided_by_persona_id      text,
  decision_reason            text,
  -- When approved, the crm_admin_roles row created by the approver.
  -- Lets the UI cross-link back to the role record. Null otherwise.
  granted_role_id            uuid,
  updated_at                 timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_access_requests_status
  ON public.admin_access_requests(status);
CREATE INDEX IF NOT EXISTS idx_admin_access_requests_persona
  ON public.admin_access_requests(persona_id);
CREATE INDEX IF NOT EXISTS idx_admin_access_requests_cartridge
  ON public.admin_access_requests(requested_cartridge_slug);
-- Prevent duplicate pending requests for the same (persona, cartridge)
-- combo. A user can re-request after a denial; the partial unique
-- index only constrains 'pending' rows.
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_access_requests_pending_unique
  ON public.admin_access_requests(persona_id, requested_cartridge_slug)
  WHERE status = 'pending';

ALTER TABLE public.admin_access_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_access_requests_read_service"
  ON public.admin_access_requests;
DROP POLICY IF EXISTS "admin_access_requests_write_service"
  ON public.admin_access_requests;
CREATE POLICY "admin_access_requests_read_service"
  ON public.admin_access_requests
  FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY "admin_access_requests_write_service"
  ON public.admin_access_requests
  FOR ALL USING (auth.role() = 'service_role');

COMMENT ON TABLE public.admin_access_requests IS
  'Persona-initiated admin-access requests. Service-role only — all access via /api/admin/access-requests/*.';
COMMENT ON COLUMN public.admin_access_requests.persona_id IS 'T0 — server-internal only.';
COMMENT ON COLUMN public.admin_access_requests.auth_profile_id IS 'T0 — server-internal only.';
COMMENT ON COLUMN public.admin_access_requests.requested_cartridge_slug IS 'Null = platform-wide (global admin) request.';
