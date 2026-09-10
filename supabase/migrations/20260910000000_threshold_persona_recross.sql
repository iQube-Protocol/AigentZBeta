-- Issue #112 — bounded persona discovery + human-authorized persona re-crossing.
-- A persona switch is a fresh OAuth crossing that supersedes (never upgrades)
-- one active session. Only T2 public references are stored on the transition.

ALTER TABLE public.agent_gateway_sessions
  ADD COLUMN IF NOT EXISTS transition_kind text NOT NULL DEFAULT 'base';
ALTER TABLE public.agent_gateway_sessions
  ADD COLUMN IF NOT EXISTS supersedes_session_id uuid REFERENCES public.agent_gateway_sessions(id);
ALTER TABLE public.agent_gateway_sessions
  ADD COLUMN IF NOT EXISTS target_principal_public_ref text;

ALTER TABLE public.agent_gateway_sessions
  DROP CONSTRAINT IF EXISTS agent_gateway_sessions_transition_kind_check;
ALTER TABLE public.agent_gateway_sessions
  ADD CONSTRAINT agent_gateway_sessions_transition_kind_check
  CHECK (transition_kind IN ('base', 'service_upgrade', 'persona_switch'));

ALTER TABLE public.agent_gateway_sessions
  DROP CONSTRAINT IF EXISTS agent_gateway_sessions_persona_switch_shape_check;
ALTER TABLE public.agent_gateway_sessions
  ADD CONSTRAINT agent_gateway_sessions_persona_switch_shape_check
  CHECK (
    transition_kind <> 'persona_switch' OR (
      supersedes_session_id IS NOT NULL
      AND target_principal_public_ref IS NOT NULL
      AND upgrade_of IS NULL
      AND service_agreements = '{}'::jsonb
      AND (
        status NOT IN ('authorized', 'active')
        OR principal_public_ref = target_principal_public_ref
      )
    )
  );

-- Existing upgrade rows predate transition_kind. Classify them without changing
-- their behavior; persona-switch rows use the dedicated supersedes column.
UPDATE public.agent_gateway_sessions
SET transition_kind = 'service_upgrade'
WHERE upgrade_of IS NOT NULL AND transition_kind = 'base';

CREATE INDEX IF NOT EXISTS agent_gateway_sessions_supersedes_idx
  ON public.agent_gateway_sessions (supersedes_session_id)
  WHERE supersedes_session_id IS NOT NULL;

COMMENT ON COLUMN public.agent_gateway_sessions.transition_kind IS
  'base, service_upgrade, or persona_switch; persona_switch always creates a fresh target-bound bearer.';
