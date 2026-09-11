/**
 * Provenance as a causal lineage, not a menu of labels.
 *
 * ── The ruling (Al, relayed by the operator, 2026-08-02) ───────────────────
 *
 *   > "You have three constitutional classes emerging:
 *   >    Class A  Independent       (background constitutional work)
 *   >    Class B  Target-derived    (created to construct the experiment)
 *   >    Class C  Outcome-informed  (created because the experiment taught
 *   >                                something)
 *   >  That is actually a causal lineage, not merely a reviewer label."
 *
 *   > "Independent → Target-derived → Outcome-informed, where each state
 *   >  implies strictly more experimental influence than the one above it."
 *
 * The consequence for reviewers is the point of the change:
 *
 *   > "reviewers would no longer choose among unrelated labels — they would be
 *   >  answering a single constitutional question: What is the strongest
 *   >  experimentally supported provenance for this statement?"
 *
 * ── Why the ordering does real work ────────────────────────────────────────
 *
 * A flat label set makes every disagreement a matter of taste: two reviewers
 * pick different words and there is no principle that says which is closer to
 * the truth. An ORDER makes disagreement tractable, because the labels are no
 * longer alternatives — they are positions on one axis, and a reviewer with
 * affirmative evidence of experimental influence is not contradicting a
 * reviewer who saw none. They are seeing further down the same chain.
 *
 * ── The separation this also settles ───────────────────────────────────────
 *
 *   > "'Domain-adjacent' stops competing with 'Independent' as though they
 *   >  were peers — it becomes explanatory metadata about why something is
 *   >  relevant, while provenance remains the constitutional classification
 *   >  that governs admissibility into the experimental corpus."
 *
 * Two axes that were being read as one. `domain-adjacent` answers "why is this
 * here"; provenance answers "may this be evidence". A record can be both
 * domain-adjacent and independent, and previously that pairing had no way to
 * be expressed — the reviewer had to choose, and the choice discarded one of
 * two true facts.
 */

// ── The lineage ─────────────────────────────────────────────────────────────

/** The three classes, in order of strictly increasing experimental influence. */
export const PROVENANCE_LINEAGE = Object.freeze(['independent', 'target-derived', 'outcome-informed'] as const);

export type ProvenanceClass = (typeof PROVENANCE_LINEAGE)[number];

/**
 * `task-derived` shares Class B's rank.
 *
 * The ruling names three classes and the existing corpus carries a fourth
 * label. Both `target-derived` and `task-derived` mean "created as part of
 * designing the experiment" — the same causal position, differing only in
 * which artefact of the design they came from. Inventing a fourth RANK would
 * assert an ordering nobody ruled on; collapsing it into Class B asserts only
 * what the class definition already says.
 *
 * Flagged for the operator rather than decided silently: if `task-derived` is
 * meant to sit elsewhere on the axis, this is the one line to change.
 */
export const CLASS_B_ALIASES = Object.freeze(['target-derived', 'task-derived'] as const);

/**
 * Genuine evidentiary insufficiency — NOT a position on the axis.
 *
 *   > "Unknown — reserved only for genuine evidentiary insufficiency."
 *
 * It is deliberately not rank 3 or rank -1: it is not a stronger or weaker
 * claim about influence, it is the absence of a claim. Ranking it would let it
 * be compared with a real classification, which is exactly the confusion the
 * lineage removes.
 */
export const UNKNOWN_PROVENANCE = 'unknown';

/**
 * Relevance metadata — why a record is in scope. Never a provenance.
 *
 * Kept as a named constant rather than folded into a comment so that any code
 * tempted to put it back in the eligibility set has to do so against an
 * explicit statement that it is not one.
 */
export const RELEVANCE_METADATA = Object.freeze(['domain-adjacent'] as const);

export type RelevanceMetadata = (typeof RELEVANCE_METADATA)[number];

/**
 * Experimental influence, as a rank. Higher = more influenced by the experiment.
 *
 * Returns null for anything that is not a position on the axis — `unknown` and
 * `domain-adjacent` both land here, for different reasons, and a caller that
 * treats null as "rank 0" would silently promote both to Independent.
 */
export function experimentalInfluenceRank(label: string): number | null {
  if (label === 'independent') return 0;
  if ((CLASS_B_ALIASES as readonly string[]).includes(label)) return 1;
  if (label === 'outcome-informed') return 2;
  return null;
}

/** Is this a provenance classification at all? */
export function isProvenanceClass(label: string): boolean {
  return experimentalInfluenceRank(label) !== null;
}

/** Is this relevance metadata rather than a provenance? */
export function isRelevanceMetadata(label: string): boolean {
  return (RELEVANCE_METADATA as readonly string[]).includes(label);
}

// ── Admissibility ───────────────────────────────────────────────────────────

/**
 * Only Class A is admissible into the EXPERIMENTAL corpus.
 *
 *   > "provenance … remains the constitutional classification that governs
 *   >  admissibility into the experimental corpus."
 *
 * Target-derived and outcome-informed records are not defective and are not
 * being discarded — they are excluded from serving as EVIDENCE for the very
 * experiment that shaped them. That is a circularity guard, not a judgement of
 * quality, and the distinction matters to anyone reading a rejection.
 *
 * ── A REAL NARROWING, flagged deliberately ─────────────────────────────────
 *
 * `domain-adjacent` previously sat in the eligible set beside `independent`.
 * Under this ruling it is not a provenance, so it cannot confer eligibility on
 * its own — a record carrying only that label now needs a provenance before it
 * can be admitted. That is a governed change in behaviour, not a refactor, and
 * it is the reason the seven contested records were given explicit classes
 * rather than left to inherit one.
 */
export function admissibleAsExperimentalEvidence(label: string): boolean {
  return experimentalInfluenceRank(label) === 0;
}

export function admissibilityReason(label: string): string {
  const rank = experimentalInfluenceRank(label);
  if (rank === 0) {
    return 'Independent — background constitutional work, not shaped by this experiment. Admissible as evidence.';
  }
  if (rank === 1) {
    return (
      'Target-derived — created as part of designing this experiment. Excluded from the experimental corpus ' +
      'because it cannot serve as independent evidence for the experiment that produced it. This is a ' +
      'circularity guard, not a judgement of the record\'s quality.'
    );
  }
  if (rank === 2) {
    return (
      'Outcome-informed — created because running this experiment taught something. The most experimentally ' +
      'influenced class, and the furthest from independent evidence. Excluded on the same circularity ' +
      'grounds, not for any defect in the record.'
    );
  }
  if (label === UNKNOWN_PROVENANCE) {
    return (
      'Unknown — the evidence available does not establish a provenance. Not a position on the influence ' +
      'axis and not a verdict; it is the absence of one, and it should give way to any affirmative ' +
      'classification another reviewer can support.'
    );
  }
  if (isRelevanceMetadata(label)) {
    return (
      'Domain-adjacent is relevance metadata — it explains why this record is in scope. It is not a ' +
      'provenance and cannot decide admissibility on its own.'
    );
  }
  return `"${label}" is not a recognised provenance class, relevance marker, or unknown.`;
}

// ── Resolving two reviewers ─────────────────────────────────────────────────

export interface ProvenanceResolution {
  /** The resolved class, or `unknown` when neither reviewer could support one. */
  resolved: ProvenanceClass | typeof UNKNOWN_PROVENANCE;
  /** Relevance markers either reviewer attached, carried alongside — never discarded. */
  relevance: RelevanceMetadata[];
  /** Whether an affirmative classification displaced an `unknown`. */
  unknownYielded: boolean;
  reason: string;
}

/**
 * The single constitutional question, answered from both reviewers at once.
 *
 *   > "What is the strongest experimentally supported provenance for this
 *   >  statement?"
 *
 * "Strongest supported" is the HIGHEST rank any reviewer could affirmatively
 * support — because influence is a claim that evidence can establish and
 * absence of evidence cannot refute. A reviewer who found outcome-informed
 * authorship has shown something; a reviewer who did not has shown nothing
 * about whether it exists. Taking the maximum is what makes the two reviews
 * combinable rather than contradictory.
 *
 * And:
 *
 *   > "If another reviewer provides affirmative provenance, 'Unknown' should
 *   >  normally give way to the supported classification rather than remain as
 *   >  the final state."
 *
 * So `unknown` never wins against a classification. It survives only when
 * nobody could support one — which is precisely the evidentiary insufficiency
 * it is reserved for.
 */
export function resolveProvenance(labels: readonly string[]): ProvenanceResolution {
  const relevance = labels.filter(isRelevanceMetadata) as RelevanceMetadata[];
  const ranked = labels
    .map((l) => ({ label: l, rank: experimentalInfluenceRank(l) }))
    .filter((r): r is { label: string; rank: number } => r.rank !== null);

  if (ranked.length === 0) {
    return {
      resolved: UNKNOWN_PROVENANCE,
      relevance,
      unknownYielded: false,
      reason:
        'No reviewer could affirmatively support any provenance class, so the record remains Unknown — ' +
        'genuine evidentiary insufficiency rather than an unresolved dispute.',
    };
  }

  const strongest = ranked.reduce((a, b) => (b.rank > a.rank ? b : a));
  const resolved = (
    strongest.rank === 0 ? 'independent' : strongest.rank === 1 ? 'target-derived' : 'outcome-informed'
  ) as ProvenanceClass;
  const sawUnknown = labels.includes(UNKNOWN_PROVENANCE);

  return {
    resolved,
    relevance,
    unknownYielded: sawUnknown,
    reason: sawUnknown
      ? `Unknown gave way to ${resolved}, which a reviewer could affirmatively support. Absence of evidence ` +
        'for a provenance is not evidence against one.'
      : `${resolved} is the strongest experimentally supported provenance offered — influence is a claim ` +
        'evidence can establish, so the highest supported rank governs.',
  };
}

/**
 * Do two labels actually disagree?
 *
 * Under a flat label set every difference was a dispute. Under a lineage, a
 * difference in rank is a difference in what each reviewer could SEE — only a
 * genuine conflict (one reviewer's evidence contradicting the other's, rather
 * than falling short of it) needs adjudication. This is what the operator
 * expects to reduce the recurring disputes:
 *
 *   > "This separation would reduce exactly the kind of recurring disputes
 *   >  you've been seeing."
 *
 * A provenance paired with relevance metadata is NOT a disagreement — that was
 * the false conflict the two-axis separation removes.
 */
export function labelsConflict(a: string, b: string): boolean {
  if (a === b) return false;
  if (isRelevanceMetadata(a) || isRelevanceMetadata(b)) return false;
  if (a === UNKNOWN_PROVENANCE || b === UNKNOWN_PROVENANCE) return false;
  return experimentalInfluenceRank(a) !== experimentalInfluenceRank(b);
}
