# Spine — Deferred Workplan (Post-Phase-3)

**Date:** 2026-05-10
**Status:** Phase 1–3 closed; this doc captures everything carried over for later. Operator instruction: defer until pulled by a concrete use case or ops requirement.
**Predecessors:**
- `2026-05-08_phase-1-iam-spine-closure.md`
- `2026-05-09_phase-2-encryption-decisions.md`
- `2026-05-10_phase-3-closure.md`

---

## TL;DR

Phase 1–3 closed the spine end-to-end:
- Identity SoT live (Phase 1)
- Storage encryption parity live (Phase 2)
- Alias-anchored receipts + on-chain submission live (Phase 3)

Everything below is **deferred work**. None of it blocks the KNYT rep/rewards/tasks workstream that's now active. Pull items into a session only when:
1. A concrete use case demands them, OR
2. They become a stability / cost / privacy issue in production

---

## Phase 4 — TokenQube on-chain ownership proof

**Pull when:** sovereign or pool-token-gated content needs to ship, OR a holder needs verifiable on-chain proof of access (vs the current entitlement-table check).

### 4a — Pool TokenQube + shared-key streaming

**Outcome:** state-D content (gated canonical pool) is gated by an on-chain ownership proof against any pool TokenQube. Pool tokens are minted at entitlement grant (per plan Decision §11.4); build now, activate post-alpha (per Decision §11.7).

**Surgical commits:**
- 4a.1 — Challenge / verify endpoints
  - `POST /api/access/tokenqube-challenge` — server-signed nonce bound to `(personaId, assetId, action)` with short TTL
  - `POST /api/access/tokenqube-verify` — validates signature + on-chain ownership; mints a short-lived decrypt grant
- 4a.2 — Shared-key decrypt
  - On verification, server unwraps the shared content key from the asset's wrapped-key blob (IPFS or AutoDrive sidecar)
  - Decrypts shared BlakQube on AutoDrive → streams page-image / video segment to the holder
  - Asset-keyed update semantics: operator updates produce new ciphertext + new CID under the same content key; existing pool tokens still decrypt
- 4a.3 — Mint at entitlement grant
  - Hook the existing entitlement grant flow to mint a pool TokenQube at grant time
  - Token wraps the same shared content key

**Operator decisions needed before 4a starts:**
- Pool TokenQube mint contract — which chain (Base preferred per current alpha), who deploys, mint cost subsidy?
- Wrapped-key blob storage — IPFS pin (Pinata?) vs AutoDrive sidecar?
- Wallet signing flow — existing SmartWallet challenge/verify pattern, or new dedicated TokenQube signing?

### 4b — Sovereign TokenQube + per-holder ciphertext (state E)

**Outcome:** state-E content (gated canonical sovereign) — each holder gets their own ciphertext encrypted under their own per-holder key, anchored on-chain. Highest-confidentiality tier; no shared keys.

**Surgical commits:**
- 4b.1 — Per-holder encryption envelope
  - Reuses Phase 2 encryption library for the AES-256-GCM cipher
  - Per-holder key derivation: HKDF(sovereign_master, salt=holderPubKey, info='aigentz-sovereign-v1')
- 4b.2 — Per-holder ciphertext storage
  - On mint: server encrypts the content with the per-holder key, uploads ciphertext to AutoDrive or IPFS, returns CID
  - On read: holder presents on-chain proof, server retrieves their specific ciphertext + decrypts
- 4b.3 — Revocation
  - Sovereign tokens are non-transferable by default (vs pool tokens which are transferable)
  - Revocation = invalidate the on-chain token + delete the per-holder ciphertext (operator-only flow)

**Operator decisions needed:**
- Sovereign master key custody — env-derived (cheapest, lowest-trust) vs KMS (most operator-coupled, highest-trust)?
- Per-holder ciphertext storage cost model — per-holder upload cost can be substantial; subsidy vs fee-passthrough?

---

## Phase 5 — Cleanup & retirement

**Pull when:** Phase 1–4 has been live for >30 days with no incidents, and the spine team has the bandwidth to do the cleanup pass without disrupting consumers.

### Items

- **Retire `__phase1_pending_alias__` placeholder** — `services/access/evaluateAccess.ts:buildReceiptHandle` falls back to this when `COHORT_ESCROW_SECRET` is missing. Once env stability is proven (>30 days, no missing-env incidents), remove the fallback entirely. Missing secret should hard-fail at boot, not silently degrade.

- **Retire `bootstrap-starter` route** — `app/api/wallet/personas/bootstrap-starter/route.ts` is the legacy "create a placeholder persona on first signin" path. The current canonical signup path is the FIO-mandatory PersonaSetupWizard, which doesn't call bootstrap-starter. Once the wizard has been the sole path for >30 days, drop the route + delete legacy placeholder personas.

- **Remove the `ws` polyfill in `scripts/backfill-encrypt-state-c.mjs`** — Once Node 20 lands locally, the explicit `realtime: { transport: ws }` injection can go.

- **Remove `ACCESS_DEBUG_OPEN` bypass entirely** — Currently env-gated and off by default. Once `verify-spine.mjs` has a JWT-based auth path, the bypass + the synthetic `__debug_bypass_persona__` context can be deleted entirely.

- **Drop legacy `encryption_iv = ''` empty-string sentinel** — Phase 2 introduced `encryption_iv` as base64-encoded text. Pre-Phase-2 rows used empty string as "not encrypted". Migrate those rows to NULL and update the spine's "is encrypted?" check to `IS NOT NULL` instead of `<>` ''.

---

## Phase 1–3 carry-over backlog (not Phase 4/5)

Smaller items that didn't make it into core phases. Each is operationally useful but none blocks anything live.

### Operationally important

- **Cohort directory + RQH partition seed migration** — Plan §3.0 locked 5 seed cohorts (`knyt:backers`, `knyt:alpha-investors`, `agentiq:partners`, `agentiq:developers`, `qriptopian:editors`). The cohort credential resolver works as soon as a partition exists in RQH; this seed migration creates the empty partitions so cohort:* credentials don't conservative-deny on first encounter. ~30 lines of canister-write code.

- **`verify-spine.mjs --phase=3` mode** — Extend the existing smoke gate with: (a) inspect call lands an `orchestration_events` row, (b) `actor_alias_commitment` is non-placeholder hex, (c) T0 leak canary returns 0, (d) batcher run succeeds.

- **Receipt-on-chain audit script** — `scripts/verify-receipts-on-chain.mjs` picks N random rows with `on_chain_tx_id`, calls `cross_chain_service.get_message(id)` to verify the payload matches, asserts the inscription is finalised. Deferred until the canister exposes a stable query API.

### Phase 2 follow-ups

- **Phase 2.3 v2 — streaming encrypt for >5MB admin uploads** — Currently the admin storage register route caps inline encryption at 5MB. Lift the TUS resumable upload primitive from the backfill script (commit `6835e2f`) into the admin route to handle multi-hundred-MB uploads automatically.

- **Browser-side TUS for the admin upload UI** — Same plumbing as 2.3 v2 but client-side. Eliminates the >50MB ceiling in the admin codex panel by uploading ciphertext directly via signed URL using `tus-js-client`.

### Infrastructure

- **Node 18 → 20 upgrade** — `@supabase/supabase-js` requires native WebSocket which Node 18 lacks. Several other deps also have engine warnings (vite 7, marked 16, lru-cache 11, chokidar 5, iceberg-js, tus-js-client). One-time effort to update the dev env + Amplify build runtime.

- **Env-derived → KMS migration path for content encryption** — Phase 2.0 documented the migration is non-disruptive (new uploads tagged `encryption_key_id='kms:...'`, HKDF path stays for legacy rows). Pull when the platform ops needs SOC2 / HIPAA-grade key custody.

---

## Cron schedule for the receipt batcher (shipped 2026-05-10)

The Phase 3.4 batcher is now scheduled by GitHub Actions:

```yaml
# .github/workflows/access-receipts-batcher.yml
on:
  schedule:
    - cron: '*/15 * * * *'
```

Required secret: `ADMIN_OPS_TOKEN` in repo settings (Settings → Secrets and variables → Actions). Same value as the Amplify env var.

Manual trigger: Actions → access-receipts-batcher → Run workflow.

---

## How to use this workplan

When operator pulls an item:
1. Open a fresh `claude/<session>` branch
2. Read the relevant predecessor closure doc (1, 2, or 3) for the spine context
3. Write a decisions doc in `codexes/packs/agentiq/updates/` capturing the choices for this item before touching code
4. Implement surgically; one item per session is the right scope
5. Update this workplan to mark the item shipped + cross-link the closure commit

Until then: this is the canonical record of what's deferred. New deferral items get appended here, not scattered across separate notes.
