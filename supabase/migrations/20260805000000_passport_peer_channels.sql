-- 20260805000000_passport_peer_channels.sql
--
-- QubeTalk Peer Exchange — Phase 1, Increment 1: personhood-bound PEER channels
-- between two INDEPENDENT principals (PRD §2a option A).
-- (PRD: codexes/packs/agentiq/updates/2026-07-20_prd-qubetalk-peer-exchange.md)
--
-- Distinct from the existing tables (deliberately, no collision, no fork):
--   * qubetalk_channels           — tenant/agent-runtime messaging (qubetalkPersistence)
--   * passport_qubetalk_channels  — holder <-> their OWN delegated persona (delegation)
-- A peer channel is two SOVEREIGN principals with symmetric standing.
--
-- Keyed by Polity Public References (personaPublicRef — sha256/16-hex, T2-safe),
-- NOT persona UUIDs: the channel creator only ever holds the COUNTERPARTY's
-- public reference, never their raw persona UUID (T0). This is the concrete
-- reason a peer channel cannot reuse the UUID-keyed delegation table.
--
-- RLS is enabled with NO permissive policies: reads/writes go only through the
-- spine-authed service-role routes under /api/qubetalk/peer-channels, which
-- enforce principal membership in code (a caller sees a channel iff their own
-- derived public ref equals one of the channel's principal refs). Mirrors the
-- deny-all + service-write half of the existing passport pattern.

CREATE TABLE IF NOT EXISTS public.passport_peer_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  principal_a_ref text NOT NULL,   -- Polity Public Reference (T2-safe)
  principal_b_ref text NOT NULL,   -- Polity Public Reference (T2-safe)
  created_by_ref  text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Order-independent identity of the principal pair: (a,b) and (b,a) collapse.
  pair_key text GENERATED ALWAYS AS (
    CASE WHEN principal_a_ref <= principal_b_ref
      THEN principal_a_ref || ':' || principal_b_ref
      ELSE principal_b_ref || ':' || principal_a_ref END
  ) STORED
);
CREATE UNIQUE INDEX IF NOT EXISTS passport_peer_channels_pair_uidx
  ON public.passport_peer_channels (pair_key);
CREATE INDEX IF NOT EXISTS passport_peer_channels_a_idx ON public.passport_peer_channels (principal_a_ref);
CREATE INDEX IF NOT EXISTS passport_peer_channels_b_idx ON public.passport_peer_channels (principal_b_ref);

CREATE TABLE IF NOT EXISTS public.passport_peer_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.passport_peer_channels (id) ON DELETE CASCADE,
  sender_ref text NOT NULL,
  type text NOT NULL DEFAULT 'message',
  body text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS passport_peer_messages_channel_idx
  ON public.passport_peer_messages (channel_id, created_at DESC);

ALTER TABLE public.passport_peer_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passport_peer_messages ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.passport_peer_channels IS
  'QubeTalk peer channels between two sovereign principals, keyed by Polity Public References (T2-safe). Access via spine-authed service-role routes only (deny-all RLS).';
