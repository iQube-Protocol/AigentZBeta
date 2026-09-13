# Vela Accelerator — Guest-Side Multi-Party Disclosure-Scope Enforcement (Build-Order Prerequisite, closing the Item 3 hard blocker)

**Date:** 13 September 2026
**Status:** Implemented, tested, committed locally (not pushed). Closes the hard blocker
`RES-2026-09-13-VELA-MULTI-AGENT-NAMESPACE-INVESTIGATION-001` raised as a prerequisite for the
Use Case Zero vertical slice.
**Scope:** `docs/vela/accelerator/constitutional-financial-services/09_CLAUDE_IMPLEMENTATION_HANDOFF_v0.2.md`
"Phase 5 — multi-agent isolation," in-enclave half. Operator ruling, verbatim: *"Proceed with a
guest-side disclosure-scope and namespace enforcement design as the next prerequisite. Do not start
the underwriting vertical slice until the same isolation invariant already proven TS-side is proven
inside the Vela WASM guest."* Mid-task, the operator added five further mandatory acceptance
criteria (no pre-authorization coalescing; use ≠ reveal; scope binding; exhaustive failure
semantics; non-transitivity), all incorporated below — none compressed or skipped.

## 1. Preflight

Reviewed before writing any code:

- `codexes/packs/agentiq/updates/2026-09-13_vela-accelerator-multi-agent-namespace-investigation.md`
  — the crux fact (today's guest is a stateless single-participant blob, `sender` used only for
  reply routing) and the hard blocker this item closes.
- `RES-2026-09-13-VELA-MULTI-AGENT-NAMESPACE-INVESTIGATION-001` /
  `CI-2026-09-13-VELA-PARTY-NAMESPACE-KEY-BEFORE-STATEFUL-GUEST-001` — the TS-side namespace/
  disclosure model this item ports SEMANTICS from (not literally imports).
- `CI-2026-08-23-PER-AGENT-AUTHORITY-KEY-001` — the same "compose every relevant identity axis
  into the key" shape this item's per-party namespace keying is another occurrence of.
- `services/vela/wasm/projector/app/app.go`'s own header (three load-bearing single-party rules)
  and `app_test.go` (the existing suite) — read in full; **both preserved completely unmodified**.
- `services/vela/velaPartyNamespace.ts` and `tests/vela-party-namespace.test.ts` — the TS-side
  namespace-ref derivation and `VelaDisclosureScope` shape this item mirrors in Go.
- Ran `npm run report:resolutions` as instructed — it throws on two pre-existing 2026-09-05
  candidate-invariant records missing a `projections` field, exactly as the prior investigation
  already flagged (§1 of the namespace-investigation doc). Confirmed pre-existing, not introduced
  by this session, out of this item's scope — flagged again here rather than silently worked around
  a second time.
- Canary/enforcement reviewed: none pre-existing for in-enclave multi-party enforcement (confirmed
  by the prior investigation's own grep). This item's new canary is
  `services/vela/wasm/projector/app/app_multiparty_test.go`.
- Unresolved risk this item does NOT invalidate, duplicate, bypass, or regress: the single-party
  projector's three constitutional rules (PlainEvent never AppEvent; unacceptable is success; no
  operands in the verdict), the existing P-521 derivation and asset-bearing-request work (items 1–2
  of the build order), and the TS-side out-of-enclave gate (`velaPartyNamespace.ts`, untouched).

## 2. What was built

An **additive** multi-party request/response path inside `services/vela/wasm/projector/app/app.go`,
dispatched on the decrypted payload's own `"type"` field (`confidential_multi_party_consequence_projection`,
a new constant sibling to the existing `confidential_consequence_projection`) — every payload of any
other type, including malformed JSON, takes **exactly** the single-party path it always has.

### New types

- `MultiPartyContribution{RecipientAddress, Inputs}` — one party's own `ProjectionInputs` (reused
  verbatim, never reinvented) plus the on-chain address their own reply event is encrypted to.
- `MultiPartyProjectionInputs map[string]MultiPartyContribution` — every party's data, **separately
  keyed** by an opaque namespace ref (the same ref TS callers derive via
  `deriveVelaPartyNamespaceRef`), for the entire lifetime of a request.
- `ScopeAction` (`COMPUTE_WITH` / `DISCLOSE_TO`) + `ScopeGrant{Action, Party, To}` — two independent
  authorization primitives, never one derived from the other in code.
- `ScopeBinding{ApplicationID, RequestRef, OperationType, OutputClass}` — the context commitment a
  scope must match exactly.
- `MultiPartyDisclosureScope{Binding, Grants}` and `MultiPartyProjectionRequest{Type, RequestRef,
  Inputs, Scope, Context}`.

### New functions

`sniffRequestType` (dispatch only) → `resolveAuthorizedCombination` (the authorization gate) →
`evaluateMultiParty` (orchestrator; calls `combineInputsFn`, a package-level indirection that exists
solely so a test can prove it is never invoked pre-authorization) → `chooseVerdictForRecipient` /
`isDiscloseAuthorized` (the disclosure check, wholly separate from combination) → `buildMultiPartyEvents`
(constructs one `PlainEvent` per party, sorted deterministically by namespace ref) → `evaluateCombinedInputs`
(the reference joint-projection formula, reusing `evaluateSingleParty`'s fail-closed numeric
discipline, generalized across N contributors).

`project()`'s own tail was extracted, **behavior-unchanged**, into `evaluateSingleParty` so the joint
formula reuses it instead of duplicating validation logic (`inv.engineering.036`/`037`).

### Proof that authorization runs before any cross-party read

`resolveAuthorizedCombination`'s signature takes only namespace refs and plain strings — never a
`ProjectionInputs` value — so it is structurally incapable of reading private data
(`TestMultiParty_AuthorizationGateNeverReceivesPrivateInputs`). End-to-end,
`TestMultiParty_NoCoalescingBeforeAuthorization` installs a probe on `combineInputsFn` (the ONLY
function that ever receives more than one party's `ProjectionInputs` at once) and proves it directly:
**zero invocations** when authorization is denied or grants nothing; **exactly one invocation, with
exactly the authorized group,** when it is legitimately authorized — not an inference from the final
verdict, but a direct observation of when cross-party data access happens.

## 3. How each mandated property is satisfied

1. **No trusting the TS layer to sanitize after execution / no pre-authorization coalescing.** The
   gate is compiled into the WASM guest itself and runs before `evaluateMultiParty` ever builds the
   `group []ProjectionInputs` slice. Proved above.
2. **No contributor address alone is sufficient namespace authority.** `sender` is not even a
   parameter to `resolveAuthorizedCombination`/`evaluateMultiParty` — used only for the malformed-
   payload fallback delivery target, exactly as before. `TestSenderAddressAloneNeverGrantsNamespaceAuthority`
   submits the SAME request via two different senders (one equal to a party's own address) and
   proves identical outcomes.
3. **No merging private state into an undifferentiated struct before authorization.**
   `MultiPartyProjectionInputs` stays a map keyed by namespace ref for the request's entire lifetime;
   the authorization gate only ever sees a `map[string]bool` of which refs are present.
4. **Use ≠ reveal.** `ScopeActionComputeWith` and `ScopeActionDiscloseTo` are independent enum values
   checked by independent functions. `TestMultiParty_DisclosureIsSeparateFromCombinationConsent`
   proves both directions: full disclosure reaches both parties; a combination authorized for both
   but disclosure granted to only one direction reveals the joint verdict to that one party only;
   `ComputeWith` alone (no `DiscloseTo` grants at all) never implies disclosure to anyone.
5. **Scope binding — never replayable into a different calculation.** `ScopeBinding` commits
   `(applicationId, requestRef, operationType, outputClass)`;
   `TestMultiParty_ScopeBindingRejectsMismatchedContext` flips each field independently and confirms
   rejection; `TestMultiParty_NonTransitivity` proves a scope valid for `(A, B, request-1)` is
   rejected for `(A, C)`, `(B, C)`, and a **later** `(A, B, request-2)` — while the original context
   still authorizes correctly (not a blanket lockout).
6. **Exhaustive failure semantics.** Five distinct, individually named tests
   (`TestMultiParty_FailureMode_MalformedScopeJSON`, `_MissingScopeEntirely`,
   `_StaleBindingMismatch`, `_UnrecognizedOperationType`, `_UnrecognizedOutputClass`) plus
   `TestMultiParty_AmbiguousScopeResolvesEveryPartyUnresolved` (Grants omitted, an absent-party
   reference, a duplicate) all resolve to `VerdictUnresolved` for every party, never a partial or
   best-effort decision, and never a silent single-party fallback.

## 4. Confirmation the existing single-party path is untouched

`app_test.go` carries **zero diff** (`git diff --stat` against the merge base is empty for that
file). `project()`'s observable behavior is identical before and after the `evaluateSingleParty`
extraction — proved by running the full pre-existing suite unchanged and green both before and after
every edit in this session (see §5).

## 5. Test results

```
go test ./... -v            → 27 top-level test functions, all PASS (17 pre-existing + 10 new,
                                several with subtests)
go test ./... -count=20 -race → PASS, deterministic and race-free across 20 repeated runs
gofmt -l .                  → no files need formatting
go vet ./...                → clean
```

TS side: `npx vitest run tests/vela-party-namespace.test.ts` — 15/15 passed, unaffected (no TS files
were touched). Full-repo `npx vitest run`: 26 pre-existing failing files / 78 pre-existing failing
tests, none in a file this session touched or created — the same noise floor as before this session's
changes (confirmed by inspecting the failing-file list; none reference `vela` multi-party work).

## 6. Resolution record + candidate invariant + canary

- Resolution record: `codexes/packs/agentiq/resolution-records/records/RES-2026-09-13-VELA-MULTI-PARTY-GUEST-DISCLOSURE-ENFORCEMENT-001.json`
- Candidate invariant: `codexes/packs/agentiq/resolution-records/candidate-invariants/CI-2026-09-13-VELA-GUEST-ENFORCES-DISCLOSURE-SCOPE-BEFORE-COMBINING-001.json`
- Canary: `services/vela/wasm/projector/app/app_multiparty_test.go`

Status kept at `candidate` — not self-ratified, per the loop's own discipline (an agent may not
raise a record above `validated`, and this is a first occurrence).

## 7. Readiness

The in-enclave half of the isolation property the operator required is now built and tested. **The
Use Case Zero vertical slice is NOT unblocked by this alone** — this item did not touch
`prepareProjection()`/`submitProcessRequest` (TS-side wiring to actually construct and submit a
`MultiPartyProjectionRequest` payload), did not compile the WASM binary, and did not register a new
`applicationId`. Those are explicitly out of scope here (per the task's own instructions) and remain
the vertical slice's own work. What this item establishes is that the guest itself, once built, is
provably safe against the exact defect class the operator's acceptance test named — the vertical
slice can now proceed to wire a real caller against a guest design that has already been proven not
to violate the mandated property, rather than discovering the gap after a WASM binary already ships.
