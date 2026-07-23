-- 20260818000000 — Companion Captured Objects (SPEC-MMC-001 §3 Movement I;
-- PRD-MMC-IMPL-003 Increment 2, DESIGN — awaiting operator ratification)
--
-- Durable, persona-scoped storage for a capture (the Legacy-Internet-side
-- "Recognize" interaction) before it is assigned onward. Every capture lands
-- with status='inbox' first (PRD-MMC-IMPL-003 §0.3's Workspace-as-membrane
-- decision) — there is no per-destination table; "Bring into Intent" /
-- "Bring into Venture" (the only two destinations this pass supports) update
-- assigned_destination/assigned_ref_id on this SAME row rather than moving
-- the data into a new one.
--
-- Rows are never deleted on assign/archive — status transitions in place,
-- preserving the capture's own history (mirrors the DVN pipeline's own
-- never-silently-drop discipline, applied here to a capture's lifecycle
-- rather than a receipt).
--
-- Shape mirrors `20260710000000_persona_agent_assignments.sql` /
-- `20260815000000_companion_observer_grants.sql` verbatim: `persona_id` is
-- T0 (server-internal only — RLS gates reads to the owning persona; every
-- row returned to a browser caller by the API routes below has
-- `persona_id` stripped before it reaches a response body, per
-- `types/companionCapture.ts`'s own tier-law header).
--
-- NOT YET RUN against a live database — per PRD-MMC-IMPL-003's own
-- docs-first scope, this file is authored and ready but the operator has
-- not yet applied it. Written as a real, timestamped migration (not an
-- `.example` sketch) following the promotion precedent already set for
-- `companion_observer_grants` (PRD-MMC-IMPL-001 §4).

BEGIN;

CREATE TABLE IF NOT EXISTS public.companion_captured_objects (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id           UUID NOT NULL REFERENCES public.personas(id) ON DELETE CASCADE,  -- T0
  source_kind          TEXT NOT NULL CHECK (source_kind IN ('webpage', 'selection', 'pdf', 'image')),
  source_url           TEXT NULL,
  title                TEXT NULL,
  content_text         TEXT NOT NULL,
  captured_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  status               TEXT NOT NULL DEFAULT 'inbox' CHECK (status IN ('inbox', 'assigned', 'archived')),
  assigned_destination TEXT NULL CHECK (assigned_destination IN ('intent', 'venture')),
  assigned_ref_id      TEXT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cco_persona
  ON public.companion_captured_objects (persona_id);

CREATE INDEX IF NOT EXISTS idx_cco_persona_status
  ON public.companion_captured_objects (persona_id, status);

COMMENT ON TABLE public.companion_captured_objects IS
  'SPEC-MMC-001 §3 Movement I (Capture) -- the Workspace Inbox''s persisted rows. Every capture lands with status=''inbox''; assign quick-actions (Intent/Venture) update assigned_destination/assigned_ref_id on the same row rather than moving the data elsewhere.';

-- ─── RLS — owners read their own captures; service role writes ────────────
ALTER TABLE public.companion_captured_objects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS companion_captured_objects_owner_read ON public.companion_captured_objects;
CREATE POLICY companion_captured_objects_owner_read ON public.companion_captured_objects
  FOR SELECT USING (
    auth.role() = 'service_role'
    OR persona_id IN (SELECT id FROM public.personas WHERE auth_profile_id = auth.uid())
  );

DROP POLICY IF EXISTS companion_captured_objects_service_write ON public.companion_captured_objects;
CREATE POLICY companion_captured_objects_service_write ON public.companion_captured_objects
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMIT;
