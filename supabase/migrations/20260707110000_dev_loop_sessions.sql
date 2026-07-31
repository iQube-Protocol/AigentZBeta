-- 20260707110000_dev_loop_sessions.sql
--
-- Dev-loop session persistence for the Dev Command Center (Constitutional
-- Development Environment, CFS-020). Closes the CDE's longest-standing honest
-- limit: DevLoopState lived only in React state and evaporated on refresh —
-- intent, context pack, gap analysis, consequence canvas, implementation
-- brief, validation report, remediation plan, deployment authorization, and
-- the receipts list all lost.
--
-- Trust / tier model: `persona_id` is a T0 identifier — a DB ownership key
-- ONLY, used by the sessions route for caller-owned filtering. It is NEVER
-- serialized into API responses. `state` holds the full DevLoopState jsonb
-- and is T2-guarded at write time: the route rejects any serialized state
-- carrying personaId / authProfileId / rootDid / fioHandle / kybeAttestation
-- keys (findForbiddenStateKey, canary-pinned in tests/dev-command-center).
--
-- Additive-only (CFS-010 §3); idempotent, re-runnable. RLS enabled with no
-- policies: service-role access only (all reads/writes flow through the
-- spine-gated API route /api/dev-command-center/sessions).

CREATE TABLE IF NOT EXISTS public.dev_loop_sessions (
  session_id text PRIMARY KEY,
  persona_id uuid NOT NULL,
  stage text NOT NULL,
  state jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dev_loop_sessions_persona_updated_idx
  ON public.dev_loop_sessions (persona_id, updated_at DESC);

ALTER TABLE public.dev_loop_sessions ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.dev_loop_sessions IS
  'Persisted DevLoopState per dev-loop session (Dev Command Center / CDE, CFS-020). persona_id is a T0 ownership key — ownership filtering only, never serialized into responses.';
COMMENT ON COLUMN public.dev_loop_sessions.state IS
  'Full DevLoopState JSON. T2-guarded at write: serialized state carrying personaId/authProfileId/rootDid/fioHandle/kybeAttestation keys is rejected by the route.';
