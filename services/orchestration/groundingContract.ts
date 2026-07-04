/**
 * groundingContract — the no-hallucination mandate for every aigentMe LLM
 * narrative surface (strategy inference, specialist recommendations, NBE
 * rerank titles/hints, and any future report/brief prose).
 *
 * Two layers, because a prompt instruction alone is not enough (that is how a
 * fabricated "active users rising by 15% over the past quarter" got through):
 *
 *   1. PROMPT layer — `GROUNDING_MANDATE` is prepended/appended to the system
 *      prompt so the model is told, explicitly, that the input data is its only
 *      source of truth and that the input is a DECLARED BASELINE (intent), not
 *      a record of achievement.
 *
 *   2. VALIDATION layer — `groundProse` / `hasUngroundedQuantifier` reject any
 *      generated sentence that introduces a number, percentage, or temporal
 *      trend claim that is NOT present in the grounding data. The caller falls
 *      back to a deterministic, grounded alternative (the rule-based baseline).
 *
 * Principle: the ingested VentureQube / operating model is the BASELINE.
 * Standing accrual + activity/DVN receipts + VERIFIED outcome claims are the
 * only evidence of PROGRESS. Anything not traceable to those is fabrication and
 * must never be stated. When there is no data, say so — do not fill the gap.
 */

/** The strict grounding preamble. Append to any narrative system prompt. */
export const GROUNDING_MANDATE = `GROUNDING MANDATE — NON-NEGOTIABLE:
- The input data provided to you is your ONLY source of truth. Use nothing else.
- NEVER invent, estimate, extrapolate, or imply any of: metrics, percentages, counts, revenue, user/customer/holder numbers, growth or decline rates, dates, timelines, durations, or status/progress claims ("we have seen", "rising by", "steady increase", "delays due to", "X% over the past quarter") that are not EXPLICITLY present in the input.
- The input is a DECLARED BASELINE — intent and targets the operator wrote down. It is NOT a record of achievement. Do not describe targets as achieved. Do not report progress, traction, momentum, or trends unless verified activity/receipt data is explicitly supplied in the input.
- If you lack data to describe a dimension, OMIT it or state plainly that there is no data yet. "No verified activity yet" is a correct, required answer. Inventing plausible prose to fill the gap is a critical failure.
- Reference only the actual names (goals, partners, cartridges, stage) given in the input. Never fabricate a partner, customer, product, incident, or number.`;

// Numbers / percentages, e.g. "15%", "4,000", "3.5", "$100K", "100".
const NUMERIC_RE = /\$?\b\d[\d,]*(?:\.\d+)?\s?%?\b[kKmMbB]?/g;

// Temporal / trend phrases that imply time-series data we usually do not have.
const TREND_PHRASES = [
  'past quarter', 'last quarter', 'this quarter', 'past month', 'last month',
  'past week', 'last week', 'past year', 'last year', 'over the past',
  'year over year', 'quarter over quarter', 'month over month',
  'rising by', 'rose by', 'grew by', 'grew', 'increased by', 'increase of',
  'decreased by', 'decline of', 'declined by', 'up by', 'down by',
  'growth of', 'trending', 'steady increase', 'steady decline', 'momentum',
  'we have seen', 'we have observed', 'so far this',
];

/** Normalise a numeric token so "4,000" / "4000" / "$4000" compare equal. */
function normaliseNumber(token: string): string {
  return token.replace(/[$,\s]/g, '').toLowerCase();
}

/** Collect the numeric tokens that ARE present in the grounding source(s). */
export function collectGroundedNumbers(...sources: Array<string | null | undefined>): Set<string> {
  const out = new Set<string>();
  for (const src of sources) {
    if (!src) continue;
    for (const m of src.match(NUMERIC_RE) ?? []) out.add(normaliseNumber(m));
  }
  return out;
}

/**
 * True when `text` contains a quantitative or temporal-trend claim that is NOT
 * justified by the grounding numbers. Conservative by design: the caller always
 * has a grounded fallback, so a false positive only means we use the
 * deterministic sentence instead of the model's embellished one.
 */
export function hasUngroundedQuantifier(text: string, grounded: Set<string>): boolean {
  if (typeof text !== 'string' || !text.trim()) return false;
  const lower = text.toLowerCase();
  for (const phrase of TREND_PHRASES) {
    if (lower.includes(phrase)) return true;
  }
  for (const m of text.match(NUMERIC_RE) ?? []) {
    const n = normaliseNumber(m);
    // Ignore bare ordinals/tiny integers that are structural, not claims
    // (e.g. "2-3 sentences" never reaches prose; "1" as "one venture" is fine
    // only when grounded). Strict: any number not in grounding is ungrounded.
    if (!grounded.has(n)) return true;
  }
  return false;
}

/**
 * Return `text` when it is grounded; otherwise return `fallback` (a
 * deterministic, grounded alternative). `scrubbed` flags that the model output
 * was rejected so the caller can downgrade confidence.
 */
export function groundProse(
  text: unknown,
  grounded: Set<string>,
  fallback: string,
): { text: string; scrubbed: boolean } {
  if (typeof text !== 'string' || !text.trim()) return { text: fallback, scrubbed: false };
  if (hasUngroundedQuantifier(text, grounded)) return { text: fallback, scrubbed: true };
  return { text, scrubbed: false };
}
