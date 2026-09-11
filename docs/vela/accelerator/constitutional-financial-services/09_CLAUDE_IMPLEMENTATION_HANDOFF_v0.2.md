# Claude Implementation Handoff
## Vela Accelerator Baseline Reconciliation + MoneyPenny Kernel Hardening

**Version:** 0.2  
**Date:** 10 September 2026  
**Status:** Implementation instruction  
**Priority:** reconcile facts first, then minimal changes. No speculative Vela behavior.

## Read first

Before coding, read and reconcile these package artifacts:
- `11_VELA_TEAM_CONFIRMED_BASELINE_v0.1.md`
- `04_VELA_MASTERCLASS_ARCHITECTURE_DELTA_v0.2.md`
- `03_MONEYPENNY_DISCLOSURE_AND_RISK_ARCHITECTURE_v0.1.md`
- `05_ACCELERATOR_USE_CASE_ZERO_SPEC_v0.1.md`
- `02_CONSTITUTIONAL_RISK_CANDIDATE_INVARIANTS_v0.1.md`
- existing repo Vela architecture/privacy/attestation docs.

Vela repositories are the accelerator source of truth where docs conflict.

External source pointers:
- Vela access intake: https://tally.so/r/xXWL1v
- TeeAuthenticator: https://github.com/HorizenOfficial/vela/blob/main/contracts/contracts/TeeAuthenticator.sol
- NitroProver: https://github.com/marlinprotocol/NitroProver
- P-521 wallet derivation: https://github.com/HorizenOfficial/vela-common-ts/blob/main/src/crypto/wallet.ts#L7
- TEE upgrade proposal: https://github.com/HorizenOfficial/vela/blob/pc/tee_upgrade/docs/design/EXECUTOR_TEE_UPGRADE_DESIGN.md

## Non-negotiable architecture

- **metaMe** = constitutional/control plane.
- **MoneyPenny** = Financial Services Runtime/orchestrator.
- **Factor** = economic discovery / agent, service, counterparty assembly.
- **Aegis** = independent assessment/admission.
- **iQubes + QubeTalk** = disclosure / sovereign information-sharing plane.
- **Vela** = confidential deterministic execution substrate.
- First Vela app = **MoneyPenny Constitutional Consequence & Settlement Kernel**.

Do not move full metaMe or full MoneyPenny into Vela.

## Critical correction: attestation is environment-level

Do not implement or retain a false per-request Nitro-attestation model.

Team-confirmed current Vela flow:
1. AWS Nitro attestation certifies the TEE signing public key and environment measurement.
2. Vela Engineering performs the setup/registration operation.
3. `TeeAuthenticator` verifies that attestation on-chain through the NitroProver path and PCR0 policy.
4. The TEE signing key becomes the trusted execution identity.
5. Subsequent Vela update payloads are accepted by signature verification against that registered key.

Therefore model two evidence layers:

### EnvironmentTrustEvidence
Prefer adapting existing types:
- instance/network;
- teeAuthenticatorAddress;
- processorEndpointAddress;
- approved PCR0 / environment version if available;
- registeredTeeSigner;
- attestationRegistrationTx/ref;
- trust state: `EMULATED | ATTESTED | UNRESOLVED | REVOKED`;
- effective/version metadata.

### VelaExecutionEvidence
- applicationId;
- requestId;
- requestType;
- wasmSha256/deploy identity if known;
- previousStateRoot;
- newStateRoot;
- signed update / tx reference;
- protocolVersion;
- relevant event/withdrawal references;
- consequenceEnvelopeHash;
- result/outcome.

Do not synthesize a fresh Nitro attestation for each execution.

A successful request != fresh hardware attestation.

## Phase 0 — inspect actual code

Locate and report before modifying:
- current Vela provider/client;
- guest WASM;
- local Docker/test fixture;
- attestation types;
- application/deploy types;
- receipt/evidence types;
- `ConsequenceProjection.public/.confidential`;
- Gate 2 and `CONFIDENTIAL_CONSEQUENCE_PROJECTION`;
- `deriveActionAuthorisation`;
- bounded execution / observed consequence / causal receipt;
- agent wallet/custody services;
- MoneyPenny service orchestration;
- Factor/Aegis integration;
- iQube/QubeTalk primitives;
- Risk/Value/Price engine seams.

Search for any code that currently implies:
- attestation is per request;
- one-app-only is a permanent Vela constraint;
- ERC-20 is unsupported;
- P-521 needs separate persistent custody;
- app upgrades preserve app ID/state;
- testnet will provide terminal access.

Flag and correct only where relevant.

## Phase 1 — Vela configuration boundary

Make deployment-provided values external/configurable:
- chain/network ID;
- ProcessorEndpoint;
- TeeAuthenticator;
- subgraph endpoint;
- protocol version;
- application ID;
- WASM SHA-256/deploy identity;
- attestation-registration evidence/ref where provided.

Do not invent Base Sepolia/Horizen addresses before Vela Engineering supplies them.

Support local and managed-testnet profiles cleanly.

## Phase 2 — Frozen Consequence/Risk Envelope

Use or adapt the existing model to freeze all mutable external facts before request submission.

Semantics:
- exact action;
- authority reference;
- mandate reference;
- semi-anonymous party handles;
- external facts + provenance/freshness;
- confidential financial operands;
- risk/policy parameter set;
- prior state ref;
- intended app ID/version;
- asset/token context;
- permitted output/disclosure class;
- deterministic envelope hash.

No guest network calls.
No live RPC/API/oracle lookup.
No LLM/model call in guest.
No silent refresh after submission.

## Phase 3 — application identity and no-upgrade reality

Team-confirmed:
- new WASM currently => new deployment + new `applicationId` + fresh state;
- no automatic private-state migration;
- old locked funds must be manually unlocked.

Implement only the metadata/evidence needed to respect this:
- bind app ID ↔ WASM hash ↔ semantic kernel version ↔ configuration/invariant version;
- reject a consequential request if its expected app identity does not match configured active app identity;
- preserve explicit `ACTIVE | RETIRED | UNRESOLVED` app authorization state if an equivalent existing concept exists.

Do NOT build a guessed migration mechanism.

## Phase 4 — agent P-521 derivation

Inspect the existing wallet implementation and Vela library usage.

The supported Vela path derives P-521 deterministically from the Ethereum signer (`deriveP521PrivateKeyFromSigner`).

Prefer:
**existing agent Ethereum custody -> deterministic Vela P-521 derivation**

Do not create a second long-lived P-521 secret store unless current code genuinely requires it.

Maintain the constitutional distinction:
- Ethereum/P-521 possession proves control/communication capability;
- Passport/delegation establishes authority;
- mandate authorizes the exact act.

Add tests preventing key possession from being treated as authority.

## Phase 5 — multi-agent isolation

Vela supports many Ethereum addresses invoking one app, but Vela per-app isolation does not automatically create intra-app constitutional isolation.

For the MoneyPenny kernel, ensure existing structures can bind:
- contributor/party handle;
- Ethereum/Vela communication identity;
- permitted private-state namespace;
- transaction/execution context;
- disclosure recipients;
- authority/mandate ref.

Do not build a generalized IAM system if existing iQube/persona/delegation primitives already provide this.

## Phase 6 — event/privacy boundary

Audit all:
- encrypted UserEvents;
- plaintext AppEvents;
- withdrawals;
- request metadata;
- subgraph fields;
- logs/errors;
- receipts.

Sensitive outputs should use recipient-encrypted event paths wherever supported.

No plaintext leakage of:
- balances/positions;
- thresholds/private policy;
- counterparty terms;
- private mandate content;
- risk operands;
- underwriting inputs;
- private intermediate consequence state.

Record public metadata separately from confidential content.

## Phase 7 — canonical execution/reorg/idempotency

Do not invent duplicate-processing semantics that conflict with Vela.

Use Vela's:
- unique request ID;
- on-chain state root;
- previous/new state-root transition where available;
- versioned private-state rollback behavior.

MoneyPenny receipt adds constitutional causality around those facts.

Test:
- duplicate local callback/update handling is idempotent;
- stale/incorrect state-root evidence cannot be promoted to completed consequential receipt;
- reorg/retry does not manufacture a second MoneyPenny economic consequence.

## Phase 8 — recovery/KMS risk representation

Do not attempt to replace Vela's current AWS KMS recovery architecture.

Add/document an infrastructure-risk fact where the current risk engine supports it:
- current early-stage recovery uses AWS KMS-protected master key;
- KMS admin is a residual privileged trust/backdoor risk;
- future multi-TEE recovery is planned but not deployed.

This should be **risk evidence**, not a fabricated refusal rule unless an existing policy explicitly requires it.

## Phase 9 — asset neutrality

Current Vela release supports ETH and ERC-20 paths plus facilitator mechanisms.

Ensure the confidential kernel does not encode ETH-only assumptions.

Reuse existing asset abstractions.

Do not implement token issuance or unrelated settlement features as part of this task.

## Phase 10 — runtime constraints

Preserve:
- TinyGo-compatible deterministic guest;
- no network;
- no GPU;
- state-in/state-out;
- asynchronous lifecycle.

Do not set invented production limits for execution time, state size, throughput or latency. These remain team-TBD.

## Phase 11 — Use Case Zero minimal vertical slice

Target one bounded path:

`principal/agent mandate`
→ `Factor identifies/assembles service or counterparty`
→ `Aegis/admission state available`
→ `iQube/QubeTalk disclosure inputs`
→ `Frozen Consequence/Risk Envelope`
→ `MoneyPenny Vela kernel`
→ `private risk/consequence verdict`
→ optional bounded settlement/coverage instruction
→ `signed Vela state transition`
→ `MoneyPenny causal receipt`
→ `Standing / Constitutional Risk telemetry`

The coverage/insurance provider may be simulated or external for the first technical slice, but simulation must be labelled and may not be represented as live regulated underwriting.

BANKR or any token-issuance provider is **not required** for this use case.

## Validation

Run the narrowest relevant test suites first, then broader checks appropriate to touched surfaces.

Required new/updated behavioral tests where applicable:
1. completed Vela request does not imply per-request Nitro attestation;
2. environment trust and execution evidence remain separate;
3. app ID/WASM mismatch fails consequential authorization;
4. local/emulated cannot become hardware-attested;
5. deterministic P-521 derivation does not confer constitutional authority;
6. multi-agent requests remain logically isolated;
7. plaintext event path cannot carry classified confidential fields;
8. duplicate/replayed completion does not duplicate economic consequence;
9. asset-neutral request path supports native/ERC-20 abstraction without hardcoding;
10. unresolved production limits remain configuration/unresolved, not guessed constants.

## Deliverable

Return:
- repo state before changes;
- exact files changed;
- architecture/type changes;
- tests and results;
- any assumption removed;
- any privacy/security defect found;
- any remaining Vela-team dependency;
- readiness assessment for managed Base Sepolia/Horizen testnet deployment.

If clean and tested, commit on the current working branch with a focused message.

Do not claim:
- production mainnet;
- per-request Nitro proofs;
- app upgrade/state migration;
- removal of AWS/KMS trust;
- terminal access to Vela infrastructure;
- insurance capacity that does not exist.
