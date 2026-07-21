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
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'authorized', 'active', 'revoked')),
  initiating_service text NOT NULL DEFAULT 'polity-passport',
  requested_scope text[] NOT NULL DEFAULT '{}',  -- what begin_handshake asked for
  -- OAuth 2.1 authorization-code + PKCE binding (set when /authorize starts the crossing):
  client_id text,                                -- the OAuth client (Threshold Companion)
  redirect_uri text,                             -- where the authorization code is returned
  pkce_challenge text,                           -- S256 code_challenge (the verifier is NEVER stored)
  oauth_state text,                              -- opaque client state, echoed back verbatim
  auth_code_hash text UNIQUE,                    -- sha256 of the one-time authorization code
  code_expires_at timestamptz,                   -- short TTL for the authorization code
  -- set at activation (all T2-safe / server-internal FK only):
  principal_public_ref text,                     -- T2 Polity Public Reference of the human
  agent_alias text,                              -- T2 alias of the bound agent
  agreement_id text,                             -- the authorized Constitutional Agreement (slug, e.g. thr-thc_…)
  granted_scope text[] NOT NULL DEFAULT '{}',    -- what the human actually authorized
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  last_used_at timestamptz,
  revoked_at timestamptz
);

-- OAuth Dynamic Client Registration (RFC 7591) — public PKCE clients only; NO
-- client secret is stored (MCP remote connectors are public clients that rely
-- on PKCE, not on a shared secret).
CREATE TABLE IF NOT EXISTS public.agent_gateway_clients (
  client_id text PRIMARY KEY,
  client_name text,
  redirect_uris text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.agent_gateway_clients ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS agent_gateway_sessions_token_idx ON public.agent_gateway_sessions (token_hash);
CREATE INDEX IF NOT EXISTS agent_gateway_sessions_principal_idx ON public.agent_gateway_sessions (principal_public_ref);

ALTER TABLE public.agent_gateway_sessions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS agent_gateway_sessions_authcode_idx ON public.agent_gateway_sessions (auth_code_hash);

COMMENT ON TABLE public.agent_gateway_sessions IS
  'metaMe Threshold Constitutional Handshake sessions: scoped agent bearers bound to an authorized Constitutional Agreement, via an OAuth 2.1 authorization-code + PKCE crossing. T2 refs only; deny-all RLS; service-role gateway routes only.';
COMMENT ON TABLE public.agent_gateway_clients IS
  'metaMe Threshold OAuth dynamic client registrations (public PKCE clients; no secret). Service-role only.';
