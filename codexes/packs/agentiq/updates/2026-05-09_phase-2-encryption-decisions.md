# Phase 2 — Storage Encryption Decisions

**Date:** 2026-05-09
**Status:** Locked. Phase 2.1 (schema migration) and Phase 2.2 (encryption library) ship in the same session as this doc.
**Owner:** spine team
**Plan reference:** `2026-05-05_unified-identity-content-access-foundation-plan.md` §Phase 2

---

## What Phase 2 closes

The cryptographic-fallback gap: **gated content (states C and D) is currently stored unencrypted on Supabase Storage** and the raw URL is handed to the browser. Anyone who can read the network response can copy the URL and exfiltrate the bytes regardless of the entitlement gate.

Phase 2 makes the gate cryptographic — every gated payload byte returned to the browser passes through a server-side decrypt after a successful `evaluateAccess`.

---

## Decisions locked at kickoff

### 1. Cipher

**AES-256-GCM** with:
- 12-byte random IV per object
- 16-byte auth tag (GCM standard)
- Auth-tag failure throws — **no silent fallback to a different key version** (would mask tampering)

### 2. Key custody

**Env-derived (HKDF-SHA256)** — operator decision 2026-05-09.

```
Master secret (env)        CONTENT_ENCRYPTION_MASTER_KEY  — 32 random bytes, base64
Per-asset key (derived)    HKDF-SHA256(master, salt=masterId, info='aigentz-content-v1') → 32 bytes
Stored on row              encryption_iv, encryption_auth_tag, encryption_key_id ('v1')
```

**Why env-derived (not KMS):**
- Same trust boundary as existing platform secrets (PERSONA_SESSION_TOKEN_HMAC_KEY, NEXTAUTH_SECRET, FIO_SYSTEM_PRIVATE_KEY) — adding one more 32-byte secret doesn't change the threat model
- Zero infra dependency; works anywhere Node runs
- Phase 4 (TokenQube on-chain proof) moves the trust boundary off the platform entirely; env-derived is interim by design
- Free, fast (microseconds vs KMS's 50-200ms per call)

**Why not KMS:**
- The marginal security gain over env-derived is small at our scale
- Real money (~$1/month/CMK + per-decrypt fees)
- Adds AWS/Amplify operational coupling and breaks local-dev parity

KMS migration path is preserved: future `encryption_key_id` values prefixed `kms:` will route through a KMS adapter; the HKDF path remains for `v1`/`v2` rows.

### 3. Rotation strategy

Not Phase 2 work — backlog. When the time comes:
1. Generate a new master, set in env alongside `CONTENT_ENCRYPTION_MASTER_KEY` (e.g. `CONTENT_ENCRYPTION_MASTER_KEY_V2`)
2. Mark new uploads with `encryption_key_id='v2'`
3. Background job re-encrypts `v1` rows to `v2`
4. Once the count of `v1` rows hits zero, retire the v1 master from env

`hkdfSync('sha256', masterV2, salt=masterId, info='aigentz-content-v2', 32)` — `info` is versioned, so the derivation is unambiguous and old ciphertexts remain decryptable from their `encryption_key_id` row value.

### 4. Schema disambiguation (also locked)

```sql
master_content_qubes / codex_media_assets:
  wip_storage_url     text          -- Supabase WIP path; mutable; nullable
  mint_status         text          -- 'wip' | 'minted'
  content_state       text          -- 'A' | 'B' | 'C' | 'D' | 'E'
  encryption_iv       bytea         -- 12-byte GCM IV
  encryption_auth_tag bytea         -- 16-byte GCM auth tag
  encryption_key_id   text          -- 'v1' (or 'kms:...' future)
```

Backfill rule:
- `auto_drive_cid LIKE 'http%'` → state `C`, `wip_storage_url=auto_drive_cid`, `mint_status='wip'`
- Real CID (no http prefix) → state `D`, `mint_status='minted'`
- `gating_kind='free' AND encryption_iv IS NULL` → state `A`
- `gating_kind='free' AND encryption_iv IS NOT NULL` → state `B`

Migration ships in `supabase/migrations/20260510000000_phase2_storage_encryption.sql`. Idempotent — every column add uses `IF NOT EXISTS` and every backfill clause is gated on `content_state IS NULL`.

### 5. Privacy contract (unchanged from Phase 1)

- Plaintext never persists to disk on the server
- Master key never leaves the env
- Per-asset key is recomputed at read time; not cached across requests
- `encryption_iv`, `encryption_auth_tag`, `encryption_key_id` ARE public — they appear on the row, the spine reads them in unauthenticated contexts to set `content_state`. They are not secrets

---

## Operator action required before Phase 2.3 (encrypt-on-upload)

```bash
# Generate master key
openssl rand -base64 32

# Add to Amplify (and local .env.local for dev parity)
CONTENT_ENCRYPTION_MASTER_KEY=<paste output>
```

`scripts/create-env-production.js` allowlist already includes `CONTENT_ENCRYPTION_MASTER_KEY` (this commit). Adding the variable in the Amplify console will propagate it to the next deploy.

---

## Sequence (six commits, each independently shippable)

| # | Status | Commit |
|---|---|---|
| 2.0 | ✅ this doc | Decisions locked |
| 2.1 | ✅ this commit | `20260510000000_phase2_storage_encryption.sql` — schema additions + backfill |
| 2.2 | ✅ this commit | `services/content/encryption.ts` + tests (10/10 GREEN) |
| 2.3 | next | Encrypt-on-upload (`app/api/admin/codex/storage/{sign,register}/route.ts`) |
| 2.4 | next | Decryption proxy (`app/api/content/decrypt-supabase/[masterId]/route.ts`) + state-aware branching in existing pdf/video/cover proxies |
| 2.5 | next | Backfill script (encrypt legacy unencrypted Supabase content) |
| 2.6 | next | Acceptance test + final raw-URL canary |

Each subsequent commit is gated on the previous + a green `verify-spine.mjs --phase=2` run.

---

## Acceptance criteria

Phase 2 is complete when:

1. Every state-C asset's bytes-at-rest on Supabase Storage are AES-256-GCM ciphertext
2. Every gated read for state C goes through `app/api/content/decrypt-supabase/[masterId]` and a successful `evaluateAccess`
3. No raw `https://*.supabase.co/storage/...` URL appears in any client-bound JSON response for `gating_kind != 'free'`
4. `verify-spine.mjs --phase=2` passes its 6 checks (current 4 + 2 encryption-specific)
5. The legacy backfill script has been operator-triggered for production state-C rows; all such rows have `encryption_iv IS NOT NULL`

---

## What Phase 2 unblocks

- **Phase 3** — DVN policy enforcement: the decryption proxy is the natural enforcement point for DVN policy hooks
- **Phase 4a/4b** — TokenQube on-chain proof: the encryption primitive here is reused for pool-key wrapping (4a) and per-holder key wrapping (4b)
- **CLAUDE.md gated-content rule** — moves from "client-side gate + raw URL" to "server-decrypted bytes only" — the rule's enforcement mechanism, not just its policy
