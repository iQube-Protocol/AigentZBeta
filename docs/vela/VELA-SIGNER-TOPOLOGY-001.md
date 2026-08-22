# VELA-SIGNER-TOPOLOGY-001

**Status:** findings, source-verified. No code changes implied by this document.
**Scope:** which private keys exist in a Vela (Horizen CCE) v0.2.0 deployment, who holds each one, what each one is authorized to do, and — critically — which of them would need to exist inside MoneyPenny/AigentZBeta if we integrate.
**Method:** read against pinned source, not docs alone, per `vela-starterkit/CLAUDE.md`'s own instruction to "verify against the actual source code in these sibling repos at the matching version tag."

## Sources (exact SHAs, tag v0.2.0)

| Repo | SHA | Files read |
|---|---|---|
| `HorizenOfficial/vela` | `335724c95ba7b58d64ec97bbb67d18640123278e` | `pkg/crypto/{key_p521,key_secp256k1,cipher}.go`, `contracts/contracts/{TeeAuthenticator.sol,AbstractTeeAuthenticator.sol,mocks/NoAttestationTeeAuthenticator.sol}`, `CLAUDE.md` |
| `HorizenOfficial/vela-common-ts` | `c9d28e4107d08ed4a570449a577ac07089891344` | `src/crypto/{p521,wallet,seed}.ts`, `CLAUDE.md` |
| `HorizenOfficial/vela-common-go` | `fb4e716f197a4d761350f5d93a97708b5d972bee` | `CLAUDE.md` (types-only library; no keys here) |
| `vela-starterkit` (docs) | local clone `e9627dcde78a3bc83d0094f8e1849da0f2e3ca1c` | `docs/1_summary.md`, `docs/2_private-transfer-app.md`, `docs/4_trigger-contract-app.md`, `dockerfiles/.env.dev` |
| Local runtime | live | `.env.dev` values, wallet.conf files, on-chain observations from the Slice 2A run |

All three code repos carry an exact `v0.2.0` git tag matching the starter-kit's pin — no version drift between what the docs describe and what was inspected.

## The six distinct key roles

Vela has **no single "the" signing key**. There are six structurally separate roles, each with a different curve, a different holder, and a different authority scope. Conflating any two of them is the most common way to misdescribe this system.

### 1. TEE SigningKey (secp256k1) — enclave-internal, never leaves the enclave

- Generated inside the Executor process on first start; one of three keys in the "Enclave KeySet" (`docs/1_summary.md` §2.3).
- **Purpose:** signs the `UpdatePayload` after every WASM execution — the message that authorizes a state transition. Signed with `crypto/ecdsa` over secp256k1 (`vela/pkg/crypto/key_secp256k1.go` — this file is generic secp256k1 key material handling, reused for this role).
- **Verified by:** `AbstractTeeAuthenticator.checkSignature` (Solidity) — recovers the signer via `ECDSA.recover(MessageHashUtils.toEthSignedMessageHash(messageHash), signature)` and checks it equals the registered `teeSigner` address. The message hash is `keccak256(abi.encode(applicationId, prevStateRoot, newStateRoot, processedRequestId, hash(userEvents), hash(userEventSubTypes), hash(appEvents), hash(appEventSubTypes), hash(withdrawalRequests), refundAmount, applicationFee, errorCode, errorMsg))`.
- **Recovery mode:** dev (`EXECUTOR_KEYSET_RECOVERY_TYPE=0`) loads it from `EXECUTOR_FIXED_SIGNING_KEY` env var (plaintext, local only). Production recovers it from an encrypted blob the Manager stores, via a handshake — the plaintext key is never at rest outside the enclave in that mode.
- **This is the closest thing to "the TEE's identity."** It is registered on-chain (`teeSigner`) by a completely separate actor (see role 4).

### 2. TEE CommunicationKey (P-521, ECDH) — enclave-internal, never leaves the enclave

- Also part of the Enclave KeySet. Used for `Encrypt`/`Decrypt` (`vela/pkg/crypto/cipher.go`): `ECDH(senderPriv, receiverPub) → HKDF-SHA256(no salt, no info) → AES-256-GCM(random 12-byte nonce, prepended)`.
- **Purpose:** the enclave-side half of every ECDH exchange with every user, deanonymization authority, and the seed-encryption path. There is exactly one CommunicationKey per Executor process — every registered user shares ECDH with the *same* enclave public key, deriving a distinct shared secret per user.
- **Registered on-chain as** `pubSecp521r1` (133-byte uncompressed P-521 public key, `PK_LENGTH` constant in `AbstractTeeAuthenticator.sol`), alongside `teeSigner`, by the same `updateTee` call.
- In dev mode: `EXECUTOR_FIXED_COMMUNICATION_KEY`, plaintext env var.

### 3. Manager blockchain tx-signer (secp256k1) — off-enclave, pays gas, carries **zero** authority over state content

- `MANAGER_KEY_SECP256` — a distinct secp256k1 key held by the Manager process (outside the TEE entirely).
- **Purpose:** submits the `stateUpdate` transaction to the chain. This is the account that pays gas for posting results. It is granted `UPDATE_STATUS_ROLE` on `ProcessorEndpoint` — an RBAC role, **not** cryptographic authority over the payload's truth.
- **Critical distinction:** the Manager's tx-signature only proves "this transaction was submitted by an RBAC-authorized relayer." The *content* of the state update is authorized separately and independently by the TEE SigningKey's ECDSA signature, verified via `checkSignature`. A Manager with `UPDATE_STATUS_ROLE` but no valid TEE signature inside the payload cannot move state — `stateUpdate` calls `checkSignature` before accepting anything. Conversely, if the Manager process were fully compromised, an attacker still could not fabricate a state update without also forging the TEE's secp256k1 signature (impossible without the enclave-internal key or a broken attestation chain — see `VELA-ATTESTATION-BOUNDARY-001`).
- This is the same key that also acts as the executor of `TokenAllowlist`/facilitator plumbing at the infrastructure level, but not a source of user-facing or application-facing authority.

### 4. Deployer role (secp256k1, off-enclave, RBAC only)

- `DEPLOYER_PRIVATE_KEY` — holds `DEPLOYER_ROLE`. Its only power is calling `submitDeployRequest` / `submitDeployRequestWithTrigger`. It cannot process requests, sign state, or read/write application state.
- Confirmed live: in the local run, this was Anvil Account #0 (`0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`), matching `.env.dev`'s `DEPLOYER_ADMIN`.

### 5. Contract admin/owner (secp256k1, off-enclave, governance-only)

- `Ownable.owner()` on `TeeAuthenticator` / `NoAttestationTeeAuthenticator`. Its only power is calling `updateTee` (register a new `teeSigner`/`pubSecp521r1` pair) and, on the real contract, `updatePcr0` (change the expected enclave measurement).
- **This is the single highest-leverage key in the whole system when the deployment uses `NoAttestationTeeAuthenticator`**: whoever holds it can set the "TEE identity" to *anything* with zero cryptographic proof of an actual enclave. See `VELA-ATTESTATION-BOUNDARY-001` for the full implication.
- Confirmed live: same Anvil Account #0 acted as both deployer and (via `DEPLOYER_ADMIN`) the authenticator owner in the local stack.

### 6. End-user key material — two keys, one derived from the other, both held by the user, **neither new**

- **6a. secp256k1 wallet key** — the user's ordinary EVM wallet key. Signs the outer Ethereum transaction (`submitRequest`) or, for the facilitator path, an EIP-712 `REQUEST_AUTHORIZATION_TYPEHASH` struct (`submitRequestFor`). This is **not a new key** — it is whatever wallet key the user already uses for any other on-chain interaction.
- **6b. P-521 communication key** — deterministically *derived* from 6a, never independently generated or stored: `deriveP521PrivateKeyFromSigner()` (`vela-common-ts/src/crypto/wallet.ts`) has the user sign a fixed challenge string (`CHALLENGE + address`), feeds the signature bytes as HKDF input key material (`deriveKeyPairFromHKDF`, HKDF-SHA256, rejection-sampled into a valid P-521 scalar), and the resulting key pair is the user's ECDH counterpart to the enclave's CommunicationKey. **This key never needs to be stored anywhere** — it is re-derivable on demand from the same wallet signature every time, and its private half never leaves the browser/client process that just derived it.
- Registered on-chain via `ASSOCIATEKEY` (payload = the 133-byte raw public key, optionally + a 93-byte encrypted privacy seed — see `VELA-PRIVACY-BOUNDARY-001`).
- **A facilitator (optional, separate address)** may pay gas on the user's behalf via `submitRequestFor`, but it authorizes nothing — the user's own EIP-712 signature (6a) is what the contract checks; the facilitator is a fee-relay role only, structurally identical to role 3's relationship to role 1.

### 7. Authority/auditor key (P-521) — deanonymization recipient only

- A registered authority (gated per-application by `AuthorityRegistry`) holds its own independent P-521 key pair. Deanonymization reports are encrypted specifically to *that* key by the Executor — never to the general CommunicationKey, and never to any user's key. This is the platform's one designed override channel, and it is scoped per-application and per-authority by on-chain RBAC (`AuthorityRegistry`/`DefaultAuthority`), not by anything cryptographically implicit in the TEE keyset.

## What this means for a MoneyPenny/AigentZBeta integration

This is the load-bearing conclusion of this document, and it is a direct, source-verified answer to the PRD's Section 27 rule "never move principal private keys or AgentKeyService custody into Vela":

**Structurally, nothing about Vela requires MoneyPenny to create, export, or migrate any new custody surface.** MoneyPenny would participate purely in role 6: it signs `submitRequest`/`submitRequestFor` calls with its **existing** AgentKeyService-held wallet key exactly as it signs any other on-chain call today, and it derives a P-521 comms key **on demand, in-process, non-persistently** from a signature over Vela's fixed challenge string using the *same* existing key — the private P-521 half need not be written to any store AgentKeyService doesn't already control (it can be re-derived every session). No Vela role (1–5) is ever held, requested, or approximated by MoneyPenny; those are entirely Horizen-operated infrastructure roles. The WASM guest itself never sees a private key at all — only a `types.Address` (`sender`) and decrypted payload bytes; TinyGo apps cannot even import `go-ethereum`'s signing primitives, so custody cannot leak into application logic even by accident on Horizen's own reference app.

The one place this changes shape is a **facilitator/meta-transaction path**: if MoneyPenny ever wanted a *different* address to pay gas on its behalf (its own EIP-712-authorized submissions), that introduces a role-3-shaped relayer key — but that key still carries zero authority over MoneyPenny's requests; MoneyPenny's own signature remains the sole authorization, per contract code (`ProcessorEndpoint.submitRequestFor`, verified via EIP-712 recovery against `sender`, not against the facilitator).

## Open items / not yet source-verified

- The exact production keyset-recovery handshake protocol (`EXECUTOR_KEYSET_RECOVERY_TYPE` values other than `0`) was described in `docs/1_summary.md` §6 but not read at the Go source level (`pkg/manager`/`pkg/executor` communication package) — this document does not claim to have verified the recovery handshake's cryptographic soundness beyond what the docs assert. Tag: `REQUIRES_SOURCE_READ`.
- Real AWS Nitro Enclave attestation of role 1/2's *generation* (as opposed to their *use*, which is fully verified above) was not observed — the local run used `TEE_NO_ATTESTATION=true`. Tag: `REQUIRES_EARLY_ACCESS` (tracked fully in `VELA-ATTESTATION-BOUNDARY-001`).
