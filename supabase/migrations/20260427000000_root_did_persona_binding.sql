-- Root DID persona binding — Phase 2 (corrected)
-- Additive migration. Non-breaking — all new columns are nullable or have defaults.
-- NOTE: persona is a view over persona_legacy_20260125 in this DB, so we create
-- did_persona as the new DiDQube persona table rather than altering the view.

-- ─── Kybe dev stub ───────────────────────────────────────────────────────────
INSERT INTO public.kybe_identity (kybe_did, state)
VALUES ('did:kybe:dev:stub:v1', 'active')
ON CONFLICT (kybe_did) DO NOTHING;

-- ─── root_identity additions ──────────────────────────────────────────────────
ALTER TABLE public.root_identity
  ADD COLUMN IF NOT EXISTS auth_user_id uuid UNIQUE,
  ADD COLUMN IF NOT EXISTS display_name  text,
  ADD COLUMN IF NOT EXISTS primary_email text;

COMMENT ON COLUMN public.root_identity.auth_user_id IS 'Supabase auth.users id — canonical link between auth session and root DID';
COMMENT ON COLUMN public.root_identity.display_name  IS 'Human-readable name for this root identity';
COMMENT ON COLUMN public.root_identity.primary_email IS 'Primary email (informational, not auth)';

CREATE INDEX IF NOT EXISTS idx_root_identity_auth_user_id ON public.root_identity (auth_user_id);

-- ─── did_persona (DiDQube persona layer) ─────────────────────────────────────
-- Named did_persona to avoid conflict with the existing persona view.

CREATE TABLE IF NOT EXISTS public.did_persona (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  root_id                uuid REFERENCES public.root_identity(id) ON DELETE SET NULL,
  fio_handle             text,
  default_identity_state text NOT NULL
    CHECK (default_identity_state IN ('anonymous','semi_anonymous','semi_identifiable','identifiable'))
    DEFAULT 'semi_anonymous',
  app_origin             text,
  world_id_status        text
    CHECK (world_id_status IN ('unverified','verified_human','agent_declared'))
    DEFAULT 'unverified',
  persona_type           text CHECK (persona_type IN ('knyt','qripto','aigent','anon','custom')),
  payload_row_id         uuid,
  created_at             timestamptz DEFAULT now()
);

COMMENT ON TABLE  public.did_persona IS 'DiDQube persona layer — one row per persona DID, linked to root_identity';
COMMENT ON COLUMN public.did_persona.persona_type   IS 'Which payload table this row represents';
COMMENT ON COLUMN public.did_persona.payload_row_id IS 'PK of the row in nakamoto_knyt_personas or nakamoto_qripto_personas';

CREATE INDEX IF NOT EXISTS idx_did_persona_root_id     ON public.did_persona (root_id);
CREATE INDEX IF NOT EXISTS idx_did_persona_payload_row ON public.did_persona (persona_type, payload_row_id);

-- ─── nakamoto_knyt_personas — did_persona_id FK ───────────────────────────────
ALTER TABLE public.nakamoto_knyt_personas
  ADD COLUMN IF NOT EXISTS did_persona_id uuid REFERENCES public.did_persona(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.nakamoto_knyt_personas.did_persona_id IS 'FK to did_persona — set during Root DID bind';

CREATE INDEX IF NOT EXISTS idx_knyt_personas_did_persona_id ON public.nakamoto_knyt_personas (did_persona_id);

-- ─── nakamoto_qripto_personas — did_persona_id FK ────────────────────────────
ALTER TABLE public.nakamoto_qripto_personas
  ADD COLUMN IF NOT EXISTS did_persona_id uuid REFERENCES public.did_persona(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.nakamoto_qripto_personas.did_persona_id IS 'FK to did_persona — set during Root DID bind';

CREATE INDEX IF NOT EXISTS idx_qripto_personas_did_persona_id ON public.nakamoto_qripto_personas (did_persona_id);

-- ─── RLS for did_persona ──────────────────────────────────────────────────────
ALTER TABLE public.did_persona ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "did_persona select" ON public.did_persona;
CREATE POLICY "did_persona select" ON public.did_persona
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "did_persona insert" ON public.did_persona;
CREATE POLICY "did_persona insert" ON public.did_persona
  FOR INSERT WITH CHECK (auth.role() IN ('authenticated','service_role'));

DROP POLICY IF EXISTS "did_persona update own" ON public.did_persona;
CREATE POLICY "did_persona update own" ON public.did_persona
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.root_identity ri
      WHERE ri.id = did_persona.root_id
        AND (ri.auth_user_id = auth.uid() OR auth.role() = 'service_role')
    )
    OR auth.role() = 'service_role'
  );

-- ─── RLS for root_identity ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "root_identity select own" ON public.root_identity;
CREATE POLICY "root_identity select own" ON public.root_identity
  FOR SELECT USING (
    auth_user_id = auth.uid()
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "root_identity insert own" ON public.root_identity;
CREATE POLICY "root_identity insert own" ON public.root_identity
  FOR INSERT WITH CHECK (
    auth_user_id = auth.uid()
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "root_identity update own" ON public.root_identity;
CREATE POLICY "root_identity update own" ON public.root_identity
  FOR UPDATE USING (
    auth_user_id = auth.uid()
    OR auth.role() = 'service_role'
  );
