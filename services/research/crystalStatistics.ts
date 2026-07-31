/**
 * Crystal Statistics Report — the "birth certificate" for a crystal domain
 * candidate (CFS-054 §3 / PRD-EPI-001 §3.1 Workstream 3).
 *
 * A DESCRIPTIVE report, not a gate: every check that decides pass/fail lives
 * in `runCrystalReadinessReport` (crystalReadiness.ts) and this module reuses
 * its computed figures rather than re-deriving them (inv.engineering.036 —
 * one authoritative computation per concern). This module adds the figures
 * readiness does not already compute: source/document counts, standing
 * distribution, semantic and selection entropy, coverage against the
 * namespace boundary, and the frozen content hash.
 *
 * `frozenHash` is a CONTENT commitment over the corpus as it stands right
 * now — it is NOT a constitutional freeze. Computing this hash, or running
 * this report at all, has no side effect and writes nothing: it never marks
 * anything `frozen`, never calls `freezeArtifact`, and never touches
 * `research_objects`. The word "frozen" in `frozenHash` describes the hash
 * function's property (a snapshot commitment), not an act performed here.
 *
 * Server-only, read-only, pure aggregation over `runCrystalReadinessReport`
 * and `listInvariants` — no new table, no new write path.
 */

import { listInvariants } from '@/services/invariants/store';
import { runCrystalReadinessReport, type CrystalReadinessReport } from '@/services/research/crystalReadiness';
import { readEvidenceProvenance } from '@/services/research/experimentalPopulations';
import { commit } from '@/services/research/review/deterministic';
import { INVARIANT_NAMESPACES } from '@/types/invariants';
import type { InvariantRecord } from '@/types/invariants';

export interface CrystalStatisticsInput {
  experimentId: string;
  crystalDomain?: string;
  fetchLimit?: number;
}

export interface StandingBucket {
  bucket: '0.0–0.2' | '0.2–0.4' | '0.4–0.6' | '0.6–0.8' | '0.8–1.0';
  count: number;
}

export interface CrystalStatisticsReport {
  ok: boolean;
  experimentId: string;
  crystalDomain: string;
  /** Wall-clock time this report was COMPUTED — informational only. Never an
   * input to `frozenHash`, which must be reproducible from corpus content
   * alone regardless of when it is recomputed. */
  computedAt: string;

  // ── Corpus shape ──
  invariantCount: number;
  /** Distinct provenance `source` / `evidence_ids` documents cited across the
   * collection — the closest mechanical proxy this substrate offers for
   * "how many distinct external documents this corpus draws from". */
  sourceCount: number;
  documentCount: number;
  /** The distinct `source` strings themselves, for a human to spot-check —
   * capped defensively so a corpus with degenerate per-row sources cannot
   * blow up a report payload. */
  externalSources: string[];

  // ── Graph shape (reused from crystalReadiness, not re-derived) ──
  relationshipCount: number;
  averageValidationDepth: number;

  // ── Distribution ──
  standingDistribution: StandingBucket[];
  /** Namespace/relationship density — reuses crystalReadiness's
   * relationshipDensity figure verbatim; renamed here to match the operator's
   * "composition density" vocabulary for the statistics report. */
  compositionDensity: number;
  /** Shannon entropy (bits) of the semantic_type distribution — 0 when every
   * invariant shares one shape, higher as shapes diversify. */
  semanticDiversity: number;
  /** Shannon entropy (bits) of the namespace distribution — the same
   * information-theoretic measure applied to WHICH namespaces are
   * represented, used as `selectionEntropy` below and reported once. */
  namespaceDistributionEntropy: number;

  // ── Coverage / headroom (reused from crystalReadiness where computed there) ──
  coverageEstimate: {
    /** Namespaces the ratified INVARIANT_NAMESPACES ontology declares. */
    boundaryNamespaceCount: number;
    /** Namespaces actually represented by ≥1 invariant in this domain. */
    representedNamespaceCount: number;
    ratio: number;
  };
  derivationHeadroom: number;
  sliceRatio: number;
  /** Selection entropy over the domain's own composition — the namespace
   * Shannon entropy, restated under the operator's requested field name so
   * the birth-certificate vocabulary in CFS-054/PRD-EPI-001 §3.1 Workstream 3
   * is satisfied without a second, differently-computed entropy figure. */
  selectionEntropy: number;
  duplicateRatio: number;

  /**
   * Content commitment over the corpus AS IT STANDS — sha256 of a canonical
   * JSON projection of every invariant's (id, statement, namespace,
   * semanticType, provenance, status) sorted by id. Deterministic: same
   * corpus content, same hash, on any machine, at any time. NOT a
   * constitutional freeze (see module doc) and NOT persisted by this
   * function.
   */
  frozenHash: string;

  /** Present only when the underlying readiness report could not read the
   * substrate — mirrors crystalReadiness's own honest-degradation contract
   * rather than throwing. */
  substrateError: string | null;
}

function shannonEntropyBits(counts: readonly number[]): number {
  const total = counts.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  let entropy = 0;
  for (const c of counts) {
    if (c <= 0) continue;
    const p = c / total;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

function bucketStanding(invariants: readonly InvariantRecord[]): StandingBucket[] {
  const edges: Array<[number, number, StandingBucket['bucket']]> = [
    [0, 0.2, '0.0–0.2'],
    [0.2, 0.4, '0.2–0.4'],
    [0.4, 0.6, '0.4–0.6'],
    [0.6, 0.8, '0.6–0.8'],
    [0.8, 1.0001, '0.8–1.0'],
  ];
  return edges.map(([lo, hi, bucket]) => ({
    bucket,
    count: invariants.filter((inv) => inv.standing >= lo && inv.standing < hi).length,
  }));
}

/** Distinct source documents, read the same way `readEvidenceProvenance`'s
 * siblings read provenance bags — `provenance.source` when present, falling
 * back to `provenance.evidence_ids` entries so an IDE-discovered invariant
 * with no free-text `source` still contributes its evidence refs. Neither a
 * guess nor an invention: every value returned is copied verbatim from the
 * record's own provenance bag. */
function extractSourceRefs(provenance: Record<string, unknown> | null | undefined): string[] {
  if (!provenance) return [];
  const refs: string[] = [];
  if (typeof provenance.source === 'string' && provenance.source.trim()) {
    refs.push(provenance.source.trim());
  }
  if (Array.isArray(provenance.evidence_ids)) {
    for (const v of provenance.evidence_ids) {
      if (typeof v === 'string' && v.trim()) refs.push(v.trim());
    }
  }
  return refs;
}

export async function runCrystalStatisticsReport(
  input: CrystalStatisticsInput,
): Promise<CrystalStatisticsReport> {
  const crystalDomain = input.crystalDomain ?? 'constitutional-reasoning';
  const readiness: CrystalReadinessReport = await runCrystalReadinessReport({
    experimentId: input.experimentId,
    crystalDomain,
    fetchLimit: input.fetchLimit,
  });

  const substrateError =
    readiness.checks.length === 1 && readiness.checks[0].name === 'invariant-fetch'
      ? readiness.checks[0].detail
      : null;

  let invariants: InvariantRecord[] = [];
  if (!substrateError) {
    // Re-fetch is unavoidable: runCrystalReadinessReport does not export the
    // raw rows, only its derived report. Same filter, so the two reports
    // describe the identical collection.
    try {
      invariants = await listInvariants({
        domain: crystalDomain,
        status: ['validated', 'canonical'],
        limit: input.fetchLimit ?? 500,
      });
    } catch {
      invariants = [];
    }
  }

  const invariantCount = invariants.length;
  const sourceRefSets = invariants.map((inv) => extractSourceRefs(inv.provenance));
  const allSourceRefs = sourceRefSets.flat();
  const distinctSources = [...new Set(allSourceRefs)].sort();

  const semanticCounts = new Map<string, number>();
  const namespaceCounts = new Map<string, number>();
  for (const inv of invariants) {
    const s = inv.semanticType ?? 'unspecified';
    semanticCounts.set(s, (semanticCounts.get(s) ?? 0) + 1);
    namespaceCounts.set(inv.namespace, (namespaceCounts.get(inv.namespace) ?? 0) + 1);
  }
  const namespaceEntropy = shannonEntropyBits([...namespaceCounts.values()]);
  const semanticEntropy = shannonEntropyBits([...semanticCounts.values()]);

  const averageValidationDepth =
    invariantCount > 0
      ? invariants.reduce((sum, inv) => sum + (inv.timesValidated ?? 0), 0) / invariantCount
      : 0;

  const maxPossiblePairs = invariantCount > 1 ? (invariantCount * (invariantCount - 1)) / 2 : 0;
  const duplicateRatio =
    maxPossiblePairs > 0 ? readiness.duplicatePairCount / maxPossiblePairs : 0;

  const representedNamespaces = new Set(invariants.map((inv) => inv.namespace));
  const boundaryNamespaceCount = INVARIANT_NAMESPACES.length;
  const coverageRatio =
    boundaryNamespaceCount > 0 ? representedNamespaces.size / boundaryNamespaceCount : 0;

  const sliceRatio = invariantCount > 0 ? Math.floor(invariantCount * 0.4) / invariantCount : 0;

  // Deterministic content commitment. Sorted by id so member ORDER never
  // affects the hash — only membership and content do. Provenance is
  // canonicalized via `commit`'s own canonicalJson, so key order inside a
  // provenance bag cannot change the hash either.
  const sortedForHash = [...invariants]
    .map((inv) => ({
      id: inv.id,
      statement: inv.statement,
      namespace: inv.namespace,
      semanticType: inv.semanticType,
      status: inv.status,
      evidenceProvenance: readEvidenceProvenance(inv.provenance),
      provenance: inv.provenance,
    }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const frozenHash = commit({ crystalDomain, invariantCount, members: sortedForHash });

  return {
    ok: readiness.ok,
    experimentId: input.experimentId,
    crystalDomain,
    computedAt: new Date().toISOString(),
    invariantCount,
    sourceCount: distinctSources.length,
    documentCount: distinctSources.length,
    externalSources: distinctSources.slice(0, 200),
    relationshipCount: readiness.graph.relationshipCount,
    averageValidationDepth,
    standingDistribution: bucketStanding(invariants),
    compositionDensity: readiness.graph.relationshipDensity,
    semanticDiversity: semanticEntropy,
    namespaceDistributionEntropy: namespaceEntropy,
    coverageEstimate: {
      boundaryNamespaceCount,
      representedNamespaceCount: representedNamespaces.size,
      ratio: coverageRatio,
    },
    derivationHeadroom: readiness.derivationEligibleFraction,
    sliceRatio,
    selectionEntropy: namespaceEntropy,
    duplicateRatio,
    frozenHash,
    substrateError,
  };
}
