-- Admin Action Centre — canonical AdminActionItem substrate (P1).
--
-- Reuse audit (2026-08-21) confirmed nothing generic + admin-scoped +
-- persisted already exists: DCIR (services/dcir) is a client-side, in-memory,
-- session-scoped ring buffer with no persistence; activity_receipts is
-- persona-scoped provenance with no disposition/severity/read-state; the only
-- read/unread precedent (wallet_notifications) is payment-only and defined in
-- an ad-hoc script, not a tracked migration. This table borrows deliberately
-- rather than inventing from scratch:
--   - read/unread + timestamps: wallet_notifications' read/read_at shape
--     (scripts/create-payment-requests-table.sql), generalized to a four-value
--     status and a resolved_at pairing.
--   - idempotency discipline: activity_receipts' anchoring gate
--     (services/dvn/activityReceiptDvnPipeline.ts enqueueReceiptLeg guards on
--     a null anchor id before retrying) — here expressed as a UNIQUE
--     idempotency_key so a repeated source event (retry, re-poll, duplicate
--     webhook) can never create a second admin action for the same logical
--     occurrence.
--
-- Hub-and-spoke, not a monolithic inbox (operator ruling, 2026-08-21): this
-- table is the ONE canonical store. It carries an INDEX into each domain's
-- existing work surface (source_type/source_ref/source_surface/action_href) —
-- it never duplicates the domain's own mutable state. The domain queue
-- (e.g. polity_passport_applications + the Passport Bureau steward tab)
-- remains the canonical work surface; resolving an admin action here is
-- independent of, and never a substitute for, acting on the underlying
-- domain record.
--
-- Server-internal only: RLS is deny-all except service_role, mirroring
-- activity_receipts (20260514000000_activity_receipts.sql) — every access
-- path goes through an API route gated by requireCartridgeAdmin. No T0
-- identifier (personaId, authProfileId, rootDid) is ever written to
-- source_ref/metadata; source_ref carries only identifiers already exposed
-- to the admin surface that owns them today (e.g. polity_passport_applications
-- .id, which PassportBureauStewardTab already renders to stewards).

CREATE TABLE IF NOT EXISTS public.admin_action_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Idempotency — one active item per logical occurrence. A repeated source
  -- event (retry, re-poll) upserts onto the SAME row rather than creating a
  -- duplicate; see services/adminActions/adminActionService.ts.
  idempotency_key TEXT NOT NULL UNIQUE,

  -- Domain the item belongs to (e.g. 'passport'). Drives which existing
  -- admin/steward surface a projection renders this item into.
  category TEXT NOT NULL,

  severity TEXT NOT NULL DEFAULT 'info'
    CHECK (severity IN ('info', 'attention', 'urgent')),

  -- The core distinction (operator brief §2): informational events never
  -- require action; action_required events are the only ones that should
  -- pull an admin in.
  disposition TEXT NOT NULL
    CHECK (disposition IN ('informational', 'action_required')),

  status TEXT NOT NULL DEFAULT 'unread'
    CHECK (status IN ('unread', 'read', 'resolved', 'dismissed')),

  title TEXT NOT NULL,
  summary TEXT NOT NULL,

  -- Index into the owning domain record — never a duplicate of its state.
  source_type TEXT NOT NULL,
  source_ref TEXT,
  source_surface TEXT,

  -- Deep-link to the existing domain review surface. A resolved/read item's
  -- action_href is left intact — the link outlives the notification's triage
  -- state, since it points at durable domain state, not at this row.
  action_type TEXT,
  action_href TEXT,

  -- Reason-code + evidence-summary payload. Never a T0 identifier — see
  -- services/passport/citizenPassportRequirements.ts for the reason-code
  -- vocabulary this is populated from on the Passport Bureau's first
  -- production use case.
  metadata JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  -- Steward/admin persona who read/resolved this item. Server-internal
  -- bookkeeping only — never returned to the client as a raw persona id;
  -- surfaces display the acting persona via the same T1 label pattern every
  -- other admin surface already uses (see ActivityReceiptCard's "Acting
  -- persona" footer for the precedent), not by exposing this column.
  resolved_by_persona_id TEXT
);

CREATE INDEX IF NOT EXISTS admin_action_items_triage_idx
  ON public.admin_action_items (category, disposition, status, created_at DESC);

CREATE INDEX IF NOT EXISTS admin_action_items_created_at_idx
  ON public.admin_action_items (created_at DESC);

ALTER TABLE public.admin_action_items ENABLE ROW LEVEL SECURITY;

-- Deny-all except service_role — mirrors activity_receipts (T0-adjacent:
-- source_ref/metadata can carry pre-existing application/queue ids). Every
-- client read goes through an admin-gated API route using the service role.
DROP POLICY IF EXISTS "admin_action_items_read_service"  ON public.admin_action_items;
DROP POLICY IF EXISTS "admin_action_items_write_service" ON public.admin_action_items;
CREATE POLICY "admin_action_items_read_service"  ON public.admin_action_items FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY "admin_action_items_write_service" ON public.admin_action_items FOR ALL    USING (auth.role() = 'service_role');

COMMENT ON TABLE public.admin_action_items IS 'Admin Action Centre — canonical AdminActionItem store (hub-and-spoke index into domain queues, never a duplicate of their state).';
