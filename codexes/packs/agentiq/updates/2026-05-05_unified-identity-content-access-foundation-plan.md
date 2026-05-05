# Unified Identity, Content & Access Management — Foundation Plan

**Date:** 2026-05-05
**Branch:** `claude/blockchain-identity-ai-foundation-lEyk2`
**Status:** Plan — operator review before any code changes
**Predecessors (must read in order):**
- `2026-05-05_handover-identity-access-management-session.md` (scope handover)
- `2026-05-04_smarttriad-ownership-unification-backlog.md` (Phase 2 ownership unification)
- `2026-05-04_wip-vs-canonical-iqube-mint-plan.md` (Phase 2 mint architecture, locked decisions)
- `2026-05-02_iqube-encryption-of-gated-content-backlog.md` (storage encryption)
- `2026-05-02_token-gating-architecture-backlog.md` (asset/SKU/entitlement model)
- `codexes/packs/agentiq/items/IQUBE_IDENTITY_SOVEREIGNTY_ARCHITECTURE.md` (4-layer sovereignty)
- `codexes/packs/agentiq/items/AIGENT_DIDQUBE_IDENTITY_UPGRADE_NOTE.md` (one-root, many-personas)
- `docs/agent-harness/metaproof-core.md` (DVN receipt taxonomy, NBE contract)
- `docs/IDENTITY_ARCHITECTURE.md` (kybe / Root / Persona / FIO layering)

---

## 0. Why this plan exists

The platform already contains every primitive needed for unified identity-and-access management. The DiDQube schema is shipped, the iQube primitives (MetaQube/BlackQube/TokenQube) are implemented, the DVN canisters are deployed, the SmartTriad spine exists, the SmartWallet exists, the entitlement service exists, the gating classifier exists, the AutoDrive encryption pipeline exists, and the persona model exists.

What does **not** yet exist is the **single contract** that binds them. Today, each surface (codex tab, store tab, runtime, wallet drawer, embed page, PDF viewer, video viewer, remix dialog) resolves persona, fetches entitlements, and decides "is this gated and does this persona have access?" using **its own path**. The result is the cluster of regressions documented in the May 2026 session updates: badge ≠ gate divergence, EVM/persona inversion, Firefox snap-back, thin-client divergence, CRM lookup failure, and so on.

This plan replaces that fragmentation with **one spine** without rebuilding any primitive. It is wiring + contracts + policy, not construction.

---

## 1. Architectural principle (the one model)

```
                        ┌──────────────────────────────┐
                        │   metaMe Guardian (sovereign) │
                        └──────────────┬────────────────┘
                                       │ policy override
                                       ▼
            ┌──────────────────────────────────────────────┐
            │         DVN — POLICY ENFORCEMENT             │
            │  (rule + receipt layer; canisters; PoS-BTC)  │
            └──────────────────────────────────────────────┘
                ▲                ▲                ▲
                │ ENFORCES        │ EMITS          │ ANCHORS
                │                 │                │
   ┌────────────┴───┐  ┌──────────┴──────┐  ┌──────┴───────────┐
   │ PERSONA SIDE   │  │  CONTENT SIDE    │  │  NETWORK SIDE     │
   │ (the wallet)   │  │  (the iQube)     │  │  (the runtime)    │
   ├────────────────┤  ├──────────────────┤  ├───────────────────┤
   │ kybe_DiD       │  │ MetaQube         │  │ Cartridges,       │
   │ Root DiD       │  │   - openness flag│  │ Codexes, Tabs     │
   │ Persona(s)     │  │   - access policy│  │ are FILTERS on    │
   │ Identifiability│  │ BlackQube (enc)  │  │ top of the spine  │
   │ Cohort memb.   │  │ TokenQube (key)  │  │ — never the source│
   │ Entitlements   │  │   - on-chain ptr │  │ of truth.         │
   │ Reputation     │  │   - or DVN-only  │  │                   │
   └────────────────┘  └──────────────────┘  └───────────────────┘
                ▲                ▲                ▲
                └────────────────┴────────────────┘
                                 │
                ┌────────────────┴─────────────────┐
                │         SmartTriad Spine          │
                │  (the only thing every surface    │
                │   reads from to know "who" and    │
                │   "what they can access")         │
                └───────────────────────────────────┘
```

### The three universal facts (locked-in, will not be re-debated)

1. **Identity lives in the wallet** as Persona records anchored to a Root DiD (and, for humans, ultimately a kybe_DiD). One root, many bounded personas. Persona is the *only* identity unit any surface ever reads.
2. **Access intelligence lives in the content** as MetaQube metadata. Every content object — whether a PDF, video, character card, agent, model, tool, workflow, dataset, or capsule — carries its own answer to "am I open or gated, and if gated, by what rule?" Surfaces never invent gating; they read it.
3. **Policy is enforced by the DVN.** The DVN is the rule layer that evaluates `(persona, content, action) → allow|deny|escalate` and emits the receipt. It does this whether the content payload lives in Supabase or AutoDrive, and whether the TokenQube was minted to an external L1/L2 chain or remains DVN-internal. Storage and chain are independent of policy.

### The corollary that eliminates today's fragmentation

> Surfaces (KnytTab, StoreTab, Terra, Community, runtime capsule, embed, wallet drawer, PDF viewer, video viewer, remix dialog) are *filters* on top of the spine, not sources of truth. They render what the spine tells them; they never decide.

> Cartridges and Codexes group content into collections; Cohorts group personas into audiences. These are convenience aggregations layered on top of the per-asset, per-persona truth — never substitutes for it.

---

## 2. The five-layer identity hierarchy (recap, locked-in)

| # | Layer | Mutability | Quantity | Purpose |
|---|---|---|---|---|
| 0 | **kybe_DiD** | Immutable from birth to death | 1 per natural person | Proof of personhood (humans only; Aigents skip this). Schema-ready (`public.kybe_identity`), application-stub today. |
| 1 | **Root DiD** | Reissuable under life events | 1 per actor (human or Aigent) | Enduring accountability anchor. `did:fio:<handle>` or `did:iq:root-*`. Mirrored on FIO + ICP. |
| 2 | **Persona** | Created/retired freely | Many per Root | Context-specific presentation layer. The unit every surface reads. |
| 3 | **FIO Handle** | Optional | 0–1 per Persona | Human-readable blockchain identity (`alice@knyt`). |
| 4 | **FIO PK** | 1 per Handle | — | Cryptographic ownership proof. |

For Aigents the hierarchy is the same minus kybe_DiD. **One Root DiDQube. Multiple bounded personas. Shared root accountability. Context-specific disclosure.**

---

## 3. The four content states (locked-in, exhaustive)

Every content object in the estate falls into exactly one of these four states. State determines the storage path, encryption posture, gating evaluator, and whether a TokenQube is required.

| State | Encrypted? | Storage | iQubed? | Gated? | TokenQube | Notes |
|---|---|---|---|---|---|---|
| **A. Open · non-iQubed** | No | Supabase public | No | No | None | Marketing assets, free previews (e.g. GN ep 0), public KB. Today's default for editorial/community content. |
| **B. Open · iQubed (survivability)** | Yes | AutoDrive | Yes | No | Public/pool access token (anyone-can-decrypt) | Censorship-resistant publication; any persona decrypts. The "iQube but free" case the operator called out. |
| **C. Gated · WIP** | **Yes** | Supabase | Yes (WIP envelope) | Yes | Bound to TokenQube; decryption proxied server-side | Mutable working-progress content that must still be encrypted at rest. The "encrypted at rest in Supabase" requirement. |
| **D. Gated · Canonical** | Yes | AutoDrive | Yes (full mint) | Yes | On-chain (Base for alpha; bridgeable to 7 ref chains; or DVN-internal) | Sovereign or pool-licensed content. Asset-keyed: same content key across versions; existing TokenQubes survive updates. |

**Two access models on gated content (states C & D), both must coexist:**

- **Pool / access-token** — streaming/license. One ciphertext, N TokenQubes wrapping the same key. Transferable, revocable, deferrable mint. For subscriptions, cohort drops, KS rewards.
- **Canonical NFT** — ownership/sovereignty. Same one ciphertext, each holder gets a unique NFT TokenQube. Pre-minted. For collector editions, founder NFTs.

A single asset can publish both surfaces against the same payload (e.g. 100 collector NFTs + a public stream-pool token).

---

## 4. The universal contract — what every surface must speak

This is the only new thing this plan introduces. It is a **contract**, not a service: a typed shape that the existing services already implement (or will implement with minimal change). Codifying it removes every surface's freedom to invent its own gating logic.

### 4.1 `ResolvedPersona` (identity contract)

```typescript
interface ResolvedPersona {
  personaId: string;                    // canonical UUID
  authProfileId: string;                // multi-email-merged caller identity
  rootDid: string;                      // did:fio:* or did:iq:*
  fioHandle?: string;
  identifiability: 'anonymous' | 'semi_anonymous' | 'semi_identifiable' | 'identifiable';
  isAdmin: boolean;
  isPartner: boolean;
  isInvestor: boolean;
  cohortMemberships: string[];          // cohort_ids resolved from this persona
  source: 'url-param' | 'postmessage' | 'session-storage' | 'api-resolved';
}
```

Every surface that needs a persona calls **one** function — `resolvePersona(req|ctx)` — and receives this shape. Today's `effectivePersonaId`, `useCodexEmbedAuthBridge`, `KnytTab` candidate-chain, raw `localStorage` reads, and CRM email lookups all collapse into this single resolver.

### 4.2 `ContentAccessDescriptor` (content-side intelligence)

```typescript
interface ContentAccessDescriptor {
  assetId: string;                      // canonical id (mk_epNN_*, character-uuid, etc.)
  contentClass: 'episode_still' | 'episode_motion' | 'episode_print'
              | 'character_card' | 'gn' | 'lore'
              | 'agent' | 'tool' | 'model' | 'workflow' | 'dataset'
              | 'capsule' | 'other';
  state: 'A_open_unqubed' | 'B_open_iqubed' | 'C_gated_wip' | 'D_gated_canonical';
  gating: {
    kind: 'free' | 'payment' | 'credential';
    credential?: 'admin' | 'partner' | 'investor' | 'cohort:<id>' | 'token:<chain>:<contract>';
    priceUsd?: number;
    reason?: string;
  };
  iqube?: {
    metaQubeId: string;
    blakQubeId: string;
    tokenQubeId?: string;               // only for states B/C/D
    encryption: { alg: 'AES-256-GCM'; iv: string; authTag: string };
    storage: { backend: 'supabase' | 'autodrive'; pointer: string };
    onChain?: { chain: string; contract: string; tokenId: string };  // only for D
  };
  receiptEligible: boolean;             // does access trigger a DVN receipt?
}
```

Every read of any content starts with a server-side fetch of this descriptor. Surfaces consume it; they do not derive it.

### 4.3 `AccessDecision` (DVN-side answer)

```typescript
interface AccessDecision {
  allow: boolean;
  reason: 'free' | 'owned' | 'credential-met' | 'token-proof-verified'
        | 'payment-required' | 'credential-required'
        | 'token-required' | 'policy-blocked' | 'guardian-vetoed';
  deliveryMode: 'plain-redirect' | 'decrypt-stream' | 'page-image-proxy' | 'token-proof-stream';
  tokenQubeProofChallenge?: string;     // if deliveryMode = token-proof-stream
  receiptId?: string;                   // emitted DVN receipt (if applicable)
  expiresAt?: string;                   // for ephemeral signed-URL grants
}
```

A single endpoint — `evaluateAccess(persona: ResolvedPersona, content: ContentAccessDescriptor, action: 'read'|'watch'|'listen'|'mint'|'remix'|'invoke')` — returns this. Every gate in the system, on every surface, calls this and trusts the answer.

### 4.4 The three contracts in one sentence

> **`resolvePersona` returns who you are. `getContentDescriptor` returns what the asset is. `evaluateAccess` returns whether you can use it. No surface ever decides on its own.**

---

## 5. Inventory — what already exists, what we keep

This is the "do not recreate" register. Every item below is live and stays. The plan extends, rebinds, or adds a thin facade — never duplicates.

### 5.1 Persona / Identity (KEEP)

| Concern | File | Plan disposition |
|---|---|---|
| Persona table + visibility | `services/wallet/personaRepo.ts` | Keep; back the new resolver |
| Multi-email merging | `services/wallet/multiEmailIdentity.ts` | Keep; called by resolver |
| Persona context (browser) | `app/contexts/PersonaContext.tsx` | Keep; emits `aa-persona-change-v1` |
| Embed auth bridge | `app/(embed)/triad/embed/codex/_lib/useCodexEmbedAuthBridge.ts` | Keep; back the resolver in embeds |
| Cross-cartridge nav | `utils/codex-nav.ts` `buildCodexUrl()` | Keep — already canonical |
| Identity resolver (server) | `services/identity/identityResolver.ts`, `services/runtime/identityResolver.ts` | **Merge into one** `resolvePersona` (Phase 1) |
| Root DiD binding | `app/api/identity/root-did/bind/route.ts`, `services/identity/didRegistrationService.ts` | Keep; populate `rootDid` on ResolvedPersona |
| FIO handle attach | `app/api/wallet/persona/attach-handle/route.ts` | Keep |
| ICP DiDQube anchor | `services/ops/idl/proof_of_state.ts` + `services/ops/icpService.ts` | Keep; emit receipts |
| kybe_identity table | `supabase/migrations/20260427000000_root_did_persona_binding.sql` | Keep schema-ready; do not surface yet |

### 5.2 iQube primitives (KEEP)

| Concern | File | Plan disposition |
|---|---|---|
| iQube discriminator types | `types/aigentQube.ts` | Keep |
| Universal mint | `services/core/UniversalQubeService.ts` | Keep — already supports MetaQube/BlackQube/TokenQube |
| Server-side registry | `server/services/iqRegistryService.ts` | Keep |
| AutoDrive encryption pipeline | `server/services/autonomysContentService.ts` | Keep — already AES-256-GCM + master-key wrap |
| AES-256-GCM service | `server/services/encryptionService.ts` | Keep — extend to Supabase WIP path |
| Mint stub tracking | `iqube_mint_stubs` table | Keep |
| Persona mint routes | `app/api/iqube/persona/{knyt,qripto}/mint/route.ts` | Keep |

### 5.3 Entitlements / access (KEEP, REBIND)

| Concern | File | Plan disposition |
|---|---|---|
| Gating classifier | `services/rewards/contentGating.ts` | Keep — already SoT for kind classification |
| Asset ownership resolver | `services/rewards/assetOwnership.ts` (`userOwnsAsset`, `getOwnedAssetIds`) | Keep — back `evaluateAccess` |
| Entitlement service | `services/rewards/entitlementService.ts` | Keep |
| SmartContent service | `services/content/smartContentService.ts` | Keep |
| Owns-asset endpoint | `app/api/entitlements/owns-asset/route.ts` | Keep |
| Owned-assets endpoint | `app/api/entitlements/owned-assets/route.ts` | Keep — back `useSmartTriadOwnership` |
| Client hook | `app/hooks/useOwnedEntitlements.ts` | Keep, then **graduate** into `useSmartTriadOwnership` (Phase 2) |
| `store_skus` SKU expansion | `services/rewards/assetOwnership.ts` | Keep |

### 5.4 DVN / Proof-of-State (KEEP)

| Concern | File | Plan disposition |
|---|---|---|
| DVN service | `services/ops/dvnService.ts` | Keep — extend with `evaluateAccess` policy hook |
| Receipt finalization | `services/dvn/receiptFinalizationService.ts` | Keep |
| QubeTalk receipt pipeline | `services/dvn/qubetalkReceiptPipeline.ts` | Keep |
| Proof-of-State canister IDL | `services/ops/idl/proof_of_state.ts` | Keep |
| ICP / EVM / BTC adapters | `services/ops/{icpService,evmService,btcService}.ts` | Keep |
| Bitcoin anchor | `services/ops/btcService.ts` + `app/api/ops/btc/*` | Keep — Root-DiD-attributed receipt sink |
| Orchestration events | `services/orchestration/orchestrationEvents.ts` | Keep — every `evaluateAccess` with `receiptEligible:true` emits |
| ICP canisters (Escrow, RQH, FBC, DBC) | `services/ops/idl/{escrow,rqh,fbc,dbc}.ts` | Keep — wire cohort flag routing in Phase 3 |

### 5.5 SmartTriad spine (KEEP, EXTEND)

| Concern | File | Plan disposition |
|---|---|---|
| SmartTriad model + service | `src/smartTriad/{model,service}.ts`, `packages/smarttriad/src/*` | Keep |
| Drawer adapter | `services/drawer/smartTriadAdapter.ts` | Keep |
| SmartTriadProvider | `app/components/content/SmartTriadProvider.tsx` | **Promote to spine** (Phase 1) — host `ResolvedPersona` + ownership store + access cache |
| Avatar host postMessage | `packages/avatar-host/src/AvatarContext.tsx` | Keep — extend to relay `aa-persona-change-v1` cross-cartridge |
| SmartWallet | `packages/smartwallet/src/*` | Keep |
| Wallet session | `services/wallet/sessionService.ts` | Keep |

### 5.6 Cartridge / Codex registry (KEEP)

| Concern | File | Plan disposition |
|---|---|---|
| Codex configs | `data/codex-configs.ts` | Keep |
| Registry service | `services/registryService.ts`, `services/registry/*` | Keep |
| Policy gates | `services/policy/{qubetalkPolicyGate,skillQubePolicyGate}.ts` | Keep — call `evaluateAccess` (Phase 3) |
| Cohort resolver | `services/campaign/cohortResolver.ts` | Keep |
| Admin check | `app/api/codex/admin-check/route.ts` | Keep |

---

## 6. Gap analysis — what is actually missing

Once you net out the above, the missing pieces are surprisingly few. They are all **contract / wiring** items, not new construction.

| # | Gap | What it means |
|---|---|---|
| G1 | No single `resolvePersona` server function | Two `identityResolver.ts` files, plus `personaRepo`, plus per-route copies, plus client hooks all do partial work. Need one merged function. |
| G2 | No `getContentDescriptor` server function | The descriptor is assembled ad-hoc at every read site. Need one function that returns the canonical `ContentAccessDescriptor`. |
| G3 | No `evaluateAccess` policy endpoint | Today, every gate (PDF proxy, video proxy, codex tab, store, runtime) re-implements the decision. Need one DVN-anchored evaluator. |
| G4 | SmartTriadProvider doesn't host the unified state | `useOwnedEntitlements` exists but is not the spine. Multiple consumers still fetch their own ownership. (Documented in the SmartTriad ownership unification backlog.) |
| G5 | Supabase WIP content is not yet encrypted-at-rest | iQube envelope is AutoDrive-only today. Phase 1 of the iQube encryption backlog. |
| G6 | TokenQube on-chain proof verification path is stubbed | Phase 2 of the WIP-vs-canonical mint plan. Only needed once content is minted to canonical state D. |
| G7 | DVN policy enforcement is event-emission only | DVN currently emits receipts but does not own the *decision*. Phase 3 makes `evaluateAccess` consult DVN policy (and the ICP canisters for cohort flags). |
| G8 | Cohort alias / FBC flag routing not yet wired | Cohort escrow backlog item. Needed for anonymous reputation flow but not for basic gating. |
| G9 | Root-DiD `actor_root_did` not consistently populated on receipts | The metaproof core requires it; today some events emit without it. |
| G10 | metaQube does not yet carry `state` field (A/B/C/D) | Schema ready for `mint_status` (`wip`/`minted`); needs an additional or composite descriptor for openness vs gated, encrypted vs plain. |

Note what is **not** on this list: there is no missing primitive. No missing canister. No missing service. No missing schema column that requires re-architecture. The work is binding.

---

## 7. Phased plan — non-destructive, backward-compatible

Each phase is independently shippable, independently revertable, and adds capability without removing any. **Surgical-change protocol applies throughout: one file / one symptom / one commit per deploy.**

### Phase 0 — Lock the contracts (no code; review only)

**Outcome:** the three TypeScript interfaces from §4 land in `types/access.ts` as the single typing source. Operator approves the shapes. No runtime change.

**Files added (1 file, types only):**
- `types/access.ts` — `ResolvedPersona`, `ContentAccessDescriptor`, `AccessDecision` plus narrow union types.

**Acceptance:** types compile against existing data; operator signs off on the shapes. No surface yet uses them.

---

### Phase 1 — Spine (the unified resolver layer)

**Outcome:** every surface that today reads persona or ownership has a single function it can call. Existing functions stay intact and still work — the new ones are facades.

**1.1 Server-side `resolvePersona`**
- New file: `services/identity/resolvePersona.ts` — composes `personaRepo.getCallerAuthProfileId` + `multiEmailIdentity.getMergedLinkedAuthProfileIds` + admin-check + investor-status + cohort-resolver into one `ResolvedPersona`.
- Existing routes keep their current resolution paths working in parallel; new routes call `resolvePersona`. Migration is one route per commit.

**1.2 Server-side `getContentDescriptor`**
- New file: `services/content/getContentDescriptor.ts` — reads `master_content_qubes` / `codex_media_assets` plus `contentGating.classifyContentGating` plus `iqube_mint_stubs` and emits `ContentAccessDescriptor`.
- Backed by existing tables; no schema change.

**1.3 Server-side `evaluateAccess`**
- New file: `services/access/evaluateAccess.ts` — composes the descriptor + the resolver + `userOwnsAsset` + credential checks; returns `AccessDecision`. Does not yet call DVN policy (Phase 3); for now it captures today's behavior verbatim, plus emits a non-blocking telemetry event so we can verify divergence-free behavior.
- New endpoint: `POST /api/access/evaluate` — public-facing wrapper for client-side calls (rare; most calls remain server-internal).

**1.4 SmartTriadProvider becomes the client spine**
- Edit: `app/components/content/SmartTriadProvider.tsx` — host `ResolvedPersona` (today's PersonaContext continues to feed it) and hoist the ownership store from `useOwnedEntitlements` (per existing backlog).
- New hook: `app/hooks/useSmartTriadOwnership.ts` — thin wrapper over the spine state (already specified in `2026-05-04_smarttriad-ownership-unification-backlog.md`).
- `useOwnedEntitlements` stays as a compat shim that delegates to the new hook so no consumer breaks.

**1.5 Migrate consumers (one per commit)**
1. `KnytTab.tsx` — replace `fetchOwnedEpisodes` + `effectivePersonaId` with the spine
2. `app/contexts/SmartContentActionContext.tsx` — consult `evaluateAccess` before `buy`
3. `RemixDialog.tsx` — show ownership state from the spine
4. PDF proxy `app/api/content/pdf-page-by-master/[masterId]/route.ts` — call `evaluateAccess` instead of inline `userOwnsAsset`
5. Video proxy `app/api/content/video/[cid]/route.ts` — same
6. Cover proxy `app/api/content/cover/[cid]/route.ts` — same
7. Cart settle `app/api/cart/complete/route.ts` — credit entitlements through spine helpers

**1.6 Server-timeout migration (concurrent, already on backlog)**
- Migrate the eight `createClient`-direct routes to `getSupabaseServer()` (per Phase 2 backlog §2). Independent of the spine but unblocks reliability.

**Backward compatibility:** every legacy code path still works. The spine is additive. If a regression appears, revert the consumer migration commit; nothing else needs to roll back.

**Acceptance:** badge ↔ gate ↔ payment all read from the same source; persona switch synchronously clears UI ownership state; OWNED ≡ gate-allow by construction.

---

### Phase 2 — Storage encryption parity (states C & D)

**Outcome:** any gated content is encrypted at rest regardless of storage backend. Closes the cryptographic fallback gap.

**2.1 Schema disambiguation** (already designed in `2026-05-04_wip-vs-canonical-iqube-mint-plan.md`)
- Migration adds `wip_storage_url`, `mint_status` enum, optional `content_state` enum (`A|B|C|D`).
- Backfill: existing `auto_drive_cid LIKE 'http%'` rows → state `C` with `wip_storage_url` set; rows with real CIDs → state `D`.

**2.2 Encryption on Supabase WIP upload**
- Edit: `app/api/admin/codex/storage/{sign,register}/route.ts` — encrypt before PUT; persist `encryption_iv`, `encryption_auth_tag`, `token_qube_id`, `meta_qube_id`, `blak_qube_id`.
- Stream-encrypt for large files.

**2.3 Decryption proxy (state C)**
- New route: `app/api/content/decrypt-supabase/[cid]/route.ts` — calls `evaluateAccess`; on allow, fetches ciphertext + decrypts + streams plaintext (or page-image, for PDFs).
- Existing `pdf-page-by-master`, `video`, `cover` proxies branch on `mint_status`/`content_state` and dispatch to the right decryptor (state-C decrypt-supabase vs state-D decrypt-autodrive).

**2.4 Migration script for legacy unencrypted Supabase content**
- Operator-triggered job: encrypt-in-place for `gating_kind IN ('payment','credential') AND encryption_iv IS NULL OR ''`.

**Backward compatibility:** state-A (open) content is untouched. State-B (open iQubed) is the same as state-D from a delivery perspective minus the gate. State-C/D delivery is identical from the client's perspective (same proxy, same response).

**Acceptance:** every gated payload byte returned to the browser came through a server-side decrypt with a successful `evaluateAccess`. No raw Supabase URL for gated content reaches the browser.

---

### Phase 3 — DVN as policy enforcer (canonical decision layer)

**Outcome:** `evaluateAccess` consults DVN canister policy and emits a Bitcoin-ordinal receipt when the action is `receipt_eligible: true`. The platform stops being the trust boundary; the DVN does.

**3.1 DVN policy hook**
- Edit: `services/access/evaluateAccess.ts` — when descriptor's gating is `credential` and credential is `cohort:*` or `token:*`, call the appropriate ICP canister (RQH for cohort reputation; EVM adapter for ERC-721/1155 ownership proof) and gate on the response.
- New service: `services/access/policyResolvers.ts` — pluggable resolvers per credential type.

**3.2 Receipt emission**
- Every `AccessDecision` with `receiptEligible: true` emits an `OrchestrationEvent` with `actor_root_did` populated (gap G9) and a content-asset reference. The DVN service batches these into ordinal inscriptions on Bitcoin.
- Confirms the guarantee from `IQUBE_IDENTITY_SOVEREIGNTY_ARCHITECTURE.md` §Layer 2.

**3.3 Cohort flag routing (deferred sub-phase)**
- Wire `services/identity/cohortAliasService.ts` + `cohortFlagRouter.ts` per `2026-04-27_cohort-escrow-root-did-reputation-backlog.md`. Anonymous reputation flow.
- Independent of basic gating; can land any time after Phase 3 main.

**Backward compatibility:** Phase 3 is purely additive — the existing entitlement-table check still runs as a fallback when DVN is unavailable. The receipt emission is non-blocking (logged on failure, not a 500).

**Acceptance:** every gated read produces a verifiable Bitcoin-anchored receipt attributed to the persona's Root DiD. DVN downtime degrades gracefully to legacy behavior.

---

### Phase 4 — TokenQube on-chain ownership proof (state D delivery)

**Outcome:** for state-D (canonical-minted) content, the gate is satisfied by an on-chain ownership proof rather than a Supabase entitlement row. Clients sign a challenge proving control of the TokenQube; server validates against the chain (Base for alpha; bridgeable later).

**4.1 TokenQube proof challenge**
- New route: `POST /api/access/tokenqube-challenge` — issues a server-signed nonce.
- Client signs with the TokenQube's owning EVM key (smart wallet handles this).
- New route: `POST /api/access/tokenqube-verify` — validates signature + on-chain ownership.

**4.2 Decryption by unwrapped key**
- After verification, server unwraps the content key from the wrapped-key blob (IPFS or AutoDrive sidecar) and decrypts the BlakQube. Same page-image / streaming output as Phase 2.

**4.3 Both access models supported**
- Pool model: any holder of any pool TokenQube unwraps the same key. Deferred mint optional (mint at first access).
- Canonical model: per-holder NFT, each wraps the same content key.

**Backward compatibility:** state-C content continues to use entitlement-table gating (Phase 2). State-D content checks TokenQube proof first; falls back to entitlement table if the chain is unreachable. Operator can migrate any specific asset from C → D via "Mint as iQube" admin action.

**Acceptance:** owning the TokenQube is sufficient and necessary for state-D content access. Selling/transferring the TokenQube on-chain transfers access without any platform-side action.

---

### Phase 5 — Cleanup & retirement

After all consumers run on the spine and the receipt + token paths are exercised, retire the dead code paths:

- Delete `effectivePersonaId` ad-hoc resolvers
- Delete duplicate ownership fetchers (`fetchOwnedEpisodes`, etc.)
- Collapse the two `identityResolver.ts` files
- Drop the `auto_drive_cid` URL-overload (now `wip_storage_url` exclusively for state C)

This phase only runs after a clean alpha cycle. Any leftover consumer is treated as a bug, not a fork.

---

## 8. Operating principles across all phases

These are not negotiable and apply to every change:

1. **Never weaken a gate without explicit operator authorization.** `adminOnly`, `partnerOnly`, RLS, route auth — paramount per CLAUDE.md.
2. **One file / one symptom / one commit / one deploy.** No drive-by cleanups.
3. **Always `getSupabaseServer()` for new server-side Supabase access.** Never raw `createClient`.
4. **Every push to dev carries a descriptive merge message** naming what's pushed (`merge dev: sync before pushing <thing>`).
5. **Test the spine on five surfaces before declaring a phase done:** Brave platform, Brave thin-client (`metame.live`), Firefox platform, Firefox thin-client, mobile Safari.
6. **Every receipt-eligible event includes `actor_root_did` in metadata.** No exceptions.
7. **`NEXT_PUBLIC_*` is browser-only.** Service-role keys, master keys, and TokenQube unwrap keys never carry this prefix.
8. **The DVN remains the authority.** Storage backend (Supabase vs AutoDrive) and chain (Base vs DVN-internal) are implementation details, not policy boundaries.
9. **Surfaces never decide.** A surface that contains a gating check that is not a call into `evaluateAccess` is a bug.
10. **Ask before creating new files.** The 95%-built rule from the IAM handover applies — if the new functionality "feels like it should already exist," it almost certainly does.

---

## 9. Backward compatibility & rollback

Every phase preserves a fallback path:

| Phase | If it breaks | Recovery |
|---|---|---|
| 0 | — | Type-only; cannot break runtime |
| 1 | Spine consumer regression | Revert that one consumer commit; legacy path still works |
| 2 | Encryption pipeline regression | New uploads only; existing rows untouched. Operator can revert encryption flag and keep serving plaintext until fixed. |
| 3 | DVN unavailable | `evaluateAccess` falls back to legacy entitlement check; receipts queued for later anchor |
| 4 | Chain unavailable | TokenQube path falls back to state-C entitlement check |
| 5 | — | Retirement only after stability is proven |

There is no big-bang switchover. Every phase coexists with the prior baseline.

---

## 10. Acceptance criteria — the "we're done" checklist

The plan is complete when:

- [ ] **Identity:** `resolvePersona` is the only function that produces a persona shape. Every surface uses it.
- [ ] **Content:** every content row's openness/gating/encryption state is decidable from `getContentDescriptor`. No surface infers state from URL or filename.
- [ ] **Decision:** every gate-evaluation in the codebase is a call to `evaluateAccess`. Searching for `userOwnsAsset` outside `services/access/*` returns nothing.
- [ ] **Encryption parity:** any row with `gating_kind IN ('payment','credential')` has `encryption_iv != ''`, regardless of storage backend.
- [ ] **Receipts:** every receipt-eligible action emits an OrchestrationEvent with `actor_root_did` populated and a DVN ordinal anchor confirmed within 24h.
- [ ] **Sovereignty:** for any state-D asset, ownership of the TokenQube alone (verified on-chain) is sufficient to access the payload.
- [ ] **Spine:** persona switch on any surface synchronously clears ownership state on all open surfaces. OWNED-badge ≡ gate-allow by construction.
- [ ] **No fallback drift:** after Phase 5 cleanup, no duplicate persona resolver, ownership fetcher, or gate evaluator remains.

---

## 11. Open decisions for operator review

These need a call before Phase 1 starts:

1. **Resolver name:** `resolvePersona` vs `getActivePersona` vs `resolveCallerIdentity`. Naming sticks for the lifetime of the codebase.
2. **`evaluateAccess` shape on receipt-eligible actions:** synchronous emit (block on DVN) or asynchronous fire-and-forget with reconciliation? Recommend async.
3. **State-B (open iQubed) gate:** open by default to any persona, or require any-persona-token? Recommend open-by-any-token (tokenless personas still allowed via pool token issued at first access).
4. **Cross-chain mint at promotion:** mint on the persona's primary chain only, or atomically on all 7 ref chains? Recommend primary only; bridging is a separate user-driven operation.
5. **Pool-mode deferred mint trigger:** at entitlement grant (purchase) or at first access? Recommend entitlement-grant time for revocation simplicity.
6. **kybe_DiD activation:** stays application-stub for now, or do we surface presence (not contents) in IdentityIQubeDrawer? Recommend stay stub until World ID adapter is in scope.
7. **Phase 4 ordering:** mint canonical NFTs for KNYT investor SKUs at the end of alpha, or defer until post-alpha launch? This determines whether Phase 4 lands in this plan cycle or the next.

---

## 12. Sequence summary

```
Phase 0  (1 day)   types only — operator approval gate
Phase 1  (2 wk)    spine + first 7 consumers — eliminates today's regressions
Phase 2  (2 wk)    Supabase encryption + decrypt proxy — closes leak
Phase 3  (1 wk)    DVN policy hook + receipts — proves provenance
Phase 4  (2 wk)    TokenQube on-chain proof — sovereignty live
Phase 5  (1 wk)    cleanup + retire dead paths
```

Phases 0–3 give a clean baseline that resolves every May 2026 regression without changing the storage or chain story. Phases 4–5 light up the full iQube sovereignty model on top of the same spine, asset by asset.

---

## 13. References

- `codexes/packs/agentiq/items/IQUBE_IDENTITY_SOVEREIGNTY_ARCHITECTURE.md`
- `codexes/packs/agentiq/items/AIGENT_DIDQUBE_IDENTITY_UPGRADE_NOTE.md`
- `docs/IDENTITY_ARCHITECTURE.md`, `docs/PERSONA_ID_EXPLAINED.md`, `docs/ROOT_DID_IMPLEMENTATION.md`
- `docs/DIDQUBE_IDENTITY_POLICY.md`, `docs/DIDQUBE_PHASE3_INTEGRATION.md`
- `docs/agent-harness/metaproof-core.md`, `docs/agent-harness/aigent-z-aigent-c-contract.md`
- `codexes/packs/agentiq/updates/2026-05-04_wip-vs-canonical-iqube-mint-plan.md`
- `codexes/packs/agentiq/updates/2026-05-04_smarttriad-ownership-unification-backlog.md`
- `codexes/packs/agentiq/updates/2026-05-02_iqube-encryption-of-gated-content-backlog.md`
- `codexes/packs/agentiq/updates/2026-05-02_token-gating-architecture-backlog.md`
- `codexes/packs/agentiq/updates/2026-04-27_cohort-escrow-root-did-reputation-backlog.md`
- `codexes/packs/agentiq/updates/2026-04-29_identity-management-comprehensive-doc-backlog.md`
- `codexes/packs/agentiq/updates/2026-05-05_handover-identity-access-management-session.md`
- iQube Docusaurus: `https://iqube-protocol.github.io/iQubeBeta-Program/` (firewalled from this sandbox; in-repo docs above are the equivalent canonical content)
