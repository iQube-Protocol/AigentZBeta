-- 20260710000000 — Per-persona agent assignments (CFS-024 Phase 3)
--
-- The Constitutional Identity Hierarchy (CFS-024) distinguishes two agent
-- relationships that were previously conflated:
--   • BINDING    (Citizen ↔ Agent) — PERMANENT. The agent belongs to the
--     constitutional person, established through their Passport + Personhood.
--     Modeled today by agent_root_identity.sponsor_persona_id + bound_passport_id.
--   • ASSIGNMENT (Persona ↔ Agent) — TEMPORARY. Which citizen-bound agent acts
--     for THIS persona right now, and which one is the persona's aigentMe.
--
-- Assignment had no first-class home. aigentMe was inferred from
-- agent_root_identity.is_aigent_me (keyed by the SPONSORING persona), so a
-- persona could not: (a) assign MULTIPLE bound agents, (b) choose which is its
-- aigentMe, or (c) reassign the aigentMe — the operator's stated model. This
-- table is that home.
--
-- Assignment ≠ authority. Assigning an agent does NOT grant it power — the
-- bounded-delegation GRANT (delegation_grants) is the runtime authority envelope
-- that attaches to an assigned agent. This table is the persistent structural
-- layer: which agents are assigned to a persona, and which one is aigentMe.
--
-- Additive + soft-fail: resolveConstitutionalContext falls back to
-- is_aigent_me when this table is absent, so applying it is non-breaking.
--
-- T0 discipline: persona_id + agent_root_id are server-internal (RLS gates reads
-- to the owner; all writes are service-role via the spine-guarded route).

BEGIN;

CREATE TABLE IF NOT EXISTS public.persona_agent_assignments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id     UUID NOT NULL REFERENCES public.personas(id) ON DELETE CASCADE,      -- T0
  agent_root_id  UUID NOT NULL REFERENCES public.agent_root_identity(id) ON DELETE CASCADE,
  -- The capacity the agent acts in FOR this persona. Exactly one 'aigentMe' per
  -- persona (partial unique index below); any number of 'delegate' rows.
  role           TEXT NOT NULL DEFAULT 'delegate'
    CHECK (role IN ('aigentMe', 'delegate')),
  active         BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- An agent is assigned to a persona at most once (its role can change).
  UNIQUE (persona_id, agent_root_id)
);

-- Exactly ONE aigentMe per persona — enforced at the DB, not just the app.
CREATE UNIQUE INDEX IF NOT EXISTS uq_persona_aigentme
  ON public.persona_agent_assignments (persona_id)
  WHERE role = 'aigentMe';

CREATE INDEX IF NOT EXISTS idx_paa_persona
  ON public.persona_agent_assignments (persona_id);

CREATE INDEX IF NOT EXISTS idx_paa_agent
  ON public.persona_agent_assignments (agent_root_id);

COMMENT ON TABLE public.persona_agent_assignments IS
  'CFS-024 Persona↔Agent ASSIGNMENT (temporary): which citizen-bound agents act for a persona, and which one is its aigentMe. Distinct from delegation_grants (runtime authority) and from agent_root_identity binding (permanent, to the person).';

-- ─── RLS — owners read their own persona assignments; service role writes ────
ALTER TABLE public.persona_agent_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS persona_agent_assignments_owner_read ON public.persona_agent_assignments;
CREATE POLICY persona_agent_assignments_owner_read ON public.persona_agent_assignments
  FOR SELECT USING (
    auth.role() = 'service_role'
    OR persona_id IN (SELECT id FROM public.personas WHERE auth_profile_id = auth.uid())
  );

DROP POLICY IF EXISTS persona_agent_assignments_service_write ON public.persona_agent_assignments;
CREATE POLICY persona_agent_assignments_service_write ON public.persona_agent_assignments
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMIT;
