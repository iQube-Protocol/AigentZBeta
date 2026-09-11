# Canister repair plan — making the constitutional anchor evidentiary

**Status:** PLAN ONLY. Nothing modified, nothing deployed. Requires operator review before any
work begins in `iQube-Protocol/iQubeBeta-Program`.
**Target repo:** `iQube-Protocol/iQubeBeta-Program` @ `db6e5628`
**Scope order (operator ruling, 2026-08-08):** `btc_signer_psbt` FIRST, `proof_of_state` SECOND.
**AigentZBeta posture meanwhile:** interim (a) — shared-H/per-leg structure built and merged,
`POS_LEG_SUBMISSION_ENABLED = false`, `pos_status='anchored'` unreachable and canary-guarded.

---

## 0a. Approved amendments (operator, 2026-08-08)

The plan below is approved subject to these four, which are binding on Phase B implementation.

### A1 — ICP native Bitcoin API is the authoritative transport, not HTTP

The canonical transport is the **IC management canister's Bitcoin API**
(`bitcoin_get_utxos`, `bitcoin_send_transaction`, `bitcoin_get_current_fee_percentiles`,
`bitcoin_get_balance`), **not** HTTPS outcalls to Blockstream / mempool.space.

Why this is not merely a preference: an HTTPS outcall must reach byte-identical responses across
every replica to pass consensus, so a block explorer's response — which carries confirmation
counts, rotating field order, and timestamps — is *structurally* consensus-hostile. It works in a
single-replica test and degrades unpredictably in production. Worse for our purposes, it makes an
external service the arbiter of whether a constitutional anchor exists. The native API is
replicated by the IC itself and is the only transport that makes "the anchor is on Bitcoin" a
statement the subnet can attest to rather than a claim relayed by a third party.

The existing `broadcast_transaction` HTTP path is therefore **removed**, not repaired. Any
explorer lookup that survives is a *convenience for humans reading the Ops console* and must never
be the source of an anchoring state transition.

### A2 — `broadcast` is a distinct state before `anchored`

The PoS leg's lifecycle becomes:

```
pending → batched → broadcast → anchored
                              ↘ failed
```

- **`broadcast`** — a valid transaction was serialised and accepted by the Bitcoin network; a real
  txid exists. **Nothing is confirmed.**
- **`anchored`** — that txid appears in a block, at a height read from the network.

Collapsing these is the same error class as `dvn_recorded` meaning "appeared in a queue": it
reports a *submission* as a *settlement*. A broadcast transaction can be replaced (RBF is enabled
via `sequence: 0xfffffffd`), evicted from mempools, or simply never mined. Until it is in a block,
the honest claim is "we sent it", and the schema must be able to say exactly that.

This requires a matching change to AigentZBeta's `pos_status` CHECK constraint before the
migration is applied.

### A3 — Normative byte encoding and domain separation

Under-specified hashing is how two implementations silently disagree about the same commitment.
The following is normative; a verifier written from this section alone must reproduce our roots.

| Element | Specification |
|---|---|
| `H` | 32 bytes. AigentZBeta computes `sha256(canonicalJson(projection))` and transports it as 64-char lowercase hex. **The canister MUST hex-decode to 32 raw bytes before hashing.** Hashing the ASCII hex string is a different commitment and is forbidden. |
| Leaf | `SHA256(0x00 ‖ H_bytes)` — 33 bytes input |
| Internal node | `SHA256(0x01 ‖ left ‖ right)` — 65 bytes input |
| Domain separation | The `0x00` / `0x01` prefixes are **mandatory**. Without them a 64-byte leaf preimage can be reinterpreted as an internal node, which is the classic Merkle second-preimage attack — a forged inclusion proof for a receipt that was never issued. |
| Odd level | Promote the unpaired node unchanged to the next level. Do **not** duplicate it: duplication (the CVE-2012-2459 shape) lets two distinct leaf sets produce one root. |
| Single leaf | Root = that leaf. Not re-hashed. |
| Empty batch | No root. `batch()` refuses; it does not emit `SHA256("")`. |
| Ordering | Leaves in receipt-insertion order. The order is part of the commitment and is recorded with the batch so a proof can be checked. |
| Root on-chain | The 32 raw bytes, in `OP_RETURN OP_PUSHBYTES_32 <root>` → script `6a20` ‖ root. Never the hex string (which would need 64 bytes and mean a different commitment). |
| Proof element | 32 raw bytes plus a side bit (left/right). Both are required — a path without sides is not verifiable. |

### A4 — Reproducible build + module hash is part of the activation gate

`POS_LEG_SUBMISSION_ENABLED` may not be flipped on the strength of source review. Activation
additionally requires:

1. a **reproducible build** of the repaired canisters from a named commit (pinned toolchain,
   documented `docker`/`ic-wasm` invocation, byte-identical output on a repeat run);
2. the **deployed module hash** (`dfx canister info <id>` / `read_state` `module_hash`) matching
   that build's WASM sha256;
3. both recorded in `services/ops/canisterSourceManifest.ts` against the source commit.

This closes the gap the manifest currently states honestly as `null`: today we can say "this is
where the code is maintained" and cannot say "this is what the live canister runs". Every finding
in this plan came from a deployed canister whose provenance is unverified — the fix must not
inherit that weakness.

### CAP-1 — the final activation criterion

> **An independent verifier, starting from the Bitcoin transaction alone, must be able to prove the
> path back to `H`.**

Not "our code can verify it". A third party holding the txid, the public Merkle proof, and this
document's §A3 must arrive at `H` and match it to the constitutional receipt. Everything else in
this plan is a precondition for CAP-1; CAP-1 is the only criterion that cannot be satisfied by a
system that merely looks correct from the inside.

---

## 0. The chain that must hold end to end

```
H (activity_receipt commitment)
  → PoS leaf                     leaf must BE H, not a clock-derived receipt id
  → real Merkle root + proof     a tree, with a verifiable path per leaf
  → valid Bitcoin transaction    serialised, OP_RETURN actually carrying the root
  → real txid                    double-SHA256 of the serialised tx, 64 hex
  → confirmed block              a height read from the network, not a constant
```

**Not one of these six links currently holds.** Two are broken so fundamentally that fixing the
other four would change nothing: the root does not commit to `H`, and no Bitcoin transaction is
ever constructed.

## 1. Evidence base

All findings are from the checked-in source at `db6e5628` **and** a read-only probe of the
deployed canisters (`scripts/probe-pos-btc-anchoring.ts`, AigentZBeta). Where they agree, the
deployed behaviour is stated; nothing here is inferred from source alone.

### 1.1 `btc_signer_psbt` — no Bitcoin transaction exists

| # | Defect | Evidence (`canisters/btc_signer_psbt/src/lib.rs`) |
|---|---|---|
| B1 | **OP_RETURN is computed and discarded.** The data hash never enters transaction bytes. | `let _op_return_script = format!("6a20{}", data_hash);` — underscore-prefixed, never referenced again |
| B2 | **No transaction is serialised.** Outputs carry literal strings where addresses belong. | `TransactionOutput { address: "OP_RETURN", amount: 0 }`, `address: "change_address"` |
| B3 | **`txid` is not a txid.** It is the first 32 bytes of the ECDSA signature, not the double-SHA256 of a serialised tx. | `let txid = hex::encode(&signature[..32]);` |
| B4 | **`raw_tx` is a label, not bytes.** Broadcast would always fail on a real node. | `let raw_tx = format!("signed_tx_{}", txid);` then `sendrawtransaction` with that string |
| B5 | **Address generation is not bech32.** No checksum, no 5-bit squashing, and it hashes nothing — it takes raw pubkey bytes. | `format!("tb1q{}", hex::encode(&public_key[..20]))` |
| B6 | **Mock UTXO with an all-zero txid.** | `txid: "0000…0000"` in `create_and_broadcast_anchor` |

### 1.2 `proof_of_state` — the root commits to the wrong thing

| # | Defect | Evidence |
|---|---|---|
| P1 | **Root commits to receipt IDs, not `data_hash`.** A receipt id is `receipt_<clock>` and carries no information about the act, so anchoring the root proves nothing about the receipt. | Source: `hasher.update(receipt.id.as_bytes())`. **Live: 20/20 sampled batches satisfy `root == sha256(concat receipt_ids)`; 0/20 satisfy `root == sha256(concat data_hashes)`.** |
| P2 | **Not a Merkle tree.** A single sequential SHA256 over concatenated ids admits no per-leaf proof by construction. | `let mut hasher = Sha256::new(); for r in &pending { hasher.update(...) }` |
| P3 | **`merkle_proof` always empty.** | `merkle_proof: vec![]` at issue; live: empty on **all 186** receipts in anchored batches |
| P4 | **txid synthesised on BOTH branches**; the BTC signer's real response is discarded. | `Ok(_response) => Ok(format!("btc_anchor_{}", …))`, `Err(_) => Ok(format!("mock_btc_txid_{}", …))`. Live: **all 76** anchored batches carry `mock_btc_txid_*` |
| P5 | **Block height hardcoded.** | `btc_block_height: Some(800000)`; live: constant across every batch |
| P6 | **`issue_receipt` is not idempotent.** Clock-derived id, no lookup by `data_hash` — repeat calls duplicate. | `let receipt_id = format!("receipt_{}", ic_cdk::api::time());` |

### 1.3 `cross_chain_service` — ready ≠ verified (separate track)

`REQUIRED_ATTESTATIONS = 2` and `get_ready_messages()` is exactly `attestation_count >= 2`. But
`submit_attestation` performs **no validator authorization and no signature verification** — it
appends whatever it is given. This is why fabricated validators drained 710 messages.
**Classified as a state transition, not verification.** Out of scope for this plan (which covers
the Bitcoin path); tracked separately.

Additionally: `get_ready_messages()` is **unreadable** on the deployed canister — the response
exceeds the IC's 3 MiB query cap (IC0504). Any fix must add a paginated or filtered accessor;
until then no finalizer can use it.

---

## 2. Phase B — `btc_signer_psbt` (FIRST)

**Why first:** correcting the PoS root alone cannot produce a real anchor. Even a perfect Merkle
root over `H` would be handed to a signer that never serialises a transaction. The substrate must
be able to *carry* a commitment before it is worth *computing* one correctly.

### B-1. Use a real Bitcoin library
Adopt `bitcoin` (rust-bitcoin) rather than hand-rolling consensus encoding. Hand-rolled
serialisation is how B1–B4 arose. Constrain to `no-std`-compatible features for the IC's wasm32
target; confirm at spike time that the chosen version builds for `wasm32-unknown-unknown`.

### B-2. Correct address derivation
Replace B5 with proper P2WPKH: `bech32(hrp, witness_v0, hash160(compressed_pubkey))`, with the HRP
selected by network (`bc` / `tb`). Must round-trip against a known test vector, not merely "look
like an address".

### B-3. Actually encode OP_RETURN
Build the output as `OP_RETURN <PUSH_32> <root_bytes>` and place it in the transaction's output
vector. The 32 bytes MUST be the batch root supplied by `proof_of_state`. Delete the discarded
`_op_return_script` string entirely so it cannot be mistaken for the real path.

### B-4. Real signing, real txid
Sign with the IC's threshold ECDSA over the correct sighash for each input, assemble the witness,
serialise the transaction, and derive `txid = sha256d(serialised_tx_without_witness)`. `raw_tx`
becomes the hex of the serialised transaction — broadcastable as-is.

### B-5. Real UTXO selection
Replace the zero-txid mock with UTXOs supplied by the caller or fetched from the IC's Bitcoin API.
Refuse explicitly when funds are insufficient rather than proceeding with a placeholder.

### B-6. Truthful broadcast
`broadcast_transaction` must return the node's txid on success and a **named error** on failure.
Today a failed broadcast can still yield `Ok(format!("broadcast_success_{...}"))` — a success
string synthesised from the input. That is the same `Err`-as-success class already fixed in the
LayerZero route on the application side.

### Acceptance tests — must FAIL against `db6e5628`

| ID | Assertion | Fails today because |
|---|---|---|
| BT-1 | The serialised tx contains an output whose `script_pubkey` begins `6a20` and whose next 32 bytes equal the supplied root | no tx is serialised at all; the script string is discarded (B1/B2) |
| BT-2 | `txid == sha256d(serialised_tx)` | txid is `signature[..32]` (B3) |
| BT-3 | `raw_tx` decodes as a valid Bitcoin transaction | it is the string `signed_tx_<hex>` (B4) |
| BT-4 | Derived address round-trips through a bech32 decoder to `hash160(pubkey)` | `tb1q` + raw pubkey prefix, no checksum (B5) |
| BT-5 | `create_and_broadcast_anchor` refuses when given no real UTXOs | it substitutes an all-zero mock (B6) |
| BT-6 | A broadcast rejection returns `Err`, never a synthesised success string | `Ok(format!("broadcast_success_{…}"))` on the parse-failure path |

---

## 3. Phase P — `proof_of_state` (SECOND)

### P-1. Leaf = `H`
`batch()` must build leaves from `receipt.data_hash`, never `receipt.id`. This is the single most
important change in the plan: without it every downstream link anchors a clock value.

### P-2. A real Merkle tree
Build a binary tree with a defined duplicate-last-node rule for odd levels, and a documented
domain separation between leaf and internal hashing (e.g. `0x00`/`0x01` prefixes) so a leaf can
never be reinterpreted as an internal node.

### P-3. Populate `merkle_proof`
Each receipt stores its sibling path. `verify_inclusion(H, proof, root) -> bool` becomes a public
query, so a third party can verify without trusting the canister's own assertion.

### P-4. Consume the signer's real result
`anchor()` must take the txid `btc_signer_psbt` returns and store it, propagating `Err` as `Err`.
Delete both synthesised-txid branches.

### P-5. Real block height
Populate from a confirmation lookup; leave `None` until confirmed. `None` is honest; `800000` is
not.

### P-6. Idempotent issuance
Index by `data_hash`. `issue_receipt(H)` for an existing `H` returns the existing receipt id. This
is what lets the AigentZBeta reconciler retry safely — until it lands, retries must remain gated on
our own `pos_receipt_id`.

### Acceptance tests — must FAIL against `db6e5628`

| ID | Assertion | Fails today because |
|---|---|---|
| PT-1 | `root != sha256(concat receipt_ids)` for a batch of ≥2 receipts | that is exactly the current construction (P1) |
| PT-2 | `root` changes when a receipt's `data_hash` changes but its id does not | root ignores `data_hash` entirely (P1) |
| PT-3 | `verify_inclusion(H_i, proof_i, root) == true` for every leaf | no proofs; not a tree (P2/P3) |
| PT-4 | `verify_inclusion(H_wrong, proof_i, root) == false` | no verifier exists |
| PT-5 | `issue_receipt(H)` twice returns the same id and adds one receipt | clock-derived id, no dedup (P6) |
| PT-6 | `anchor()` returns `Err` when the signer fails | both branches return `Ok` (P4) |
| PT-7 | `btc_block_height` is `None` until a confirmation is observed | hardcoded `800000` (P5) |

---

## 4. End-to-end acceptance — the flight readiness test

One test, spanning both canisters and AigentZBeta, that must pass before
`POS_LEG_SUBMISSION_ENABLED` is flipped:

```
GIVEN  an activity_receipt with commitment H
WHEN   H is issued to proof_of_state, batched, and anchored
THEN   1. the batch root verifies H's inclusion proof
       2. the anchoring transaction's OP_RETURN output contains that exact root
       3. the txid is the double-SHA256 of the serialised transaction
       4. the txid is retrievable from a Bitcoin node (testnet acceptable)
       5. the block height comes from that node, not a constant
       6. starting from the on-chain OP_RETURN alone, an independent verifier
          reconstructs the path back to H and confirms the receipt
```

Step 6 is the real bar. Everything before it can be satisfied by a system that merely *looks*
correct from the inside; only step 6 proves the anchor means something to someone who does not
trust us.

---

## 5. Sequencing and division of labour

The operator holds write/admin on `iQubeBeta-Program`; this session is read-only there. Suggested
split:

1. **Canister work** on a dedicated branch in `iQubeBeta-Program` — by the operator or a second
   agent. Phase B, then Phase P. Acceptance tests written FIRST and demonstrated red against
   `db6e5628` before any fix lands (OS-9: a canary that never failed proves nothing).
2. **AigentZBeta stays aligned** — this session keeps the shared-H structure, the manifest, and the
   posture guards current; updates `canisterSourceManifest.ts` caveats as they are retired.
3. **Deployment provenance**: record the deployed module hash against the source commit when the
   repaired canisters ship, closing the "is the live canister running this source" gap that is
   currently `null` for every entry.

---

## 7. CANISTER LINEAGE CENSUS (read-only, 2026-08-08)

Run before Phase B implementation, per operator directive. `read_state` +
query calls only — nothing deployed, upgraded or mutated.

### 7.1 Correction to the record

Two claims made earlier in this investigation **overstated the evidence and are
withdrawn**:

- ~~"this canister has never had a working test gate"~~
- ~~"the anchor path cannot have worked at any point in its history"~~

What was actually established is narrower: **at `db6e5628` the workspace did not
resolve and `btc_signer_psbt`'s tests did not compile.** That is a statement
about HEAD, not about the project's history.

`3ee3cb0` (2025-09-14, *"Complete ICP/BTC integration with deployed canisters"*)
records all four canisters deployed with dfx 0.29.1 / Rust 1.89.0 and
**"Successfully test all deployed canisters with live function calls"**. The
workspace break was introduced later, when `reputation_qube` joined the
workspace with an `ic-cdk-macros` feature that does not exist.

**This is a regression in a system that once ran, not an edifice that never
did.** That changes the repair posture materially.

### 7.2 Census results

| Canister | Principal | Classification | Deployed module hash |
|---|---|---|---|
| proof_of_state | `n2hhv-aaaaa-aaaas-qccza-cai` | **LIVE on IC** | `97b83aa2d4af6b9c…ee2c4b7b` |
| cross_chain_service | `sp5ye-2qaaa-aaaao-qkqla-cai` | **LIVE on IC** | `72a026cab892ac65…e18ce16e` |
| evm_rpc | `7hfb6-caaaa-aaaar-qadga-cai` | **LIVE on IC** | `f61b3c2970548b61…1075d392` |
| btc_signer_psbt | `uxrrr-q7777-77774-qaaaq-cai` | **NOT ON IC** — `canister_not_found` | — |
| evm_rpc | `uzt4z-lp777-77774-qaabq-cai` | **NOT ON IC** — `canister_not_found` | — |
| proof_of_state | `umunu-kh777-77774-qaaca-cai` | NOT ON IC (local dfx) | — |
| cross_chain_service | `u6s2n-gx777-77774-qaaba-cai` | NOT ON IC (local dfx) | — |
| solana_signer_ed25519 | `ulvla-h7777-77774-qaacq-cai` | NOT ON IC (local dfx) | — |

**Discrepancy resolved:** the operator's note recorded `.dfx` as listing
`proof_of_state = ulvla…`. The historical file at `cebf998` actually lists
`proof_of_state = umunu-kh777-77774-qaaca-cai`; `ulvla…` was
`solana_signer_ed25519` there, and `__Candid_UI` at `7ad1683`. It does not
change the conclusion — every `-77774-` principal is local — but the record
should be exact.

### 7.3 THE CENTRAL FINDING — an accidental promotion, and what it caused

`a88bc3a` (2025-10-05) wrote into mainnet environment configuration:

```
# Bitcoin Signer - LIVE MAINNET
BTC_SIGNER_CANISTER_ID=uxrrr-q7777-77774-qaaaq-cai
# EVM RPC - LIVE MAINNET
EVM_RPC_CANISTER_ID=uzt4z-lp777-77774-qaabq-cai
```

Both are **local dfx ids** from `.dfx/local/canister_ids.json` @ `cebf998`.
Neither resolves on IC mainnet. The label "LIVE MAINNET" was applied to a
local-replica identity.

`n2hhv…` (PoS) and `sp5ye…` (DVN) were, by contrast, genuinely deployed to
mainnet via a GitHub Actions pipeline — the same commit series describes
`n2hhv` as *"Fresh IC Mainnet"*. So the promotion defect is specific, not
general.

**Why this matters more than any source defect found so far.**
`proof_of_state::anchor()` hardcodes its callee:

```rust
let btc_canister_id = "uxrrr-q7777-77774-qaaaq-cai";
```

That principal does not exist on mainnet, so the inter-canister call **cannot
succeed**, and control lands here every single time:

```rust
Err(_) => Ok(format!("mock_btc_txid_{}", &batch.root[..8]))
```

The synthesised txid on all 76 anchored batches is therefore **not a lazy
placeholder — it is the error branch firing continuously since deployment.**
The BTC signer was never absent from the design; it was absent from the
network, and the code swallowed that as success.

This is the same defect class as everything else in this investigation
(`Err`-as-success, read-failure-as-empty-result), now found at the
infrastructure layer: **a failure to reach the substrate was recorded as
substrate output.**

### 7.4 Was there ever a real IC-mainnet btc_signer?

**No.** Evidence, all consistent:

- `canister_ids.json` at HEAD contains **only** `cross_chain_service` under
  `"ic"` — no PoS, no signer;
- the sole `btc_signer_psbt` id in any `.dfx` state is the local `uxrrr…`;
- `uxrrr…` resolves `canister_not_found` on mainnet today;
- no commit anywhere in 138 commits of history records a signer mainnet deploy.

`n2hhv` reached mainnet through CI; the signer never did.

### 7.5 Phase B routing recommendation

Of the three options: **(2) create a new `btc_anchor_v2` canister**, with one
qualification.

- **(1) repair the existing signer source** — the source is the right starting
  point and Phase B's seven RED tests already target it. But there is no
  deployed mainnet signer to repair: the repair necessarily produces a *new*
  mainnet canister with a *new* principal.
- **(3) recover a different historical implementation** — nothing to recover.
  The census found no other signer identity, and the local `uxrrr…` ran the
  same mock-bearing source.

So the substance of (1) — fix `btc_signer_psbt`'s source against the RED
contract — and the deployment reality of (2): first mainnet deployment, new
principal, recorded in `canister_ids.json` under `"ic"` with a reproducible
build and module hash per A4. Whether it is *named* `btc_anchor_v2` or remains
`btc_signer_psbt` at a new principal is the operator's call; the census does not
decide it.

### 7.6 `n2hhv` is active legacy state

Treated as such throughout: **not** dead code. It holds 161 batches / 624
receipts. Its root construction is wrong (commits to receipt ids) and its
`merkle_proof` is empty, so a v2 `proof_of_state` cannot simply inherit that
state as though it were valid evidence. **No upgrade proposed until
state-preservation semantics are specified and reviewed** — a Phase P
precondition, not a Phase B one.

### 7.7 Provenance still open

The census obtained deployed module hashes for the three live canisters. That
is an **observation of what is running**, not proof of what source produced it.
`moduleHashVerifiedAgainstSource` remains `null` for every entry and the A4 gate
keys on **that** field, not on `deployedModuleHash` — otherwise merely running
the census would have opened the gate, which is the same weak-fact-promoted-to-
strong-claim pattern that put a local canister id into mainnet config.

---

## 6. Explicitly NOT in this plan

- **Repairing the historical 120 `dvn_failed` / 267 `dvn_pending`.** Held per operator ruling.
  Once the substrate is evidentiary, the 120 (no message id) are candidates for idempotent
  re-submission of the *original* receipts, and the 267 (with ids) for finalization against real
  readiness evidence. Neither is a licence to mint replacement constitutional events.
- **DVN validator authorization / signature verification.** A separate track; `>=2` stays
  classified as *ready*, never *verified*, until it exists.
- **The `get_ready_messages()` payload cap.** Needs a paginated accessor on the canister; noted
  here because no finalizer can work without it, but it is not part of the Bitcoin path.
- **Any change to `validatorId`, signature generation, batching strategy, or receipt rows** —
  frozen per the standing instruction.
