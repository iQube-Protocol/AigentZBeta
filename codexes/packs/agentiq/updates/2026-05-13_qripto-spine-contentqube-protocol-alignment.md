# Qripto Spine — ContentQube Protocol & PersonaSpine Alignment

**Date:** 2026-05-13
**Workstream:** Identity + Access + Content unification — platform spine closure
**Status:** Landed — Phases 2 → 9.2 shipped on `dev`
**Branch:** `claude/review-session-setup-V82mB`
**Final commits on branch:** `56c255f5` (merge), `02a1d612` (Phase 9.1 + 9.2)
**Phase commits (oldest → newest):**
- `bb67913b` Phase 2 — schema + types (8 net-new ContentQube tables)
- `eaa6f383` Phase 3 — registry VIEW + `GET /api/registry/content-qube/[id]`
- `bd19049a` Phase 4 — `resolveContentQube` + `buildDisplayManifest`
- `70de5c8e` Phase 5 — DVN receipt emitter (`content_qube_dvn_receipts`)
- `897314a4` Phase 6 — KNYT pilot bridge migration
- `b5c863dd` Phase 7 — editions ledger seeding + common-rarity streaming-access
- `a2cc3d0c` Phase 7B — Base ERC-1155 / ERC-721 mint service + mint receipts
- `810dee8e` Phase 8 — wire KNYT tab components (Scrolls + Characters) to the registry
- `82088b61` Phase 9 — edition claim service + `POST /api/registry/content-qube/[id]/claim`
- `02a1d612` Phase 9.1 — T2 alias commitment piping into the claim path
- `02a1d612` Phase 9.2 — `purchaseHandler.claimContentQubeEditions` auto-fires post-grant

---

## TL;DR

The platform now has a **single coherent spine** for identity, access, content resolution, and edition issuance. The two parallel-named tracks — "PersonaSpine" (identity client) and "metaMe client protocols" (parent contract) — are best understood together as the **Qripto Spine**: the canonical chain of resolvers, gates, and receipts that every cartridge consumes. ContentQube is the first content protocol that rides this spine end-to-end. The SmartTriad (Aigent Z / Aigent C / metaMe guardian) and inter-cartridge navigation now have a load-bearing, audited path from `getActivePersona` → `evaluateAccess` → `claimEditionForPurchase` → `content_qube_dvn_receipts` with consistent T0/T1/T2 hygiene at every hop.

---

## 1. What was built this session

### Schema & registry (Phases 2 → 4)

- **8 net-new tables** under `content_qubes` namespace: `content_qubes`, `content_qube_editions`, `content_qube_dvn_receipts`, `content_qube_payment_gates`, `content_qube_creator_splits`, plus 3 supporting catalog tables.
- **`v_content_qube_registry` denormalised VIEW** with LATERAL joins for `editionSummary` and `common_count`.
- **`GET /api/registry/content-qube/[id]`** returns the resolved manifest for a single qube, persona-aware.
- **`resolveContentQube`** + **`resolveContentQubesBySeries`** — server-side access resolution, computes `persona_owns` against the active spine.
- **`buildDisplayManifest`** — renders the T1-safe payload the client uses to draw cards / tiles.

### DVN receipts (Phase 5)

- `content_qube_dvn_receipts` row written for every access/mint/transfer/creation decision against a content_qube.
- **Privacy contract enforced by construction**: `t2_alias_commitment` is the only persona handle written; `persona_id` is absent from the schema entirely.
- Complements `orchestration_events` (platform-wide) with a per-qube indexed audit/anchor stream.

### KNYT pilot bridge (Phase 6)

- Migration seeds the 13 metaKnyts episode masters + character cards into `content_qubes`, bridged via `master_qube_id` to existing `master_content_qubes` rows.
- Lets the KNYT cartridge run on the new registry without a data re-cut.

### Editions ledger (Phase 7 + 7B)

- Pre-seeds **1,860 canonical editions** per qube (18 legendary / 186 epic / 1,654 rare / 2 secret_black_rare) with `persona_id` null and `issued_at` null — awaiting claim.
- **Commons are NOT pre-seeded** — they're appended on each streaming-access purchase past edition_number 1860.
- **Phase 7B** added `services/chain/baseTokenMint.ts`:
  - `mintCanonicalEdition` (ERC-1155, commons explicitly excluded via `isCanonicalRarity` guard)
  - `mintMasterQube` (ERC-721, advances lifecycle_state to `chain_minted`)
  - Token IDs are deterministic SHA-256 hashes — same `(qubeId, n)` always produces the same on-chain id.
  - **Graceful pre-deploy**: returns `ok=true skipped='contract_unconfigured'` when env vars are absent. Read path is never blocked by missing chain wiring.
  - Mint receipts emitted to `content_qube_dvn_receipts` with `receipt_kind='mint'`.

### KNYT tab wiring (Phase 8)

- **`useContentQubeSeries`** — client React hook with module-level 3-min cache, abort-on-unmount.
- **`/api/registry/content-qube/series`** — list endpoint backing the hook.
- **`ScrollsTab`** lock/unlock icons now resolve from `persona_owns` on the registry, not heuristics.
- **`CharactersTab`** fully off mock data — renders the same persona-aware shape.

### Edition claim (Phase 9 + 9.1 + 9.2)

- **`claimEditionForPurchase(input)`** — two atomic paths:
  - **Canonical** (legendary / epic / rare / secret_black_rare): idempotency check → find lowest unissued → `UPDATE … WHERE persona_id IS NULL` (race-safe, retry once on contention).
  - **Common**: `INSERT` at `MAX(edition_number) + 1`, retry once on Postgres `23505` unique-violation.
- **`POST /api/registry/content-qube/[id]/claim`** — spine-gated, requires authenticated persona, validates rarity.
- **Phase 9.1**: T2 alias commitment is now derived from `cohortAliasService.computeAliasCommitment(personaId, cohortId, epoch)` — same logic `evaluateAccess`'s `buildReceiptHandle` uses, without the side-effect of emitting an access-decision receipt. The transfer receipt's `t2_alias_commitment` is no longer `null`.
- **Phase 9.2**: `purchaseHandler.processPurchase` now invokes `claimContentQubeEditions(personaId, assetIds, purchaseId)` after a successful entitlement grant. The handler:
  1. Queries `content_qubes` for any rows whose `master_qube_id` or `media_asset_id` matches a granted assetId.
  2. Computes the T2 alias commitment.
  3. Fires `claimEditionForPurchase` per matched qube, using `rarity` from the qube row itself.
  4. Is fire-and-forget tolerant — entitlement grant is the source of truth for "user has access"; the edition row is the registry/receipt audit overlay.

All purchase routes (`/api/purchase/complete`, `/api/cart/complete`, `/api/cart/paypal/*`) inherit edition-claim behaviour automatically.

---

## 2. The Qripto Spine — what this is now

Three previously distinct concept names converge on one spine:

| Name in earlier docs | What it actually is | Where it lives |
|---|---|---|
| **PersonaSpine** | Identity resolver + auth bearer (client + server) | `services/identity/getActivePersona.ts`, `services/identity/personaSessionToken.ts`, browser `window.__personaSpine` singleton |
| **metaMe Client Protocols** | Parent contract — postMessage protocol, `window.__metame.*` namespace, T1 surface rules | `docs/architecture/metame-client-protocols.md` |
| **Qripto Spine** *(canonical name going forward)* | The end-to-end chain: identity → access → content descriptor → receipt → claim → mint | All of the above, plus everything below |

The Qripto Spine is **one contract**, two surfaces:

```
┌────────────────────────────────────────────────────────────────────┐
│                       Qripto Spine — server                        │
│                                                                    │
│  getActivePersona(req)                  → ActivePersonaContext (T0)│
│      ↓                                                             │
│  getContentDescriptor(assetId)          → ContentAccessDescriptor  │
│      ↓                                                             │
│  evaluateAccess(persona, desc, action)  → AccessDecision           │
│      ↓                                          ↓                  │
│      ↓                                  emitDecisionReceipt        │
│      ↓                                  (orchestration_events)     │
│      ↓                                                             │
│  claimEditionForPurchase(...)           → content_qube_editions    │
│      ↓                                          ↓                  │
│      ↓                                  emitContentQubeTransfer    │
│      ↓                                  Receipt (T2 alias only)    │
│      ↓                                                             │
│  mintCanonicalEdition(...)              → Base ERC-1155 mint       │
│                                                 ↓                  │
│                                         emitContentQubeMintReceipt │
└────────────────────────────────────────────────────────────────────┘
                                  ↕
┌────────────────────────────────────────────────────────────────────┐
│                       Qripto Spine — client                        │
│                                                                    │
│  window.__personaSpine        (T1: personaSessionToken, label)     │
│  window.__metame.cartridges   (T1: cartridge presence registry)    │
│  postMessage 'aa-persona-change-v1'                                │
│  buildCodexUrl(slug, {personaId, isAdmin, isPartner, from, ...})   │
│  useContentQubeSeries(series, opts)   → T1 manifest array          │
└────────────────────────────────────────────────────────────────────┘
```

The five **MUST NEVER LEAK** fields (`personaId`, `authProfileId`, `rootDid`, `kybeAttestation`, cross-persona `fioHandle`) are stripped by construction at every hop. The canaries in `tests/persona-broadcast-handshake.test.ts` and `tests/access-spine.test.ts` enforce this for the original spine; the ContentQube schema enforces it for receipts by simply not having a `persona_id` column on `content_qube_dvn_receipts`.

---

## 3. ContentQube's place in the spine

ContentQube is the **first content protocol** that consumes every spine surface end-to-end:

| Spine surface | ContentQube consumer |
|---|---|
| `getActivePersona` | `/api/registry/content-qube/[id]` and `/series` resolve `persona_owns` against the active persona |
| `evaluateAccess` | Called from `/api/content/pdf-page/[cid]` and the streaming access paths — no fork |
| `getContentDescriptor` | `resolveContentQube` calls it via `bridgeId = master_qube_id ?? media_asset_id` |
| Spine receipts (`orchestration_events`) | `evaluateAccess` emits one per decision (unchanged) |
| ContentQube receipts (`content_qube_dvn_receipts`) | `emitContentQubeReceipt`, `…Mint…`, `…Transfer…`, `…Creation…` — per-qube indexed audit |
| `computeAliasCommitment` | T2 handle used by every ContentQube receipt; same HMAC-SHA256 as the rest of the platform |
| Browser T1 surface | `useContentQubeSeries` hook returns the same T1-safe manifest shape the wallet drawer/codex tabs expect |

What ContentQube **adds** that wasn't in the spine before:

- A **bridged asset model** (`master_qube_id` / `media_asset_id`) that lets the registry overlay descriptors built by the existing `master_content_qubes` and `media_assets` paths — without forcing a re-cut of legacy data.
- An **edition ledger** (`content_qube_editions`) with a canonical pool (1,860 pre-seeded per qube) and an append path for commons. This is the first time the platform has a per-rarity numbered edition concept on a server-side audit table.
- A **canonical on-chain bridge** (`baseTokenMint.ts`) — deterministic ERC-1155 / ERC-721 mints with mint receipts in the same DVN receipt table.

What ContentQube **does not** do (intentionally):

- Does not fork `evaluateAccess`. Does not fork `getActivePersona`. Does not introduce a new auth gate. Does not invent its own alias commitment scheme.
- Does not gate on chain mint completion — the registry is the source of truth for entitlement; the mint is an after-the-fact anchor.

---

## 4. SmartTriad alignment

The SmartTriad (Aigent Z orchestrator / Aigent C customer guide / metaMe guardian) routes through the same spine.

| Routing tier | Spine surface it consumes | Why it matters for ContentQube |
|---|---|---|
| **metaMe guardian** (top — policy veto) | `evaluateAccess` deny reasons, especially `fio-handle-required` for tx-class actions | Edition claim is a tx-class action (transfer). When FIO is missing, the guardian's deny path surfaces in the wallet drawer's `PersonaSetupWizard`. The claim still proceeds for receipt purposes because the payment already settled — but mint/transfer to chain blocks until FIO is present (Phase 9.3 hook). |
| **Cartridge lead agent** (e.g. KNYT cartridge) | `useContentQubeSeries` + `buildCodexUrl` | Cartridge tabs render the manifest, navigate via spine-aware URLs that propagate `personaId` and access flags. |
| **Aigent Z** (system orchestrator) | `orchestration_events` + NBE plans | Every access decision against a content_qube is now a routable event the orchestrator can plan against. |
| **Aigent C** (customer guide) | T1 manifest only | Never sees T0 fields; renders the same shape regardless of cartridge. |

The previous arrangement had each cartridge potentially making its own ownership checks. With the Qripto Spine and the ContentQube registry, **the SmartTriad has a single resolution path** for "does this persona own this qube? does it have access? has it been claimed? has it been minted?" — all from one spine call chain.

---

## 5. Inter-cartridge protocol — current state

The inter-cartridge URL contract (CLAUDE.md §"Inter-Cartridge Navigation — Identity Propagation") is now load-bearing for ContentQube:

```ts
buildCodexUrl("knyt-codex", {
  tab: "knyt-alpha",
  personaId,
  from: "alpha-knyt",
  fromTab: "alpha-programme",
})
```

When a persona clicks from Venture Lab α → KNYT codex, the receiving embed reads `?personaId=` and feeds it to `useContentQubeSeries`, which renders the lock/unlock state against that persona's `persona_owns` set. **No localStorage is required for correctness** — the URL param is the canonical hand-off; localStorage is only a fallback for refreshes.

This is the first time inter-cartridge navigation has a server-resolved, audit-receipted content protocol downstream. Previously, navigating across cartridges propagated identity but the receiving cartridge had to do its own ownership lookup. Now the same call (`useContentQubeSeries`) produces the same answer in every cartridge, against the same registry view.

---

## 6. End-to-end flow — what a purchase now does

A persona buying a metaKnyts rare scroll via the KNYT store now follows this complete path:

1. **Modal** (`ContentPurchaseModal`) computes USD-anchored multi-rail pricing.
2. **`POST /api/purchase/complete`** (or `/api/cart/complete`):
   - `getActivePersona(req)` → `ActivePersonaContext` (T0 server-side).
   - `purchaseHandler.processPurchase(...)`:
     - Verifies payment (EVM tx hash for `knyt_evm`, DVN balance for `knyt`, etc.).
     - Writes `purchases` row.
     - Records wallet transaction (KNYT/Q¢ rails).
     - **Grants entitlements** via `entitlementService.grantBundleEntitlements`.
     - **(NEW — Phase 9.2)** `claimContentQubeEditions(personaId, assetsToGrant, purchaseId)`:
       - Looks up matching `content_qubes` rows.
       - Computes T2 alias commitment.
       - Fires `claimEditionForPurchase` per qube → atomic canonical claim or common append.
       - `emitContentQubeTransferReceipt` writes a `transfer` row to `content_qube_dvn_receipts` with `t2_alias_commitment` set.
     - Triggers Bring-a-Knight rewards if first paid purchase.
     - Emits reputation event.
3. **Route layer** then calls `evaluateAccess(persona, descriptor, 'payment-settle')` to emit the spine's own settlement receipt in `orchestration_events`.
4. **Future (Phase 9.3+)**: `mintCanonicalEdition` is dispatched (deferred or immediate, operator's choice) to mint the ERC-1155 to the persona's wallet address.

Every step produces a receipt or a registry row keyed on T2 only. The `personaId` never leaves the server.

---

## 7. What's deferred — explicit Phase 9.3+ and Phase 10 backlog

| Item | Why deferred | Where it lands |
|---|---|---|
| **Base contract deployment** (ERC-1155 + ERC-721 + minter wallet + 4 env vars) | Operator-controlled deploy + secure key setup | `2026-05-13_base-tokenqube-activation-backlog.md` |
| **Admin mint-trigger route** | Want to verify claim flow at volume first before adding chain mint side-effect | Phase 9.3 |
| **Cohort memberships in `ActivePersonaContext`** | Cohort table backlog Phase 3 wire-up — empty list today, alias falls back to `'default'` cohortId | Phase 3 closure |
| **Qriptopian pilot bridge migration** | KNYT pilot is the proof; Qriptopian re-runs the same Phase 6 pattern on Qriptopian masters | Phase 10 |
| **FIO-handle gate on mint** | `evaluateAccess('transfer'|'mint')` already denies with `fio-handle-required`; mint dispatcher just needs to honour that decision | Phase 9.3 |
| **`evaluateAccess` integration in the claim route** | Phase 9.1 chose to bypass `evaluateAccess` in the claim path and compute the alias directly to avoid double-receipts. If the operator wants the additional `transfer` decision receipt in `orchestration_events`, lift the alias derivation into `evaluateAccess` and use it from there | Phase 9.4 (optional) |

---

## 8. Files & contracts — quick reference

**Identity / access spine (canonical, MUST NOT fork without operator approval):**

- `services/identity/getActivePersona.ts`
- `services/identity/personaSessionToken.ts`
- `services/identity/cohortAliasService.ts`
- `services/access/evaluateAccess.ts`
- `services/access/policyResolvers.ts`
- `services/content/getContentDescriptor.ts`
- `services/content/encryption.ts`
- `services/content/stateCDelivery.ts`
- `types/access.ts`

**ContentQube layer (this session):**

- `services/content/resolveContentQube.ts` — server-side resolver, calls spine
- `services/content/buildDisplayManifest.ts` — T1 manifest builder
- `services/content/claimEdition.ts` — atomic claim service (Phase 9)
- `services/access/contentQubeReceiptEmitter.ts` — access / transfer / mint / creation receipts
- `services/chain/baseTokenMint.ts` — ERC-1155 / ERC-721 mint (Phase 7B)
- `app/api/registry/content-qube/[id]/route.ts` — single-qube GET
- `app/api/registry/content-qube/series/route.ts` — series GET
- `app/api/registry/content-qube/[id]/claim/route.ts` — claim POST
- `app/triad/components/codex/tabs/useContentQubeSeries.ts` — client hook
- `app/triad/components/codex/tabs/ScrollsTab.tsx` — registry-driven lock/unlock
- `app/triad/components/codex/tabs/CharactersTab.tsx` — registry-driven card rendering

**Purchase / rewards integration (Phase 9.2):**

- `services/rewards/purchaseHandler.ts` — `processPurchase` now calls `claimContentQubeEditions` post-grant

---

## 9. Operator runbook — what to do next

To complete the Qripto Spine → ContentQube → chain story end-to-end:

```bash
# 1. Verify the spine smoke gate still passes after Phase 9.x
node scripts/verify-spine.mjs --host=dev-beta.aigentz.me \
  --personaId=<a-persona-you-own> \
  --owned=<an-asset-the-persona-owns> \
  --txGuard=<an-asset-id>

# 2. Run the Phase 9 claim path against a test persona on dev (post-deploy):
curl -X POST https://dev-beta.aigentz.me/api/registry/content-qube/<qube-id>/claim \
  -H "x-persona-id: <test-persona-id>" \
  -H "content-type: application/json" \
  -d '{"rarity":"rare"}'

# 3. Inspect the resulting transfer receipt:
psql … -c "SELECT id, receipt_kind, t2_alias_commitment, receipt_payload
           FROM content_qube_dvn_receipts
           WHERE content_qube_id = '<qube-id>'
           ORDER BY created_at DESC LIMIT 5;"

# 4. Confirm no personaId leak:
psql … -c "SELECT column_name FROM information_schema.columns
           WHERE table_name = 'content_qube_dvn_receipts';"
# Expected: no 'persona_id' column.
```

For Phase 9.3 (chain mint activation), follow the operator tasks in
`codexes/packs/agentiq/updates/2026-05-13_base-tokenqube-activation-backlog.md`.

---

## 10. Bottom line

The platform now has **one spine** — call it the Qripto Spine — that every cartridge, every protocol, and every surface consumes for identity, access, content resolution, edition issuance, and chain anchoring. ContentQube is the first protocol that exercises the full chain end-to-end. PersonaSpine and the metaMe client protocols are the named client-side surfaces of this same spine; SmartTriad routes through it; inter-cartridge navigation propagates the identity that drives it.

The previously-deferred T0/T1/T2 hygiene is now enforced at the **schema level** for ContentQube receipts (no `persona_id` column) in addition to the test-suite canaries already covering the rest of the platform. The privacy contract is no longer just a convention — it's structural.

Next stop: Phase 9.3 (chain mint activation) and Phase 10 (Qriptopian pilot bridge, re-running Phase 6's pattern on a second cartridge).
