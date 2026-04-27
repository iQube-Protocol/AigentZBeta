-- Agent DID schema — Phase 2 extension
-- Additive, non-breaking. Agents have three DID classes (root, environment, persona)
-- but NO Kybe DID (proof-of-personhood is exclusively human).
--
-- Bounded delegation: agent_persona rows carry a max_identifiability ceiling that
-- must be <= the delegating user persona's level, plus a scoped permissions object
-- and explicit validity window.
--
-- Canonical agent IDs match types/orchestration.ts AgentRoleId + known named agents.

-- ─── Agent root identity ──────────────────────────────────────────────────────
-- One row per distinct agent entity. No kybe_id — agents are not humans.
-- did_uri format: did:agent:root:<uuid>

CREATE TABLE IF NOT EXISTS public.agent_root_identity (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id    text    UNIQUE NOT NULL,
  did_uri     text    UNIQUE NOT NULL,
  agent_class text    NOT NULL CHECK (agent_class IN (
                'system-orchestrator',   -- Aigent Z: top-level router
                'sovereign-guardian',    -- metaMe: policy veto authority
                'customer-guide',        -- Aigent C: default user-facing handler
                'cartridge-lead',        -- per-cartridge domain agent
                'specialist',            -- task-scoped agent
                'guide-agent',           -- named guides (Marketa, Know1, etc.)
                'tool-agent',            -- lightweight single-purpose tool agent
                'user-deployed'          -- custom agents deployed by a platform user
              )),
  display_name text,
  description  text,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

COMMENT ON TABLE  public.agent_root_identity IS 'Canonical root DID for every agent entity in the platform';
COMMENT ON COLUMN public.agent_root_identity.agent_id IS 'Stable text identifier matching AgentRoleId or a named agent (e.g. marketa, know1)';
COMMENT ON COLUMN public.agent_root_identity.did_uri  IS 'did:agent:root:<uuid> — deterministic on first registration';

-- ─── Agent environment DID ────────────────────────────────────────────────────
-- Where an agent operates: production runtime, codex session, sandbox, etc.
-- One agent_root can have multiple environments (prod + staging, different codexes).
-- did_uri format: did:agent:env:<uuid>

CREATE TABLE IF NOT EXISTS public.agent_environment (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_root_id    uuid REFERENCES public.agent_root_identity(id) ON DELETE CASCADE,
  did_uri          text UNIQUE NOT NULL,
  environment_type text NOT NULL CHECK (environment_type IN (
                     'production', 'staging', 'sandbox', 'test', 'local'
                   )) DEFAULT 'production',
  host_context     text,   -- e.g. 'metame-runtime', 'knyt-codex', 'qriptopian-codex', 'api'
  session_scope    text    CHECK (session_scope IN ('persistent','session','ephemeral')) DEFAULT 'session',
  activated_at     timestamptz DEFAULT now(),
  expires_at       timestamptz,   -- null = no expiry
  created_at       timestamptz DEFAULT now()
);

COMMENT ON TABLE  public.agent_environment IS 'Environment DID: scopes an agent to a specific runtime context';
COMMENT ON COLUMN public.agent_environment.host_context IS 'Surface/cartridge slug where this environment is active';
COMMENT ON COLUMN public.agent_environment.session_scope IS 'persistent = survives restarts; session = one session; ephemeral = single interaction';

CREATE INDEX IF NOT EXISTS idx_agent_env_root ON public.agent_environment (agent_root_id);

-- ─── Agent persona DID ────────────────────────────────────────────────────────
-- The agent's identity in a specific bounded delegation context.
-- When acting on behalf of a user, max_identifiability must be <= the user
-- persona's default_identity_state. The platform enforces this at bind time.
-- did_uri format: did:agent:persona:<uuid>

CREATE TABLE IF NOT EXISTS public.agent_persona (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_root_id    uuid REFERENCES public.agent_root_identity(id) ON DELETE CASCADE,
  environment_id   uuid REFERENCES public.agent_environment(id)  ON DELETE SET NULL,
  did_uri          text UNIQUE NOT NULL,
  persona_role     text,   -- e.g. 'orchestrator', 'guide', 'specialist', 'assistant'

  -- ── Bounded delegation context ──────────────────────────────────────────
  -- Populated only when the agent is acting on behalf of a user.
  -- null = autonomous / system-level operation (no user delegation).
  delegation_user_root_id  uuid REFERENCES public.root_identity(id) ON DELETE SET NULL,
  delegation_persona_id    uuid REFERENCES public.persona(id)        ON DELETE SET NULL,

  -- Ceiling identifiability: agent may NEVER exceed this level in this context.
  -- Must be checked against delegation_persona.default_identity_state at bind time.
  max_identifiability text NOT NULL
    CHECK (max_identifiability IN ('anonymous','semi_anonymous','semi_identifiable','identifiable'))
    DEFAULT 'anonymous',

  -- Fine-grained permission scopes for this delegation.
  -- Keys are action names; values are boolean grants.
  -- Example: {"read_blakqube": true, "send_comms": false, "mint_iqube": false, "write_memory": true}
  delegation_scopes jsonb DEFAULT '{}',

  -- Validity window — null valid_until means no expiry
  valid_from   timestamptz DEFAULT now(),
  valid_until  timestamptz,

  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

COMMENT ON TABLE  public.agent_persona IS 'Agent persona DID scoped to a bounded delegation context';
COMMENT ON COLUMN public.agent_persona.max_identifiability IS
  'Ceiling the agent may not exceed; must be <= the delegated user persona identifiability level';
COMMENT ON COLUMN public.agent_persona.delegation_scopes IS
  'JSON action→boolean map; only explicit true grants are permitted in this delegation';
COMMENT ON COLUMN public.agent_persona.delegation_user_root_id IS
  'The user root identity this agent is acting on behalf of; null for autonomous operation';

CREATE INDEX IF NOT EXISTS idx_agent_persona_root        ON public.agent_persona (agent_root_id);
CREATE INDEX IF NOT EXISTS idx_agent_persona_env         ON public.agent_persona (environment_id);
CREATE INDEX IF NOT EXISTS idx_agent_persona_delegation  ON public.agent_persona (delegation_user_root_id, delegation_persona_id);

-- ─── Upgrade persona_agent_binding to reference agent_root_identity ───────────
-- Add optional FK so existing text agent_id rows can be upgraded progressively.
-- Old rows with no matching agent_root_identity row stay valid (null FK).

ALTER TABLE public.persona_agent_binding
  ADD COLUMN IF NOT EXISTS agent_root_id uuid REFERENCES public.agent_root_identity(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.persona_agent_binding.agent_root_id IS
  'FK to agent_root_identity; null for legacy text-only bindings pre-DID registration';

CREATE INDEX IF NOT EXISTS idx_persona_agent_binding_root ON public.persona_agent_binding (agent_root_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.agent_root_identity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_environment    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_persona        ENABLE ROW LEVEL SECURITY;

-- agent_root_identity: anyone authenticated can read; only service_role can write
DROP POLICY IF EXISTS "agent_root_identity select" ON public.agent_root_identity;
CREATE POLICY "agent_root_identity select" ON public.agent_root_identity
  FOR SELECT USING (auth.role() IN ('authenticated','anon','service_role'));

DROP POLICY IF EXISTS "agent_root_identity write service" ON public.agent_root_identity;
CREATE POLICY "agent_root_identity write service" ON public.agent_root_identity
  FOR ALL USING (auth.role() = 'service_role');

-- agent_environment: readable by authenticated; writable by service_role
DROP POLICY IF EXISTS "agent_environment select" ON public.agent_environment;
CREATE POLICY "agent_environment select" ON public.agent_environment
  FOR SELECT USING (auth.role() IN ('authenticated','service_role'));

DROP POLICY IF EXISTS "agent_environment write service" ON public.agent_environment;
CREATE POLICY "agent_environment write service" ON public.agent_environment
  FOR ALL USING (auth.role() = 'service_role');

-- agent_persona: users can read their own delegation rows + all service_role rows
DROP POLICY IF EXISTS "agent_persona select" ON public.agent_persona;
CREATE POLICY "agent_persona select" ON public.agent_persona
  FOR SELECT USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.root_identity ri
      WHERE ri.id = agent_persona.delegation_user_root_id
        AND ri.auth_user_id = auth.uid()
    )
    OR delegation_user_root_id IS NULL  -- autonomous personas are world-readable
  );

DROP POLICY IF EXISTS "agent_persona write service" ON public.agent_persona;
CREATE POLICY "agent_persona write service" ON public.agent_persona
  FOR ALL USING (auth.role() = 'service_role');

-- ─── Seed: known platform agents ─────────────────────────────────────────────
-- These are the canonical system agents from types/orchestration.ts.
-- DIDs use gen_random_uuid() equivalents — deterministic via ON CONFLICT.

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
