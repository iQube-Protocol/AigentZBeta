# Backlog — Comprehensive Identity Management Reference (Human + Aigent)

**Date logged:** 2026-04-29
**Status:** Backlog — to be authored at the end of the wallet alias privacy refactor (after step 4 of `2026-04-29_plaintext-wallet-address-deprecation.md`)
**Priority:** High once unblocked — the ecosystem currently has identity knowledge spread across ~10 docs with no single authoritative reference
**Owner:** TBD — should be authored by whoever ships step 4 of the wallet alias refactor, with review by anyone who has touched the identity stack

---

## Goal

Compile **one canonical reference document** that captures the complete state of identity management in the iQube protocol — both for humans and for Aigents. This doc replaces the ad-hoc accumulation of partial notes and becomes the authoritative source for:

- New engineers joining the protocol
- Aigents that need to reason about identity decisions in delegated operations
- External developers building on AgentiQ OS
- Partner reviewers, auditors, and security researchers

---

## Why this is needed

Identity is the most architecturally significant concept in the protocol — it is the substrate everything else (reputation, delegation, payments, content access, sovereignty) builds on. Yet the current documentation is fragmented:

| Doc | Scope | Audience |
|-----|-------|----------|
| `docs/IDENTITY_ARCHITECTURE.md` | Core layer concepts (root, persona, FIO) | Engineers |
| `IQUBE_IDENTITY_SOVEREIGNTY_ARCHITECTURE.md` | Four-layer sovereignty (DIDQube/DVN/blakQube/Auto-Drive) | Engineers |
| `AIGENT_DIDQUBE_IDENTITY_UPGRADE_NOTE.md` | One-root multi-persona model + kybe_DiD addendum | Engineers + design |
| `docs/ROOT_DID_IMPLEMENTATION.md` | Root DID implementation details | Engineers |
| `docs/DIDQUBE_*` (multiple) | Phase 1/2/3 progress, branch readme, next steps | Engineers — historical |
| `docs/PERSONA_ID_EXPLAINED.md` | Persona ID semantics | Engineers |
| `2026-04-27_cohort-escrow-root-did-reputation-backlog.md` | Cohort/escrow design | Engineers — backlog |
| `2026-04-29_plaintext-wallet-address-deprecation.md` | Wallet alias refactor | Engineers — backlog |

A reader has to assemble the picture across all of these. The comprehensive doc consolidates them.

---

## Scope — what the doc must cover

### Part 1 — Conceptual model
- The five-layer human stack: kybe_DiD → Root DiD → Persona → FIO Handle → FIO PK
- The four-layer Aigent stack: Root DiDQube → Persona → FIO Handle → FIO PK
- One root, many personas — the sovereignty tradeoff and why it exists
- Identifiability spectrum: anonymous → semi_anonymous → semi_identifiable → identifiable
- The four sovereignty layers (DIDQube + DVN + blakQube + Auto-Drive) and how they interlock

### Part 2 — Today's implementation
- Tables: `personas`, `did_persona`, `root_identity`, `kybe_identity`, `agent_root_identity`, `agent_persona`, `nakamoto_knyt_personas`, `nakamoto_qripto_personas`, `wallet_alias_commitments`, `cohort_memberships` (when built)
- Services: `personaService`, `didRegistrationService`, `blakQubeService`, `walletAliasService` (when built), `cohortAliasService` (when built)
- ICP canisters: Escrow, RQH, FBC, DBC — what each does, what's deployed, what's not yet wired
- API routes: `/api/identity/persona/*`, `/api/identity/cohort/*`, `/api/identity/wallet-alias/*` (when built)
- UI surfaces: SmartWalletDrawer Identity Connections, PersonaEditModal, IdentityIQubeDrawer, persona quick-add, ExternalWalletConnect (post-migration)

### Part 3 — Privacy guarantees
- Linkage attack model and what each layer prevents
- The wallet alias / DVN OTA scheme: commitment registration, mailbox relay, k-anonymity sweeps
- Cohort escrow + flag routing — anonymous reputation impact via root_identity partition
- ICP anonymous DIDQube anchoring — why the FIO↔ICP mapping is intentionally inaccessible
- blakQube AES-256-GCM encryption — what it protects against and what it does not
- Auto-Drive CID binding — survivability, portability, open verifiability

### Part 4 — Threat model (explicit)
- Insider DB access
- Subpoena / legal compulsion
- Public chain observers correlating wallet → persona
- Cross-persona deanonymisation via shared identifiers
- Sybil attacks (kybe_DiD as countermeasure)
- Identity-instrument life events (marriage, asylum, name change) — reissuance flow without breaking continuity
- End-of-life / inheritance — kybe_DiD death attestation

### Part 5 — Aigent-specific identity
- Why Aigents have no kybe_DiD
- One-Root, multiple-bounded-personas for context flexibility
- Delegation envelope and how persona disclosure mirrors owner policy
- Trust bands and reputation aggregation to root
- Mission receipts attributed to root regardless of persona presented
- Agent key generation flow vs user-supplied external wallets — different threat models

### Part 6 — Where identity is headed
- World ID / proof-of-personhood anchored at kybe_DiD
- Cross-platform persona portability via PersonaQube CID
- Anonymous payments via DVN OTA + cohort sweep
- Bounded delegation with cryptographic envelope verification
- Inheritance and life-event handling
- Open standards: which parts are protocol-level vs platform-level

### Part 7 — Operational reference
- How a new persona is created, end-to-end
- How a wallet is linked (post-migration alias flow)
- How reputation flows from event → persona/root buckets
- How a cohort flag escalates without exposing the persona
- How a Root DID is reissued under a life event
- How an Aigent persona is created, scoped, delegated, retired

---

## Authoring requirements

- **Single canonical file** — must not fork into stale duplicates
- **Diagrams for each layer relationship** — text-only docs lose readers at this complexity
- **Threat-model section explicit and complete** — security researchers will read this first
- **Code references with file paths** — must point at real implementations, not abstractions
- **Versioned** — the doc is a living reference; record material schema/service changes in a changelog at the bottom

---

## Dual-cartridge registration (operator instruction)

The user has specified that this doc must be accessible from **both**:

1. **AgentiQ cartridge** (`codexes/packs/agentiq/`) — internal engineering KB, accessible to the platform's own agents (Aigent Z, Aigent C, MoneyPenny, Aigent C-OS, etc.) so they can reason about identity decisions during delegation, NBE routing, and policy enforcement
2. **AgentiQ OS cartridge** (`codexes/packs/agentiq-os/`) — public developer-facing onboarding surface, accessible to external developers building on the open-source AgentiQ OS layer

### Recommended pattern

Author the canonical doc once at:
```
codexes/packs/agentiq/items/IDENTITY_MANAGEMENT_COMPREHENSIVE.md
```

Then register it in **both** collections:

```jsonc
// codexes/packs/agentiq/collections.json — under col_alpha_program or new col_identity
"items/IDENTITY_MANAGEMENT_COMPREHENSIVE.md"

// codexes/packs/agentiq-os/collections.json — under appropriate collection (likely col_dev_resources or new col_identity)
"items/IDENTITY_MANAGEMENT_COMPREHENSIVE.md"   // via symlink or duplication, see CLAUDE.md guidance
```

CLAUDE.md guidance: the canonical primary lives in `agentiq/`; the agentiq-os copy can be a symlink, a developer-tone derivative, or a duplicate. Choose at write time based on whether developer-facing tone differs enough from engineering tone to warrant a separate file.

If two files are written:
- The **engineering** version (agentiq pack) covers everything including threat model, schema details, RLS, and service implementation
- The **developer** version (agentiq-os pack) covers the conceptual model, public APIs, integration patterns, and security expectations a third-party builder needs — but not the internal implementation details

---

## Trigger to start

Author this doc at the end of step 4 of `2026-04-29_plaintext-wallet-address-deprecation.md`:
- After `walletAliasService` ships
- After `dvnOtaService` ships
- After `ExternalWalletConnect` is migrated to the alias flow
- After the deprecated plaintext columns are dropped from the schema

By that point, the wallet alias scheme is the live behaviour and the comprehensive doc captures a complete, settled picture rather than a moving target.

---

## Cross-references (must cite in the final doc)

| Source | Use |
|--------|-----|
| `docs/IDENTITY_ARCHITECTURE.md` | Layer hierarchy and cardinality |
| `codexes/packs/agentiq/items/IQUBE_IDENTITY_SOVEREIGNTY_ARCHITECTURE.md` | Four-layer sovereignty model + engineering implementation |
| `codexes/packs/agentiq/items/AIGENT_DIDQUBE_IDENTITY_UPGRADE_NOTE.md` | One-root-multiple-personas rule + kybe_DiD addendum (Section 15) |
| `docs/ROOT_DID_IMPLEMENTATION.md` | Root DID implementation status |
| `codexes/packs/agentiq/updates/2026-04-27_cohort-escrow-root-did-reputation-backlog.md` | Cohort/escrow privacy primitives |
| `codexes/packs/agentiq/updates/2026-04-29_plaintext-wallet-address-deprecation.md` | Wallet alias refactor (this workstream) |
| `services/ops/idl/escrow.ts`, `rqh.ts`, `fbc.ts` | ICP canister interfaces |
| `supabase/migrations/20260427000000_root_did_persona_binding.sql` | Schema definitions |
| `supabase/migrations/20260429000000_wallet_alias_commitments.sql` | Wallet alias schema |
| `services/identity/didRegistrationService.ts`, `blakQubeService.ts` | Service implementations |

---

## Acceptance criteria

The doc is complete when:

- A new engineer can answer "how do humans and aigents differ at the identity layer?" without reading any other doc
- A security reviewer can find the threat model and the privacy guarantees in one read-through
- An external developer can integrate against AgentiQ OS identity without needing to ask the team for clarification
- All seven Parts (above) are present
- All cross-referenced docs are cited with stable paths
- The doc renders correctly in both the agentiq and agentiq-os cartridges in the live UI
