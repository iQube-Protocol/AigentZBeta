-- 20260815000000 — Companion Observer capability grants (PRD-MMC-001 §4;
-- PRD-MMC-IMPL-001 Increment 2, operator-ratified 2026-07-23)
--
-- Per-persona, per-capability, revocable consent state for the Constitutional
-- Observer (browser-context observation, gated behind explicit per-capability
-- grants — never a blanket install permission). Backs
-- `app/api/companion/observer/grants/route.ts` and
-- `.../grants/[capability]/route.ts`, which are the ONLY write path — no
-- direct client writes.
--
-- Rows are never deleted on revoke; `revoked_at` is set instead, preserving
-- an audit trail (mirrors the DVN pipeline's own never-silently-drop
-- discipline, applied here to consent rather than receipts).
--
-- Shape mirrors `20260710000000_persona_agent_assignments.sql` verbatim:
-- `persona_id` is T0 (server-internal only — RLS gates reads to the owning
-- persona; every row returned to a browser caller by the API routes above
-- has `persona_id` stripped before it reaches a response body, per
-- `types/companionObserver.ts`'s own tier-law header).
--
-- Promotes the illustrative sketch this migration replaces:
-- `supabase/migrations/_sketch_companion_observer_grants.sql.example`
-- (kept in place as a dated reference; superseded by this file — not deleted,
-- so the authoring history stays legible).

BEGIN;

CREATE TABLE IF NOT EXISTS public.companion_observer_grants (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id   UUID NOT NULL REFERENCES public.personas(id) ON DELETE CASCADE,  -- T0
  capability   TEXT NOT NULL,
  scope        TEXT NOT NULL CHECK (scope IN ('global', 'site')),
  site_domain  TEXT NULL,
  granted_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at   TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_cog_persona
  ON public.companion_observer_grants (persona_id);

COMMENT ON TABLE public.companion_observer_grants IS
  'PRD-MMC-001 §4 Observer capability grants — per-persona, per-capability, revocable consent state. Rows are never deleted on revoke; revoked_at is set instead, preserving an audit trail (mirrors the DVN pipeline''s own never-silently-drop discipline).';

-- ─── RLS — owners read their own grants; service role writes ──────────────
ALTER TABLE public.companion_observer_grants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS companion_observer_grants_owner_read ON public.companion_observer_grants;
CREATE POLICY companion_observer_grants_owner_read ON public.companion_observer_grants
  FOR SELECT USING (
    auth.role() = 'service_role'
    OR persona_id IN (SELECT id FROM public.personas WHERE auth_profile_id = auth.uid())
  );

DROP POLICY IF EXISTS companion_observer_grants_service_write ON public.companion_observer_grants;
CREATE POLICY companion_observer_grants_service_write ON public.companion_observer_grants
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMIT;
