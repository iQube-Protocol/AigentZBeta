/**
 * Checkpoint persistence contract — IRL-REVIEW-001 resilience amendment
 * (2026-07-30, following the vP1 batch-011 run: accepted batch decisions were
 * never persisted before process exit, so that run is permanently
 * `REFUSED — NON-RECOVERABLE EXECUTION`; nothing in it can be resumed).
 *
 * ── What this module is ──────────────────────────────────────────────────
 *
 * Pure, IO-free identity, construction and verification logic for a batch
 * checkpoint and a run manifest — no filesystem, no clock, no randomness,
 * same discipline as every other module in this directory (rulings; the
 * "no Date.now / Math.random / new Date" canary in
 * `tests/independent-review-capability.test.ts` covers this file too).
 * Every timestamp is a caller-supplied parameter.
 *
 * The actual filesystem reads/writes (atomic checkpoint files, the run
 * directory layout) live OUTSIDE this directory, in
 * `scripts/lib/reviewCheckpointStore.ts` — mirroring how `independentReviewPlan.ts`
 * (which reads the corpus) lives outside this directory rather than inside
 * it: this directory imports no database client and touches no filesystem.
 *
 * ── Why a checkpoint carries BOTH a manifest-hash binding AND discrete
 *    identity fields ────────────────────────────────────────────────────────
 *
 * `preRunManifestHash` alone would transitively cover rubric/prompt/model
 * identity (the pre-run manifest already commits to all three). This module
 * verifies each field separately anyway, because a mismatch should say
 * exactly WHAT drifted ("resolvedModelId changed") rather than one opaque
 * "manifest hash differs" — the whole point of resume verification is to
 * make drift legible, not merely detectable.
 */

import { commit } from './deterministic';
import {
  DECISION_OUTPUT_SCHEMA,
  INDEPENDENCE_PROMPT_VERSION,
  INDEPENDENCE_RUBRIC_ID,
  INDEPENDENCE_RUBRIC_VERSION,
  RELATION_CRITERIA,
  RUBRIC_INSTRUCTIONS,
} from './rubric';
import type { ReviewDecision, ReviewerSlot } from './types';
import type { BatchAttemptRecord, BatchPlan } from './batching';
import type { PreRunManifest } from './runner';

export const CHECKPOINT_SCHEMA_VERSION = '1.0.0';

/**
 * A hash over the rubric's SUBSTANTIVE content (criteria + instructions),
 * not merely its version string — catches an edited rubric that was not
 * accompanied by a version bump. Global to the module (not per-batch): the
 * rubric does not vary by subject or batch.
 */
export function computeRubricHash(): string {
  return commit({
    id: INDEPENDENCE_RUBRIC_ID,
    version: INDEPENDENCE_RUBRIC_VERSION,
    criteria: RELATION_CRITERIA,
    instructions: RUBRIC_INSTRUCTIONS,
  });
}

/**
 * A hash over the prompt TEMPLATE's fixed content (version + output schema),
 * not the full per-batch dispatched text (which necessarily varies with the
 * subjects in that batch, and is separately covered by each batch's own
 * `rawResponseHash`/isolation checks).
 */
export function computePromptHash(): string {
  return commit({ version: INDEPENDENCE_PROMPT_VERSION, outputSchema: DECISION_OUTPUT_SCHEMA });
}

export interface RunIdentity {
  packageId: string;
  packageHash: string;
  preRunManifestHash: string;
  rubricVersion: string;
  rubricHash: string;
  promptVersion: string;
  promptHash: string;
  checkpointSchemaVersion: string;
}

export function buildRunIdentity(input: {
  packageId: string;
  packageHash: string;
  preRunManifestHash: string;
}): RunIdentity {
  return {
    packageId: input.packageId,
    packageHash: input.packageHash,
    preRunManifestHash: input.preRunManifestHash,
    rubricVersion: INDEPENDENCE_RUBRIC_VERSION,
    rubricHash: computeRubricHash(),
    promptVersion: INDEPENDENCE_PROMPT_VERSION,
    promptHash: computePromptHash(),
    checkpointSchemaVersion: CHECKPOINT_SCHEMA_VERSION,
  };
}

export interface ReviewerIdentity {
  reviewerSlot: ReviewerSlot;
  requestedModelId: string;
  resolvedModelId: string;
  modelFamily: string;
}

export interface BatchCheckpoint {
  checkpointSchemaVersion: string;
  packageId: string;
  packageHash: string;
  preRunManifestHash: string;
  rubricVersion: string;
  rubricHash: string;
  promptVersion: string;
  promptHash: string;
  reviewerSlot: ReviewerSlot;
  requestedModelId: string;
  resolvedModelId: string;
  modelFamily: string;
  batchId: string;
  batchHash: string;
  orderedSubjectIds: string[];
  rawResponseHash: string;
  parsedDecisionHash: string;
  decisions: ReviewDecision[];
  attemptCount: number;
  completedAt: string;
}

/**
 * Builds a checkpoint from an ALREADY-ACCEPTED batch attempt. Refuses on an
 * incomplete/unaccepted attempt — an incomplete batch must never become a
 * checkpoint (a caller-side bug, not a runtime condition, so this throws a
 * plain `Error` rather than a `ReviewRefusal`).
 */
export function buildBatchCheckpoint(input: {
  runIdentity: RunIdentity;
  reviewerIdentity: ReviewerIdentity;
  batchId: string;
  batchHash: string;
  orderedSubjectIds: readonly string[];
  attempt: BatchAttemptRecord;
  decisions: readonly ReviewDecision[];
  completedAt: string;
}): BatchCheckpoint {
  if (!input.attempt.accepted) {
    throw new Error(
      'buildBatchCheckpoint called with a non-accepted attempt — an incomplete batch must never become a checkpoint',
    );
  }
  return {
    checkpointSchemaVersion: input.runIdentity.checkpointSchemaVersion,
    packageId: input.runIdentity.packageId,
    packageHash: input.runIdentity.packageHash,
    preRunManifestHash: input.runIdentity.preRunManifestHash,
    rubricVersion: input.runIdentity.rubricVersion,
    rubricHash: input.runIdentity.rubricHash,
    promptVersion: input.runIdentity.promptVersion,
    promptHash: input.runIdentity.promptHash,
    reviewerSlot: input.reviewerIdentity.reviewerSlot,
    requestedModelId: input.reviewerIdentity.requestedModelId,
    resolvedModelId: input.reviewerIdentity.resolvedModelId,
    modelFamily: input.reviewerIdentity.modelFamily,
    batchId: input.batchId,
    batchHash: input.batchHash,
    orderedSubjectIds: [...input.orderedSubjectIds],
    rawResponseHash: input.attempt.outputHash,
    parsedDecisionHash: commit(input.decisions),
    decisions: [...input.decisions],
    attemptCount: input.attempt.attempt,
    completedAt: input.completedAt,
  };
}

export interface CheckpointMismatch {
  field: string;
  expected: unknown;
  found: unknown;
}

/**
 * Every field the operator's ruling names, checked individually so a
 * mismatch is legible. A checkpoint whose OWN recorded decisions no longer
 * hash to its OWN recorded `parsedDecisionHash` is corrupt (tampered with,
 * or truncated on disk) — reported as its own mismatch, not silently trusted.
 */
export function verifyCheckpointCompatible(
  checkpoint: BatchCheckpoint,
  expected: {
    runIdentity: RunIdentity;
    reviewerIdentity: ReviewerIdentity;
    batchId: string;
    batchHash: string;
    orderedSubjectIds: readonly string[];
  },
): { compatible: boolean; mismatches: CheckpointMismatch[] } {
  const mismatches: CheckpointMismatch[] = [];
  const check = (field: string, expectedVal: unknown, foundVal: unknown) => {
    if (expectedVal !== foundVal) mismatches.push({ field, expected: expectedVal, found: foundVal });
  };

  check('checkpointSchemaVersion', expected.runIdentity.checkpointSchemaVersion, checkpoint.checkpointSchemaVersion);
  check('packageId', expected.runIdentity.packageId, checkpoint.packageId);
  check('packageHash', expected.runIdentity.packageHash, checkpoint.packageHash);
  check('preRunManifestHash', expected.runIdentity.preRunManifestHash, checkpoint.preRunManifestHash);
  check('rubricVersion', expected.runIdentity.rubricVersion, checkpoint.rubricVersion);
  check('rubricHash', expected.runIdentity.rubricHash, checkpoint.rubricHash);
  check('promptVersion', expected.runIdentity.promptVersion, checkpoint.promptVersion);
  check('promptHash', expected.runIdentity.promptHash, checkpoint.promptHash);
  check('reviewerSlot', expected.reviewerIdentity.reviewerSlot, checkpoint.reviewerSlot);
  check('requestedModelId', expected.reviewerIdentity.requestedModelId, checkpoint.requestedModelId);
  check('resolvedModelId', expected.reviewerIdentity.resolvedModelId, checkpoint.resolvedModelId);
  check('modelFamily', expected.reviewerIdentity.modelFamily, checkpoint.modelFamily);
  check('batchId', expected.batchId, checkpoint.batchId);
  check('batchHash', expected.batchHash, checkpoint.batchHash);

  const expectedSubjects = [...expected.orderedSubjectIds];
  const sameMembership =
    expectedSubjects.length === checkpoint.orderedSubjectIds.length &&
    expectedSubjects.every((s, i) => s === checkpoint.orderedSubjectIds[i]);
  if (!sameMembership) {
    mismatches.push({ field: 'orderedSubjectIds', expected: expectedSubjects, found: checkpoint.orderedSubjectIds });
  }

  const recomputedDecisionHash = commit(checkpoint.decisions);
  if (recomputedDecisionHash !== checkpoint.parsedDecisionHash) {
    mismatches.push({ field: 'parsedDecisionHash', expected: checkpoint.parsedDecisionHash, found: recomputedDecisionHash });
  }

  return { compatible: mismatches.length === 0, mismatches };
}

// ── Run state machine ────────────────────────────────────────────────────

export type RunState =
  | 'CREATED'
  | 'R1_IN_PROGRESS'
  | 'R1_COMPLETE'
  | 'R2_IN_PROGRESS'
  | 'REFUSED_RESUMABLE'
  | 'COMPLETE'
  | 'INVALIDATED';

export const RUN_STATES: readonly RunState[] = [
  'CREATED',
  'R1_IN_PROGRESS',
  'R1_COMPLETE',
  'R2_IN_PROGRESS',
  'REFUSED_RESUMABLE',
  'COMPLETE',
  'INVALIDATED',
];

const ALLOWED_TRANSITIONS: Record<RunState, readonly RunState[]> = {
  CREATED: ['R1_IN_PROGRESS', 'INVALIDATED'],
  R1_IN_PROGRESS: ['R1_COMPLETE', 'REFUSED_RESUMABLE', 'INVALIDATED'],
  R1_COMPLETE: ['R2_IN_PROGRESS', 'INVALIDATED'],
  R2_IN_PROGRESS: ['COMPLETE', 'REFUSED_RESUMABLE', 'INVALIDATED'],
  // A resumable refusal can resume into whichever pass was in flight when it
  // was recorded — the caller (the CLI) knows which, from the manifest's own
  // batch-plan/checkpoint state, and requests the matching transition.
  REFUSED_RESUMABLE: ['R1_IN_PROGRESS', 'R2_IN_PROGRESS', 'INVALIDATED'],
  COMPLETE: [],
  INVALIDATED: [],
};

export function assertValidTransition(from: RunState, to: RunState): void {
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new Error(`invalid run-state transition: ${from} -> ${to}`);
  }
}

// ── Run manifest (the resumable record of one run) ──────────────────────

export interface RunManifestRecord {
  runId: string;
  state: RunState;
  runIdentity: RunIdentity;
  /**
   * The `createdAt` originally passed to the corpus-read/package-build step
   * (`buildReviewPlan`). A resume MUST reuse this exact value to rebuild a
   * byte-identical package (same `packageHash`) from the same corpus state —
   * a resume that re-reads the corpus with a fresh timestamp would silently
   * rebuild a DIFFERENT package and every batchHash would mismatch.
   */
  packageCreatedAt: string;
  preRunManifest: PreRunManifest;
  reviewers: { r1: ReviewerIdentity; r2: ReviewerIdentity };
  r1BatchPlan: BatchPlan;
  /** Null until R1 completes and coverage selects R2's subjects. */
  r2BatchPlan: BatchPlan | null;
  createdAt: string;
  updatedAt: string;
}

export function transitionRunManifest(manifest: RunManifestRecord, to: RunState, updatedAt: string): RunManifestRecord {
  assertValidTransition(manifest.state, to);
  return { ...manifest, state: to, updatedAt };
}
