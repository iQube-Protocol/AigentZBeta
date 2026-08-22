/**
 * Unified Consequence Projection — the canonical consequence-composition seam
 * (VELA-001 Slice 2E).
 *
 * DELIBERATELY OWNED BY NEITHER SIDE. This module lives outside both
 * `services/consequence/` (CFS-006a) and `services/vela/` because neither the
 * invariant-graph forecast nor a confidential provider owns the final
 * constitutional projection alone:
 *
 *   CFS-006a forecastConsequences()   →  the PUBLIC / invariant-graph projection
 *   ConfidentialProjectionProvider    →  the CONFIDENTIAL projection evidence
 *   this module                       →  the COMPOSITION
 *
 * It is shared substrate: the Ian experimental substrate, Conditional Commerce
 * and (later) Qriptosentience all compose projections through here rather than
 * each growing their own rule.
 *
 * WHAT THIS MODULE MUST NEVER DO — enforced by canaries in
 * tests/unified-consequence-projection.test.ts:
 *  - import or emit `ActionAuthorisation`, or any authorisation vocabulary. A
 *    projection is evidence about expected consequence; the Authorisation
 *    Plane derives `Consequential Authority ∩ Acceptable Consequence
 *    Projection = Action Authorised` from it.
 *  - import Vela types. It composes an abstract confidential component; it
 *    does not know which provider produced it.
 *  - treat missing confidential evidence as ACCEPTABLE.
 *  - turn an infrastructure failure, fee failure, absent evidence or
 *    unverifiable attestation into UNACCEPTABLE.
 *
 * Server-side only.
 */

import { createHash } from 'crypto';
import type {
  ConfidentialProjectionComponent,
  ConfidentialRequirement,
  ConsequenceProjection,
  InvariantFinding,
  OpportunityProjection,
  ProjectedConsequence,
  ProjectionDisposition,
  PublicProjectionComponent,
  RiskProjection,
} from '@/types/constitutionalCommerce';
import type { ConsequenceForecast } from '@/types/consequence';

/**
 * The provider-agnostic shape the composition needs from a confidential
 * projection. Structurally compatible with what a
 * `ConfidentialProjectionProvider` returns, but declared here so this module
 * never imports a provider's own types — the Ian substrate can supply the same
 * shape from a different mechanism entirely.
 */
export interface ConfidentialEvidenceInput {
  provider: string;
  requestRef: string;
  disposition: ProjectionDisposition;
  /** Commitment over the confidential result. */
  resultCommitment: string;
  payloadCommitment: string;
  protocolExecutionVerified: boolean;
  teeAttestationVerified: boolean;
  attestationMode: string;
}

export interface CompositionPolicy {
  /**
   * When true, a confidential component whose `teeAttestationVerified` is
   * false cannot establish a projection → UNRESOLVED.
   *
   * Defaults to FALSE so a local/emulated deployment can compose at all. That
   * default is safe precisely because `teeAttestationVerified` is carried
   * through to the composed projection as independent provenance — a consumer
   * that requires hardware trust can read it. It must never be defaulted to
   * true silently, and it must never make an unverifiable attestation read as
   * UNACCEPTABLE (see composeConfidentialComponent).
   */
  requireVerifiedAttestation?: boolean;
}

export interface ComposeProjectionInput {
  projectionContextRef: string;
  actionRef: string;
  authorityRef: string;
  mandateRef: string;
  /** CFS-006a's forecast. Required — there is no projection without a public component. */
  publicForecast: ConsequenceForecast;
  confidentialRequirement: ConfidentialRequirement;
  /** Present only when a confidential projection actually completed. */
  confidentialEvidence?: ConfidentialEvidenceInput | null;
  /** Why the confidential component is absent, when it is. Improves the rationale, never the disposition. */
  confidentialAbsenceReason?: string;
  projectedConsequences?: ProjectedConsequence[];
  riskProjection?: RiskProjection;
  opportunityProjection?: OpportunityProjection;
  policy?: CompositionPolicy;
}

function ref(namespace: string, value: string): string {
  return createHash('sha256').update(namespace).update(value).digest('hex').slice(0, 32);
}

// ── Public component ─────────────────────────────────────────────────────

/**
 * Map CFS-006a's forecast onto a projection disposition.
 *
 * The mapping, and why each branch reads the way it does:
 *
 *  - **No seed knowledge → UNRESOLVED.** An empty forecast means no invariant
 *    knowledge was established, NOT that nothing objects. Reading "no
 *    applicable invariants" as ACCEPTABLE is the same absence-equals-
 *    permission defect the confidential projector already refuses (a missing
 *    limit is not "no limit").
 *  - **A constitutional or canonical constraint bounds the action →
 *    UNACCEPTABLE.** A constraint that reaches the action is established
 *    knowledge about the projected consequence, so the projection succeeded
 *    and its content is "not acceptable as projected". Note that CFS-006a
 *    calls this "escalate": escalation is an AUTHORISATION-plane decision
 *    (the Authorisation Plane may escalate for ratification rather than refuse
 *    outright). The projection's job is only to report what it established.
 *  - **A reachable contradiction → UNRESOLVED.** Self-contradictory knowledge
 *    cannot establish a coherent projection. Distinct from a constraint: a
 *    constraint says "this is bounded", a contradiction says "we cannot tell".
 *  - **Otherwise → ACCEPTABLE.**
 */
export function composePublicComponent(
  forecast: ConsequenceForecast,
): PublicProjectionComponent {
  const forecastRef = ref(
    'projection:public:',
    JSON.stringify({
      seeds: forecast.seedInvariantIds,
      enables: forecast.enables,
      constrains: forecast.constrains,
      contradicts: forecast.contradicts,
    }),
  );

  let disposition: ProjectionDisposition;
  let reason: string;

  if (forecast.seedInvariantIds.length === 0) {
    disposition = 'UNRESOLVED';
    reason =
      'no seed invariant knowledge — a public projection was not established (absence of applicable invariants is not acceptance)';
  } else if (forecast.constitutionalConstraint) {
    disposition = 'UNACCEPTABLE';
    reason = `bounded by ${forecast.constitutionalConstraintIds.length} constitutional constraint(s): ${forecast.constitutionalConstraintIds.join(', ')}`;
  } else if (forecast.contradicts > 0) {
    disposition = 'UNRESOLVED';
    reason = `${forecast.contradicts} contradiction(s) reachable — public knowledge is incoherent, so no coherent projection was established`;
  } else if (forecast.forcesEscalation) {
    disposition = 'UNACCEPTABLE';
    reason =
      'bounded by a canonical constraint — the projected consequence is not acceptable as projected';
  } else {
    disposition = 'ACCEPTABLE';
    reason = `${forecast.enables} downstream outcome(s) enabled with no reachable constraint or contradiction`;
  }

  return { source: 'consequence_operating_model', disposition, forecastRef, forecast, reason };
}

// ── Confidential component ───────────────────────────────────────────────

const NOT_REQUIRED_COMPONENT = (reason: string): ConfidentialProjectionComponent => ({
  requirement: 'NOT_REQUIRED',
  disposition: null,
  provider: null,
  requestRef: null,
  evidenceRef: null,
  payloadCommitment: null,
  protocolExecutionVerified: null,
  teeAttestationVerified: null,
  attestationMode: null,
  reason,
});

/**
 * Build the confidential component.
 *
 * The load-bearing rule: when the component is REQUIRED and cannot be
 * established — evidence absent, protocol execution unverified, or (under
 * policy) attestation unverified — the result is UNRESOLVED. Never
 * UNACCEPTABLE (that would report a refusal we did not actually establish) and
 * never ACCEPTABLE (that would let absence pass as approval).
 */
export function composeConfidentialComponent(
  requirement: ConfidentialRequirement,
  evidence: ConfidentialEvidenceInput | null | undefined,
  policy: CompositionPolicy = {},
  absenceReason?: string,
): ConfidentialProjectionComponent {
  if (requirement === 'NOT_REQUIRED') {
    return NOT_REQUIRED_COMPONENT(
      'confidential projection not required for this action — no provider was invoked',
    );
  }

  if (!evidence) {
    return {
      requirement: 'REQUIRED',
      disposition: 'UNRESOLVED',
      provider: null,
      requestRef: null,
      evidenceRef: null,
      payloadCommitment: null,
      protocolExecutionVerified: null,
      teeAttestationVerified: null,
      attestationMode: null,
      reason:
        absenceReason ??
        'confidential projection is REQUIRED but no evidence was produced — unresolved, not acceptable',
    };
  }

  const base = {
    requirement: 'REQUIRED' as const,
    provider: evidence.provider,
    requestRef: evidence.requestRef,
    evidenceRef: evidence.resultCommitment,
    payloadCommitment: evidence.payloadCommitment,
    protocolExecutionVerified: evidence.protocolExecutionVerified,
    teeAttestationVerified: evidence.teeAttestationVerified,
    attestationMode: evidence.attestationMode,
  };

  if (!evidence.protocolExecutionVerified) {
    return {
      ...base,
      disposition: 'UNRESOLVED',
      reason:
        'confidential result was not verified as produced by the expected environment — unresolved, not unacceptable',
    };
  }

  if (policy.requireVerifiedAttestation && !evidence.teeAttestationVerified) {
    return {
      ...base,
      disposition: 'UNRESOLVED',
      reason: `policy requires verified hardware attestation; this deployment is ${evidence.attestationMode} — unresolved, not unacceptable`,
    };
  }

  return {
    ...base,
    disposition: evidence.disposition,
    reason:
      evidence.disposition === 'UNACCEPTABLE'
        ? 'confidential projection established that the projected consequence is not acceptable'
        : evidence.disposition === 'ACCEPTABLE'
          ? 'confidential projection established that the projected consequence is acceptable'
          : 'confidential provider could not establish a projection',
  };
}

// ── Composition ──────────────────────────────────────────────────────────

/**
 * Compose required component dispositions into one.
 *
 * Precedence: UNACCEPTABLE > UNRESOLVED > ACCEPTABLE.
 *
 * ACCEPTABLE requires EVERY required component to be ACCEPTABLE — one
 * acceptable component can never rescue another that is unresolved or
 * unacceptable.
 *
 * The UNACCEPTABLE-over-UNRESOLVED ordering is a deliberate call the operator
 * ruling did not settle. Both outcomes block execution, so safety does not
 * distinguish them; accountability does. If one component established a
 * definite reason to refuse, reporting UNRESOLVED would hide a known refusal
 * behind "we could not tell", and would invite a pointless retry of an action
 * that is already known to be unacceptable. So an established refusal is
 * reported as such, and the unresolved component is still visible in its own
 * provenance.
 */
export function composeDispositions(
  components: Array<{ label: string; disposition: ProjectionDisposition }>,
): { disposition: ProjectionDisposition; rationale: string } {
  if (components.length === 0) {
    return {
      disposition: 'UNRESOLVED',
      rationale: 'no required projection components — nothing was established',
    };
  }

  const unacceptable = components.filter((c) => c.disposition === 'UNACCEPTABLE');
  if (unacceptable.length > 0) {
    return {
      disposition: 'UNACCEPTABLE',
      rationale: `UNACCEPTABLE — established by required component(s): ${unacceptable.map((c) => c.label).join(', ')}`,
    };
  }

  const unresolved = components.filter((c) => c.disposition === 'UNRESOLVED');
  if (unresolved.length > 0) {
    return {
      disposition: 'UNRESOLVED',
      rationale: `UNRESOLVED — required component(s) could not establish a projection: ${unresolved.map((c) => c.label).join(', ')}`,
    };
  }

  return {
    disposition: 'ACCEPTABLE',
    rationale: `ACCEPTABLE — all required components acceptable: ${components.map((c) => c.label).join(', ')}`,
  };
}

/**
 * Compose a Unified Consequence Projection from a public forecast and an
 * optional confidential component.
 *
 * Emits a `ConsequenceProjection` and nothing else. It does not decide, and
 * cannot express, whether the action is authorised.
 */
export function composeUnifiedConsequenceProjection(
  input: ComposeProjectionInput,
): ConsequenceProjection {
  const publicComponent = composePublicComponent(input.publicForecast);
  const confidentialComponent = composeConfidentialComponent(
    input.confidentialRequirement,
    input.confidentialEvidence,
    input.policy ?? {},
    input.confidentialAbsenceReason,
  );

  // Only REQUIRED components participate. The public component is always
  // required — there is no projection without it.
  const participating: Array<{ label: string; disposition: ProjectionDisposition }> = [
    { label: 'public', disposition: publicComponent.disposition },
  ];
  if (
    confidentialComponent.requirement === 'REQUIRED' &&
    confidentialComponent.disposition !== null
  ) {
    participating.push({
      label: 'confidential',
      disposition: confidentialComponent.disposition,
    });
  }

  const { disposition, rationale } = composeDispositions(participating);

  return {
    projectionRef: ref(
      'projection:',
      `${input.projectionContextRef}|${input.actionRef}|${publicComponent.forecastRef}|${confidentialComponent.evidenceRef ?? 'none'}`,
    ),
    // Preserved verbatim so the Ian experiment can correlate this projection to
    // the exact decision context, later, against the observed consequence.
    projectionContextRef: input.projectionContextRef,
    actionRef: input.actionRef,
    authorityRef: input.authorityRef,
    mandateRef: input.mandateRef,
    projectedConsequences: input.projectedConsequences ?? [],
    // CFS-006a's own findings, carried through rather than flattened.
    invariantFindings: input.publicForecast.nodes as InvariantFinding[],
    riskProjection: input.riskProjection,
    opportunityProjection: input.opportunityProjection,
    public: publicComponent,
    confidential: confidentialComponent,
    disposition,
    compositionRationale: rationale,
  };
}
