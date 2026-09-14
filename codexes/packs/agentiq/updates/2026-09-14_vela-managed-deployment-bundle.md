# Vela Managed Deployment Bundle — Production Testnet Intake Prep

**Date:** 2026-09-14 (third revision same day: adds the public v0.2.0 devnet remote-execution proof
and the full requested handoff fields — request types, party registration, state model, disclosure
model, KMS caveat)
**Status:** Preparation document — not yet a submission. Answers Priority F, item 20 of
`docs/vela/accelerator/constitutional-financial-services/08_VELA_OFFICE_HOURS_QUESTIONS_2026-09-11.md`
("what artifact bundle do you want from us") against what Use Case Zero build-order items 5-11 have
actually shipped, now strengthened by a real remote proof against a public (not managed) Vela v0.2.0
instance.

## Revision history (this file)

1. First revision: identified the bundle shape, reported the WASM build as BLOCKED (no TinyGo
   installed).
2. Second revision (same day): TinyGo built directly, real WASM + SHA-256 produced; folded in
   operator-supplied Vela Engineering guidance narrowing the open questions to four.
3. **This revision:** adds the public Vela v0.2.0 devnet milestone (real Authority Service upload,
   real `submitDeployRequest`/`ASSOCIATEKEY`/multi-party requests, all against
   `https://devnet.synsema.app/` — see
   `codexes/packs/agentiq/updates/2026-09-14_vela-public-devnet-v0.2.0-milestone.md`), which
   independently re-confirmed the WASM hash via the Authority Service's own upload response. Adds
   the full field set the operator asked this bundle to carry (request types, party/user
   registration assumptions, confidential state model, output/disclosure model, P-521/Ethereum
   signer assumptions, AWS KMS recovery caveat) and replaces the question list with the exact
   external question block requested.

## Ground truth already confirmed by Vela Engineering (restated, not re-derived)

- Vela repos are the implementation source of truth.
- Deployment is managed BY Vela Engineering via the Production Testnet Deployment Intake — we do
  not self-serve a deployment.
- The environment is shared across apps; **no direct terminal access is provided.**
- **Base Sepolia is available; Horizen testnet is also in scope** through the managed process.
- **Multi-app with isolated per-app state/funds is implemented.**
- **Native ETH, ERC-20, and a facilitator path are implemented** on Vela's side.
- **A new WASM deployment means a new `applicationId` and fresh state** — no in-place
  upgrade/migration path yet.
- **Attestation establishes the trusted TEE signing key for the Vela instance**; later updates are
  verified against that registered key.

**Genuinely open (unchanged by the devnet run — the devnet is NOT the managed environment and cannot
answer these on Vela Engineering's behalf):**

1. The exact deployment intake artifact/constructor/config bundle.
2. Canonical evidence binding `applicationId` to the exact WASM hash/version.
3. Whether Base Sepolia and Horizen testnet are separate trust domains / TEE registrations.
4. **New, from the devnet run:** the fuel-cost model for multi-party execution (§9).

TinyGo availability (the prior revision's 4th open item) is fully resolved — see §1.

**Intake form:** `docs/vela/accelerator/constitutional-financial-services/09_CLAUDE_IMPLEMENTATION_HANDOFF_v0.2.md`
line 22 and `12_VELA_SOURCE_REGISTER_2026-09-10.md` line 6 both cite **https://tally.so/r/xXWL1v**.
Whether this has already been submitted is not something this repo can tell you.

---

## 1. Guest source, build, artifact

| Field | Value |
|---|---|
| Guest source path | `services/vela/wasm/projector/` (Go; `app.go` — the multi-party guest logic; `main.go` — the Vela runtime entrypoint) |
| Source commit SHA | `de4222fe7` ("Add guest-side disclosure-scope enforcement for multi-party Vela projections") — unchanged since; independently re-verified against `git log` before the devnet run |
| Toolchain | TinyGo 0.39.0 (linux/amd64, go1.24.7, LLVM 19.1.2), `-target=wasi` |
| Build command | `make production_build TINYGO=<path-to-tinygo>` (`services/vela/wasm/projector/Makefile`: `$(TINYGO) build -o production_build/moneypenny_projector.wasm -opt=s -no-debug -target=wasi .`) |
| WASM artifact | `moneypenny_projector.wasm`, 519,641 bytes |
| WASM SHA-256 | `085869849896aa423a5fa6c13cc5651a4446240b538e37c6a517dbd3cbdecf02` |
| Verified format | `file` confirms: WebAssembly (wasm) binary module version 0x1 (MVP) |

**Doubly confirmed, not merely computed once:** the local build's SHA-256 was independently
re-confirmed by the public devnet's own Authority Service — its `POST /deploy/upload` response
(`{artifactId: "sha256:<hex>", wasmSha256: "<hex>"}`) matched byte-for-byte before
`submitDeployRequest` was ever called (§9, and the milestone doc's §"Real deployment/execution
contract"). The binary itself is `.gitignore`'d and was never committed to this repo (Dense
Materials rule) — this hash is the durable record.

## 2. Expected application role / purpose

The **MoneyPenny Confidential Consequence & Settlement Kernel** — a narrow, deterministic,
stateless-per-call WASM guest that projects the consequence of one or more parties' private
financial inputs against their own private limits, entirely inside the TEE, and returns only a
coarse three-valued verdict per authorized recipient. It moves no funds and holds no balances of its
own (`ApplicationInternalState{AppID, ProjectionsHandled}` is a counter only, never a nonce a caller
may rely on). It is a projection/consequence workload, never a custody or settlement engine.

- **App name (proposed):** `moneypenny_projector` (the Makefile's own `APP` variable).
- **Version/policy tag (proposed):** `vela-use-case-zero-underwriting-simulated-v1` — the same
  string `SimulatedUnderwritingProvider.policyVersion` already stamps on every quote, so one version
  identity spans the enclave layer and the simulated-provider layer rather than inventing a second
  scheme. **Not yet confirmed with Vela Engineering.**

## 3. Expected request types

Per `services/vela/velaTypes.ts`'s `VELA_REQUEST_TYPE` (Vela's own `ProcessorEndpoint.RequestType`,
source-verified against the v0.2.0 contract, not guessed):

| Request type | Value | Used for |
|---|---|---|
| `DEPLOYAPP` | 0 | Initial deployment (`submitDeployRequest`) — already exercised on the public devnet (§9). |
| `PROCESS` | 1 | Every confidential single- or multi-party projection request. This is the ONLY request type the guest's actual business logic (`app.go`) reads. |
| `DEANONYMIZATION` | 2 | Not exercised by this codebase — no authority/auditor role is currently registered. |
| `ASSOCIATEKEY` | 3 | Per-party onboarding, once per party before any `PROCESS` request from it can decrypt — already exercised on the public devnet for three independent parties (§9). |
| `TRUSTPROCESS` | 4 | Not exercised by this codebase. |

No asset-bearing `PROCESS` request (native ETH / ERC-20 alongside the ciphertext) has been exercised
yet against either the local stack or the public devnet — the transport supports it
(`submitAssetBearingProcessRequest`, `services/vela/velaClientAdapter.ts`) but Use Case Zero's own
invariant ("a simulated quote never by itself triggers settlement") means it is never invoked
automatically.

## 4. Party / user registration assumptions

- Every requesting party registers its own P-521 communication key via a real, on-chain
  `ASSOCIATEKEY` (RequestType=3) call **before** any `PROCESS` request from it can be decrypted by
  the enclave — this is Vela's own documented onboarding step, not something this codebase invented,
  and it has now been exercised for real (three parties, public devnet, §9).
- The P-521 key is **derived on demand from the party's existing Ethereum signer**
  (`services/vela/agentP521Derivation.ts`'s `deriveAgentP521KeyPair` — HKDF-SHA256-expand a
  challenge-string signature into a P-521 scalar, rejection-sampled against curve order), never
  independently generated or persisted. No new custody surface, no new secret store.
- Namespace isolation between parties within ONE application is enforced by the guest itself via a
  deterministic, opaque `namespace ref`
  (`services/vela/velaPartyNamespace.ts`'s `deriveVelaPartyNamespaceRef` —
  `sha256(applicationId:authorityPrincipal:confidentialPrivacyIdentity)`), never by Vela's own
  per-application isolation (which isolates applications from each other, not parties within one).
- **Key possession never confers constitutional authority** — a registered P-521 key proves
  communication capability only; the separate Passport/mandate chain (metaMe/MoneyPenny) is what
  establishes authority to act. This is a structural property of `deriveAgentP521KeyPair`'s own
  header, proven by a dedicated test (`tests/vela-agent-p521-derivation.test.ts`).

## 5. Expected confidential state model

- The guest holds **no per-user balances and no cross-request state of its own.** Every projection
  is a pure function of the confidential inputs supplied with that one request.
- `ApplicationInternalState{AppID uint64, ProjectionsHandled uint64}` exists only so the state root
  advances per request (the platform expects state to be returned) — `ProjectionsHandled` is a
  counter, explicitly documented as "not a nonce any caller may rely on."
- Multi-party requests hold every contributing party's private inputs SEPARATELY KEYED by namespace
  ref, for the entire lifetime of one request — never merged into an undifferentiated structure
  before the guest's own authorization gate (`resolveAuthorizedCombination`) has run.

## 6. Expected output / disclosure model

- **Three-valued verdict only:** `ACCEPTABLE | UNACCEPTABLE | UNRESOLVED` — no operand, no
  failing-condition name, ever leaves the enclave. The verdict event is publicly observable in shape
  and size, so anything richer than this leaks.
- **`UNACCEPTABLE` is a successful result, not an error** — an execution/infrastructure failure
  (Vela Executor `errorCode != 0`) is a structurally distinct fact, never conflated with a guest-
  computed verdict. This codebase hardened its own TS-side consumers against exactly this conflation
  this same day — see §9 and the Execution Failure Non-Equivalence note below.
- **`COMPUTE_WITH` != `DISCLOSE_TO`.** Consenting to have one's data combined into a joint
  computation grants nothing about what any party — including oneself — may SEE as a result. A
  recipient sees the joint verdict only when validly combined AND every other combined party
  explicitly granted them `DISCLOSE_TO`; otherwise they see only their own standalone verdict.
  Proven remotely, decisively (not by coincidence of matching verdicts), 2026-09-14 — see the
  milestone doc's Case B.
- **Scope binding is non-transitive.** A `ScopeBinding{ApplicationID, RequestRef, OperationType,
  OutputClass}` valid for one exact request context is rejected outright against any other, even
  with identical parties and grants. Proven remotely (Case C, scope replay).
- **Fail-closed `UNRESOLVED`** for any malformed/ambiguous/mismatched scope, checked before any
  cross-party data access.

## 7. Required constructor/config parameters currently known

- `mode: 'artifact_ref'`, `artifactId: 'sha256:<hex>'`, `wasmSha256: '<hex>'` — the real
  `DeployDescriptor` shape (`services/vela/velaTypes.ts`'s `VelaDeployDescriptor`), confirmed
  wire-exact against `HorizenOfficial/vela-nova`'s own `wallet/cmd/deployapp.go` and exercised for
  real on the public devnet.
- `constructorParams`: currently empty (`{}`) for this guest — `app.go` reads no deploy-time
  constructor configuration beyond the artifact reference itself. If the managed environment
  requires an allowed-token list or other constructor input, this guest does not yet read one from
  `constructorParams` (see the deployapp CLI's own `--allowed-tokens` flag, which THIS repo's own
  deploy path does not currently populate).

### 7a. Unresolved constructor/config parameters

No existing constructor-parameter list or trigger-contract reference exists anywhere in
`services/vela/` or the accelerator docs beyond the open question itself (Vela's own item 6 in
`08_VELA_OFFICE_HOURS_QUESTIONS_2026-09-11.md`: "confirm the exact signed update payload schema").
**Submit as an open question; do not propose a constructor schema unvalidated against Vela's actual
managed-deploy tooling.**

## 8. Asset model / ERC-20 allowlisting

Per the team-confirmed baseline (native ETH/ERC-20/facilitator already implemented on Vela's side)
and this repo's own asset-neutral transport widening (`services/vela/velaTypes.ts`'s `VelaAssetRef`,
`VelaMultiPartyPartyInput.inputs: Record<string, number>` — no token-denominated amount hardcoded
anywhere): **no TokenAllowlist entries are required for the current Use Case Zero scope** (a private
risk/coverage verdict, not an on-chain asset transfer). If/when a real settlement instruction is
added, this answer needs revisiting — and, per the `deployapp` CLI's own `--allowed-tokens` flag, the
managed deploy step is where that allowlist would be supplied via `constructorParams`, not
after the fact.

## 9. Evidence to retain: `applicationId ↔ WASM hash ↔ kernel version ↔ policy version`

Priority B, question 5 in `08_VELA_OFFICE_HOURS_QUESTIONS_2026-09-11.md`: *"On deploy, what
canonical fields should we record to bind `applicationId` to the exact WASM? Is the deploy-time
SHA-256 sufficient/canonical?"* — **empirically clearer, not fully closed**, after the public devnet
run: the Authority Service's own `POST /deploy/upload` response independently confirmed the
`wasmSha256`/`artifactId` it stored matched the locally-computed hash BEFORE `submitDeployRequest`
was ever called — one real, source-verified data point that the upload step itself provides SOME
hash confirmation. Still open: whether that confirmation is treated as canonical evidence by Vela's
own on-chain/subgraph records, or whether a stronger binding (e.g. an on-chain event naming both the
`applicationId` and the WASM hash together) exists or is planned for the MANAGED environment
specifically.

This codebase's own current binding: `FrozenUnderwritingEnvelope.applicationId` is the one artifact
in the causal chain that actually carries `applicationId`; `UnderwritingProvider.policyVersion` binds
the pricing/policy formula version onto `golden_cycle_records.provenance.policyVersion`; the WASM
SHA-256 above is the kernel version. A follow-on implementation item, once Vela's answer is in hand,
is recording the full four-way binding on the frozen-envelope receipt itself — not built
speculatively ahead of that answer.

**New finding from the devnet run — fuel-cost model undocumented:** `minFeePerRequest()` reflects a
single-party execution floor; a multi-party request (processing more than one party's
`ProjectionInputs`) genuinely required more execution "fuel" than that floor covers, failing with
`errorCode 12 "insufficient fuel: required 25 wei, provided 10 wei"` on the public devnet until the
fee ceiling was raised generously. See the external question block below.

## 10. Managed environment trust expectations

- No direct terminal access; the environment is shared across apps (Vela Engineering's own
  confirmed constraint) — this repo's deployment path must be entirely wire/API-driven (Authority
  Service upload + on-chain calls), which is exactly what `scripts/vela/public-devnet-smoke.ts`
  already proved works end-to-end against a comparable (though unmanaged) instance.
- Attestation establishes the trusted TEE signing key ONCE, at environment setup; subsequent update
  payloads are verified against that registered key, never re-attested per request
  (`11_VELA_TEAM_CONFIRMED_BASELINE_v0.1.md` §2 — already reflected in this repo's Environment Trust
  Evidence vs. Application Execution Evidence separation, §3.1 of the architecture doc).
- **This repo has NOT yet exercised a Nitro-attested deployment of any kind.** Both proven
  environments (local Docker, public devnet) run `NoAttestationTeeAuthenticator` — `attestationMode:
  'no_attestation'`. `teeAttestationVerified` has never read `true` anywhere in this codebase's live
  history. The managed environment is the first place that could change.

## 11. P-521 / Ethereum signer assumptions

See §4 above (party registration). Structurally: **no Vela role requires MoneyPenny/AigentZBeta to
create, export, or migrate any new custody surface** (`docs/vela/VELA-SIGNER-TOPOLOGY-001.md`'s own
conclusion, source-verified against Vela's pinned contracts). MoneyPenny participates purely as an
end-user role: it signs `submitRequest`/`submitRequestFor` with its EXISTING wallet key, and derives
a P-521 comms key on demand, in-process, non-persistently, from a signature over Vela's fixed
challenge string using that SAME existing key. The WASM guest itself never sees a private key at all
— only a `types.Address` (`sender`) and decrypted payload bytes.

## 12. No-upgrade / new-applicationId-on-new-WASM constraint

Team-confirmed and already reflected throughout this codebase's evidence model (architecture doc
§3.2, §6): a new WASM deployment means a new `applicationId` and fresh state; there is no in-place
upgrade/migration path; locked funds in an old application must be manually unlocked. Every
deployment this bundle requests should be treated, from day one, as potentially superseded by a
later one with a DIFFERENT `applicationId` — nothing in this codebase's receipt/evidence model
assumes `applicationId` is a durable identity for "the kernel" (see
`RES-2026-08-22-VELA-APPLICATION-ID-EPHEMERAL-001`).

## 13. AWS KMS recovery / current privileged-access caveat

Per `docs/vela/VELA-SIGNER-TOPOLOGY-001.md` and the architecture doc's own §11 item 6: in the
DEV recovery mode (`EXECUTOR_KEYSET_RECOVERY_TYPE=0`), the TEE SigningKey and CommunicationKey are
loaded from plaintext env vars — fine for local/devnet iteration, never acceptable for anything
production-class. The PRODUCTION recovery path is understood (from `vela-starterkit` docs, not
independently source-verified at the Go level by this repo — tagged `REQUIRES_SOURCE_READ` in
`VELA-SIGNER-TOPOLOGY-001.md`) to recover the enclave keyset from an AWS-KMS-administered encrypted
blob via a handshake. **This means KMS administration is itself a privileged-access surface in the
current recovery model** — whoever administers that KMS key has a path to the TEE's signing
identity that is NOT mediated by the attestation chain itself. Multi-TEE recovery (removing this
dependency) is understood to be planned but not deployed. This repo surfaces this as an explicit,
disclosed risk-evidence fact for the managed-deployment conversation, not a fabricated refusal rule
— if the managed environment's recovery model differs from this, that difference should be recorded
here once confirmed.

---

## External question block for Vela Engineering

> We successfully deployed and exercised our multi-party TinyGo guest on the public v0.2.0 devnet.
>
> 1. Is there a documented or queryable fuel-cost model for guest execution, e.g. based on payload
>    size, party count, state size, or WASM work?
> 2. What execution-status field should clients treat as authoritative before decoding application
>    output, so transport/resource failure cannot be confused with a valid guest result?
> 3. What is the canonical evidence binding the resulting `applicationId` to the exact uploaded WASM
>    hash/version?
> 4. For managed deployment, are Base Sepolia and Horizen testnet separate trust domains / TEE
>    signer registrations, or do they share any environment identity?
> 5. What exact deployment bundle / constructor/config inputs do you require from us?

(Question 2 is already answered for OUR OWN client code — Vela's `errorCode` on the completed
request is exactly this signal, and this codebase now checks it before trusting any decoded
disposition, §9/Execution Failure Non-Equivalence. The question to Vela is whether there is a
MORE authoritative or earlier signal — e.g. before spending the on-chain gas of a full submission —
that would let a client validate a request's likely fee sufficiency in advance.)

## What to actually send

1. This document as narrative context (sections 1-13 answer everything askable from repo state
   alone; §7a and the external question block name what genuinely needs Vela's answer).
2. The real WASM binary + SHA-256 from §1.
3. The real test-wallet addresses, once Supabase is reachable again (unchanged blocker, independent
   of everything else in this bundle — see the prior revision's §6 for the exact query).
4. The external question block above, verbatim.

## Relationship to other milestones

This bundle is deliberately independent of:
- Item 11's seed/fixture work (the local, `SIMULATED`-only demo) — neither blocks the other.
- The public Vela v0.2.0 devnet milestone
  (`codexes/packs/agentiq/updates/2026-09-14_vela-public-devnet-v0.2.0-milestone.md`) — that proof is
  COMPLETE and already strengthens this bundle's own evidence (§1, §9), but the devnet itself is a
  third-party convenience instance, not the managed environment this bundle is prepared for, and
  achieving it did not require or depend on Vela Engineering's managed-deployment process at all.
