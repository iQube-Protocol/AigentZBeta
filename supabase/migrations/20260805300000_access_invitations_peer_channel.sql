-- 20260805300000_access_invitations_peer_channel.sql
--
-- QubeTalk Peer Exchange — invite → auto-channel (Phase 2).
--
-- When a steward/issuer creates an access invitation (a `pinv-…` code) for a
-- research partner, they may opt to OPEN A QUBETALK PEER CHANNEL with the
-- invitee automatically the moment the invitee claims. At invite time the
-- invitee has no persona yet (no public reference to key a channel), so the
-- channel cannot be created then; instead this flag rides the invitation and the
-- claim handler creates the channel once BOTH personas are known (issuer from
-- the invitation, claimant from the claim). The issuer can then message and send
-- materials immediately — the channel is waiting the moment the partner joins.
--
-- Additive + idempotent.

ALTER TABLE public.access_invitations ADD COLUMN IF NOT EXISTS open_peer_channel boolean NOT NULL DEFAULT false;
