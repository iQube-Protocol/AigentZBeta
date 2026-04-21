# Identity, Reputation & Cohort System State — iQube Protocol Platform

**Last verified:** 2026-04-21  
**Scope:** DIDQube, FIO integration, reputation system, anonymization, cohort management

---

## DIDQube — Identity System

**Status: Phase 3 complete. Phase 4 (TokenQube policy enforcement) pending.**

DIDQube provides the platform's sovereign identity layer: personas, identity state, agent bindings, and verifiable reputation. Three implementation phases are complete.

### Architecture

```
Persona (Supabase)
  ├── default_identity_state: anonymous | semi_anonymous | semi_identifiable | identifiable
  ├── world_id_status: unverified | verified (stub)
  ├── evm_address
  ├── fio_handle
  └── ReputationBucket (IC RQH canister ↔ Supabase sync)
        └── ReputationEvidence[]
```

**Identity states:**
- `anonymous` — No identifying information. No handle, no EVM address surfaced.
- `semi_anonymous` — Pseudonymous. FIO handle visible; no real-world identity.
- `semi_identifiable` — Handle + verified attributes. Partial disclosure.
- `identifiable` — Full identity disclosure. Required for high-trust operations.

### What's Live

**Database tables (Supabase):**
- `kybe_identity` — Root identity record
- `root_identity` — Canonical root
- `persona` — User personas with `default_identity_state`, `world_id_status`, `evm_address`, `fio_handle`
- `persona_agent_binding` — Links AI agents to personas
- `hcp_profile` — High-context profile
- `reputation_bucket` — Links persona → RQH canister bucket (Phase 3)
- `reputation_evidence` — Evidence submissions with type, weight, hash

**API routes (17 total under `/api/identity/`):**
- `POST /api/identity/persona` — Create persona
- `GET /api/identity/persona` — List personas
- `GET /api/identity/persona/[id]` — Fetch single persona
- `POST /api/identity/persona/[id]/reputation` — Create reputation bucket on RQH canister
- `GET /api/identity/persona/[id]/reputation` — Fetch reputation (IC + Supabase)
- `POST /api/identity/reputation/evidence` — Submit reputation evidence
- `GET /api/identity/reputation/evidence` — List evidence for bucket
- `POST /api/identity/fio/*` — FIO handle operations (see FIO section)
- `POST /api/identity/cohort/register-alias` — Cohort alias registration (stub)
- `GET /api/identity/disputes/*` — Dispute board (stub)

**ICP canisters used:**
- `rqh` (Reputation Hub, mainnet: `sp5ye-2qaaa-aaaao-qkqla-cai`) — `get_reputation_bucket`, `create_reputation_bucket`, `add_reputation_evidence`, `get_reputation_evidence`
- `escrow` — `register_alias`, `relay_message`, `compute_cohort`, `purge_expired` (IDL defined, routes partially stubbed)
- `fbc` (Flag Bulletin) — flagging system (IDL defined, not called)
- `dbc` (Dispute Board) — disputes (IDL defined, not called)

**UI components:**
- `PersonaSelector`, `IdentityStateToggle` — Persona switching + identity mode
- `ReputationBadge`, `DiDQubeIdentityCard`, `DiDQubeReputationCard` — Display
- `EvidenceSubmissionForm` — Submit reputation evidence
- `/admin/reputation` — Admin dashboard

**Key service files:**
- `services/identity/personaService.ts` — Persona CRUD
- `services/identity/reputationService.ts` — Reputation bucket + policy check
- `services/identity/identityResolver.ts` — Identity resolution
- `services/identity/agentKeyService.ts` — Agent key management (v1 + v2)
- `services/identity/policy.ts` — Identity policy enforcement

### What's Stubbed / Pending

| Feature | Status | Effort |
|---|---|---|
| World ID human verification | Stub — `world_id_status` field exists, no real verification flow | 3–5 days |
| Agent declaration enforcement | Phase 2 — field exists, not enforced | 2 days |
| TokenQube policy enforcement | Phase 4 — `checkTokenQubePolicy()` is a stub in `reputationService.ts` | 3–4 days |
| Dispute board UI | IDL + routes defined, no UI | 2–3 days |
| Flag bulletin integration | IDL defined, no calls | 1–2 days |
| Cohort computation UI | Infrastructure exists (see Cohort section) | 3–4 days |

---

## FIO Protocol Integration

**Status: 80% complete. Local dev working. Production Amplify deployment pending.**

FIO (Foundation for Interwallet Operability) provides human-readable handles (`alice@knyt`, `bob@aigentiq`) that replace raw EVM addresses across the platform. KNYT balance lookup uses FIO as its primary source of truth.

### What's Live

**Service:** `services/identity/fioService.ts` — FIO SDK wrapper with:
- `checkHandleAvailability(handle)` — Real FIO network query
- `registerHandle(handle, publicKey)` — On-chain registration
- `verifyHandleOwnership(handle, publicKey)` — Signature verification
- `lookupHandle(handle)` — Resolve handle → addresses

**API routes:**
- `POST /api/identity/fio/check-availability` — Check if handle is free
- `POST /api/identity/fio/register` — Register handle on FIO blockchain
- `POST /api/identity/fio/verify` — Verify ownership
- `GET /api/identity/fio/lookup?handle=alice@knyt` — Resolve handle

**KNYT balance lookup priority:**
1. FIO network (source of truth — resolve FIO handle → EVM address → read balance)
2. `personas.evm_address` column (fallback)
3. `agent_keys` table (AI agents)

**Environment variables required:**
```bash
FIO_API_ENDPOINT=https://fio.eosusa.io/v1/
FIO_CHAIN_ID=21dcae42c0182200e93f954a074011f9048a7624c6fe81d3c9541a614a88bd1c
```

**Persona DB fields planned (not yet migrated):**
- `fio_public_key`, `fio_handle_verified`, `fio_handle_expiration`, `fio_tx_id`, `fio_registration_status`

### What's Stubbed / Pending

| Feature | Status | Effort |
|---|---|---|
| Key generation | Temporarily disabled — users must provide existing keys | 2 days |
| FIO wallet integration | Not implemented | 3–5 days |
| Handle transfer | Not implemented | 2 days |
| Domain registration | Not implemented | 2 days |
| FIO request/payment | Future | — |
| Auto-renewal of handles | Future | — |
| Persona table migration for FIO fields | Planned but not run | 0.5 day |

---

## Reputation System

**Status: Live. Trust scoring operational. Automated scoring pipeline pending.**

### Trust Bands (Registry Assets)

The trust scoring system assigns every registered asset to a band based on a weighted 8-factor composite score (0–100).

| Band | Score | Label | Use |
|---|---|---|---|
| L5 | 90–100 | Core Sovereign | Platform-core, maximum isolation |
| L4 | 75–89 | Production Approved | Strong validation, production experiences |
| L3 | 55–74 | Production Candidate | Most validation passed |
| L2 | 30–54 | Verified Community | Basic provenance, non-critical |
| L1 | 0–29 | Experimental | Sandboxed testing only |

### Trust Score Factors

Computed in `services/registry/trustScorerService.ts`:

| Factor | Weight | What it measures |
|---|---|---|
| `licenseClarity` | 20% | Open license, clear attribution |
| `validationPassQuality` | 20% | CI/test pass rate, coverage |
| `provenanceQuality` | 15% | Source traceability, signed commits |
| `privilegeFootprint` | 15% | Minimal permissions required |
| `maintenancePosture` | 10% | Recency of commits, open issues |
| `dependencyRisk` | 10% | Known-vulnerable dependencies |
| `reproducibility` | 5% | Deterministic build |
| `wrapperIsolationQuality` | 5% | Sandbox isolation |

Hard caps are applied from validation artifacts — a failed `secret_scan` or `license_check` can cap the score below the base band regardless of other factors.

**Service files:**
- `services/registry/trustScorerService.ts` — Full composite scoring + band assignment
- `services/registry/validatorService.ts` — Validation stage orchestration
- `services/registry/publisherService.ts` — Asset publishing with trust band

**What's pending:** Automated factor computation from real CI artifacts. Currently factors are submitted manually or via a seed payload. The scoring formula is correct; the pipeline to pull real data from GitHub/CI is not wired. **Effort: 3–4 days.**

### Persona Reputation Bands (RQH Canister)

Separate from registry asset trust — this scores *personas* (users/agents):

| Band | Score | Label |
|---|---|---|
| L4 | 80–100 | Emerald — Excellent |
| L3 | 60–79 | Green — Good |
| L2 | 40–59 | Yellow — Fair |
| L1 | 20–39 | Orange — Poor |
| L0 | 0–19 | Red — Very Low |

Evidence types: GitHub contributions, project completions, peer endorsements, certifications. Submitted via `POST /api/identity/reputation/evidence`. Synced IC ↔ Supabase via `sync_reputation_from_rqh()` Supabase function.

---

## Anonymization System

**Status: Types defined + policy gating wired. Runtime enforcement pending.**

Anonymization is a property of *registry assets*, not just personas. Each asset in the registry can declare identity requirements that gate access.

**Fields on registry assets (`types/registry.ts`):**
- `identity_state?` — Minimum identity state required to access (`anonymous | semi_anonymous | semi_identifiable | identifiable`)
- `min_reputation_bucket?` — Minimum reputation band (L0–L4)
- `require_human_proof?` — Requires World ID verification
- `require_agent_declare?` — Requires agent declaration

**Policy gating (live):**
- `services/policy/qubetalkPolicyGate.ts` — Gates QubeTalk invocations
- `services/policy/skillQubePolicyGate.ts` — Gates skill invocations
- `services/policy/invocationGateway.ts` — Central policy enforcement

**What's pending:** Automated enforcement at the runtime layer. Policy gate checks exist but rely on the calling layer to honour them — no hard rejection at the network level. Cohort-aware skill routing (routing different content/skills to different identity cohorts) is designed but not implemented. **Effort: 3–5 days.**

---

## Cohort Management

**Status: Infrastructure only. No active cohort computation in production.**

Cohorts allow the platform to group personas by identity state, reputation band, or custom criteria — enabling differentiated content delivery, skill routing, and analytics without exposing individual identity.

### ICP Escrow Canister (Cohort Engine)

The `escrow` canister IDL (`services/ops/idl/escrow.ts`) defines:
- `register_alias(alias, ttl)` — Register a cohort alias for a persona
- `relay_message(alias, payload)` — Mailbox relay to alias
- `compute_cohort(criteria)` — Compute cohort membership
- `purge_expired()` — TTL-based alias purge

**API route:** `POST /api/identity/cohort/register-alias` — exists but routes to a stub response.

### What's Pending

| Feature | Effort | Dependency |
|---|---|---|
| Cohort computation (wire escrow canister calls) | 3 days | `ESCROW_CANISTER_ID` env var |
| Auto-assignment based on identity state | 2 days | Cohort compute live |
| Cohort-aware skill routing | 3 days | Cohort compute + policy gate |
| UI for cohort membership display | 2 days | Cohort compute live |
| Analytics segmentation by cohort | 2–3 days | Cohort membership data |

---

## Summary — Identity & Reputation Gaps

| Gap | Days | Blocker? |
|---|---|---|
| FIO key generation | 2 | No |
| Persona table FIO migration | 0.5 | No |
| World ID verification | 3–5 | Requires World ID API credentials |
| Agent declaration enforcement | 2 | No |
| TokenQube policy enforcement | 3–4 | No |
| Automated trust factor computation | 3–4 | No |
| Cohort computation (escrow canister) | 3 | `ESCROW_CANISTER_ID` env var |
| Cohort-aware skill routing | 3 | Cohort compute live |
| Runtime anonymization enforcement | 3–5 | No |
| Dispute board + flag bulletin UI | 3–5 | No |
| **Total** | **26–36 days** | |

---

*Part of the AgentiQ cartridge Codebase collection. See also: `network-and-minting-state.md` for ICP canisters, EVM contracts, and minting system state.*
