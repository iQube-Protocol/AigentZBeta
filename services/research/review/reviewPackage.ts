/**
 * The frozen, hashed, blinded review package (SPEC §4, §9, §14.2).
 *
 * Three refusals, each one guarding a failure that produces a plausible-looking
 * review rather than an error.
 *
 *   NO TARGET STATEMENT → refused. An independence review without a stated
 *   target is a vibe check. The target was previously implicit in a triage
 *   script's scrutiny-term list, which meant the thing every decision turned on
 *   existed only as a side effect of a keyword array. It is now an explicit,
 *   hashed field, and a package cannot be built without it.
 *
 *   BLINDED MATERIAL PRESENT → refused. See blinding.ts.
 *
 *   NON-DETERMINISTIC CONSTRUCTION → impossible by signature. Every timestamp
 *   is a parameter; there is no clock read and no random source in this file,
 *   so the same inputs always produce the same `packageHash`.
 *
 * The hash covers everything the reviewer will see. It deliberately does NOT
 * cover the hash field itself — that is computed over the package's canonical
 * form with `packageHash` absent, so a reader can recompute it.
 *
 * `createdAt` is ALSO excluded from the hashed body (2026-07-30 fix). Before
 * this, the same corpus content produced a DIFFERENT `packageHash` on every
 * invocation, because `createdAt` is a fresh wall-clock value each time the
 * CLI/route runs — "no clock read inside this module" is not the same
 * guarantee as "no run-varying value in the content commitment" when the
 * caller's own fresh timestamp is folded into what gets hashed. `createdAt`
 * remains a field on the returned `ReviewPackage` (real, useful metadata:
 * when THIS instance was constructed) — it is simply not part of what
 * `packageHash` proves. Execution/run metadata belongs in the run manifest
 * (`checkpoint.ts`'s `RunManifestRecord`), never in the frozen content
 * commitment.
 */

import { commit } from './deterministic';
import { assertBlinded } from './blinding';
import { blockDecisionIsArithmeticallySound } from './blockDecision';
import {
  ReviewRefusal,
  type BlockDecision,
  type ReviewPackage,
  type ReviewRequest,
  type ReviewSubjectRecord,
} from './types';

export interface BuildReviewPackageInput {
  packageId: string;
  reviewId: string;
  assetRef: string;
  assetCommitment: string;
  /** REQUIRED. A package without a target statement is refused. */
  targetDefinition: string;
  /** What the target is NOT. At least one entry — the confusions to prevent. */
  nonTargets: readonly string[];
  rubricRef: string;
  rubricVersion: string;
  sourceRefs: readonly string[];
  chronology: readonly string[];
  evidenceSummaries: readonly string[];
  subjects: readonly ReviewSubjectRecord[];
  blockDecisions: readonly BlockDecision[];
  exclusionsFromPackage: readonly string[];
  /** Supplied by the caller. No clock is read here. */
  createdAt: string;
}

export function buildReviewPackage(input: BuildReviewPackageInput): ReviewPackage {
  if (!input.targetDefinition?.trim()) {
    throw new ReviewRefusal(
      'missing-target-statement',
      'a review package requires an explicit target statement. Independence is a relation between a ' +
        'row and a target; with no target stated, every decision is unanchored and the reviewer is ' +
        'guessing what it is being asked to be independent OF.',
    );
  }
  if (input.nonTargets.length === 0) {
    throw new ReviewRefusal(
      'missing-non-targets',
      'a target statement must be accompanied by what the target is NOT. Adjacent systems are the ' +
        'confusion the reviewer will otherwise make, and it is cheaper to say so than to adjudicate it later.',
    );
  }
  if (!input.rubricRef.trim() || !input.rubricVersion.trim()) {
    throw new ReviewRefusal('missing-rubric', 'a review package must name its rubric and rubric version');
  }
  if (input.subjects.length === 0 && input.blockDecisions.length === 0) {
    throw new ReviewRefusal('empty-package', 'a review package must contain subjects, block decisions, or both');
  }
  if (!input.createdAt.trim()) {
    throw new ReviewRefusal('missing-created-at', 'createdAt must be supplied by the caller — packages do not read a clock');
  }

  const seen = new Set<string>();
  for (const s of input.subjects) {
    if (!s.subjectRef.trim()) throw new ReviewRefusal('unidentified-subject', 'every subject requires a subjectRef');
    if (seen.has(s.subjectRef)) {
      throw new ReviewRefusal('duplicate-subject', `subject ${s.subjectRef} appears more than once in the package`);
    }
    seen.add(s.subjectRef);
  }

  for (const b of input.blockDecisions) {
    if (!blockDecisionIsArithmeticallySound(b)) {
      throw new ReviewRefusal(
        'unsound-block-decision',
        `block '${b.blockId}' reports ${b.admitted} admitted from ${b.assessed} assessed with ` +
          `${b.extracted.length} extracted — the admitted count is not the computed remainder`,
      );
    }
  }

  const body = {
    packageId: input.packageId,
    reviewId: input.reviewId,
    assetRef: input.assetRef,
    assetCommitment: input.assetCommitment,
    sourceRefs: [...input.sourceRefs],
    evidenceSummaries: [...input.evidenceSummaries],
    chronology: [...input.chronology],
    targetDefinition: input.targetDefinition.trim(),
    nonTargets: [...input.nonTargets],
    rubricRef: input.rubricRef,
    rubricVersion: input.rubricVersion,
    exclusionsFromPackage: [...input.exclusionsFromPackage],
    subjects: input.subjects.map((s) => ({ ...s })),
    blockDecisions: input.blockDecisions.map((b) => ({ ...b, extracted: b.extracted.map((e) => ({ ...e })) })),
    createdAt: input.createdAt,
  };

  // Blinding is checked on the SEALED body — the exact structure that will be
  // hashed and rendered — rather than on the inputs, so a leak introduced while
  // assembling the body is still caught.
  assertBlinded(body, `review package ${input.packageId}`);

  // `createdAt` is excluded from what gets hashed (see the file header) — the
  // same corpus/boundary/rubric/ruling must reproduce the same packageHash
  // regardless of when the package happened to be constructed.
  const { createdAt, ...hashableBody } = body;
  return { ...body, packageHash: commit(hashableBody) };
}

/** Recompute a package's hash. A reader can verify without trusting the field. */
export function verifyPackageHash(pkg: ReviewPackage): boolean {
  const { packageHash, createdAt, ...body } = pkg;
  return commit(body) === packageHash;
}

export function buildReviewRequest(input: {
  reviewId: string;
  experimentId?: string;
  assetType: ReviewRequest['assetType'];
  reviewMode: ReviewRequest['reviewMode'];
  reviewQuestion: string;
  rubricId: string;
  packageRef: string;
  pkg: ReviewPackage;
  requestedAt: string;
  requestedByRef: string;
}): ReviewRequest {
  if (!input.requestedByRef.trim()) {
    throw new ReviewRefusal('unattributable-request', 'a review request must record who requested it');
  }
  return {
    reviewId: input.reviewId,
    ...(input.experimentId ? { experimentId: input.experimentId } : {}),
    assetType: input.assetType,
    reviewMode: input.reviewMode,
    reviewQuestion: input.reviewQuestion,
    targetDefinition: input.pkg.targetDefinition,
    rubricId: input.rubricId,
    packageRef: input.packageRef,
    packageHash: input.pkg.packageHash,
    requestedAt: input.requestedAt,
    requestedByRef: input.requestedByRef,
  };
}

/**
 * The redacted preview — literally the sealed package, with nothing added and
 * nothing recomputed.
 *
 * A preview built by a second projection is the classic
 * two-things-describing-one-thing defect: it drifts, and the drift is invisible
 * precisely where it matters, because the human looking at the preview is
 * looking at it in order to trust the thing they are NOT looking at. So the
 * preview returns the package object itself and its verified hash, and a canary
 * asserts the preview's hash equals the dispatched package's hash.
 */
export interface RedactedPackagePreview {
  packageId: string;
  packageHash: string;
  hashVerified: boolean;
  package: ReviewPackage;
}

export function redactedPreview(pkg: ReviewPackage): RedactedPackagePreview {
  // Re-run the blinding scan at preview time. If a caller mutated the object
  // after sealing, the preview is where a human would otherwise be shown a
  // clean-looking package that no longer matches its hash.
  assertBlinded(pkg, `review package ${pkg.packageId} (preview)`);
  return {
    packageId: pkg.packageId,
    packageHash: pkg.packageHash,
    hashVerified: verifyPackageHash(pkg),
    package: pkg,
  };
}
