-- 20260805100000_passport_peer_shared_artifacts.sql
--
-- QubeTalk Peer Exchange — Phase 1, Increment 2a: artifact SHARE (reference +
-- rights envelope) over a peer channel.
-- (PRD: codexes/packs/agentiq/updates/2026-07-20_prd-qubetalk-peer-exchange.md §6)
--
-- A shared artifact is a REFERENCE (type + platform id + title + optional
-- location) plus a rights envelope — NOT a copy of bytes. Materialising a shared
-- artifact into the recipient's locker (passport_locker_items, an encrypted
-- Walrus vault) is a separate increment (2b) that reuses the existing locker
-- pipeline; it never bypasses that pipeline's encryption.
--
-- Keyed to the peer channel (which is itself keyed by Polity Public References).
-- Deny-all RLS; access only via the spine-authed service-role routes under
-- /api/qubetalk/peer-channels, which enforce channel membership in code.

CREATE TABLE IF NOT EXISTS public.passport_peer_shared_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.passport_peer_channels (id) ON DELETE CASCADE,
  shared_by_ref text NOT NULL,               -- Polity Public Reference of the sharer
  artifact_type text NOT NULL,               -- report | experiment_record | document | iqube | canonical_plate | invariant_collection | other
  artifact_id   text NOT NULL,               -- the platform id/ref of the artifact
  title text NOT NULL DEFAULT '',
  location_ref text,                         -- optional: content hash / report scope:version / in-app viewer ref (never a raw gated URL)
  relationship text NOT NULL DEFAULT 'artifact_share'
    CHECK (relationship IN (
      'artifact_share', 'submitted_for_review', 'responds_to', 'reviews',
      'revises', 'supersedes', 'annotates', 'accepts', 'rejects'
    )),
  rights jsonb NOT NULL DEFAULT '{}'::jsonb,  -- rights envelope (PRD §6)
  created_at timestamptz NOT NULL DEFAULT now(),
  opened_at timestamptz,                      -- set when the recipient opens (Increment 3 receipt)
  copied_to_locker_at timestamptz             -- set when materialised into the recipient's locker (2b)
);
CREATE INDEX IF NOT EXISTS passport_peer_shared_artifacts_channel_idx
  ON public.passport_peer_shared_artifacts (channel_id, created_at DESC);

ALTER TABLE public.passport_peer_shared_artifacts ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.passport_peer_shared_artifacts IS
  'QubeTalk peer artifact shares — a reference + rights envelope attached to a peer channel. Not a byte copy; locker materialisation is a separate pipeline.';
