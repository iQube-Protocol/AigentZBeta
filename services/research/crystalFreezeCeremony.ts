/**
 * Crystal Freeze Ceremony — package builder (CFS-054 / PRD-EPI-001 §3.1
 * Workstream 5). Infrastructure ONLY. This module builds the artefact an
 * operator reviews before ratifying a freeze; it does not, and structurally
 * cannot, perform the freeze itself.
 *
 * ── What this module is NOT ─────────────────────────────────────────────
 *
 * It never calls `freezeArtifact` (services/research/artifacts.ts), never
 * writes to `research_objects`, never creates a receipt, and never touches
 * the DVN pipeline. `buildFreezeCeremonyPackage` is PURE — no I/O, no clock
 * read beyond echoing the caller-supplied `ratifiedAt`, no network — the
 * same discipline as `independentReviewPublish.ts`'s "pure logic, no I/O"
 * split, so every refusal path is directly unit-testable.
 *
 * It DOES read `getArtifactById` (added 2026-08-02) so the preview can report
 * whether the freeze would actually execute — see
 * `evaluateFreezeExecutionPreconditions` below. That is a read of persisted
 * artifact state; `freezeArtifact` itself is still never imported, which the
 * canary in tests/crystal-freeze-ceremony.test.ts greps for directly.
 *
 * ── The actual freeze act (NOT performed here, NOT performed by this
 *    session) ─────────────────────────────────────────────────────────────
 *
 * The real, already-built freeze mechanism is
 * `services/research/artifacts.ts::freezeArtifact()`. Once an operator has
 * reviewed a package this module produced and wants to ratify it, the
 * governed act is:
 *
 *   await freezeArtifact({
 *     personaId: <operator's own persona — the spine resolves this>,
 *     id: <the crystal-version FrozenArtifact.id>,
 *     contentHash: package.contentHash,       // = the statistics frozenHash
 *     signedBy: package.signatories,          // [operatorRef, reviewerRef?]
 *   });
 *
 * `freezeArtifact` already runs `checkFreezeGate` → `runCrystalReadinessReport`
 * (the same readiness report this package embeds), already refuses a
 * re-freeze of an already-frozen artifact (IRL-016 §4 — immutability), and
 * already writes an anchorable receipt through the EXISTING
 * `research_lifecycle_transition` DVN pipeline path (already present in
 * `ANCHORABLE_ACTION_TYPES` — no pipeline change needed for crystal freezes).
 * This module does not duplicate any of that; it only assembles the REVIEW
 * package a human reads before deciding to call it.
 *
 * No code path in this repository calls `freezeArtifact` for a crystal-version
 * artifact as a side effect of running readiness, statistics, or the freeze
 * recommendation — ratification is always a separate, explicit, human-issued
 * call.
 */

import { getArtifactById } from '@/services/research/artifacts';
import { commit } from '@/services/research/review/deterministic';
import {
  composeCrystalFreezeRecommendation,
  runCrystalFreezeRecommendation,
  type CrystalFreezeRecommendation,
} from '@/services/research/crystalFreezeRecommendation';
import type { CrystalReadinessReport } from '@/services/research/crystalReadiness';
import type { CrystalStatisticsReport } from '@/services/research/crystalStatistics';

export interface FreezeCeremonyRatificationInput {
  /** The FrozenArtifact.id this package previews a freeze for (e.g.
   * 'EXP-P1/crystal-vP1'). Echoed, never invented. */
  crystalId: string;
  experimentId: string;
  crystalDomain: string;
  /** T2-safe reference — never a raw personaId (Identity & Access Spine). */
  operatorRef: string;
  /** T2-safe reference to the independent reviewer, when one was engaged
   * (SPEC-IRL-REVIEW-001). Null when no independent review preceded this
   * package — that absence is reported, never hidden. */
  reviewerRef: string | null;
  /** Prose description of what the crystal domain covers and, as important,
   * does NOT cover (CFS-054 §2's "domain boundary declared" checklist item).
   */
  domainBoundary: string;
  /** Limitations the operator/reviewer want recorded alongside the freeze —
   * e.g. heuristic-only duplicate detection, Track 2 scope notes. Merged
   * with (not replacing) the recommendation's own `remainingRisks`. */
  knownLimitations: string[];
  /** Why THIS operator is ratifying THIS freeze now — required, non-empty
   * (mirrors the `rationale` requirement on `applyProvenanceReclassification`
   * and `freezeArtifact`'s signatory requirement: an unexplained freeze is a
   * stray click in the audit trail). */
  freezeRationale: string;
  /** ISO timestamp the caller supplies — never `Date.now()` inside this
   * module (determinism discipline, services/research/review/deterministic.ts's
   * header note, applied here too). */
  ratifiedAt: string;
}

export interface FreezeCeremonyPackage {
  crystalId: string;
  experimentId: string;
  crystalDomain: string;
  /** = statistics.frozenHash — the content commitment over the corpus this
   * package was built from. This is the value `freezeArtifact`'s
   * `contentHash` parameter would receive if the operator proceeds. */
  contentHash: string;
  date: string;
  operatorRef: string;
  reviewerRef: string | null;
  /** [operatorRef, reviewerRef].filter(Boolean) — the signatory list
   * `freezeArtifact`'s `signedBy` parameter would receive. */
  signatories: string[];
  corpusStatistics: CrystalStatisticsReport;
  domainBoundary: string;
  knownLimitations: string[];
  freezeRationale: string;
  recommendation: CrystalFreezeRecommendation;
  /**
   * True only when the embedded recommendation says READY_FOR_FREEZE. A
   * package is still built and returned when this is false — building the
   * preview is diagnostic and always allowed; what this flag gates is
   * whether ratifying this specific package would be consistent with the
   * evidence it carries. The API/UI layer must refuse to offer a ratify
   * action when this is false; this module refuses nothing itself because
   * it performs no action to refuse.
   */
  eligibleForRatification: boolean;
  /**
   * The receipt this ceremony WOULD produce if ratified — shaped to match
   * `writeLifecycleReceipt`'s summary convention exactly (see
   * services/research/lifecycle.ts) so a reader can see in advance what the
   * real receipt will say. This is a PREVIEW; no receipt has been created.
   */
  receiptPreview: {
    summary: string;
    activeCartridge: 'irl';
    actionType: 'research_lifecycle_transition';
  };
  /**
   * Populated only after the real freeze executes and its receipt clears the
   * DVN pipeline (services/dvn/activityReceiptDvnPipeline.ts, already
   * anchorable for 'research_lifecycle_transition' — no pipeline change
   * required). Always null in a package this module builds, because this
   * module never executes a freeze.
   */
  dvnAnchorRef: null;
  packageHash: string;
}

export interface BuildFreezeCeremonyPackageInput extends FreezeCeremonyRatificationInput {
  readiness: CrystalReadinessReport;
  statistics: CrystalStatisticsReport;
}

/**
 * Pure. Refuses (returns a typed error, never throws or silently proceeds)
 * when the ratification input is incomplete — an operatorRef or rationale
 * left blank is exactly the "stray click" this package exists to make
 * traceable.
 */
export type BuildFreezeCeremonyResult =
  | { ok: true; package: FreezeCeremonyPackage }
  | { ok: false; error: string };

export function buildFreezeCeremonyPackage(
  input: BuildFreezeCeremonyPackageInput,
): BuildFreezeCeremonyResult {
  if (!input.operatorRef?.trim()) {
    return { ok: false, error: 'operatorRef is required — an unattributed freeze ceremony package cannot be built' };
  }
  if (!input.freezeRationale?.trim()) {
    return { ok: false, error: 'freezeRationale is required — a freeze ceremony without a stated reason is refused' };
  }
  if (!input.domainBoundary?.trim()) {
    return { ok: false, error: 'domainBoundary is required (CFS-054 §2 — domain boundary must be declared before freeze)' };
  }
  if (!input.crystalId?.trim() || !input.experimentId?.trim()) {
    return { ok: false, error: 'crystalId and experimentId are required' };
  }
  if (!input.ratifiedAt?.trim()) {
    return { ok: false, error: 'ratifiedAt is required — this module never reads the clock itself' };
  }

  const recommendation = composeCrystalFreezeRecommendation(
    input.experimentId,
    input.crystalDomain,
    input.readiness,
    input.statistics,
  );

  const signatories = [input.operatorRef.trim(), input.reviewerRef?.trim() || null].filter(
    (s): s is string => Boolean(s),
  );

  const contentHash = input.statistics.frozenHash;
  const knownLimitations = [...new Set([...input.knownLimitations, ...recommendation.remainingRisks])];

  const receiptPreview = {
    summary:
      `${input.experimentId} artifact '${input.crystalId}' (crystal-version) frozen — ` +
      `commitment ${contentHash.slice(0, 16)}… — ratified by ${input.operatorRef}` +
      (input.reviewerRef ? ` with independent reviewer ${input.reviewerRef}` : '') +
      `. ${input.freezeRationale}`,
    activeCartridge: 'irl' as const,
    actionType: 'research_lifecycle_transition' as const,
  };

  const base: Omit<FreezeCeremonyPackage, 'packageHash'> = {
    crystalId: input.crystalId,
    experimentId: input.experimentId,
    crystalDomain: input.crystalDomain,
    contentHash,
    date: input.ratifiedAt,
    operatorRef: input.operatorRef,
    reviewerRef: input.reviewerRef,
    signatories,
    corpusStatistics: input.statistics,
    domainBoundary: input.domainBoundary,
    knownLimitations,
    freezeRationale: input.freezeRationale,
    recommendation,
    eligibleForRatification: recommendation.verdict === 'READY_FOR_FREEZE',
    receiptPreview,
    dvnAnchorRef: null,
  };

  return { ok: true, package: { ...base, packageHash: commit(base) } };
}

// ── Would the freeze actually EXECUTE? (audit finding, 2026-08-02) ──────────

/**
 * `eligibleForRatification` answers ONE question — does the EVIDENCE support a
 * freeze. It does not, and cannot, answer whether the freeze would execute.
 *
 * ── The gap this closes ────────────────────────────────────────────────────
 *
 * `freezeArtifact` (services/research/artifacts.ts) refuses unless a
 * `crystal-version` artifact ALREADY EXISTS at lifecycle `validated`, carries a
 * contentHash, and has at least one signatory. Nothing in this repository calls
 * `upsertArtifact`, so no such row is ever created — which means a package
 * could truthfully read `eligibleForRatification: true` while the operator's
 * very next act failed with `unknown artifact 'EXP-P1/crystal-vP1'`.
 *
 * Discovering that at the moment of a constitutional act is the opposite of a
 * rehearsed freeze. So the preconditions are evaluated ALONGSIDE the package —
 * separately, because they are a different kind of fact (substrate state, not
 * evidence) and must never be folded into the verdict about the corpus.
 *
 * Pure. Reported, never enforced here: this module performs no act to refuse.
 */
export interface FreezeExecutionPrecondition {
  name: string;
  satisfied: boolean;
  detail: string;
  /** What the operator does about it. Never "fix the code". */
  remedy: string | null;
}

export interface FreezeExecutionReadiness {
  /** True only when EVERY precondition below is satisfied AND the evidence
   * supports a freeze. A caller must not offer a ratify action otherwise. */
  wouldFreezeSucceed: boolean;
  preconditions: FreezeExecutionPrecondition[];
  /** The single next act, in the operator's register. */
  nextAct: string;
}

export function evaluateFreezeExecutionPreconditions(input: {
  /** = package.eligibleForRatification — the EVIDENCE question. */
  packageEligible: boolean;
  /** = package.contentHash. Blank is itself a refusal in `freezeArtifact`. */
  packageContentHash: string;
  /** Signatory count the package carries. `freezeArtifact` requires ≥ 1. */
  signatoryCount: number;
  /** The persisted crystal-version artifact, or null when none exists. */
  artifact: { id: string; lifecycle: string } | null;
  /** The artifact id the package names, for the not-found message. */
  crystalId: string;
}): FreezeExecutionReadiness {
  const preconditions: FreezeExecutionPrecondition[] = [
    {
      name: 'evidence-supports-freeze',
      satisfied: input.packageEligible,
      detail: input.packageEligible
        ? 'the freeze recommendation embedded in this package reads READY_FOR_FREEZE'
        : 'the freeze recommendation embedded in this package does not read READY_FOR_FREEZE',
      remedy: input.packageEligible
        ? null
        : 'this is scientific work, not a governance step — see the readiness report for which checks are outstanding',
    },
    {
      name: 'artifact-exists',
      satisfied: input.artifact !== null,
      detail:
        input.artifact !== null
          ? `crystal-version artifact '${input.artifact.id}' is persisted`
          : `no crystal-version artifact '${input.crystalId}' exists — freezeArtifact would refuse with ` +
            `"unknown artifact '${input.crystalId}'"`,
      remedy:
        input.artifact !== null
          ? null
          : `provision it first: POST /api/research/crystal/<experimentId>/freeze { "action": "provision" }`,
    },
    {
      name: 'artifact-at-validated',
      satisfied: input.artifact?.lifecycle === 'validated',
      detail:
        input.artifact === null
          ? 'no artifact to check — a freeze runs only from lifecycle `validated`'
          : input.artifact.lifecycle === 'frozen'
            ? 'the artifact is ALREADY frozen — freeze is immutable (IRL-016 §4) and a re-freeze is refused'
            : `the artifact is at '${input.artifact.lifecycle}' — freezeArtifact runs only from 'validated'`,
      remedy:
        input.artifact?.lifecycle === 'validated'
          ? null
          : input.artifact?.lifecycle === 'frozen'
            ? 'nothing — this crystal has already been frozen; its content is fixed'
            : 'provision the artifact at `validated` before ratifying',
    },
    {
      name: 'content-hash-present',
      satisfied: Boolean(input.packageContentHash?.trim()),
      detail: input.packageContentHash?.trim()
        ? `content commitment ${input.packageContentHash.slice(0, 16)}… will be written as commitmentHash`
        : 'this package carries no content hash — freezeArtifact refuses without one (PRD-EPI-001 §2.1)',
      remedy: input.packageContentHash?.trim() ? null : 'recompute the statistics report and rebuild the package',
    },
    {
      name: 'signatory-present',
      satisfied: input.signatoryCount > 0,
      detail:
        input.signatoryCount > 0
          ? `${input.signatoryCount} signatory reference(s) on the package`
          : 'no signatories — at least one is required (IRL-016 §2); an unattributed freeze is a stray click',
      remedy: input.signatoryCount > 0 ? null : 'supply operatorRef (and reviewerRef, when one was engaged)',
    },
  ];

  const firstUnsatisfied = preconditions.find((p) => !p.satisfied);
  return {
    wouldFreezeSucceed: !firstUnsatisfied,
    preconditions,
    nextAct: firstUnsatisfied
      ? (firstUnsatisfied.remedy ?? `resolve: ${firstUnsatisfied.detail}`)
      : 'every precondition is satisfied — the freeze is the operator’s own explicit act, performed by ' +
        'POST /api/research/crystal/<experimentId>/freeze with action "freeze".',
  };
}

export interface RunFreezeCeremonyPreviewInput extends FreezeCeremonyRatificationInput {
  fetchLimit?: number;
}

export type RunFreezeCeremonyPreviewResult =
  | { ok: true; package: FreezeCeremonyPackage; execution: FreezeExecutionReadiness }
  | { ok: false; error: string };

/** I/O wrapper — runs a fresh readiness + statistics pair, builds the package,
 * and reads (never writes) the persisted artifact so the execution
 * preconditions can be reported. Still performs no write of any kind. */
export async function runFreezeCeremonyPreview(
  input: RunFreezeCeremonyPreviewInput,
): Promise<RunFreezeCeremonyPreviewResult> {
  const recommendation = await runCrystalFreezeRecommendation({
    experimentId: input.experimentId,
    crystalDomain: input.crystalDomain,
    fetchLimit: input.fetchLimit,
  });
  const built = buildFreezeCeremonyPackage({
    ...input,
    readiness: recommendation.readiness,
    statistics: recommendation.statistics,
  });
  if (!built.ok) return built;

  // A read. An unreachable substrate reports as "no artifact" — which fails
  // the precondition closed rather than claiming a freeze would succeed.
  const artifact = await getArtifactById(built.package.crystalId).catch(() => null);

  return {
    ok: true,
    package: built.package,
    execution: evaluateFreezeExecutionPreconditions({
      packageEligible: built.package.eligibleForRatification,
      packageContentHash: built.package.contentHash,
      signatoryCount: built.package.signatories.length,
      artifact: artifact ? { id: artifact.id, lifecycle: artifact.lifecycle } : null,
      crystalId: built.package.crystalId,
    }),
  };
}
