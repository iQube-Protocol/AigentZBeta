/**
 * Reviewer isolation — SPEC §14.5.
 *
 *   > "Reviewers receive the same package and rubric but not each other's decisions."
 *
 * This is the requirement most easily lost to convenience. Handing Reviewer 2
 * the first pass "so it can focus on the disagreements" is a small, plausible,
 * efficient-looking change, and it silently converts dual review into
 * confirmation: R2 no longer tests R1's judgement, it ratifies it. Nothing
 * errors. The contested count drops. The run looks *better*.
 *
 * So isolation is enforced twice and neither is a comment:
 *
 *   1. STRUCTURALLY — `ReviewerPromptInput` (rubric.ts) has no field capable of
 *      carrying another reviewer's decisions.
 *   2. AT DISPATCH — this module re-reads the composed prompt text and refuses
 *      it if any prior adjudication is detectably present. A refactor that adds
 *      a field, or a caller that concatenates decisions into the package
 *      chronology by hand, is caught here rather than by nobody.
 *
 * The runtime check works on the FINAL text about to leave the process, which
 * is the only representation that cannot be bypassed by restructuring the
 * inputs.
 */

import { ReviewRefusal, type ReviewDecision, type ReviewerSlot } from './types';

/** Reason strings shorter than this are too generic to fingerprint on. */
const MIN_FINGERPRINTABLE_REASON = 12;

/**
 * Every substring whose presence in a prompt proves a prior adjudication
 * leaked. Commitments first (they cannot occur by coincidence), then the
 * reason prose, then the subject→label pairing a hand-built summary produces.
 */
export function priorAdjudicationFingerprints(decisions: readonly ReviewDecision[]): string[] {
  const out: string[] = [];
  for (const d of decisions) {
    if (d.outputHash) out.push(d.outputHash);
    if (d.rawOutputRef) out.push(d.rawOutputRef);
    const reason = (d.reason ?? '').trim();
    if (reason.length >= MIN_FINGERPRINTABLE_REASON) out.push(reason);
    if (d.subjectRef && d.decision) {
      out.push(`${d.subjectRef}: ${d.decision}`);
      out.push(`${d.subjectRef} -> ${d.decision}`);
      out.push(`${d.subjectRef} → ${d.decision}`);
    }
  }
  return out;
}

/**
 * Refuse a prompt that carries any prior reviewer's output.
 *
 * `priorDecisions` is every decision from every OTHER slot. Passing an empty
 * list is correct for the first reviewer and is not a bypass: there is nothing
 * to leak yet.
 */
export function assertPromptCarriesNoPriorAdjudication(
  slot: ReviewerSlot,
  prompt: { system: string; user: string },
  priorDecisions: readonly ReviewDecision[],
): void {
  const foreign = priorDecisions.filter((d) => d.reviewerSlot !== slot);
  if (foreign.length === 0) return;
  const haystack = `${prompt.system}\n${prompt.user}`;
  for (const fingerprint of priorAdjudicationFingerprints(foreign)) {
    if (fingerprint && haystack.includes(fingerprint)) {
      throw new ReviewRefusal(
        'reviewer-isolation-breach',
        `the ${slot} prompt contains another reviewer's adjudication ` +
          `(matched ${JSON.stringify(fingerprint.slice(0, 60))}). ` +
          'Dual review requires independent judgement: SPEC-IRL-REVIEW-001 §14.5.',
      );
    }
  }
}

/**
 * The other half of isolation: R2's SUBJECT LIST is legitimately derived from
 * R1's decisions (coverage is asymmetric by design — every exclusion, every
 * `domain-adjacent`, every `unknown`, every private-source row). That
 * derivation is allowed. Carrying the labels themselves across is not.
 *
 * This states the distinction as executable policy so a reader does not have to
 * infer it: WHICH rows R2 sees may depend on R1; WHAT R1 said about them may not.
 */
export function coverageMayDependOnPriorPass(): true {
  return true;
}

export function labelsMayCrossReviewers(): false {
  return false;
}
