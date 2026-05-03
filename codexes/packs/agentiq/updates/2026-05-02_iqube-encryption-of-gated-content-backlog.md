# iQube/blakQube Encryption of Gated Content — Backlog

**Date raised:** 2026-05-02
**Status:** backlog — not yet implemented
**Operator request:** "Let's add to the backlog devising a fallback means to ensure gated content does not get mistakenly leaked. Encrypting gated content as blakQubes and using iQubes is probably the answer. i.e. minting gated content as iQubes is the answer to having the right fallbacks in place for restricted content."

## Why this matters

The token-gating chain shipped today protects content via:
1. **Loader classification** — `services/rewards/contentGating.ts` stamps gating metadata on every Smart Content item
2. **Data-level stamping** — `master_content_qubes.gating_kind` and `codex_media_assets.gating_kind` columns make gating intent persistent on the row
3. **Gate evaluator** — `SmartTriadSurfaces.tsx` denies access for paid/credentialed content unless owned or credential met
4. **Server-side ownership resolver** — SKU-aware via `services/rewards/assetOwnership.ts`

These four layers are the policy / control plane. The user's concern: if the **bytes themselves are publicly fetchable**, all of the above is bypass-able by anyone who acquires the URL or CID.

Today's reality:
- **Auto-Drive uploads** are encrypted (AES-256-GCM via `autonomysContentService.ts`). The `encryption_alg`, `encryption_iv`, `encryption_auth_tag`, `token_qube_id`, `meta_qube_id`, `blak_qube_id` columns on `master_content_qubes` and `codex_media_assets` already carry the iQube envelope. Decryption requires the TokenQube key — operationally protected.
- **Supabase Storage uploads** (added when the Auto-Drive encrypt service was timing out) are **stored unencrypted** under public-read bucket policies. We set `encryption_iv = ''` as a sentinel. Anyone with the public URL can fetch the bytes — gating layers 1-4 above cannot prevent this for these rows.

This is the cryptographic fallback gap.

## Goal

Bring Supabase-stored gated content under the same iQube encryption envelope as Auto-Drive content so the cryptographic guarantee — "you cannot decrypt without the TokenQube" — applies regardless of storage backend.

## Suggested implementation

### Phase 1 — Encryption on upload (Supabase path)

Update `app/api/admin/codex/storage/sign/route.ts` and `app/api/admin/codex/storage/register/route.ts` to:

1. Apply the `autonomysContentService` encryption pipeline before the file reaches Supabase Storage:
   - Browser uploads file unencrypted (no change to the user flow)
   - Sign route accepts the file, encrypts it with AES-256-GCM, mints `iv` / `authTag`
   - Encrypted ciphertext is what gets PUT to Supabase Storage
2. Persist `encryption_iv`, `encryption_auth_tag`, `token_qube_id`, `meta_qube_id`, `blak_qube_id` on the row exactly as the Auto-Drive path does
3. `auto_drive_cid` continues to hold the public URL, but the bytes at that URL are ciphertext — useless without the key

For very large files (300-500 MB GN PDFs), encrypt server-side in streams to avoid memory spikes.

### Phase 2 — Decryption proxy

Create a server route `/api/content/decrypt-supabase/[cid]` that:

1. Reads the row from `master_content_qubes` / `codex_media_assets`
2. **Server-side gate check** — `userOwnsAsset(personaId, cid)` (same resolver as the loader uses)
3. If owned: fetches ciphertext from Supabase Storage URL, decrypts using TokenQube key, streams plaintext to caller
4. If not owned: 403 with structured error (`{ reason: 'payment-required' | 'credential-required', ... }`)

Replace the current 302-redirect from `/api/content/cover/[cid]`, `/api/content/pdf/[cid]`, `/api/content/video/[cid]` to Supabase URLs with a route through this decryption proxy when the row is gated. Free content continues to redirect directly (no proxy hop).

### Phase 3 — Migration of existing unencrypted Supabase content

Operator-triggerable script that walks `master_content_qubes` / `codex_media_assets` rows where:
- `auto_drive_cid` starts with `https://`
- `gating_kind IN ('payment', 'credential')`
- `encryption_iv = ''` or NULL

For each: fetch the bytes from Supabase, encrypt them, write the ciphertext back to Supabase Storage (overwriting the same path), update the row's encryption metadata. New URL stays the same; the bytes change. Existing entitlements continue to work because `auto_drive_cid` doesn't change.

### Phase 4 — Wallet-token credential gate

The `usePersonaCredentials` API stub returns no wallet-token credentials today. Once the iQube envelope ships and the wallet service can verify on-chain ownership, this layer activates the second arm of credential gates (token-holder access).

## Why iQubes are the right primitive

- **TokenQube** holds the symmetric content key, wrapped via the platform's KMS hierarchy. Per-asset key rotation is possible.
- **MetaQube** carries policy metadata (gating kind, credential, price, audit trail). Co-located with the encrypted payload's pointer.
- **BlakQube** holds the encrypted payload reference (CID or storage URL) plus integrity hash. The integrity hash means tampering with the storage backend (e.g. someone replaces the ciphertext) is detectable.

Owning an iQube triple = owning the asset. The platform never serves plaintext without first verifying ownership of the corresponding TokenQube.

## Sequencing relative to other backlog items

Logical order (smallest blast radius first):

1. **(this cycle)** Loader + data classifier + credentials API + gate evaluator — shipped 2026-05-02
2. **Phase 1 — encryption on new uploads** — closes the leak for content uploaded after the change
3. **Phase 2 — decryption proxy** — gates the server-side delivery path
4. **Phase 3 — migrate legacy unencrypted Supabase content** — closes the historical exposure
5. **Phase 4 — wallet-token credential** — light up the second credential arm

## Related files

- `services/rewards/contentGating.ts` — classifier (live)
- `services/rewards/assetOwnership.ts` — ownership resolver (live)
- `app/api/persona/credentials/route.ts` — credentials API (live)
- `services/rewards/assetOwnership.ts` (extension) — `userOwnsAsset` server resolver
- `server/services/autonomysContentService.ts` — existing encryption pipeline (Auto-Drive)
- `app/api/admin/codex/storage/sign/route.ts` — Supabase upload sign route (encrypt entry point)
- `app/api/admin/codex/storage/register/route.ts` — Supabase upload register route (metadata persist)
- `app/api/content/{cover,pdf,video,pdf-pages,pdf-meta}/[cid]/route.ts` — content fetch routes (decryption proxy retrofit)
- `services/iqube/*` — existing iQube primitives (TokenQube/MetaQube/BlakQube creators)
