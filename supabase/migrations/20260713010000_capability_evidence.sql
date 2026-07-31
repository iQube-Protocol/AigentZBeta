-- Capability Evidence — a persisted constitutional primitive (CFS-029,
-- operator direction 2026-07-13). Evidence persists; sessions don't:
-- what a dev-loop session learned about the platform's capability surface
-- (existing capabilities + reuse dispositions, genuinely missing ones,
-- hard boundaries) outlives the session and grounds every future pack
-- generation for the same goal.
--
-- T2 discipline: keyed by a one-way goal hash; carries capability facts
-- only — no persona identifiers, no subject data.

CREATE TABLE IF NOT EXISTS public.capability_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- sha256('capability:goal:' + goal).slice(0,16) — deterministic lookup key
  goal_hash text NOT NULL,
  intent_ref text,
  evidence jsonb NOT NULL,
  source text NOT NULL DEFAULT 'dev-loop-session',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_capability_evidence_goal
  ON public.capability_evidence (goal_hash, created_at DESC);

ALTER TABLE public.capability_evidence ENABLE ROW LEVEL SECURITY;

-- Server-side only (service role) — evidence is read/written exclusively by
-- the pack-generation seam; no browser path exists.
DROP POLICY IF EXISTS capability_evidence_service_all ON public.capability_evidence;
CREATE POLICY capability_evidence_service_all ON public.capability_evidence
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
