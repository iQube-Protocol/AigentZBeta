# Vela Accelerator — Phase 0 Code Inventory (Constitutional Yield & Risk / Use Case Zero)

**Date:** 11 September 2026
**Status:** Read-only research/inventory. No application code modified. This is the Phase 0
deliverable required by `docs/vela/accelerator/constitutional-financial-services/09_CLAUDE_IMPLEMENTATION_HANDOFF_v0.2.md`
("Phase 0 — inspect actual code... Locate and report before modifying").
**Scope:** locate and characterize every existing seam the handoff's Phase 0 checklist names,
confirm/deepen the prior quick read of `types/confidentialProjection.ts`, run the anti-pattern
greps the handoff specifies, and produce a gap assessment across the handoff's Phase 1–11.
**Not in scope:** any implementation, any code change, any design of the Use Case Zero vertical
slice itself (Phase 11) beyond scoping what it would require.

## 0. Read-first package reconciled

Read in full: `09_CLAUDE_IMPLEMENTATION_HANDOFF_v0.2.md`, `README.md`,
`05_ACCELERATOR_USE_CASE_ZERO_SPEC_v0.1.md`, `11_VELA_TEAM_CONFIRMED_BASELINE_v0.1.md`,
`08_VELA_OFFICE_HOURS_QUESTIONS_2026-09-11.md`, `12_VELA_SOURCE_REGISTER_2026-09-10.md` (all in
`docs/vela/accelerator/constitutional-financial-services/`), plus the repo's own prior Vela
research: `docs/vela/VELA-SIGNER-TOPOLOGY-001.md`, `docs/vela/VELA-ATTESTATION-BOUNDARY-001.md`,
`docs/vela/VELA-PRIVACY-BOUNDARY-001.md`, `docs/vela/VELA-LIVE-ACTIVATION-001.md`,
`docs/vela/CONSEQUENCE-ONTOLOGY-001.md`, `docs/vela/VELA_EARLY_ACCESS_HANDOFF.md`.

**Headline conclusion:** the handoff package (written 10–11 Sep 2026, explicitly as a reconciliation
against "existing repo Vela architecture/privacy/attestation docs") undersells what already exists.
This repo already implements — and has locally proven — most of the handoff's Phase 1–8
corrections *before* the Vela-team confirmation arrived. The two team-confirmed correction docs
(`11_VELA_TEAM_CONFIRMED_BASELINE_v0.1.md`, this repo's own `VELA-ATTESTATION-BOUNDARY-001.md` /
`VELA-SIGNER-TOPOLOGY-001.md`) independently reached the *same* conclusions about
environment-vs-per-request attestation and P-521-from-existing-custody weeks apart, from two
different sources (Vela-team direct answers vs. this repo's own source-code reading of
`vela`/`vela-common-ts` at pinned tag `v0.2.0`). They agree. That agreement is itself evidence the
existing modeling is sound, not merely convenient.

## 1. Already exists and is correctly modeled

### 1.1 Environment-level attestation, never per-request (the handoff's own "critical correction")

Fully modeled, before the handoff existed. `types/confidentialProjection.ts:71-87` declares
`AttestationMode` (`'NO_ATTESTATION_LOCAL' | 'NITRO_ATTESTED'`) as a property of the **deployment**,
and `ConfidentialProofState` as three permanently distinct states where
`PRODUCTION_TEE_ATTESTATION_PROVEN` is reachable *only* from a `NITRO_ATTESTED` deployment
(`velaProjectionProvider.ts:93-98`, `provenStatesFor()`). `verifyProjectionEvidence()`
(`velaProjectionProvider.ts:228-257`) computes `protocolExecutionVerified` (was this result signed by
the chain-registered TEE signer — checkable per request) and `teeAttestationVerified` (was that
signer's *registration* itself backed by real hardware attestation — a fact about the deployment,
read from `attestationMode`, never from whether a request succeeded) as two structurally separate
booleans with an explicit code comment: *"the deliberate absence of `&& protocolExecutionVerified`
below... Coupling them would let a successful local execution read as attested."* This is exactly
the handoff's `EnvironmentTrustEvidence` vs `VelaExecutionEvidence` split (§"Critical correction"),
implemented as two independent fields rather than two named record types — the same separation, a
different (and arguably tighter) encoding. `docs/vela/VELA-ATTESTATION-BOUNDARY-001.md` is the
underlying research (source-verified against pinned `vela` tags) that this code is built on, and it
states the identical conclusion independently: *"a `NoAttestationTeeAuthenticator` deployment and a
correctly-configured real one are indistinguishable [from request/response behavior]."*

### 1.2 Application identity binding (Phase 3)

`velaConfig.ts:25-34` — `applicationId` deliberately has **no env var** and is **not part of**
`VelaDeploymentDescriptor`, with an explicit citation:
`RES-2026-08-22-VELA-APPLICATION-ID-EPHEMERAL-001` /
`CI-2026-08-22-VELA-APPLICATION-ID-DEPLOYMENT-RECORD-001` (both exist:
`codexes/packs/agentiq/resolution-records/records/RES-2026-08-22-VELA-APPLICATION-ID-EPHEMERAL-001.json`,
`codexes/packs/agentiq/resolution-records/candidate-invariants/CI-2026-08-22-VELA-APPLICATION-ID-DEPLOYMENT-RECORD-001.json`).
The comment states the exact reasoning the handoff's Phase 3 requires: *"a Vela `applicationId` is a
property of one deployment TRANSACTION against a specific chain's current state, never a durable
identity for 'the WASM application.'"* Every provider constructor takes `applicationId` as a per-call
parameter (`velaProjectionProvider.ts:100-104`, `velaFactorProvider.ts:86-113`), never a static
config value — so "new WASM ⇒ new applicationId ⇒ fresh state, no migration" is already the
structural default, not something that needs to be added.

### 1.3 P-521 does not require new custody — analysis complete (Phase 4, analysis half)

`docs/vela/VELA-SIGNER-TOPOLOGY-001.md` (source-verified against pinned SHAs of `HorizenOfficial/vela`,
`vela-common-ts`, `vela-common-go`, §"6. End-user key material") already documents the exact
mechanism the handoff names (`deriveP521PrivateKeyFromSigner`,
`vela-common-ts/src/crypto/wallet.ts`) and reaches the handoff's own recommended conclusion,
independently and in more depth: *"Structurally, nothing about Vela requires MoneyPenny to create,
export, or migrate any new custody surface... it derives a P-521 comms key on demand, in-process,
non-persistently from a signature over Vela's fixed challenge string using the same existing
[AgentKeyService-held] key."* This directly answers the handoff's Phase 4 instruction ("Prefer:
existing agent Ethereum custody -> deterministic Vela P-521 derivation... Do not create a second
long-lived P-521 secret store"). See §2.1 below for what is *not* yet done (the actual derivation
function).

### 1.4 Confidentiality is bounded, not total — the verdict-is-the-leak-surface rule (Phase 6)

Fully modeled and enforced at three layers:
- **Domain type** (`types/confidentialProjection.ts:57-60`): `ConfidentialProjectionDisposition` is
  the *only* vocabulary a provider may return — three values, nothing else.
- **Provider** (`velaProjectionProvider.ts:47-56`): `ConfidentialVerdictPayload` is declared as
  exactly `{ verdict: ... }`, with an explicit comment that any app used with the provider "must emit
  exactly this and nothing more (no operand values, no failing-condition name)."
- **WASM guest** (`services/vela/wasm/projector/app/app.go:1-29,74-77`): the file header states three
  numbered design rules — verdict is a `PlainEvent` (encrypted to the requester), never an
  `AppEvent` (plaintext on-chain); an UNACCEPTABLE projection is a *successful* result, never an
  `Error`; the verdict carries no operands and no failing-condition name. `VerdictEvent` is a
  single-field struct (`app.go:75-77`). `app_test.go` (`services/vela/wasm/projector/app/app_test.go`,
  212 lines) exists specifically to fail the build if the verdict event ever carries more than one
  field, per `docs/vela/VELA-PRIVACY-BOUNDARY-001.md`'s own recommendation for Slice 2D.
- `VELA-PRIVACY-BOUNDARY-001.md` additionally documents, at field granularity, what is *not*
  confidential regardless of app design (`assetAmount`, withdrawal amount/destination, `sender`,
  `applicationId`/`requestId`, and the `TRUSTPROCESS`/trigger plaintext path) — this is exactly the
  handoff's Phase 6 "audit all... request metadata... no plaintext leakage" requirement, already
  performed at the protocol level, not just asserted.

### 1.5 The composition seam: public + confidential, owned by neither side

`services/constitutionalCommerce/unifiedConsequenceProjection.ts` (402 lines) is the module the
handoff implicitly needs for "Frozen Consequence/Risk Envelope" + "private risk/consequence verdict"
composition. It composes CFS-006a's public invariant-graph forecast
(`composePublicComponent()`) with a confidential provider's evidence
(`composeConfidentialComponent()`) into one `ConsequenceProjection`
(`types/constitutionalCommerce.ts:199-234`), with precedence UNACCEPTABLE > UNRESOLVED > ACCEPTABLE
(`composeDispositions()`, lines 289-341) and a separate `completeness`/`unresolvedComponents` pair so
a definite refusal is never hidden behind incomplete evidence. It structurally cannot import
`ActionAuthorisation` or any Vela type (module header, lines 18-28) — canary-enforced by
`tests/unified-consequence-projection.test.ts`. `AttestationRequirement` (`'NOT_REQUIRED' | 'REQUIRED'
| 'UNSPECIFIED'`, `types/constitutionalCommerce.ts:143`) fails closed on `UNSPECIFIED`
(`unifiedConsequenceProjection.ts:239-257`) — omission is never read as permission.

### 1.6 Authorisation derivation, independent of the gate (Phase 11's "authorize" step)

`services/constitutionalCommerce/actionAuthorisation.ts` — `deriveActionAuthorisation()`
independently re-checks `projection.disposition`/`completeness` rather than trusting the upstream
gate's `allow` decision (module header, lines 8-16; branch table, lines 53-69). This is the exact
"coverage does not authorize action" rule the Use Case Zero spec states in §10:
*"authority → mandate → public consequence projection → confidential Vela projection → unified
projection → action authorization → bounded execution → observed consequence → causal receipt"* is
implemented end-to-end as real, separately-typed modules, not prose:
`actionAuthorisation.ts` → `boundedExecution.ts` (91 lines, `bindExecution()` — pure, never signs or
broadcasts, checks `status === 'AUTHORISED'` and a real clock comparison against `expiresAt`) →
`observedConsequence.ts` (93 lines, `compareProjectionToObservation()` — three-way
`MATCHED_PROJECTION | DIVERGED_FROM_PROJECTION | UNRESOLVED`) → `causalChain.ts` (72 lines,
`assembleCausalChain()` — read-only projection over the already-existing typed records, duplicates
no fields) → `commerceReceipts.ts` (114 lines — three receipt emitters, `personaId`-gated,
best-effort, never carrying a plaintext confidential value).

### 1.7 Gate 2 and the one narrow authoritative-mode exception

`services/registry/capabilityInvocationGates.ts:185,205-235` — `CONFIDENTIAL_CONSEQUENCE_PROJECTION`
is a single named constant, the *only* capability permitted into `authoritative` execution mode, and
only when it carries an attached `ConsequenceProjection` with `disposition === 'ACCEPTABLE'`. Every
other capability still hits `MODE_NOT_PERMITTED` unconditionally (line 234). The gate's own comment
(lines 220-225) is explicit that passing this gate is a governance-layer dispatch permission, not a
financial-domain authorisation — `deriveActionAuthorisation()` (§1.6) is the separate, real
derivation. Covered by `tests/vela-slice2f-capability-invocation.test.ts`.

### 1.8 A real, already-working end-to-end caller exists

`services/factor/factorConfidentialWorkload.ts` is **the first and, per its own header, only** caller
of `ConfidentialProjectionProvider` outside `velaProjectionProvider.ts` itself and test/script
fixtures. It drives a real Factor act (admission-packet policy evaluation: does a case's computed
readiness score clear a policy threshold) through the full prepare → submit → observe → evidence →
verify sequence, persists onto existing durable homes (`factor_evidence_items`, case event timeline,
an activity receipt) rather than a new table, and never lets `readinessScore`/`policyThreshold`
reach any persisted payload — only commitments and the coarse verdict. Covered by
`tests/factor-vela-confidential-workload.test.ts`. This is direct, working evidence that the
prepare→submit→observe→evidence→verify seam is not just typed but exercised.

### 1.9 Local proof, Docker-free test double, and a live-stack precedent

`services/vela/velaTestTransport.ts` (127 lines) is a deterministic in-memory `VelaTransport` that
reproduces the real transport's *shape* (envelope layout, null-while-pending polling, errorCode
semantics) without faking real ECDH — its own header states this is deliberate, "a test double that
faked ECDH could mask a real crypto defect." `services/vela/velaClientAdapter.ts` (333 lines) is the
real transport, implementing the exact Go-matched ECDH(P-521)→HKDF-SHA256→AES-256-GCM cipher
(`velaCryptoSelfTest()` proves the round trip). Both were proven against a live local
`vela-starterkit` Docker Compose stack per `VELA-ATTESTATION-BOUNDARY-001.md`'s Slice 2A account
(deploy → register → deposit → confidential balance read → two-party private transfer, real Anvil
tx hashes) — that stack runs `NoAttestationTeeAuthenticator`, so the run proved protocol/wire-format
lifecycle and correct cross-language cryptography, explicitly **not** hardware attestation (the doc
itself states this distinction as its headline finding, to prevent exactly the overclaim the
handoff also warns against).

### 1.10 Config boundary already externalized (Phase 1)

`services/vela/velaConfig.ts` is already the single config surface: `resolveVelaDeployment('local' |
'early_access')` resolves `chainId`, `rpcUrl`, `processorEndpointAddress`, `teeAuthenticatorAddress`,
`authorityServiceUrl`, `subgraphUrl`, `attestationMode` — every `early_access` field is read from a
named `VELA_EARLY_ACCESS_*` env var via `requireEnv()`, which throws a specific "missing X" error
rather than defaulting or guessing (lines 63-76), including a fail-closed check on
`attestationMode` against a runtime allowlist (not just a TypeScript `as` cast) so a misconfigured
env var cannot silently downgrade attestation. `docs/vela/VELA-LIVE-ACTIVATION-001.md` (Stage 3.3
runbook) confirms this is already recognized as "the ONLY config surface that should change to
retarget from local Docker Compose to the real instance" and is fully blocked on Horizen granting
early-access — not an engineering gap.

## 2. Partially exists and needs extension

### 2.1 P-521 derivation — analysis done, implementation glue missing (Phase 4)

`grep -rln "P-521\|P521\|secp521\|deriveP521"` across `services/` and `types/` returns exactly five
hits, all inside the Vela module itself (`velaProjectionProvider.ts`, `velaClientAdapter.ts`,
`velaTypes.ts`, `services/vela/wasm/projector/app/app.go`) plus the research doc
(`VELA-SIGNER-TOPOLOGY-001.md`). `VelaClientAdapterOptions`
(`velaClientAdapter.ts:133-141`) takes `requesterP521PrivateKeyHex` as a **caller-supplied raw hex
string** — nothing in this repo actually derives it from an Ethereum signer the way
`deriveP521PrivateKeyFromSigner` does in `vela-common-ts`. `AgentKeyService`
(`services/identity/agentKeyService.ts`) is confirmed as the existing agent Ethereum custody surface
(AES-256-CBC-encrypted `evmPrivateKey` in the `agent_keys` table, `services/identity/agentKeyService.ts:88-106`),
and `AgentPurposeWalletService` (`services/wallet/agentPurposeWalletService.ts`) extends the same
mechanism for purpose-bound wallets (e.g. Horizen Verifiable-PnL trading wallets) — reusing
`AgentKeyService`'s exact AES-256-CBC path (module header, lines 27-28). Neither exposes or wraps a
P-521 derivation today. **What's needed:** a small TypeScript function mirroring
`deriveP521PrivateKeyFromSigner` (sign a fixed challenge string with the existing Ethereum key, HKDF
the signature bytes, rejection-sample into a valid P-521 scalar per `VELA-SIGNER-TOPOLOGY-001.md`
§6b) that takes an `AgentKeyService`-resolved signer and produces the
`requesterP521PrivateKeyHex` value `VelaClientAdapterOptions` already expects — not a new custody
store, a pure derivation function plumbed into the existing key. `scripts/vela-slice2g-associate-key.ts`
(named in `VELA-LIVE-ACTIVATION-001.md` step 3) is the provisioning-time caller this would feed.

### 2.2 Asset neutrality — domain-neutral, transport-narrowed to zero-value ETH (Phase 9)

`types/confidentialProjection.ts` has no ETH-only assumption anywhere in its vocabulary. But the
concrete transport interface is narrower: `VelaTransport.submitProcessRequest(applicationId,
encryptedPayload)` (`velaTypes.ts:125-126`) takes **no token address or asset amount parameter at
all**, and the one real implementation (`VelaClientAdapter.submitProcessRequest`,
`velaClientAdapter.ts:193-228`) hardcodes `ETH_SENTINEL` and `0n` for `tokenAddress`/`assetAmount`
(lines 208-209) — correct and deliberate for a pure projection workload that "carries no funds" (the
Go app's own header: "It moves no funds and holds no balances of its own"), but not yet extended for
a workload that *does* need to carry value (e.g. a premium payment or settlement instruction per Use
Case Zero §11). The on-chain wire ABI already supports `tokenAddress`/`assetAmount`
(`PROCESSOR_ABI`, `velaClientAdapter.ts:39`) and ERC-20 paths are Vela-team-confirmed live
(`11_VELA_TEAM_CONFIRMED_BASELINE_v0.1.md` §10) — the gap is purely that this repo's transport
interface/implementation hasn't yet been widened to pass a token/amount through, because nothing
built so far has needed to. Not a defect; a scoped extension for whichever Phase 11 sub-step needs
asset-bearing settlement.

### 2.3 Multi-agent isolation within one shared app — no existing namespace primitive found (Phase 5)

No hits for party/contributor namespace patterns inside `services/vela/`,
`services/constitutionalCommerce/`, or `services/factor/factorConfidentialWorkload.ts`. The
`ConfidentialProjectionIdentitySet` (`types/confidentialProjection.ts:109-120`) already separates
five identity roles (`authorityPrincipal`, `mandateSigner`, `confidentialRequester`,
`confidentialPrivacyIdentity`, `executionSigner`) per request — this is the right *shape* to bind a
contributor/party handle to a request, and the handoff's Phase 5 asks for exactly this kind of
binding — but nothing today threads a private-state *namespace* per contributor inside one shared
Vela application's state. The WASM guest today (`app.go`) keeps a single global
`ApplicationInternalState{AppID, ProjectionsHandled}` with no per-party subdivision, because the
current projector is a pure stateless-per-call comparison, not a multi-party ledger. This is
consistent with the handoff's own framing ("Vela per-app isolation does not automatically create
intra-app constitutional isolation... do not build a generalized IAM system if existing
iQube/persona/delegation primitives already provide this") — the existing primitives
(`ConfidentialProjectionIdentitySet`, iQube/persona/delegation) are the right building blocks, but no
one has yet composed them into a per-party namespace scheme for a *multi-party* WASM app (the
liquidity-portfolio pilot in `05_ACCELERATOR_USE_CASE_ZERO_SPEC_v0.1.md` §4/§15 is exactly this
shape and has not been built).

## 3. Genuinely net-new (confirmed absent by grep)

- **`RiskSlice`** — zero matches anywhere in the repo (`grep -rln "RiskSlice"`, full tree). The
  entire object the Use Case Zero spec §8 defines (origin/process, bearer, probability, severity,
  expected repair burden, maximum exposure, coverage eligibility/limit, premium/price,
  exclusions/conditions, evidence/version, observed outcome) does not exist in any form.
- **Underwriting/coverage/premium engine** — `grep -rln "underwrit"` across `services/` and `types/`
  returns exactly one hit, `services/invariants/riskField.ts`, which cites "underwriting" only as a
  bibliographic reference (Data Risk for Marketplaces v2, a cited external framework) inside a
  structural risk-factor-combination module — not an underwriting implementation. No coverage
  quote/terms interface, no premium computation, no eligible/ineligible/unresolved coverage decision
  path exists anywhere.
- **`services/financialServices/riskEnvelope.ts` is confirmed a different concept — do not conflate.**
  This module derives MoneyPenny's own financial-profile risk **limits** (liquidity, concentration,
  volatility, commitment-coverage buckets → `positionNotionalLimit`/`lossRiskBudget`/etc., always
  `serviceClass: 'PROPOSAL'`, never an authority grant — `riskEnvelope.ts:1-42`). It is a pure
  derivation from `FinancialProfileAggregates` and reuses CTP-001's own `ConsequenceProjection` shape
  (`types/ctp.ts`) — a **completely separate type** from `types/constitutionalCommerce.ts`'s
  `ConsequenceProjection`. This is unrelated to the handoff's "Frozen Consequence/Risk Envelope"
  (the Vela guest's frozen-input envelope that freezes external facts before request submission,
  Phase 2). The two share the English word "risk envelope" and nothing else — same naming collision
  the task instructions flagged in advance.
- **Bankr's "Use Case Zero" (`services/factor/useCaseZeroOrchestrator.ts`,
  `useCaseZeroReadinessProjection.ts`, `bankrCapabilityHandlers.ts`) is a different, already-shipping
  Use Case Zero** — a resumable orchestrator (884 lines) for agent admission → Aegis assessment →
  wallet provisioning → Bankr token-launch draft/preflight, explicitly out of scope for token
  submission/signing/broadcast/auto-approval (module header). It shares infrastructure with the Vela
  accelerator's Use Case Zero only incidentally: `useCaseZeroOrchestrator.ts` calls
  `runAdmissionPacketPolicyEvaluation` from `factorConfidentialWorkload.ts` (§1.8), i.e. the same
  Factor↔Vela confidential-projection seam this accelerator work would reuse — but the two "Use Case
  Zero"s are otherwise unrelated deliverables, and per
  `05_ACCELERATOR_USE_CASE_ZERO_SPEC_v0.1.md` §2/§14, BANKR/token-issuance is explicitly **not
  required** for the Vela accelerator's Use Case Zero. Do not conflate the names in any future work
  order.
- **The Use Case Zero vertical slice itself** — participant records, one participation schedule,
  risk bindings, recipient receipts, a coverage/quote path, and the settlement rail selection (spec
  §16 "Baseline additions") do not exist. Rough scope, given what's reusable (not a design, per task
  instructions): reuse `unifiedConsequenceProjection.ts`'s composition seam and
  `actionAuthorisation.ts`→`boundedExecution.ts`→`observedConsequence.ts`→`causalChain.ts`→
  `commerceReceipts.ts` chain unchanged; add a new WASM guest (or extend the existing projector) that
  accepts multi-participant frozen inputs and emits a `RiskSlice`-shaped verdict via the same
  `PlainEvent`-only, single-verdict-field discipline `app.go` already establishes; add a
  `RiskSlice`/coverage-quote type family in a new or existing types module (not
  `types/constitutionalCommerce.ts`, which is described elsewhere in this repo as frozen for
  VELA-001); and add participant-namespace handling per §2.3 above. This is real, scoped, non-trivial
  new work — the spec's own six-week sequencing (§16) treats weeks 3-6 as new build, which lines up
  with this assessment.

## 4. Anti-pattern grep results

Every anti-pattern the handoff Phase 0 names was searched for directly; none found in application
code. Results, verbatim search scope:

| Anti-pattern | Search | Result |
|---|---|---|
| Attestation treated as per-request | `per.request.*attestation`, `per-request Nitro`, `fresh.*attestation.*each` across `services/vela`, `types/confidentialProjection.ts` | **Absent.** Confirmed correctly modeled as environment-level (§1.1). |
| One-Vela-app-only as permanent constraint | `only one application`, `single application only`, `one.app.only`, `permanent.*constraint` across `services/vela`, `services/constitutionalCommerce`, `types/confidentialProjection.ts` | **Absent.** `applicationId` is already a per-call parameter, never hardcoded to one value (§1.2). |
| ERC-20 unsupported | `ERC-20 is not supported`, `ERC20 not supported`, `erc-20 unsupported`, `only.*ETH.*supported` across `services/vela`, `services/constitutionalCommerce` | **Absent** as a stated assumption. **Flagged as a real, narrower gap** in §2.2: the concrete transport implementation is currently ETH-sentinel/zero-value only, not because of a stated ETH-only belief but because no caller has needed asset-bearing requests yet. |
| P-521 needs separate persistent custody | `separate.*P-521`, `new.*P521.*store`, `persistent P-521` across `services/` | **Absent.** `VELA-SIGNER-TOPOLOGY-001.md` explicitly concludes the opposite (§1.3). The derivation function itself is simply not yet written (§2.1) — a gap, not a wrong assumption. |
| App upgrades preserve app ID/state | `upgrade.*preserve`, `migrat.*state.*upgrade`, `same applicationId.*upgrade` across `services/vela`, `docs/vela` | **Absent** in code. Only hit is the handoff document itself correctly stating the *false* version of this as something to avoid (`09_CLAUDE_IMPLEMENTATION_HANDOFF_v0.2.md:105`). |
| Testnet assumed to provide terminal access | `terminal access`, `direct.*ssh.*vela`, `direct access to.*testnet` across `services/vela`, `docs/vela` | **Absent** in code. Hits are only in the docs correctly stating no terminal access exists (`README.md:101`, `11_VELA_TEAM_CONFIRMED_BASELINE_v0.1.md:20`). |

No further anti-pattern instances were found by broadening the search to `docs/vela/**` and the
accelerator package itself — every hit was the documentation correctly describing the corrected
reality, never code or docs asserting the wrong version.

## 5. Recommended phase ordering (recommendation, not a decision)

Given §1–3 above, most of Phases 1, 2, 3, 6, 7 (partially — see below) are **already done** at the
level the handoff asks for. The realistic remaining work, in order of leverage and dependency:

1. **Phase 4 completion (P-521 derivation function)** — smallest, most self-contained gap; unblocks
   real (non-test-transport) requester provisioning without any new custody surface. Natural first
   step because `VELA-LIVE-ACTIVATION-001.md` step 3 already names the script
   (`scripts/vela-slice2g-associate-key.ts`) this would feed, and it has zero dependency on Vela
   early-access actually arriving (it can be written and unit-tested against a known Ethereum key
   today).
2. **Phase 9 (transport asset-neutrality widening)** — extend `VelaTransport.submitProcessRequest`
   and `VelaClientAdapter` to accept `tokenAddress`/`assetAmount`, matching the wire ABI that already
   supports it. Needed before any settlement/premium-payment step in Phase 11 can move real value.
3. **Phase 5 (multi-agent/party isolation design)** — design (not build) the per-party namespace
   scheme for a shared MoneyPenny kernel, composing the existing `ConfidentialProjectionIdentitySet`
   + iQube/persona/delegation primitives per the handoff's own instruction not to build a new IAM
   layer. This is a prerequisite for the Use Case Zero pilot's three-participant shape
   (`05_ACCELERATOR_USE_CASE_ZERO_SPEC_v0.1.md` §4), so it should be scoped before, not during, the
   vertical slice build.
4. **Phase 11 (Use Case Zero vertical slice)** — the genuinely new work: `RiskSlice` type family,
   a new/extended WASM guest for multi-participant frozen-input evaluation, the coverage/quote path
   (baseline simulated provider first, per spec §9), and wiring participant records into the existing
   `unifiedConsequenceProjection.ts` → `actionAuthorisation.ts` → ... → `commerceReceipts.ts` chain
   unchanged. This is where Phases 4/5/9's completions actually get consumed.
5. **Phases 7, 8, 10 (idempotency/reorg, KMS recovery risk representation, runtime limits)** — these
   are largely **evidence/documentation tasks against Vela's own confirmed behavior**, not new
   mechanism: request-ID/state-root threading already exists in `VelaRequestResult`
   (`velaTypes.ts:82-111`) and is already carried through `ConfidentialProjectionEvidence`'s
   `executionProofRefs` (`velaProjectionProvider.ts:204-211`); KMS-recovery risk representation is a
   risk-evidence-model addition (not a new mechanism) once a place to attach infrastructure-risk facts
   is confirmed; runtime limits stay explicitly `UNRESOLVED`/configuration per the handoff's own
   instruction (Phase 10) and need no code until Vela Engineering supplies numbers. These can trail
   the Phase 11 build rather than gate it.
6. **Phases 1, 2, 3, 6** — no further engineering work identified; treat as **done, pending Horizen
   early-access** (Phase 1's `VELA_EARLY_ACCESS_*` env vars have no value to plug in yet) rather than
   as open implementation items.

This ordering is a suggestion for sequencing effort, not a claim that any of it is authorized to
start — the handoff itself asks for "reconcile facts first, then minimal changes," and this document
is the reconciliation; the operator/Vela-team should confirm before Phase 4 or later work begins.

## 6. Open questions needing operator or Vela-team input before implementation

Cross-referenced against `08_VELA_OFFICE_HOURS_QUESTIONS_2026-09-11.md` (Priorities A–H, 29
questions) rather than duplicated. That document already covers the Vela-team-facing questions this
inventory would otherwise raise (app-identity binding fields, multi-agent state-namespace pattern
recommendation, P-521 key-rotation migration path, report-authority scoping, managed-testnet
deployment-bundle contents, operating limits, KMS/recovery re-attestation). Nothing in this
inventory contradicts or needs to add to that list on the Vela-team-facing side.

Questions this inventory surfaces that are **repo/operator-facing**, not Vela-team-facing, and are
not already covered by the office-hours document:

1. **Where should `RiskSlice` and the coverage/quote types live?** `types/constitutionalCommerce.ts`
   is described elsewhere in this repo (module header, `unifiedConsequenceProjection.ts`) as frozen
   for VELA-001. A new types module (e.g. `types/constitutionalRisk.ts`) seems consistent with how
   `types/confidentialProjection.ts` and `types/constitutionalCommerce.ts` were kept separate from
   each other — but this is an operator/architecture call, not one this inventory should make.
2. **Does the multi-party liquidity-portfolio pilot (spec §4/§15) get its own WASM guest, or does the
   existing `services/vela/wasm/projector/app/app.go` projector get extended?** The existing projector
   is single-participant and stateless-per-call by design; a multi-party, stateful (participation
   schedule, allocations) app is a materially different guest. `VELA-LIVE-ACTIVATION-001.md` step 2
   explicitly freezes the current projector WASM hash for the Stage 3.3 promotion runbook — a new
   guest would need its own deploy/hash lifecycle, not a fork of the frozen one.
3. **Who owns "external insurer/reinsurer" partner-path scoping** (spec §9 "Partner path") — this
   inventory found no existing partner-integration seam for a real underwriting capacity provider,
   and the spec itself treats this as optional/stretch (§13), so it is flagged only as a known
   absence, not a blocking gap.
4. **Confirm whether `services/venture/trading/serviceLedger.ts`** (named in the accelerator
   `README.md`'s "Repository reconciliation at publication" table as holding reusable deterministic
   simulated-service-obligation accounting) should be reused for the pilot's settlement bookkeeping,
   or whether Phase 11's settlement stays entirely inside the new commerce-receipt chain. This
   inventory did not read that file in depth (out of the Phase 0 checklist's named file list) — flagged
   for a follow-up read rather than asserted either way.

## What this inventory did not have scope/time to check

- Did not read `services/venture/trading/serviceLedger.ts` in depth (named only in the README's
  reconciliation table, not in the Phase 0 checklist) — see open question 4 above.
- Did not verify `INitroProver`'s own on-chain verification implementation
  (`VELA-ATTESTATION-BOUNDARY-001.md` already tags this `REQUIRES_SOURCE_READ` / `REQUIRES_EARLY_ACCESS`
  — unchanged by this pass).
- Did not attempt to run any test suite (`tests/vela-*.test.ts`,
  `tests/factor-vela-confidential-workload.test.ts`, `tests/unified-consequence-projection.test.ts`,
  `tests/vela-slice2f-capability-invocation.test.ts`,
  `tests/vela-slice2g-execution-observation-validation.test.ts`,
  `tests/vela-config-early-access.test.ts`, `tests/qubetalk-confidentiality.test.ts`) — this was a
  static/code-reading inventory only, per the task's read-only scope; test *existence* was confirmed
  by listing, not test *passing* by execution.
- Did not inspect `services/registry/phase2/{pricing,value,intent,exchange}.ts` beyond their exported
  surface (confirmed they exist and are the "canonical risk/value shape" `RiskProjection`/
  `OpportunityProjection` in `types/constitutionalCommerce.ts` cite, per that file's own doc
  comments) — a deeper read was not needed to answer the Phase 0 checklist's "Risk/Value/Price engine
  seams" item, which this satisfies at the level of confirming the seam's existence and shape.
- Did not review `10_constitutional-risk-envelope.schema.v0.1.json` in depth against
  `types/constitutionalCommerce.ts` field-by-field — the package's own `README.md` already states the
  schema "is a proposal and requires semantic validation beyond JSON Schema" and "is not canonical
  until reconciled with existing repo types," so a field-by-field reconciliation is future work, not
  part of this Phase 0 pass.
