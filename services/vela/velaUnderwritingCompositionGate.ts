/**
 * Vela underwriting composition gate — Use Case Zero build-order item 9, the
 * direct sequel to item 8
 * (`services/vela/velaUnderwritingAdmissionEvidence.ts`, merged 2026-09-13).
 * Composes FOUR already-built, unmodified artifacts into a frozen envelope,
 * then submits it — the missing end-to-end enforcement step named explicitly
 * by the operator.
 *
 * OPERATOR'S OWN RULING THIS ITEM IMPLEMENTS (verbatim, 2026-09-13): "Right
 * now the pieces are individually correct but the causal chain is not yet
 * actually enforced end-to-end. [...] The next item should be: MoneyPenny
 * Constitutional Composition Gate. Its job is narrow: consume the existing
 * Factor selection artifact + Aegis admission evidence + QubeTalk/iQube
 * disclosure authorization and only then construct/freeze the multi-party
 * Vela request. The sequence should become: Factor selection -> Aegis
 * admission -> QubeTalk/iQube disclosure authorization -> MoneyPenny
 * composition gate -> frozen multi-party consequence/risk envelope -> Vela
 * submission. The hard gates I'd require are: Factor selection and Aegis
 * admission must reference the same candidate/request context. Only
 * ADMITTED Aegis evidence may proceed. Missing/stale/contradictory evidence
 * resolves UNRESOLVED. QubeTalk/iQube disclosure scope must authorize the
 * exact parties, request, computation and output class. COMPUTE_WITH and
 * DISCLOSE_TO remain separate at this layer too. MoneyPenny must bind the
 * Factor/Aegis/disclosure evidence refs into the frozen envelope before Vela
 * submission. No later stage may swap the candidate, parties, scope or
 * operation after freeze. The final causal receipt must reference the
 * Factor selection, Aegis admission, disclosure authorization and Vela
 * execution evidence."
 *
 * THE EIGHT HARD GATES, verbatim from the operator's own list, and exactly
 * where each is enforced:
 *
 *  1. "Factor selection and Aegis admission must reference the same
 *     candidate/request context." Enforced by `composeUnderwritingEnvelope`'s
 *     FIRST check: `admissionEvidence.selectionRef`/`.requestRef`/
 *     `.candidateAgentId` must all equal `factorSelection`'s own — a
 *     mismatch THROWS `VelaCompositionError('selection-admission-mismatch')`
 *     rather than silently proceeding or resolving BLOCKED, because pairing
 *     two artifacts that do not describe the same proposal is a
 *     caller/integrity defect, not an expected epistemic outcome (see
 *     "BLOCKED vs THROW" below).
 *
 *  2. "Only ADMITTED Aegis evidence may proceed." Enforced by the admission
 *     gate: `admissionEvidence.admissionStatus !== 'ADMITTED'` returns
 *     `{ outcome: 'BLOCKED', blockedReason }` — never a thrown error, never a
 *     frozen envelope.
 *
 *  3. "Missing/stale/contradictory evidence resolves UNRESOLVED." Already
 *     item 8's own job (`composeUnderwritingAdmissionEvidence`) — THIS gate
 *     only reads the resulting `admissionStatus`; gate 2 above is what turns
 *     a non-ADMITTED status (including UNRESOLVED) into a refusal to freeze.
 *
 *  4. "QubeTalk/iQube disclosure scope must authorize the exact parties,
 *     request, computation and output class." Enforced by REUSING
 *     `assertVelaMultiPartyScopeBindingMatchesContext`
 *     (`velaMultiPartyProjection.ts`) verbatim — never reimplemented. See
 *     "the applicationId caveat" below for exactly what this call can and
 *     cannot prove given the real field set of `FactorSelectionArtifact`.
 *
 *  5. "COMPUTE_WITH and DISCLOSE_TO remain separate at this layer too."
 *     Already enforced by `authorizeUnderwritingDisclosure`'s own call to
 *     `assertValidVelaMultiPartyDisclosureScope` (this item's sibling file)
 *     before a `VelaUnderwritingDisclosureAuthorization` can even exist; this
 *     gate's own `ComposeUnderwritingEnvelopeInput.disclosureAuthorization`
 *     accepts only that already-validated type, so a caller cannot construct
 *     an envelope from an unvalidated scope in the first place.
 *
 *  6. "MoneyPenny must bind the Factor/Aegis/disclosure evidence refs into
 *     the frozen envelope before Vela submission." `FrozenUnderwritingEnvelope`
 *     carries `selectionRef`, `admissionRef`, and `disclosureAuthorizationRef`
 *     as distinct, named fields — bound by `composeUnderwritingEnvelope`
 *     BEFORE `submitFrozenUnderwritingEnvelope` (the only function that talks
 *     to Vela) can ever run, because the latter's own signature accepts
 *     nothing but an already-`FrozenUnderwritingEnvelope`.
 *
 *  7. "No later stage may swap the candidate, parties, scope or operation
 *     after freeze." Enforced STRUCTURALLY, not by discipline:
 *     `submitFrozenUnderwritingEnvelope`'s signature has no second
 *     `applicationId`/`requestRef`/`scope`/`candidateAgentId` parameter — the
 *     ONLY source it reads any of those from is `params.envelope`, which was
 *     already frozen by `composeUnderwritingEnvelope`. A caller cannot pass a
 *     different scope; there is nowhere on this function's own type to put
 *     one.
 *
 *  8. "The final causal receipt must reference the Factor selection, Aegis
 *     admission, disclosure authorization and Vela execution evidence."
 *     `submitFrozenUnderwritingEnvelope`'s own receipt (`actionType:
 *     'vela_underwriting_envelope_frozen'`) binds `selectionRef`,
 *     `admissionRef`, `disclosureAuthorizationRef`, `onChainRequestId`,
 *     `disposition`, `providerMode`, `veloProjectionReceiptId`, and
 *     `telemetryRecordId` as distinct named fields — every one of the four
 *     evidence classes the operator named, plus the Vela execution result
 *     itself.
 *
 * THE APPLICATIONID CAVEAT — read before assuming gate 1/4 above cross-check
 * `applicationId` end-to-end. `FactorSelectionArtifact`
 * (`services/factor/factorSelectionArtifact.ts`) was read in full before
 * writing this file: `applicationId` is an INPUT to `proposeFactorSelection`
 * but does NOT survive onto the artifact — its real field set is
 * `selectionRef`/`requestRef`/`candidateAgentId`/`serviceId`/`counterpartyId`/
 * `providerMode`/`quotedTermsRef`/`assetContext`/`selectionReason`/
 * `evidenceRefs`/`timestamp`/`factorAgentId`, with no `applicationId`
 * anywhere on it. `AegisAdmissionEvidence` carries no `applicationId` either.
 * So the ONLY artifact in this whole chain that carries an `applicationId`
 * ground truth is `VelaUnderwritingDisclosureAuthorization` itself (a
 * required field on its own input type). Per CLAUDE.md's No-Guessing rule,
 * this file does NOT invent a cross-check against a field that does not
 * exist: gate 1's cross-reference is limited to the fields that actually
 * exist on both `factorSelection` and `admissionEvidence`
 * (`selectionRef`/`requestRef`/`candidateAgentId`); `requestRef` is the
 * shared anchor across all three inputs instead of `applicationId`. Gate 4's
 * call to `assertVelaMultiPartyScopeBindingMatchesContext` is made with
 * `disclosureAuthorization.applicationId` as the context's own applicationId
 * — this still proves a real, useful property (the authorization's declared
 * `applicationId` agrees with its own embedded `scope.binding.applicationId`,
 * an internal-consistency fact a careless caller could otherwise get wrong)
 * but it does NOT, and structurally cannot, prove that applicationId against
 * a separate Factor-side ground truth, because none exists. The frozen
 * envelope's own `applicationId` field is likewise sourced from
 * `disclosureAuthorization.applicationId` — the only place it lives.
 *
 * BLOCKED vs THROW — the deliberate distinction this file draws throughout:
 * a MISMATCH between two artifacts that were never meant to be paired (wrong
 * selectionRef/requestRef/candidateAgentId, or a scope binding that
 * disagrees with its own authorization) is a caller/integrity defect and
 * THROWS `VelaCompositionError`. A non-ADMITTED admission status for a
 * CORRECTLY-paired candidate is a normal, expected epistemic outcome — Aegis
 * legitimately refuses or cannot yet resolve candidates — and resolves
 * `{ outcome: 'BLOCKED' }`, never a throw.
 *
 * `composeUnderwritingEnvelope` is PURE (no I/O, no DB, no receipt) so "no
 * later stage may swap after freeze" is provable by unit test against a
 * plain object; `submitFrozenUnderwritingEnvelope` is the ONE authorized,
 * effectful consumer of an already-frozen envelope, and is the ONLY function
 * in this file that imports and calls `runVelaUnderwritingProjection` — kept
 * as a SEPARATE function specifically so that "no swap after freeze" is a
 * structural property of ITS OWN narrow signature, not merely a discipline
 * `composeUnderwritingEnvelope` could have been trusted to uphold if the two
 * were merged into one function.
 *
 * IMPORT-BOUNDARY DISCIPLINE — DELIBERATELY DIFFERENT FROM EVERY PRIOR ITEM
 * IN THIS CHAIN, stated explicitly so it reads as a considered choice, not an
 * oversight: this file's whole PURPOSE is to be the one authorized caller of
 * `runVelaUnderwritingProjection` for the underwriting flow, so it
 * legitimately imports it (proven POSITIVELY by
 * `tests/vela-underwriting-composition-gate.test.ts`'s own import-boundary
 * suite — an assertion that the import EXISTS, not that it is forbidden).
 * What this file still never imports: `services/aegis/aegisAssessmentService.ts`
 * (it only ever receives an already-composed `AegisAdmissionEvidence` — never
 * touches Aegis's own tables); `services/factor/authorityChain.ts`,
 * `services/delegation/*`, `services/access/evaluateAccess.ts`,
 * `services/identity/getActivePersona.ts` (no authority-conferring logic
 * here — this gate reports composition, not constitutional authority);
 * `services/moneypenny/admissionAuthority.ts` (the OTHER, case-scoped
 * MoneyPenny module — see `velaUnderwritingDisclosureAuthorization.ts`'s own
 * header for the full disambiguation); `services/qubetalk/disclosurePolicy.ts`
 * (the OTHER, unrelated chat-context disclosure concept).
 *
 * OUT OF SCOPE for this item: any UI/demo surface; a real, live QubeTalk
 * conversation-negotiation mechanism; risk-slice/portfolio decomposition
 * (a materially larger, separately-scoped feature); any change to
 * `useCaseZeroOrchestrator.ts`, `factorCaseService.ts`,
 * `aegisAssessmentService.ts`, `admissionAuthority.ts`,
 * `velaMultiPartyProjection.ts`, `velaUnderwritingProjection.ts`,
 * `factorSelectionArtifact.ts`, or `velaUnderwritingAdmissionEvidence.ts`
 * themselves — all imported from, none modified.
 *
 * Server-side only (imports `velaUnderwritingProjection.ts` and
 * `activityReceiptService.ts`, both server-side only).
 */

import { createHash } from 'crypto';
import {
  assertVelaMultiPartyScopeBindingMatchesContext,
  type VelaMultiPartyDisclosureScope,
  type VelaMultiPartyPartyInput,
} from './velaMultiPartyProjection';
import {
  runVelaUnderwritingProjection,
  type VelaUnderwritingProjectionResult,
} from './velaUnderwritingProjection';
import type { VelaAssetRef, VelaTransport } from './velaTypes';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';
import type { FactorSelectionArtifact } from '@/services/factor/factorSelectionArtifact';
import type { AegisAdmissionEvidence } from './velaUnderwritingAdmissionEvidence';
import type { VelaUnderwritingDisclosureAuthorization } from './velaUnderwritingDisclosureAuthorization';
import type { UnderwritingProvider } from '@/services/financialServices/providers/underwriting/underwritingProviderTypes';

/**
 * A caller/integrity defect — two (or three) artifacts paired together do
 * not describe the same candidate/request/selection. Distinct from a
 * `BLOCKED` result (see this file's header, "BLOCKED vs THROW"), which is a
 * normal, expected epistemic outcome for a correctly-paired but non-ADMITTED
 * candidate.
 */
export class VelaCompositionError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'VelaCompositionError';
  }
}

export interface FrozenUnderwritingEnvelope {
  envelopeRef: string;
  selectionRef: string;
  admissionRef: string;
  disclosureAuthorizationRef: string;
  requestRef: string;
  /** Sourced from `disclosureAuthorization.applicationId` — the ONLY
   *  artifact in this chain that carries one (see this file's header, "the
   *  applicationId caveat"). */
  applicationId: string;
  candidateAgentId: string;
  /** The EXACT scope this envelope is frozen with — the one and only source
   *  a submission step may read a scope from; never recomputed after this
   *  point (operator's own "no later stage may swap... after freeze"). */
  scope: VelaMultiPartyDisclosureScope;
  frozenAt: string;
}

export interface ComposeUnderwritingEnvelopeInput {
  factorSelection: FactorSelectionArtifact;
  admissionEvidence: AegisAdmissionEvidence;
  disclosureAuthorization: VelaUnderwritingDisclosureAuthorization;
}

export type ComposeUnderwritingEnvelopeResult =
  | { outcome: 'BLOCKED'; blockedReason: string }
  | { outcome: 'FROZEN'; envelope: FrozenUnderwritingEnvelope };

/**
 * Composes the three upstream artifacts into a frozen envelope, or refuses
 * with a named reason. Pure: no I/O, no DB, no receipt — see
 * `submitFrozenUnderwritingEnvelope` for the effectful step.
 *
 * Order of checks, matching this file's own header exactly:
 *   1. Factor selection <-> Aegis admission cross-reference (THROWS on
 *      mismatch — a caller/integrity defect).
 *   2. Factor selection <-> disclosure authorization cross-reference (THROWS
 *      on mismatch; limited to selectionRef/requestRef — see "the
 *      applicationId caveat").
 *   3. Scope-binding-matches-context, REUSED from the substrate (THROWS on
 *      mismatch, propagated from `assertVelaMultiPartyScopeBindingMatchesContext`
 *      itself).
 *   4. Admission status (`BLOCKED`, never a throw, when not `ADMITTED`).
 *   5. Freeze.
 */
export function composeUnderwritingEnvelope(
  input: ComposeUnderwritingEnvelopeInput,
): ComposeUnderwritingEnvelopeResult {
  const { factorSelection, admissionEvidence, disclosureAuthorization } = input;

  // Gate 1 (operator: "Factor selection and Aegis admission must reference
  // the same candidate/request context").
  const admissionMismatches: string[] = [];
  if (admissionEvidence.selectionRef !== factorSelection.selectionRef) {
    admissionMismatches.push(
      `selectionRef (admission: ${JSON.stringify(admissionEvidence.selectionRef)}, ` +
        `selection: ${JSON.stringify(factorSelection.selectionRef)})`,
    );
  }
  if (admissionEvidence.requestRef !== factorSelection.requestRef) {
    admissionMismatches.push(
      `requestRef (admission: ${JSON.stringify(admissionEvidence.requestRef)}, ` +
        `selection: ${JSON.stringify(factorSelection.requestRef)})`,
    );
  }
  if (admissionEvidence.candidateAgentId !== factorSelection.candidateAgentId) {
    admissionMismatches.push(
      `candidateAgentId (admission: ${JSON.stringify(admissionEvidence.candidateAgentId)}, ` +
        `selection: ${JSON.stringify(factorSelection.candidateAgentId)})`,
    );
  }
  if (admissionMismatches.length > 0) {
    throw new VelaCompositionError(
      'selection-admission-mismatch',
      'Aegis admission evidence does not reference the same candidate/request context as the ' +
        `Factor selection it is paired with — refusing to compose an envelope from mismatched ` +
        `artifacts. Mismatches: ${admissionMismatches.join('; ')}`,
    );
  }

  // Gate 2. FactorSelectionArtifact carries no applicationId field (see this
  // file's header, "the applicationId caveat") — this cross-reference is
  // therefore limited to selectionRef/requestRef, the fields that actually
  // exist on both sides.
  const disclosureMismatches: string[] = [];
  if (disclosureAuthorization.selectionRef !== factorSelection.selectionRef) {
    disclosureMismatches.push(
      `selectionRef (disclosure: ${JSON.stringify(disclosureAuthorization.selectionRef)}, ` +
        `selection: ${JSON.stringify(factorSelection.selectionRef)})`,
    );
  }
  if (disclosureAuthorization.requestRef !== factorSelection.requestRef) {
    disclosureMismatches.push(
      `requestRef (disclosure: ${JSON.stringify(disclosureAuthorization.requestRef)}, ` +
        `selection: ${JSON.stringify(factorSelection.requestRef)})`,
    );
  }
  if (disclosureMismatches.length > 0) {
    throw new VelaCompositionError(
      'selection-disclosure-mismatch',
      'Disclosure authorization does not reference the same selection/request context as the ' +
        `Factor selection it is paired with — refusing to compose an envelope from mismatched ` +
        `artifacts. Mismatches: ${disclosureMismatches.join('; ')}`,
    );
  }

  // Gate 3 (operator: "QubeTalk/iQube disclosure scope must authorize the
  // exact parties, request, computation and output class") — REUSED,
  // never reimplemented. See "the applicationId caveat" for exactly what
  // this proves given disclosureAuthorization.applicationId is the only
  // applicationId ground truth available. Throws (propagated, not
  // rewrapped) on any mismatch.
  assertVelaMultiPartyScopeBindingMatchesContext(disclosureAuthorization.scope, {
    applicationId: disclosureAuthorization.applicationId,
    requestRef: factorSelection.requestRef,
  });

  // Gate 4 (operator: "Only ADMITTED Aegis evidence may proceed"). A
  // correctly-paired but non-ADMITTED candidate is a normal, expected
  // epistemic outcome — BLOCKED, never a throw.
  if (admissionEvidence.admissionStatus !== 'ADMITTED') {
    return {
      outcome: 'BLOCKED',
      blockedReason:
        `Aegis admission evidence for candidate ${admissionEvidence.candidateAgentId} resolved ` +
        `${admissionEvidence.admissionStatus}, not ADMITTED — refusing to freeze an envelope. ` +
        `Reason: ${admissionEvidence.reason}`,
    };
  }

  // Gate 5/6 (operator: "MoneyPenny must bind the Factor/Aegis/disclosure
  // evidence refs into the frozen envelope before Vela submission").
  const envelopeRef = createHash('sha256')
    .update(
      'vela:envelope:' +
        factorSelection.selectionRef +
        ':' +
        admissionEvidence.admissionRef +
        ':' +
        disclosureAuthorization.authorizationRef +
        ':' +
        factorSelection.requestRef,
    )
    .digest('hex')
    .slice(0, 16);

  return {
    outcome: 'FROZEN',
    envelope: {
      envelopeRef,
      selectionRef: factorSelection.selectionRef,
      admissionRef: admissionEvidence.admissionRef,
      disclosureAuthorizationRef: disclosureAuthorization.authorizationRef,
      requestRef: factorSelection.requestRef,
      applicationId: disclosureAuthorization.applicationId,
      candidateAgentId: factorSelection.candidateAgentId,
      scope: disclosureAuthorization.scope,
      frozenAt: new Date().toISOString(),
    },
  };
}

export interface SubmitFrozenUnderwritingEnvelopeParams {
  /** The ONLY source of scope/requestRef/applicationId this function reads
   *  — there is no second, independently-suppliable field for any of these,
   *  so a caller cannot swap them after freeze (operator's own gate 7). */
  envelope: FrozenUnderwritingEnvelope;
  /** The actual party inputs (private data) for THIS submission — never
   *  derived from any evidence artifact, which carries none (same trust
   *  boundary `runVelaUnderwritingProjection`'s own `build.parties` already
   *  assumes; this function adds no new privacy surface here). */
  parties: VelaMultiPartyPartyInput[];
  transport: VelaTransport;
  actorPersonaId: string;
  requestedByAgentRef: string;
  asset?: VelaAssetRef;
  maxPollAttempts?: number;
  underwritingProvider?: UnderwritingProvider;
  requestingPartyNamespaceRef?: string;
  activeCartridge?: string;
}

export interface SubmitFrozenUnderwritingEnvelopeResult {
  compositionReceiptId: string | null;
  velaResult: VelaUnderwritingProjectionResult;
}

const DEFAULT_ACTIVE_CARTRIDGE = 'moneypenny';

/**
 * The ONE authorized, effectful consumer of an already-frozen envelope: runs
 * the EXISTING, UNMODIFIED `runVelaUnderwritingProjection` with the frozen
 * envelope's own `applicationId`/`requestRef`/`scope` (never recomputed, and
 * this function's own signature has nowhere to accept a second scope/context
 * at all — operator's own gate 7), then writes the ONE final composition
 * receipt binding all four evidence classes the operator named (operator's
 * own gate 8): the Factor selection (`selectionRef`), the Aegis admission
 * (`admissionRef`), the disclosure authorization
 * (`disclosureAuthorizationRef`), and the Vela execution evidence
 * (`onChainRequestId`/`disposition`/`providerMode`/`veloProjectionReceiptId`/
 * `telemetryRecordId`).
 */
export async function submitFrozenUnderwritingEnvelope(
  params: SubmitFrozenUnderwritingEnvelopeParams,
): Promise<SubmitFrozenUnderwritingEnvelopeResult> {
  const velaResult = await runVelaUnderwritingProjection({
    build: {
      applicationId: params.envelope.applicationId,
      requestRef: params.envelope.requestRef,
      parties: params.parties,
      scope: params.envelope.scope,
    },
    transport: params.transport,
    asset: params.asset,
    maxPollAttempts: params.maxPollAttempts,
    underwritingProvider: params.underwritingProvider,
    actorPersonaId: params.actorPersonaId,
    requestedByAgentRef: params.requestedByAgentRef,
    requestingPartyNamespaceRef: params.requestingPartyNamespaceRef,
    activeCartridge: params.activeCartridge,
  });

  const receipt = await createActivityReceipt({
    personaId: params.actorPersonaId,
    activeCartridge: params.activeCartridge ?? DEFAULT_ACTIVE_CARTRIDGE,
    actionType: 'vela_underwriting_envelope_frozen',
    summary:
      `MoneyPenny composition gate froze + submitted envelope ${params.envelope.envelopeRef} for ` +
      `request ${params.envelope.requestRef}: ${velaResult.disposition} (${velaResult.quote.providerMode})`,
    agentsInvoked: [params.requestedByAgentRef],
    actionInput: {
      envelopeRef: params.envelope.envelopeRef,
      selectionRef: params.envelope.selectionRef,
      admissionRef: params.envelope.admissionRef,
      disclosureAuthorizationRef: params.envelope.disclosureAuthorizationRef,
      requestRef: params.envelope.requestRef,
      applicationId: params.envelope.applicationId,
      candidateAgentId: params.envelope.candidateAgentId,
      onChainRequestId: velaResult.onChainRequestId,
      disposition: velaResult.disposition,
      providerMode: velaResult.quote.providerMode,
      veloProjectionReceiptId: velaResult.receiptId,
      telemetryRecordId: velaResult.telemetryRecordId,
    },
  });

  return { compositionReceiptId: receipt?.id ?? null, velaResult };
}
