-- 20260617000000 — aigentMe designation on sponsored agents
--
-- The aigentMe agent is the citizen's PRIMARY bounded delegate — the personal
-- agent that represents them across metaMe. It is an ordinary polity_bound
-- agent_root_identity row sponsored by the citizen's own passport, flagged so
-- the wallet (AgentQubes) and the delegation surface can recognise it
-- deterministically as delegate slot 1.
--
-- Reuse, don't recreate: this extends agent_root_identity (the existing genesis
-- substrate) rather than introducing a parallel "aigentMe" table. The aigentMe
-- still counts as one of the citizen's base sponsorship-capacity slots
-- (base 3 = 1× aigentMe + 2× participants).

BEGIN;

ALTER TABLE public.agent_root_identity
  ADD COLUMN IF NOT EXISTS is_aigent_me boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.agent_root_identity.is_aigent_me IS
  'True for the citizen''s primary personal delegate (aigentMe). At most one per sponsor persona — enforced by uq_agent_root_aigent_me_per_persona.';

-- At most one aigentMe per sponsoring persona. Partial unique index so the
-- constraint only applies to flagged rows; ordinary sponsored agents are
-- unconstrained.
CREATE UNIQUE INDEX IF NOT EXISTS uq_agent_root_aigent_me_per_persona
  ON public.agent_root_identity (sponsor_persona_id)
  WHERE is_aigent_me;

COMMIT;
