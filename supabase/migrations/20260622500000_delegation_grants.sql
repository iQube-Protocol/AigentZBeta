-- 20260622500000 — Bounded-delegation grants persistence (Phase 2)
--
-- Until now, active bounded-delegation grants lived ONLY in an in-memory Map in
-- app/api/codex/chat/agentiq-os/delegation/route.ts (cleared on every serverless
-- cold start) with the audit trail in orchestration_events. That made Delegated
-- Standing impossible to compute reliably — a grant that vanishes on restart has
-- no durable ledger — and left delegation_agentkit_attestations.delegation_grant_id
-- an orphaned text column with no parent.
--
-- This migration adds the durable grant table. It is the source of truth for an
-- active grant; the in-memory Map becomes a hot cache that rehydrates from here.
-- Additive — the route falls back to orchestration_events when this table is
-- absent, so applying it is safe and non-breaking either way.
--
-- T0 discipline: persona_id is server-internal (RLS gates reads to the owner).
-- agent_root_did is the delegate's public DID (T1-safe). The handoff JSON is the
-- full HandoffPayload for rehydration — it carries persona_id (T0) so it is
-- never projected to the browser; the route returns T1-safe fields only.

BEGIN;

CREATE TABLE IF NOT EXISTS public.delegation_grants (
  -- The bounded-delegation grant id == the HandoffPayload.handoff_id. Stable,
  -- and the value delegation_agentkit_attestations.delegation_grant_id points at.
  grant_id              TEXT PRIMARY KEY,
  persona_id            UUID NOT NULL,                              -- T0 granting/sponsor persona
  agent_root_did        TEXT NOT NULL,                             -- delegate agent DID (T1-safe)
  tenant_id             TEXT NOT NULL DEFAULT 'default',
  trust_band            TEXT NOT NULL DEFAULT 'L2_VERIFIED_COMMUNITY',
  allowed_actions       JSONB NOT NULL DEFAULT '[]'::jsonb,
  allowed_surfaces      JSONB NOT NULL DEFAULT '[]'::jsonb,
  forbidden_actions     JSONB NOT NULL DEFAULT '[]'::jsonb,
  disclosure_class      TEXT NOT NULL DEFAULT 'tenant',
  max_actions           INTEGER NOT NULL DEFAULT 20 CHECK (max_actions >= 0),
  actions_taken         INTEGER NOT NULL DEFAULT 0 CHECK (actions_taken >= 0),
  spend_autonomy        TEXT,
  show_receipts         BOOLEAN NOT NULL DEFAULT true,
  curated_skills_only   BOOLEAN NOT NULL DEFAULT true,
  explain_before_acting BOOLEAN NOT NULL DEFAULT false,
  -- Full HandoffPayload for restart rehydration (carries T0 fields — server-only).
  handoff               JSONB,
  status                TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'revoked', 'expired')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at            TIMESTAMPTZ NOT NULL,
  revoked_at            TIMESTAMPTZ,
  revoke_reason         TEXT
);

-- One fast lookup for "the active grant for this persona" (the GET hot path).
CREATE INDEX IF NOT EXISTS idx_delegation_grants_persona_active
  ON public.delegation_grants (persona_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_delegation_grants_agent
  ON public.delegation_grants (agent_root_did);

CREATE INDEX IF NOT EXISTS idx_delegation_grants_expiry
  ON public.delegation_grants (expires_at)
  WHERE status = 'active';

COMMENT ON TABLE public.delegation_grants IS
  'Durable bounded-delegation grants. Source of truth for an active grant; the in-memory Map in the delegation route is a cache that rehydrates from here. Parent of delegation_agentkit_attestations.delegation_grant_id.';

-- ─── RLS — owners read their own grants; service role does everything ────────
ALTER TABLE public.delegation_grants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS delegation_grants_owner_read ON public.delegation_grants;
CREATE POLICY delegation_grants_owner_read ON public.delegation_grants
  FOR SELECT USING (
    auth.role() = 'service_role'
    OR persona_id IN (SELECT id FROM public.personas WHERE auth_profile_id = auth.uid())
  );

DROP POLICY IF EXISTS delegation_grants_service_write ON public.delegation_grants;
CREATE POLICY delegation_grants_service_write ON public.delegation_grants
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─── Adopt the orphaned attestation FK ──────────────────────────────────────
-- delegation_agentkit_attestations.delegation_grant_id was a bare text column
-- with no parent. Give it one. NOT VALID so any pre-existing rows (dev data)
-- aren't retroactively checked; new attestations are enforced.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'delegation_agentkit_attestations_grant_fk'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'delegation_agentkit_attestations'
  ) THEN
    ALTER TABLE public.delegation_agentkit_attestations
      ADD CONSTRAINT delegation_agentkit_attestations_grant_fk
      FOREIGN KEY (delegation_grant_id)
      REFERENCES public.delegation_grants (grant_id)
      ON DELETE CASCADE
      NOT VALID;
  END IF;
END $$;

COMMIT;
