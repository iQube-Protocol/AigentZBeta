# Factor Selection Artifact — Use Case Zero Build-Order Item 7

**Date:** 13 September 2026
**Status:** Implemented, tested, committed locally (not pushed).
**Scope:** Factor added narrowly as the economic coordination / selection
layer on top of the completed underwriting + telemetry loop
(`services/vela/velaUnderwritingProjection.ts`, item 5;
`services/vela/velaUnderwritingRiskTelemetry.ts`, item 6): candidate
discovery, service/counterparty selection, and construction of a
deterministic, receiptable selection artifact — nothing more.

Operator ruling, verbatim: *"At this point the constitutional loop is
already coherent through telemetry, so Factor should be added very narrowly
as the economic coordination / selection layer, not as another decision
engine. The clean contract is: Factor discovers and proposes -> candidate
agent/service/counterparty/coverage provider -> includes economic
terms/availability/relevant identifiers -> MoneyPenny evaluates whether that
candidate can participate -> Aegis supplies the independent admission/trust
evidence -> only then does the multi-party Vela path proceed. For this pass,
I'd keep Factor's scope to three things: candidate discovery,
service/counterparty selection, and construction of a deterministic
selection artifact that MoneyPenny can bind into the request/receipt
chain."*

## 1. Critical disambiguation

`services/factor/useCaseZeroOrchestrator.ts` ALREADY EXISTS in this repo
(built 2026-09-06, an earlier, unrelated session) and is a COMPLETELY
DIFFERENT "Use Case Zero": an agent-onboarding/readiness bootstrap state
machine (agentShell -> didqubeContainer -> ownerWallet -> settlementWallet ->
passport -> delegationAuthority -> pulsePnl -> aegisAssessment ->
moneypennyAdmission -> bankrBinding -> velaReadiness -> runtimeActivation ->
governedOperationRehearsal), keyed on long-lived `factor_cases` rows with
their own state machine. It shares vocabulary (Factor, Aegis, MoneyPenny,
Vela, "Use Case Zero") with THIS item's own domain but is NOT the same
artifact — the exact naming-collision scenario CLAUDE.md's Adversarial
Research Review section warns against for research publication, applied
here to engineering code. **This item does not modify, import from, or key
on `useCaseZeroOrchestrator.ts`, `factorCaseService.ts`, or the
`factor_cases` state machine.** THIS item's "Use Case Zero" is the
multi-party confidential underwriting demo
(`docs/vela/accelerator/constitutional-financial-services/
05_ACCELERATOR_USE_CASE_ZERO_SPEC_v0.1.md`): Party A/B private state ->
joint-compute scope -> confidential risk verdict -> underwriting quote
(item 5) -> risk telemetry (item 6) -> Factor candidate selection (this
item, 7).

## 2. Preflight

Reviewed before writing any code:

- `services/vela/velaUnderwritingProjection.ts` and
  `services/financialServices/providers/underwriting/underwritingProviderTypes.ts`
  in full — the structural-privacy discipline (a function's own parameter
  TYPE has no place for raw party financial data, proven by a
  `@ts-expect-error` gate test) this item's `FactorSelectionInput` mirrors
  exactly.
- `services/horizen/registrableAgents.ts` in full — the ONLY real,
  non-speculative candidate-agent registry (`REGISTRABLE_AGENTS`) this item
  resolves against; confirmed `resolveRegistrableAgent`/
  `listRegistrableAgents` are the correct, existing lookup primitives rather
  than building a second registry.
- `services/receipts/activityReceiptService.ts` and
  `services/dvn/activityReceiptDvnPipeline.ts` in full — the canonical
  receipt writer and the ONE permitted unilateral DVN-file change
  (`ANCHORABLE_ACTION_TYPES` addition).
- `supabase/migrations/20261001000700_vela_underwriting_projection_receipt_type.sql`
  in full — the migration-rebuild pattern this item's own migration mirrors.
- `tests/persona-spine-fetch.test.ts` and `tests/_lib/sourceAuthority.ts` in
  full — the AST-based `importAuthority`/`forbiddenImportFindings`
  import-boundary technique this item's own canary reuses rather than a
  comment-fooled raw-string grep.
- `tests/vela-underwriting-projection.test.ts` and
  `tests/underwriting-provider-simulated.test.ts` — the `vi.mock` pattern for
  `createActivityReceipt` and the gate-1 `@ts-expect-error` test shape this
  item's own tests mirror.
- Resolution records reviewed: `RES-2026-09-13-VELA-UNDERWRITING-VERTICAL-SLICE-001`
  and `RES-2026-09-13-VELA-RISK-INVARIANT-TELEMETRY-HOOK-001` and their
  candidate invariants — this item's own candidate is parented to the latter.
- Unresolved risk this item does NOT invalidate, duplicate, bypass, or
  regress: items 5-6's own gates and telemetry hook (both suites pass
  unchanged), and `useCaseZeroOrchestrator.ts`'s own unrelated readiness
  pipeline (its own two test files, 79 tests total, confirmed unchanged).

## 3. What was built

### New file — `services/factor/factorSelectionArtifact.ts`

Exports `FactorCandidateProviderMode`, `FactorSelectionInput`,
`FactorSelectionArtifact`, `proposeFactorSelection` (pure — no DB, no
receipt, no network call), `RecordFactorSelectionParams`, and
`recordFactorSelection` (writes the one causal receipt).

`proposeFactorSelection` resolves `candidateAgentSlug` via
`resolveRegistrableAgent` and throws — never invents an id — for an
unrecognised slug. `providerMode` is hardcoded `'SIMULATED'` and is NOT an
input field at all (no LIVE candidate-discovery provider exists anywhere in
this codebase). `selectionRef` is a deterministic 16-char sha256 commitment
over `(requestRef, resolved candidateAgentId)` — the same HMS-locker-ref
recipe shape CLAUDE.md's own worked example uses. `quotedTermsRef` is a
FULL 64-char sha256 hex digest over any caller-supplied `rawQuotedTerms`
(mirroring `commitMultiPartyPayload`'s own full-digest choice in
`velaUnderwritingProjection.ts`), and is `null` — never fabricated — when no
terms are supplied; `rawQuotedTerms` itself never appears on the returned
artifact.

`recordFactorSelection` calls `createActivityReceipt` directly (never the
`constitutionalCommerce` apparatus) with `actionType:
'factor_selection_proposed'` and `actionInput` bound to the artifact
VERBATIM — it is already privacy-safe by construction.

### Six invariants and how each is enforced

1. **"Factor may recommend, but must not confer constitutional authority."**
   Import boundary: no import from `services/factor/authorityChain.ts`,
   `services/delegation/*`, `services/access/evaluateAccess.ts`, or
   `services/identity/getActivePersona.ts`.
2. **"Factor may select candidates, but must not bypass Aegis admission."**
   Import boundary: no import from `services/aegis/*`. Aegis integration is
   explicitly the NEXT item.
3. **"Factor's economic terms must be treated as inputs/evidence, not
   trusted truth."** `quotedTermsRef` commitment, never verbatim storage.
4. **"Any selected party/provider must be bound into the transaction
   context before the consequence/risk envelope is frozen."** Explicitly
   deferred — this item produces the artifact only; binding it into
   `buildVelaMultiPartyProjectionRequest` is the NEXT item's job.
5. **"Factor must not gain access to confidential operands merely because
   it assembled the transaction."** Structural: `FactorSelectionInput` has
   no field shape for raw party financial inputs — proven by a
   `@ts-expect-error` gate test.
6. **"Factor's selection artifact should be receiptable and traceable into
   the final causal chain."** The new `'factor_selection_proposed'` receipt
   type, DVN-anchorable.

Also enforced (operator, explicitly): Factor never calls the underwriting
provider or the Vela multi-party wiring directly — no import from
`services/vela/velaMultiPartyProjection.ts`,
`services/vela/velaUnderwritingProjection.ts`, or
`services/financialServices/providers/underwriting/*`. This module is NOT
wired into `velaUnderwritingProjection.ts` in this pass.

### Receipt type + DVN + migration

Added `'factor_selection_proposed'` to `ActivityActionType`
(`services/receipts/activityReceiptService.ts`) and to
`ANCHORABLE_ACTION_TYPES` (`services/dvn/activityReceiptDvnPipeline.ts`, the
ONE permitted unilateral change to that file). Added
`supabase/migrations/20261001000800_factor_selection_proposed_receipt_type.sql`,
rebuilding `activity_receipts_action_type_check` wholesale (carried forward
verbatim from `20261001000700` plus this one new entry).

## 4. Test changes

### New file — `tests/factor-selection-artifact.test.ts` (18 tests)

- Structural privacy gate (`@ts-expect-error`) — `FactorSelectionInput`
  cannot accept an object shaped like raw party financial inputs.
- `providerMode` is always `'SIMULATED'` and not caller-settable (a second
  `@ts-expect-error` gate proving `providerMode` is not an input field).
- `selectionRef` determinism: same `(requestRef, candidateAgentSlug)` pair
  -> same ref; a different `requestRef` or `candidateAgentSlug` -> a
  different ref.
- `quotedTermsRef` commitment discipline: omitted -> `null`; supplied ->
  64-char hex; two different terms objects -> two different refs; never
  present as a field on the artifact itself.
- Unknown candidate slug refuses cleanly (throws, never invents an id).
- `evidenceRefs` defaults to `[]` when omitted; preserved verbatim when
  supplied.
- `recordFactorSelection` writes exactly one receipt of the correct
  `actionType`/`personaId`/`agentsInvoked`, binding the artifact verbatim as
  `actionInput`, plus a dedicated leak-check test confirming no
  `rawQuotedTerms`/T0 identifier/raw financial figure reaches the receipt.
- Two import-boundary tests: a stripped-source grep for the forbidden
  specifiers, and an AST-based `importAuthority`/`forbiddenImportFindings`
  check (`tests/_lib/sourceAuthority.ts`) confirming no forbidden BINDING
  (not just specifier string) is reachable via named, namespace, or dynamic
  import.

## 5. Verification

- `npx vitest run tests/factor-selection-artifact.test.ts` — **18/18
  passed**.
- `npx vitest run tests/vela-*.test.ts
  tests/underwriting-provider-simulated.test.ts
  tests/factor-vela-confidential-workload.test.ts
  tests/activity-receipts-action-type-parity.test.ts
  tests/factor-selection-artifact.test.ts` (14 files) — **213 passed + 2
  skipped (215 total)**, exactly the prior item's own recorded baseline (195
  passed + 2 skipped, 13 files) plus this item's +18 additive tests in one
  new file, every pre-existing file's own pass/skip count unchanged.
- `npx vitest run tests/use-case-zero-orchestrator.test.ts
  tests/use-case-zero-readiness-corrections.test.ts` — **79/79 passed**,
  confirming the UNRELATED, untouched `useCaseZeroOrchestrator.ts` was never
  touched by this item.
- `npx tsc --noEmit` — zero new errors attributable to any file this item
  touched.

## 6. Resolution → Invariant Loop

- `codexes/packs/agentiq/resolution-records/records/RES-2026-09-13-FACTOR-SELECTION-ARTIFACT-001.json`
- `codexes/packs/agentiq/resolution-records/candidate-invariants/CI-2026-09-13-FACTOR-SELECTION-NEVER-CONSEQUENTIAL-001.json`
  (status `candidate` — never self-ratified)

## 7. Explicitly out of scope for this item

Aegis admission-evidence integration; MoneyPenny binding this artifact into
`velaUnderwritingProjection.ts`'s request construction; any change to
`useCaseZeroOrchestrator.ts`/`factorCaseService.ts`; any live/external
candidate-agent registry or scoring/ranking logic; any UI/demo surface; any
change to `velaUnderwritingProjection.ts` or `velaMultiPartyProjection.ts`
themselves.
