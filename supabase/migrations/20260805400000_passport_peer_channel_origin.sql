-- 20260805400000_passport_peer_channel_origin.sql
--
-- QubeTalk Peer Exchange — channel origin context (for the filtered Lab view).
--
-- The Locker is the CANONICAL QubeTalk inbox (all channels). The Laboratory
-- shows a FILTERED research view (Aletheon 2026-07-21): channels born from a
-- research-lab context. `origin_domain` records the access domain that opened a
-- channel (e.g. 'research-lab' for a channel auto-opened by a research-partner
-- invite); NULL for a manually-opened peer channel. Both surfaces resolve to the
-- SAME channel/message/receipt store — this is a filter, never a separate inbox.
--
-- Additive + idempotent.

ALTER TABLE public.passport_peer_channels ADD COLUMN IF NOT EXISTS origin_domain text;
CREATE INDEX IF NOT EXISTS passport_peer_channels_origin_idx ON public.passport_peer_channels (origin_domain);
