# Identity Sovereignty Architecture

Understanding how identity, data integrity, and verifiability work together in the iQube protocol stack — and why this design is a significant trust advantage.

> **Phase 1 IAM spine — LIVE on dev (2026-05-08).** The runtime implementation of the four-layer protocol described below is now shipped end-to-end on the AgentiQ platform. Every consumer (delivery proxies, UI components, the SmartTriad spine, the wallet drawer, embed bridges) reads identity + content + access decisions from a single source-of-truth chain (`getActivePersona` → `personaSessionToken` → `evaluateAccess`). The protocol layers below describe **what** the system guarantees; the access spine is the runtime that delivers those guarantees uniformly. See "Querying the spine from a thin client" at the end of this doc for the integration contract.

---

## The Four Layers

AgentiQ OS identity is not a single mechanism. It is four cooperating layers, each with a distinct concern. Together they give developers and users a model of identity that combines **accountability**, **privacy**, **data integrity**, and **survivability** in a way no centralised identity system can match.

| Layer | What it does | When it activates |
|-------|-------------|-------------------|
| **DIDQube / Root DiD** | Anchors identity | On FIO handle registration (automatic) |
| **DVN pipeline** | Captures all material events as tamper-evident ordinal inscriptions | On every receipt-eligible OrchestrationEvent (automatic) |
| **blakQube encryption** | Protects persona data in Supabase | On every persona write (automatic) |
| **Auto-Drive minting** | Makes persona data survivable and independently verifiable | On explicit opt-in mint |

---

## Layer 1 — DIDQube and Root DiD

When a developer registers a FIO handle, two things happen atomically:

1. The FIO handle is registered on the FIO blockchain (`@qripto` or `@knyt` domain). The system account pays the fee; the developer's public key becomes the cryptographic owner.
2. A **Root DID** is assigned: `did:fio:<handle>`. This is the enduring accountability anchor for every activity the persona undertakes.

The Root DiD is not a database record. It is a cryptographically owned identifier on a live public blockchain. No platform can reassign or revoke it — only the holder of the corresponding private key controls it.

The DIDQube is the iQube representation of this Root DID — it holds the identity, links to the persona's reputation record, and is the anchor for all DVN receipts.

**ICP anonymous verification**: The DIDQube also has a representation on ICP (Internet Computer Protocol). It can be independently verified there. Critically, and **by design**, the ICP identifier is anonymous — even the holder cannot specify which ICP transaction or canister ID relates to them. This is privacy-preserving accountability: the protocol can prove identity without revealing it. A verifier can confirm that a Root DID has been active and has accumulated receipts, without learning anything about the underlying person. This is the canonical design choice and a deliberate trust advantage.

---

## Layer 2 — DVN Pipeline (Automatic Event Anchoring)

Every material event in the platform — mission completions, delegation grants, policy blocks, trust progressions, payment settlements — emits a receipt-eligible `OrchestrationEvent`. Events marked `receipt_eligible: true` are:

1. Written to the `orchestration_events` Supabase table with the actor's Root DID in metadata
2. Batched and submitted to the DVN pipeline as **ordinal inscriptions** — permanently recorded on Bitcoin

This happens automatically, with no action required from the developer or user. **You do not need to mint a PersonaQube to have tamper-evident event records.** Your DVN receipt trail begins the moment your FIO handle is registered and your first event fires.

The DVN is the tamper-evident event record layer. It answers: *did this thing happen, at this time, attributed to this Root DID?* — and it answers it in a way that can be verified without trusting this platform.

---

## Layer 3 — blakQube Encryption (Platform Data Integrity)

Sensitive persona data (PII, private attributes) is stored in Supabase as the `blakQube` — encrypted with AES-256-GCM using a key derived from the persona's FIO handle. The encryption hash means any unauthorised modification to the stored data changes the ciphertext and is detectable.

This provides **tamper-evidence at the data layer within the platform**. However, it does not provide independent verifiability outside the platform — a third party would need to trust Supabase and the application layer to confirm the data hasn't been modified.

This is what Layer 4 addresses.

---

## Layer 4 — Auto-Drive Minting (Survivability and Open Verifiability)

Minting the persona as a PersonaQube on Autonomys Auto-Drive moves the blakQube from a platform-controlled encrypted store to a **content-addressed, decentralised network**. The key differences:

### Survivability
The PersonaQube data persists on Autonomys even if AigentZ goes offline, the Supabase instance is lost, or the platform ceases to operate. A developer's identity, reputation snapshot, and capability bindings survive independently of this platform.

### Portability
Any system that implements the iQube standard can fetch and verify the PersonaQube by its CID (Content Identifier). No API key, no AigentZ account, no trust in this platform required.

### Open network accessibility
The PersonaQube CID is a content hash — it proves the data is exactly what was committed at mint time. A third party can verify the persona data without trusting AigentZ's database or API.

### Cryptographic composability
When a SkillQube, AigentQube, or ExperienceQube binds to a PersonaQube, it binds to an **immutable CID** — not a mutable database foreign key. If the underlying data changes (requiring a new mint and a new CID), the binding is broken, not silently updated. This is a stronger integrity model.

---

## How the Layers Work Together

```
FIO Handle registered
       │
       ├── Root DID created (did:fio:<handle>)
       │       └── DIDQube anchored on FIO blockchain + ICP (anonymous)
       │
       ├── DVN pipeline activated
       │       └── All receipt-eligible events → ordinal inscriptions on Bitcoin
       │               └── Anchored to Root DID
       │
       ├── blakQube written to Supabase
       │       └── AES-256-GCM encrypted, hash-detectable tampering
       │
       └── (Optional) PersonaQube minted to Auto-Drive
               └── CID-addressed, survivable, independently verifiable
               └── SkillQube / AigentQube bindings use CID (not DB FK)
```

A developer who never mints still has:
- A real Root DID on FIO blockchain
- A growing DVN receipt trail anchored to that Root DID
- Encrypted persona data with tamper-evident storage in Supabase
- ICP anonymous verification capability

A developer who mints additionally has:
- Persona data that survives platform failure
- A publicly verifiable CID that any iQube-compatible system can read
- Cryptographic composability with the broader iQube ecosystem

---

## Why This Matters for Builders

If you are building a cartridge, registering an AigentQube, or designing a mission flow, this architecture means:

- **You can trust DVN receipts** — they are not platform attestations. They are ordinal inscriptions on Bitcoin. You can verify them independently.
- **Persona data integrity is detectable** within the platform even without minting.
- **Minting is the step from platform citizen to protocol citizen** — it is opt-in, but it is the path to full sovereignty and ecosystem portability.
- **ICP anonymous verification means identity is provable without being exposable** — a verifier can confirm an agent has accumulated legitimate standing without learning anything about the person behind it.

This layered model — automatic anchoring at the event level, encrypted integrity at the data level, and optional content-addressed sovereignty at the identity level — is a deliberate design choice. It allows the platform to provide strong accountability guarantees while preserving user privacy and enabling full sovereignty for those who want it.

---

## Querying the spine from a thin client

Building on top of AgentiQ OS — running your own thin client, embedding cartridges, surfacing persona state in your own UI — means consuming the access spine through one stable endpoint. The full integration contract is in `codexes/packs/agentiq/updates/2026-05-07_thin-client-active-persona-integration.md`. The shorthand:

### Endpoint

```
GET https://dev-beta.aigentz.me/api/wallet/active-persona
Authorization: Bearer <supabase-jwt>
```

### Response (200 OK)

```jsonc
{
  "personaSessionToken": "<opaque-T1-handle>",   // resolves to T0 only on the AigentZ server
  "identifiability": "anonymous" | "semi_anonymous" | "semi_identifiable" | "identifiable",
  "cartridgeFlags": { "isAdmin": false, "isPartner": false },
  "displayLabel": "Knight",                       // user-chosen pet name
  "ownFioHandle": "alice@knyt",                   // their own handle (safe to render to themselves)
  "cohortMemberships": [],
  "sessionExpiresAt": "2026-05-08T01:00:00.000Z"
}
```

### Persona-change broadcast

When the active persona changes inside the platform iframe (wallet drawer dropdown, persona-quick-add, cartridge-default switch), the platform `postMessage`s `aa-persona-change-v1` to:

- All child iframes (codex embeds, runtime embeds)
- The parent window (when the platform is itself iframed inside a thin client)

Listen and refetch:

```typescript
window.addEventListener('message', async (event) => {
  if (event.origin !== 'https://dev-beta.aigentz.me') return;
  if (event.data?.type !== 'aa-persona-change-v1') return;
  const fresh = await loadActivePersona();
  renderHeader(fresh);
});
```

### Forbidden / common pitfalls

| Don't | Why |
|---|---|
| Use `personaId` from `aa-persona-change-v1` payload as a key | T0 server-internal handle; treat the message as a refetch trigger only |
| Cache the surface across user changes / sign-outs | `personaSessionToken` is opaque + rotating; stale tokens return 401 |
| Display `ownFioHandle` to other personas / surfaces | Surfaced only to the caller's own session; cross-persona handle resolution is forbidden |
| Skip the `Authorization: Bearer` header | Endpoint returns 401; the platform's debug bypass does not extend to it |

### What this means for builders

The four sovereignty layers (DIDQube + DVN + blakQube + Auto-Drive) are the protocol guarantees. The **access spine** is the runtime contract you call. Both are now stable. If you're building on top of AgentiQ OS, the spine is the integration boundary — you don't need to (and should not) speak to the underlying tables, services, or canisters directly.
