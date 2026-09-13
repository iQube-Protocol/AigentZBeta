# Vela Underwriting Composition Gate — Use Case Zero Build-Order Item 9

**Date:** 13 September 2026
**Status:** Implemented, tested, committed locally (not pushed).
**Scope:** MoneyPenny Constitutional Composition Gate — consumes the Factor
selection artifact (item 7), Aegis admission evidence (item 8), and a new
Tier-1 QubeTalk/iQube disclosure authorization, and only then
constructs/freezes the multi-party Vela request. Realizes the full sequence:
Factor selection -> Aegis admission -> QubeTalk/iQube disclosure
authorization -> MoneyPenny composition gate -> frozen multi-party
consequence/risk envelope -> Vela submission.

Operator ruling, verbatim: *"Right now the pieces are individually correct
but the causal chain is not yet actually enforced end-to-end. [...] The next
item should be: MoneyPenny Constitutional Composition Gate. Its job is
narrow: consume the existing Factor selection artifact + Aegis admission
evidence + QubeTalk/iQube disclosure authorization and only then
construct/freeze the multi-party Vela request. [...] The hard gates I'd
require are: Factor selection and Aegis admission must reference the same
candidate/request context. Only ADMITTED Aegis evidence may proceed.
Missing/stale/contradictory evidence resolves UNRESOLVED. QubeTalk/iQube
disclosure scope must authorize the exact parties, request, computation and
output class. COMPUTE_WITH and DISCLOSE_TO remain separate at this layer
too. MoneyPenny must bind the Factor/Aegis/disclosure evidence refs into the
frozen envelope before Vela submission. No later stage may swap the
candidate, parties, scope or operation after freeze. The final causal
receipt must reference the Factor selection, Aegis admission, disclosure
authorization and Vela execution evidence. And yes, QubeTalk/iQube
disclosure authorization should be part of this backend item, not deferred
again. We already have the guest-side disclosure semantics; this step should
bind the real upstream authorization artifact into that wire format."*

## 1. Critical disambiguation (two collisions, both pre-investigated)

1. `services/factor/useCaseZeroOrchestrator.ts` and
   `services/moneypenny/admissionAuthority.ts` are a DIFFERENT, pre-existing,
   case-scoped (`factor_cases`) agent-onboarding readiness flow. Neither this
   item's disclosure-authorization module nor its composition gate calls,
   imports, or approximates `decideAdmission` — "MoneyPenny" in this item's
   own name refers to the composition-gate role the governing architecture
   doc assigns for the request-scoped underwriting flow.
2. `services/qubetalk/disclosurePolicy.ts` (`evaluateDisclosure`/
   `isDisclosableTo`) is ALSO a different, unrelated concept — which pieces
   of CONVERSATION CONTEXT may be surfaced to which audience in QubeTalk
   messaging. This item's disclosure authorization is a FINANCIAL-COMPUTATION
   scope authorization (which parties may `COMPUTE_WITH`/`DISCLOSE_TO` which
   output, for which specific request) — a different concept entirely, never
   extended from that module.

Governing architecture doc:
`docs/vela/accelerator/constitutional-financial-services/03_MONEYPENNY_DISCLOSURE_AND_RISK_ARCHITECTURE_v0.1.md`
(§9's flow: Factor discovery -> Aegis admission -> metaMe authority +
MoneyPenny mandate -> Tier 1 QubeTalk/iQube collaborative disclosure -> Tier
2 bounded confidential contributions -> MoneyPenny minimization + risk
decomposition + frozen snapshot -> Tier 3 Consequence Envelope -> Vela
MoneyPenny Kernel -> ... -> causal receipt). This item builds Tier 1
(disclosure authorization) and the MoneyPenny minimization/freeze step (Tier
3 envelope construction), reusing the ALREADY-BUILT Tier-3 wire format
(`VelaMultiPartyDisclosureScope`) rather than inventing a new one.

## 2. Preflight

Reviewed before writing any code:

- `services/vela/velaMultiPartyProjection.ts`,
  `services/vela/velaUnderwritingProjection.ts`,
  `services/factor/factorSelectionArtifact.ts`, and
  `services/vela/velaUnderwritingAdmissionEvidence.ts` in full.
- Confirmed by reading `factorSelectionArtifact.ts`'s own field list that
  `FactorSelectionArtifact` carries **no `applicationId` field** —
  `applicationId` is an input to `proposeFactorSelection` but does not
  survive onto the artifact. This shaped the composition gate's own
  cross-reference design (see "the applicationId caveat" below) rather than
  being assumed away.
- Resolution records reviewed: `RES-2026-09-13-FACTOR-SELECTION-ARTIFACT-001`
  and `RES-2026-09-13-VELA-UNDERWRITING-ADMISSION-EVIDENCE-001`, and their
  candidate invariants (`CI-2026-09-13-FACTOR-SELECTION-NEVER-CONSEQUENTIAL-001`,
  `CI-2026-09-13-AEGIS-ADMISSION-EVIDENCE-INDEPENDENT-MEMBRANE-001`) — both
  explicitly deferred the binding this item performs; this item's own
  candidate is parented to the latter.
- Unresolved risk this item does NOT invalidate, duplicate, bypass, or
  regress: items 5-8's own gates (all four source files confirmed unchanged
  by `git diff`), `aegisAssessmentService.ts` and every test file covering it
  (confirmed unaffected), and `services/moneypenny/admissionAuthority.ts`'s
  own test coverage (confirmed unaffected).

## 3. What was built

### New file — `services/vela/velaUnderwritingDisclosureAuthorization.ts`

The Tier-1 QubeTalk/iQube act. Exports
`VelaUnderwritingDisclosureAuthorizationInput`,
`VelaUnderwritingDisclosureAuthorization`, `authorizeUnderwritingDisclosure`
(pure — validates via the EXISTING `assertValidVelaMultiPartyDisclosureScope`
from `velaMultiPartyProjection.ts`, reused verbatim, then stamps a
deterministic 16-char sha256 `authorizationRef` commitment over
`(selectionRef, requestRef, applicationId, scope)`), and
`recordUnderwritingDisclosureAuthorization` (writes the one causal receipt
via `createActivityReceipt` directly).

This wraps the ALREADY-BUILT, guest-wire-exact `VelaMultiPartyDisclosureScope`
in a receiptable, provenance-bound authorization record — WHO authorized
this exact scope, for WHICH selection/request, grounded in WHAT evidence
(`evidenceRefs` — opaque QubeTalk/iQube references, never fabricated when
absent). It does not invent a second scope shape.

### New file — `services/vela/velaUnderwritingCompositionGate.ts`

`composeUnderwritingEnvelope(input): ComposeUnderwritingEnvelopeResult` (pure
— no I/O), in order:

1. **Gate 1** (operator: "Factor selection and Aegis admission must
   reference the same candidate/request context") — throws
   `VelaCompositionError('selection-admission-mismatch')` on any
   `selectionRef`/`requestRef`/`candidateAgentId` disagreement.
2. **Gate 2** — throws `VelaCompositionError('selection-disclosure-mismatch')`
   on a `selectionRef`/`requestRef` disagreement between the Factor selection
   and the disclosure authorization. Limited to those two fields — see "the
   applicationId caveat" below.
3. **Gate 3** (operator: "QubeTalk/iQube disclosure scope must authorize the
   exact parties, request, computation and output class") — REUSES (never
   reimplements) `assertVelaMultiPartyScopeBindingMatchesContext` from
   `velaMultiPartyProjection.ts`.
4. **Gate 4** (operator: "Only ADMITTED Aegis evidence may proceed") —
   returns `{ outcome: 'BLOCKED', blockedReason }` (never a throw) for a
   correctly-paired but non-`ADMITTED` candidate.
5. **Freeze** (operator: "MoneyPenny must bind the Factor/Aegis/disclosure
   evidence refs into the frozen envelope") — a deterministic 16-char sha256
   `envelopeRef` over `(selectionRef, admissionRef,
   disclosureAuthorizationRef, requestRef)`, returned as a
   `FrozenUnderwritingEnvelope`.

`submitFrozenUnderwritingEnvelope(params): Promise<SubmitFrozenUnderwritingEnvelopeResult>`
is the ONE authorized, effectful consumer of an already-frozen envelope.
Its signature accepts `envelope: FrozenUnderwritingEnvelope` as the ONLY
source of `applicationId`/`requestRef`/`scope`/`candidateAgentId` — there is
no second parameter for any of these, making "no later stage may swap...
after freeze" (operator's gate 7) a structural property of this function's
own type, not merely a discipline. Calls the EXISTING, UNMODIFIED
`runVelaUnderwritingProjection` (item 5) with the frozen fields, then writes
ONE final `vela_underwriting_envelope_frozen` receipt binding all four
evidence classes the operator named (operator's gate 8): `selectionRef`,
`admissionRef`, `disclosureAuthorizationRef`, and the Vela execution
evidence (`onChainRequestId`/`disposition`/`providerMode`/
`veloProjectionReceiptId`/`telemetryRecordId`).

### The applicationId caveat

`FactorSelectionArtifact` carries no `applicationId` field (confirmed by
reading `factorSelectionArtifact.ts` in full). `AegisAdmissionEvidence`
carries none either. The ONLY artifact in this chain that carries an
`applicationId` ground truth is `VelaUnderwritingDisclosureAuthorization`
itself. Per CLAUDE.md's No-Guessing rule, gate 2's cross-reference is
therefore limited to `selectionRef`/`requestRef` (the fields that actually
exist on both sides), and gate 3's call to
`assertVelaMultiPartyScopeBindingMatchesContext` uses the disclosure
authorization's own `applicationId` as ground truth — proving the
authorization's declared `applicationId` agrees with its own embedded
`scope.binding.applicationId` (a real, useful internal-consistency check),
but NOT a Factor-side cross-check, because no such ground truth exists to
check against. Documented explicitly in both files' own headers rather than
silently assumed away.

### BLOCKED vs THROW

A mismatch between artifacts that were never meant to be paired is a
caller/integrity defect and THROWS `VelaCompositionError`. A non-`ADMITTED`
status for a CORRECTLY-paired candidate is a normal, expected epistemic
outcome and resolves `{ outcome: 'BLOCKED' }`, never a throw.

### Receipt types + DVN + migration

Added `'vela_underwriting_disclosure_authorized'` and
`'vela_underwriting_envelope_frozen'` to `ActivityActionType` (services/
receipts/activityReceiptService.ts) and to `ANCHORABLE_ACTION_TYPES`
(services/dvn/activityReceiptDvnPipeline.ts, the ONE permitted unilateral
change to that file). Added
`supabase/migrations/20261001001000_vela_underwriting_composition_gate_receipt_types.sql`,
rebuilding `activity_receipts_action_type_check` wholesale (carried forward
verbatim from `20261001000900` plus these two new entries).

## 4. Test changes

### New file — `tests/vela-underwriting-disclosure-authorization.test.ts` (16 tests)

Scope-validation reuse (missing grants array, invalid action value, missing
binding, explicit-empty-grants accepted); `authorizationRef` determinism
across (selectionRef, requestRef, applicationId, scope); `evidenceRefs`
defaults; a receipt-write correctness + `activeCartridge`-default +
leak-check triple; import-boundary tests (forbidding the submission
substrate, Aegis, authority/delegation/access/identity, and
`services/qubetalk/disclosurePolicy`) plus a positive assertion that the
file DOES import the reused scope validator.

### New file — `tests/vela-underwriting-composition-gate.test.ts` (18 tests)

Built on REAL upstream constructors (`proposeFactorSelection`,
`authorizeUnderwritingDisclosure`) wherever one exists, with
`runVelaUnderwritingProjection` mocked. One describe block per gate: gate 1
(three mismatch cases, each naming its own field); gate 2 (two mismatch
cases); gate 3 (an applicationId disagreement and a requestRef
disagreement, both propagated from the reused substrate assertion); gate 4
(UNRESOLVED and REFUSED both resolve BLOCKED naming the status; ADMITTED
resolves FROZEN with every field populated verbatim); `envelopeRef`
determinism; a `submitFrozenUnderwritingEnvelope` block proving the scope
object passed into the mocked `runVelaUnderwritingProjection`'s
`build.scope` is the EXACT SAME (`toBe`) object as `envelope.scope` (gate
7's referential-identity proof), a full-receipt-binding assertion, and a
leak-check; import-boundary tests proving the file both DOES import
`runVelaUnderwritingProjection` (positive assertion — deliberately different
from every prior item's own all-forbidding discipline) and never imports
Aegis/authority/delegation/MoneyPenny-admission-authority/qubetalk-chat-
disclosure paths.

## 5. Verification

- `npx vitest run tests/vela-underwriting-disclosure-authorization.test.ts
  tests/vela-underwriting-composition-gate.test.ts` — **34/34 passed**
  (16 + 18).
- `npx vitest run tests/vela-*.test.ts
  tests/underwriting-provider-simulated.test.ts
  tests/factor-vela-confidential-workload.test.ts
  tests/activity-receipts-action-type-parity.test.ts
  tests/factor-selection-artifact.test.ts
  tests/use-case-zero-orchestrator.test.ts
  tests/use-case-zero-readiness-corrections.test.ts` (19 files) — **352
  passed + 2 skipped (354 total)**, exactly the prior item's own recorded
  baseline (318 passed + 2 skipped, 17 files) plus this item's +34 additive
  tests across two new files, every pre-existing file's own pass/skip count
  unchanged.
- `npx vitest run tests/aegis-assessment-service.test.ts
  tests/factor-authority-and-admission.test.ts` — **31/31 passed**,
  confirming `aegisAssessmentService.ts` and
  `services/moneypenny/admissionAuthority.ts`'s own test coverage both
  unaffected.
- `git diff <base>..HEAD --stat` confirms zero changes to
  `velaUnderwritingProjection.ts`, `velaMultiPartyProjection.ts`,
  `factorSelectionArtifact.ts`, and `velaUnderwritingAdmissionEvidence.ts` —
  this item only ever imports from them.
- `npx tsc --noEmit` — zero new errors attributable to any file this item
  touched.

## 6. Resolution → Invariant Loop

- `codexes/packs/agentiq/resolution-records/records/RES-2026-09-13-VELA-UNDERWRITING-COMPOSITION-GATE-001.json`
- `codexes/packs/agentiq/resolution-records/candidate-invariants/CI-2026-09-13-MONEYPENNY-COMPOSITION-GATE-BINDS-EVIDENCE-BEFORE-FREEZE-001.json`
  (status `candidate` — never self-ratified; `parentCandidateId` points at
  item 8's own candidate, `CI-2026-09-13-AEGIS-ADMISSION-EVIDENCE-INDEPENDENT-MEMBRANE-001`)

## 7. Explicitly out of scope for this item

Any UI/demo surface; a real, live QubeTalk conversation-negotiation
mechanism (this item only builds the narrow, receiptable AUTHORIZATION
ARTIFACT); risk-slice/portfolio decomposition; any change to
`useCaseZeroOrchestrator.ts`, `factorCaseService.ts`,
`aegisAssessmentService.ts`, `admissionAuthority.ts`,
`velaMultiPartyProjection.ts`, `velaUnderwritingProjection.ts`,
`factorSelectionArtifact.ts`, or `velaUnderwritingAdmissionEvidence.ts`
themselves.
