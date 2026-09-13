# Constitutional Risk Flow Panel — Use Case Zero Build-Order Item 10a

**Date:** 13 September 2026
**Status:** Implemented, tested, committed locally (not pushed).
**Scope:** A READ-ONLY, additive MoneyPenny panel that assembles and renders
items 5-9's own causal chain for one private multi-party underwriting
request — Factor selection -> Aegis admission -> disclosure authorization ->
frozen envelope -> Vela execution -> underwriting quote -> settlement ->
causal receipt -> risk telemetry — from the SAME `activity_receipts` +
`golden_cycle_records` evidence those six upstream files already write.
Zero changes to any of them.

## 1. Critical disambiguation

`components/moneypenny/useCaseZero/UseCaseZeroReadinessCapsule.tsx` (backed
by `services/factor/useCaseZeroOrchestrator.ts` /
`useCaseZeroReadinessProjection.ts` / `useUseCaseZeroReadiness.ts`) is a
COMPLETELY DIFFERENT, pre-existing, case-scoped (`factor_cases`)
AGENT-ONBOARDING READINESS state machine — already mounted inside
`FactorPanel.tsx`/`AegisPanel.tsx`. This item does not touch, extend, or
import from any of those files. Every new file in this item names its own
surface "Constitutional Risk Flow" throughout, never "Use Case Zero
anything," per the operator's own explicit naming instruction and exactly
the same disambiguation items 7-9 each independently established in their
own file headers.

`services/moneypenny/admissionAuthority.ts` (a different, case-scoped
MoneyPenny admission decision) and `services/qubetalk/disclosurePolicy.ts`
(a different, conversation-context disclosure concept) are likewise never
imported by anything in this item.

## 2. What was built

### 2.1 `services/vela/velaUnderwritingChainProjection.ts` (new, read-only)

`getConstitutionalRiskFlowState({ personaId, requestRef })` — a pure-read,
fail-closed (never throws) service:

- Reads the persona's own receipts via the EXISTING
  `listActivityReceiptsForPersona` (never a hand-rolled query), filtered to
  the five relevant action types, then filtered client-side by
  `actionInput.requestRef === requestRef` — verified uniform across all five
  real receipt shapes by reading all six upstream files in full first.
- Adds the ONE new read this item needed with no existing reader to reuse: a
  `golden_cycle_records` lookup by `action_ref = onChainRequestId` (the
  frozen-envelope receipt's own on-chain request id) — chosen over a
  `value_cycle->>'requestRef'` filter because that table carries no
  persona-scoping column at all, documented in the file's own header.
- Defines a five-value step-state vocabulary
  (`not_started | in_progress | blocked | unresolved | complete`), derived
  independently per step — a downstream artifact's presence never implies an
  upstream step succeeded. Aegis's own `ADMITTED/REFUSED/UNRESOLVED` maps
  1:1 onto `complete/blocked/unresolved`. `complete` is documented and tested
  to never imply a favourable outcome: a Quote step reading `complete` with
  `disposition: 'UNACCEPTABLE'` and `coverageEligible: false` renders those
  real fields verbatim.
- Settlement is derived honestly from the one genuine, already-recorded fact
  this chain produces (`execution_evidence.settlementOccurred`) rather than
  inventing a new receipt type or a fabricated "pending" state — there is no
  settlement receipt type in this chain today, and this item does not add
  one.

### 2.2 `app/api/moneypenny/constitutional-risk-flow/route.ts` (new)

A spine-authenticated GET route: resolves the caller via `getActivePersona`,
reads `?requestRef=` (400 when missing/empty), calls the new service scoped
to the RESOLVED persona only.

### 2.3 UI — panel + presentation kit

- `app/(shell)/moneypenny/components/constitutionalRiskFlow/riskFlowSurfaceKit.tsx`
  — a small, parallel slate-house-style presentation kit (section/capsule/
  step-chip/badge/provider-mode-badge), mirroring
  `components/moneypenny/bankr/bankrSurfaceKit.tsx`'s shape and visual
  contract exactly, without importing Bankr's own components into a
  non-Bankr surface.
- `app/(shell)/moneypenny/components/ConstitutionalRiskFlowPanel.tsx` — a
  `requestRef` input + Load action (no request-picker exists anywhere in
  this codebase yet, so the empty state says so honestly), a clickable
  9-step journey spine, 9 state chips derived strictly from the service's
  own vocabulary, and 9 expandable capsules (Participants & Services,
  Admission Evidence, Disclosure Scope, Frozen Envelope, Vela Execution,
  Risk & Coverage Quote, Settlement, Causal Receipt, Constitutional Risk
  Telemetry). The Disclosure Scope capsule renders every scope grant's
  `COMPUTE_WITH`/`DISCLOSE_TO` distinction explicitly with an honest static
  caption; the Vela Execution capsule visually separates MoneyPenny's own
  constitutional-evidence refs from Vela's own execution evidence and states
  plainly that no environment-trust/attestation field exists on this receipt
  today rather than fabricating a badge.

### 2.4 Registration

- `MoneyPennyPanelTab.tsx`: new `MoneyPennyPanelKey` value
  `"constitutional-risk-flow"` + `PANELS` map entry.
- `moneypennyCapabilities.ts`: `MONEYPENNY_AREA_FOR_PANEL -> "activity"`; a
  new capability item under the `"operate"` group.
- `moneyPennyNavigation.tsx`: a new `activeRiskFlowRequestRef` snapshot,
  mirroring the existing `activeCase` pattern exactly (one writer — the
  panel, on a successful load — one reader — the copilot workspace).

### 2.5 Copilot ground-context + suggestion wiring

- `MoneyPennyCopilotWorkspace.tsx`: fetches a small, bounded T1-safe
  reduction of the chain state (one state word per step, plus a handful of
  one-line facts) into `groundContext` when the panel is active, refetching
  on mount/visibility/focus exactly like the existing financial-profile
  ground snapshot.
- `app/api/codex/chat/route.ts`: registered `'constitutional-risk-flow'` as
  a new `ChipTargetId` (`LAYOUT_TAG_IDS`, a new `LAYOUT_KEYWORDS` entry, and
  the `aigent-moneypenny` system prompt's `Valid <id> values` list) — reusing
  the EXISTING groundContext + `[layout:<id>|<substance>]` suggestion
  mechanism. No new deterministic specialist-delegation trigger was built
  (that is a distinct mechanism for a different purpose, and building one
  here would be over-engineering for what this item needs).

## 3. Tests

- `tests/vela-underwriting-chain-projection.test.ts` (17 tests): every step
  `not_started` with no evidence; requestRef filtering is real; the Aegis
  status mapping; a frozen-envelope receipt resolving Freeze AND Execute
  complete from the SAME receipt; a projection-completed receipt with
  disposition `UNACCEPTABLE` resolving Quote `complete` while its real,
  unfavourable fields render honestly; Settlement's three real states; a
  leak-check across the full serialized state; import-boundary tests (both
  a `stripComments` substring check and an AST-based
  `forbiddenImportFindings` check); and a canary proving this file writes
  nothing.
- `tests/moneypenny-constitutional-risk-flow-route.test.ts` (4 tests): 401
  unauthenticated; 400 missing/empty requestRef; a happy-path proof that the
  RESOLVED persona's own personaId (never a client-supplied one) reaches the
  service.

## 4. Verification

- Both new test files pass in full: **21/21**.
- `tests/vela-underwriting-composition-gate.test.ts`,
  `vela-underwriting-admission-evidence.test.ts`,
  `vela-underwriting-disclosure-authorization.test.ts`,
  `vela-underwriting-projection.test.ts`,
  `vela-underwriting-risk-telemetry.test.ts`,
  `vela-multi-party-projection.test.ts`,
  `moneypenny-capability-navigation.test.ts`, and
  `moneypenny-copilot-workspace.test.ts` (160 tests total): all pass
  unchanged.
- A full repo-wide `vitest run` (707 test files, 11255 tests): 87
  pre-existing failures across 27 files — none reference MoneyPenny, Vela
  underwriting, or any file this item touched or created; each failure's own
  stack trace was inspected and traces to unrelated, pre-existing repo
  state (e.g. two candidate-invariant JSON files missing a `projections`
  field predating this session, an unrelated stale `getByRole('button', …)`
  expectation against a 2026-09-05 UI correction, an unrelated `pdf-parse`
  build-size assertion).
- `npx tsc --noEmit`: 677 pre-existing repo-wide errors (this repo runs with
  `next.config`'s `typescript.ignoreBuildErrors`); none of this item's new
  or touched files appear anywhere in the output.
- `git diff` against the base commit confirms zero changes to the six
  upstream backend files (`factorSelectionArtifact.ts`,
  `velaUnderwritingAdmissionEvidence.ts`,
  `velaUnderwritingDisclosureAuthorization.ts`,
  `velaMultiPartyProjection.ts`, `velaUnderwritingCompositionGate.ts`,
  `velaUnderwritingProjection.ts`) and zero changes to
  `useCaseZeroOrchestrator.ts`/`useCaseZeroReadinessProjection.ts`/
  `admissionAuthority.ts`/`disclosurePolicy.ts`.
- **Not verified**: a fully populated chain-state render in a live browser —
  no live end-to-end request exists in the DB yet to load. Only the empty/
  prompt-for-requestRef state and the unit/route test coverage are
  verified; this is stated honestly rather than claimed.

## 5. Resolution-record loop

- Resolution record:
  `codexes/packs/agentiq/resolution-records/records/RES-2026-09-13-CONSTITUTIONAL-RISK-FLOW-PANEL-001.json`
- Candidate invariant (parented to item 9's own composition-gate invariant
  for family continuity, though it governs the READ side of the pipeline —
  a genuinely new, distinct statement, not a restatement):
  `codexes/packs/agentiq/resolution-records/candidate-invariants/CI-2026-09-13-CONSTITUTIONAL-CHAIN-VIEWER-READS-EACH-STEPS-OWN-EVIDENCE-001.json`
- Both left at `status: "candidate"` — never self-ratified.
