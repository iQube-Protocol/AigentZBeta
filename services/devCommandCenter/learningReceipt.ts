/**
 * learningReceipt — Homecoming III Phase 5: the governed artifact at the end
 * of a development cycle, closing
 *
 *   implementation → consequence observation → invariant evidence →
 *   governed learning
 *
 * ── One registry, reused ────────────────────────────────────────────────────
 *
 * This module creates no registry and no persistence mechanism (requirement
 * 4). `buildLearningReceipt` is pure composition over data the cycle already
 * produced (the envelope, evidence observations, risk observations,
 * remediation) into `LearningReceipt` — a REPORT, the same idiom as
 * `buildRegistryReport` in `services/invariants/resolutionRecords.ts`. Where
 * the cycle warrants a durable record, the receipt carries a DRAFT in the
 * EXISTING `ResolutionRecord` shape, validated with the EXISTING
 * `validateResolutionRecord` — never a bespoke shape or a bespoke check.
 * Persisting that draft is the same manual, reviewed act every record in the
 * registry already follows; nothing here writes to disk.
 *
 * ── No canonization (requirement 6) ────────────────────────────────────────
 *
 * `draftResolutionRecord.status` is always `'observed'` — the floor of
 * `COMPLETION_LIFECYCLE`, the honest rung for something captured this cycle
 * with no demonstrated recurrence yet. `draftCandidateInvariants` come only
 * from `failureLearning.ts`'s `abstractCausalCandidate`, whose return type
 * cannot express anything above `'candidate'`. Nothing in this module can
 * write `'validated'`, `'ratified'`, or `'canonical'`.
 */

import {
  partitionByEpistemicStanding,
  type EpistemicPartition,
} from '@/services/devCommandCenter/invariantEnvelope';
import { validateResolutionRecord } from '@/services/invariants/resolutionRecords';
import type { RemediationPlan } from '@/types/devCommandCenter';
import {
  LEARNING_RECEIPT_SCHEMA_VERSION,
  type InvariantEvidenceObservation,
  type LearningReceipt,
  type RiskObservation,
} from '@/types/devLoopLearning';
import type { InvariantDevelopmentEnvelope } from '@/types/invariantEnvelope';
import type {
  CandidateInvariant,
  ResolutionRecord,
  ResolutionScope,
  ResolutionTrigger,
} from '@/types/resolutionRecords';
import { RESOLUTION_RECORD_SCHEMA_VERSION } from '@/types/resolutionRecords';

// ---------------------------------------------------------------------------
// Scope recommendation — advisory only, never a decision this module makes
// ---------------------------------------------------------------------------

/**
 * Recommend a resolution scope, as a RECOMMENDATION a reviewer weighs —
 * never a value this module writes into a record on its own authority.
 *
 * `cross-capability` is suggested only where the cycle itself produced
 * evidence of it: a negative-bearing discovery that actually widened scope
 * (`ScopeExpansion` present), or a draft candidate whose own portability
 * assessment already crossed sites. Absent that evidence, `local` is the
 * honest recommendation — the same discipline `RESOLUTION_SCOPES` already
 * imposes on every hand-authored record.
 */
export function deriveScopeRecommendations(
  envelope: InvariantDevelopmentEnvelope,
  draftCandidates: readonly CandidateInvariant[],
): string[] {
  const recommendations: string[] = [];

  const widened = envelope.invariants.some((i) =>
    i.recoveries.some((r) => r.scopeExpansion !== null),
  );
  if (widened) {
    recommendations.push(
      'A negative-bearing discovery widened scope beyond the intent domain — consider whether this cycle\'s learning is cross-capability, not local.',
    );
  }

  const crossCapabilityCandidates = draftCandidates.filter((c) => c.scope === 'cross-capability');
  if (crossCapabilityCandidates.length > 0) {
    recommendations.push(
      `${crossCapabilityCandidates.length} draft candidate(s) already carry cross-capability scope from a portable recurrence — recommend the same scope on the resolution record.`,
    );
  }

  if (recommendations.length === 0) {
    recommendations.push('No evidence of cross-capability reach this cycle — local scope is recommended.');
  }

  return recommendations;
}

// ---------------------------------------------------------------------------
// Draft resolution record — optional, milestone-triggered, never automatic
// ---------------------------------------------------------------------------

export interface ResolutionRecordMeta {
  resolutionId: string;
  capability: string;
  milestone: string;
  problem: string;
  trigger: ResolutionTrigger;
  scope: ResolutionScope;
  date: string;
  sourceDocs?: string[];
  rejectedApproaches?: string[];
  evidence?: ResolutionRecord['evidence'];
}

function buildDraftResolutionRecord(
  meta: ResolutionRecordMeta,
  observedFailure: string[],
  rootCauses: string[],
  resolution: string[],
  candidateIds: string[],
  canaries: string[],
): ResolutionRecord {
  return {
    schemaVersion: RESOLUTION_RECORD_SCHEMA_VERSION,
    resolutionId: meta.resolutionId,
    capability: meta.capability,
    milestone: meta.milestone,
    problem: meta.problem,
    observedFailure,
    rootCauses,
    resolution,
    rejectedApproaches: meta.rejectedApproaches ?? [],
    candidateInvariants: candidateIds,
    canaries,
    scope: meta.scope,
    // The floor of COMPLETION_LIFECYCLE — honest for a record captured this
    // cycle with no demonstrated recurrence beyond it (requirement 6).
    status: 'observed',
    trigger: meta.trigger,
    evidence: meta.evidence ?? { commits: [], tests: [], receipts: [], incidentRefs: [] },
    sourceDocs: meta.sourceDocs ?? [],
    date: meta.date,
    projections: {
      targets: ['devon'],
      researchRequired: false,
      ratificationRequired: true,
      track: null,
    },
  };
}

// ---------------------------------------------------------------------------
// The receipt
// ---------------------------------------------------------------------------

export interface BuildLearningReceiptInput {
  envelope: InvariantDevelopmentEnvelope;
  evidenceObservations: readonly InvariantEvidenceObservation[];
  riskObservations: readonly RiskObservation[];
  remediation: RemediationPlan | null;
  draftCandidateInvariants: readonly CandidateInvariant[];
  /** Present only when this cycle's evidence actually warrants a resolution
   *  record — absence is honest, not a gap (most cycles do not). */
  resolutionRecordMeta?: ResolutionRecordMeta;
  now: string;
}

function partitionRefs(partition: EpistemicPartition) {
  return {
    established: partition.established.map((i) => i.ref),
    signalsAndDiscoveries: [...partition.signals, ...partition.discoveries].map((i) => i.ref),
  };
}

/**
 * Build the learning receipt. Pure: every field is derived from its input,
 * nothing is read from a clock or a filesystem.
 */
export function buildLearningReceipt(input: BuildLearningReceiptInput): LearningReceipt {
  const { envelope, evidenceObservations, riskObservations, remediation, draftCandidateInvariants, now } = input;

  const { established, signalsAndDiscoveries } = partitionRefs(partitionByEpistemicStanding(envelope.invariants));

  const projectedRisks = envelope.proofsOfRisk.filter((p) => p.origin === 'projected').map((p) => p.id);
  const observedRisks = [
    ...envelope.proofsOfRisk.filter((p) => p.origin === 'observed').map((p) => p.id),
    ...riskObservations.map((o) => o.id),
  ];

  const evidenceSupporting = evidenceObservations.filter((o) => o.kind === 'supported');
  const evidenceChallengingOrFalsifying = evidenceObservations.filter(
    (o) => o.kind === 'challenged' || o.kind === 'falsified',
  );
  const evidenceUnresolved = evidenceObservations.filter((o) => o.kind === 'unresolved');

  const repairPerformed = (remediation?.remedies ?? []).map((r) => `${r.description}: ${r.remedy}`);

  const unresolvedMaterialQuestions = [
    ...envelope.unresolvedQuestions,
    ...evidenceUnresolved.map((o) => `${o.invariantRef}: ${o.basis}`),
  ];

  const scopeRecommendations = deriveScopeRecommendations(envelope, draftCandidateInvariants);

  const observedFailure = [
    ...riskObservations.map((o) => o.description),
    ...evidenceChallengingOrFalsifying.map((o) => `${o.invariantRef}: ${o.basis}`),
  ];
  const rootCauses = riskObservations.map((o) => o.initiatingCondition);
  const resolution = repairPerformed.length > 0 ? repairPerformed : ['No remediation was required this cycle.'];

  const draftResolutionRecord = input.resolutionRecordMeta
    ? buildDraftResolutionRecord(
        input.resolutionRecordMeta,
        observedFailure.length > 0 ? observedFailure : [input.resolutionRecordMeta.problem],
        rootCauses.length > 0 ? rootCauses : ['No distinct root cause beyond the stated problem was identified.'],
        resolution,
        draftCandidateInvariants.map((c) => c.candidateId),
        [],
      )
    : null;

  return {
    schemaVersion: LEARNING_RECEIPT_SCHEMA_VERSION,
    intentRef: envelope.intentRef,
    sessionRef: envelope.sessionRef,
    intentStatement: input.resolutionRecordMeta?.problem ?? '',
    establishedInvariantsUsed: established,
    candidateOrLiveInvariantsUsed: signalsAndDiscoveries,
    projectedRisks,
    observedRisks,
    evidenceSupporting,
    evidenceChallengingOrFalsifying,
    repairPerformed,
    unresolvedMaterialQuestions,
    scopeRecommendations,
    draftResolutionRecord,
    draftCandidateInvariants: [...draftCandidateInvariants],
    generatedAt: now,
  };
}

/**
 * Validate a receipt's draft resolution record against the SAME validator
 * every other record in the registry answers to. `true` with no
 * `draftResolutionRecord` is the honest pass state for a cycle that
 * produced no resolution-worthy material.
 */
export function validateLearningReceiptDraft(receipt: LearningReceipt): { valid: boolean; issues: string[] } {
  if (!receipt.draftResolutionRecord) return { valid: true, issues: [] };
  const result = validateResolutionRecord(receipt.draftResolutionRecord);
  return { valid: result.valid, issues: result.issues.map((i) => `${i.path}: ${i.message}`) };
}
