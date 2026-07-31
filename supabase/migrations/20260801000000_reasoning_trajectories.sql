-- 20260801000000_reasoning_trajectories.sql
--
-- CFS-045-A2 Reasoning Trajectories (ratified 2026-07-19): memory preserves
-- HOW it was learned, not just what. One trajectory row per compiled turn —
-- intent digest + ordered invariant activations + cited-vs-discarded +
-- outcome. NEVER transcript content (intent_digest is a model-produced
-- compression that passes the same T1 guard as memory statements).
--
-- Trajectories are study material, not substrate: capped at 500 per
-- (persona, cartridge), oldest pruned on write (service-side).
--
-- session_marker is an opaque client-generated random token — grouping only,
-- never derived from any identifier.
--
-- Service-role access only; RLS enabled with no client policies.

CREATE TABLE IF NOT EXISTS public.reasoning_trajectories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id uuid NOT NULL,
  cartridge_id text NOT NULL,
  intent_digest text NOT NULL,
  activated_seed_ids text[] NOT NULL DEFAULT '{}',
  memory_ids_cited uuid[] NOT NULL DEFAULT '{}',
  discarded_seed_ids text[] NOT NULL DEFAULT '{}',
  outcome text NOT NULL,
  produced_invariant_id uuid,
  session_marker text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reasoning_trajectories_persona_cartridge_idx
  ON public.reasoning_trajectories (persona_id, cartridge_id, created_at DESC);

ALTER TABLE public.reasoning_trajectories ENABLE ROW LEVEL SECURITY;

-- Evidence layer (A2): typed append-only provenance on the invariant —
-- a stored conclusion is never detached from why it is trusted.
ALTER TABLE public.memory_invariants
  ADD COLUMN IF NOT EXISTS evidence jsonb NOT NULL DEFAULT '[]'::jsonb;
