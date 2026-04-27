-- Agent DID schema — corrected
-- Three DID classes for agents: root, environment, persona.
-- No Kybe DID — proof-of-personhood is exclusively human.
-- References did_persona (not persona view) throughout.
-- Run AFTER 20260427000000_root_did_persona_binding.sql.

-- ─── Agent root identity ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.agent_root_identity (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id     text UNIQUE NOT NULL,
  did_uri      text UNIQUE NOT NULL,
  agent_class  text NOT NULL CHECK (agent_class IN (
                 'system-orchestrator',
                 'sovereign-guardian',
                 'customer-guide',
                 'cartridge-lead',
                 'specialist',
                 'guide-agent',
                 'tool-agent',
                 'user-deployed'
               )),
  display_name text,
  description  text,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

COMMENT ON TABLE  public.agent_root_identity IS 'Canonical root DID for every agent entity in the platform';
COMMENT ON COLUMN public.agent_root_identity.agent_id IS 'Stable text identifier matching AgentRoleId or a named agent (e.g. marketa, know1)';
COMMENT ON COLUMN public.agent_root_identity.did_uri  IS 'did:agent:root:<id>';

-- ─── Agent environment DID ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.agent_environment (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_root_id    uuid REFERENCES public.agent_root_identity(id) ON DELETE CASCADE,
  did_uri          text UNIQUE NOT NULL,
  environment_type text NOT NULL
    CHECK (environment_type IN ('production','staging','sandbox','test','local'))
    DEFAULT 'production',
  host_context     text,
  session_scope    text
    CHECK (session_scope IN ('persistent','session','ephemeral'))
    DEFAULT 'session',
  activated_at     timestamptz DEFAULT now(),
  expires_at       timestamptz,
  created_at       timestamptz DEFAULT now()
);

COMMENT ON COLUMN public.agent_environment.host_context  IS 'Surface/cartridge slug where this environment is active';
COMMENT ON COLUMN public.agent_environment.session_scope IS 'persistent = survives restarts; session = one session; ephemeral = single interaction';

CREATE INDEX IF NOT EXISTS idx_agent_env_root ON public.agent_environment (agent_root_id);

-- ─── Agent persona DID ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.agent_persona (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_root_id    uuid REFERENCES public.agent_root_identity(id) ON DELETE CASCADE,
  environment_id   uuid REFERENCES public.agent_environment(id)   ON DELETE SET NULL,
  did_uri          text UNIQUE NOT NULL,
  persona_role     text,

  -- Bounded delegation (null = autonomous, no user delegation)
  delegation_user_root_id uuid REFERENCES public.root_identity(id)  ON DELETE SET NULL,
  delegation_persona_id   uuid REFERENCES public.did_persona(id)     ON DELETE SET NULL,

  -- Identifiability ceiling — agent may never exceed this in this context
  max_identifiability text NOT NULL
    CHECK (max_identifiability IN ('anonymous','semi_anonymous','semi_identifiable','identifiable'))
    DEFAULT 'anonymous',

  -- Action grants: {"read_blakqube": true, "send_comms": false, ...}
  delegation_scopes jsonb DEFAULT '{}',

  valid_from   timestamptz DEFAULT now(),
  valid_until  timestamptz,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

COMMENT ON COLUMN public.agent_persona.max_identifiability IS
  'Ceiling the agent may not exceed; must be <= the delegated user persona level';
COMMENT ON COLUMN public.agent_persona.delegation_scopes IS
  'JSON action→boolean map; only explicit true grants are permitted';
COMMENT ON COLUMN public.agent_persona.delegation_user_root_id IS
  'The user root identity this agent is acting on behalf of; null for autonomous operation';

CREATE INDEX IF NOT EXISTS idx_agent_persona_root       ON public.agent_persona (agent_root_id);
CREATE INDEX IF NOT EXISTS idx_agent_persona_env        ON public.agent_persona (environment_id);
CREATE INDEX IF NOT EXISTS idx_agent_persona_delegation ON public.agent_persona (delegation_user_root_id, delegation_persona_id);

-- ─── Upgrade persona_agent_binding ───────────────────────────────────────────
ALTER TABLE public.persona_agent_binding
  ADD COLUMN IF NOT EXISTS agent_root_id uuid REFERENCES public.agent_root_identity(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.persona_agent_binding.agent_root_id IS
  'FK to agent_root_identity; null for legacy text-only bindings pre-DID registration';

CREATE INDEX IF NOT EXISTS idx_persona_agent_binding_root ON public.persona_agent_binding (agent_root_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.agent_root_identity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_environment    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_persona        ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agent_root_identity select" ON public.agent_root_identity;
CREATE POLICY "agent_root_identity select" ON public.agent_root_identity
  FOR SELECT USING (auth.role() IN ('authenticated','anon','service_role'));

DROP POLICY IF EXISTS "agent_root_identity write service" ON public.agent_root_identity;
CREATE POLICY "agent_root_identity write service" ON public.agent_root_identity
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "agent_environment select" ON public.agent_environment;
CREATE POLICY "agent_environment select" ON public.agent_environment
  FOR SELECT USING (auth.role() IN ('authenticated','service_role'));

DROP POLICY IF EXISTS "agent_environment write service" ON public.agent_environment;
CREATE POLICY "agent_environment write service" ON public.agent_environment
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "agent_persona select" ON public.agent_persona;
CREATE POLICY "agent_persona select" ON public.agent_persona
  FOR SELECT USING (
    auth.role() = 'service_role'
    OR delegation_user_root_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.root_identity ri
      WHERE ri.id = agent_persona.delegation_user_root_id
        AND ri.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "agent_persona write service" ON public.agent_persona;
CREATE POLICY "agent_persona write service" ON public.agent_persona
  FOR ALL USING (auth.role() = 'service_role');

-- ─── Seed: known platform agents ─────────────────────────────────────────────
INSERT INTO public.agent_root_identity (agent_id, did_uri, agent_class, display_name, description)
VALUES
  ('metame-guardian',
   'did:agent:root:metame-guardian',
   'sovereign-guardian',
   'metaMe',
   'Sovereign guardian — final policy veto authority, identity and data sovereignty'),

  ('aigent-z',
   'did:agent:root:aigent-z',
   'system-orchestrator',
   'Aigent Z',
   'System orchestrator — routes interactions, enforces policy, selects NBE'),

  ('aigent-c',
   'did:agent:root:aigent-c',
   'customer-guide',
   'Aigent C',
   'Customer guide — primary user-facing handler, executes NBE dispositions'),

  ('marketa',
   'did:agent:root:marketa',
   'guide-agent',
   'Marketa',
   'KNYT activation and campaign guide agent'),

  ('know1',
   'did:agent:root:know1',
   'guide-agent',
   'Know1',
   'Knowledge and research guide agent'),

  ('claude-code',
   'did:agent:root:claude-code',
   'specialist',
   'Claude Code',
   'Engineering specialist agent — platform build and maintenance')

ON CONFLICT (agent_id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description  = EXCLUDED.description,
  updated_at   = now();
