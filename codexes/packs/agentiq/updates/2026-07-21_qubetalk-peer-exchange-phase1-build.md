# QubeTalk Peer Exchange — Phase 1 build (Increments 1–3)

**Date:** 2026-07-21
**Branch:** `claude/agentiq-onboarding-docs-jrbeha`
**PRD:** `codexes/packs/agentiq/updates/2026-07-20_prd-qubetalk-peer-exchange.md`

Personhood-bound peer messaging + locker sharing between two **independent**
principals — a new surface distinct from the tenant `qubetalk_channels` and the
holder↔delegate `passport_qubetalk_channels` (PRD §2a option A). Every channel is
keyed by the two principals' **Polity Public References** (`personaPublicRef` —
sha256/16, T2-safe); the creator only ever holds the counterparty's public
reference, never a raw persona UUID (the concrete reason it cannot reuse the
UUID-keyed delegation table).

## What shipped

### Increment 1 — channel + message spine
- `supabase/migrations/20260805000000_passport_peer_channels.sql` —
  `passport_peer_channels` (`principal_a_ref` / `principal_b_ref` public refs,
  `created_by_ref`, `status`, generated `pair_key` UNIQUE) + `passport_peer_messages`;
  deny-all RLS (service-role routes enforce principal membership in code).
- `services/qubetalk/peerChannel.ts` — `createOrGetChannel` (idempotent per
  unordered pair), `listChannelsForCaller`, `postMessage`, `listMessages`,
  `callerPublicRef`. Phase-1 message types are human-only
  (`message | question | response | acknowledgement | introduction`).
- Routes under `app/api/qubetalk/peer-channels/…` (spine-authed).

### Increment 2a — artifact share (reference + rights envelope)
- `supabase/migrations/20260805100000_passport_peer_shared_artifacts.sql` —
  `passport_peer_shared_artifacts` (artifact reference + `rights` jsonb +
  `opened_at` / `copied_to_locker_at`).
- `shareArtifact` / `listSharedArtifacts` — share a **reference** (not bytes),
  with a conservative rights envelope (`normalizeRights` honours only explicit
  booleans; default = view-only, everything else off).

### Increment 2b — copy to recipient locker
- `services/passport/lockerItems.ts` — `addLockerItemForPersona` (AES-256-GCM →
  `publishLockerItem` Sui+Walrus rail → `passport_locker_items`; holder
  commitment = public ref). Reuses the exact encryption+storage path the locker
  upload route runs inline, rather than duplicating crypto.
- `copyToLocker` — **recipient-pull** materialisation gated on
  `rights.copyToLocker`. Only the counterparty (never the sharer) may copy, into
  their own vault. What lands is a **provenance manifest** of the accepted share
  (channel, sharer ref, artifact ref, granted rights) — not the artifact bytes,
  so gated-content exposure rules are never bypassed. Idempotent via
  `copied_to_locker_at`.

### Increment 3 — consequential receipts (this build)
Three new **DVN-anchorable** action types record the consequential peer-exchange
acts. Added to both `ActivityActionType` (`services/receipts/activityReceiptService.ts`)
and `ANCHORABLE_ACTION_TYPES` (`services/dvn/activityReceiptDvnPipeline.ts`, the
one permitted unilateral change to the protected DVN pipeline):

| Action type | Actor | Fires on |
|---|---|---|
| `qubetalk_artifact_shared` | sharer | `shareArtifact` success |
| `qubetalk_artifact_opened` | recipient | first `markArtifactOpened` (route: `…/open`) |
| `qubetalk_artifact_copied` | recipient | `copyToLocker` success |

**Privacy contract.** The receipt + its DVN payload carry ONLY T2-safe
references: the caller's persona is hashed by the receipt/DVN layer
(`hashPersonaRef`), the counterparty appears as its Polity Public Reference, and
the channel + artifact appear as `peerCommitment(...)` — a namespaced sha256/16
commitment (mirrors the HMS `hms:locker:<id>` discipline). **No raw UUIDs** enter
chain-bound data. Receipt writes are best-effort (a receipt failure never breaks
the underlying peer act). Messages stay local (low-value; no receipt).

Consequential-receipt route: `POST …/artifacts/[artifactId]/open` +
`POST …/artifacts/[artifactId]/copy-to-locker`.

### Increment 4 — minimal UI
- `components/composer/QubeTalkInboxTab.tsx` — the inbox surface: shows the
  caller's own Polity Public Reference (the handle to hand a counterparty), opens
  a channel by counterparty reference, lists channels/messages/shared artifacts,
  posts human messages, and (recipient-side) **Open** / **Copy to locker** an
  artifact (copy shown only when `rights.copyToLocker` was granted and it isn't
  already in the locker). Every call goes through `personaFetch` (spine-authed).
- Exported `ShareViaQubeTalkButton` — a compact "Share via QubeTalk" affordance
  (popover: pick/open a channel, choose rights, share). Reference-only — no bytes
  leave the app (gated-content discipline).
- Mounted in `InvariantExperimentLab` under a new **Exchange** section
  (admin-gated in Phase 1, same gating as Outputs). The report tab
  (`ExperimentReportTab`) now carries the **Share via QubeTalk** button, sharing
  the report's identity (canonical `contentHash` when present) as a reference —
  consistent with the report's existing copy-only confidentiality model.

## Canary
`tests/qubetalk-peer-channel.test.ts` pins the security-relevant pure helpers:
`isPublicRefLike` rejects a persona UUID (T0-leak guard); `peerPairKey` is
order-independent; Phase-1 admits only human message types; `normalizeRights` is
conservative (only explicit booleans honoured); copy-to-locker is default-denied
unless `copyToLocker` is explicitly granted; `peerCommitment` is a deterministic,
one-way, namespaced 16-hex commitment that never contains the raw id.

## Operator action — run in the Supabase SQL editor
Both migrations are additive; apply once (Increment 1 + 2a tables):

```sql
-- 20260805000000_passport_peer_channels.sql
-- 20260805100000_passport_peer_shared_artifacts.sql
```
(Confirmed applied 2026-07-21.)

## Deferred (Phase 2+)
- Handle resolver: counterparty addressed by `persona-name@domain` rather than a
  raw public ref; invite→accept→channel reusing the passport invitation/claim
  flow (once a user claims a passport, a persona is assigned; the invitee's
  persona rides the invite, and accepting the invite also accepts the channel).
- Broaden the inbox beyond admin-gating to participants (Phase 1 mounts it
  admin-only under the lab's Exchange section).
- Byte materialisation of copied artifacts (currently manifest-only).
- Agent-to-agent channels (Phase 3).
