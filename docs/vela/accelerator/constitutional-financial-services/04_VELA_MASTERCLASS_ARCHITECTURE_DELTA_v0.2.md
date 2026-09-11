# Vela Architecture Delta for MoneyPenny

**Version:** 0.2  
**Date:** 10 September 2026  
**Supersedes:** v0.1  
**Basis:** 8 Sep Vela masterclass + 10 Sep direct Vela-team answers + current public repository behavior where available

## Governing distinction

> **Verified execution, not verified logic.**

Vela establishes a trusted confidential execution environment and authenticates state-transition payloads from that environment. It does not establish that our application logic, policy, mandate, disclosure rule, risk model or legal interpretation is correct.

Constitutional Computing remains responsible for semantic authority and consequence.

## Corrected trust/evidence model

Earlier drafts were too close to a per-request attestation model.

The current Vela model is:

**approved Vela PCR0 / environment version → one-time Nitro attestation verification → registered TEE signing key → signed update payloads → on-chain acceptance**

Accordingly, we require two independent evidence layers:

### A. Environment trust evidence
- Vela instance/network;
- `TeeAuthenticator` address;
- `ProcessorEndpoint` address;
- approved PCR0/environment version where observable;
- registered TEE signing identity;
- attestation-registration transaction/reference;
- trust status: `EMULATED | ATTESTED | UNRESOLVED | REVOKED`.

### B. Application execution evidence
- application ID;
- WASM SHA-256 / deploy identity where exposed;
- request ID;
- request type;
- previous state root;
- new state root;
- signed update reference;
- chain transaction;
- outcome/events/withdrawals;
- MoneyPenny consequence-envelope hash;
- MoneyPenny authority/mandate/receipt references.

A request must not be labelled `HARDWARE_ATTESTED` merely because it completed successfully. Its execution inherits a currently trusted Vela environment identity, while the specific state transition is evidenced by the registered TEE signature.

## Deployment boundary

**metaMe** — constitutional/control plane  
**MoneyPenny** — Financial Services Runtime and orchestration plane  
**Factor** — party/service/capital discovery and economic coordination  
**Aegis** — independent admission/assessment membrane  
**iQubes + QubeTalk** — selective disclosure and sovereign information-sharing plane  
**MoneyPenny Confidential Execution Kernel** — first Vela application  
**Vela** — verified confidential deterministic execution substrate

Do not put metaMe or full MoneyPenny orchestration inside Vela.

## Three-tier disclosure architecture

### Tier 1 — Collaborative disclosure
Parties intentionally disclose information through QubeTalk/iQubes under purpose, provenance, consent and scope.

### Tier 2 — Bounded confidential collaboration
Each participant contributes protected information without necessarily revealing it to counterparties. MoneyPenny composes only fields authorized for the specific transaction.

### Tier 3 — Minimum-necessary confidential execution
MoneyPenny transforms the permitted material into a frozen, semi-anonymous execution envelope. The Vela kernel receives only what is required for deterministic consequence/risk computation and settlement instructions.

Use **semi-anonymous** in the metaMe lexicon: strong transaction-scoped pseudonymization, not a claim of unlinkable anonymity.

## Frozen Consequence / Risk Envelope

Before submission, MoneyPenny freezes:
- exact requested action;
- authority and mandate references;
- semi-anonymous participant handles;
- external facts and freshness/provenance;
- private financial operands;
- risk/policy parameter set;
- prior private-state reference;
- application ID / expected deploy identity;
- output/disclosure class;
- asset context without hardwiring a single asset;
- hash/commitment of the whole envelope.

No guest network calls. No mutable market lookup. No model inference inside the guest. Same accepted state + same envelope must produce the same application result.

## Application-version boundary

Because a new WASM currently means a new application ID and fresh state:
- `applicationId` must be treated as a release/version boundary;
- every consequential receipt must identify the application ID;
- deployment records should bind app ID ↔ WASM hash ↔ kernel semantic version ↔ approved invariant/policy version;
- old application retirement must be explicit;
- funds/state migration must not be assumed.

## Agent authentication

Use the existing Ethereum agent signer as the custody root. Derive the Vela P-521 key through the supported deterministic signer-derived path (`deriveP521PrivateKeyFromSigner`) rather than introducing a parallel P-521 custody system.

Keep explicit separation between:
- Ethereum key = chain/control signer;
- derived P-521 key = confidential communication identity;
- Passport/delegation = constitutional authority;
- mandate = exact consequential permission.

A derived encryption key does not grant authority.

## Multi-agent / multi-party use

One Vela app can serve many Ethereum addresses. Therefore Use Case Zero may use one MoneyPenny kernel across multiple cohort/external agents.

The kernel must itself enforce:
- per-party logical namespaces;
- authorization to read/use contributed private state;
- disclosure rights;
- output recipients;
- transaction-scoped semi-anonymous handles.

Do not infer that Vela's per-application isolation automatically supplies intra-application party isolation.

## Recovery and canonical state

Use Vela request IDs and state-root transitions as primary execution evidence.

Do not create a second competing state machine where Vela already supplies:
- unique queued request IDs;
- on-chain state root;
- versioned off-chain private state;
- rollback on chain reorg/root mismatch.

MoneyPenny adds constitutional and causal meaning around these facts.

## Risk model additions

Two new infrastructure risk classes must be represented:

1. **Environment trust / upgrade risk** — PCR0 trust and TEE upgrade governance are not fully decentralized/finalized.
2. **Recovery-key administration risk** — current AWS KMS master-key administration remains a possible privileged backdoor.

These are not reasons to reject Vela; they are explicit risk inputs that Constitutional Risk should price/track rather than hide.

## Asset and event neutrality

The kernel should be asset-agnostic. Vela now supports ETH and ERC-20 paths including facilitator mechanisms.

Prefer encrypted recipient `UserEvent`s for sensitive outputs. Treat plaintext/application-wide event paths as public and subject to minimum-disclosure review.

## Runtime constraints retained from masterclass

- no GPU;
- no guest network access;
- deterministic execution;
- state-in/state-out TinyGo guest model;
- asynchronous lifecycle;
- no production reliance on a read-only private-state API;
- practical execution/state ceilings currently unconfirmed.

## Architectural invariant

> **Vela proves that an accepted state transition came from the registered confidential execution environment. Constitutional Computing proves why that transition was allowed to matter.**
