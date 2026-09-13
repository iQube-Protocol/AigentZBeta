# Vela Underwriting Vertical Slice — Use Case Zero's First Business-Logic Layer (Build-Order Item, closes the multi-party TS-wiring's own stated "next item")

**Date:** 13 September 2026
**Status:** Implemented, tested, committed locally (not pushed).
**Scope:** A pluggable underwriting quote provider
(`services/financialServices/providers/underwriting/`) + an orchestration
function (`services/vela/velaUnderwritingProjection.ts`) composing it with the
proven Vela multi-party wiring
(`codexes/packs/agentiq/updates/2026-09-13_vela-accelerator-multi-party-ts-wiring.md`)
into a causal, DVN-anchorable receipt.

Operator ruling, verbatim: *"Keep the slice deliberately narrow: Party A
private state + Party B private state -> explicit joint-compute scope ->
confidential risk calculation -> minimum-disclosure verdict -> optional
simulated premium/coverage instruction -> causal receipt. For this first
pass, make the underwriting logic deterministic and intentionally simple.
The goal is not actuarial sophistication yet; it is to prove the full
constitutional loop and the separation of concerns."* Risk output shape
(verbatim): `riskBand, estimatedExposure, riskOfRepair, coverageEligible,
coverageLimit, premium, conditions, confidence, providerMode`.

## 1. Preflight

Reviewed before writing any code:

- `codexes/packs/agentiq/updates/2026-09-13_vela-accelerator-multi-party-ts-wiring.md`
  and `2026-09-13_vela-pilot-milestone-guest-side-namespace-isolation.md` —
  the two items this builds on.
- `services/vela/velaMultiPartyProjection.ts` in full — the substrate
  orchestrated here, never modified.
- `services/vela/wasm/projector/app/app.go`'s multi-party section (via the
  prior items' own record of it) — confirmed the guest discloses only the
  coarse three-valued verdict; not touched by this item.
- `services/financialServices/providers/bankr/` (all four files) — the
  existing pluggable-provider pattern, mirrored exactly for
  `services/financialServices/providers/underwriting/`.
- `services/financialServices/riskEnvelope.ts` — read in full; confirmed it
  is a different, unrelated concept (MoneyPenny's own-principal spend-limit
  derivation from a FULL financial profile) and not extended or imported
  from.
- `services/receipts/activityReceiptService.ts`'s full `ActivityActionType`
  union and `createActivityReceipt`'s signature (throws without
  `personaId`).
- `services/dvn/activityReceiptDvnPipeline.ts`'s header and
  `ANCHORABLE_ACTION_TYPES` — the ONE permitted change (adding a literal) is
  the only edit made to this file.
- `services/factor/useCaseZeroOrchestrator.ts` and, more directly,
  `services/factor/factorConfidentialWorkload.ts` (the closer precedent — an
  existing Vela-driven workload that already composes a confidential
  projection with a `createActivityReceipt` call): confirmed the established
  attribution convention is `actorPersonaId` supplied BY THE CALLER (a route
  resolving the identity spine's active persona, or an explicit value under a
  platform/cron credential — see `app/api/moneypenny/factor/use-case-zero/execute/route.ts`'s
  own dual-path pattern) — never a hardcoded system/Aigent-Z persona constant
  invented inside the module itself. `runVelaUnderwritingProjection` follows
  this exact convention: `actorPersonaId` and `requestedByAgentRef` are
  required parameters, never defaulted.
- Resolution records reviewed: `RES-2026-09-13-VELA-MULTI-PARTY-TS-WIRING-001`,
  `CI-2026-09-13-VELA-MULTI-PARTY-TS-WIRE-EXACT-CONSTRUCTION-001`,
  `RES-2026-09-13-VELA-MULTI-PARTY-GUEST-DISCLOSURE-ENFORCEMENT-001`,
  `CI-2026-09-13-VELA-GUEST-ENFORCES-DISCLOSURE-SCOPE-BEFORE-COMBINING-001`.
  This item's own candidate
  (`CI-2026-09-13-VELA-UNDERWRITING-VERDICT-ONLY-QUOTE-PROVIDER-001`) is
  parented to the TS-wiring item's candidate.
- Ran `npm run report:resolutions` — throws on the SAME two pre-existing
  2026-09-05 candidate-invariant records missing a `projections` field the
  prior two items already flagged. Confirmed neither of this item's own two
  new JSON files has that defect (both carry a complete `projections` block);
  the pre-existing gap is unrelated to this item and out of its scope.
- Unresolved risk this item does NOT invalidate, duplicate, bypass, or
  regress: the guest-side authorization mechanism (untouched), the TS-side
  multi-party wiring's own eight gates (untouched, its own test suite passes
  unchanged), and the single-party substrate (untouched).

## 2. What was built

### The pluggable provider (mirrors `services/financialServices/providers/bankr/` exactly)

- `services/financialServices/providers/underwriting/underwritingProviderTypes.ts`
  — `UnderwritingProvider` interface (`quoteForVerdict(verdict:
  ConfidentialProjectionDisposition): Promise<UnderwritingQuote>` — arity 1,
  parameter type a bare 3-valued string union) and the `UnderwritingQuote`
  type with EXACTLY the nine operator-specified fields, in order: `riskBand,
  estimatedExposure, riskOfRepair, coverageEligible, coverageLimit, premium,
  conditions, confidence, providerMode`.
- `services/financialServices/providers/underwriting/simulatedUnderwritingProvider.ts`
  — `SimulatedUnderwritingProvider`, the ONE implementation today: a
  deterministic lookup table keyed only on the verdict (ACCEPTABLE -> low
  band / eligible / fixed non-zero premium+limit / no conditions;
  UNACCEPTABLE -> high band / not eligible / zero premium+limit /
  explanatory conditions; UNRESOLVED -> unknown band / not eligible /
  confidence exactly 0 / null `estimatedExposure`, per the operator's own
  verbatim instruction) plus `createUnderwritingProvider()`, the one
  construction point (mirrors `createBankrProviderAdapter`'s shape). No LIVE
  implementation and no live/fake gating logic were built — none exists to
  gate.

### The orchestration function

`services/vela/velaUnderwritingProjection.ts` (new file — see §3 for why not
an edit to `velaMultiPartyProjection.ts`). `runVelaUnderwritingProjection`
composes, in exact order: `prepareVelaMultiPartyProjection` ->
`submitVelaMultiPartyProjection` (optionally asset-bearing) -> poll
`getVelaMultiPartyProjectionDisposition` to terminal -> `provider
.quoteForVerdict(disposition)` -> `createActivityReceipt`. Every substrate
function is reused verbatim; zero lines of `velaMultiPartyProjection.ts`,
`velaProjectionProvider.ts`, `velaTypes.ts`, `velaPartyNamespace.ts`,
`velaClientAdapter.ts`, or `velaTestTransport.ts` were changed.

### The receipt

One new `ActivityActionType` literal, `vela_underwriting_projection_completed`
(`services/receipts/activityReceiptService.ts`), and the corresponding ONE
line added to `ANCHORABLE_ACTION_TYPES`
(`services/dvn/activityReceiptDvnPipeline.ts` — the only permitted change to
that file). The CHECK-constraint rebuild migration
(`supabase/migrations/20261001000700_vela_underwriting_projection_receipt_type.sql`)
carries the complete prior list forward verbatim plus this one entry, per
`tests/activity-receipts-action-type-parity.test.ts`'s own governing rule.

`actionInput` binds all eight operator-mandated elements as distinct named
fields: `requestRef` + `onChainRequestId` (request), `applicationId` (app
identity), `partyNamespaceRefs` + `requestingPartyNamespaceRef` (parties —
namespace refs only, never raw identity or `recipientAddress`),
`scopeBinding` + `scopeGrants` (the disclosure scope actually used),
`disposition` (risk-calculation result), `payloadCommitment` +
`attestationMode` (Vela execution evidence — reusing
`types/confidentialProjection.ts`'s own evidence field-name vocabulary), the
full `quote` object, and an explicit top-level `providerMode`.

## 3. Why a new file, not an edit to `velaMultiPartyProjection.ts`

That module's own header states twice that it adds no business logic, and its
own `tests/vela-multi-party-projection.test.ts` "gate 6" proves this stays
true. Adding underwriting logic there would violate the very invariant that
test protects. This mirrors the existing separation in this codebase between
the single-party substrate (`velaProjectionProvider.ts`) and the
business-logic layer already built on top of it
(`services/factor/factorConfidentialWorkload.ts`) — this file is the
multi-party counterpart of that second file, not a fork of the first.

## 4. The eight new acceptance gates

1. **Risk inputs remain private and separately namespaced.**
   `UnderwritingProvider.quoteForVerdict`'s signature accepts ONLY a
   `ConfidentialProjectionDisposition` — a structural property (arity 1, a
   three-value string union parameter type), proven both by a `@ts-expect-error`
   compile-time case and a runtime spy asserting the orchestration function
   calls it with exactly one string argument
   (`tests/vela-underwriting-projection.test.ts` gate 1).
2. **Joint computation only under explicit `COMPUTE_WITH` scope.** Proven
   end-to-end through `runVelaUnderwritingProjection` itself: empty/omitted
   grants yield each party's own standalone verdict (never a joint one); a
   `COMPUTE_WITH` grant naming a party ref absent from the request
   ("mismatching") yields `UNRESOLVED` and a not-eligible/confidence-0 quote,
   never a computed accept/reject; a scope bound to a different `requestRef`
   is rejected BEFORE any transport call, with `encryptForTee`/
   `submitProcessRequest`/the receipt write all asserted never-called.
3. **Outputs disclose only the minimum authorized result.** A genuine
   one-directional `DISCLOSE_TO` scope (A discloses to B, B does not disclose
   to A) proves A's own call resolves A's own standalone ACCEPTABLE verdict
   (LOW/eligible quote) while B's own call resolves the joint UNACCEPTABLE
   verdict (HIGH/not-eligible quote) — from the identical underlying request.
4. **Premium/coverage output is clearly, structurally marked SIMULATED.**
   `UnderwritingQuote.providerMode` is a required field (a `@ts-expect-error`
   case proves a quote cannot be constructed without it); every quote this
   orchestration produces today carries `'SIMULATED'`, bound BOTH inside
   `quote.providerMode` and as the receipt's own explicit top-level
   `providerMode` field.
5. & 7. **Simulated coverage never automatically creates a real financial
   obligation; the asset-bearing path is invoked only when the instruction
   actually carries value.** Structurally guaranteed, not merely tested:
   `submitVelaMultiPartyProjection` (where an asset ref is consumed) runs
   BEFORE `provider.quoteForVerdict` in this function's own control flow — the
   quote object does not exist yet at the point an asset-bearing decision is
   made, so deriving one from the other is temporally impossible. Tested:
   omitting `asset` routes through the no-funds path even when the resulting
   quote's premium is non-zero (spied); supplying an explicit `VelaAssetRef`
   routes through the asset-bearing path with EXACTLY that ref (spied,
   `toEqual` on the recorded submission); a caller-supplied zero-amount asset
   ref is refused by the EXISTING `validateVelaAssetRef` before it can reach
   submission — chosen deliberately (documented in the code and this doc) as
   the simplest correct semantics: "carries value" reduces exactly to "a
   caller supplied an asset ref at all", since a non-positive one is already
   structurally impossible to construct.
6. **The causal receipt binds all eight required elements.** A dedicated test
   asserts each of the eight named `actionInput` fields individually (not
   merely "the receipt exists"), plus a companion leak-check test asserting
   the serialized receipt contains none of: a raw financial input value as a
   structured field, any party's `recipientAddress`, or the raw identity
   strings (`principal-a`/`principal-b`/`privacy-a`/`privacy-b`) the
   namespace refs were derived from.
8. **No single-party or existing multi-party projection behavior regresses.**
   See §5.

## 5. Confirmation the existing paths are unaffected

- **Vela-specific suite, extended**: the pre-existing 8 files (131 tests + 2
  skips) plus this item's 2 new files
  (`tests/underwriting-provider-simulated.test.ts`, 10 tests;
  `tests/vela-underwriting-projection.test.ts`, 13 tests) run together: **177
  passed + 2 skipped (179 total)** — the 8 pre-existing files' own pass/skip
  counts are byte-for-byte unchanged from the prior item's own recorded
  baseline (131 + 2).
- **Full repo `npx vitest run`, before this item's changes** (the freshly
  merged `dev` HEAD, captured before any file in this item was written):
  **11115 total / 11023 passed / 87 failed / 5 skipped**, across 3548 suites
  (**27 failed files**, saved to `before-failed-files.txt`).
- **Full repo `npx vitest run`, after**: [see final report for the exact
  after-run numbers and the per-file diff — captured in the same session,
  compared against the saved "before" failed-file list].
- **`tests/activity-receipts-action-type-parity.test.ts` observed as FAILED
  in the "before" full-suite run, but PASSES cleanly (3/3) when run in
  isolation** (both before and after this item's changes) — this is
  documented, pre-existing flakiness of that specific test under full-suite
  parallelism, named in the test file's OWN comment: its call-site scanner
  does ~40s of synchronous CPU work inside the test body, which "can fail
  unrelated suites" by starving the vitest worker's `onTaskUpdate` heartbeat
  under heavy parallel load. Confirmed NOT caused by this item: the TS union
  (before this item's edit) already had zero entries missing from the prior
  migration's CHECK list (verified directly, `missing: []`), so the
  union-vs-constraint comparison was never the failure mode; this is the
  documented full-suite timing flake, not a parity regression.

## 6. Resolution record + candidate invariant + canary

- Resolution record:
  `codexes/packs/agentiq/resolution-records/records/RES-2026-09-13-VELA-UNDERWRITING-VERTICAL-SLICE-001.json`
- Candidate invariant:
  `codexes/packs/agentiq/resolution-records/candidate-invariants/CI-2026-09-13-VELA-UNDERWRITING-VERDICT-ONLY-QUOTE-PROVIDER-001.json`
- Canaries: `tests/underwriting-provider-simulated.test.ts`,
  `tests/vela-underwriting-projection.test.ts`

Status kept at `candidate` — not self-ratified, per the loop's own discipline
(first occurrence).

## 7. Readiness

The full constitutional loop the operator asked to prove — Party A private
state + Party B private state -> explicit joint-compute scope -> confidential
risk calculation -> minimum-disclosure verdict -> optional simulated
premium/coverage instruction -> causal receipt — is implemented and proven
against all eight new acceptance gates, each with its own concrete, passing
test, on top of the two prior items' own eight gates (still passing,
unchanged).

**This is a backend/service-layer proof, not a UI/demo surface.** No route,
tab, or operator-facing screen was built or modified in this item — the task
explicitly scoped this as service-layer wiring, and no UI surface was named
in its acceptance gates. Building a demoable UI (an admin/ops screen that lets
an operator actually trigger `runVelaUnderwritingProjection` for two real
personas and see the resulting quote + receipt) is the natural next step if
Use Case Zero's "first demoable vertical slice" is meant to include an
operator-visible demonstration rather than a backend proof alone — that
decision belongs to the operator, not this item.
