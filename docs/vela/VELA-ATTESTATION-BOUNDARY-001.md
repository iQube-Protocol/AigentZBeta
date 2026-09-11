# VELA-ATTESTATION-BOUNDARY-001

**Status:** findings, source-verified. No code changes implied by this document.
**Scope:** exactly what cryptographic root of trust backs "this really ran inside a genuine, unmodified, untampered TEE" — and, separately and far more importantly, **what root of trust backed the local environment we actually ran Slice 2A against**. These are not the same claim, and conflating them is the single easiest way for this whole workstream to overstate what has been proven.
**Headline finding, stated up front:** **Slice 2A's successful end-to-end run (deploy → register → deposit → confidential balance read → two-party private transfer) proved the protocol/wire-format/API lifecycle. It proved zero attestation guarantee.** The local stack runs `NoAttestationTeeAuthenticator`, with `TEE_NO_ATTESTATION=true` set explicitly in `.env.dev`, and the `dockerfiles/README.md` states its own limitation outright: *"the TEE is only emulated (no real AWS Nitro Enclave is used, just a separate process)."* Any future summary of this work MUST distinguish "we validated the Vela protocol locally" from "we validated Vela's confidentiality guarantee" — the PRD's own Section 27 out-of-scope rule ("no claiming production Nitro attestation without evidence") is directly about this exact conflation risk, and this document exists to make it structurally impossible to make by accident.

## Two authenticator contracts, one identical downstream verification path

Vela ships **two** implementations of "how is `teeSigner`/`pubSecp521r1` registered," and the code path that actually *uses* those values afterward (`AbstractTeeAuthenticator.checkSignature`, called from `ProcessorEndpoint.stateUpdate`) is **byte-for-byte identical regardless of which one is deployed**. This is the sharpest fact in this document: **you cannot tell, from the state-update verification code, whether the `teeSigner` address it is checking against was ever backed by a real enclave.** That fact lives entirely in *which contract was deployed* and *how its owner behaved* — invisible from `ProcessorEndpoint`'s perspective.

### Production path: `TeeAuthenticator.sol` + `INitroProver`

- `updateTee(bytes attestation)` (owner-only) hands the raw AWS Nitro attestation document to an external `INitroProver` contract, which (per the interface contract, not independently re-verified at the prover's own source in this pass) is expected to validate the full AWS attestation chain (certificate chain up to the AWS root, signature over the document, freshness) and return `(enclaveKey, userData, rawPcrs)`.
- `_checkAttestationContent` then enforces three hard invariants before accepting the result:
  1. `userData.length == 20` — the attested user-data field must be exactly one Ethereum address (this becomes the new `teeSigner`).
  2. `enclaveKey.length == PK_LENGTH` (133 bytes — an uncompressed P-521 public key; this becomes the new `pubSecp521r1`).
  3. `rawPcrs[4 : 4+len(pcr0)] == pcr0` **exactly** — the enclave's measured PCR0 (a hash of the enclave's boot image, effectively "which exact binary is running") must match the value the contract owner previously set via `updatePcr0`. This is the actual cryptographic tie between "this specific enclave image" and "the address/key we're about to trust."
- `updateTeeStep1..4` exists purely to spread the (expensive) attestation-chain verification across four transactions for gas-limit reasons — **not a weaker verification path**, the same checks, split.
- Every attestation is single-use: `_usedAttestations[keccak256(attestation)]` blocks replay of the same attestation document.
- **What this genuinely proves, if `pcr0` is set correctly by a trustworthy owner and `INitroProver` correctly implements AWS's attestation verification:** the registered `teeSigner`/`pubSecp521r1` really did come out of a specific, named enclave image running on real Nitro hardware, and nobody without that exact enclave measurement (i.e., without either compromising AWS's attestation infrastructure or getting Horizen's source code and reproducing an identical binary with a colluding operator) can forge a new registration.
- **What this path does NOT independently verify, and was not checked in this pass:** the `INitroProver`'s own implementation correctness. `verifyAttestation(attestation, maxVerificationAge)` was read only as an interface signature; its actual on-chain verification logic (certificate parsing, root-of-trust pinning to AWS's actual root cert, PCR extraction correctness) is source that exists in the repo but was not read in this pass. Tag: `REQUIRES_SOURCE_READ`.

### Dev/local path: `NoAttestationTeeAuthenticator.sol`

```solidity
constructor(address owner, address _teeSigner, bytes memory _pubSecp521r1) Ownable(owner) { ... }
function updateTee(address newTeeSigner, bytes calldata newPubSecp521r1) external onlyOwner {
  if (newTeeSigner == address(0)) revert TeeAddressCantBeZero();
  if (newPubSecp521r1.length != PK_LENGTH) revert InvalidPKLength();
  teeSigner = newTeeSigner;
  pubSecp521r1 = newPubSecp521r1;
}
```

**There is no attestation input to this contract at all.** `updateTee` takes the new signer address and public key **directly as calldata arguments** from whoever holds the owner key — the only checks are "not the zero address" and "is 133 bytes long." Anyone who controls the owner key can point `teeSigner` at literally any secp256k1 address and `pubSecp521r1` at literally any 133-byte value, with zero proof that either came from a TEE, an enclave, or even a real cryptographic keypair generation process. This is what the local dev stack runs (`.env.dev`: `TEE_NO_ATTESTATION=true`).

## What was actually run and observed in Slice 2A — restated precisely

The full official sample lifecycle we executed (deploy → registeruser → deposit → getprivatebalance → privatetransfer, two wallets, correct 0.7/0.3 ETH split) exercised:
- the real on-chain contract set (`ProcessorEndpoint`, `NoAttestationTeeAuthenticator`, `AuthorityRegistry`), deployed and interacted with via real Anvil transactions with real tx hashes;
- the real Executor↔Manager wire protocol and the real WASM `payment_app.wasm` running under Wasmtime — this genuinely *is* the Vela execution model (WASM guest, JSON bridge, TinyGo constraints, state versioning), just running the Executor as an ordinary process rather than inside actual Nitro hardware (`dockerfiles/README.md`'s own stated limitation);
- the real ECDH/AES-256-GCM crypto path (P-521 key derivation, event encryption/decryption) — this part of the cryptography is identical whether or not the process it runs in is inside real Nitro hardware, so this specific claim ("the encryption scheme is implemented and interoperates correctly between Go and TypeScript, and event data really is unreadable without the right key") **is** validated by the local run, independent of attestation.
- **What was categorically not exercised:** any AWS Nitro attestation document, any `INitroProver` verification, any PCR0 check, any `updateTeeStep1..4` multi-step path, any real enclave hardware boundary. The `teeSigner`/`pubSecp521r1` pair in our local run was whatever `.env.dev`'s `TEE_SIGNER_ADDRESS` / derived P-521 pubkey happened to be, registered by simple admin fiat.

## The precise, non-negotiable rule this produces for any later integration work

**Before any code trusts a Vela deployment's confidentiality guarantee for anything real, it must independently verify — for that specific deployment, on that specific network — which `TeeAuthenticator` contract variant is live, and if it is the real one, what `pcr0` value is currently set and how it was set.** This cannot be inferred from `ProcessorEndpoint` behavior, from the wire protocol, from a successful `stateUpdate`, or from anything else at the application layer — by construction, a `NoAttestationTeeAuthenticator` deployment and a correctly-configured real one are indistinguishable from that vantage point. This is precisely the shape of the PRD's own governing invariant — *"context and capability may improve projection, they may never enlarge authority"* — applied one level down: **an unverified attestation boundary must never be silently treated as a verified one just because the surrounding protocol behaved correctly.**

## Status of every claim in this document, by the PRD's own tagging convention

| Claim | Tag |
|---|---|
| Two-contract attestation architecture (`TeeAuthenticator` vs `NoAttestationTeeAuthenticator`), their exact code, and that `checkSignature`'s downstream path is identical regardless | `PROVEN_FROM_SOURCE` |
| The local stack runs `NoAttestationTeeAuthenticator` / `TEE_NO_ATTESTATION=true` and this is what Slice 2A actually exercised | `PROVEN_IN_LOCAL_RUNTIME` |
| The ECDH/AES-256-GCM cryptographic implementation is correct and interoperable across the Go/TypeScript boundary | `PROVEN_IN_LOCAL_RUNTIME` (encryption correctness does not depend on the attestation boundary) |
| `INitroProver`'s actual AWS attestation chain verification is implemented correctly | `REQUIRES_SOURCE_READ` (interface only was read, not the prover's implementation) |
| A real AWS Nitro Enclave, real attestation document, and real `updateTeeStep1..4` flow behave as documented | `REQUIRES_EARLY_ACCESS` — this needs either a real Nitro-capable deployment target or a testnet/staging Vela environment Horizen operates with real attestation turned on; it cannot be produced from this sandbox |
| Whether Horizen's production/testnet deployments (as opposed to the local starter kit) run the real `TeeAuthenticator` with a meaningfully governed `pcr0` update process | `REQUIRES_EARLY_ACCESS` |
