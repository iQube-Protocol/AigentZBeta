# VELA-PRIVACY-BOUNDARY-001

**Status:** findings, source-verified. No code changes implied by this document.
**Scope:** exactly what is confidential, what is pseudonymous/metadata-visible, and what is fully public in a Vela v0.2.0 deployment — at the granularity of individual fields, not "the app is private."
**Companion:** `VELA-SIGNER-TOPOLOGY-001` (who holds the keys referenced below), `VELA-ATTESTATION-BOUNDARY-001` (how much the confidentiality claims below can actually be trusted, given what root of trust is in place).

## THE STANDING CLAIM BOUNDARY (operator-ratified, 2026-08-22)

**Vela protects confidential application state and computation. It does not make every surrounding transaction primitive private.**

This is the sentence to use with Horizen, with regulators, and with Financial Services pilot participants — and the one to hold the line on internally. It is deliberately narrower than "Vela makes the transaction private", and the narrowness is a strength, not a concession: because the boundary is precise, we can say exactly what is private, exactly what is observable, and exactly what becomes evidence. A vaguer claim would be both weaker and less defensible.

Two corollaries that follow directly and are now enforced in code:

1. **Confidential computation ≠ transaction anonymity.** Deposit and withdrawal amounts, sender, `applicationId`/`requestId`, and the `TRUSTPROCESS`/trigger wire path are all observable regardless of app design (see the metadata table below). What is protected is the application's *state* and the *computation over it*.
2. **The verdict is the leak surface, so the verdict must be coarse.** A confidential projection publishes its conclusion through an observable event. The projector therefore returns exactly `ACCEPTABLE | UNACCEPTABLE | UNRESOLVED` plus commitments — never an operand, never the specific condition that failed, never a rationale. `services/vela/wasm/projector/app/app.go` enforces this, and `app_test.go` fails the build if the verdict event ever carries more than one field.

## The one sentence that scopes everything else

`docs/1_summary.md` §5, verbatim: **"All key material and cryptographic operations live inside the Nitro Enclave. The Manager only handles encrypted blobs and signed payloads."** This is not marketing language — it is the literal trust model the source code implements: the Manager process, which is where an operator (Horizen, or whoever runs the stack) has the most operational access, is modeled as **untrusted for confidentiality** and **trusted only for liveness/availability**. Every claim below either follows from or qualifies that sentence.

## Confidential (encrypted end-to-end, plaintext exists only inside the enclave)

| Data | At rest | In transit | Decryptable by |
|---|---|---|---|
| Application state (the app's own ledger — e.g. per-account balances in `vela-nova`) | AES-256-GCM, `EXECUTOR_FIXED_STATE_KEY` (dev) / recovered keyset (prod) | n/a (never leaves Executor↔Manager boundary in plaintext) | Only the Executor process, inside the enclave |
| `process_request`/`deposit` **payload** (the user's instruction body, e.g. `{"type":"transfer",...}`) | n/a | ECDH(user P-521 ↔ enclave CommunicationKey) → AES-256-GCM | Only the Executor, and only after ECDH with that specific user's registered key |
| `PlainEvent.Data` (per-user results — e.g. "your transfer sent", "your new balance") | On-chain as ciphertext (`UserEvent` event) | Encrypted by Executor to the **recipient's own** registered P-521 key | Only that specific recipient, off-chain, using their own private key |
| Deanonymization `Report` bytes | Encrypted specifically to the **requesting authority's** registered P-521 key (not the enclave's own key, not any user's) | — | Only that specific authority — scoped per-application by `AuthorityRegistry` |
| Privacy-preserving `EventSubType` seed (65-byte secp256k1 signature over `keccak256("subtype-key-v1")`) | Sent ECDH-encrypted inside the 226-byte `ASSOCIATEKEY` payload | Same ECDH+AES-GCM as any other payload | Only the Executor (which HMACs it into subtypes) |

## Explicit exception: the `TRUSTPROCESS` / trigger wire path is plaintext by design

`docs/1_summary.md` §3.3 and `4_trigger-contract-app.md`: a `TRUSTPROCESS` request's payload is **not** ECDH-decrypted — "the payload is clear text (not ECDH-decrypted)." This is not an oversight; the doc states the reason explicitly: *"authenticity is established on-chain, not by an end-user signature."* The corollary is a genuine confidentiality boundary, not just an authenticity one: **any value that flows through an `AppEvent` → trigger contract → `TRUSTPROCESS` round-trip is visible on-chain in plaintext**, including whatever call target/value/calldata the trigger contract's `_execute` decodes (see the Mixer example's ABI-encoded `(bytes16 lockId, address target, uint256 value, bytes data)`). **Rule for any future app design: nothing that needs confidentiality may be routed through the `AppEvent`/trigger channel — only through `PlainEvent`s or application state.**

## Metadata that is visible regardless of any encryption above — read the field list, not the marketing claim

This is the section most likely to be silently assumed away, and it directly matters for any MoneyPenny consequence-projection use case (dollar amounts are usually exactly what a projection is about):

- **`PendingRequest.assetAmount`** (the deposit size accompanying a request) is a **plain, unencrypted field** on-chain (`ProcessorEndpoint.sol` struct, `docs/1_summary.md` §2.1). Vela hides *what happens to funds once they are inside the app's ledger* (inter-account transfers, balances) — it does **not** hide the size of a deposit entering the TEE's custody.
- **`Withdrawal.Amount` and `Withdrawal.DestinationAddress`** (returned by the WASM app in `ProcessResult.Withdrawals`) are likewise plain fields the smart contract acts on directly — a withdrawal's size and destination are visible on-chain the moment it is requested, before/regardless of any pull-payment claim.
- **`sender`** (`msg.sender`, or the EIP-712-authorized `sender` field in a facilitator meta-transaction) is always a plain on-chain address. The facilitator path hides *who pays gas*, not *who is acting*.
- **`applicationId`, `requestId`, `requestType`, `tokenAddress`, `maxFeeValue`** — all plain fields.
- **`AppEvent.Data`** is plaintext by definition (§ above) whenever an app chooses to emit one.
- **`PlainEvent.EventSubType`** (the indexed `bytes32` on-chain topic) has three possible states an app must reason about explicitly:
  1. **Zero** (the private-transfer app's default choice) — no metadata leak via the topic; the event is filterable only by `applicationId`/`requestId`, not by "what kind of event was this."
  2. **App-chosen ASCII label** (e.g. `[32]byte{'d','e','p','o','s','i','t',...}`) when the recipient has **not** registered a privacy seed — this leaks *the category* of event (deposit vs. transfer vs. withdrawal) as an indexed, filterable on-chain topic, though not the amount or counterparty. Any external observer can filter "show me all `deposit` events for this app" even though the `Data` payload stays encrypted.
  3. **HMAC-derived opaque value** (`HMAC-SHA256(key=seed, data=byte(index))`, `vela-common-go/subtypes` / `vela-common-ts/src/crypto/seed.ts`) when the recipient **has** registered a seed via the 226-byte `ASSOCIATEKEY` payload — this is deliberately unlinkable across users and across an individual user's own event history (a fresh subtype per logical event slot, up to `DefaultSubtypeN = 50`), closing the leak in (2). **This is opt-in, per-user, and must be explicitly wired by the application** — it does not happen automatically just because the app is "on Vela."
- **Invoice-receipt hashes** — the private-transfer app's optional `InvoiceID` feature emits a plaintext `AppEvent` whose `EventSubType` is `keccak256(len-prefix ‖ InvoiceID ‖ sender ‖ tokenAddress ‖ amount ‖ recipient)`. This is a *deliberately* public, third-party-verifiable receipt — anyone who already knows the transfer parameters can recompute the hash and find the event on-chain. It is a designed feature (proof-of-execution without balance disclosure), not a leak, but it means transfer *parameters* (not balances) become publicly provable if an app chooses to expose them this way.

## What "confidential" does **not** mean here — no ZK proofs anywhere in this stack

Both starter-kit docs are explicit about this, and it matters for how MoneyPenny should describe the guarantee to anyone (internal or external): the trigger-app guide states outright, *"there is no ZK proof, the trust anchor is the enclave attestation plus the on-chain trigger's attested result."* The confidentiality guarantee throughout this entire platform is **hardware/attestation-based** (a Nitro Enclave's memory is opaque to its host, and the enclave's outputs are ECDSA-signed so the chain can trust them without seeing inside) — it is not a mathematical zero-knowledge guarantee that holds regardless of hardware compromise. See `VELA-ATTESTATION-BOUNDARY-001` for exactly how strong (or, in the local dev environment, how absent) that hardware root of trust currently is.

## Implication for a "MoneyPenny Confidential Consequence Projector" (PRD Slice 2D)

Given the metadata table above, a synthetic WASM workload computing something like `currentBalance / currentExposure / proposedSpend / privateSpendLimit / privateRiskLimit → ACCEPTABLE/UNACCEPTABLE/UNRESOLVED` gets genuine confidentiality for:
- the actual numeric values of balance, exposure, spend limits, and risk limits (all inside encrypted state + encrypted `PlainEvent` results), and
- the specific comparison logic and intermediate arithmetic (invisible — WASM execution happens entirely inside the enclave).

It does **not** get confidentiality for:
- the fact that a projection request happened at all, its `applicationId`/`requestId`, and (if the request carries a deposit) any accompanying `assetAmount` — all plain on-chain fields regardless of app design;
- the ACCEPTABLE/UNACCEPTABLE/UNRESOLVED verdict itself, **if** it is returned via a plain `AppEvent` rather than a `PlainEvent` encrypted to the requester. This is a concrete, avoidable design choice for Slice 2D: the verdict should be emitted as a `PlainEvent` targeted at the requesting agent's registered P-521 key, not an `AppEvent`, or the "confidential" projection's own conclusion becomes the one thing that leaks in plaintext.

## Open items / not yet source-verified

- The exact Manager-side storage format for versioned LevelDB entries (whether *any* plaintext metadata beyond the state root is ever written to disk outside the enclave) was described at the doc level (`docs/1_summary.md` §2.2) but not confirmed against `pkg/storage/versioned_leveldb` source. Tag: `REQUIRES_SOURCE_READ`.
- Whether the Manager's admin interface (`MANAGER_ADMIN_PORT`) exposes any decrypted state for operational debugging was not checked against `cmd/admincli` source. Tag: `REQUIRES_SOURCE_READ`.
