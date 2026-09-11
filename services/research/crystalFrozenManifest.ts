/**
 * Frozen Crystal Manifest — a hash-VERIFIED, per-invariant projection of an
 * already-frozen crystal-version artifact, built for external review
 * (Validation Programme JSON Agent Package, 2026-08-09 completeness pass;
 * frozen-vs-current boundary TIGHTENED 2026-08-09, second review pass).
 *
 * ── The problem this closes ─────────────────────────────────────────────────
 *
 * `freezeArtifact` (services/research/artifacts.ts) persists ONLY
 * `{contentHash, commitmentHash, frozenAt, signedBy}` on the FrozenArtifact
 * row. It never persists the member list, the domain boundary text, the
 * freeze rationale, or the population/exclusion disclosure that the freeze
 * CEREMONY PREVIEW (crystalFreezeCeremony.ts) can compute on demand — that
 * preview is rehearsal-only and is never linked to the real freeze act. So
 * there is, today, no persisted snapshot of "exactly what was in the crystal
 * at the moment it froze" beyond its content hash.
 *
 * ── What this module does about it ──────────────────────────────────────────
 *
 * `contentHash` is `commit({crystalDomain, invariantCount, members})` over the
 * SAME deterministic projection `crystalStatistics.ts::runCrystalStatisticsReport`
 * computes from a LIVE query (services/invariants/store.ts::listInvariants).
 * So: re-run that live query now, recompute the identical hash, and compare it
 * to the artifact's own persisted, immutable `contentHash`.
 *
 *   MATCH    → the live domain-scoped corpus is BYTE-IDENTICAL to what was
 *              frozen. Serving full per-invariant detail from it is not a
 *              substitution — it is the verified frozen set, because nothing
 *              observably different could have produced the same hash.
 *   MISMATCH → the corpus has moved since freeze (an invariant edited, added,
 *              reclassified, or removed within the domain). Refuses to serve
 *              member detail as if it were the frozen set — that IS the
 *              "silent live-corpus substitution" this module exists to
 *              prevent — and reports the mismatch honestly instead.
 *
 * ── Three classes of evidence, never mixed in one object ────────────────────
 *
 * Each member is `{frozenRecord, currentSupplementary}`, not one flat bag:
 *   `frozenRecord`         — fields the content hash actually covers (id,
 *                            statement, namespace, semanticType, status,
 *                            provenance). Proven frozen when
 *                            `verifiedAgainstFreeze` is true.
 *   `currentSupplementary` — fields the hash does NOT cover (standing, reach,
 *                            validation/contradiction counts, dvnReceiptId,
 *                            ratifiedSource), stamped with `observedAt` so a
 *                            reader can never mistake "as of this request"
 *                            for "as of the freeze instant".
 * Intra-crystal relationships are `derivedTopology` — a separate ANALYSIS
 * over the verified frozen member set, not a frozen fact either, carrying its
 * own `computedAt`/`algorithmVersion` for the same reason.
 *
 * Never exposes `creatorAliasCommitment` or any other identity-adjacent field
 * not already required for scientific review.
 *
 * Server-only, read-only. Writes nothing, freezes nothing. No clock read
 * inside this module — `observedAt` is a caller-supplied timestamp (same
 * discipline as `crystalFreezeCeremony.ts`'s "every timestamp is a
 * parameter"), so this function stays a pure query+report over its inputs.
 */

import { listInvariants } from '@/services/invariants/store';
import { fetchIntraCrystalEdges } from '@/services/research/crystalReadiness';
import { crystalDomainForExperiment, type CrystalDomainDeclaration } from '@/services/research/crystalDomains';
import { readEvidenceProvenance } from '@/services/research/experimentalPopulations';
import { composeCrystalFreezeRecommendation } from '@/services/research/crystalFreezeRecommendation';
import { runCrystalReadinessReport } from '@/services/research/crystalReadiness';
import { runCrystalStatisticsReport } from '@/services/research/crystalStatistics';
import { computeCrystalContentHash } from '@/services/research/crystalContentProjection';
import {
  deriveLegacyFreezeVerification,
  type LegacyFreezeVerificationEvidence,
} from '@/services/research/crystalLegacyContentVerification';
import type { InvariantRecord } from '@/types/invariants';
import type { FrozenArtifact } from '@/types/research';

/** Bumped whenever the edge-derivation logic changes — lets a reader tell
 *  two `derivedTopology` snapshots computed by different logic apart. */
export const INTRA_CRYSTAL_TOPOLOGY_ALGORITHM_VERSION = 'intra-crystal-edges/v1';

export interface FrozenCrystalManifestMember {
  /** Covered by `frozenContentHash` — proven frozen iff `verifiedAgainstFreeze`. */
  frozenRecord: {
    id: string;
    statement: string;
    namespace: string;
    semanticType: string | null;
    /** Honest only when `verifiedAgainstFreeze` is true. */
    statusAtFreeze: string;
    evidenceProvenance: string | null;
    provenance: Record<string, unknown> | null;
  };
  /**
   * NOT covered by `frozenContentHash`. `runCrystalStatisticsReport`'s hash
   * commits only to {id, statement, namespace, semanticType, status,
   * provenance}; nothing in this codebase commits to standing/reach/
   * validation counts at a point in time, so these cannot be proven to equal
   * their value at the freeze instant even when the core hash matches.
   * `observedAt` is stamped so a reader can never read this as frozen fact.
   */
  currentSupplementary: {
    observedAt: string;
    standing: number;
    reach: number;
    timesValidated: number;
    timesContradicted: number;
    dvnReceiptId: string | null;
    ratifiedSource: string | null;
  };
}

export interface FrozenCrystalManifest {
  /**
   * Which projection produced this manifest (2026-09-04, Track 2
   * programme-state composition-cost repair) — `'full'` unless the caller
   * requested `input.scope === 'membership-only'`. Mirrors
   * `CrystalReadinessReport.scope`'s own contract exactly (same doctrine,
   * same reason): a bounded projection must never be mistaken for the
   * complete picture by anything downstream.
   */
  scope: 'full' | 'membership-only';
  experimentId: string;
  artifactId: string;
  crystalDomain: string;
  frozenContentHash: string;
  frozenCommitmentHash: string;
  frozenAt: string;
  signatories: string[];
  freezeReceiptRef: string | null;
  /** The single most important field in this manifest. False means: do NOT
   *  treat `members` below as the frozen set — see `verificationDetail`. */
  verifiedAgainstFreeze: boolean;
  verificationDetail: string;
  /** Recomputed live, for comparison, regardless of match — a reader should
   *  never have to take `verifiedAgainstFreeze` on faith without the two
   *  hashes to compare themselves. */
  recomputedLiveHash: string;
  memberCount: number;
  /** null when NOT verified — refusing to serve member detail as the frozen
   *  set is the whole point of the verification gate. */
  members: FrozenCrystalManifestMember[] | null;
  /**
   * The domain-membership recovery this module performs BEFORE the hash
   * check gates anything — unconditionally populated whenever a domain read
   * succeeded, regardless of `verifiedAgainstFreeze` (2026-08-30, EXP-P1
   * retrospective dataflow fix). This is NOT `members`: it carries raw
   * `InvariantRecord`s, is never split into frozenRecord/currentSupplementary,
   * and is never itself proof of anything frozen — it is the same recovered
   * population `recomputedLiveHash` was computed over. Exists so a caller that
   * needs to ASSESS the recovered population (e.g. the retrospective
   * falsification harness) can do so over the SAME rows this module already
   * fetched, rather than issuing its own independent, differently-filtered
   * query — the exact dataflow split this fix closes. Empty when no domain
   * read was attempted (missing contentHash) or it failed (readError).
   */
  recoveredInvariants: InvariantRecord[];
  /**
   * A narrowly-versioned, DERIVED legacy classification — see
   * crystalLegacyContentVerification.ts. Never redefines or weakens
   * `verifiedAgainstFreeze` above, which stays the strict byte-exact answer;
   * this is a separate, strictly weaker claim computed alongside it.
   */
  legacyContentVerification: LegacyFreezeVerificationEvidence;
  /**
   * A SEPARATE derived-analysis class, distinct from both `members` classes
   * above: relationships are neither a frozen fact nor a per-member current
   * observation, they are a computation OVER the verified frozen member set.
   * null when `members` is null (nothing verified to derive from) or the
   * computation itself failed.
   */
  derivedTopology: {
    derivedFromFrozenMemberSet: true;
    computedAt: string;
    algorithmVersion: string;
    edges: Array<{ from: string; to: string }>;
  } | null;
  domainBoundary: string;
  /**
   * Known limitations at freeze — sourced from the SAME freeze-recommendation
   * engine the pre-freeze UI shows (`recommendation.remainingRisks`), never a
   * second hand-typed list. Real limitations the readiness engine itself
   * surfaced, not fabricated for this manifest.
   */
  knownLimitations: string[];
  /**
   * The freeze-ceremony disclosure fields the operator ruling of 2026-08-03
   * added to the PREVIEW package (domain boundary rationale, population
   * disclosure, assigned-cohort/excluded-record hashes) — HONESTLY absent
   * here. `freezeArtifact` never persists them, so there is no frozen-time
   * record to report. Reporting a live recomputation of Track 2's population
   * split under these fields would be exactly the kind of silent
   * live-corpus-as-frozen-fact substitution this manifest exists to refuse.
   */
  freezeDisclosure: {
    captured: false;
    reason: string;
  };
}

function toManifestMember(inv: InvariantRecord, observedAt: string): FrozenCrystalManifestMember {
  return {
    frozenRecord: {
      id: inv.id,
      statement: inv.statement,
      namespace: inv.namespace,
      semanticType: inv.semanticType ?? null,
      statusAtFreeze: inv.status,
      evidenceProvenance: readEvidenceProvenance(inv.provenance),
      provenance: inv.provenance ?? null,
    },
    currentSupplementary: {
      observedAt,
      standing: inv.standing,
      reach: inv.reach,
      timesValidated: inv.timesValidated,
      timesContradicted: inv.timesContradicted,
      dvnReceiptId: inv.dvnReceiptId ?? null,
      ratifiedSource: inv.ratifiedSource ?? null,
    },
  };
}

export interface BuildFrozenCrystalManifestInput {
  experimentId: string;
  artifact: Pick<FrozenArtifact, 'id' | 'contentHash' | 'commitmentHash' | 'frozenAt' | 'signedBy' | 'receiptId'>;
  /** Caller-supplied — this module reads no clock itself. Stamped onto every
   *  `currentSupplementary` entry and onto `derivedTopology.computedAt`. */
  observedAt: string;
  fetchLimit?: number;
  /**
   * BOUNDED MEMBERSHIP-RECOVERY PROJECTION (2026-09-04, Track 2 programme-
   * state composition-cost repair — same discipline as
   * `crystalReadiness.ts`'s own `scope: 'full' | 'acquisition-gate'`).
   * Defaults to `'full'` — every EXISTING caller (the retrospective
   * falsification harness, the Validation Programme agent-package route) is
   * completely unaffected.
   *
   * `'membership-only'` skips exactly the two computations
   * `resolveFrozenPredecessorContext` (crystalCohortMembership.ts) never
   * reads: the `knownLimitations` pass (`runCrystalReadinessReport` +
   * `runCrystalStatisticsReport`, the LATTER OF WHICH CALLS
   * `runCrystalReadinessReport` AGAIN internally — so the full-scope path
   * computes the crystal's readiness report, with its O(n²) duplicate-
   * detection and inferential-capacity passes, THREE TIMES for a caller
   * that discards the result) and `derivedTopology`'s intra-crystal edge
   * fetch. Both are needed for EXTERNAL REVIEW (a human reading the
   * manifest wants to know the frozen crystal's limitations and topology);
   * `resolveFrozenPredecessorContext` only ever reads `recoveredInvariants`
   * to recover WHICH invariants the frozen predecessor contains — the hash
   * verification itself, `members`, and `legacyContentVerification` are
   * computed IDENTICALLY in both scopes, by the SAME code, never a second
   * derivation. `knownLimitations`/`derivedTopology` are honest, explicitly
   * empty placeholders in `'membership-only'` scope — never a guessed or
   * partially-computed value — and `manifest.scope` names which mode
   * produced the manifest, so nothing downstream can mistake a bounded
   * projection for the full picture.
   */
  scope?: 'full' | 'membership-only';
}

/**
 * Refuses (returns a manifest with `members: null`, `verifiedAgainstFreeze:
 * false`) if the artifact is missing a content hash, or if the live-domain
 * corpus no longer matches it. Never throws for a substrate read failure —
 * reports it as an unverified manifest, the same fail-closed discipline
 * `runCrystalReadinessReport` uses.
 */
export async function buildFrozenCrystalManifest(
  input: BuildFrozenCrystalManifestInput,
): Promise<FrozenCrystalManifest> {
  const declaration: CrystalDomainDeclaration | null = crystalDomainForExperiment(input.experimentId);
  const crystalDomain = declaration?.domain ?? 'constitutional-reasoning';
  const domainBoundary = declaration?.boundary ?? 'No declared domain boundary is registered for this experiment.';
  const scope = input.scope ?? 'full';

  const base = {
    scope,
    experimentId: input.experimentId,
    artifactId: input.artifact.id,
    crystalDomain,
    frozenContentHash: input.artifact.contentHash ?? '',
    frozenCommitmentHash: input.artifact.commitmentHash ?? '',
    frozenAt: input.artifact.frozenAt ?? '',
    signatories: [...input.artifact.signedBy],
    freezeReceiptRef: input.artifact.receiptId ?? null,
    domainBoundary,
    freezeDisclosure: {
      captured: false as const,
      reason:
        "freezeArtifact() persists only {contentHash, commitmentHash, frozenAt, signedBy} — the freeze ceremony's " +
        'domain-boundary rationale, freeze rationale, known limitations, and population/exclusion disclosure ' +
        '(assignedCohortHash, excludedRecordsHash, excludedRecords) are computed only by the PREVIEW endpoint ' +
        '(admin-only, never run automatically at freeze) and are not linked to or persisted on this artifact. ' +
        'Reporting a live recomputation of them here under this heading would present current state as a frozen ' +
        'historical fact, which this manifest refuses to do.',
    },
  };

  if (!input.artifact.contentHash) {
    return {
      ...base,
      verifiedAgainstFreeze: false,
      verificationDetail: "artifact carries no contentHash — there is nothing to verify a live corpus against.",
      recomputedLiveHash: '',
      memberCount: 0,
      members: null,
      recoveredInvariants: [],
      legacyContentVerification: {
        state: 'unverified',
        byteExact: false,
        frozenAt: base.frozenAt,
        memberCount: 0,
        materialFieldsChecked: [],
        immaterialDriftFields: [],
        blockingGaps: ['artifact carries no contentHash — there is nothing for a legacy verification to be about'],
        reason: 'no contentHash exists on this artifact',
        unresolvedRisk: '',
      },
      derivedTopology: null,
      knownLimitations: [],
    };
  }

  // NO status filter here (bug fixed 2026-08-30, EXP-P1 retrospective
  // artifact-recovery defect). Domain membership (`invariant_contexts`) is
  // independent of, and more durable than, a member's current `status` —
  // `mergeInvariants()` flips a merged duplicate's status to `superseded` but
  // never removes its domain-context row. A `status: ['validated',
  // 'canonical']` filter here silently drops any member that has since been
  // merged/deprecated/reclassified, which is exactly how vP1's frozen
  // 15-member crystal was misread as an 11-member live corpus: 4 members were
  // reviewed and frozen while `validated`, then later merged as duplicates —
  // the SAME status transition Austin's duplication objection was about — and
  // a status-filtered re-query silently excluded precisely the members most
  // relevant to that objection. Frozen-time MEMBERSHIP is recovered here;
  // whether recomputing the hash from members' CURRENT field values
  // (including current status, still hash-covered below, unchanged) equals
  // the frozen commitment is a separate, honestly-reported question — see the
  // mismatch branch below for why status drift alone can defeat hash equality
  // even once membership is exactly recovered.
  let invariants: InvariantRecord[] = [];
  let readError: string | null = null;
  try {
    invariants = await listInvariants({
      domain: crystalDomain,
      limit: input.fetchLimit ?? 500,
    });
  } catch (e) {
    readError = e instanceof Error ? e.message : String(e);
  }

  if (readError) {
    return {
      ...base,
      verifiedAgainstFreeze: false,
      verificationDetail: `could not read the live domain corpus to verify against the frozen hash: ${readError}`,
      recomputedLiveHash: '',
      memberCount: 0,
      members: null,
      recoveredInvariants: [],
      legacyContentVerification: deriveLegacyFreezeVerification({
        verifiedAgainstFreeze: false,
        frozenAt: base.frozenAt,
        invariants: [],
        membershipReadFailed: true,
      }),
      derivedTopology: null,
      knownLimitations: [],
    };
  }

  // The ONE shared projection (services/research/crystalContentProjection.ts)
  // crystalStatistics.ts also hashes — never a second, independently-shaped
  // commitment (inv.engineering.036).
  const recomputedLiveHash = computeCrystalContentHash({
    crystalDomain,
    invariantCount: invariants.length,
    invariants,
  });

  const verifiedAgainstFreeze = recomputedLiveHash === input.artifact.contentHash;

  // Known limitations — real, sourced from the readiness/recommendation
  // engine, computed regardless of verification (it is diagnostic prose, not
  // a member-detail claim, so it is not gated by the hash check).
  //
  // SKIPPED ENTIRELY in 'membership-only' scope (2026-09-04) — this is
  // `runCrystalReadinessReport` (its own O(n²) duplicate-detection +
  // inferential-capacity passes) followed by `runCrystalStatisticsReport`,
  // which calls `runCrystalReadinessReport` AGAIN internally: two full
  // readiness computations over the SAME domain `loadTrack2ProgrammeState`
  // already computed readiness for directly, once, at the top of its own
  // composition — three total, every single programme-state read, for a
  // caller (`resolveFrozenPredecessorContext`) that never reads this field.
  let knownLimitations: string[] = [];
  if (scope === 'full') {
    try {
      const readiness = await runCrystalReadinessReport({ experimentId: input.experimentId, crystalDomain, fetchLimit: input.fetchLimit });
      const recommendation = composeCrystalFreezeRecommendation(
        input.experimentId,
        crystalDomain,
        readiness,
        await runCrystalStatisticsReport({ experimentId: input.experimentId, crystalDomain, fetchLimit: input.fetchLimit }),
      );
      knownLimitations = [...recommendation.remainingRisks];
    } catch {
      knownLimitations = [];
    }
  }

  if (!verifiedAgainstFreeze) {
    // Diagnostic only — never gates or substitutes for the hash check above.
    // A member whose CURRENT status is neither 'validated' nor 'canonical'
    // could not have been part of a freeze-eligible corpus AS THAT STATUS —
    // freezing (crystalStatistics.ts) only ever draws from
    // validated/canonical rows — so such a member has necessarily
    // transitioned (e.g. merged as a duplicate) since some earlier point.
    // Whether that point was BEFORE or AFTER this specific freeze is not
    // itself recoverable from this alone; named here only so a reader can
    // distinguish "membership genuinely differs" from "membership recovered
    // correctly, but a recovered member's current status cannot be proven
    // equal to its status at the freeze instant" — no durable historical
    // status ledger exists to settle the latter, and none is fabricated here.
    const statusDrifted = invariants.filter((inv) => inv.status !== 'validated' && inv.status !== 'canonical');
    const statusNote =
      statusDrifted.length > 0
        ? ` ${statusDrifted.length} of ${invariants.length} recovered member(s) now carry a non-freeze-eligible ` +
          `status (${[...new Set(statusDrifted.map((inv) => inv.status))].join(', ')}) — e.g. merged as a duplicate ` +
          'since freeze. Their statement/namespace/semanticType/provenance are unaffected by such a transition, but ' +
          'their exact status AT THE FREEZE INSTANT is not independently recorded anywhere durable, so byte-exact ' +
          'hash equality cannot be established for them from persisted evidence even though their domain ' +
          'membership is confirmed.'
        : '';
    return {
      ...base,
      verifiedAgainstFreeze: false,
      verificationDetail:
        `the live domain corpus (${invariants.length} member(s)) does NOT reproduce the frozen contentHash — the ` +
        'corpus has moved since this crystal froze (an invariant was edited, added, reclassified, or removed ' +
        "within this domain). Member detail is withheld rather than served from a corpus that is no longer " +
        'provably the one this artifact committed to.' +
        statusNote,
      recomputedLiveHash,
      memberCount: invariants.length,
      members: null,
      recoveredInvariants: invariants,
      legacyContentVerification: deriveLegacyFreezeVerification({
        verifiedAgainstFreeze: false,
        frozenAt: base.frozenAt,
        invariants,
        membershipReadFailed: false,
      }),
      derivedTopology: null,
      knownLimitations,
    };
  }

  // SKIPPED in 'membership-only' scope (2026-09-04) — a second Supabase
  // round trip for a topology `resolveFrozenPredecessorContext` never reads.
  let derivedTopology: FrozenCrystalManifest['derivedTopology'] = null;
  if (scope === 'full') {
    try {
      const { pairs } = await fetchIntraCrystalEdges(invariants);
      derivedTopology = {
        derivedFromFrozenMemberSet: true,
        computedAt: input.observedAt,
        algorithmVersion: INTRA_CRYSTAL_TOPOLOGY_ALGORITHM_VERSION,
        edges: pairs.map(([from, to]) => ({ from, to })),
      };
    } catch {
      derivedTopology = null;
    }
  }

  return {
    ...base,
    verifiedAgainstFreeze: true,
    verificationDetail:
      `the live domain corpus (${invariants.length} member(s)) reproduces the frozen contentHash exactly — the ` +
      'members below are verified to be the frozen set, not a live substitute.',
    recomputedLiveHash,
    memberCount: invariants.length,
    members: invariants.map((inv) => toManifestMember(inv, input.observedAt)),
    recoveredInvariants: invariants,
    legacyContentVerification: deriveLegacyFreezeVerification({
      verifiedAgainstFreeze: true,
      frozenAt: base.frozenAt,
      invariants,
      membershipReadFailed: false,
    }),
    derivedTopology,
    knownLimitations,
  };
}
