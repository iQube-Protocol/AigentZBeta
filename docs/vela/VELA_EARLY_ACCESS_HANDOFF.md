# VELA-001 Early Access Handoff — MoneyPenny × Vela: Confidential Constitutional Execution

**Date:** 2026-08-22
**Status:** Local architecture proven end to end, live, against the real Vela v0.2.0 stack. Code-complete through Slice 2G. **The remaining external milestone is real Vela TEE attestation (production Nitro hardware) — not another local architecture pass.**

This is the single entry point for anyone picking up VELA-001 next: what exists, what has been proven live, where the seams are, and exactly what remains.

---

## 1. What VELA-001 is

MoneyPenny's Financial Services Runtime gains a confidential-compute component: certain financial actions can condition their constitutional authorisation on evidence computed **inside a TEE (Trusted Execution Environment)**, so private inputs (balances, exposure, spend limits) never leave the enclave in the clear, while the constitutional decision they inform stays fully auditable.

**Two invariants govern everything below, and neither is negotiable:**

1. **Authority is constitutional. Authorisation is conditional.** `Consequential Authority ∩ Acceptable Consequence Projection = Action Authorised`.
2. **Vela informs authorisation. It never establishes it.** A confidential verdict is one input to a composed projection; the projection's disposition — not the raw Vela verdict — is what authorisation reads.

## 2. The canonical sequence (built, tested, proven live)

```
Personhood → Authority → Mandate → Proposed Action
    → Consequence Projection (public + confidential, composed)
    → Action Authorisation
    → Bounded Execution (intent only — never signs/broadcasts)
    → Observed Consequence
    → Consequence Validation
    → Receipt / DVN evidence
```

Every arrow above is a real, tested, and (where marked) live-proven module — not a design sketch.

## 3. Module map

| Plane | Module | What it does |
|---|---|---|
| Ontology | `types/constitutionalCommerce.ts` | The six frozen types: `ConstitutionalAuthority`, `ProposedAction`, `ConsequenceProjection`, `ActionAuthorisation`, `CommerceExecution`, `ObservedConsequence`. **Frozen as of Slice 2G** — extend by composition, never fork. |
| Domain seam | `types/confidentialProjection.ts` | Provider-neutral confidential-projection contract. No Vela concepts leak through this boundary. |
| Vela wire layer | `services/vela/velaTypes.ts`, `velaConfig.ts`, `velaClientAdapter.ts`, `velaTestTransport.ts` | ECDH(P-521)→HKDF-SHA256→AES-256-GCM crypto (byte-verified against `vela/pkg/crypto/cipher.go`), the real on-chain transport, and a deterministic test transport for CI. |
| Provider | `services/vela/velaProjectionProvider.ts` | `VelaConfidentialProjectionProvider` — the ONLY module that sees both Vela wire concepts and the domain seam. Cannot return an authorisation; cannot claim an attestation it didn't verify. |
| Confidential app | `services/vela/wasm/projector/` (TinyGo/WASM) | The MoneyPenny Confidential Consequence Projector — deterministic pure comparison, verdict-only output. sha256 `b287b7e838d172d2acb196f248dc1d6a35ee70d4450ef88ca3dd11c83bd81c1c`. |
| Composition | `services/constitutionalCommerce/unifiedConsequenceProjection.ts` | Composes CFS-006a's public forecast with confidential evidence into one `ConsequenceProjection`. Owned by neither side. Precedence `UNACCEPTABLE > UNRESOLVED > ACCEPTABLE`; `completeness`/`unresolvedComponents` tracked independently so a refusal is never hidden behind unresolved evidence. |
| Governance gate | `services/registry/capabilityInvocationGates.ts` (Gate 2) | ONE narrow, capability-id-scoped exception inside the existing authoritative-mode block. **FROZEN as of Slice 2F/2G — do not touch, do not add a second path.** |
| Authorisation | `services/constitutionalCommerce/actionAuthorisation.ts` | `deriveActionAuthorisation()` — the actual `Consequential Authority ∩ Acceptable Consequence Projection` derivation. Independent of, and downstream of, Gate 2's `allow`. |
| Execution | `services/constitutionalCommerce/boundedExecution.ts` | `bindExecution()` — binds an intent to a current `AUTHORISED` authorisation. **Never signs or broadcasts** (mirrors `settlementExecutor.ts`). |
| Observation/Validation | `services/constitutionalCommerce/observedConsequence.ts` | `compareProjectionToObservation()` / `recordObservedConsequence()` — `MATCHED_PROJECTION \| DIVERGED_FROM_PROJECTION \| UNRESOLVED`. |
| Causal chain | `services/constitutionalCommerce/causalChain.ts` | Read-only projection over the above records — every ref, from existing objects only, no duplication. |
| Receipts | `services/constitutionalCommerce/commerceReceipts.ts` | Six `ActivityActionType`s, DVN-anchorable, real call sites. |

## 4. What is proven, and how

| Claim | Proof |
|---|---|
| The crypto layer matches Vela exactly | Byte-for-byte verified against `vela/pkg/crypto/cipher.go` (pinned v0.2.0 source) |
| Confidential projection is genuinely confidential, bounded (never total) | `docs/vela/VELA-PRIVACY-BOUNDARY-001.md` |
| Local ≠ production attestation, structurally | `docs/vela/VELA-ATTESTATION-BOUNDARY-001.md`; `protocolExecutionVerified`/`teeAttestationVerified` are independent booleans everywhere, never one inferred from the other |
| CFS-006a and VELA-001 compose, never duplicate | `docs/vela/CONSEQUENCE-ONTOLOGY-001.md` |
| Full traversal, ACCEPTABLE/UNACCEPTABLE/UNRESOLVED, real enclave | `2026-08-22_vela-001-slice-2f-gate2-authorisation.md` — 20/20, `applicationId 2089125378143059424` (now redeployed as `7738404303895312998`, see §6) |
| Execution/observation/validation/receipts, all three cases, real enclave | `2026-08-22_vela-001-slice-2g-execution-observation-validation.md` — 20/20 deterministic+live, plus a standalone narrated proof with the full reference chain persisted at `2026-08-22_vela-001-slice-2g-live-proof-evidence.json` |
| The CHECK-constraint migration rejects no legacy row | Static superset proof across all 41 historical constraint-rebuild migrations (see the Slice 2G doc's "Pre-deployment CHECK-constraint legacy verification" — no live Supabase in this sandbox, so this is the honest substitute, and it is exhaustive rather than sampled) |

## 5. Signal vocabulary (memorise this table — every module in §3 speaks it)

| Term | Meaning | Never confuse with |
|---|---|---|
| `ACCEPTABLE` | A projection was established; the consequence is acceptable | — |
| `UNACCEPTABLE` | A projection was established; the consequence is NOT acceptable | `UNRESOLVED` (infra/fee/evidence/attestation failures are always `UNRESOLVED`, never this) |
| `UNRESOLVED` | Nothing could be established | `UNACCEPTABLE` |
| `completeness: COMPLETE \| PARTIAL` | Whether every required component reached a definite disposition | `disposition` (a known refusal can be `PARTIAL` if a DIFFERENT component is still unresolved — never hidden) |
| `AttestationRequirement: NOT_REQUIRED \| REQUIRED \| UNSPECIFIED` | Whether a projection may stand on unattested evidence | `UNSPECIFIED` fails closed — treated as `REQUIRED` |
| `MATCHED_PROJECTION \| DIVERGED_FROM_PROJECTION \| UNRESOLVED` | Observed-vs-projected comparison | An observation that could not be MADE is `UNRESOLVED`, never a "diverged" guess |
| Execution **binding** | An intent record, `bindExecution()` | Execution **confirmation** — no module in this codebase confirms on-chain settlement; `transactionRef` is always absent |

## 6. Operational notes for anyone re-running the live proofs

- **The local Vela chain does not persist state across a container restart.** A previously-recorded `applicationId` will not exist on a freshly-restarted stack even though the ProcessorEndpoint/TeeAuthenticator contract ADDRESSES stay the same (deterministic Anvil-genesis addresses, redeployed by the `deployer` container every start). Redeploy with `scripts/vela-slice2g-redeploy.ts` — the WASM artifact itself survives (it lives in the `vela-skit-shared-data` named volume, keyed by sha256), so this is a fast on-chain-only redeploy, not a rebuild.
- **Every requester's P-521 key must be `ASSOCIATEKEY`'d (RequestType=3) before any `PROCESS` request from it will decrypt.** This is a real Vela protocol requirement (`docs/3_typescript-client.md` in the vela-starterkit, "Registering Your Key"), not something this codebase can skip. `scripts/vela-slice2g-associate-key.ts` does this standalone; `scripts/vela-slice2g-live-proof.ts` does it inline on every run. Symptom if skipped: `errorCode 9 "no Secp521r1_PubKey found"` — this reads as a `disposition: 'UNRESOLVED'` at the provider layer (correct fail-closed behaviour), so it can look like a projection problem when it is actually a missing prerequisite step.
- **Dev keys**: Anvil Account #0 (`0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`, `DEPLOYER_ADMIN`) holds `DEPLOYER_ROLE` and is funded — used throughout for both deploy and requester roles in local proofs. Documented in the vela-starterkit's own checked-in `dockerfiles/.env.dev` — public, local-dev-only, never a production secret.
- **No live Supabase in this sandbox.** `resolveCapabilityProviders` (Gate 1's registry lookup inside `invokeCapability()`) requires it. Test suites mock this seam (the established convention, `tests/governed-capability-invocation.test.ts`); a standalone live-proof script that needs the REAL gateway either needs live Supabase credentials or must call Gate 2 (`evaluateCapabilityAndRuntimeGate`) directly with a fixture provider, exactly as `scripts/vela-slice2g-live-proof.ts` does. This is a data/deployment gap, not a code gap — registering `CONFIDENTIAL_CONSEQUENCE_PROJECTION` as a live MoneyPenny capability descriptor in the real Agent Bench registry is a deployment step, not a code change.

## 7. What remains — and what does NOT

**Remains (deferred, tracked, non-blocking for the architecture claim):**
- SmartWallet `CONFIDENTIAL_PROJECTION_REQUEST` pending-action UI type.
- Journey Consequence Modal alignment.
- The full PRD §31 security/constitutional canary list.
- Registering the live MoneyPenny capability descriptor in the real Agent Bench/Supabase registry (a data change, needs live credentials).

**Does NOT remain — already closed:**
- No further local architecture passes are needed to validate the confidential-projection → authorisation → execution → observation → validation → receipt chain. It has been proven, live, against the real enclave, for every disposition and every distinguishing case (`ACCEPTABLE`/`UNACCEPTABLE`/`UNRESOLVED`, `MATCHED_PROJECTION`/`DIVERGED_FROM_PROJECTION`, `REQUIRED`-absent vs `NOT_REQUIRED`).

## 8. The one real external milestone: production TEE attestation

Everything above runs under `NoAttestationTeeAuthenticator` — the local/dev deployment mode with `teeAttestationVerified` always `false` by construction (never inferred from a successful execution; verified via `docs/vela/VELA-ATTESTATION-BOUNDARY-001.md`'s independent-booleans discipline, enforced by canaries). The type system (`ConfidentialProofState`, `provenStatesFor()` in `velaProjectionProvider.ts`) already names the third, unreached state: `PRODUCTION_TEE_ATTESTATION_PROVEN`, reachable ONLY from a `NITRO_ATTESTED` deployment.

**Getting there is an external dependency, not an engineering task this codebase controls alone**: it requires a real Vela deployment running actual AWS Nitro Enclaves with a genuine remote-attestation chain, which this local Docker Compose stack cannot simulate (that is the entire point of `NoAttestationTeeAuthenticator` — it exists so local development doesn't need real hardware). Everything in this codebase is already structured to consume that state the moment it exists: `AttestationMode`, `provenStatesFor()`, and the `AttestationRequirement` policy all already model `NITRO_ATTESTED` as a first-class value; no ontology change is anticipated when it arrives, only a deployment descriptor change (`services/vela/velaConfig.ts`) and a live proof re-run against that deployment.

**Determination, stated plainly: the next milestone for VELA-001 is obtaining and pointing this stack at a real Nitro-attested Vela deployment. It is not another round of local architecture, composition, or ontology work.**

## 9. Reading order for a new engineer

1. This document.
2. `docs/vela/CONSEQUENCE-ONTOLOGY-001.md` — why VELA-001 composes with CFS-006a instead of forking it.
3. `docs/vela/VELA-PRIVACY-BOUNDARY-001.md` and `VELA-ATTESTATION-BOUNDARY-001.md` — the two boundaries every module respects.
4. `types/constitutionalCommerce.ts` — read the file top to bottom; every field has a comment explaining why it exists.
5. `2026-08-22_vela-001-slice-2f-gate2-authorisation.md` then `2026-08-22_vela-001-slice-2g-execution-observation-validation.md` (in `codexes/packs/agentiq/updates/`) — the two slices that took this from "designed" to "live-proven."
6. `tests/vela-slice2f-capability-invocation.test.ts` and `tests/vela-slice2g-execution-observation-validation.test.ts` — read the tests before writing new code; they encode every constraint above as an executable check.
