-- 20260722000000_persona_external_refs.sql
--
-- Pairwise External Service References (three-level persona reference model,
-- 2026-07-18 operator direction).
--
-- Level 3 of the model: a per-audience reference derived server-side via a
-- keyed HMAC (never plain sha256, so possession of a persona UUID alone does
-- not let a third party reproduce refs). Each (persona, audience) pair gets a
-- distinct reference, so external services cannot correlate a persona across
-- services. Rows are the recovery record: the wallet lists them so an issued
-- ref is never lost, and revocation/regeneration is an UPDATE + INSERT with a
-- bumped generation (the HMAC input includes the generation, so regenerating
-- yields a fresh ref).
--
-- persona_id here may be a human persona, a created agent persona, or a bound
-- delegate's identity persona — ownership is enforced at the route layer
-- (caller's persona inventory), not by FK, because agent identity personas do
-- not all live in public.personas.
--
-- Service-role access only (no client policies): the deriving secret lives
-- server-side and all reads/writes flow through /api/wallet/identity/references.

CREATE TABLE IF NOT EXISTS public.persona_external_refs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id uuid NOT NULL,
  audience text NOT NULL,
  ref text NOT NULL,
  generation int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE (persona_id, audience, generation)
);

CREATE INDEX IF NOT EXISTS persona_external_refs_persona_idx
  ON public.persona_external_refs (persona_id, status);

ALTER TABLE public.persona_external_refs ENABLE ROW LEVEL SECURITY;
