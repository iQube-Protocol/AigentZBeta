# Vela Accelerator — TS-Side Multi-Party Projection Wiring (Build-Order Item, closes the "next slice" opened by the guest-enforcement item)

**Date:** 13 September 2026
**Status:** Implemented, tested, committed locally (not pushed).
**Scope:** `services/vela/velaMultiPartyProjection.ts` (new) — construct/validate/serialize/
submit/decode a multi-party confidential projection request against the guest-side enforcement
built in `codexes/packs/agentiq/updates/2026-09-13_vela-accelerator-multi-party-guest-enforcement.md`.
Operator ruling, verbatim: *"Preserve the exact invariants the Go guest now proves. Keep this next
slice deliberately narrow: construct the request, serialize the disclosure scope, bind it to the
same applicationId + requestRef + operationType + outputClass, preserve per-party namespace refs,
submit through the existing Vela transport, and decode the authorized result without adding any new
business logic yet."*

## 1. Preflight

Reviewed before writing any code:

- `codexes/packs/agentiq/updates/2026-09-13_vela-accelerator-multi-party-guest-enforcement.md` and
  `2026-09-13_vela-pilot-milestone-guest-side-namespace-isolation.md` — the guest-side enforcement
  this item wires TS-side access to.
- `services/vela/wasm/projector/app/app.go`'s ENTIRE "Multi-party confidential consequence
  projection (ADDITIVE)" section — read in full, every JSON tag copied verbatim into the new TS
  types rather than paraphrased.
- `services/vela/velaPartyNamespace.ts` in full — confirmed its `VelaDisclosureScope` is a
  DIFFERENT, non-wire-compatible model built for an earlier item, before the Go guest's real wire
  format existed. Its reusable half, `deriveVelaPartyNamespaceRef`, is composed here; its
  disclosure-scope gate is not extended or reused.
- `services/vela/velaTypes.ts`, `velaClientAdapter.ts`, `velaTestTransport.ts`,
  `velaProjectionProvider.ts`, `types/confidentialProjection.ts` — the existing single-party and
  asset-bearing submission/decode path this new module composes with.
- `codexes/packs/agentiq/resolution-records/` — reviewed
  `RES-2026-09-13-VELA-MULTI-PARTY-GUEST-DISCLOSURE-ENFORCEMENT-001`,
  `CI-2026-09-13-VELA-GUEST-ENFORCES-DISCLOSURE-SCOPE-BEFORE-COMBINING-001`,
  `RES-2026-09-13-VELA-ASSET-NEUTRALITY-TRANSPORT-001`,
  `CI-2026-09-13-VELA-ASSET-BEARING-REQUEST-ADDITIVE-001`,
  `CI-2026-09-13-VELA-PARTY-NAMESPACE-KEY-BEFORE-STATEFUL-GUEST-001`. This item's own candidate
  (`CI-2026-09-13-VELA-MULTI-PARTY-TS-WIRE-EXACT-CONSTRUCTION-001`) is parented to the first of
  these — the guest-enforcement candidate — as its direct client-side counterpart.
- Ran `npm run report:resolutions` as instructed — it throws on the SAME two pre-existing 2026-09-05
  candidate-invariant records missing a `projections` field the guest-side item already flagged.
  Confirmed pre-existing, not introduced by this session, out of this item's scope.
- `go.mod`/Go module cache: read `vela-common-go@v0.2.0`'s `wasm/types/address.go` directly to
  confirm `types.Address.MarshalJSON` produces a lowercase-`0x`-prefixed 40-hex-char string (not a
  JSON byte array) — required to get `recipientAddress`'s wire representation right rather than
  guessing from convention (CLAUDE.md No-Guessing rule, applied to a wire format).
- Unresolved risk this item does NOT invalidate, duplicate, bypass, or regress: the single-party
  provider's five methods, the asset-bearing submission path, the guest-side authorization mechanism
  itself (untouched — `app.go`/`app_multiparty_test.go` were not modified, per the task's own
  instructions).

## 2. What was built

`services/vela/velaMultiPartyProjection.ts` — new, standalone module. No existing file was forked or
duplicated.

**Wire-exact types** (verified field-for-field against `app.go`'s JSON tags):
`VelaScopeAction` (`'COMPUTE_WITH' | 'DISCLOSE_TO'`), `VelaScopeGrant{action, party, to?}`,
`VelaScopeBinding{applicationId, requestRef, operationType, outputClass}`,
`VelaMultiPartyDisclosureScope{binding, grants}`, `VelaProjectionInputs` (reuses the SAME
`Record<string, number>` shape the single-party path already sends as
`ConfidentialProjectionRequest.confidentialInputs` — no dedicated TS `ProjectionInputs` type existed
anywhere in this repo before this item, confirmed by grep, so this is reuse, not a new stricter
type), `VelaMultiPartyContribution{recipientAddress, inputs}`,
`VelaMultiPartyProjectionInputs = Record<string, VelaMultiPartyContribution>`,
`VelaMultiPartyProjectionRequest{type, requestRef, inputs, scope, context?}`. Constants
`VELA_MULTI_PARTY_PROJECTION_REQUEST_TYPE`, `VELA_MULTI_PARTY_OPERATION_JOINT_CONSEQUENCE_PROJECTION`,
`VELA_MULTI_PARTY_OUTPUT_CLASS_JOINT_VERDICT` match `app.go`'s string constants exactly.

**Functions**: `assertValidVelaMultiPartyDisclosureScope` (runtime scope validator) →
`buildVelaMultiPartyProjectionRequest` (keys inputs by each party's own `deriveVelaPartyNamespaceRef`
ref) → `assertVelaMultiPartyScopeBindingMatchesContext` (client-side pre-submission binding check) →
`prepareVelaMultiPartyProjection` (validate + serialize + `encryptForTee`) →
`submitVelaMultiPartyProjection` (submit via the existing `VelaTransport`, optionally asset-bearing)
→ `getVelaMultiPartyProjectionDisposition` (decodes via the EXISTING `parseConfidentialVerdict`,
reused verbatim).

## 3. The wire shape, verified

Constructing a two-party request and serializing it:

```json
{
  "type": "confidential_multi_party_consequence_projection",
  "requestRef": "req-1",
  "inputs": {
    "<partyA-namespace-ref>": { "recipientAddress": "0x1111...1111", "inputs": { "currentExposure": 0, "proposedSpend": 800, "privateSpendLimit": 1000, "privateRiskLimit": 1000 } },
    "<partyB-namespace-ref>": { "recipientAddress": "0x2222...2222", "inputs": { "currentExposure": 0, "proposedSpend": 800, "privateSpendLimit": 1000, "privateRiskLimit": 1000 } }
  },
  "scope": {
    "binding": { "applicationId": "42", "requestRef": "req-1", "operationType": "joint_consequence_projection", "outputClass": "joint_verdict" },
    "grants": [ { "action": "COMPUTE_WITH", "party": "<partyA-ref>" }, { "action": "DISCLOSE_TO", "party": "<partyA-ref>", "to": "<partyB-ref>" } ]
  }
}
```

This is exactly what `app.go`'s `json.Unmarshal(payloadJSON, &req)` (`MultiPartyProjectionRequest`)
expects — the field names, nesting, and string constants are copied verbatim, and `recipientAddress`
is confirmed (via `vela-common-go`'s own `Address.MarshalJSON`) to unmarshal correctly as a
lowercase-`0x`-prefixed hex address.

## 4. The eight acceptance gates

1. **No construction without an explicit scope.** `scope` is a required field on
   `BuildVelaMultiPartyProjectionRequestParams` (not optional) AND `assertValidVelaMultiPartyDisclosureScope`
   runs at the top of `buildVelaMultiPartyProjectionRequest`, rejecting `undefined`, a non-object,
   a missing `binding`, any missing/empty binding field, and a missing `grants` array. A `tsc --noEmit`
   run over the whole repo shows **zero** errors in `tests/vela-multi-party-projection.test.ts`,
   confirming the file's `// @ts-expect-error` line correctly fired against the required field (if
   `scope` were optional, that directive would itself be a TS2578 "unused directive" error).
2. **Namespace refs stay distinct.** `buildVelaMultiPartyProjectionRequest` builds
   `VelaMultiPartyProjectionInputs` as a `Record` keyed by each party's own derived ref, one loop
   iteration per party, never reading another party's key; throws on a ref collision instead of
   silently overwriting. Tested directly: two-party construction asserts both refs present with
   their own, distinct input objects (`.not.toBe`), and a same-ref-collision case throws.
3. **Sender/signer is never namespace authority.** No function in the file accepts a signing key,
   `Wallet`, or on-chain sender identity — namespace-ref derivation's only inputs are `applicationId`
   and each party's own identities, via the existing `deriveVelaPartyNamespaceRef`. Tested: changing
   only `recipientAddress` (the delivery-routing value, same class as `sender`) leaves the derived
   ref unchanged.
4. **`COMPUTE_WITH`/`DISCLOSE_TO` stay separate.** `VelaScopeAction` is a two-literal union, never a
   boolean. Tested end-to-end through the deterministic fake transport: `COMPUTE_WITH`-only (no
   disclosure) yields each party's own standalone verdict; full bidirectional `DISCLOSE_TO` yields
   the joint verdict to both.
5. **A mismatched scope binding is rejected before submission, or resolves UNRESOLVED.**
   `assertVelaMultiPartyScopeBindingMatchesContext` runs inside `prepareVelaMultiPartyProjection`
   BEFORE `transport.encryptForTee` — tested by asserting both `encryptForTee` and
   `submitProcessRequest` spies are never called when the scope's `requestRef` doesn't match.
   Independently, a test that bypasses this client-side check (constructing the mismatched request
   directly and submitting it through a guest-faithful fake `verdictFor` mirroring
   `resolveAuthorizedCombination`) proves the guest-side path still resolves `UNRESOLVED`.
6. **Single-party path unaffected.** No line of `velaProjectionProvider.ts`, `velaTypes.ts`,
   `velaClientAdapter.ts`, or `velaTestTransport.ts` was changed. Full pre-existing Vela suite (8
   files, 131 tests + 2 skips) run unchanged before and after — identical pass counts.
7. **No-funds path is the default.** `submitVelaMultiPartyProjection` without an `asset` argument
   calls `submitProcessRequest`; tested with a spy showing `submitAssetBearingProcessRequest` is
   never called in that case.
8. **An asset ref is optional and exact.** Supplying a `VelaAssetRef` routes through
   `submitAssetBearingProcessRequest` with exactly that ref; tested with
   `toHaveBeenCalledWith(applicationId, encryptedPayload, asset)` and a check that the test
   transport recorded exactly that asset for the resulting requestId.

## 5. Confirmation the existing paths are unaffected

`tests/vela-multi-party-projection.test.ts` and `services/vela/velaMultiPartyProjection.ts` were
temporarily moved out of the working tree to capture a true "before" baseline, then restored, so the
diff below is exact rather than inferred:

- **Vela-specific suite** (8 pre-existing files): 131 passed + 2 skipped, byte-for-byte identical
  before and after.
- **Full repo `npx vitest run`, before** (files absent): 27 failed files / 87 failed tests / 11000
  passed / 5 skipped, out of 11092 total.
- **Full repo `npx vitest run`, after** (files restored): 27 failed files / 87 failed tests / 11023
  passed / 5 skipped, out of 11115 total (+23 = exactly the new file's own tests, all passing).
- **Per-file failure diff**: identical failing-test counts per file between the two runs, with ONE
  exception — `tests/corpus-scout-verification-step.test.ts` failed in the "after" run and not in
  the "before" run. Inspected directly: its failure is `expected 29 to be greater than or equal to
  30` — a millisecond-scale timing race in an unrelated corpus-scout verification-step test, with no
  import of, or reference to, anything Vela-related. This is exactly the "ongoing, unrelated
  dev-branch drift in its noise floor" the task's own instructions warned about, not a regression
  from this session's changes.

## 6. Resolution record + candidate invariant + canary

- Resolution record: `codexes/packs/agentiq/resolution-records/records/RES-2026-09-13-VELA-MULTI-PARTY-TS-WIRING-001.json`
- Candidate invariant: `codexes/packs/agentiq/resolution-records/candidate-invariants/CI-2026-09-13-VELA-MULTI-PARTY-TS-WIRE-EXACT-CONSTRUCTION-001.json`
- Canary: `tests/vela-multi-party-projection.test.ts`

Status kept at `candidate` — not self-ratified, per the loop's own discipline (first occurrence).

## 7. Readiness

TS-side multi-party wiring is complete against all eight acceptance gates, each with its own
concrete, passing test (23/23 in the new suite). This item still does NOT compile the WASM binary,
register a new `applicationId`, or submit against a live Vela deployment — proved entirely via the
existing deterministic fake transport, exactly as every prior build-order item in this pilot has,
per the task's own explicit out-of-scope list. No RiskSlice/coverage/premium/underwriting logic was
added — `getVelaMultiPartyProjectionDisposition` decodes by calling the existing
`parseConfidentialVerdict` verbatim, adding no new business logic.

**The underwriting vertical slice (the NEXT item) can now safely begin** against this wiring: it has
a wire-exact, gate-proven client for the guest-side authorization mechanism already proven safe, and
can build its own domain-specific request/response handling (RiskSlice, coverage, premium, causal
receipt) on top of `buildVelaMultiPartyProjectionRequest` /
`prepareVelaMultiPartyProjection` / `submitVelaMultiPartyProjection` /
`getVelaMultiPartyProjectionDisposition` rather than re-deriving the wire format or the namespace/
scope-binding discipline from scratch.
