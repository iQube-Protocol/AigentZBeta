# Vela Pilot Milestone — Guest-Side Constitutional Namespace Isolation

**Date:** 2026-09-13
**Status:** Milestone record — operator-designated checkpoint in the Vela accelerator pilot log
**Commit:** `d20c5a79c` — "Record vela multi-party guest-enforcement resolution + candidate invariant" (session branch `claude/amplify-build-handoff-doc-prubcy`, not yet on `dev`)

## Operator framing (verbatim, 2026-09-13)

> d20c5a79c establishes guest-side constitutional namespace isolation for multi-party confidential
> computation, including non-transitivity, scope binding, use/reveal separation, fail-closed
> semantics, and sender≠authority. That is probably one of the most consequential implementation
> checkpoints in the entire Vela pilot so far.

## What this checkpoint actually is

The immediately preceding build-order item (`0ee1f6696`/`f4140a523`, recorded in
`2026-09-13_vela-accelerator-multi-agent-namespace-investigation.md`) established the crux fact by
reading the real WASM guest source (`services/vela/wasm/projector/app/app.go`): the guest was a
pure, stateless, **single-party** projector with no concept of a second party's data entering one
call at all. It built a TS-side namespace/disclosure gate (`services/vela/velaPartyNamespace.ts`)
that could enforce the required isolation property only for evidence handled **after** it left the
guest — and flagged, as a hard blocker, that this could not protect a future stateful multi-party
guest, because an unauthorized in-enclave combination cannot be undone by out-of-enclave code
afterward.

`d20c5a79c` (and its parent commit `de4222fe7`) closes that specific gap: the SAME isolation
property is now enforced **inside `app.go` itself** — the code that is compiled into the WASM
binary and runs inside the TEE — not merely checked by TypeScript code sitting outside it.

## The six properties, and how each was independently verified before merge (not merely reported)

1. **Authorization runs strictly before any cross-party read.** The gate function
   (`resolveAuthorizedCombination`) takes only namespace-ref strings and binding values — its own
   type signature makes it structurally incapable of reading a party's private inputs. A
   package-level `combineInputsFn` indirection lets a test *count* invocations: zero on denial,
   exactly one (with exactly the authorized group) on approval — a memory-shape proof, not an
   output-only inference.
2. **Sender address is never namespace authority.** `sender` is not even a parameter to the
   authorization path. Verified observably: two requests differing only in sender (one equal to a
   party's own on-chain address) produce identical results. Dedicated regression test:
   `TestSenderAddressAloneNeverGrantsNamespaceAuthority`.
3. **Use ≠ reveal.** `COMPUTE_WITH` and `DISCLOSE_TO` are separate action types, checked by wholly
   separate functions, one never derived from the other. Verified: a party validly combined into a
   joint computation receives their own standalone verdict, not the joint one, unless every other
   combined party separately granted disclosure to them.
4. **Scope binding, non-transitivity.** A scope is checked against `(applicationId, requestRef,
   operationType, outputClass)` before any grant is read. Verified: a scope valid for A+B on
   request-1 is rejected against A+C, B+C, and even a *later* A+B request with a new requestRef —
   while the original context still authorizes correctly (not a blanket lockout).
5. **Exhaustive fail-closed semantics.** Five distinct failure modes (malformed scope JSON, missing
   scope, stale/mismatched binding, unrecognized operation type, unrecognized output class) plus the
   ambiguous-but-well-formed case all resolve to `UNRESOLVED` for every party — never a silent
   single-party fallback.
6. **No operand leakage.** A party's own verdict event never contains another party's operands,
   confirmed by literal string search over the encoded event bytes.

**Independent verification performed in this session before merge** (not merely accepted from the
implementing sub-agent's report): read the full `app.go` diff and `app_multiparty_test.go` in full;
confirmed `app_test.go` (the pre-existing single-party suite) has a zero-line diff; ran
`go test ./... -v` (27/27 pass) and `go test ./... -race -count=5` (clean); ran the TS-side
`tests/vela-party-namespace.test.ts` (15/15 pass, unaffected).

## Why this is the load-bearing checkpoint

Everything built before this item (P-521 derivation from agent custody, asset-neutral transport
widening, the TS-side namespace/disclosure model) was necessary but not sufficient: none of it could
stop an unauthorized combination from happening **inside the TEE**, where nothing outside the
enclave can observe or undo it after the fact. This is the first point in the Vela accelerator pilot
where the constitutional boundary — "Party A must be unable to cause Party B's confidential state to
be read, combined, disclosed, or emitted unless the exact transaction/disclosure scope authorizes
it" (operator's original mandate) — is proven where it actually matters: in the guest itself.

## What is still open

- **TS-side wiring** to actually construct/submit a multi-party request against this guest path
  does not exist yet — this is the next build-order item (in progress as of this doc).
- **WASM compilation and `applicationId` registration** remain explicitly out of scope for this
  pilot phase — a separate, Vela-Engineering-permissioned action (per the team-confirmed baseline:
  new WASM = new applicationId + fresh state, no auto migration).
- **The underwriting vertical slice itself** (RiskSlice objects, coverage/premium computation,
  causal receipt) has not been started — this guest-side enforcement is the prerequisite substrate
  it will be built on, per the operator's own build order.

## Related records

- `codexes/packs/agentiq/resolution-records/records/RES-2026-09-13-VELA-MULTI-PARTY-GUEST-DISCLOSURE-ENFORCEMENT-001.json`
- `codexes/packs/agentiq/resolution-records/candidate-invariants/CI-2026-09-13-VELA-GUEST-ENFORCES-DISCLOSURE-SCOPE-BEFORE-COMBINING-001.json` (status `candidate`)
- `codexes/packs/agentiq/updates/2026-09-13_vela-accelerator-multi-party-guest-enforcement.md` (the implementation record this milestone doc summarizes)
- `codexes/packs/agentiq/updates/2026-09-13_vela-accelerator-multi-agent-namespace-investigation.md` (the preceding item that found the gap)
