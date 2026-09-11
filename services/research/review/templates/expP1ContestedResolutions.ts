/**
 * The seven contested EXP-P1 records, resolved under the provenance lineage.
 *
 * Recorded as data rather than applied by hand so that the decisions, their
 * basis, and their author are all one thing an auditor can read — and so the
 * same list drives whatever applies them. A decision typed twice is a decision
 * that can differ from itself.
 *
 * ── Provenance of these decisions ──────────────────────────────────────────
 *
 * Recommended by Al (internal reviewer), relayed by the operator on
 * 2026-08-02, in the same message that established the lineage these use:
 *
 *   > "Under that interpretation, my recommendations are: …"
 *
 * They are RECOMMENDATIONS at the point of recording. Adopting them is the
 * steward's act (`resolveContestedRecord` in adjudication.ts) — this module
 * carries what was recommended and why, and never performs the adoption
 * itself.
 *
 * ── Why this lives in templates/ ───────────────────────────────────────────
 *
 * `services/research/review/` is the GENERIC review capability; EXP-P1 is its
 * first instance. Seven named record ids are instance data, and putting them
 * in the generic layer would make the capability quietly about one experiment
 * — the same drift `templates/expP1Admissibility.ts` already guards against.
 * The capability canary caught this placement, and was right to. The distinction is the same one the review layer draws everywhere
 * else: review produces evidence, resolution adopts it, and ratification is a
 * separate constitutional freeze.
 */

import type { ProvenanceClass } from '../provenance';

export interface ContestedRecordResolution {
  subjectRef: string;
  recommended: ProvenanceClass;
  /** Which class definition the recommendation rests on, in the ruling's own terms. */
  basis: string;
}

/**
 * Four Independent, three Outcome-informed.
 *
 * The split is not arbitrary and is worth stating plainly, because it is what
 * an external reviewer will want to check: the `reasoning.35x` records date
 * from after the experiment began teaching, and the ruling's Class C is
 * defined by exactly that — "created because the experiment taught something".
 * The other four are background constitutional work that would exist whether
 * or not EXP-P1 had been run.
 */
export const EXP_P1_CONTESTED_RESOLUTIONS: readonly ContestedRecordResolution[] = Object.freeze([
  Object.freeze({
    subjectRef: 'inv.representation.128',
    recommended: 'independent' as const,
    basis: 'Background constitutional work — not created to construct the experiment and not taught by running it.',
  }),
  Object.freeze({
    subjectRef: 'inv.polity.163',
    recommended: 'independent' as const,
    basis: 'Background constitutional work — polity doctrine predating and independent of EXP-P1.',
  }),
  Object.freeze({
    subjectRef: 'inv.polity.209',
    recommended: 'independent' as const,
    basis: 'Background constitutional work — polity doctrine predating and independent of EXP-P1.',
  }),
  Object.freeze({
    subjectRef: 'inv.reasoning.323',
    recommended: 'independent' as const,
    basis: 'Background constitutional work — reasoning doctrine not derived from the experiment target.',
  }),
  Object.freeze({
    subjectRef: 'inv.reasoning.354',
    recommended: 'outcome-informed' as const,
    basis: 'Created because running the experiment taught something — Class C by the ruling\'s own definition.',
  }),
  Object.freeze({
    subjectRef: 'inv.reasoning.356',
    recommended: 'outcome-informed' as const,
    basis: 'Created because running the experiment taught something — Class C by the ruling\'s own definition.',
  }),
  Object.freeze({
    subjectRef: 'inv.reasoning.357',
    recommended: 'outcome-informed' as const,
    basis: 'Created because running the experiment taught something — Class C by the ruling\'s own definition.',
  }),
]);

/**
 * What adopting these would do to the experimental corpus.
 *
 * Stated as a derived count rather than a written-down number so it cannot go
 * stale against the list above — and surfaced at all because the outcome is
 * not intuitive: three of seven contested records become INADMISSIBLE as
 * evidence, and a reader who expects "resolved" to mean "included" should meet
 * that fact here rather than discover it in a corpus total.
 */
export function contestedResolutionEffect(): {
  admissible: string[];
  excludedAsExperimentallyInfluenced: string[];
} {
  const admissible: string[] = [];
  const excluded: string[] = [];
  for (const r of EXP_P1_CONTESTED_RESOLUTIONS) {
    (r.recommended === 'independent' ? admissible : excluded).push(r.subjectRef);
  }
  return { admissible, excludedAsExperimentallyInfluenced: excluded };
}

/**
 * Why pre-resolving these before the package goes out is the right order.
 *
 *   > "You've effectively pre-resolved disputes that arise from applying the
 *   >  taxonomy consistently rather than asking the external reviewers to
 *   >  spend time on issues that are really questions of constitutional
 *   >  classification. Austin and his agent can then focus their attention on
 *   >  genuine disagreements over evidence or methodology, which is where
 *   >  independent review adds the most value."
 *
 * Kept here because it is the standard the package should be held to: an
 * external reviewer meeting a taxonomy dispute is a reviewer whose time we
 * spent on our own unfinished thinking.
 */
export const PRE_RESOLUTION_RATIONALE =
  'Classification questions are the originating team\'s to settle; evidence and methodology are what ' +
  'independent review is for. A package that ships unresolved taxonomy spends the reviewer\'s attention on ' +
  'the wrong thing.';
