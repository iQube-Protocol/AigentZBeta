# Vela Office Hours — Remaining Clarifications

**Date:** 11 September 2026  
**Status:** Only unresolved / follow-up questions after the Vela team's initial written answers.

The earlier question set is largely resolved. Do not repeat answered questions unless needed to validate implementation.

## Priority A — our proposed application boundary

We propose:

**metaMe constitutional plane → MoneyPenny Financial Services Runtime → MoneyPenny Confidential Execution Kernel (Vela app)**

The Vela app is intentionally narrow. It receives a frozen semi-anonymous consequence/risk envelope, applies deterministic private logic over confidential state/parameters, and emits a minimum-disclosure signed state transition/event/withdrawal. Factor/Aegis, external-data acquisition, agent discovery, policy selection and orchestration remain outside the enclave.

Questions:
1. Does this partition match the Vela team's recommended pattern for rich applications?
2. Are there any Vela lifecycle assumptions that would make this boundary problematic?
3. For a multi-agent app, what state-namespace pattern do you recommend for independent organizations using the same app?
4. Can one request safely include contributions from several users/agents if the WASM enforces the logical authorization and disclosure rules?

## Priority B — exact app identity and signed update binding

5. On deploy, what canonical fields should we record to bind `applicationId` to the exact WASM? Is the deploy-time SHA-256 sufficient/canonical?
6. Please confirm the exact signed update payload schema used by the current release: application ID, request ID, previous/new state roots, event/withdrawal hashes, protocol version, etc.
7. Which of those fields are directly retrievable on-chain versus only through the subgraph/client?
8. Is there a canonical transaction/reference for the one-time TEE attestation registration that applications should retain in their own evidence receipts?

## Priority C — upgrade / retirement

9. Until in-place upgrades exist, what is the recommended operational retirement procedure for an old app ID?
10. Is there any supported export/import path for private application state, even if migration is manual?
11. How should an app prove that an old application ID is no longer authorized for new consequential actions?
12. In the proposed TEE-upgrade design, will historical PCR0 values / activation windows remain queryable on-chain?

## Priority D — keys and agents

13. When an Ethereum signer rotates, what is the recommended migration path for the derived P-521 identity and historical encrypted UserEvents?
14. Can the same logical user associate a replacement P-521 key without losing access to prior state/events?
15. Is there a supported pattern for one encrypted result to be recoverable by several constitutionally authorized recipients, or must the WASM emit separate encrypted UserEvents per recipient?

## Priority E — disclosure / reporting

16. What contract/object represents the current authorized report requester?
17. Can report-request authority be application-specific?
18. Can our WASM require additional application-level authorization/mandate data beyond Vela's on-chain requester authorization?
19. What request/report metadata is public even though the report body itself is off-chain/private?

## Priority F — managed shared testnet

20. For the Production Testnet Deployment Intake, what artifact bundle do you want from us: WASM binary, SHA-256, constructor params, trigger contract, TokenAllowlist requirements, expected app name/version, test wallets?
21. What deployment details will you return: app ID, ProcessorEndpoint, TeeAuthenticator, protocol version, subgraph endpoint, attestation-registration tx, PCR0/version?
22. Are Base Sepolia and Horizen testnet instances separate trust domains / separate TEE signer registrations?
23. Can we request deployment now for the MoneyPenny kernel while continuing application development?

## Priority G — operating limits / metering

24. While hard guardrails remain TBD, what practical WASM/state sizes and execution durations are you currently comfortable approving?
25. How should we measure and expose `fuel` for a risk-scoring/settlement kernel?
26. Is there any deterministic source of time available to guest logic, or should all freshness/time semantics be frozen outside the enclave and supplied in the request?

## Priority H — current recovery trust

27. Can the application observe or attest which KMS/recovery policy protected the active TEE key, or is that strictly infrastructure-side?
28. Will the future multi-TEE key-sharing design preserve the same TEE signing identity or rotate it?
29. If recovery rotates the TEE signing key, what on-chain re-registration/re-attestation process will bind the replacement key?

## Decision sought from the team

We want enough information to submit the first managed deployment without creating speculative abstractions. The immediate target is:

> **one multi-agent MoneyPenny Vela application, asset-agnostic, deterministic, no network dependency, producing a private consequence/risk verdict and optionally a bounded settlement instruction.**
