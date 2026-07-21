-- 20260806000000_agent_gateway_sessions.sql
--
-- metaMe Threshold — the Constitutional Handshake session store (PRD-THR-001 §6).
--
-- A gateway session is the scoped bearer a Threshold Companion (the user's agent)
-- receives AFTER the human crosses the Threshold: it is bound to an AUTHORIZED
-- Constitutional Agreement and carries only the capability scope the human
-- authorized. It stores NO T0 identifiers — the principal is referenced by its
-- T2 Polity Public Reference and the agent by a T2 alias; authority lives in the
-- referenced agreement, and `requireAuthorizedAgreement` remains the switch.
--
-- Lifecycle: begin_handshake inserts a `pending` row keyed by a one-time
-- `handshake_code` (the reference in the authorize URL). The human completes the
-- crossing in the browser (Passport sign-in + delegation authorize); activation
-- mints a random bearer, stores only its sha256 hash, records the T2 principal +
-- agent + agreement + granted scope, and flips the row to `active`. Revocation is
-- a status flip; TTL lapse and the agreement's own status/maxActions are the
-- other switches.
--
-- Deny-all RLS: reachable only via the spine/service-role gateway routes.

CREATE TABLE IF NOT EXISTS public.agent_gateway_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handshake_code text NOT NULL UNIQUE,          -- one-time reference in the authorize URL
  token_hash text UNIQUE,                        -- sha256 of the issued bearer (null until active)
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'revoked')),
  initiating_service text NOT NULL DEFAULT 'polity-passport',
  requested_scope text[] NOT NULL DEFAULT '{}',  -- what begin_handshake asked for
  -- set at activation (all T2-safe / server-internal FK only):
  principal_public_ref text,                     -- T2 Polity Public Reference of the human
  agent_alias text,                              -- T2 alias of the bound agent
  agreement_id uuid,                             -- the authorized Constitutional Agreement
  granted_scope text[] NOT NULL DEFAULT '{}',    -- what the human actually authorized
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  last_used_at timestamptz,
  revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS agent_gateway_sessions_token_idx ON public.agent_gateway_sessions (token_hash);
CREATE INDEX IF NOT EXISTS agent_gateway_sessions_principal_idx ON public.agent_gateway_sessions (principal_public_ref);

ALTER TABLE public.agent_gateway_sessions ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.agent_gateway_sessions IS
  'metaMe Threshold Constitutional Handshake sessions: scoped agent bearers bound to an authorized Constitutional Agreement. T2 refs only; deny-all RLS; service-role gateway routes only.';
