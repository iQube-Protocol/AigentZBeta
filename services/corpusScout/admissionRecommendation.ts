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
import {
  DEFAULT_ACQUISITION_CONSEQUENCE,
  type ExceptionCauseGroup,
  type IsolationException,
  type RecordDisposition,
} from '@/services/research/exceptionIsolation';

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
/** A PROVISIONAL (no-lineage, content-only) SUB-DOMAIN placement is always
 *  capped at or below this — strictly below `CONFIDENCE_MANUAL_REVIEW_THRESHOLD`
 *  — so a provisional placement can never present as equivalent to a
 *  graph-derived classification.
 *
 *  **This caps `domainConfidence`, NOT `confidence` (2026-08-03 revision).**
 *  It used to cap the overall score, which quarantined every no-lineage source
 *  — and since a source only acquires lineage AFTER it is admitted and
 *  extracted, that meant the very first Track 2 batch had NO admissible source
 *  at all. That is the "perfection as the precondition for progress" defect the
 *  exception-isolation ruling abolishes.
 *
 *  The decoupling is not a relaxation, it is a correction of what the number
 *  was ever about: `ingestApprovedSource` writes the source's OWN recorded
 *  `campaignSubDomain` to the evidence row (`ingestionBroker.ts`), never the
 *  lineage-derived one. So the lineage placement is ADVISORY CONTEXT for the
 *  steward, and admitting a source with a provisional placement writes exactly
 *  what it would have written anyway. The placement stays labelled provisional
 *  and rides into the receipt as a warning — it is never silently upgraded. */
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

// ── Title resolution — a WARNING signal, never a forcing rule ───────────────

/**
 * IS THIS A TITLE, OR IS IT WHAT THE CRAWLER FOUND WHERE A TITLE SHOULD BE?
 *
 * Moved here from `Track2ProgrammePanel.tsx` (2026-08-03) so the server-side
 * recommendation pass and the client card read the SAME judgement — a second
 * copy would have been the stale one, and the client's copy was unreachable
 * from the route that now needs it (inv.engineering.036).
 *
 * Titles come from the discovery crawler's LINK TEXT, falling back to the URL
 * basename. Both are frequently not the document's name — a link labelled
 * "PDF" yields the title "PDF".
 *
 * **This never repairs a title and never blocks a source.** Per the operator's
 * exception-isolation ruling §4: *"A filename-like title or missing metadata
 * is NOT automatically a blocker… Do not make the operator chase missing
 * titles when the content itself suffices for evidence admission."* An
 * unresolved title on a source whose CONTENT is verifiable is a recorded
 * warning that rides into the receipt, not a refusal.
 *
 * Returns the reason the title looks unresolved, or `null` when it looks like
 * a real document title.
 */
export function titleResolutionIssue(title: string, canonicalUrl: string): string | null {
  const t = (title ?? '').trim();
  if (!t) return 'No title was captured at all.';
  if (/^(pdf|document|download|file|link|here|view)$/i.test(t)) {
    return `“${t}” is link text, not a document title.`;
  }
  // The URL basename fallback — the crawler had no link text to use.
  try {
    const base = decodeURIComponent(new URL(canonicalUrl).pathname.split('/').filter(Boolean).pop() ?? '');
    if (base && base.toLowerCase() === t.toLowerCase()) {
      return 'This title is the URL filename — no document title was found.';
    }
  } catch {
    // An unparseable URL tells us nothing either way; say nothing.
  }
  if (t.length < 12) return `“${t}” is too short to be a document title.`;
  return null;
}

/** The warning text the operator specified verbatim for an admitted source
 *  whose title never resolved (ruling §4). Carried INTO THE RECEIPT. */
export const UNRESOLVED_TITLE_WARNING =
  'Document title unresolved; source admitted on verified content, issuer, URL and artifact hash.';

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
  /** Used ONLY to detect an unresolved title, which is a warning — never a
   *  blocker (ruling §4). */
  title: string;
  canonicalUrl: string;
  /** Metadata completeness signals. Absence is a WARNING, never a refusal. */
  publicationDate: string | null;
  authors: readonly string[];
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
  /** Confidence in the admission-class judgment ALONE (0..1). This is the
   *  score the COHORT is derived from — deliberately independent of
   *  sub-domain placement confidence (see `PROVISIONAL_CONFIDENCE_CAP`). */
  confidence: number;
  evidenceUsed: string[];
  /** NON-FATAL deficiencies. A warning is executable and rides into the
   *  receipt; it never withholds a source (ruling §5: amber is not
   *  prohibition). */
  warnings: string[];
  /** Set only when this judgment quarantines or refuses the source — the
   *  cause group the single Exceptions surface groups it under. */
  causeGroup?: ExceptionCauseGroup;
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
    return {
      admissionClass: 'manual review required',
      confidence: FORCED_MANUAL_REVIEW_CONFIDENCE,
      evidenceUsed,
      warnings,
      causeGroup: 'exact-duplicate',
    };
  }

  // A measured fact, not a guess: no usable text was extracted at all.
  if (source.extractionStatus === 'failed') {
    return {
      admissionClass: 'reject — low substance',
      confidence: 0.9,
      evidenceUsed,
      warnings,
      causeGroup: 'unreadable-content',
    };
  }
  if (source.extractionStatus === 'below-threshold') {
    warnings.push('Extraction fell below the substantive-content threshold — a human should read the excerpt before a reject is recorded.');
    return {
      admissionClass: 'manual review required',
      confidence: FORCED_MANUAL_REVIEW_CONFIDENCE,
      evidenceUsed,
      warnings,
      causeGroup: 'unreadable-content',
    };
  }
  if (!source.artifactHash) {
    // Ruling §4 makes the artifact hash a REQUIREMENT of the
    // "content verifiable, metadata incomplete" path — so a source without
    // one cannot take the ready-with-warnings route. It is quarantined for a
    // steward, never refused outright: "never byte-verified" and "corrupted"
    // are different findings, and this signal cannot tell them apart.
    warnings.push('No artifact hash was recorded — this source was never byte-verified, so its content identity cannot be confirmed automatically.');
    return {
      admissionClass: 'manual review required',
      confidence: FORCED_MANUAL_REVIEW_CONFIDENCE,
      evidenceUsed,
      warnings,
      causeGroup: 'unresolved-artifact-identity',
    };
  }

  // ── Past this point the CONTENT IS VERIFIABLE (extraction ok + artifact
  //    hash present). Everything below is a warning, never a blocker — this
  //    is ruling §4's "content verifiable, metadata incomplete" path.

  const titleIssue = titleResolutionIssue(source.title, source.canonicalUrl);
  if (titleIssue) {
    // The operator's verbatim warning text. It rides into the receipt so the
    // admission records WHAT it was admitted on, rather than pretending the
    // title was fine.
    warnings.push(`${UNRESOLVED_TITLE_WARNING} (${titleIssue})`);
    evidenceUsed.push(`title unresolved: ${titleIssue}`);
  }
  const missingMetadata: string[] = [];
  if (!source.publicationDate) missingMetadata.push('publication date');
  if (source.authors.length === 0) missingMetadata.push('authors');
  if (missingMetadata.length > 0) {
    warnings.push(
      `Incomplete publication metadata (${missingMetadata.join(', ')} not captured); admitted on verified content, issuer, URL and artifact hash.`,
    );
  }
  if (source.extractionWarnings.length > 0) {
    warnings.push(`${source.extractionWarnings.length} extraction warning(s) recorded at retrieval; content was still extracted.`);
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
  /** The ADMISSION-quality confidence — what the cohort and review tier are
   *  derived from. Deliberately NOT reduced by a provisional sub-domain
   *  placement; see `PROVISIONAL_CONFIDENCE_CAP`. */
  confidence: number;
  /** Confidence in the SUB-DOMAIN PLACEMENT alone. Capped at
   *  `PROVISIONAL_CONFIDENCE_CAP` when no corpus lineage exists. Reported
   *  separately so a provisional placement is visible without withholding an
   *  otherwise-admissible source. */
  domainConfidence: number;
  reviewTier: ReviewTier;
  /** The shared four-value RECORD DISPOSITION
   *  (`services/research/exceptionIsolation.ts`). This is what the executable
   *  batch is built from — every stage in the pipeline, over every record
   *  kind, speaks this same vocabulary. */
  disposition: RecordDisposition;
  evidenceUsed: string[];
  rationale: string;
  /** True = no corpus lineage exists; the domain placement is a content-only
   *  fallback and must never be shown as equivalent to a graph-derived one.
   *  It is a WARNING, not a blocker — see `PROVISIONAL_CONFIDENCE_CAP`. */
  provisional: boolean;
  warnings: string[];
  /** Present only for the quarantined and refused cohorts. */
  exception?: IsolationException;
}

/**
 * The RECORD DISPOSITION, derived from the recommendation's own admission
 * class and review tier — not a second classifier (inv.engineering.037). This
 * is the single place Stage 2 maps onto the shared vocabulary.
 */
function dispositionFor(
  admissionClass: RecommendedAdmissionClass,
  reviewTier: ReviewTier,
  warnings: readonly string[],
): RecordDisposition {
  if (admissionClass.startsWith('reject')) return 'refused';
  if (admissionClass === 'manual review required') return 'exception';
  // An admit class below the minimum confidence threshold is an exception
  // (ruling §1c: "recommendation below minimum confidence threshold").
  if (reviewTier === 'exception') return 'exception';
  // Executable. Amber when anything non-fatal was recorded — the warning
  // rides into the receipt, it does not withhold the source (ruling §5).
  if (reviewTier === 'needs-review' || warnings.length > 0) return 'ready-with-warning';
  return 'ready';
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

  // ── THE TWO CONFIDENCES ARE SEPARATE, AND ONLY ONE GATES ADMISSION ────────
  //
  // `admission.confidence` answers "is this source good enough to admit, and
  // as what grade" from source-quality signals. `domain.confidence` answers
  // "how sure are we which sub-domain its invariants sit in".
  //
  // Only the FIRST decides the cohort. The second is reported beside it.
  // Folding the domain score into the gate (as this function did until
  // 2026-08-03) quarantined every source with no lineage — and a source
  // cannot HAVE lineage until it has been admitted and extracted, so the
  // first Track 2 batch had nothing admissible at all. It also had no
  // evidentiary basis: `ingestApprovedSource` writes the source's OWN
  // `campaignSubDomain`, never the lineage-derived placement, so the placement
  // does not change what the admission writes.
  const reviewTier = reviewTierFor(admission.admissionClass, admission.confidence);
  const evidenceUsed = [...admission.evidenceUsed, ...domain.evidenceUsed];
  const warnings = [...admission.warnings];
  if (domain.provisional) {
    // Recorded as a WARNING that rides into the receipt — not a quarantine.
    // The placement stays labelled provisional wherever it is shown; it is
    // never silently upgraded to look graph-derived.
    warnings.push(
      'PROVISIONAL sub-domain placement — no existing corpus lineage traces to this source yet, so the ' +
        'sub-domain shown is the one already recorded at acquisition, not a graph-derived classification. ' +
        'Admission writes that same recorded sub-domain either way.',
    );
  }

  const disposition = dispositionFor(admission.admissionClass, reviewTier, warnings);
  const exception =
    disposition === 'exception' || disposition === 'refused'
      ? buildException(input.source, admission, disposition)
      : undefined;

  return {
    sourceId: input.source.sourceId,
    admissionClass: admission.admissionClass,
    reviewDecision: RECOMMENDATION_TO_REVIEW_DECISION[admission.admissionClass] ?? null,
    primaryDomain: domain.primaryDomain,
    primarySubDomain: domain.primarySubDomain,
    secondarySubDomains: domain.secondarySubDomains,
    confidence: round2(admission.confidence),
    domainConfidence: round2(domain.confidence),
    reviewTier,
    disposition,
    evidenceUsed,
    rationale: composeRationale({
      source: input.source,
      admissionClass: admission.admissionClass,
      primarySubDomain: domain.primarySubDomain,
      confidence: admission.confidence,
      provisional: domain.provisional,
      evidenceUsed,
    }),
    provisional: domain.provisional,
    warnings,
    ...(exception ? { exception } : {}),
  };
}

/**
 * The exception record for a quarantined or refused source, in the SHARED
 * typed shape the single Exceptions surface consumes.
 *
 * ── Why all four `blocks*` booleans are FALSE here ──────────────────────────
 *
 * This is a considered position, not an omission, and it is what the operator
 * means by "typed and consequential" rather than "all amber notices alike":
 *
 *   blocksCurrentStage      false — the whole ruling. One anomalous source
 *                                   does not stop Stage 2 admitting the rest.
 *   blocksCrystalAssignment false — assignment operates on validated
 *                                   INVARIANTS. A source that never entered
 *                                   the corpus produced none, so it cannot
 *                                   withhold anyone else's.
 *   blocksReadiness         false — readiness assesses the ACTUAL assigned
 *                                   crystal. A record outside it is not part
 *                                   of what is being assessed.
 *   blocksFreeze            false — and never asserted here in any case:
 *                                   `computeFreezeBlocking` recomputes it from
 *                                   whether the crystal that REMAINS can still
 *                                   pass its pre-registered criteria. A
 *                                   source-scope exception is never even a
 *                                   candidate (ruling §3).
 *
 * The exclusion is not thereby invisible: it rides in `PopulationDisclosure`
 * and on the cohort-authorization receipt as a DISCLOSED LIMITATION, which is
 * the guardrail against quietly shrinking the corpus until readiness passes.
 */
function buildException(
  source: SourceQualitySignals,
  admission: AdmissionClassResult,
  disposition: Extract<RecordDisposition, 'exception' | 'refused'>,
): IsolationException {
  const refused = disposition === 'refused';
  return {
    scope: 'source',
    recordId: source.sourceId,
    recordLabel: source.title?.trim() || source.canonicalUrl,
    cause: admission.warnings[0] ?? `Recommended '${admission.admissionClass}'.`,
    causeGroup: admission.causeGroup ?? 'low-confidence-classification',
    disposition,
    stage: 'review-and-admit',
    blocksCurrentStage: false,
    blocksCrystalAssignment: false,
    blocksReadiness: false,
    blocksFreeze: false,
    consequence: DEFAULT_ACQUISITION_CONSEQUENCE,
    recommendedAction: refused
      ? 'Record the refusal decision on this source individually, with a rationale. It stays outside ingestion.'
      : 'Decide this source individually in the review queue — it needs a judgement the recommendation pass will not make.',
    // Deferrable indefinitely: nothing downstream waits on it. If the crystal
    // later cannot reach readiness without more corpus, THAT is what surfaces
    // it — via the readiness engine, not via a per-record assertion here.
    deferrableUntil: null,
  };
}
