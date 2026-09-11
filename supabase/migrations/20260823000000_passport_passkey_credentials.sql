-- 20260823000000_passport_passkey_credentials.sql
--
-- Passkey enrolment — holder-control level 2 (PRD-PAG-001 Amendment A §A.6,
-- ratified 2026-07-27). WebAuthn was genuinely unbuilt (§0.5, §9, §A.6 all
-- record it); this is the credential store plus the challenge-store extension
-- that lets the EXISTING single-use nonce store carry the WebAuthn ceremonies.
--
-- The charter's rule, verbatim: "additional passkey enrolment is optional for
-- ordinary access; cryptographic holder-control proof is not optional;
-- step-up is mandatory where consequence requires it."
--
-- T0 DISCIPLINE. The credential is bound to the auth user SERVER-SIDE
-- (auth_user_id — the same anchor bureauIdentityService and root_identity
-- use). No personaId, no authProfileId, no rootDid — a passkey belongs to the
-- HOLDER (the human principal), not to a persona, and nothing here may ever
-- appear in a client-bound or chain-bound shape. What the browser sees is the
-- WebAuthn credential id and public key it ALREADY holds (they are minted by
-- the authenticator itself) plus an opaque user handle commitment.
--
-- SINGLE-USE CHALLENGES (ruling 7). WebAuthn ceremonies reuse the SAME
-- single-use nonce store the wallet ceremonies use
-- (passport_connection_challenges + the atomic conditional-update spend in
-- services/passport/connectionChallenge.ts). A second nonce store would be
-- the parallel-implementation defect (inv.engineering.037), so this migration
-- EXTENDS the requested_action CHECK instead of minting a sibling table.
--
-- Rollback: DROP TABLE passport_passkey_credentials and restore the previous
-- CHECK. No existing row changes shape; no existing column is touched.

-- ── 1. Extend the ceremony vocabulary of the existing challenge store ──────
-- (Postgres auto-named the inline CHECK from 20260819000000.)

ALTER TABLE public.passport_connection_challenges
  DROP CONSTRAINT IF EXISTS passport_connection_challenges_requested_action_check;

ALTER TABLE public.passport_connection_challenges
  ADD CONSTRAINT passport_connection_challenges_requested_action_check
    CHECK (requested_action IN ('connect', 'step_up', 'passkey_enrol', 'passkey_auth'));

-- ── 2. The WebAuthn credential store ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.passport_passkey_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Server-side binding to the internal Supabase principal. T0 —
  -- server-internal only, never serialised to a client or a receipt.
  auth_user_id uuid NOT NULL,

  -- WebAuthn credential id (base64url) — minted by the authenticator and
  -- already known to the browser that holds it. Unique: one credential, one
  -- holder binding.
  credential_id text NOT NULL UNIQUE,

  -- COSE public key (base64url). Verification-only material — not a secret,
  -- but server-held so assertions are judged against OUR copy, never a
  -- caller-supplied key.
  public_key text NOT NULL,

  -- Signature counter, updated on every successful assertion. A counter that
  -- goes backwards is a cloned-authenticator signal; the service refuses it.
  sign_count bigint NOT NULL DEFAULT 0,

  -- Authenticator transports as reported at registration (hints for the
  -- browser's credential picker; no security weight).
  transports jsonb NOT NULL DEFAULT '[]',

  -- Whether the credential is backed up / multi-device, as attested at
  -- registration. Informational.
  backed_up boolean NOT NULL DEFAULT false,

  -- Holder-chosen label, e.g. "MacBook Touch ID". Display-only.
  friendly_name text,

  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  -- Set when the holder revokes the passkey. A revoked credential never
  -- authenticates again; the row is retained for provenance.
  revoked_at timestamptz
);

-- Authentication looks up by credential id (covered by the UNIQUE index);
-- the holder's self-view lists by auth user.
CREATE INDEX IF NOT EXISTS idx_passport_passkey_credentials_auth_user
  ON public.passport_passkey_credentials (auth_user_id)
  WHERE revoked_at IS NULL;

-- Deny-all RLS, exactly as passport_connection_challenges and
-- agent_gateway_sessions. Service-role only; no client policy is granted.
ALTER TABLE public.passport_passkey_credentials ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.passport_passkey_credentials IS
  'WebAuthn passkey credentials for Polity Passport holder-control (PRD-PAG-001 Amendment A §A.6 level 2). Bound server-side to the auth user; no persona/profile/root identifier here or anywhere client-bound. Enrolment is optional for ordinary access; step-up is mandatory where consequence requires it.';
COMMENT ON COLUMN public.passport_passkey_credentials.auth_user_id IS
  'Internal Supabase principal (T0). Server-internal only — never serialised to a client, receipt, or chain shape.';
COMMENT ON COLUMN public.passport_passkey_credentials.sign_count IS
  'Authenticator signature counter. A regression is treated as a cloned-credential signal and the assertion is refused.';
