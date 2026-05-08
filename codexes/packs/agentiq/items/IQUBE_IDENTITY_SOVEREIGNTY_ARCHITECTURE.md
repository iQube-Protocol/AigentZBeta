# iQube Identity Sovereignty Architecture

Engineering reference for how identity, data integrity, and verifiability are layered in the iQube protocol stack. This document covers the implementation details behind each layer.

> **Phase 1 spine — LIVE on dev (2026-05-08).**
> The unified identity-and-access-management spine described in
> `updates/2026-05-05_unified-identity-content-access-foundation-plan.md`
> is shipped, validated, and load-bearing.
>
> | | |
> |---|---|
> | Unit-test suite | 25/25 GREEN locally (`tests/access-spine.test.ts`) |
> | Live integration | 4/4 GREEN on `dev-beta.aigentz.me` (`scripts/verify-spine.mjs`) |
> | Privacy-guard canary | wire payload contains zero T0 (`personaId` / `authProfileId` / `fioHandle` / `rootDid`) — verified empirically |
> | Enforce flag | `ACCESS_SPINE_ENFORCE=1` set in Amplify dev env; the four delivery proxies (`/api/content/{pdf-page,cover,video,pdf}/[cid]`) DENY at byte level for unowned content |
>
> Today the four sovereignty layers below are the canonical *protocol* model. The Phase 1 spine is the *runtime* implementation that makes every persona/content/access decision flow through a single resolver chain — `getActivePersona` (T0) → `personaSessionToken` (T1) → `aliasCommitment` (T2 — public-network only). See §"Phase 1 spine — runtime layer" at the end of this doc for the implementation index.

---

## Overview — Four Cooperating Layers

The identity model is not a single mechanism. Four layers operate together, each with a distinct concern and a distinct implementation path.

| Layer | Concern | Trigger | Tables / Services |
|-------|---------|---------|-------------------|
| **DIDQube / Root DiD** | Accountability anchor | FIO handle registration (automatic) | `personas`, FIO SDK, ICP |
| **DVN pipeline** | Tamper-evident event record | Every `receipt_eligible: true` OrchestrationEvent | `orchestration_events`, DVN service |
| **blakQube encryption** | Platform data integrity | Every persona write | `personas.blak_qube` (AES-256-GCM) |
| **Auto-Drive minting** | Survivability + open verifiability | Explicit user action | `iqube_mint_stubs`, Autonomys AA-API |

---

## Layer 1 — DIDQube and Root DiD

### Registration flow

When a persona is created with a FIO handle, the following happens atomically:

1. The FIO handle is registered on the FIO blockchain via the FIO SDK (domain: `@qripto` or `@knyt`). The system account pays the fee; the developer's public key becomes the cryptographic owner.
2. A **Root DID** is derived: `did:fio:<handle>` — e.g. `did:fio:alice@qripto`.
3. The `personas` table records the `fio_handle` and the derived Root DID is stored in persona metadata.
4. The DIDQube is the iQube representation of this Root DID — it links the persona's identity to its reputation record and anchors all DVN receipts.

The Root DID is not a database row — it is a cryptographically owned identifier on a live public blockchain. No platform action can reassign or revoke it; only the holder of the corresponding private key controls it.

### ICP anonymous verification

The DIDQube has a secondary representation on ICP (Internet Computer Protocol). Key design choices:

- The ICP representation allows **independent verification** that a Root DID exists and has accumulated receipts
- The ICP identifier is **anonymous by design** — even the holder cannot specify which ICP transaction or canister ID corresponds to them
- This is **privacy-preserving accountability**: a verifier can confirm that a Root DID has standing and receipts without learning anything about the underlying person or persona
- This anonymity is not a limitation — it is the canonical design choice

**Implementation note:** The ICP DIDQube anchor is established during persona creation. The `did_registration_service` handles the two-step atomic operation (FIO + ICP). Engineers should not attempt to resolve the ICP identifier back to a user — by design, this mapping does not exist in any accessible form.

---

## Layer 2 — DVN Pipeline

### What it captures

Every material platform event emits an `OrchestrationEvent` to `orchestration_events`. Events with `receipt_eligible: true` include:

- Mission completions
- Delegation grants and revocations
- Policy blocks
- Trust band progressions
- Payment settlements
- Persona creation events

### How anchoring works

1. The event is written to `orchestration_events` with `actor_root_did` populated in `metadata` (the actor's Root DID)
2. The DVN service batches receipt-eligible events and submits them as **ordinal inscriptions on Bitcoin**
3. Each inscription is permanently and tamper-evidently associated with the Root DID that triggered it

### Critical design point

**Minting is not required for DVN anchoring.** A persona with only a FIO handle (no PersonaQube minted) still has:
- A Root DID on FIO blockchain
- A growing DVN receipt trail anchored to that Root DID via ordinal inscriptions

The DVN is the answer to: *did this event happen, at this time, attributed to this Root DID?* — verifiable without trusting the AigentZ platform.

### What DVN does NOT do

DVN captures events. It does not cryptographically seal `blakQube` content. A DVN receipt confirms that an event occurred and was attributed to a Root DID — it does not prove the content of the persona's profile at that point in time. That is what Layers 3 and 4 address.

---

## Layer 3 — blakQube Encryption

Sensitive persona data (PII, private attributes) is stored in the `personas` table in the `blak_qube` column as AES-256-GCM ciphertext. Key derivation uses the persona's FIO handle as the input material.

### What this provides

- **Tamper-evidence within the platform**: any unauthorised modification to the ciphertext changes it, and the decryption will fail — making the tampering detectable
- **Confidentiality**: the plaintext persona data is not readable without the derived key

### What this does NOT provide

- **Independent verifiability**: a third party would need to trust Supabase and the application layer to confirm the data is unmodified. There is no public proof that can be verified without platform access.

This is the limitation that Layer 4 addresses.

---

## Layer 4 — Auto-Drive Minting (PersonaQube)

### Flow

When a developer triggers a persona mint:

1. The current `blakQube` (encrypted persona data) is packaged as a PersonaQube
2. It is submitted to Autonomys Auto-Drive via the AA-API (`services/aa-api/`)
3. Autonomys returns a **Content Identifier (CID)** — a cryptographic hash of the content
4. The CID is stored in `iqube_mint_stubs` with `status: "staged"` → progresses to `"confirmed"` on finality
5. Other iQube types (SkillQube, AigentQube, ExperienceQube) can then bind to the PersonaQube by CID

### Why CID binding is stronger than database FK binding

When a SkillQube binds to a PersonaQube by CID (not by `persona_id` FK):
- The CID is the hash of the content — it proves the exact data that was bound
- If the PersonaQube data changes (requiring a new mint with a new CID), the binding is **broken**, not silently updated
- A third party can verify the binding without trusting the AigentZ database

### Four sovereignty advantages

**1. Survivability** (lead value proposition)
The PersonaQube data persists on Autonomys even if AigentZ goes offline, the Supabase instance is lost, or the platform ceases to operate.

**2. Portability**
Any system implementing the iQube standard can fetch and verify the PersonaQube by CID — no API key, no AigentZ account, no trust in this platform.

**3. Open network accessibility**
The CID is a content hash. A third party can verify the persona data is exactly what was committed at mint time without accessing AigentZ's database or API.

**4. Cryptographic composability**
CID-based bindings provide a stronger integrity model than database FKs. Downstream iQubes that reference a PersonaQube by CID know exactly what they bound to.

---

## How the Layers Work Together

```
FIO Handle registered
       │
       ├── Root DID created (did:fio:<handle>)
       │       └── DIDQube anchored on FIO blockchain + ICP (anonymous by design)
       │               └── ICP: verifier confirms standing; identity not revealed
       │
       ├── DVN pipeline activated
       │       └── All receipt_eligible OrchestrationEvents → ordinal inscriptions (Bitcoin)
       │               └── Anchored to Root DID in actor_root_did metadata
       │               └── NO minting required — begins at persona creation
       │
       ├── blakQube written to Supabase (personas.blak_qube)
       │       └── AES-256-GCM, key derived from FIO handle
       │       └── Tampering detectable within platform (ciphertext changes)
       │       └── NOT independently verifiable externally
       │
       └── (Optional) PersonaQube minted to Autonomys Auto-Drive
               └── CID = content hash → open verifiability
               └── iqube_mint_stubs tracks lifecycle (staged → confirmed)
               └── SkillQube / AigentQube bind to CID (not DB FK)
               └── Data survives platform failure
```

---

## Engineering Implementation Notes

### Key files

| Concern | Location |
|---------|----------|
| FIO handle registration + Root DID derivation | `services/identity/didRegistrationService.ts` |
| DVN event emission | `services/orchestration/orchestrationEvents.ts` |
| blakQube encryption/decryption | `services/identity/blakQubeService.ts` |
| Persona mint (Auto-Drive) | `app/api/iqube/persona/qripto/mint/route.ts` |
| Mint stub tracking | `iqube_mint_stubs` table |
| OrchestrationEvent table | `orchestration_events` (migration: `20260402000000_experience_model_journey_state.sql`) |

### Root DID in OrchestrationEvent metadata

Every receipt-eligible event emitted by `orchestrationEvents.ts` must include `actor_root_did` in its metadata. This is the accountability anchor used by the DVN pipeline. Events without a Root DID cannot be attributed for receipt anchoring.

```typescript
// Correct pattern — Root DID in metadata
await emitOrchestrationEvent({
  event_type: 'mission_completed',
  actor_persona_id: personaId,
  receipt_eligible: true,
  metadata: {
    actor_root_did: `did:fio:${persona.fioHandle}`,   // ← required for DVN anchoring
    mission_id: missionId,
    cartridge_scope: cartridgeId,
  }
});
```

### ICP anonymity — do not attempt resolution

The ICP DIDQube representation is intentionally anonymous. Do not add any code that attempts to:
- Map a Root DID back to an ICP transaction ID or canister ID
- Expose the ICP identifier in any user-facing surface
- Store the ICP↔FIO mapping in any accessible table

This anonymity is the privacy-preserving accountability design. A verifier confirms the DID has standing; the verifier cannot learn who the DID belongs to.

### Mint CTA — correct value props

When surfacing the mint CTA in UI (SmartWalletDrawer iQube tab, DevPersonaTab), the value props are:

**Correct:**
- Survivability — data persists if platform goes offline
- Portability — any iQube-compatible system can read the PersonaQube by CID
- Open network accessibility — CID proves content without trusting the platform
- Cryptographic composability — other iQubes bind by CID not DB FK

**Incorrect (do not use):**
- DVN receipt anchoring — this happens automatically via Root DID regardless of minting
- Reputation accrual — also happens automatically via DVN regardless of minting

---

## Trust Advantage Summary

The system provides strong accountability guarantees while preserving user privacy — a combination centralised identity systems cannot match:

| Property | How delivered | Requires minting? |
|----------|--------------|-------------------|
| Accountability | Root DID on FIO blockchain | No |
| Tamper-evident event records | DVN ordinal inscriptions | No |
| Privacy-preserving verification | ICP anonymous DIDQube | No |
| Platform data integrity | blakQube AES-256-GCM | No |
| Survivability off-platform | PersonaQube on Auto-Drive | **Yes** |
| Open network verifiability | PersonaQube CID | **Yes** |
| Cryptographic composability | CID-based iQube bindings | **Yes** |

Minting is the step from **platform citizen** (accountability + tamper-evidence within platform) to **protocol citizen** (full sovereignty, portability, ecosystem interoperability).

---

## Phase 1 spine — runtime layer

The four sovereignty layers above describe **what** the protocol guarantees. The Phase 1 IAM foundation plan describes **how** the runtime delivers those guarantees through a single source of truth — the access spine — that every consumer (delivery proxies, UI components, the SmartTriad, the wallet drawer, the embed bridge) reads from.

### The three universal contracts

| Type | Tier | Purpose |
|------|------|---------|
| `ActivePersonaContext` (T0) | server-internal | Canonical persona handles. Holds `personaId`, `authProfileId`, `identifiability`, `cartridgeFlags`, cohort memberships. Never crosses to the browser. |
| `ActivePersonaSurface` (T1) | same-origin shell | Browser-safe view. Holds `personaSessionToken` (opaque, HMAC-signed, rotating, origin-bound), `displayLabel`, `ownFioHandle`, cartridge flags. The single thing client code holds. |
| `CohortAliasCommitment` (T2) | public network | Per-tx hash `(personaId + cohortId + salt)`. The only persona-related identifier that ever reaches a public chain or DVN receipt. Purged at escrow expiry. |

Every persona-related identifier in the system has exactly one tier. Identifiers may move down a tier (T0 → T1 → T2) only via deliberate transformation; never up.

### Implementation index

| Concern | File |
|---|---|
| Type contracts | `types/access.ts` |
| Server resolver `getActivePersona` (T0) | `services/identity/getActivePersona.ts` |
| `personaSessionToken` issuer/verifier (T1) | `services/identity/personaSessionToken.ts` |
| `getContentDescriptor` builder | `services/content/getContentDescriptor.ts` |
| `evaluateAccess` decision evaluator | `services/access/evaluateAccess.ts` |
| `policyResolvers` (sync vs async receipts; cartridge-flag credentials; external-verifier classification) | `services/access/policyResolvers.ts` |
| Public access endpoint | `app/api/wallet/active-persona/route.ts` (T1 surface) + `app/api/access/evaluate/route.ts` (decision) + `app/api/access/inspect/route.ts` (debug) |
| Client-side spine helper | `services/access/spineGateClient.ts` (`checkSpineDecision`, `isSpineOwned`) |
| Client-side T1 surface hook | `app/hooks/useActivePersona.ts` |
| Cross-cartridge nav | `utils/codex-nav.ts` `buildCodexUrl()` (`?pst=` preferred over `?personaId=`) |
| Embed auth bridge | `app/(embed)/triad/embed/codex/_lib/useCodexEmbedAuthBridge.ts` |
| Delivery proxies (shadow-log + enforce) | `app/api/content/{pdf-page,cover,video,pdf}/[cid]/route.ts` |

### Receipt anchoring

The `evaluateAccess` decision today carries a placeholder `aliasCommitment: '__phase1_pending_alias__'`. Phase 3 wires the live cohort-alias issuance via the Escrow + RQH + FBC ICP canisters per `2026-04-27_cohort-escrow-root-did-reputation-backlog.md`. Until then receipts are emitted but not yet anchored on-chain to a real alias.

### What's next

| Phase | Description | Status |
|---|---|---|
| 1 | Universal contracts + server resolver + four delivery proxies + UI consumers + observability | **DONE — empirically validated 2026-05-08** |
| 2 | Supabase WIP encryption parity (encrypt-on-upload, decrypt-supabase-proxy) — closes the cryptographic fallback gap for all gated content regardless of storage backend | queued |
| 3 | DVN policy hook + alias-anchored receipts (replace `__phase1_pending_alias__`) | queued |
| 4a | Pool-mode TokenQube on-chain proof (state D) | queued |
| 4b | Sovereign-mode TokenQube + per-holder ciphertext (state E) | queued |
| 5 | Retire `ACCESS_DEBUG_OPEN` bypass; replace with `cartridgeFlags.canInspectAccess` permission per plan §11.e | queued |

Plan doc with full sequencing: `updates/2026-05-05_unified-identity-content-access-foundation-plan.md` (registered in `col_architecture`).
