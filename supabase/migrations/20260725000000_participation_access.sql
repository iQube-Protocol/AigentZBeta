-- 20260725000000_participation_access.sql
--
-- Constitutional Access Service — the shared participation data model
-- (operator + Aletheon, 2026-07-18). ONE invitation/grant mechanism for
-- every permissioned area (access domain): passport, research-lab,
-- venture-lab, metame-studio, developer-studio. Stewarded from the
-- Passport Steward tab (Participation → Steward).
--
-- Principles encoded here:
--   • Applications are participant-initiated (existing
--     polity_passport_applications remains that path — NOT replaced).
--   • Invitations are steward-initiated grants-in-waiting. The bearer code
--     is TRANSPORT, not authority: only a sha256 hash is stored; the raw
--     code is shown once at issuance.
--   • The AccessGrant is the canonical record (source: application |
--     invitation | admin), issued to the person via their persona/passport;
--     agents may do the legwork but constitutional acts (claiming,
--     delegating) remain human.
--   • Bounded bearer codes: expiry, max uses, optional intended recipient,
--     revocable before exhaustion.
--
-- Service-role access only; RLS enabled with no client policies.

CREATE TABLE IF NOT EXISTS public.access_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash text NOT NULL UNIQUE,
  access_domain text NOT NULL,
  role text NOT NULL,
  label text,
  intended_recipient text,
  max_uses int NOT NULL DEFAULT 1,
  uses int NOT NULL DEFAULT 0,
  expires_at timestamptz,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'exhausted', 'revoked', 'expired')),
  issuer_persona_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS access_invitations_domain_idx
  ON public.access_invitations (access_domain, status);

CREATE TABLE IF NOT EXISTS public.access_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id uuid NOT NULL,
  passport_id text,
  access_domain text NOT NULL,
  role text NOT NULL,
  source text NOT NULL CHECK (source IN ('application', 'invitation', 'admin')),
  source_id uuid,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
  granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  receipt_id text
);

CREATE INDEX IF NOT EXISTS access_grants_persona_idx
  ON public.access_grants (persona_id, access_domain, status);
CREATE INDEX IF NOT EXISTS access_grants_domain_idx
  ON public.access_grants (access_domain, status);

ALTER TABLE public.access_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_grants ENABLE ROW LEVEL SECURITY;
