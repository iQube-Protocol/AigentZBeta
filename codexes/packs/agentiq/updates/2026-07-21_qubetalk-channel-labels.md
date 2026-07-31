# QubeTalk Peer Exchange — channel labels (nicknames)

**Date:** 2026-07-21

Distinguishing counterparties by 16-hex Polity Public Reference is unusable with
several channels open — a user needs to name a channel by the person. This adds
a **per-side private nickname** the caller sets for a channel.

## Why it's not a T0/T2 concern
The label is **local, per-side, peer-to-peer, user-declared**. It is visible
only to the side that set it, and it **never** enters receipts, DVN payloads, or
chain records — those continue to carry only the counterparty's public reference
(the `writePeerReceipt` canary pins this). A user controls the identifiability
level of their own persona, so declaring a name they use for a peer carries no
protocol-level disclosure risk.

## What shipped
- Migration `20260805200000_passport_peer_channel_labels.sql` — additive
  `principal_a_label` / `principal_b_label` on `passport_peer_channels`. Each
  principal's label lives on their own side's column.
- `setChannelLabel(callerPersonaId, channelId, label)` — writes only the
  caller's own side column; `PeerChannel.counterpartyLabel` is resolved per
  caller. Route `PATCH /api/qubetalk/peer-channels/[channelId]` `{ label }`.
- UI (`QubeTalkInboxTab`): channel list + header show the nickname (with the
  short ref as a subtitle); a **Name / Rename** control in the channel header;
  the "Share via QubeTalk" channel picker shows names too.
- Canary: label is per-side (principal-A-vs-B column selection) and never in the
  receipt payload.

## Operator action — Supabase SQL editor
```sql
ALTER TABLE public.passport_peer_channels ADD COLUMN IF NOT EXISTS principal_a_label text;
ALTER TABLE public.passport_peer_channels ADD COLUMN IF NOT EXISTS principal_b_label text;
```

## Follow-ons (not in this change)
- **Self-declared persona handle** — a persona picks a display name the
  counterparty sees by DEFAULT (so a channel is named without the other side
  having to label it). Display precedence would be: my override label →
  counterparty's self-declared name → short ref. (This change ships the override
  layer; the self-declared layer is the complementary next step.)
- **Invite → auto-channel** — pre-create a channel as part of a research
  partner's passport invite so materials queued by the inviter are waiting the
  moment the invitee claims (Phase-2 invite integration).
- Sharper Locker copy distinguishing "share with my agent" (Agent Channels) vs
  "share with a person" (Peer Exchange).
