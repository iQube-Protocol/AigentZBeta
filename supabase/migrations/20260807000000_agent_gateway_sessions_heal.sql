-- 20260807000000_agent_gateway_sessions_heal.sql
--
-- Heal `agent_gateway_sessions` to the full OAuth 2.1 shape REGARDLESS of which
-- earlier version created the table. The original migration uses
-- `CREATE TABLE IF NOT EXISTS`, so a table created by an earlier (pre-OAuth)
-- revision keeps its old columns + status CHECK — and the crossing then fails at
-- "could not issue authorization code" because the UPDATE to status='authorized'
-- is rejected by a stale CHECK constraint. This migration is idempotent and safe
-- to run on a fresh table too (every step is IF NOT EXISTS / DROP-then-ADD).

-- 1. Ensure the OAuth authorization-code + PKCE columns exist.
ALTER TABLE public.agent_gateway_sessions ADD COLUMN IF NOT EXISTS client_id text;
ALTER TABLE public.agent_gateway_sessions ADD COLUMN IF NOT EXISTS redirect_uri text;
ALTER TABLE public.agent_gateway_sessions ADD COLUMN IF NOT EXISTS pkce_challenge text;
ALTER TABLE public.agent_gateway_sessions ADD COLUMN IF NOT EXISTS oauth_state text;
ALTER TABLE public.agent_gateway_sessions ADD COLUMN IF NOT EXISTS auth_code_hash text;
ALTER TABLE public.agent_gateway_sessions ADD COLUMN IF NOT EXISTS code_expires_at timestamptz;

-- 2. Widen the status CHECK to include 'authorized' (the crossing's intermediate
--    state). Drop the old inline constraint by its auto-generated name, re-add.
ALTER TABLE public.agent_gateway_sessions DROP CONSTRAINT IF EXISTS agent_gateway_sessions_status_check;
ALTER TABLE public.agent_gateway_sessions
  ADD CONSTRAINT agent_gateway_sessions_status_check
  CHECK (status IN ('pending', 'authorized', 'active', 'revoked'));

-- 3. Unique on the one-time authorization code hash (guarded — ADD CONSTRAINT has
--    no IF NOT EXISTS, so check the catalog first).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'agent_gateway_sessions_auth_code_hash_key'
  ) THEN
    ALTER TABLE public.agent_gateway_sessions
      ADD CONSTRAINT agent_gateway_sessions_auth_code_hash_key UNIQUE (auth_code_hash);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS agent_gateway_sessions_authcode_idx ON public.agent_gateway_sessions (auth_code_hash);

-- 4. Ensure the DCR clients table exists (a pre-OAuth apply would not have it).
CREATE TABLE IF NOT EXISTS public.agent_gateway_clients (
  client_id text PRIMARY KEY,
  client_name text,
  redirect_uris text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.agent_gateway_clients ENABLE ROW LEVEL SECURITY;
