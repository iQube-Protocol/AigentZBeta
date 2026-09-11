-- 20260831000000_passport_native_first_connection.sql
--
-- PRD-PAG-001 Amendment A — first-connection closure (operator ruling,
-- 2026-07-28). Two independent additions:
--
-- 1. The MISSING `address_fingerprint` column on `wallet_alias_commitments`.
--    `services/identity/passportPrincipal.ts` (and `walletAliasService.ts`'s
--    own `buildAddressFingerprint`, whose header says "Requires the
--    address_fingerprint column ... see SQL migration") have queried and
--    computed this value since 2026-07-26, but no migration ever added the
--    column. Every wallet-bound `resolvePassportPrincipal` lookup has
--    therefore been silently failing closed with 'unavailable' in any
--    environment where this migration had not separately been hand-run —
--    Passport-native access was broken for EVERY citizen, bound wallet or
--    not, not only the first-connection case this migration exists to fix.
--    Fixing it here, additively, rather than filing it as a separate ticket,
--    because the reconciliation logic below writes this same column and
--    would otherwise write into a column that doesn't exist.
--
-- 2. `passport_pending_auth` — the short-lived, single-use transaction that
--    sits BETWEEN a verified Passport proof and a minted session, so persona
--    selection can happen as its own explicit step (§A.3.4: "... → persona /
--    default operating context → session") instead of being decided for the
--    citizen by getActivePersona's post-session fallback. Same discipline as
--    passport_connection_challenges: deny-all RLS, service-role only, single-
--    use via a conditional UPDATE, never keyed by personaId/authProfileId (T0
--    fields stay OFF this row entirely — see the column comments below for
--    exactly which fields are T0-internal-but-server-only vs what may never
--    appear on it at all).

-- ─── 1. address_fingerprint ─────────────────────────────────────────────────

ALTER TABLE public.wallet_alias_commitments
  ADD COLUMN IF NOT EXISTS address_fingerprint text;

COMMENT ON COLUMN public.wallet_alias_commitments.address_fingerprint IS
  'HMAC-SHA256("fp|chain|address"), keyed by WALLET_ALIAS_HMAC_KEY (walletAliasService.buildAddressFingerprint). A second, differently-prefixed hash from alias_commitment so the two cannot be correlated. Reverse-lookupable: given a proven wallet address, resolvePassportPrincipal finds its binding WITHOUT knowing which persona/root registered it first.';

-- One ACTIVE binding per wallet. Two live roots claiming the same address
-- is exactly the ambiguity resolvePassportPrincipal already refuses to
-- silently pick between (`rootIds.length > 1`) — the constraint makes that
-- state unreachable at the write instead of merely detected at the read.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_wac_address_fingerprint_active
  ON public.wallet_alias_commitments (address_fingerprint)
  WHERE status = 'active' AND address_fingerprint IS NOT NULL;

-- ─── 2. passport_pending_auth ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.passport_pending_auth (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- sha256 of the raw transaction token. The raw token is returned to the
  -- client ONCE (in the /proof response) and never stored — same discipline
  -- as passport_connection_challenges.nonce_hash.
  transaction_token_hash text NOT NULL UNIQUE,

  -- The resolved constitutional principal this transaction speaks for.
  -- T0 — server-internal FKs. This row carries deny-all RLS (below) and is
  -- read only by service-role server code, never by a client; these values
  -- are the WHOLE POINT of the transaction (it exists to let /finalize
  -- resolve a session without re-walking the lineage), but they never
  -- serialise into any response this table's own routes send to a browser.
  kybe_identity_id uuid NOT NULL REFERENCES public.kybe_identity(id) ON DELETE CASCADE,
  root_identity_id uuid NOT NULL REFERENCES public.root_identity(id) ON DELETE CASCADE,
  auth_user_id uuid NOT NULL,

  -- What established this transaction. Recorded for the SessionQube receipt
  -- (ruling 5) — never re-derived, never guessed after the fact.
  assurance_level text NOT NULL
    CHECK (assurance_level IN ('wallet_binding', 'wallet_binding+world_id')),
  audience text NOT NULL,
  origin text NOT NULL,

  -- Single-use, exactly like passport_connection_challenges.consumed_at:
  -- set once by a conditional UPDATE (... WHERE consumed_at IS NULL), never
  -- by read-then-write. A replayed transaction token spends nothing twice.
  consumed_at timestamptz,

  -- Set by /finalize at the same moment as consumed_at — the chosen
  -- persona's INTERNAL id. Still T0 (never leaves the server), but recorded
  -- here so exactly one post-session self-view read (/resolved-persona) can
  -- hand the now-Bearer-authenticated citizen's OWN browser its own chosen
  -- persona id, per the owner self-view exception CLAUDE.md already carves
  -- out for Bearer-scoped self-view routes. persona_activation_consumed_at
  -- makes THAT read single-use too, so this row is spent exactly twice
  -- (once by /finalize, once by /resolved-persona) and never a third time.
  selected_persona_id uuid,
  persona_activation_consumed_at timestamptz,

  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.passport_pending_auth IS
  'PRD-PAG-001 Amendment A, first-connection closure (2026-07-28): the short-lived transaction between a verified Passport proof and a minted session, so persona selection is an explicit client act, never a post-session fallback. Single-use via conditional UPDATE. Deny-all RLS — service-role only.';
COMMENT ON COLUMN public.passport_pending_auth.transaction_token_hash IS
  'sha256 of the raw transaction token. The raw token is returned to the client exactly once and never persisted.';
COMMENT ON COLUMN public.passport_pending_auth.consumed_at IS
  'Set exactly once by /finalize''s conditional UPDATE (... WHERE consumed_at IS NULL). A second /finalize call with the same token updates zero rows and is refused.';

CREATE INDEX IF NOT EXISTS idx_passport_pending_auth_expires_at
  ON public.passport_pending_auth (expires_at)
  WHERE consumed_at IS NULL;

ALTER TABLE public.passport_pending_auth ENABLE ROW LEVEL SECURITY;
-- Deny-all: no policy is granted. Service-role only, mirroring
-- passport_connection_challenges and agent_gateway_sessions.
