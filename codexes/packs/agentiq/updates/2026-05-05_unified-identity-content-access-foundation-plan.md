# Unified Identity, Content & Access Management — Foundation Plan

**Date:** 2026-05-05 (rev. v3 — identifier exposure tiers + LZ/ICP bridging confirmation)
**Branch:** `claude/blockchain-identity-ai-foundation-lEyk2`
**Status:** Plan, operator §11 decisions locked. v3 adds: explicit identifier exposure tiers (T0 server / T1 session-token / T2 public alias) generalising the EVM-wallet-alias pattern to all persistent persona handles; LayerZero + ICP bridging confirmation for primary-only mint; fioHandle moved to consented disclosure.
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

## 3. The five content states (locked-in, exhaustive)

Every content object in the estate falls into exactly one of these five states. State determines the storage path, encryption posture, gating evaluator, payload uniqueness, and whether a TokenQube is required.

| State | Encrypted? | Storage | iQubed? | Gated? | Payload | TokenQube | Notes |
|---|---|---|---|---|---|---|---|
| **A. Open · non-iQubed** | No | Supabase public | No | No | Shared, plaintext | None | Marketing, free previews (GN ep 0), public KB. Today's default for editorial/community content. |
| **B. Open · iQubed (survivability)** | Yes | AutoDrive | Yes | No | Shared ciphertext | Public access token (any persona unwraps) | Censorship-resistant publication; any persona can decrypt. The "iQube but free" case. |
| **C. Gated · WIP** | **Yes** | Supabase | Yes (WIP envelope) | Yes | Shared ciphertext | Bound to TokenQube; decryption proxied server-side | Mutable working-progress content that must still be encrypted at rest. |
| **D. Gated · Canonical streaming/pool** | Yes | AutoDrive | Yes (full mint) | Yes | **Shared ciphertext, asset-keyed** (one payload, one content key, N wrappers) | On-chain or DVN-internal pool token; transferable; deferred-mintable | Asset-keyed updates: same content key survives version changes; existing TokenQubes still decrypt. **License/access** semantics. Holder consumes; does not own the bytes. |
| **E. Gated · Canonical sovereign** | Yes | **Holder-custodied** (AutoDrive primary; holder may copy off-platform) | Yes (full mint) | Yes | **Unique ciphertext per holder, unique key per holder** — non-fungible at the byte level | On-chain NFT, one per holder, pre-minted | True ownership: each holder has their own ciphertext + their own key. Holder can move the payload anywhere (off-platform, cold storage, hardware wallet). Same plaintext bytes, different ciphertext (different IV / key) → different CID per holder. **Custody/sovereignty** semantics. |

### Why D and E are distinct (operator clarification)

D and E both qualify as "canonical mint" but they are categorically different at the byte layer.

- **D (streaming/pool)** is the *fungible-license* model. One canonical ciphertext on AutoDrive, one content key, N TokenQubes that all unwrap the same key. Asset-keyed update semantics work because the wrappers point to the same key. Holders consume; they do not custody bytes. Best for subscriptions, cohort drops, KS rewards, "subscribe to read" libraries.
- **E (sovereign)** is the *non-fungible-custody* model. Each holder's payload is encrypted with **their own** content key, producing a different ciphertext with a different CID — even though the underlying plaintext is identical. The TokenQube is unique per holder; transferring the NFT transfers the wrapped key alongside it; the holder can copy the ciphertext off-platform and the key still decrypts it. Update semantics are different: a republish under E is its own new mint per holder (no shared key to update). Best for collector editions, signed first prints, sovereign-grade investor instruments, founder NFTs, and any content where the operator wants the holder to be able to leave the platform with the bytes.

A single underlying work can publish multiple surfaces simultaneously — e.g. 100 sovereign-mint editions (state E) + a public stream-pool (state D) + a free preview (state A). The operator picks the model(s) at mint time.

### Pool vs sovereign access-models — clean naming going forward

To prevent ambiguity, we drop "Pool/access-token vs Canonical NFT" wording in favor of state names:

- **State D = canonical pool/streaming** (shared payload, fungible licenses)
- **State E = canonical sovereign** (unique payload per holder, non-fungible custody)

When this plan refers to "TokenQube proof" in Phase 4, it covers both D and E — the proof mechanism is the same (sign challenge with the TokenQube's owning key), but the unwrap path differs: D unwraps the shared content key; E unwraps the per-holder content key from the per-holder wrapped-key blob.

---

## 4. The universal contract — what every surface must speak

This is the only new thing this plan introduces. It is a **contract**, not a service: a typed shape that the existing services already implement (or will implement with minimal change). Codifying it removes every surface's freedom to invent its own gating logic.

### 4.1 `ActivePersona` (identity contract — privacy-first)

The identity contract is split into:
1. A **server-internal context** holding the canonical persona handles. This is what server code uses to resolve entitlements, decide gates, and write DB rows. It never crosses the wire to the browser.
2. A **public-safe surface state** containing only an opaque session token plus operational flags. This is what every surface (KnytTab, embed, runtime, wallet drawer, viewer, remix dialog) reads.
3. A **consented disclosure** layer that returns confidential credentials only when a compliance flow has been authorised by the persona owner.

This honours the privacy-first mandate from the DiDQube docs and generalises the wallet-alias pattern (`2026-04-29_plaintext-wallet-address-deprecation.md`) to **all** persistent persona handles — not just EVM addresses. Any identifier that, if observed across multiple sessions/surfaces/networks, could correlate a user across contexts is treated as a confidential handle and held server-side only.

#### 4.1.a Identifier exposure tiers

Every persona-related identifier in the system has exactly one exposure tier. Tier determines storage, transport, lifetime, and who can see it.

| Tier | Identifier | Lifetime | Storage | Visibility |
|---|---|---|---|---|
| **T0 — server-internal** | `personaId` (UUID), `authProfileId`, `fioHandle`, `rootDid` (on disclosure), `kybe_DiD` (future) | Persistent | `personas` / `crm_auth_profiles` rows; encrypted columns where applicable; server memory during request | Server processes only. Holder via consented BlakQube unwrap. **Never** in client responses, URL params, postMessage payloads, or browser storage. |
| **T1 — same-origin trusted shell** | `personaSessionToken` (opaque, server-signed, short-lived, rotating) | Per session (rotates on persona switch, sign-out, TTL) | Browser localStorage / sessionStorage / cookie; postMessage within the AigentZ shell origin set | Same browser session only. Cannot be correlated across sessions or to any persistent identifier without the server. Replaces today's raw `currentPersonaId` in localStorage and the `?personaId=` query param. |
| **T2 — public-network** | `aliasCommitment = hash(personaId + cohortId + salt)` | Per-tx, escrow-window TTL | DVN receipts, on-chain anchors, mailbox relays, any URL or message that traverses the open internet outside the trusted shell | Anyone — but un-correlatable post-purge. The Escrow canister destroys the alias→persona mapping when the escrow window closes. |

**The rule:** an identifier may move down a tier (T0 → T1 → T2) only via a deliberate transformation function. It must never move up a tier. A `personaSessionToken` is exchanged for a `personaId` only on the server; an `aliasCommitment` is never reversed to a `personaId` outside the escrow window.

#### 4.1.b Server-internal context — `ActivePersonaContext`

This is the shape `getActivePersona(req)` returns to *server-side* callers (API routes, services). It never leaves the server.

```typescript
interface ActivePersonaContext {
  personaId: string;                    // T0 — canonical UUID; server-internal only
  authProfileId: string;                // T0 — multi-email-merged caller identity
  identifiability: 'anonymous' | 'semi_anonymous' | 'semi_identifiable' | 'identifiable';
  cartridgeFlags: {
    isAdmin: boolean;
    isPartner: boolean;
  };
  cohortMemberships: string[];          // cohort_ids only (no aliases at rest)
  source: 'session-cookie' | 'session-token' | 'api-key' | 'postmessage-token';
}
```

API routes use this context to resolve entitlements, gate access, and write rows. Before any response is built, the route discards the context and emits only the public-safe surface state below.

#### 4.1.c Public-safe surface state — `ActivePersonaSurface`

This is what the browser sees. The browser never sees `personaId`, `authProfileId`, `fioHandle`, or `rootDid`.

```typescript
interface ActivePersonaSurface {
  // T1 — opaque, server-signed, short-lived. Resolves on the server back
  // to ActivePersonaContext. Rotates on persona switch, sign-out, or TTL.
  // This is the ONLY persona handle that touches client storage or URLs.
  personaSessionToken: string;

  // Self-asserted disclosure level — drives default UI affordances. This
  // is a category, not a handle, so it does not correlate.
  identifiability: 'anonymous' | 'semi_anonymous' | 'semi_identifiable' | 'identifiable';

  // Cartridge-role flags. Booleans only — no underlying identifier exposed.
  cartridgeFlags: {
    isAdmin: boolean;
    isPartner: boolean;
  };

  // Display-only: a non-correlating handle the user has chosen for this
  // surface — usually their own pet name for the persona ("Work", "Anon",
  // "Knight"). Stored in the persona row; not derived from personaId/fioHandle.
  // Optional; absent means anonymous presentation.
  displayLabel?: string;

  // Cohort group ids ARE T1-safe — they identify the group, not the member,
  // and groups are public/semi-public by design (e.g. "knyt-investors").
  cohortMemberships: string[];

  // TTL hint for the session token; client refreshes proactively.
  sessionExpiresAt: string;
}
```

What is **not** in this shape, by design:

- **`personaId`** — server-internal (T0). The browser never has it. Replaced by `personaSessionToken` (T1) for cross-surface correlation within the trusted shell.
- **`fioHandle`** — server-internal (T0) by default. Public on the FIO chain, yes — but pinning it onto every surface read recreates the EVM-address correlation hazard. Available only via 4.1.e consented disclosure when the persona explicitly chooses identifiable presentation.
- **`rootDid`** — never default-exposed. Available only via 4.1.e consented disclosure.
- **`kybe_DiD`** — even more confidential than rootDid; never appears in any client state. Future surface activation gated on World ID adapter (§11.a backlog).
- **`isInvestor`** / KYC level / legal name / wallet addresses (plaintext) — all confidential; available only via 4.1.e.
- **Cohort alias commitments** — these are T2; computed at network-tx time, ephemeral, never in client state.

#### 4.1.d How `personaSessionToken` works (the wire-side identifier)

The session token replaces today's `currentPersonaId` localStorage value and the `?personaId=` URL param in `buildCodexUrl()`. This is a Phase 1 mechanical change.

```
Browser                              AigentZ server
   │                                       │
   │ ── auth: cookie / OAuth ──────────────▶│
   │                                       │ resolve session → personaId (T0)
   │ ◀── ActivePersonaSurface (T1 token) ──│ sign + return surface
   │                                       │
   │ store token in shell-origin storage   │
   │                                       │
   │ ── cross-cartridge nav: ?pst=<T1> ───▶│ verify token → personaId (T0)
   │                                       │ build response with T1 only
   │                                       │
   │ ── postMessage to embed: { pst } ────▶│ (within shell origin allow-list)
   │                                       │
   │ ── persona switch ────────────────────▶│ rotate token; old T1 is dead
   │                                       │
```

Properties:
- **Opaque to the browser.** Token is an HMAC-signed envelope `{personaId, authProfileId, exp, version}` — the browser cannot parse or correlate it across sessions.
- **Origin-scoped.** Tokens are issued bound to the AigentZ shell origin allow-list (`embedPolicy.authAllowedOrigins`); a leaked token outside that origin set fails verification.
- **Rotating.** Every persona switch issues a fresh token; the previous one is rejected. Sign-out invalidates all tokens for the session. TTL is short (15–30 min) and refreshed via cookie.
- **Server-resolvable only.** The path `T1 → T0` exists exclusively on the AigentZ server. No client code, no third-party origin, no public observer can perform the resolution.

#### 4.1.e How a persona maps to a content asset without leaking T0

This is the answer to "if the wire identifier is ephemeral, how does gating work?":

1. User enters the SmartWallet shell. Authenticated session cookie established. Server resolves cookie → `authProfileId` → `personaId` (T0).
2. Server issues a `personaSessionToken` (T1) and returns it as part of `ActivePersonaSurface`. Browser stores T1 in shell-origin storage.
3. User navigates to a codex tab. Surface URL carries `?pst=<T1>` (not `?personaId=`).
4. The codex tab page-route receives the request, server-side calls `getActivePersona(req)`, which:
   - reads the session cookie (preferred, same-origin), or
   - reads `?pst=` from the URL (cross-cartridge), and
   - resolves T1 → `ActivePersonaContext` (T0).
5. The page-route uses the T0 context to call `getContentDescriptor(assetId)` and `evaluateAccess(context, descriptor, action)`.
6. The response sent back to the browser contains the gate decision and the delivery payload (or proxy URL). It does **not** contain the T0 personaId. The browser only ever holds the T1 token.
7. For on-chain or DVN-receipt traffic, the server computes a fresh `aliasCommitment` (T2) per tx via the cohort/wallet alias service. The receipt anchors the T2 alias only.

The mapping is **always server-internal**. The client never names a persona; the server names it from the session/token.

#### 4.1.f Consented disclosure — `discloseCredential`

When a compliance flow legitimately requires a confidential credential (e.g. an investor lookup against `nakamoto_knyt_personas`, a KYC verification, a Root DiD reputation read, or surfacing the holder's FIO handle on an explicit identifiable interaction), the requesting code path calls a separate, audited disclosure function:

```typescript
interface DisclosedPersonaCredential {
  fioHandle?: string;                   // T0 → consented surface (rare, identifiable contexts)
  rootDid?: string;                     // did:fio:* or did:iq:* — only when consented
  rootReputationBucket?: number;        // 0..5 from RQH — only when consented
  isInvestor?: boolean;                 // CRM compliance flag — only when consented
  legalIdentityRef?: string;            // KYC record id, never the record itself
  kybeAttestation?: string;             // proof-of-personhood, when World ID is wired
  consentReceiptId: string;             // DVN receipt anchoring the disclosure event
}

async function discloseCredential(
  context: ActivePersonaContext,
  requesterContext: { route: string; reason: string; scope: 'investor'|'kyc'|'reputation'|'root_did'|'fio_handle' },
): Promise<DisclosedPersonaCredential>;
```

Properties of `discloseCredential`:

1. **Returns from a BlakQube unwrap or a server-internal column read.** Confidential credentials are not in the persona's open columns at rest where possible; disclosure is an explicit decrypt step.
2. **Emits a sync DVN receipt** anchored to a fresh cohort alias commitment — never to the persona UUID, fioHandle, or root DiD directly. The receipt records *that* a disclosure happened in a given scope; it does not record the disclosed value.
3. **Requires explicit consent.** Persona's consent for routine compliance scopes (investor cohort) is granted at cohort-opt-in time; ad-hoc reads (root_did audit, kybe attestation) require per-request explicit consent.
4. **Strictly server-internal.** Never called from client code. The endpoint that needs the credential calls it, uses the value to make a decision, and discards it before the response is built.
5. **Scoped minimum-disclosure.** Each call returns only the field(s) the requester's scope needs. Asking for `scope: 'investor'` returns `isInvestor` only — never `rootDid` or `fioHandle`.

#### 4.1.g What the resolver does and does not do

Server-side: `getActivePersona(req)` returns `ActivePersonaContext` (T0). Today's `effectivePersonaId`, raw `personaId` URL-param reads, `KnytTab` candidate-chain, `useCodexEmbedAuthBridge` server-resolution, and CRM email lookups all collapse into this single function.

Client-side: `useActivePersona()` (a thin replacement for the current persona hooks) returns `ActivePersonaSurface` (T1). The browser never sees T0.

`discloseCredential` (§4.1.f) is a separate server-only function called by a small set of compliance-bearing routes. Most surfaces never call it.

**Use-case grounding.** A KNYT prospect or non-investor never has their root DiD or fioHandle touched: they purchase a comic, the URL carries `?pst=<T1>`, the page-route resolves T1 → T0 server-side, calls `evaluateAccess`, returns the gate decision without naming the persona to the browser. A KNYT investor has provided root-DiD-level data at investor onboarding (KYC); their compliance-bearing reads go through `discloseCredential` with `scope: 'investor'`. The audit trail records that the check happened; the value never leaves server memory and never appears on the wire.

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
  receipt: {
    mode: 'sync' | 'async';             // sync = anchored before return; async = queued
    receiptId?: string;                 // present if mode='sync' or already queued
    aliasCommitment: string;            // alias attribution (NEVER personaId or rootDid)
    cohortId: string;
  };
  expiresAt?: string;                   // for ephemeral signed-URL grants
}
```

A single function — `evaluateAccess(persona: ActivePersona, content: ContentAccessDescriptor, action: AccessAction, opts?: { requireSyncReceipt?: boolean })` — returns this. Every gate in the system, on every surface, calls this and trusts the answer.

**Sync vs async receipt emission (operator-decided: async by default).**
- `requireSyncReceipt: false` (default): the decision is returned at DB latency; the receipt is enqueued and the DVN pipeline (`services/dvn/qubetalkReceiptPipeline.ts` + `receiptFinalizationService.ts`) anchors it asynchronously with retry/backoff. A reconciliation sweep picks up any drops. Used for high-frequency reads (PDF page, video stream, content list, tool invocation list).
- `requireSyncReceipt: true` (opt-in): the function blocks on DVN anchoring before returning. Reserved for the small set of consequential actions where the receipt is the proof and the action must not happen without it: **mint, transfer, payment-settle, policy-escalation, root-DiD disclosure, kybe attestation**. Failure to anchor returns `allow: false, reason: 'policy-blocked'`.

Sync mode inherits canister latency; async mode does not. The decision boundary is set per action type in `services/access/policyResolvers.ts`, not per surface.

### 4.4 Cohort alias commitment (the on-chain identifier)

Per `2026-04-27_cohort-escrow-root-did-reputation-backlog.md`, the only identifier that ever reaches a public chain (or a public DVN receipt) is an **ephemeral cohort alias commitment**:

```typescript
interface CohortAliasCommitment {
  aliasCommitment: string;              // hash(persona_uuid + cohort_id + salt)
  cohortId: string;                     // dynamic; tx- or group-scoped; never permanent
  expiresAt: string;                    // Escrow canister purges after this
}
```

- One-way hash; the path from `aliasCommitment` → `personaId` is held server-side only and exists only for the escrow window. Once the escrow window expires, the Escrow canister calls `purge_expired()` and the mapping is destroyed.
- Flags raised against an alias during the escrow window route through FBC → RQH and update the **root-level** reputation bucket on `root_identity` — without the cohort ever knowing which persona was involved and without the persona-to-root link being on-chain.
- Receipts attribute actions to `aliasCommitment + cohortId`, **not** to `personaId` and **never** to `rootDid`. The DVN's privacy guarantee depends on this.

### 4.5 The three contracts in one sentence

> **`getActivePersona` returns the server-only context (T0); the browser holds only an opaque session token (T1) and the public network sees only an ephemeral alias commitment (T2). `getContentDescriptor` returns what the asset is. `evaluateAccess` returns whether you can use it — and emits an alias-anchored receipt. Confidential credentials require an explicit consented disclosure. No surface ever decides on its own; no public receipt ever names you; no browser state ever holds a correlatable persona handle.**

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

**1.1 Server-side `getActivePersona`**
- New file: `services/identity/getActivePersona.ts` — composes `personaRepo.getCallerAuthProfileId` + `multiEmailIdentity.getMergedLinkedAuthProfileIds` + admin-check + cohort-resolver into one `ActivePersonaContext` (T0). Note: `isInvestor` is **not** in the context — that goes through `discloseCredential` with `scope: 'investor'`.
- Existing routes keep their current resolution paths working in parallel; new routes call `getActivePersona`. Migration is one route per commit.

**1.1.a `personaSessionToken` issuance and resolution (T1)**
- New service: `services/identity/personaSessionToken.ts` — HMAC-signed envelope `{personaId, authProfileId, exp, version}`. Issue on session start, persona switch, and explicit refresh. Verify + resolve back to `ActivePersonaContext` on every request. Origin-bound to `embedPolicy.authAllowedOrigins`.
- Storage migration: existing `currentPersonaId` / `activePersonaId` localStorage keys are renamed and replaced with `personaSessionToken`. A one-shot migration in `useCodexEmbedAuthBridge` swaps any legacy raw-UUID value for a freshly issued token (server round-trip). Backward-compatibility window: the resolver accepts raw UUIDs from legacy storage for one release cycle, then rejects.

**1.1.b `buildCodexUrl` migration `?personaId=` → `?pst=`**
- Edit: `utils/codex-nav.ts` `buildCodexUrl()` — replace `?personaId=` with `?pst=` carrying the T1 token.
- Edit: `app/(embed)/triad/embed/codex/[codexSlug]/page.tsx` — read `?pst=` server-side, resolve to `ActivePersonaContext` before rendering. The page never echoes T0 to the browser; it returns `ActivePersonaSurface` (T1) only.
- Backward compat: the page-route accepts `?personaId=` for one release cycle and treats it as a deprecated input that triggers an immediate token-issue + redirect, scrubbing the URL.

**1.1.c Client-side `useActivePersona()` hook**
- New file: `app/hooks/useActivePersona.ts` — returns `ActivePersonaSurface` (T1 token + display flags). Replaces ad-hoc `currentPersonaId` reads in surface components.
- `useCodexEmbedAuthBridge` continues to exist as the postMessage handler, but its internal state migrates to T1 tokens.

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

### Phase 4a — TokenQube on-chain ownership proof for state D (pool / streaming)

**Outcome:** for state-D content, the gate is satisfied by an on-chain (or DVN-internal) ownership proof against any pool TokenQube. Pool tokens are minted at entitlement grant per Decision §11.4. Build now; activate post-alpha launch per Decision §11.7.

**4a.1 Challenge / verify endpoints**
- New route: `POST /api/access/tokenqube-challenge` — issues a server-signed nonce bound to `(personaId, assetId, action)` with short TTL.
- Client signs with the TokenQube's owning key via the SmartWallet.
- New route: `POST /api/access/tokenqube-verify` — validates signature + on-chain ownership; if valid, mints a short-lived decrypt grant.

**4a.2 Shared-key decrypt**
- After verification, server unwraps the **shared** content key from the asset's wrapped-key blob (IPFS or AutoDrive sidecar). Decrypts the shared BlakQube on AutoDrive. Streams page-image / video segment to the holder.
- Asset-keyed update semantics: when the operator updates the content, a new ciphertext + new CID are produced under the **same** content key; existing pool tokens still decrypt.

**4a.3 Pool mint at entitlement grant**
- `services/rewards/purchaseHandler.ts` — on bundle/SKU purchase or cohort assignment, mint pool TokenQubes synchronously per Decision §11.5. Sync receipt under §11.2 (mint is consequential).
- Cross-chain: mint on the persona's primary chain only per Decision §11.4. Bridging is a separate operation.

**Backward compatibility:** state-C entitlement-table gating remains; state-D adds the on-chain path with entitlement-table fallback if the chain is unreachable. Operator migrates any specific asset C → D via "Mint as iQube (pool)" admin action.

**Acceptance for D:** holding any pool TokenQube for an asset is sufficient and necessary to read it. Receipt of access is alias-anchored. Transfer of a pool TokenQube transfers access; revocation flips the pool token's revoked flag in the canister and the next access fails verification.

---

### Phase 4b — Sovereign TokenQube + per-holder ciphertext for state E

**Outcome:** for state-E content, each holder has their own ciphertext, their own content key, and their own TokenQube NFT. Holders can copy the ciphertext off-platform and continue to decrypt with their key. This is the true non-fungible-custody case used for collector editions, signed first prints, and sovereign-grade investor instruments.

**4b.1 Per-holder mint**
- New service: `services/iqube/sovereignMint.ts` — for each holder of a state-E edition, generate a fresh content key, encrypt the plaintext under that key (yielding a unique ciphertext with a unique CID), upload to AutoDrive, wrap the per-holder key with the holder's master key, mint the NFT TokenQube on the persona's primary chain, and atomically record the per-holder triple on `master_content_qubes` with an extension table `iq_sovereign_holders` keyed by `(masterId, personaId, tokenQubeId)`.
- Pre-mint at iQube creation time (no deferred mint — sovereignty implies the on-chain edition exists from t=0).

**4b.2 Per-holder decrypt path**
- Same challenge/verify endpoints as 4a, but `evaluateAccess` resolves the holder's specific TokenQube and unwraps the **per-holder** content key, decrypting the **per-holder** ciphertext. Receipt is alias-anchored to the holder's cohort, not to the asset's pool.
- Holder may export the ciphertext + their wrapped key blob for off-platform custody. With possession of both they can decrypt without ever calling AigentZ.

**4b.3 Mixed-mode mint**
- A single underlying work can publish state-D + state-E surfaces simultaneously against the same plaintext. The "Mint as iQube" admin action takes a `models: ('pool' | 'sovereign')[]` array and a sovereign edition count.

**Backward compatibility:** state-D path is unchanged. State-E is purely additive. If a sovereign holder later wants to surrender custody back to a pool license, that is a separate flow — Phase 5 territory or beyond.

**Acceptance for E:** every state-E edition has a unique CID, a unique content key, a unique on-chain TokenQube, and a unique entry in `iq_sovereign_holders`. Transfer of the NFT transfers access on-chain. Holder-side off-platform decryption succeeds without the platform.

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
6. **Every receipt-eligible event attributes via `aliasCommitment + cohortId`, never `personaId` or `rootDid`.** This is the privacy-first mandate. The Escrow canister mints the alias for the action, the receipt anchors it on Bitcoin (or the relevant chain), and the alias is purged when the escrow window expires. Root-DiD reputation impact is routed anonymously through FBC → RQH; the link from alias → root is held server-side only and is destroyed at escrow purge. No public surveyor of the chain can link a transaction to a persona, an authProfileId, or a real-world identity. Compliance-bearing reads of `rootDid` go through `discloseCredential` (§4.1.b), not through receipt metadata.
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

- [ ] **Identity (server-side):** `getActivePersona` is the only function that produces an `ActivePersonaContext`. Every server-side gate uses it.
- [ ] **Identity (client-side, T0 containment):** searching the entire client bundle for `personaId` UUIDs, raw `fioHandle` strings, or `did:fio:` / `did:iq:` substrings returns zero matches outside legacy compat shims. The browser only ever holds `personaSessionToken`.
- [ ] **Wire-side identifier:** every URL, postMessage, and persistent client storage key carrying a persona handle uses `personaSessionToken` (T1) inside the trusted shell or `aliasCommitment` (T2) on public networks. No raw `?personaId=` remains after the Phase 1 deprecation window.
- [ ] **Confidential disclosure:** every read of `rootDid`, `fioHandle` (in identifiable contexts), investor status, KYC, or legal identity goes through `discloseCredential` with a scoped reason, emits a sync DVN receipt, and never leaks the value into client state.
- [ ] **Content:** every content row's openness/gating/encryption state and uniqueness mode (D pool vs E sovereign) is decidable from `getContentDescriptor`. No surface infers state from URL or filename.
- [ ] **Decision:** every gate-evaluation in the codebase is a call to `evaluateAccess`. Searching for `userOwnsAsset` outside `services/access/*` returns nothing.
- [ ] **Encryption parity:** any row with `gating_kind IN ('payment','credential')` has `encryption_iv != ''`, regardless of storage backend.
- [ ] **Receipts:** every receipt-eligible action emits an OrchestrationEvent attributed via `aliasCommitment + cohortId` (never `personaId` or `rootDid` in clear). DVN ordinal anchor confirmed within 24h for async; before-return for sync. Public chain inspection of any receipt cannot link to a persona or real-world identity.
- [ ] **Sovereignty (D):** for any state-D asset, ownership of any pool TokenQube (verified on-chain or DVN-internal) is sufficient to access the shared payload.
- [ ] **Sovereignty (E):** for any state-E asset, the holder's unique TokenQube unwraps the holder's unique content key, decrypting the holder's unique ciphertext. Transferring the NFT transfers access. The holder can copy the ciphertext off-platform and continue to decrypt.
- [ ] **Spine:** persona switch on any surface synchronously clears ownership state on all open surfaces. OWNED-badge ≡ gate-allow by construction.
- [ ] **No fallback drift:** after Phase 5 cleanup, no duplicate persona resolver, ownership fetcher, or gate evaluator remains.

---

## 11. Operator decisions — locked

The following are settled. Phase 1 builds against them.

| # | Decision | Operator call |
|---|---|---|
| 1 | Resolver name | **`getActivePersona`** |
| 2 | `evaluateAccess` receipt mode | **Async by default; sync (`requireSyncReceipt: true`) opt-in for mint, transfer, payment-settle, policy-escalation, root-DiD disclosure, kybe attestation.** Decision boundary set in `services/access/policyResolvers.ts`, not per surface. |
| 3 | State-B (open iQubed) gate | **Open-by-any-token.** Tokenless personas allowed via pool token issued at first access. |
| 4 | Cross-chain mint at promotion | **Primary chain only** at promotion (Base for alpha). **Confirmed:** atomic cross-chain mint is not required because (a) **LayerZero ONFT** moves NFTs across the ref-chain set on holder-initiated bridge events, and (b) **ICP `cross_chain_service` + `evm_rpc` canisters** (already in `services/ops/idl/`) enable chain-agnostic ownership verification — `evaluateAccess` queries the canister, which discovers which ref chain currently holds the holder's TokenQube. The wrapped-key blob is content-addressed (IPFS / AutoDrive sidecar), so it does not move with the token. Bridging is user-driven and event-driven; the platform reads ownership wherever it currently is. See §11.b for implementation notes. |
| 5 | Pool-mode deferred mint trigger | **At entitlement grant** (purchase / cohort assignment). Simpler revocation; avoids first-access latency spike. |
| 6 | kybe_DiD activation | **Stay schema-stub** until World ID adapter is in scope. Add to backlog (see §11.a). |
| 7 | Phase 4 ordering (canonical mint) | **Develop capability now; execute post-alpha launch.** Phases 4a (state D pool/streaming) and 4b (state E sovereign) build in this cycle but go live for KNYT investor SKUs after alpha launch is stable. |

### 11.b Cross-chain (LayerZero + ICP) — confirmed implementation notes

These follow from Decision §11.4. They are not new work in Phase 4; they are constraints on the TokenQube contract template and the verifier path.

1. **LayerZero ONFT** is the bridge mechanism. The TokenQube NFT contract template must implement the LZ ONFT V2 standard so that `_lzReceive` mints a faithful representation on the destination chain and `send` locks/burns on the source. This is a contract-design constraint, not a protocol change — the template is finalised before the first canonical mint goes live.
2. **The on-chain pointer to the wrapped-key blob (URI + content hash) must survive the bridge** in the destination NFT's metadata. LZ ONFT supports arbitrary URI metadata, so this is a contract-template implementation detail. The wrapped-key blob itself is content-addressed (IPFS / AutoDrive sidecar) and does not move; the destination NFT references the same blob.
3. **`evaluateAccess` is chain-agnostic.** When verifying TokenQube ownership for a state-D or state-E asset, the access evaluator calls the ICP `cross_chain_service` canister, which (via `evm_rpc`) reads the holder's TokenQube ownership across the ref-chain set. There is no central "which chain holds what" registry — the canister discovers.
4. **State-E sovereign holders may bridge off-platform custody.** Because state-E ciphertext and the per-holder wrapped-key blob are both content-addressed, bridging the on-chain NFT to a different chain or copying the ciphertext to a holder-chosen storage backend does not require platform action. The holder retains decryption capability regardless of where the NFT lives or where the ciphertext is stored. This is the sovereignty guarantee.
5. **Receipt anchoring after bridge** continues to attribute via `aliasCommitment + cohortId` per §4.4. The chain on which the alias is anchored may differ from the chain on which the TokenQube is currently held — these are independent.

### 11.f Backlog item — proper content-preview affordances (replace the assumed "GN free preview")

**Operator clarification (2026-05-06):** an earlier handover doc described a "GN free-preview short-circuit" treating episode 0 (`mk_ep00_print_common`) as free-by-default. This was aspirational, not implemented, and not the operator's intent. The GN is paid content; my Phase 1.4 commits incorrectly mirrored that aspirational language by overriding `gating.kind = 'free'` on ep=0 in `getContentDescriptor`. Reverted in commit immediately following this row.

**The real preview need:** users browsing the store should be able to **sample** gated content before buying — first N pages of a print episode, first 30–60s of a motion comic, first scene of a video. Today's "preview" buttons in the store are not implemented. The right design needs a small spec.

**Sketch (when this work is in scope):**

1. **Schema** — add `preview_window_pages` / `preview_window_seconds` columns on `master_content_qubes` and `codex_media_assets`. Operator-editable per-asset; `0` or NULL means "no preview." Defaults set by content_type / asset_kind:
   - `episode_print` / `gn` → 5 pages
   - `episode_motion` / `episode_still` → 30 seconds
   - `character_card` → no preview (the card itself is the preview)
2. **Descriptor** — extend `ContentAccessDescriptor` with an optional `preview` field:
   ```typescript
   preview?: { kind: 'pages' | 'seconds'; window: number };
   ```
   `getContentDescriptor` populates this when `preview_window_*` is non-zero on the row. The descriptor itself remains gated (`gating.kind` unchanged); the preview is a *partial* delivery, not a re-classification.
3. **Delivery proxies** — extend the four content-delivery routes (`pdf-page`, `video`, `pdf`, `cover`) with a `?preview=1` query param. When present AND the descriptor has a preview window, the proxy serves only the preview window (page ≤ window for PDFs; clip 0–N seconds for video). Beyond the window: 403 with reason `preview-exhausted`.
4. **Spine action** — add `'preview'` to `AccessAction` union. `evaluateAccess(ctx, desc, 'preview')` returns `ALLOW/preview-window` for any persona regardless of ownership; non-preview actions (`read`, `watch`) still gate normally.
5. **Receipt anchoring** — preview reads ARE receipt-eligible (`async` mode) so the conversion funnel is auditable. Operator can later analyse "previewed but did not buy" cohorts via DVN trail.
6. **UI** — store-card "Preview" button calls the proxy with `?preview=1`. Lock overlay surfaces "Preview ended — buy to continue" CTA after the window.

**Why this is its own backlog row, not Phase 2:**
- Distinct from Phase 2 (Supabase WIP encryption parity) — preview can ship before or after, independently
- Requires UX/product decisions (how many pages? does each tier get a different window?) that aren't urgent for IAM correctness
- Acceptance criterion is product-driven (conversion lift), not security-driven

**Files when ready:**
- `supabase/migrations/<date>_preview_windows.sql` — schema
- `services/content/getContentDescriptor.ts` — populate descriptor.preview
- `services/access/evaluateAccess.ts` — handle 'preview' action
- `app/api/content/{pdf-page,video,pdf,cover}/[cid]/route.ts` — `?preview=1` branch
- `types/access.ts` — extend AccessAction + ContentAccessDescriptor
- `app/components/content/SmartContentActions.tsx` — preview button wire-up

---

### 11.e Backlog item — retire the debug-endpoint auth bypass; replace with first-class operator inspection

**Status (2026-05-05, current):** during Phase 1.4 spine verification a tactical bypass was hardcoded ON in `services/access/debugBypass.ts` (`isDebugBypassEnabled()` returns `true`). It affects ONLY the three debug endpoints — `/api/access/inspect`, `/api/access/whoami`, `/api/access/list-assets` — and never the four content-delivery gates or `/api/wallet/active-persona`. The bypass was operator-authorised to unblock spine verification when the auth flow was fighting them.

**Operator principle (2026-05-05):** a bypass is itself an IAM anti-pattern. The whole purpose of this workstream is to eliminate exactly this kind of emergency mechanism. The bypass is therefore tracked as a workstream item, not as a forget-me revert.

**Resolution (Phase 5 territory):** spine-native operator inspection. Replace the bypass with:

1. **A first-class "operator inspect" capability resolved through the spine itself.** The active persona's `cartridgeFlags.canInspectAccess` (new flag, granted via `crm_admin_roles` with a new `inspect-access` role) gates the three debug endpoints. No bypass, no env var — the spine answers "is this caller allowed to inspect?" the same way it answers every other access question.
2. **A persona-impersonation affordance for admin-grade debug.** Inspect endpoints accept an `?asPersonaId=<uuid>` query param honoured only when `cartridgeFlags.canImpersonateForDebug` is true. The synthesised context is the impersonated persona's real context (with the impersonator's authProfileId stamped on every emitted receipt). This is how the operator tests "what would persona X see?" without bypassing auth.
3. **Receipt anchoring on every debug call.** Inspect/whoami/list-assets calls become receipt-eligible actions of action type `disclosure` (already in the `AccessAction` union, sync-receipt by §11.2). The DVN audit trail records every operator inspection — both the impersonator's persona and the impersonated target are anchored via cohort alias commitments.
4. **Restoration of strict auth on the three debug endpoints.** `isDebugBypassEnabled()` removed entirely (or hardcoded to return false). The auth wall is back; the inspection capability comes from the persona's role, not from the absence of a wall.

**Why this fits the spine philosophy:** every "who can do what" question — including operator debug — flows through the same `getActivePersona` + `evaluateAccess` chain. There is no "second auth path for ops." Operator inspection is a permission, not a hole.

**Acceptance:**
- `services/access/debugBypass.ts` deleted (or `isDebugBypassEnabled()` returns false unconditionally)
- `cartridgeFlags.canInspectAccess` and `cartridgeFlags.canImpersonateForDebug` added to `ActivePersonaContext` and `ActivePersonaSurface`
- Inspect/whoami/list-assets gated by `canInspectAccess`; impersonation gated by `canImpersonateForDebug`; both checked through `evaluateAccess`
- Every inspection call emits a sync DVN receipt with `disclosure` action; alias-anchored per §4.4
- Operator can hit `/api/access/whoami` from a non-admin persona and get 403 (not 401), proving the gate is working at the role layer not the auth layer

**Predecessors:** the bypass commits in this workstream — `a780cf4` (env-gated) and `5e5c2d0` (hardcoded ON) — are the artifacts to retire.

---

### 11.d Backlog item — bounded delegation: agent identifiability floor from operator

**Operator concern (raised on v3 review):** an Aigent persona delegated by a human operator must not present a higher identifiability than its operator currently does. If the operator's persona is `anonymous`, an agent acting on their behalf cannot disclose at `identifiable` even if the agent's own declared identifiability would allow it. This is the canonical rule from `AIGENT_DIDQUBE_IDENTITY_UPGRADE_NOTE.md` §6 ("an Aigent should mirror its owner's or client's identifiability policy directly as a delegate") and §7 ("personas may vary, accountability must persist").

**Goal:** when `getActivePersona` resolves an agent persona, clamp the returned `identifiability` to the **floor** of (agent's declared identifiability, operator's current identifiability). Most-restrictive wins. The clamp is invisible to consumers — they trust the single resolved field as today.

**Why deferred from Phase 1:**
- No contract change is required. `ActivePersonaContext.identifiability` is already a single resolved value; the clamp lands inside `getActivePersona` without any consumer breakage.
- Agent-persona delegation paths are not yet routine in production traffic; today's flows are human-persona-only. Wiring the resolver against a path with no live test coverage adds regression risk for low immediate value.
- Bounded delegation (delegation scopes, cohort scope-of-disclosure, agent reputation-roll-to-root) is its own workstream. The identifiability floor is one slice of that envelope and lands alongside the rest, not as a one-off here.

**Sketch of the resolver (when this work is in scope):**

```typescript
// inside getActivePersona, after persona row read
if (personaRow.is_agent_persona) {
  const operatorIdentifiability = await resolveOperatorIdentifiabilityForAgent(personaId);
  context.identifiability = floorIdentifiability(
    context.identifiability,
    operatorIdentifiability,
  );
}
```

Where `resolveOperatorIdentifiabilityForAgent` walks `agent_persona → owner_root_identity → root_identity → currently-active human persona` and returns that human persona's `default_identity_state`. `floorIdentifiability` returns the most-restrictive of the two values (anonymous > semi_anonymous > semi_identifiable > identifiable).

**Tables touched (already in schema):** `agent_persona`, `agent_root_identity`, `root_identity`, `personas`. No new columns required.

**Acceptance:**
- An agent persona with declared `identifiability='identifiable'`, owned by a human persona currently set to `anonymous`, returns `identifiability='anonymous'` from `getActivePersona`. Surfaces render anonymous-mode UI accordingly.
- `discloseCredential` invocations from an agent context are bounded by the operator's floor — an agent cannot disclose `rootDid` if its operator's current persona is at `anonymous` or `semi_anonymous`, even if a compliance flow asks for it. The disclosure receipt records the refusal.
- `evaluateAccess` continues to read `context.identifiability` as a single value with no awareness of whether the floor came from a delegation chain — the contract is unchanged.

**Predecessors:**
- `AIGENT_DIDQUBE_IDENTITY_UPGRADE_NOTE.md` (one root, multiple bounded personas; persona-level presentation may vary, root-level accountability must persist)
- `2026-04-27_cohort-escrow-root-did-reputation-backlog.md` (delegation_scopes structure for join_cohort, read_cohort_reputation, submit_evidence)

---

### 11.c Backlog item — subpoena-resistant T1→T0 (zero-knowledge session resolution)

**Operator concern (raised on v3 review):** the plan as written has the AigentZ server able to reverse `personaSessionToken` (T1) back to `personaId` (T0). That is the design intent today — the server needs to gate access — but it leaves the platform itself as a single point of compelled disclosure. A subpoena, an insider, or a compromised key could in principle re-link a T1 token to a persona UUID.

**Goal:** make T1→T0 resolution un-performable by the platform alone, even with full DB and server-key access.

**Sketch of approaches (to be evaluated when this work is in scope):**

- **Holder-side resolution** — the T1 token is a commitment that can only be opened with a key held in the holder's wallet (not by AigentZ). Server-side gating becomes a zero-knowledge proof flow: the holder proves "I am the persona that owns asset X" without revealing which persona. Threshold or MPC scheme so that no single party (including AigentZ) can complete the resolution.
- **Per-tx blinded session tokens** — instead of a single rotating T1 token, every server request carries a fresh blinded credential derived from a holder-held secret. The server verifies the credential without learning the underlying personaId. Similar to anonymous credentials (Brands, Camenisch-Lysyanskaya) or BBS+ signatures.
- **ICP-anchored proof gate** — defer resolution to an ICP canister that holds the only mapping; AigentZ never has it. The canister enforces policy (e.g. only the holding wallet can request a resolution; rate-limited; auditable). This shifts the trust boundary to ICP's permissionless governance rather than AigentZ.

**Status:** backlog. None of the above is required for Phase 1–5 as currently planned; the v3 architecture is already a substantial privacy upgrade over today's "personaId in localStorage and URL" baseline. This row records the operator's intent to harden further once the foundational work is stable.

**Predecessors:** the wallet-alias / DVN OTA scheme (`2026-04-29_plaintext-wallet-address-deprecation.md`) is the closest existing model in the codebase. It is a useful starting reference for any zero-knowledge T1→T0 design.

**Acceptance (when this lands):** even with full read access to AigentZ's database, server-side keys, and source code, an adversary cannot construct a working T1→T0 mapping for any persona. Only the holder can authorise a resolution.

---

### 11.a Backlog item — kybe_DiD surface activation

Captured here for routing into the next cycle:

- **Trigger:** when a World ID adapter (or equivalent proof-of-personhood protocol) lands in the platform.
- **Scope:** surface kybe_DiD *presence* (boolean) in `IdentityIQubeDrawer` — never the address, never the value.
- **Owner:** TBD; aligns with the comprehensive identity doc backlog (`2026-04-29_identity-management-comprehensive-doc-backlog.md`).
- **Files when ready:** `components/iqube/IdentityIQubeDrawer.tsx`; new resolver `services/identity/kybeAttestationService.ts`.
- **Until then:** the `public.kybe_identity` table stays application-stub as documented in §15.8 of `AIGENT_DIDQUBE_IDENTITY_UPGRADE_NOTE.md`. No code reads or writes the column beyond the dev stub.

---

## 12. Sequence summary

```
Phase 0   (1 day)   types only — operator approval gate (decisions §11 already locked)
Phase 1   (2 wk)    spine + first 7 consumers (getActivePersona, async receipts default,
                    discloseCredential plumbing) — eliminates today's regressions
Phase 2   (2 wk)    Supabase WIP encryption + decrypt proxy — closes leak (state C live)
Phase 3   (1 wk)    DVN policy hook + alias-anchored receipts (no rootDid in clear)
Phase 4a  (2 wk)    State D: pool TokenQube on-chain proof + shared-key decrypt
                    [develop now; activate post-alpha launch]
Phase 4b  (2 wk)    State E: sovereign TokenQube + per-holder ciphertext
                    [develop now; activate post-alpha launch]
Phase 5   (1 wk)    cleanup + retire dead paths
```

Phases 0–3 give a clean baseline that resolves every May 2026 regression without changing the storage or chain story and **without ever exposing a rootDid by default**. Phases 4a and 4b light up the full iQube sovereignty model — both pool and sovereign — on top of the same spine, asset by asset, on operator schedule.

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
