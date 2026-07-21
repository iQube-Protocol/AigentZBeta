-- QubeTalk Peer Exchange — per-side channel labels (nicknames).
--
-- A user needs to distinguish counterparties by NAME, not by 16-hex public
-- reference, especially with several channels open. Each principal sets their
-- OWN private label for a channel (what THEY call the counterparty); the label
-- is visible only to the side that set it. It never enters receipts, DVN
-- payloads, or chain records (those use the public reference), so it is not a
-- T0/T2 concern — it is local, peer-to-peer, user-controlled naming.
--
-- principal_a_label = the label principal A set for this channel (A's name for B)
-- principal_b_label = the label principal B set for this channel (B's name for A)
--
-- Idempotent + additive.

ALTER TABLE public.passport_peer_channels ADD COLUMN IF NOT EXISTS principal_a_label text;
ALTER TABLE public.passport_peer_channels ADD COLUMN IF NOT EXISTS principal_b_label text;
