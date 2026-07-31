-- 20260819000000_passport_connection_challenges.sql
--
-- Passport-native access — the single-use holder-control challenge store
-- (PRD-PAG-001 Amendment A §A.4 / §A.9.2, ruled 2026-07-26, ratified same day).
--
-- WHY THIS TABLE EXISTS. The platform already has a SIWE-shaped challenge
-- builder and EVM signature verifier (services/identity/walletAliasService.ts),
-- and it is reusable. What it does NOT have is nonce CONSUMPTION: the existing
-- challenge route states plainly that "nonces are stateless — they're embedded
-- in the message", and nothing ever marks one as spent. That is acceptable for
-- its current job, because wallet-alias registration re-validates persona
-- ownership separately. It is NOT acceptable for session establishment: a
-- replayed signed challenge would mint a second session. Ruling 7 therefore
-- makes server-side single-use consumption a PREREQUISITE, not a follow-on.
--
-- THE PRE-SESSION CONSTRAINT (ruling 8). Nothing here references personaId,
-- authProfileId or didPersonaId, and nothing may be added that does. A caller
-- at challenge time has no session, so it cannot present any of them; a column
-- that asked for one would rebuild the circular dependency Amendment A exists
-- to remove. The caller is identified only by an opaque, server-issued
-- connection id. Personhood and persona are resolved AFTER holder proof
-- succeeds.
--
-- NONCE HASH, NOT NONCE. The raw nonce is returned to the caller once and never
-- stored, mirroring the hashed-bearer discipline agent_gateway_sessions already
-- uses. A leaked table therefore yields nothing replayable.
--
-- Additive and standalone: no existing table is altered, so rollback is
-- `DROP TABLE` and nothing else is affected (§A.9.3).

CREATE TABLE IF NOT EXISTS public.passport_connection_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- sha256 of the raw nonce. Unique so a duplicate issue is a hard error
  -- rather than two live challenges answering to one signature.
  nonce_hash text NOT NULL UNIQUE,

  -- Opaque, server-issued, pre-session caller handle (§A.3.4). NOT an identity:
  -- it names the in-flight connection attempt and nothing else.
  provisional_connection_id text NOT NULL,

  -- Binding. A signature is only valid for the application and origin the
  -- challenge was issued to, so a proof captured by one relying party cannot
  -- be presented to another.
  audience text NOT NULL,
  origin text NOT NULL,

  -- What the proof authorises. Kept explicit so a challenge minted for
  -- connection can never be spent on a consequential act that requires
  -- step-up (§A.6 level 3).
  requested_action text NOT NULL DEFAULT 'connect'
    CHECK (requested_action IN ('connect', 'step_up')),

  -- Optional at issue time: the caller may name the wallet it intends to sign
  -- with, but the authority is the recovered signer at verification time, never
  -- this column.
  wallet_address text,

  expires_at timestamptz NOT NULL,
  -- NULL until spent. The single-use guarantee is enforced by the conditional
  -- UPDATE in services/passport/connectionChallenge.ts, never by a read
  -- followed by a write.
  consumed_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now()
);

-- The consumption path looks up by nonce hash; the sweeper by expiry.
CREATE INDEX IF NOT EXISTS idx_passport_connection_challenges_expires_at
  ON public.passport_connection_challenges (expires_at)
  WHERE consumed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_passport_connection_challenges_connection
  ON public.passport_connection_challenges (provisional_connection_id);

-- Deny-all RLS, exactly as agent_gateway_sessions (20260806000000). Reached by
-- the service role from server routes only; no client may read or write a
-- challenge, and no policy is granted here.
ALTER TABLE public.passport_connection_challenges ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.passport_connection_challenges IS
  'Passport-native access: single-use, audience- and origin-bound holder-control challenges. Pre-session by construction — never keyed by personaId, authProfileId or didPersonaId (PRD-PAG-001 Amendment A ruling 8).';
COMMENT ON COLUMN public.passport_connection_challenges.consumed_at IS
  'Set exactly once by a conditional UPDATE (… WHERE id = $1 AND consumed_at IS NULL). A second attempt updates zero rows and the proof is rejected.';
COMMENT ON COLUMN public.passport_connection_challenges.provisional_connection_id IS
  'Opaque pre-session handle for the connection attempt. Not an identity and never derived from one.';
