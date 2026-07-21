-- 20260709120000_operator_model_qubes.sql
--
-- Operator-declared ModelQube choices (CFS-015 Strand Two — provider choice as
-- sovereignty). Lets an operator register a model from the front end by naming
-- the ENV VAR that holds its API key (set separately in Amplify) — so model
-- choices are captured and exportable for the future without a code change.
--
-- Trust / tier model (PARAMOUNT):
--   * `key_env` / `base_url_env` store the ENV VAR NAME only — NEVER the secret
--     value. The API reports presence (does the env var exist at runtime?) but
--     never the value. A row carrying an actual key would be a secret leak.
--   * `declared_by_commitment` is a T2-safe one-way commitment (sha256 over the
--     persona id), NEVER the raw personaId — same discipline as the HMS locker
--     refs and the ModelQube ownership commitments.
--
-- Additive-only (CFS-010 §3); idempotent, re-runnable. RLS enabled with no
-- policies: service-role access only (all reads/writes flow through the
-- spine-gated, admin-only API route /api/constitutional/model-qubes).

CREATE TABLE IF NOT EXISTS public.operator_model_qubes (
  id text PRIMARY KEY,
  provider text NOT NULL,
  model text NOT NULL,
  key_env text NOT NULL,
  base_url_env text,
  tier text NOT NULL DEFAULT 'frontier',
  declared_by_commitment text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS operator_model_qubes_created_idx
  ON public.operator_model_qubes (created_at DESC);

ALTER TABLE public.operator_model_qubes ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.operator_model_qubes IS
  'Operator-declared ModelQube choices (CFS-015). key_env/base_url_env are env var NAMES only — never secret values. declared_by_commitment is a one-way T2 commitment, never a raw personaId. Service-role access only via the admin-gated /api/constitutional/model-qubes route.';
COMMENT ON COLUMN public.operator_model_qubes.key_env IS
  'The NAME of the env var holding the provider API key (e.g. OPENAI_API_KEY) — set in Amplify. NEVER the key value.';
