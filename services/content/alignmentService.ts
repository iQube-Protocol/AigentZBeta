/**
 * alignmentService — Automated Content Alignment (Implementation Pack
 * 2026-07-13, MISSING capability #1: "Service to ensure the generated article
 * aligns coherently with the video content." Deps: Video Generation, Article
 * Generation — both composed, never re-implemented.)
 *
 * The video-article skill makes correspondence STRUCTURAL (article and video
 * derive from the same brief); this service makes it MEASURED: given the
 * brief's per-segment beats and the drafted article, it scores how well each
 * segment's material is actually covered by the article text.
 *
 * DETERMINISTIC v1, labelled `basis: 'heuristic'` (the assessRiskHeuristic
 * precedent): salient-token coverage per segment — no LLM call, no spend, no
 * fabricated judgement. An LLM judge pass (callSovereign 'validation') is a
 * later, separately wired increment.
 *
 * Pure + node-drillable: no DB, no clock, no network.
 */

export interface SegmentAlignment {
  index: number;
  /** Fraction of the segment's salient tokens found in the article (0..1). */
  coverage: number;
  /** Salient tokens NOT found — the article's blind spots for this segment. */
  missingCues: string[];
}

export interface AlignmentReport {
  /** Mean per-segment coverage (0..1, two decimals). */
  score: number;
  /** True when every segment clears the per-segment floor. */
  pass: boolean;
  perSegment: SegmentAlignment[];
  basis: 'heuristic';
}

/** Per-segment coverage floor for a pass — a v1 DESIGN VALUE (heuristic, not
 *  ratified). Below it the article likely skips that segment's material. */
export const SEGMENT_COVERAGE_FLOOR = 0.3;

const STOPWORDS = new Set([
  'the', 'and', 'that', 'with', 'this', 'from', 'into', 'over', 'under', 'each',
  'every', 'never', 'always', 'their', 'there', 'these', 'those', 'about', 'through',
  'segment', 'video', 'scene', 'shot', 'frame', 'visual', 'prompt', 'beat',
]);

/** Salient tokens of a text: lowercased words ≥ 4 chars, minus stopwords,
 *  deduped. Invariant markers like [C-011] are kept verbatim (strong cues). */
export function salientTokens(text: string): string[] {
  const markers = text.match(/\[[A-Z]-\d{3}\]/g) ?? [];
  const words = (text.toLowerCase().match(/[a-z][a-z-]{3,}/g) ?? []).filter((w) => !STOPWORDS.has(w));
  return [...new Set([...markers, ...words])];
}

/**
 * Score one segment's beat against the article body: the fraction of the
 * beat's salient tokens present in the article. Pure.
 */
export function segmentCoverage(beat: string, articleBody: string): { coverage: number; missingCues: string[] } {
  const cues = salientTokens(beat);
  if (cues.length === 0) return { coverage: 1, missingCues: [] }; // nothing to cover — vacuously aligned
  const haystack = articleBody.toLowerCase();
  const missing = cues.filter((c) => !haystack.includes(c.toLowerCase()));
  return {
    coverage: Math.round(((cues.length - missing.length) / cues.length) * 100) / 100,
    missingCues: missing.slice(0, 8),
  };
}

/**
 * Align an article to the brief it was drafted from: per-segment coverage +
 * the mean score + the pass verdict (every segment clears the floor). Pure.
 */
export function alignArticleToBrief(
  segments: { index: number; beat: string }[],
  articleBody: string,
): AlignmentReport {
  const perSegment: SegmentAlignment[] = segments.map((s) => {
    const { coverage, missingCues } = segmentCoverage(s.beat, articleBody);
    return { index: s.index, coverage, missingCues };
  });
  const mean = perSegment.length
    ? perSegment.reduce((a, s) => a + s.coverage, 0) / perSegment.length
    : 0;
  return {
    score: Math.round(mean * 100) / 100,
    pass: perSegment.length > 0 && perSegment.every((s) => s.coverage >= SEGMENT_COVERAGE_FLOOR),
    perSegment,
    basis: 'heuristic',
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Studio service integration point (pack 2026-07-15 remedy #2)
//
// The Studio artifact service (`services/composer/studioArtifactTiering.ts`,
// the AR/CPS consequence model) is the platform's canonical persistence seam
// for Studio productions. The video-article skill's article production is a
// Studio production, so its alignment verdict must travel INTO that service —
// not stay trapped in the API response. This is the explicit, documented
// integration point the two modules share: alignmentService OWNS the shape of
// what the Studio record carries; studioArtifactTiering CONSUMES it (imports
// `StudioAlignmentFields` from here). The dependency is one-directional
// (Studio → alignment), so this module stays pure + node-drillable: no DB, no
// clock, no network — just the T2-safe projection the record body records.
// ─────────────────────────────────────────────────────────────────────────

/**
 * The T2-safe projection of an AlignmentReport that the Studio artifact
 * record carries. Numbers + a boolean + per-segment coverage only — no beat
 * text, no article body, no identifier. Structurally forbidden-key-free
 * (findForbiddenObjectKey clean).
 */
export interface StudioAlignmentFields {
  /** Mean per-segment coverage (0..1, two decimals). */
  score: number;
  /** Every segment cleared the per-segment floor. */
  pass: boolean;
  /** How the score was derived — 'heuristic' for the deterministic v1. */
  basis: 'heuristic';
  /** Per-segment coverage fractions, in segment order. */
  segmentCoverage: number[];
}

/**
 * Project an AlignmentReport into the fields the Studio artifact service
 * records. Pure. This is the seam the Studio service imports — call it in the
 * route right before `tierStudioArtifact(...)` for a video-article production.
 */
export function alignmentToStudioFields(report: AlignmentReport): StudioAlignmentFields {
  return {
    score: report.score,
    pass: report.pass,
    basis: report.basis,
    segmentCoverage: report.perSegment.map((s) => s.coverage),
  };
}
