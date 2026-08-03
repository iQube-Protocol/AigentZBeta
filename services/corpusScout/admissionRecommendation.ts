/**
 * Corpus Scout (PRD-ICA-001) Track 2 Stage 2 — admission RECOMMENDATION
 * (2026-08-03, operator correction of the same day).
 *
 * ── What this module is NOT ─────────────────────────────────────────────────
 *
 * It is NOT a fresh domain classifier that re-guesses a source's subject from
 * its title or extracted text. The platform already has domain/sub-domain
 * classifications, invariant-to-subdomain associations, parent-child
 * relationships and source→invariant lineage — see
 * `services/invariants/discoveryEngine.ts`'s `buildDomainLineageIndex` /
 * `deriveSourceLineage`, which resolve the SAME `discovery_evidence
 * .source_ref` join `suggestClassification` already performs, walked in the
 * opposite direction. This module AGGREGATES that existing intelligence back
 * onto a pending candidate source. Only when a source has NO usable lineage
 * at all does it fall back to the source's own already-recorded acquisition
 * fields — never to a fresh content guess — and that fallback is always
 * labelled `provisional` and capped below the review threshold.
 *
 * ── What this module writes ──────────────────────────────────────────────────
 *
 * Nothing. `composeAdmissionRecommendation` is pure — no I/O, no clock. It
 * PREPARES a recommendation; only an explicit steward "Ratify" action (which
 * posts to the EXISTING `POST /api/corpus-scout/candidates/bulk-review` route,
 * through `applyCandidateReviewDecision` — see `reviewDecision.ts`) writes
 * anything governed. No source is ever admitted merely because this module
 * recommended it.
 *
 * ── The vocabulary is NOT restated ──────────────────────────────────────────
 *
 * `RecommendedAdmissionClass` maps onto the EXISTING `ReviewDecision` union
 * (`reviewDecision.ts`) via `RECOMMENDATION_TO_REVIEW_DECISION` — it does not
 * declare a competing decision vocabulary. `manual review required` is the
 * one addition, and it deliberately has NO mapping: it is not a decision, it
 * is the absence of one the machine is willing to offer.
 *
 * ── Admission class is judged independently of subdomain placement ─────────
 *
 * Evidentiary eligibility (is this good enough to admit, and as what grade)
 * is computed from SOURCE-QUALITY signals already on the row — extraction
 * status, artifact-hash presence, duplicate-group membership, institutional
 * tier. It is NOT inferred from which subdomain the source's lineage lands
 * in; a source can be confidently `general finance` in an undetermined
 * subdomain, or `manual review required` in a well-attested one.
 *
 * ── Scope this module does NOT claim ────────────────────────────────────────
 *
 * `reject_out_of_domain`, `reject_provenance` and `reject_access_or_license`
 * are part of the mapped vocabulary but are NEVER machine-recommended here —
 * none of the signals this module reads (extraction status, hash presence,
 * duplicate membership, institutional tier, a free-text `licenseStatus` with
 * no ratified enum) supports asserting topical fit, provenance failure, or a
 * licence prohibition without guessing. This is a deliberate, reported scope
 * limit (CLAUDE.md's "No Guessing" rule), not an oversight.
 */

import type { ReviewDecision } from './reviewDecision';
import type { SourceTier } from './institutionalRegistry';
import type { StructuralValueTag } from './types';
import type { SourceLineageInvariant } from '@/services/invariants/discoveryEngine';

// ── The recommendation vocabulary — mapped onto the ratified one, never restated ──

export type RecommendedAdmissionClass =
  | 'EXP-P1 evidence'
  | 'general finance'
  | 'reference only'
  | 'reject — out of domain'
  | 'reject — low substance'
  | 'reject — provenance'
  | 'reject — access or licence'
  | 'manual review required';

export const RECOMMENDED_ADMISSION_CLASSES: readonly RecommendedAdmissionClass[] = [
  'EXP-P1 evidence',
  'general finance',
  'reference only',
  'reject — out of domain',
  'reject — low substance',
  'reject — provenance',
  'reject — access or licence',
  'manual review required',
];

/** The ONLY place a recommended class is translated into the ratified
 *  `ReviewDecision` vocabulary (`reviewDecision.ts`) — never a second map.
 *  `manual review required` has NO entry: it is not a decision, it is the
 *  absence of one this module is willing to offer. */
export const RECOMMENDATION_TO_REVIEW_DECISION: Readonly<Partial<Record<RecommendedAdmissionClass, ReviewDecision>>> = {
  'EXP-P1 evidence': 'approve_exp_p1',
  'general finance': 'approve_general_finance',
  'reference only': 'approve_reference_only',
  'reject — out of domain': 'reject_out_of_domain',
  'reject — low substance': 'reject_low_substance',
  'reject — provenance': 'reject_provenance',
  'reject — access or licence': 'reject_access_or_license',
};

/** The classes this module recommends ONLY when the source is being admitted
 *  as usable evidence — subdomain-placement confidence matters for these and
 *  ONLY these (a rejected or unresolved source is not being placed anywhere). */
const ADMIT_CLASSES: ReadonlySet<RecommendedAdmissionClass> = new Set([
  'EXP-P1 evidence', 'general finance', 'reference only',
]);

// ── Confidence policy — DEFAULTS, named and documented, not magic numbers ───

/** ≥ this → included in the recommended batch automatically. Configurable;
 *  not a constitutional constant. */
export const CONFIDENCE_AUTO_INCLUDE_THRESHOLD = 0.85;
/** [this, AUTO_INCLUDE) → included but highlighted for review. Below this →
 *  the exception queue. Configurable. */
export const CONFIDENCE_MANUAL_REVIEW_THRESHOLD = 0.6;
/** A PROVISIONAL (no-lineage, content-only) recommendation is ALWAYS capped
 *  at or below this — strictly below `CONFIDENCE_MANUAL_REVIEW_THRESHOLD| —
 *  so it always routes to the exception queue regardless of how strong its
 *  own content-only signals look. A provisional guess must never be able to
 *  present as equivalent to a graph-derived classification. */
export const PROVISIONAL_CONFIDENCE_CAP = 0.5;
/** Lineage-derived domain confidence range: from a badly split lineage
 *  (`LINEAGE_CONFIDENCE_FLOOR`) to a fully-agreeing one
 *  (`LINEAGE_CONFIDENCE_CEILING`). Neither end is 0 or 1 — a split lineage is
 *  still real corpus lineage, and full agreement among a handful of family
 *  groups is still a machine recommendation, not certainty. */
export const LINEAGE_CONFIDENCE_FLOOR = 0.55;
export const LINEAGE_CONFIDENCE_CEILING = 0.95;

/** Source-quality penalties applied to the ADMISSION-CLASS confidence
 *  (independent of domain/subdomain confidence — see the module doc). */
const EXTRACTION_WARNING_PENALTY = 0.15;
const UNDECLARED_TIER_PENALTY = 0.2;
const LICENSE_UNKNOWN_PENALTY = 0.05;
/** Forced ceiling for classes that require a human to resolve — a duplicate,
 *  a below-threshold extraction, or a missing artifact hash. These are never
 *  allowed to read as auto-includable however clean the other signals are. */
const FORCED_MANUAL_REVIEW_CONFIDENCE = 0.45;

export type ReviewTier = 'auto-include' | 'needs-review' | 'exception';

function reviewTierFor(admissionClass: RecommendedAdmissionClass, confidence: number): ReviewTier {
  if (admissionClass === 'manual review required') return 'exception';
  if (confidence < CONFIDENCE_MANUAL_REVIEW_THRESHOLD) return 'exception';
  if (confidence < CONFIDENCE_AUTO_INCLUDE_THRESHOLD) return 'needs-review';
  return 'auto-include';
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function round2(n: number): number {
  return Math.round(clamp01(n) * 100) / 100;
}

// ── Admission-class judgment — SOURCE-QUALITY signals only ──────────────────

/** The source-quality fields the admission-class judgment reads. All of them
 *  already exist on `CandidateSourceRow` / are already computed by the
 *  existing Track 2 review-queue logic (`findDuplicateCandidates`,
 *  `findRegistryEntry`) — nothing here re-derives them. */
export interface SourceQualitySignals {
  sourceId: string;
  campaignDomain: string;
  campaignSubDomain: string | null;
  issuer: string | null;
  extractionStatus: 'pending' | 'ok' | 'below-threshold' | 'failed';
  artifactHash: string | null;
  extractionWarnings: readonly string[];
  structuralTags: readonly StructuralValueTag[];
  licenseStatus: string;
  /** From the EXISTING `findDuplicateCandidates` (`intelligence.ts`), computed
   *  by the caller over the batch being prepared — never re-derived here. */
  isDuplicate: boolean;
  /** From the EXISTING `findRegistryEntry` (`institutionalRegistry.ts`),
   *  keyed by (campaignDomain, campaignSubDomain, issuer) by the caller.
   *  `null` = undeclared, never assumed authoritative. */
  institutionalTier: SourceTier | null;
}

interface AdmissionClassResult {
  admissionClass: RecommendedAdmissionClass;
  /** Confidence in the admission-class judgment ALONE (0..1) — combined with
   *  domain confidence only for the ADMIT classes; see `composeAdmissionRecommendation`. */
  confidence: number;
  evidenceUsed: string[];
  warnings: string[];
}

function deriveAdmissionClass(source: SourceQualitySignals): AdmissionClassResult {
  const evidenceUsed: string[] = [
    `extraction status: ${source.extractionStatus}`,
    source.artifactHash ? 'artifact hash present (byte-verified)' : 'no artifact hash recorded — bytes were never byte-verified',
    source.institutionalTier
      ? `institutional tier: ${source.institutionalTier} (ratified Institutional Registry, ${source.campaignDomain}/${source.campaignSubDomain ?? '—'} · ${source.issuer ?? '—'})`
      : `institutional tier: undeclared — no ratified registry entry for ${source.issuer ?? 'this issuer'} on this pillar`,
    `licence status: ${source.licenseStatus}`,
  ];
  if (source.extractionWarnings.length > 0) {
    evidenceUsed.push(`${source.extractionWarnings.length} extraction warning(s) recorded on the source`);
  }
  const warnings: string[] = [];

  // A canonical-copy choice among exact duplicates is a per-source judgment
  // the existing review UI already refuses to make automatically ("only the
  // steward can say which copy is canonical") — the recommender inherits the
  // same refusal rather than picking one for them.
  if (source.isDuplicate) {
    warnings.push('This source is a member of an exact-duplicate group — a canonical-copy choice is reserved to the steward.');
    return { admissionClass: 'manual review required', confidence: FORCED_MANUAL_REVIEW_CONFIDENCE, evidenceUsed, warnings };
  }

  // A measured fact, not a guess: no usable text was extracted at all.
  if (source.extractionStatus === 'failed') {
    return { admissionClass: 'reject — low substance', confidence: 0.9, evidenceUsed, warnings };
  }
  if (source.extractionStatus === 'below-threshold') {
    warnings.push('Extraction fell below the substantive-content threshold — a human should read the excerpt before a reject is recorded.');
    return { admissionClass: 'manual review required', confidence: FORCED_MANUAL_REVIEW_CONFIDENCE, evidenceUsed, warnings };
  }
  if (!source.artifactHash) {
    warnings.push('No artifact hash was recorded — this source was never byte-verified, so its provenance cannot be confirmed automatically.');
    return { admissionClass: 'manual review required', confidence: FORCED_MANUAL_REVIEW_CONFIDENCE, evidenceUsed, warnings };
  }

  let confidence = 1;
  if (source.extractionWarnings.length > 0) confidence -= EXTRACTION_WARNING_PENALTY;
  if (source.licenseStatus === 'unknown') confidence -= LICENSE_UNKNOWN_PENALTY;

  if (source.institutionalTier === 'institutional-authority') {
    return { admissionClass: 'EXP-P1 evidence', confidence: clamp01(confidence), evidenceUsed, warnings };
  }
  if (source.institutionalTier === 'practitioner-pattern') {
    return { admissionClass: 'general finance', confidence: clamp01(confidence), evidenceUsed, warnings };
  }
  // Tier undeclared — a conservative under-claim (reference only, never
  // ingested as evidence) rather than an assumed authority.
  warnings.push('No ratified Institutional Registry entry declares a tier for this issuer on this pillar — recommended conservatively as reference only.');
  return { admissionClass: 'reference only', confidence: clamp01(confidence - UNDECLARED_TIER_PENALTY), evidenceUsed, warnings };
}

// ── Domain/sub-domain recommendation — aggregated from EXISTING lineage ─────

export const DOMAIN_BASELINE_LABEL = '(domain baseline — no sub-domain)';

/** ONE (sub-domain) group across a source's lineage. `familyCount` — the
 *  count Law-II-style aggregation actually ranks by — is the number of
 *  DISTINCT parent-family keys among the group's invariants, so several
 *  children that all `specializes` the SAME parent count as ONE branch, not
 *  N independent votes (2026-08-03 operator correction: a decomposed branch
 *  must not numerically overwhelm a source's classification). */
export interface SubDomainLineageGroup {
  subDomain: string | null;
  label: string;
  individualCount: number;
  familyCount: number;
  invariantIds: string[];
}

/** Siblings under the SAME parent set are one family; an invariant with no
 *  parent yet (unpromoted, or a promoted root) is its own family. Two
 *  invariants sharing only SOME of several parents are conservatively kept
 *  as different families — merging on partial overlap would overstate
 *  agreement the graph does not actually assert. */
function familyKeyFor(item: SourceLineageInvariant): string {
  return item.parentIds.length > 0 ? `parents:${[...item.parentIds].sort().join('|')}` : `root:${item.id}`;
}

/** Group a source's lineage by sub-domain, ranked by family support first
 *  (the anti-domination mechanism), individual count second, label third for
 *  determinism. Pure — exported so the family-grouping discipline itself is
 *  directly testable, independent of the rest of the recommendation. */
export function groupLineageBySubDomain(lineage: readonly SourceLineageInvariant[]): SubDomainLineageGroup[] {
  const groups = new Map<string, { subDomain: string | null; label: string; ids: Set<string>; families: Set<string> }>();
  for (const item of lineage) {
    const key = item.subDomain ?? ' ';
    let g = groups.get(key);
    if (!g) {
      g = { subDomain: item.subDomain, label: item.subDomain ?? DOMAIN_BASELINE_LABEL, ids: new Set(), families: new Set() };
      groups.set(key, g);
    }
    g.ids.add(item.id);
    g.families.add(familyKeyFor(item));
  }
  return [...groups.values()]
    .map((g) => ({ subDomain: g.subDomain, label: g.label, individualCount: g.ids.size, familyCount: g.families.size, invariantIds: [...g.ids] }))
    .sort((a, b) => b.familyCount - a.familyCount || b.individualCount - a.individualCount || a.label.localeCompare(b.label));
}

interface DomainRecommendationResult {
  primaryDomain: string;
  primarySubDomain: string | null;
  secondarySubDomains: SubDomainLineageGroup[];
  confidence: number;
  provisional: boolean;
  evidenceUsed: string[];
}

function deriveDomainRecommendation(
  source: Pick<SourceQualitySignals, 'campaignDomain' | 'campaignSubDomain' | 'structuralTags'>,
  lineage: readonly SourceLineageInvariant[],
): DomainRecommendationResult {
  if (lineage.length === 0) {
    // Step 7 fallback: content-only inference, and ONLY from data already
    // recorded on this source's own row — never a fresh guess at a label not
    // already present somewhere in the corpus. The primary sub-domain is the
    // source's OWN campaignSubDomain, verbatim, because that value was
    // already recorded at acquisition review time; nothing is invented.
    const evidenceUsed = [
      "no discovery-engine lineage was found for this source's canonical URL — no candidate or promoted invariant traces back to it yet",
      source.campaignSubDomain
        ? `recorded acquisition sub-domain (Corpus Scout review, NOT corpus lineage): '${source.campaignSubDomain}'`
        : 'no acquisition sub-domain was recorded on this source either',
      source.structuralTags.length > 0
        ? `structural-value tags already recorded on the source: ${source.structuralTags.join(', ')}`
        : 'no structural-value tags were recorded on the source',
    ];
    // A small, deterministic, capped heuristic — never allowed near or above
    // PROVISIONAL_CONFIDENCE_CAP regardless of how many tags are present.
    const tagBonus = Math.min(source.structuralTags.length, 4) * 0.05;
    const confidence = Math.min(PROVISIONAL_CONFIDENCE_CAP, 0.25 + tagBonus);
    return {
      primaryDomain: source.campaignDomain,
      primarySubDomain: source.campaignSubDomain,
      secondarySubDomains: [],
      confidence,
      provisional: true,
      evidenceUsed,
    };
  }

  const groups = groupLineageBySubDomain(lineage);
  const [primary, ...secondary] = groups;
  const totalFamilies = groups.reduce((sum, g) => sum + g.familyCount, 0) || 1;
  const confidence =
    LINEAGE_CONFIDENCE_FLOOR + (LINEAGE_CONFIDENCE_CEILING - LINEAGE_CONFIDENCE_FLOOR) * (primary.familyCount / totalFamilies);

  const evidenceUsed = [
    `${lineage.length} lineage item(s) traced back to this source across ${groups.length} sub-domain group(s) and ${totalFamilies} distinct parent-family branch(es)`,
    `primary sub-domain '${primary.label}' backed by ${primary.familyCount}/${totalFamilies} branch(es) (${primary.individualCount} invariant(s))`,
    ...lineage.map(
      (item) =>
        `${item.promoted ? 'promoted invariant' : 'candidate'} ${item.id} — sub-domain '${item.subDomain ?? DOMAIN_BASELINE_LABEL}'` +
        (item.parentIds.length > 0 ? ` (specializes ${item.parentIds.length} parent(s))` : ' (root — no parent yet)'),
    ),
  ];

  return {
    primaryDomain: source.campaignDomain,
    primarySubDomain: primary.subDomain,
    secondarySubDomains: secondary,
    confidence: clamp01(confidence),
    provisional: false,
    evidenceUsed,
  };
}

// ── The composed recommendation ─────────────────────────────────────────────

export interface AdmissionRecommendation {
  sourceId: string;
  admissionClass: RecommendedAdmissionClass;
  /** `null` only for `manual review required` — there is no decision to offer. */
  reviewDecision: ReviewDecision | null;
  primaryDomain: string;
  primarySubDomain: string | null;
  secondarySubDomains: SubDomainLineageGroup[];
  confidence: number;
  reviewTier: ReviewTier;
  evidenceUsed: string[];
  rationale: string;
  /** True = no corpus lineage exists; the domain placement is a content-only
   *  fallback and must never be shown as equivalent to a graph-derived one. */
  provisional: boolean;
  warnings: string[];
}

function composeRationale(input: {
  source: Pick<SourceQualitySignals, 'sourceId'>;
  admissionClass: RecommendedAdmissionClass;
  primarySubDomain: string | null;
  confidence: number;
  provisional: boolean;
  evidenceUsed: readonly string[];
}): string {
  const lines: string[] = [];
  lines.push(
    `Recommended: ${input.admissionClass}` +
      (input.primarySubDomain ? ` — sub-domain '${input.primarySubDomain}'` : '') +
      ` (confidence ${round2(input.confidence).toFixed(2)}).`,
  );
  if (input.provisional) {
    lines.push('PROVISIONAL — no existing corpus lineage for this source; the sub-domain placement is a content-only fallback, not a graph-derived classification.');
  }
  lines.push('Evidence used:');
  for (const e of input.evidenceUsed) lines.push(`  - ${e}`);
  return lines.join('\n');
}

/**
 * The one place a Stage 2 admission recommendation is assembled. PURE —
 * takes the source's own already-recorded quality signals plus its ALREADY-
 * RESOLVED lineage (from `deriveSourceLineage`) and returns a recommendation.
 * Writes nothing; recommends nothing that was not already true of the
 * platform's existing intelligence.
 */
export function composeAdmissionRecommendation(input: {
  source: SourceQualitySignals;
  lineage: readonly SourceLineageInvariant[];
}): AdmissionRecommendation {
  const admission = deriveAdmissionClass(input.source);
  const domain = deriveDomainRecommendation(input.source, input.lineage);

  // Domain/subdomain confidence only bears on the OVERALL score for the
  // ADMIT classes — a rejected or unresolved source is not being placed in a
  // subdomain for evidentiary use, so its confidence is governed purely by
  // the admission-quality judgment (see the module doc, "independent judgment").
  const isAdmitClass = ADMIT_CLASSES.has(admission.admissionClass);
  const combined = isAdmitClass ? Math.min(domain.confidence, admission.confidence) : admission.confidence;
  // A provisional (no-lineage) domain placement caps the OVERALL confidence
  // too, even when the admission-class judgment alone was strong — the
  // fallback must never look as trustworthy as a lineage-backed one.
  const overallConfidence = domain.provisional && isAdmitClass ? Math.min(combined, PROVISIONAL_CONFIDENCE_CAP) : combined;

  const reviewTier = reviewTierFor(admission.admissionClass, overallConfidence);
  const evidenceUsed = [...admission.evidenceUsed, ...domain.evidenceUsed];
  const warnings = [...admission.warnings];
  if (domain.provisional) {
    warnings.push('PROVISIONAL — no existing corpus lineage; this is a content-only inference, routed to the exception queue regardless of computed score.');
  }

  return {
    sourceId: input.source.sourceId,
    admissionClass: admission.admissionClass,
    reviewDecision: RECOMMENDATION_TO_REVIEW_DECISION[admission.admissionClass] ?? null,
    primaryDomain: domain.primaryDomain,
    primarySubDomain: domain.primarySubDomain,
    secondarySubDomains: domain.secondarySubDomains,
    confidence: round2(overallConfidence),
    reviewTier,
    evidenceUsed,
    rationale: composeRationale({
      source: input.source,
      admissionClass: admission.admissionClass,
      primarySubDomain: domain.primarySubDomain,
      confidence: overallConfidence,
      provisional: domain.provisional,
      evidenceUsed,
    }),
    provisional: domain.provisional,
    warnings,
  };
}
