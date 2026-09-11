-- 20260816000000 — Companion Observer latest browser-context observation
-- (PRD-MMC-001 §4; PRD-MMC-IMPL-002 Increment 2, operator-ratified 2026-07-23)
--
-- ONE row per persona holding the LATEST `BrowserContextObservation`
-- (`types/companionObserver.ts`) only — NOT an append-only log. This is live
-- browsing context for the Constitutional Overlay to react to, not an audit
-- trail; the DVN/receipt discipline governs audit-worthy events, which this
-- is deliberately not. Backs `POST /api/companion/observer/observation`,
-- which is the ONLY write path — no direct client writes, and every write
-- re-validates server-side against the persona's actual stored grant state
-- (`companion_observer_grants`) before persisting, never trusting the
-- caller's own claimed `grantedCapabilities`.
--
-- Shape mirrors `20260815000000_companion_observer_grants.sql` verbatim:
-- `persona_id` is T0 (server-internal only — RLS gates reads to the owning
-- persona; every value returned to a browser caller by the route above is
-- read back through `getActivePersona`-scoped queries, never a raw
-- persona_id in a response body).

BEGIN;

CREATE TABLE IF NOT EXISTS public.companion_observation_latest (
  persona_id             UUID PRIMARY KEY REFERENCES public.personas(id) ON DELETE CASCADE,  -- T0
  granted_capabilities   TEXT[] NOT NULL DEFAULT '{}',
  current_tab_domain     TEXT NULL,
  current_tab_title      TEXT NULL,
  selection_text         TEXT NULL,
  page_document_excerpt  TEXT NULL,
  observed_at            TIMESTAMPTZ NOT NULL,
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.companion_observation_latest IS
  'PRD-MMC-001 §4 Observer latest browser-context observation — ONE row per persona, upserted on every observation post. Not an audit trail; the DVN/receipt discipline governs audit-worthy events separately.';

-- ─── RLS — owners read their own latest observation; service role writes ──
ALTER TABLE public.companion_observation_latest ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS companion_observation_latest_owner_read ON public.companion_observation_latest;
CREATE POLICY companion_observation_latest_owner_read ON public.companion_observation_latest
  FOR SELECT USING (
    auth.role() = 'service_role'
    OR persona_id IN (SELECT id FROM public.personas WHERE auth_profile_id = auth.uid())
  );

DROP POLICY IF EXISTS companion_observation_latest_service_write ON public.companion_observation_latest;
CREATE POLICY companion_observation_latest_service_write ON public.companion_observation_latest
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMIT;
