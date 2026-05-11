-- ============================================================================
-- persona_google_tokens — Aigent Me Phase 6.b OAuth token storage.
-- Per the locked decision Q3 (opt-in per source): one row per (persona, source).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.persona_google_tokens (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  persona_id          text NOT NULL,
  source              text NOT NULL
    CHECK (source IN ('gmail','calendar','drive','docs','slides')),
  -- Tokens are sensitive. Stored as ciphertext blobs; plaintext only crossed
  -- in services/google/oauth.ts. Phase 6.b ships base64 envelope; encryption
  -- via services/content/encryption.ts wires in Phase 6.b.2.
  access_token        text NOT NULL,
  refresh_token       text,
  scopes              text[] NOT NULL DEFAULT '{}',
  expires_at          timestamptz,
  -- Email of the connected Google account (informational; never used for auth).
  google_account_email text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT persona_google_tokens_persona_source_uniq UNIQUE (persona_id, source)
);

CREATE INDEX IF NOT EXISTS idx_persona_google_tokens_persona ON public.persona_google_tokens(persona_id);
CREATE INDEX IF NOT EXISTS idx_persona_google_tokens_expires ON public.persona_google_tokens(expires_at);

ALTER TABLE public.persona_google_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "persona_google_tokens_read_service"  ON public.persona_google_tokens;
DROP POLICY IF EXISTS "persona_google_tokens_write_service" ON public.persona_google_tokens;
CREATE POLICY "persona_google_tokens_read_service"  ON public.persona_google_tokens FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY "persona_google_tokens_write_service" ON public.persona_google_tokens FOR ALL    USING (auth.role() = 'service_role');

-- updated_at auto-touch
CREATE OR REPLACE FUNCTION public.touch_persona_google_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_persona_google_tokens_touch ON public.persona_google_tokens;
CREATE TRIGGER trg_persona_google_tokens_touch
  BEFORE UPDATE ON public.persona_google_tokens
  FOR EACH ROW EXECUTE FUNCTION public.touch_persona_google_tokens_updated_at();

COMMENT ON TABLE  public.persona_google_tokens IS 'Aigent Me Phase 6.b — per-persona Google Workspace OAuth tokens. Opt-in per source.';
COMMENT ON COLUMN public.persona_google_tokens.persona_id IS 'T0 — server-internal only.';
COMMENT ON COLUMN public.persona_google_tokens.access_token IS 'Base64-enveloped ciphertext in Phase 6.b.2.';
