-- 20260815100000 — Companion standing-increase notification snapshot
-- (PRD-MMC-IMPL-002 §3 Increment 3 "Universal Notifications",
-- operator-ratified 2026-07-23)
--
-- Persists the persona's LAST-SEEN Standing composite score
-- (services/standing/standingScore.ts::computeStandingScore) so
-- GET /api/companion/notifications can diff the current score against it
-- and emit a "standing increased" Universal Notifications Timeline item
-- (services/companion/runtime.ts) exactly once per increase — never
-- re-fired on a subsequent poll that finds no further change.
--
-- Single latest-value row per persona (not an append-only log) — this is a
-- notification dedup cursor, not an audit trail. The audit trail for the
-- Standing inputs themselves already lives in vsp_facts / crm_persona_reputation;
-- this table does not duplicate that.
--
-- Shape mirrors 20260815000000_companion_observer_grants.sql: persona_id is
-- T0 (server-internal only — never serialised to a browser caller); RLS
-- gates reads to the owning persona (or service_role); writes are
-- service_role-only (GET /api/companion/notifications upserts via
-- getSupabaseServer(), never a direct client write).

BEGIN;

CREATE TABLE IF NOT EXISTS public.companion_standing_snapshots (
  persona_id   UUID PRIMARY KEY REFERENCES public.personas(id) ON DELETE CASCADE,  -- T0
  last_score   INTEGER NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.companion_standing_snapshots IS
  'PRD-MMC-IMPL-002 Increment 3 — last-seen Standing composite score per persona, used to dedup the "standing increased" Universal Notifications Timeline item across polls.';

-- ─── RLS — owners read their own snapshot; service role writes ────────────
ALTER TABLE public.companion_standing_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS companion_standing_snapshots_owner_read ON public.companion_standing_snapshots;
CREATE POLICY companion_standing_snapshots_owner_read ON public.companion_standing_snapshots
  FOR SELECT USING (
    auth.role() = 'service_role'
    OR persona_id IN (SELECT id FROM public.personas WHERE auth_profile_id = auth.uid())
  );

DROP POLICY IF EXISTS companion_standing_snapshots_service_write ON public.companion_standing_snapshots;
CREATE POLICY companion_standing_snapshots_service_write ON public.companion_standing_snapshots
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMIT;
