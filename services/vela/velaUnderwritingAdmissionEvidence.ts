/**
 * Vela underwriting admission evidence — Use Case Zero build-order item 8,
 * the direct sequel to item 7 (`services/factor/factorSelectionArtifact.ts`,
 * merged 2026-09-13).
 *
 * CRITICAL DISAMBIGUATION (read before touching anything named "Factor",
 * "Aegis", "admission", or "Use Case Zero" — three separate collisions to
 * avoid, all real, all pre-existing):
 *
 *  1. `services/factor/useCaseZeroOrchestrator.ts` is a DIFFERENT, pre-
 *     existing, case-scoped agent-onboarding readiness state machine —
 *     unrelated to this item. Its own `stepAegisAssessment` function creates
 *     Aegis assessments for `subjectType: 'factor_case'` — a DIFFERENT
 *     assessment lineage than the one THIS item reads (`subjectType:
 *     'agent'`, keyed on the candidate's own runtime agent id). This module
 *     does not modify, import from, or key on that orchestrator or the
 *     `factor_cases` state machine, and its own module name is deliberately
 *     NOT a second `UseCaseZero*` symbol (operator's own explicit naming
 *     instruction, 2026-09-13) — it is named under the `velaUnderwriting*`
 *     family alongside its two siblings instead.
 *  2. `services/marketa/admissionAssessmentEngine.ts` /
 *     `admissionAssessmentRunner.ts` / `admissionAssessmentStore.ts` are ALSO
 *     a different, unrelated admission-assessment system (Marketa
 *     eligibility) — `services/aegis/aegisAssessmentService.ts`'s own header
 *     already documents this distinction ("Aegis is an independent assessor
 *     from Marketa"). This item does not touch or reuse those Marketa files.
 *  3. "Admission" here means Aegis's OWN `AegisDecision` vocabulary
 *     (admissible / admissible_with_conditions / insufficient_evidence /
 *     not_admissible), never MoneyPenny's separate authorization/mandate
 *     decision (`services/moneypenny/admissionAuthority.ts::decideAdmission`)
 *     — this module never calls, imports, or approximates that function.
 *
 * OPERATOR'S OWN RULING THIS ITEM IMPLEMENTS (verbatim, 2026-09-13): "The
 * clean role is: Factor proposes participation; Aegis determines
 * admissibility; MoneyPenny decides whether the workflow may proceed. Aegis
 * should remain an independent assessment membrane, not become the authority
 * source and not replace the constitutional mandate. I'd keep this pass
 * narrow and explicit: Consume the Factor selection artifact as an input.
 * Resolve the selected candidate against the existing Aegis
 * assessment/admission machinery. Produce a deterministic Aegis Admission
 * Evidence artifact bound to selectionRef + requestRef + candidate +
 * service/capability + assessment version. Fail closed if assessment is
 * missing, stale, contradictory, unresolved, or below the required admission
 * threshold. Do not expose confidential underwriting inputs to Aegis unless
 * a later, explicitly scoped assessment requires them. Do not let Aegis call
 * Vela, settlement, or the underwriting provider directly. Do not let
 * 'Aegis admitted' imply human authority, mandate, or permission to
 * transact." The core distinction, verbatim: "Factor says 'this is a
 * candidate worth considering.' Aegis says 'this candidate is admissible
 * under these trust conditions.' metaMe/MoneyPenny determines whether this
 * exact consequential interaction is authorized now."
 *
 * THE TEN INVARIANTS, verbatim, and how EACH is enforced (or explicitly
 * deferred) by this file:
 *
 *  1. "Unknown Factor candidate cannot be silently substituted." Enforced
 *     STRUCTURALLY: `UnderwritingAdmissionEvidenceInput` has exactly ONE
 *     field naming the candidate — `factorSelection` (the whole, real
 *     `FactorSelectionArtifact` object) — and no second `candidateAgentId`-
 *     shaped input field exists anywhere on the type. `candidateAgentId` is
 *     read from `factorSelection.candidateAgentId` verbatim inside
 *     `composeUnderwritingAdmissionEvidence`, never re-derived, never
 *     accepted as a second, independently-suppliable argument. Proven by a
 *     `@ts-expect-error` gate test asserting the type has no such extra
 *     property.
 *
 *  2. "Stale or missing Aegis evidence resolves UNRESOLVED." Enforced by the
 *     missing-assessment branch (step 3 below) and the freshness check
 *     (`DEFAULT_MAX_ASSESSMENT_AGE_MS`, caller-overridable via
 *     `maxAssessmentAgeMs`) — both resolve `admissionStatus: 'UNRESOLVED'`
 *     rather than fabricating a fallback verdict.
 *
 *  3. "ADMITTED does not confer authority or mandate." This artifact is
 *     evidence for MoneyPenny to consider, never itself an authorization.
 *     No code anywhere in this file calls or approximates
 *     `services/moneypenny/admissionAuthority.ts::decideAdmission` — proven
 *     by the import-boundary tests below. This item does NOT build the
 *     actual binding of an ADMITTED artifact into a frozen envelope
 *     (deferred to a later item, exactly as item 7 deferred its own
 *     invariant 4).
 *
 *  4. "Aegis cannot bypass MoneyPenny's consequence/risk path." Enforced by
 *     IMPORT BOUNDARY: this file imports nothing from
 *     `services/vela/velaMultiPartyProjection.ts`,
 *     `services/vela/velaUnderwritingProjection.ts`,
 *     `services/financialServices/providers/underwriting/*`, or
 *     `services/moneypenny/admissionAuthority.ts`, and never calls
 *     `submitVelaMultiPartyProjection`, `submitAssetBearingProcessRequest`,
 *     `runVelaUnderwritingProjection`, or `decideAdmission`. Proven by two
 *     import-boundary tests in `tests/vela-underwriting-admission-evidence
 *     .test.ts` (the same `tests/_lib/sourceAuthority.ts` AST-based
 *     technique `tests/factor-selection-artifact.test.ts` uses).
 *
 *  5. "Factor cannot self-certify its own candidate." Already enforced
 *     UPSTREAM, at assessment-CREATION time, by `aegisAssessmentService.ts`'s
 *     own `createAssessment` refusing `subjectRef === requestedByAgentRef`
 *     (self-assessment). This file only READS an already-created/ratified
 *     assessment via `getCurrentAssessment`/`listFindings` — it never
 *     creates one — so it inherits that guarantee rather than
 *     re-implementing it.
 *
 *  6. "Assessment version/freshness is bound into the admission artifact."
 *     `assessmentVersion` (Aegis's own `policy_version`), `effectiveAt`
 *     (the assessment's `ratified_at`, or the composition timestamp when no
 *     ratified assessment exists), and `freshnessMs` are always populated
 *     when an assessment exists, and honestly `null` when it does not.
 *
 *  7. "Only an ADMITTED artifact may be bound into the frozen multi-party
 *     envelope." NOT enforced by this item's code — explicitly out of
 *     scope, deferred to the (future) item that actually binds a
 *     selection+admission pair into `buildVelaMultiPartyProjectionRequest`.
 *
 *  8. "The final causal receipt references both the Factor selection and
 *     Aegis admission evidence." `evidence.selectionRef`/`evidence
 *     .requestRef` are bound into THIS item's own causal receipt's
 *     `actionInput` (the evidence object itself carries both, verbatim). A
 *     LATER item's own final causal receipt (when the frozen-envelope
 *     binding is built) is expected to additionally reference
 *     `evidence.admissionRef` — noted here as a forward-looking expectation,
 *     not built now.
 *
 *  9. "Do not expose confidential underwriting inputs to Aegis unless a
 *     later, explicitly scoped assessment requires them." Enforced
 *     STRUCTURALLY: `UnderwritingAdmissionEvidenceInput`'s field set has no
 *     place for a party's raw financial inputs (`currentExposure`/
 *     `proposedSpend`/`privateSpendLimit`/`privateRiskLimit`, or any generic
 *     map of those) — proven by a `@ts-expect-error` gate test, same family
 *     as every prior item in this chain.
 *
 * 10. "Do not let Aegis call Vela, settlement, or the underwriting provider
 *     directly." Same import-boundary proof as invariant 4 above.
 *     `aegisAssessmentService.ts` itself (unmodified by this item) already
 *     has no such imports either, so the WHOLE Aegis-adjacent surface stays
 *     isolated — this file's own import graph adds nothing to that surface.
 *
 * OUT OF SCOPE for this item (do not extend this file to cover these — that
 * composition is a LATER item's job): actually binding a selection+admission
 * pair into `buildVelaMultiPartyProjectionRequest`/MoneyPenny's frozen
 * envelope; MoneyPenny's own `decideAdmission` call or any authorization
 * logic; creating/driving new Aegis assessments (this item only reads
 * existing ones — `createAssessment`/`addFinding`/`beginRunning`/
 * `requireReview`/`ratifyAssessment` are never called here); any UI/demo
 * surface; QubeTalk/iQube disclosure-authorization wiring; any change to
 * `useCaseZeroOrchestrator.ts`, `factorCaseService.ts`,
 * `aegisAssessmentService.ts`, `velaMultiPartyProjection.ts`, or
 * `velaUnderwritingProjection.ts` themselves.
 *
 * Server-side only (imports `getCurrentAssessment`/`listFindings`/
 * `createActivityReceipt`, all server-only).
 */

import { createHash } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  getCurrentAssessment,
  listFindings,
  type AegisDecision,
} from '@/services/aegis/aegisAssessmentService';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';
import type { FactorSelectionArtifact } from '@/services/factor/factorSelectionArtifact';

/**
 * Deliberately conservative freshness bound for a constitutional admission
 * gate: 24 hours. A ratified Aegis assessment older than this is treated as
 * stale (`UNRESOLVED`) rather than trusted indefinitely — caller-overridable
 * via `maxAssessmentAgeMs` for a narrower or looser policy.
 */
export const DEFAULT_MAX_ASSESSMENT_AGE_MS = 86_400_000; // 24 hours

export type AegisAdmissionStatus = 'ADMITTED' | 'REFUSED' | 'UNRESOLVED';

export interface UnderwritingAdmissionEvidenceInput {
  /**
   * The ONLY source of the candidate identity this function ever reads —
   * no separate `candidateAgentId` parameter exists on this type, so a
   * caller cannot silently substitute a different candidate than the one
   * Factor actually proposed (invariant 1 above — a structural, not merely
   * documented, property).
   */
  factorSelection: FactorSelectionArtifact;
  /**
   * Which capability/service this admission is being evaluated FOR, for
   * binding purposes only — Aegis's OWN assessment is of the candidate
   * AGENT, never of this specific service; never conflate the two.
   * Defaults to `factorSelection.serviceId`.
   */
  serviceId?: string | null;
  /**
   * Max age (ms) a ratified assessment may be before this function treats
   * it as stale -> UNRESOLVED. Caller-overridable; defaults to
   * `DEFAULT_MAX_ASSESSMENT_AGE_MS`.
   */
  maxAssessmentAgeMs?: number;
}

export interface AegisAdmissionTrustSummary {
  decision: AegisDecision | null;
  conditions: unknown[];
  rationale: string | null;
  criticalFailedFindingCount: number;
}

export interface AegisAdmissionEvidence {
  admissionRef: string;
  selectionRef: string;
  requestRef: string;
  candidateAgentId: string;
  serviceId: string | null;
  /** Aegis `assessment_id`, or `null` when no assessment exists yet. */
  assessmentRef: string | null;
  /** Aegis `policy_version`, or `null` when no assessment exists yet. */
  assessmentVersion: string | null;
  admissionStatus: AegisAdmissionStatus;
  trustSummary: AegisAdmissionTrustSummary;
  /** `[assessmentRef]` when an assessment was found (regardless of its
   *  resolved status), else `[]`. */
  evidenceRefs: string[];
  /** The assessment's `ratified_at` when a ratified assessment exists, else
   *  the composition-time timestamp (as of composition, not a real
   *  assessment event — see `composeUnderwritingAdmissionEvidence`). */
  effectiveAt: string;
  /** Age (ms) of the ratified assessment at composition time; `null` when
   *  no ratified assessment exists to measure freshness against. */
  freshnessMs: number | null;
  aegisAgentId: string;
  /** Human-readable, especially load-bearing for UNRESOLVED/REFUSED. */
  reason: string;
}

const AEGIS_AGENT_ID = 'aigent-aegis';

/**
 * Composes a deterministic Aegis Admission Evidence artifact for the
 * candidate named by `input.factorSelection`. READ-ONLY: calls only
 * `getCurrentAssessment`/`listFindings` — never `createAssessment`/
 * `addFinding`/`ratifyAssessment`/anything that WRITES to
 * `aegis_assessments`/`aegis_findings`. No DB write, no receipt — see
 * `recordUnderwritingAdmissionEvidence` for the causal receipt.
 */
export async function composeUnderwritingAdmissionEvidence(
  admin: SupabaseClient,
  input: UnderwritingAdmissionEvidenceInput,
): Promise<AegisAdmissionEvidence> {
  const { factorSelection } = input;
  const candidateAgentId = factorSelection.candidateAgentId;
  const selectionRef = factorSelection.selectionRef;
  const requestRef = factorSelection.requestRef;
  const serviceId = input.serviceId ?? factorSelection.serviceId ?? null;
  const maxAssessmentAgeMs = input.maxAssessmentAgeMs ?? DEFAULT_MAX_ASSESSMENT_AGE_MS;
  const compositionTimestamp = new Date().toISOString();

  const assessment = await getCurrentAssessment(admin, 'agent', candidateAgentId);

  const buildRef = (assessmentRef: string | null, assessmentVersion: string | null) =>
    createHash('sha256')
      .update(
        'aegis:admission:' +
          selectionRef +
          ':' +
          requestRef +
          ':' +
          candidateAgentId +
          ':' +
          (assessmentRef ?? 'none') +
          ':' +
          (assessmentVersion ?? 'none'),
      )
      .digest('hex')
      .slice(0, 16);

  if (!assessment) {
    return {
      admissionRef: buildRef(null, null),
      selectionRef,
      requestRef,
      candidateAgentId,
      serviceId,
      assessmentRef: null,
      assessmentVersion: null,
      admissionStatus: 'UNRESOLVED',
      trustSummary: { decision: null, conditions: [], rationale: null, criticalFailedFindingCount: 0 },
      evidenceRefs: [],
      effectiveAt: compositionTimestamp,
      freshnessMs: null,
      aegisAgentId: AEGIS_AGENT_ID,
      reason: 'no Aegis assessment exists yet for this candidate',
    };
  }

  const assessmentRef = assessment.assessment_id;
  const assessmentVersion = assessment.policy_version;

  if (assessment.state !== 'ratified') {
    const reason =
      assessment.state === 'failed'
        ? 'Aegis assessment process failed — not a substantive admissibility judgment'
        : `Aegis assessment is still in progress (state: '${assessment.state}')`;
    return {
      admissionRef: buildRef(assessmentRef, assessmentVersion),
      selectionRef,
      requestRef,
      candidateAgentId,
      serviceId,
      assessmentRef,
      assessmentVersion,
      admissionStatus: 'UNRESOLVED',
      trustSummary: { decision: null, conditions: [], rationale: null, criticalFailedFindingCount: 0 },
      evidenceRefs: [assessmentRef],
      effectiveAt: compositionTimestamp,
      freshnessMs: null,
      aegisAgentId: AEGIS_AGENT_ID,
      reason,
    };
  }

  // Ratified.
  const ratifiedAt = assessment.ratified_at as string; // always set on a ratified row
  const freshnessMs = Date.now() - new Date(ratifiedAt).getTime();

  if (freshnessMs > maxAssessmentAgeMs) {
    return {
      admissionRef: buildRef(assessmentRef, assessmentVersion),
      selectionRef,
      requestRef,
      candidateAgentId,
      serviceId,
      assessmentRef,
      assessmentVersion,
      admissionStatus: 'UNRESOLVED',
      trustSummary: { decision: assessment.decision, conditions: assessment.conditions ?? [], rationale: assessment.rationale, criticalFailedFindingCount: 0 },
      evidenceRefs: [assessmentRef],
      effectiveAt: ratifiedAt,
      freshnessMs,
      aegisAgentId: AEGIS_AGENT_ID,
      reason: `Aegis assessment is stale: ${freshnessMs}ms old, exceeds the ${maxAssessmentAgeMs}ms freshness threshold`,
    };
  }

  const findings = await listFindings(admin, assessmentRef);
  const criticalFailedFindingCount = (findings as Array<{ is_critical?: boolean; result?: string }>).filter(
    (f) => f.is_critical === true && f.result === 'fail',
  ).length;

  const decisionIsAdmissible = assessment.decision === 'admissible' || assessment.decision === 'admissible_with_conditions';

  if (criticalFailedFindingCount > 0 && decisionIsAdmissible) {
    return {
      admissionRef: buildRef(assessmentRef, assessmentVersion),
      selectionRef,
      requestRef,
      candidateAgentId,
      serviceId,
      assessmentRef,
      assessmentVersion,
      admissionStatus: 'UNRESOLVED',
      trustSummary: { decision: assessment.decision, conditions: assessment.conditions ?? [], rationale: assessment.rationale, criticalFailedFindingCount },
      evidenceRefs: [assessmentRef],
      effectiveAt: ratifiedAt,
      freshnessMs,
      aegisAgentId: AEGIS_AGENT_ID,
      reason: 'contradictory: assessment ratified admissible but carries a critical failed finding',
    };
  }

  let admissionStatus: AegisAdmissionStatus;
  let reason: string;
  switch (assessment.decision) {
    case 'admissible':
      admissionStatus = 'ADMITTED';
      reason = 'Aegis ratified this candidate as admissible';
      break;
    case 'admissible_with_conditions':
      admissionStatus = 'ADMITTED';
      reason = 'Aegis ratified this candidate as admissible, with conditions';
      break;
    case 'not_admissible':
      admissionStatus = 'REFUSED';
      reason = 'Aegis ratified this candidate as not admissible';
      break;
    case 'insufficient_evidence':
      admissionStatus = 'UNRESOLVED';
      reason = 'Aegis ratified with a decision of insufficient_evidence';
      break;
    default:
      // Should not occur on a ratified row, but handled honestly rather
      // than guessing.
      admissionStatus = 'UNRESOLVED';
      reason = 'ratified assessment unexpectedly carries no decision';
      break;
  }

  return {
    admissionRef: buildRef(assessmentRef, assessmentVersion),
    selectionRef,
    requestRef,
    candidateAgentId,
    serviceId,
    assessmentRef,
    assessmentVersion,
    admissionStatus,
    trustSummary: { decision: assessment.decision, conditions: assessment.conditions ?? [], rationale: assessment.rationale, criticalFailedFindingCount },
    evidenceRefs: [assessmentRef],
    effectiveAt: ratifiedAt,
    freshnessMs,
    aegisAgentId: AEGIS_AGENT_ID,
    reason,
  };
}

export interface RecordUnderwritingAdmissionEvidenceParams {
  actorPersonaId: string;
  /** Typically 'aigent-aegis' — caller-supplied, never hardcoded here. */
  requestedByAgentRef: string;
  activeCartridge?: string;
}

const DEFAULT_ACTIVE_CARTRIDGE = 'moneypenny';

/**
 * Writes the ONE causal receipt for a composed admission-evidence artifact
 * via `createActivityReceipt` directly (never the `constitutionalCommerce`
 * apparatus — same choice every prior item in this chain made).
 * `actionInput` binds the evidence object VERBATIM — it is already
 * privacy-safe by construction (invariant 9).
 */
export async function recordUnderwritingAdmissionEvidence(
  evidence: AegisAdmissionEvidence,
  params: RecordUnderwritingAdmissionEvidenceParams,
): Promise<{ receiptId: string | null }> {
  const receipt = await createActivityReceipt({
    personaId: params.actorPersonaId,
    activeCartridge: params.activeCartridge ?? DEFAULT_ACTIVE_CARTRIDGE,
    actionType: 'vela_underwriting_admission_evidence_composed',
    summary:
      `Aegis admission evidence composed for candidate ${evidence.candidateAgentId} ` +
      `(request ${evidence.requestRef}): ${evidence.admissionStatus}`,
    agentsInvoked: [params.requestedByAgentRef],
    actionInput: evidence as unknown as Record<string, unknown>,
  });
  return { receiptId: receipt?.id ?? null };
}
