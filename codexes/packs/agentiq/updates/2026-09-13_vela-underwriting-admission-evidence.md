# Vela Underwriting Admission Evidence — Use Case Zero Build-Order Item 8

**Date:** 13 September 2026
**Status:** Implemented, tested, committed locally (not pushed).
**Scope:** Aegis admission-evidence integration on top of Factor's candidate
selection artifact (`services/factor/factorSelectionArtifact.ts`, item 7):
consume the Factor selection artifact, resolve the selected candidate
against Aegis's EXISTING assessment/admission machinery, produce a
deterministic Aegis Admission Evidence artifact — nothing more.

Operator ruling, verbatim: *"The clean role is: Factor proposes
participation; Aegis determines admissibility; MoneyPenny decides whether
the workflow may proceed. Aegis should remain an independent assessment
membrane, not become the authority source and not replace the constitutional
mandate. I'd keep this pass narrow and explicit: Consume the Factor
selection artifact as an input. Resolve the selected candidate against the
existing Aegis assessment/admission machinery. Produce a deterministic Aegis
Admission Evidence artifact bound to selectionRef + requestRef + candidate +
service/capability + assessment version. Fail closed if assessment is
missing, stale, contradictory, unresolved, or below the required admission
threshold. Do not expose confidential underwriting inputs to Aegis unless a
later, explicitly scoped assessment requires them. Do not let Aegis call
Vela, settlement, or the underwriting provider directly. Do not let 'Aegis
admitted' imply human authority, mandate, or permission to transact."* The
core distinction, verbatim: *"Factor says 'this is a candidate worth
considering.' Aegis says 'this candidate is admissible under these trust
conditions.' metaMe/MoneyPenny determines whether this exact consequential
interaction is authorized now."*

## 1. Critical disambiguation (three collisions, not one)

1. `services/factor/useCaseZeroOrchestrator.ts` is a DIFFERENT, pre-existing,
   case-scoped agent-onboarding readiness state machine. Its own
   `stepAegisAssessment` creates Aegis assessments for `subjectType:
   'factor_case'` — a DIFFERENT assessment lineage than the one THIS item
   reads (`subjectType: 'agent'`, keyed on the candidate's own runtime agent
   id). This item does not modify, import from, or key on that orchestrator.
2. `services/marketa/admissionAssessmentEngine.ts` /
   `admissionAssessmentRunner.ts` / `admissionAssessmentStore.ts` are ALSO a
   different, unrelated admission-assessment system (Marketa eligibility) —
   `services/aegis/aegisAssessmentService.ts`'s own header already documents
   this distinction. Not touched or reused.
3. "Admission" here means Aegis's OWN `AegisDecision` vocabulary
   (admissible / admissible_with_conditions / insufficient_evidence /
   not_admissible), never MoneyPenny's separate authorization/mandate
   decision (`services/moneypenny/admissionAuthority.ts::decideAdmission`) —
   never called, imported, or approximated here.

Per the operator's explicit naming instruction, the new module is named
under the `velaUnderwriting*` family (alongside `velaUnderwritingProjection
.ts` and `velaUnderwritingRiskTelemetry.ts`) — NOT under `services/aegis/`
and NOT a second `UseCaseZero*` symbol.

## 2. Preflight

Reviewed before writing any code:

- `services/factor/factorSelectionArtifact.ts` in full — item 7's own
  shape (a pure "compose" function paired with a separate "record" function
  that writes the one receipt), structural-privacy discipline
  (`@ts-expect-error` gates), and import-boundary testing technique, which
  this item's design deliberately mirrors.
- `services/aegis/aegisAssessmentService.ts` in full — the state machine
  (draft -> evidence_locked -> running -> review_required -> ratified |
  failed), the decision vocabulary, `getCurrentAssessment`/`listFindings`
  (the ONLY two functions this item calls), and the existing, already
  subject-generic `AegisSubjectType` (`'factor_case' | 'agent' |
  'token_launch'`) — confirmed `'agent'` already fits this item's need with
  no schema widening.
- Confirmed (by search) that no code path in this repo today creates an
  `'agent'`-subject-type assessment — so `getCurrentAssessment(admin,
  'agent', candidateAgentId)` returning `null` is expected and correct in
  the common case, not a bug to work around.
- Resolution records reviewed: `RES-2026-09-13-FACTOR-SELECTION-ARTIFACT-001`
  and its candidate invariant `CI-2026-09-13-FACTOR-SELECTION-NEVER-CONSEQUENTIAL-001`
  — this item's own candidate is parented to it.
- Unresolved risk this item does NOT invalidate, duplicate, bypass, or
  regress: item 7's own gates (unchanged), `aegisAssessmentService.ts`
  itself and every test file covering it (six files, all confirmed
  unchanged), and `useCaseZeroOrchestrator.ts`'s own unrelated readiness
  pipeline (both its test files, 79 tests total, confirmed unchanged).

## 3. What was built

### New file — `services/vela/velaUnderwritingAdmissionEvidence.ts`

Exports `AegisAdmissionStatus`, `UnderwritingAdmissionEvidenceInput`,
`AegisAdmissionTrustSummary`, `AegisAdmissionEvidence`,
`DEFAULT_MAX_ASSESSMENT_AGE_MS` (24 hours),
`composeUnderwritingAdmissionEvidence` (READ-ONLY — calls only
`getCurrentAssessment`/`listFindings`, no DB write, no receipt),
`RecordUnderwritingAdmissionEvidenceParams`, and
`recordUnderwritingAdmissionEvidence` (writes the one causal receipt).

`composeUnderwritingAdmissionEvidence` reads `candidateAgentId`,
`selectionRef`, and `requestRef` from `input.factorSelection` verbatim —
there is no second, independently-suppliable candidate field. It resolves
`getCurrentAssessment(admin, 'agent', candidateAgentId)` and branches:

- **No assessment** -> `UNRESOLVED`.
- **Not yet ratified** (draft/evidence_locked/running/review_required) ->
  `UNRESOLVED`, with `assessmentRef`/`assessmentVersion` populated but
  `freshnessMs` null.
- **`state === 'failed'`** -> `UNRESOLVED` (never `REFUSED` — a process
  failure is not a substantive admissibility judgment).
- **Ratified but stale** (older than `maxAssessmentAgeMs`, checked BEFORE
  reading findings) -> `UNRESOLVED`.
- **Ratified, fresh, contradictory** (admissible decision + a critical
  failed finding — re-verified independently as defense-in-depth even
  though `ratifyAssessment` already refuses this combination at write time)
  -> `UNRESOLVED`.
- **Ratified, fresh, consistent** -> maps `assessment.decision` directly:
  `admissible`/`admissible_with_conditions` -> `ADMITTED`; `not_admissible`
  -> `REFUSED`; `insufficient_evidence` -> `UNRESOLVED`.

`admissionRef` is a deterministic 16-char sha256 commitment over
`(selectionRef, requestRef, candidateAgentId, assessmentRef,
assessmentVersion)` — the same commitment-recipe shape item 7's own
`selectionRef` uses.

`recordUnderwritingAdmissionEvidence` calls `createActivityReceipt` directly
(never `constitutionalCommerce`) with `actionType:
'vela_underwriting_admission_evidence_composed'` and `actionInput` bound to
the evidence object VERBATIM.

### Ten invariants and how each is enforced (or explicitly deferred)

1. **Unknown Factor candidate cannot be silently substituted.** Structural:
   `UnderwritingAdmissionEvidenceInput` has exactly one candidate-naming
   field (`factorSelection`); no second field exists.
2. **Stale or missing Aegis evidence resolves UNRESOLVED.** The
   missing-assessment branch + the freshness check.
3. **ADMITTED does not confer authority or mandate.** This artifact is
   evidence only; no call to or approximation of
   `decideAdmission`. Binding an ADMITTED artifact into a frozen envelope is
   explicitly deferred to a later item.
4. **Aegis cannot bypass MoneyPenny's consequence/risk path.** Import
   boundary: no import from `velaMultiPartyProjection.ts`,
   `velaUnderwritingProjection.ts`, `services/financialServices/providers
   /underwriting/*`, or `services/moneypenny/admissionAuthority.ts`.
5. **Factor cannot self-certify its own candidate.** Already enforced
   UPSTREAM by `aegisAssessmentService.ts`'s own `createAssessment`
   self-assessment refusal — this module only reads, never creates.
6. **Assessment version/freshness is bound into the artifact.**
   `assessmentVersion`/`effectiveAt`/`freshnessMs` always populated when an
   assessment exists.
7. **Only an ADMITTED artifact may be bound into the frozen envelope.** NOT
   enforced here — explicitly deferred.
8. **The final causal receipt references both artifacts.** This item's own
   receipt binds `selectionRef`/`requestRef` (via the evidence object); a
   later item's own final receipt is expected to additionally reference
   `admissionRef`.
9. **No confidential underwriting inputs exposed to Aegis.** Structural: no
   field shape for raw party financial inputs.
10. **Aegis cannot call Vela/settlement/the underwriting provider directly.**
    Same import-boundary proof as invariant 4; `aegisAssessmentService.ts`
    itself (unmodified) already has no such imports either.

### Receipt type + DVN + migration

Added `'vela_underwriting_admission_evidence_composed'` to
`ActivityActionType` (`services/receipts/activityReceiptService.ts`) and to
`ANCHORABLE_ACTION_TYPES` (`services/dvn/activityReceiptDvnPipeline.ts`, the
ONE permitted unilateral change to that file). Added
`supabase/migrations/20261001000900_vela_underwriting_admission_evidence_receipt_type.sql`,
rebuilding `activity_receipts_action_type_check` wholesale (carried forward
verbatim from `20261001000800` plus this one new entry).

## 4. Test changes

### New file — `tests/vela-underwriting-admission-evidence.test.ts` (26 tests)

- Structural privacy gate (`@ts-expect-error`).
- Candidate-substitution gates: a behavioural check that the composed
  evidence's `candidateAgentId` always equals
  `factorSelection.candidateAgentId`, plus a `@ts-expect-error` gate proving
  the input type has no second candidate-naming field.
- Missing-assessment -> `UNRESOLVED` with every assessment-derived field
  honestly null/empty.
- Parameterised not-yet-ratified case (`draft`/`evidence_locked`/`running`/
  `review_required`) -> `UNRESOLVED`.
- `state === 'failed'` -> `UNRESOLVED` (never `REFUSED`).
- Ratified `admissible` / `admissible_with_conditions` -> `ADMITTED`.
- Ratified `not_admissible` -> `REFUSED`.
- Ratified `insufficient_evidence` -> `UNRESOLVED`.
- Ratified but contradictory (critical fail + admissible) -> `UNRESOLVED`.
- Freshness-discipline block: stale, exactly-at-boundary, just-under-
  boundary, and two custom-`maxAssessmentAgeMs`-override cases — all via a
  `Date.now` spy for a fixed "now" rather than real wall-clock timing.
- `admissionRef` determinism: same tuple -> same ref; a different mocked
  `assessment_id` -> a different ref.
- Receipt-write correctness + `activeCartridge` default + leak-check triple.
- Two import-boundary tests (stripped-source grep + AST-based
  `importAuthority`/`forbiddenImportFindings` check).

## 5. Verification

- `npx vitest run tests/vela-underwriting-admission-evidence.test.ts` —
  **26/26 passed**.
- `npx vitest run tests/vela-*.test.ts
  tests/underwriting-provider-simulated.test.ts
  tests/factor-vela-confidential-workload.test.ts
  tests/activity-receipts-action-type-parity.test.ts
  tests/factor-selection-artifact.test.ts
  tests/use-case-zero-orchestrator.test.ts
  tests/use-case-zero-readiness-corrections.test.ts` (17 files) — **318
  passed + 2 skipped (320 total)**, exactly the prior item's own recorded
  baseline (292 passed + 2 skipped, 16 files) plus this item's +26 additive
  tests in one new file, every pre-existing file's own pass/skip count
  unchanged.
- `npx vitest run tests/aegis-assessment-service.test.ts
  tests/bankr-governance-invariants.test.ts tests/token-launch-service.test.ts
  tests/bankr-capability-handlers.test.ts
  tests/factor-authority-and-admission.test.ts tests/bankr-api-routes.test.ts`
  — **93/93 passed**, confirming every test file covering
  `aegisAssessmentService.ts` was unaffected.
- `npx tsc --noEmit` — zero new errors attributable to any file this item
  touched.

## 6. Resolution → Invariant Loop

- `codexes/packs/agentiq/resolution-records/records/RES-2026-09-13-VELA-UNDERWRITING-ADMISSION-EVIDENCE-001.json`
- `codexes/packs/agentiq/resolution-records/candidate-invariants/CI-2026-09-13-AEGIS-ADMISSION-EVIDENCE-INDEPENDENT-MEMBRANE-001.json`
  (status `candidate` — never self-ratified; `parentCandidateId` points at
  item 7's own candidate, `CI-2026-09-13-FACTOR-SELECTION-NEVER-CONSEQUENTIAL-001`)

## 7. Explicitly out of scope for this item

Actually binding a selection+admission pair into
`buildVelaMultiPartyProjectionRequest`/MoneyPenny's frozen envelope;
MoneyPenny's own `decideAdmission` call or any authorization logic;
creating/driving new Aegis assessments (this item only reads existing
ones); any UI/demo surface; QubeTalk/iQube disclosure-authorization wiring;
any change to `useCaseZeroOrchestrator.ts`, `factorCaseService.ts`,
`aegisAssessmentService.ts`, `velaMultiPartyProjection.ts`, or
`velaUnderwritingProjection.ts` themselves.
