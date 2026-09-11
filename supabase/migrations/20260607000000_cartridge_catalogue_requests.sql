-- 20260607000000_cartridge_catalogue_requests.sql
--
-- Persona-submitted requests to publish a personal cartridge into the
-- metaMe activations catalogue. Owners apply from MyCartridgeTab; metaMe
-- admins review in the metaMe → Admin → "Catalogue Requests" tab and
-- approve / reject. Approval is the trigger for the cartridge to land in
-- the canonical activations list every persona can browse / enable.
--
-- T0 isolation: persona_id is service-role-only. The tab surfaces
-- requester_display_label + requester_email (already T1-safe because the
-- requester knows their own identity). Decisions carry the admin's
-- persona_id (T0) for audit but the tab response strips it.
--
-- Append-only style: rows are never deleted; status moves
-- pending → approved | rejected | cancelled. Re-apply after a rejection
-- creates a NEW row so the audit trail stays intact.

CREATE TABLE IF NOT EXISTS public.cartridge_catalogue_requests (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cartridge_slug            TEXT NOT NULL,
  cartridge_title           TEXT NOT NULL,
  persona_id                UUID NOT NULL,
  auth_profile_id           UUID,
  requester_display_label   TEXT,
  requester_email           TEXT,
  message                   TEXT,
  status                    TEXT NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  requested_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at                TIMESTAMPTZ,
  decided_by_persona_id     UUID,
  decision_reason           TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only one pending row per (cartridge, persona). A re-apply after
-- rejection clears because the prior row's status is no longer 'pending'.
CREATE UNIQUE INDEX IF NOT EXISTS cartridge_catalogue_requests_one_pending
  ON public.cartridge_catalogue_requests (cartridge_slug, persona_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS cartridge_catalogue_requests_status_idx
  ON public.cartridge_catalogue_requests (status, requested_at DESC);

CREATE INDEX IF NOT EXISTS cartridge_catalogue_requests_persona_idx
  ON public.cartridge_catalogue_requests (persona_id, requested_at DESC);

-- Service-role only — no anon/auth grants. All reads + writes flow
-- through admin-gated API routes that already check persona.cartridgeFlags.isAdmin.
ALTER TABLE public.cartridge_catalogue_requests ENABLE ROW LEVEL SECURITY;
