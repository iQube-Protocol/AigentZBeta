# Vela Accelerator — Team-Confirmed Technical Baseline

**Version:** 0.1  
**Date:** 10 September 2026  
**Status:** Team-confirmed implementation baseline  
**Authority:** Direct written responses from the Horizen/Vela team supplied by metaMe, plus the public Vela repositories where noted.

## 1. Source-of-truth rule

For accelerator implementation, the **Vela repositories are the current source of truth** where public documentation lags.

Current team-confirmed capabilities:
- multi-WASM / multi-application structures are implemented;
- per-application state and locked funds are isolated;
- ETH and ERC-20 deposit/withdrawal support is implemented;
- gasless facilitator support is implemented;
- Base Sepolia deployment is available through the Vela Engineering team;
- Horizen testnet deployment is expected/available through the same managed process as enabled by the team.

Production/testnet deployment is permissioned and managed by Vela Engineering. The accelerator environment is shared across applications. Application teams do **not** receive direct terminal access to the environment.

Production Testnet Deployment Intake:
https://tally.so/r/xXWL1v

## 2. Attestation semantics

This is the most important correction to earlier assumptions.

AWS Nitro attestation is **not a per-request proof that each application result should independently verify**.

The current Vela model is:

1. Nitro produces a standard AWS Nitro attestation document.
2. The document certifies the TEE signing public key and includes enclave measurements.
3. Vela Engineering performs the environment setup transaction.
4. Vela's on-chain `TeeAuthenticator` verifies the Nitro attestation using the NitroProver path and checks PCR0 against the approved Vela environment/version measurement.
5. Once accepted, the TEE signing key is registered on-chain / into the processor trust path.
6. Each subsequent update payload is accepted by verifying that it was signed by that registered TEE key.

Therefore the evidence model must distinguish:

**Environment attestation / TEE identity**  
from  
**Application execution / request / state-transition evidence**

Do not model a Vela request as if it contains a fresh Nitro attestation.

Relevant source pointers:
- Vela `TeeAuthenticator.sol`: https://github.com/HorizenOfficial/vela/blob/main/contracts/contracts/TeeAuthenticator.sol
- Marlin NitroProver: https://github.com/marlinprotocol/NitroProver

The NitroProver project describes Solidity contracts that verify AWS Nitro attestation documents and their AWS certificate chain, including enclave measurements and enclave key material.

## 3. Application identity and upgrades

Current team-confirmed limitation:

- there is **no supported in-place WASM upgrade procedure yet**;
- a new WASM version requires deployment again;
- that deployment produces a **new application ID**;
- the new application begins with **fresh state**;
- locked funds in the old application must be manually unlocked;
- state is not migrated automatically.

Implication: `applicationId` is a consequential version boundary and must be bound into metaMe/MoneyPenny evidence and release records.

Do not implement state migration based on assumptions.

## 4. Shared multi-application environment

Current release supports multiple applications in one Vela instance, with:
- per-app isolated state;
- per-app isolated locked funds.

A single application may be invoked by many Ethereum addresses. This supports a shared MoneyPenny confidential kernel used by multiple independent agents, provided the application itself correctly namespaces and authorizes its own private state.

## 5. Agent key model

Vela's TypeScript library includes `deriveP521PrivateKeyFromSigner`.

Current public library behavior exposes a model where:
- the agent already controls an Ethereum/secp256k1 signer;
- a deterministic P-521 key pair is derived from that signer;
- the P-521 key is then used for confidential communication with the TEE.

Reference:
https://github.com/HorizenOfficial/vela-common-ts/blob/main/src/crypto/wallet.ts#L7

This means we should **reuse existing agent Ethereum custody** and avoid introducing an independent long-lived P-521 custody system unless a later requirement proves necessary.

The public library also exposes:
- `getSignerKeyPair`;
- `encryptForTee`;
- `ASSOCIATEKEY`;
- encrypted `UserEvent`s;
- plaintext `AppEvent`s;
- privacy-preserving event subtype derivation.

## 6. Disclosure / report model

Vela provides:
- a report/deanonymization request mechanism;
- on-chain verification of who is authorized to send that request.

The WASM application defines:
- what data was retained in private state;
- what a report contains;
- what disclosure semantics are implemented.

Reports are not published on-chain.

Vela attests execution, not correctness. Therefore the existence of a Vela report does not prove that the application's report logic faithfully represents the intended real-world state.

Constitutional Computing must supply the policy, mandate, disclosure scope and receipt semantics around report generation.

## 7. Reorg, replay and canonical state

Team-confirmed:
- an overall state root is recorded on-chain;
- off-chain private state is versioned;
- the manager checks the off-chain state root against the on-chain state root;
- on a reorg mismatch, private state can roll back to the compatible version and execution resumes;
- requests receive unique IDs when entering the queue, supporting idempotency and duplicate prevention.

Implication: MoneyPenny receipts should preserve request ID and relevant state-root transition evidence where available rather than invent their own duplicate-execution semantics.

## 8. Private-state persistence / recovery trust

Current early-stage model:
- TEE keys are encrypted under a master key;
- the master key is handled by AWS KMS;
- KMS rules are configured so the TEE can access it.

Known trust caveat:
- AWS KMS administration remains a possible security backdoor in this early architecture.

Planned direction:
- multiple backup TEEs exchange/share encryption keys during startup;
- remove dependency on externally stored KMS master key;
- preserve recovery unless all TEE instances are simultaneously unavailable.

This trust caveat must be surfaced honestly in the risk model.

## 9. Runtime limits

The Vela team has not yet finalized production guardrails for:
- WASM execution time;
- state size;
- practical resource ceilings.

This is one reason application deployment remains permissioned.

Do not build production assumptions around unconfirmed latency, throughput, memory or state-size guarantees.

## 10. Asset model

Current repository/team-confirmed path includes:
- ETH deposits/withdrawals;
- ERC-20 deposits/withdrawals through an allowlist;
- standalone `TokenAllowlist` injected into `ProcessorEndpoint`;
- facilitator path;
- EIP-712 authorization;
- EIP-2612 permit + `transferFrom` for gasless-style ERC-20 onboarding.

The MoneyPenny confidential kernel should remain **asset-agnostic**.

## 11. Event / metadata model

WASM logic can emit withdrawals or events.

User-directed events may contain arbitrary application payloads encrypted to the receiver's P-521 key. Application-wide events may be public/plaintext depending on the event path.

Treat metadata privacy separately from content confidentiality.

## 12. TEE upgrade governance

The TEE upgrade mechanism is still under design.

Proposal:
https://github.com/HorizenOfficial/vela/blob/pc/tee_upgrade/docs/design/EXECUTOR_TEE_UPGRADE_DESIGN.md

The Vela team states that the proposal includes a delay/timelock-like mechanism between upgrades, but implementation has not yet started.

Therefore:
- do not code against the proposal as if deployed;
- preserve an explicit `UNRESOLVED` governance state;
- treat PCR/environment changes as consequential infrastructure events.
