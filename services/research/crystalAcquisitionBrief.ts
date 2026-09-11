/**
 * CrystalAcquisitionBrief — ONE coordinated corpus-enlargement objective,
 * consolidating the three freeze-blocking `additional-acquisition-required`
 * checks (`selection-space`, `derivation-headroom`, `boundary-coverage`) into
 * a single server-derived target (Defect 2, 2026-08-27 "Crystal freeze-gating
 * continuation" review pass).
 *
 * ── WHY ONE BRIEF, NOT THREE ─────────────────────────────────────────────────
 *
 * `services/research/crystalInstrumentSuite.ts`'s `CRYSTAL_READINESS_CHECK_
 * CONTRACT` already routes all three of these checks to the SAME remediation
 * stage anchor (`discover-sources`) — they are not three independent gaps,
 * they are three MEASUREMENTS of the same underlying deficiency: the crystal
 * does not yet hold enough admissible, well-formed, namespace-diverse
 * material. Acquiring toward the missing namespaces with a bias toward
 * relationally-structured statements simultaneously narrows all three
 * deficits (and the collection-size deficit narrows the entailment-chain and
 * relational-member deficits too, since both are combinatorial floors over
 * the same slice). Building three separate acquisition runs would waste
 * acquisition capacity on redundant material and give no operator a single
 * place to see the combined target.
 *
 * ── EVERY NUMBER HERE IS READ, NEVER RECOMPUTED ──────────────────────────────
 *
 * This module performs NO readiness arithmetic of its own — every figure is
 * read off an ALREADY-COMPUTED `CrystalReadinessReport`
 * (`crystalReadiness.ts::runCrystalReadinessReport`), which itself reads
 * `CrystalPopulationRequirement` (`crystalPopulationRequirement.ts`) and
 * `InferentialCapacityAssessment` (`crystalSemanticStructure.ts`). A second,
 * independent derivation here would be exactly the "two subsystems disagree
 * about the same canonical state" defect class this codebase's own
 * `inv.engineering.036`/`037` exists to forbid. Pure function, no I/O — the
 * caller (the API route) does the fetching.
 */

import { createHash } from 'crypto';
import type { CrystalReadinessReport } from '@/services/research/crystalReadiness';
import type { CrystalDomainDeclaration } from '@/services/research/crystalDomains';
import type { RelationalStructure } from '@/services/research/crystalSemanticStructure';

/** One freeze-gating check folded into the combined brief, named against the
 *  EXACT readiness check it completes — never a paraphrase a reader would
 *  have to reconcile against the readiness report by hand. */
export interface CrystalAcquisitionCompletionCriterion {
  /** The readiness check's own name (`crystalInstrumentSuite.ts`'s contract) —
   *  a caller can look this check up in the SAME readiness report and find
   *  the identical name, never a renamed alias. */
  checkName: string;
  /** Current measure, in the check's own units — e.g. "11 distinct members",
   *  "2/15 namespaces represented". Prose, because the three checks measure
   *  incommensurable things and a single numeric column would misrepresent
   *  that. */
  currentMeasure: string;
  /** Required measure, same units. */
  requiredMeasure: string;
  /** The check's own `remedy` text, VERBATIM (never re-worded — the codebase's
   *  existing convention: `inv.engineering.036`). `null` only if the check
   *  already passed at brief-generation time (should not occur for a check
   *  that put this brief in play, kept only so the type does not lie about
   *  what `runCrystalReadinessReport` can return). */
  remedy: string | null;
  /** True once this exact check passes on the readiness report the brief was
   *  built from. A brief is generated for FAILING checks; this is always
   *  `false` at generation time and exists so a later re-read of the SAME
   *  brief shape (e.g. after a partial acquisition round) can report progress
   *  without a second type. */
  satisfied: boolean;
}

export interface StructuralDiversityOpportunity {
  /** Whether the caller asked for this optional maturity signal to ride along
   *  with the plan. Never forced — `structural-diversity` is informational,
   *  never a freeze blocker (see crystalInstrumentSuite.ts's contract). */
  included: boolean;
  /** Human-readable state of the check at brief-generation time. */
  detail: string;
}

export interface CrystalAcquisitionBrief {
  experimentId: string;
  /** The active Crystal artifact this brief targets — e.g.
   *  `currentCrystalArtifactId(experimentId)`'s return value. A brief is
   *  scoped to ONE generation; a new generation needs a new brief. */
  crystalGeneration: string;
  domain: string;
  /** What was generated FROM — so a consumer can tell whether this brief is
   *  still current against a later readiness read. */
  readinessReportRef: {
    invariantCount: number;
    generatedAt: string;
  };
  /** selection-space — the raw collection-size deficit. NEVER hardcoded:
   *  `max(0, minimumCollectionSize - invariantCount)`, both operands read off
   *  the SAME readiness report. */
  requiredNetNewDistinctMembers: number;
  currentDistinctMemberCount: number;
  minimumCollectionSize: number;
  /** boundary-coverage. */
  representedNamespaces: readonly string[];
  missingNamespaces: readonly string[];
  boundaryNamespaceCount: number;
  /** derivation-headroom. */
  requiredEntailmentChains: number;
  currentEntailmentChainCount: number;
  entailmentChainDeficit: number;
  requiredRelationalMembersInSlice: number;
  currentRelationalMemberCount: number;
  /** Relational structures the collection currently asserts NONE of — the
   *  acquisition target for "statements expressing explicit mechanisms". */
  deficientRelationalStructures: readonly RelationalStructure[];
  /** Population A / lifecycle-eligibility constraints, read off the ratified
   *  domain declaration — never invented here. */
  sourceAdmissibilityConstraints: readonly string[];
  /** Already-admitted invariant ids — the dedup list for reacquisition. Named
   *  at invariant granularity because that is the granularity
   *  `duplicate-detection` itself dedups at (statement-level, not a
   *  source-URL field this codebase does not reliably carry on
   *  `InvariantRecord.provenance`). */
  alreadyAdmittedInvariantIds: readonly string[];
  /** Optional — only present when the caller asked for it (informational
   *  maturity, never a Freeze gate). */
  structuralDiversityOpportunity: StructuralDiversityOpportunity | null;
  /** Tied 1:1 to the three failing freeze-gating checks that produced this
   *  brief — completion is defined as ALL of these reporting `satisfied` on
   *  a later re-read, nothing else. */
  completionCriteria: readonly CrystalAcquisitionCompletionCriterion[];
  generatedAt: string;
}

const FREEZE_BLOCKING_ACQUISITION_CHECK_NAMES = [
  'selection-space',
  'derivation-headroom',
  'boundary-coverage',
] as const;

export interface BuildCrystalAcquisitionBriefInput {
  experimentId: string;
  crystalGeneration: string;
  domain: CrystalDomainDeclaration;
  report: CrystalReadinessReport;
  /** ids of invariants already admitted to this crystal's domain — read by
   *  the caller (e.g. the same `listInvariants` call the readiness report
   *  itself used), never re-fetched here. */
  admittedInvariantIds: readonly string[];
  /** Fold the structural-diversity maturity signal into the plan — an
   *  explicit operator choice ("Include in acquisition plan"), defaulting to
   *  false so the brief never silently ships an optional signal the operator
   *  did not ask for. */
  includeStructuralDiversity?: boolean;
  now?: () => Date;
}

/**
 * Builds the ONE combined acquisition objective from an already-computed
 * readiness report. Deterministic given its inputs (the only non-determinism,
 * `generatedAt`, is injectable for tests via `now`).
 */
export function buildCrystalAcquisitionBrief(input: BuildCrystalAcquisitionBriefInput): CrystalAcquisitionBrief {
  const { report, domain } = input;
  const now = (input.now ?? (() => new Date()))().toISOString();

  const checkByName = new Map(report.checks.map((c) => [c.name, c] as const));

  const minimumCollectionSize = report.populationRequirement.minimumCollectionSize ?? 0;
  const requiredNetNewDistinctMembers = Math.max(0, minimumCollectionSize - report.invariantCount);

  const requiredEntailmentChains = report.populationRequirement.requiredEntailmentChains ?? 0;
  const currentEntailmentChainCount = report.inferentialCapacity.entailmentChainCount;
  const entailmentChainDeficit = Math.max(0, requiredEntailmentChains - currentEntailmentChainCount);

  const requiredRelationalMembersInSlice = report.populationRequirement.requiredRelationalMembersInSlice ?? 0;
  const currentRelationalMemberCount = report.inferentialCapacity.relationalMemberCount;

  const completionCriteria: CrystalAcquisitionCompletionCriterion[] = FREEZE_BLOCKING_ACQUISITION_CHECK_NAMES
    .map((name): CrystalAcquisitionCompletionCriterion | null => {
      const check = checkByName.get(name);
      if (!check) return null;
      const currentMeasure =
        name === 'selection-space'
          ? `${report.invariantCount} distinct member(s)`
          : name === 'derivation-headroom'
            ? `${currentEntailmentChainCount} entailment chain(s), ${currentRelationalMemberCount} relationally-structured member(s)`
            : `${report.coverage.representedNamespaceCount}/${report.coverage.boundaryNamespaceCount} namespaces represented`;
      const requiredMeasure =
        name === 'selection-space'
          ? `${minimumCollectionSize} distinct member(s)`
          : name === 'derivation-headroom'
            ? `${requiredEntailmentChains} entailment chain(s), ${requiredRelationalMembersInSlice} relationally-structured member(s)`
            : `${report.coverage.boundaryNamespaceCount}/${report.coverage.boundaryNamespaceCount} namespaces represented`;
      return {
        checkName: name,
        currentMeasure,
        requiredMeasure,
        remedy: check.remedy,
        satisfied: check.passed,
      };
    })
    .filter((c): c is CrystalAcquisitionCompletionCriterion => c !== null);

  const structuralDiversityCheck = checkByName.get('structural-diversity') ?? null;
  const structuralDiversityOpportunity: StructuralDiversityOpportunity | null =
    input.includeStructuralDiversity && structuralDiversityCheck
      ? { included: true, detail: structuralDiversityCheck.detail }
      : null;

  return {
    experimentId: input.experimentId,
    crystalGeneration: input.crystalGeneration,
    domain: domain.domain,
    readinessReportRef: {
      invariantCount: report.invariantCount,
      generatedAt: now,
    },
    requiredNetNewDistinctMembers,
    currentDistinctMemberCount: report.invariantCount,
    minimumCollectionSize,
    representedNamespaces: report.coverage.representedNamespaces,
    missingNamespaces: report.coverage.missingNamespaces,
    boundaryNamespaceCount: report.coverage.boundaryNamespaceCount,
    requiredEntailmentChains,
    currentEntailmentChainCount,
    entailmentChainDeficit,
    requiredRelationalMembersInSlice,
    currentRelationalMemberCount,
    deficientRelationalStructures: report.inferentialCapacity.structuresAbsent,
    sourceAdmissibilityConstraints: [
      `Lifecycle state: ${domain.eligibleStatuses.join(' or ')}`,
      `Evidence provenance: ${domain.eligibleProvenance.join(' or ')} (Population A only)`,
      `Declared boundary: ${domain.boundary}`,
      ...domain.exclusions.map((e) => `Excluded: ${e}`),
    ],
    alreadyAdmittedInvariantIds: input.admittedInvariantIds,
    structuralDiversityOpportunity,
    completionCriteria,
    generatedAt: now,
  };
}

/** Whether the three freeze-blocking acquisition checks are ALL what this
 *  brief exists to consolidate — used by the UI to decide whether to offer
 *  the combined "Build targeted acquisition plan" action instead of the
 *  old per-check links. Reads the SAME check-name list this module targets;
 *  never a second list. */
export function acquisitionBriefApplies(report: CrystalReadinessReport): boolean {
  return FREEZE_BLOCKING_ACQUISITION_CHECK_NAMES.some((name) => {
    const check = report.checks.find((c) => c.name === name);
    return check ? !check.passed : false;
  });
}

export { FREEZE_BLOCKING_ACQUISITION_CHECK_NAMES };

/**
 * THE APPROVAL'S DURABLE IDENTITY (2026-08-31, "approve targeted acquisition
 * can never re-ask after a judgement is consumed" repair, operator
 * requirement: "a durable identity such as experimentId + crystalVersion/
 * successor + acquisitionBriefHash").
 *
 * A one-way, deterministic digest of exactly the fields that define WHAT was
 * targeted — never `generatedAt`/`readinessReportRef.generatedAt` (those are
 * provenance timestamps, not target content; hashing them would make every
 * brief unique regardless of whether the target actually changed, defeating
 * the whole point of the hash). Two briefs for the SAME crystal generation
 * with the SAME deficits hash identically, so a steward re-approving an
 * UNCHANGED plan is recognised as the exact same judgement already made —
 * never a coincidence match, never a re-derivation of what "changed" means
 * (this IS that definition). Not a security boundary — a stable content
 * fingerprint, mirroring the T2-safe-commitment PATTERN this codebase uses
 * elsewhere for stable references, not its threat model.
 */
export function hashAcquisitionBrief(brief: CrystalAcquisitionBrief): string {
  const canonical = JSON.stringify({
    experimentId: brief.experimentId,
    crystalGeneration: brief.crystalGeneration,
    domain: brief.domain,
    requiredNetNewDistinctMembers: brief.requiredNetNewDistinctMembers,
    minimumCollectionSize: brief.minimumCollectionSize,
    missingNamespaces: [...brief.missingNamespaces].sort(),
    boundaryNamespaceCount: brief.boundaryNamespaceCount,
    requiredEntailmentChains: brief.requiredEntailmentChains,
    entailmentChainDeficit: brief.entailmentChainDeficit,
    requiredRelationalMembersInSlice: brief.requiredRelationalMembersInSlice,
    deficientRelationalStructures: [...brief.deficientRelationalStructures].sort(),
    sourceAdmissibilityConstraints: [...brief.sourceAdmissibilityConstraints].sort(),
  });
  return createHash('sha256').update(canonical).digest('hex').slice(0, 32);
}
