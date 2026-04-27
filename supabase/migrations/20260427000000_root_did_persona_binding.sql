-- Root DID persona binding — Phase 2
-- Additive migration. Non-breaking — all new columns are nullable or have defaults.
--
-- Changes:
--   root_identity  → add auth_user_id (unique), display_name, primary_email
--   persona        → add persona_type, payload_row_id
--   nakamoto_knyt_personas   → add did_persona_id FK
--   nakamoto_qripto_personas → add did_persona_id FK
--   kybe_identity  → seed dev stub row
--   New RLS policies for root_identity (users can only see/edit their own row)

-- ─── Kybe dev stub ───────────────────────────────────────────────────────────
-- Must exist before root_identity rows reference it.
-- In production, real kybe_did values are issued by the Kybe proof-of-personhood service.
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
COMMENT ON COLUMN public.root_identity.primary_email IS 'Primary email associated with this root identity (informational, not auth)';

CREATE INDEX IF NOT EXISTS idx_root_identity_auth_user_id ON public.root_identity (auth_user_id);

-- ─── persona additions ────────────────────────────────────────────────────────
ALTER TABLE public.persona
  ADD COLUMN IF NOT EXISTS persona_type   text CHECK (persona_type IN ('knyt','qripto','aigent','anon','custom')),
  ADD COLUMN IF NOT EXISTS payload_row_id uuid;

COMMENT ON COLUMN public.persona.persona_type   IS 'Which persona table this DiDQube row represents';
COMMENT ON COLUMN public.persona.payload_row_id IS 'UUID PK of the matching row in nakamoto_knyt_personas or nakamoto_qripto_personas';

CREATE INDEX IF NOT EXISTS idx_persona_payload_row ON public.persona (persona_type, payload_row_id);

-- ─── nakamoto_knyt_personas — did_persona_id FK ───────────────────────────────
ALTER TABLE public.nakamoto_knyt_personas
  ADD COLUMN IF NOT EXISTS did_persona_id uuid REFERENCES public.persona(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.nakamoto_knyt_personas.did_persona_id IS 'FK to persona (DiDQube) — set during Root DID bind';

CREATE INDEX IF NOT EXISTS idx_knyt_personas_did_persona_id ON public.nakamoto_knyt_personas (did_persona_id);

-- ─── nakamoto_qripto_personas — did_persona_id FK ────────────────────────────
ALTER TABLE public.nakamoto_qripto_personas
  ADD COLUMN IF NOT EXISTS did_persona_id uuid REFERENCES public.persona(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.nakamoto_qripto_personas.did_persona_id IS 'FK to persona (DiDQube) — set during Root DID bind';

CREATE INDEX IF NOT EXISTS idx_qripto_personas_did_persona_id ON public.nakamoto_qripto_personas (did_persona_id);

-- ─── RLS for root_identity ────────────────────────────────────────────────────
-- Users can see only their own root identity; service role bypasses RLS.
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

-- ─── RLS for persona updates (bind stamping) ──────────────────────────────────
DROP POLICY IF EXISTS "persona update own" ON public.persona;
CREATE POLICY "persona update own" ON public.persona
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.root_identity ri
      WHERE ri.id = persona.root_id
        AND (ri.auth_user_id = auth.uid() OR auth.role() = 'service_role')
    )
    OR auth.role() = 'service_role'
  );
