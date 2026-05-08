# Phase 1 IAM Spine — Closure

**Date:** 2026-05-08
**Branch:** `claude/blockchain-identity-ai-foundation-lEyk2` (auto-merging to dev)
**Status:** **Phase 1 closed.** Spine shipped, validated, and load-bearing on dev-beta.aigentz.me.

---

## What landed

Phase 1 of the unified identity-content-access foundation plan (`updates/2026-05-05_unified-identity-content-access-foundation-plan.md`) is now live and empirically validated.

### Server-side spine (Phase 0 → 1.3)

| Layer | File | Role |
|---|---|---|
| Type contracts | `types/access.ts` | `ActivePersonaContext` (T0), `ActivePersonaSurface` (T1), `CohortAliasCommitment` (T2), `ContentAccessDescriptor`, `AccessDecision`, `AccessAction` union |
| T0 resolver | `services/identity/getActivePersona.ts` | Composes `personaRepo.getCallerIdentityContext` + `multiEmailIdentity.getMergedLinkedAuthProfileIds` + `crm_admin_roles` lookup with canonical-id fallback chain |
| T1 token | `services/identity/personaSessionToken.ts` | HMAC-SHA256-signed envelope; rotates on persona switch; falls back from `PERSONA_SESSION_TOKEN_HMAC_KEY` to `NEXTAUTH_SECRET` to dev key |
| Content descriptor | `services/content/getContentDescriptor.ts` | Builds `ContentAccessDescriptor` from `master_content_qubes` / `codex_media_assets` / `iq_blak_qubes.cid` fallback chain; uses timeout-guarded `getSupabaseServer` |
| Decision evaluator | `services/access/evaluateAccess.ts` | Single gate; composes `userOwnsAsset` + `policyResolvers`; returns `AccessDecision` with alias-anchored receipt handle |
| Policy resolvers | `services/access/policyResolvers.ts` | Sync-vs-async receipt mode; cartridge-flag credential matcher; external-verifier classifier |
| Debug bypass (TEMPORARY) | `services/access/debugBypass.ts` | Hardcoded ON for the three debug endpoints; tracked as plan §11.e for retirement |

### Public-facing endpoints

| Endpoint | Auth | Role |
|---|---|---|
| `GET /api/wallet/active-persona` | Bearer JWT required | Returns `ActivePersonaSurface` (T1) — used by thin clients (Lovable / metame.live) and internal hooks |
| `GET /api/access/evaluate?cid=…&action=…` | Bearer JWT required | Production access check; minimal payload `{allow, reason, deliveryMode}` |
| `GET /api/access/inspect?cid=…&action=…` | Bypass-permitted | Debug-flavored; verbose response with descriptor + persona summary + nearby suggestions on miss |
| `GET /api/access/whoami` | Bypass-permitted | Returns full T0 ActivePersonaContext for the calling operator's own session — used to debug admin-resolution mismatches |
| `GET /api/access/list-assets?prefix=…` | Bypass-permitted (admin gate) | Browse seeded master + asset catalog |
| `GET /access-inspect` | Bypass-permitted | Operator debug page with browse panel + inspect form + DevTools one-liner |

### Client-side helpers

| File | Role |
|---|---|
| `services/access/spineGateClient.ts` | `checkSpineDecision()`, `isSpineOwned()` for surface code |
| `app/hooks/useActivePersona.ts` | T1 surface state hook; auto-refreshes on persona switch + visibility-change |

### Consumer migrations (Phase 1.4)

| Surface | Mode | Commit |
|---|---|---|
| `/api/content/pdf-page/[cid]` | shadow → enforce | `fb516e6` |
| `/api/content/cover/[cid]` | shadow → enforce | `4769e47` |
| `/api/content/video/[cid]` | shadow → enforce | `2d888a2` |
| `/api/content/pdf/[cid]` | shadow → enforce | `b0daee6` |
| `SmartContentActionContext` `'buy'` guard | active (fail-open) | `e109edf` |
| `RemixDialog` source-ownership banner | informational | `db71832` |
| `KnytTab` spine cross-check | shadow-log | `a73bd30` |

### Cross-platform integration

| Component | Behaviour |
|---|---|
| `app/contexts/PersonaContext.tsx` | `setActivePersonaId` broadcasts `aa-persona-change-v1` to child iframes AND parent window — thin clients (metame.live) now receive persona-switch events |
| `useCodexEmbedAuthBridge` | Authoritative isAdmin via `/api/wallet/active-persona` instead of email-string heuristic |
| `app/(shell)/codex/viewer/page.tsx` | Persona resolver prefers `ctxPersonaId` (PersonaContext) over `useSupabaseSessionPersonas` first-human |
| `SmartWalletDrawer.tsx` | Dropdown render uses canonical `ctxActivePersonaId`, not stale `walletNode.personaContext.activePersonaId` |
| `MetaMeRuntimeClient.tsx` | `SIGNED_OUT` no longer wipes localStorage (closes hourly token-refresh-failure regression) |

### Build / config

| File | Change |
|---|---|
| `scripts/create-env-production.js` | Added `PERSONA_SESSION_TOKEN_HMAC_KEY` + `NEXTAUTH_SECRET` to env allowlist (CLAUDE.md required step that I missed initially) |
| `scripts/verify-spine.mjs` | Live integration tester. Supports `JWT=`, `--personaId`, `--owned`, `--unowned`, `--free`, `--action`, `--host`. Surfaces error-body hints inline when active-persona returns 5xx. |
| `tests/access-spine.test.ts` | 25 vitest assertions across personaSessionToken / policyResolvers / evaluateAccess decision matrix / debugBypass / privacy contract. Includes a canary test that JSON.stringify-ing AccessDecision never surfaces T0 strings. |

### Plan doc revisions

`updates/2026-05-05_unified-identity-content-access-foundation-plan.md` is now at v8. All §11 operator decisions locked. Backlog rows accumulated:

- §11.a — kybe_DiD surface activation (deferred until World ID adapter)
- §11.b — LayerZero + ICP cross-chain bridging confirmed; primary-only mint
- §11.c — subpoena-resistant T1→T0 (zero-knowledge session resolution)
- §11.d — bounded-delegation agent identifiability floor from operator
- §11.e — retire `ACCESS_DEBUG_OPEN` debug-endpoint bypass; replace with `cartridgeFlags.canInspectAccess` permission
- §11.f — proper content-preview affordances (replace assumed "GN free preview")

---

## Validation

### Local unit tests

```bash
npm test tests/access-spine.test.ts
# 25/25 GREEN in <1s
```

Test groups:
1. `personaSessionToken` (6) — issue/verify roundtrip, tampering rejection, expiry, malformed input, cross-key rejection, query+header source resolution
2. `policyResolvers` (4) — sync-receipt action set, async read-set, cartridge-flag matching, external-verifier classification
3. `evaluateAccess` (10) — full decision matrix (states A/B/C/D/E × free/payment/credential × owned/unowned/admin)
4. `debugBypass` (2) — TEMPORARY DEBUG state assertion + sentinel id assertion
5. Privacy contract (2) — `ActivePersonaContext` carries T0; `AccessDecision` JSON contains zero T0 canary strings

### Live integration

```bash
JWT=<jwt> node scripts/verify-spine.mjs --personaId <uuid>
# 4/4 GREEN on dev-beta with --personaId set
```

```
whoami         /api/access/whoami           ... PASS (bypassed=false admin=true partner=false ...)
list-assets    /api/access/list-assets      ... PASS (10 masters, 10 assets)
privacy guard  T0 leak check                ... PASS (no T0 fields in surface)
unowned asset  mk_ep01_print_rare           ... PASS (DENY/payment-required ...)
```

### Operator-validated behaviour

- KNYT cartridge inside metame.live (thin client) reflects admin-gated tab visibility when admin persona is active ✓
- Wallet drawer dropdown updates the rendered handle/header on persona switch ✓
- `/codex/viewer` cartridge persona resolution honours user choice (no longer overridden by session-list first-human) ✓
- Persona switch persists across hourly token-refresh failures (closure-stale resolver bug fixed) ✓
- Admin role resolution via canonical authProfileId + linked profiles + email-alias fallback works after orphaned admin-row SQL fix ✓

---

## What's next

Phase 1 is structurally complete. Forward work is offered as discrete chunks:

| | What | Cost | Why |
|---|---|---|---|
| **a)** | Resolver fourth-fallback by `kybe_did = caller.email` | ~10 lines | Catches future admin-merge orphans automatically |
| **b)** | Housekeeping migration: repoint `@linked.agentiq.local` orphaned admin rows at canonical profiles | one migration | Cleans up table state |
| **c)** | Server-side persona "last-active" memory column | DB col + write-on-switch + read-on-resolve | Closes the spine's "no persona context → first-by-created_at" guess hole when a JWT-only request arrives |
| **d)** | Phase 5 §11.e — retire `ACCESS_DEBUG_OPEN` bypass; replace with `cartridgeFlags.canInspectAccess` permission | medium | Closes the only remaining unauth path on debug endpoints |
| **e)** | Phase 2 — Supabase WIP encryption parity (encrypt-on-upload + decrypt-supabase-proxy) | 2 weeks | Closes the cryptographic fallback gap; makes any gated payload encrypted at rest regardless of storage backend |
| **f)** | Phase 3 — DVN policy hook + alias-anchored receipts | 1 week | Replaces `__phase1_pending_alias__` placeholder with live cohort aliases via Escrow + RQH + FBC canisters |
| **g)** | Phase 4a — TokenQube on-chain proof for state D (pool/streaming) | 2 weeks | Develop now, activate post-alpha |
| **h)** | Phase 4b — Sovereign TokenQube + per-holder ciphertext for state E | 2 weeks | Develop now, activate post-alpha |
| **i)** | §11.f content-preview affordances (operator-editable preview windows for first N pages / first 30–60s) | medium | Replace the assumed-but-never-implemented "GN free preview" with proper preview affordances |

Recommendation: a → c → b is the small-wins close-out (persona-resolution hardening trio). Phase 2–4 are big enough to warrant their own focused threads.

---

## Files

| Doc | Purpose |
|---|---|
| `updates/2026-05-05_unified-identity-content-access-foundation-plan.md` | Foundation plan v8 (registered in col_architecture) |
| `updates/2026-05-07_thin-client-active-persona-integration.md` | Lovable / thin-client integration contract |
| `items/IQUBE_IDENTITY_SOVEREIGNTY_ARCHITECTURE.md` | Engineering reference (now includes Phase 1 spine runtime layer) |
| `items/AIGENT_DIDQUBE_IDENTITY_UPGRADE_NOTE.md` | Aigent identity model with §11.d delegation pointer |
| `items/ALPHA_BUILD_PLAN.md` | Alpha build plan (Phase 1 IAM milestone added 2026-05-08) |
| `items/ALPHA_PROGRAM_OVERVIEW.md` | Alpha program overview (Phase 1 IAM milestone added 2026-05-08) |
| AgentiQ OS pack: `items/identity-sovereignty.md` | Public-facing dev doc (now includes thin-client integration cookbook) |

---

## Acknowledgments

This thread closed several long-standing platform bugs that the Phase 1 spine surfaced:

- **Persona stuck on anonym@knyt** — multi-stage fix across `MetaMeRuntimeClient` (closure-stale resolver) + `SmartWalletDrawer` (stale walletNode preference) + `/codex/viewer` page (session-list first-human override) + `personaService.resolveCurrentPersona` (race guard + ASC ordering)
- **Admin role orphaned by email canonicalisation** — operator manually re-pointed the row at the canonical profile; resolver hardening via fourth-fallback (offer (a) above) keeps it from recurring
- **`createClient` direct-import 504 cascades** — five spine routes migrated to `getSupabaseServer` 8s-timeout-guarded factory; remaining eight pre-spine routes flagged in CLAUDE.md backlog
- **Embed bridge admin-detect heuristic** — replaced UUID-vs-email-string-substring guess with authoritative `/api/wallet/active-persona` fetch
- **Env allowlist missing the new HMAC key** — CLAUDE.md `scripts/create-env-production.js` checklist item; updated alongside the route
