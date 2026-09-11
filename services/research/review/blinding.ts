/**
 * Blinding — what a review package may not carry.
 *
 * SPEC §14.6: "Current labels, Standing, desired counts and expected outcomes
 * can be blinded." This implementation makes blinding mandatory rather than
 * optional, because the failure it prevents is silent: a package that leaks the
 * current label does not error, it just returns the label back as a decision,
 * and the review reads as agreement.
 *
 * Two scans, because the leak has two shapes.
 *
 *   KEY scan   — a structured field carrying a verdict, a Standing score, a
 *                desired count or an arm allocation.
 *   PHRASE scan — the same information written into prose. "We need at least
 *                200 eligible rows" is not a field; it is the single most
 *                damaging sentence a package could contain, and it would sail
 *                past a key check.
 *
 * The prose rule matters most: never tell a reviewer that a minimum population
 * is wanted. The review returns the honest count or it returns nothing.
 */

import { ReviewRefusal } from './types';

/**
 * Keys forbidden at any depth. Compared in a normalised form (lowercased, with
 * `_` and `-` removed) so `desired_count`, `desiredCount` and `desired-count`
 * are one rule rather than three.
 */
export const BLINDED_KEYS: readonly string[] = [
  // Current eligibility labels — the verdict the reviewer is being asked for.
  'relation',
  'relationship',
  'experimentrelation',
  'eligible',
  'eligibility',
  'stratum',
  'provenancestratum',
  'admissible',
  'admissibility',
  'included',
  // Prior reviewer decisions.
  'decision',
  'decisions',
  'priordecision',
  'previousdecision',
  'reviewerdecision',
  'priorclassification',
  'internalclassification',
  'preferredclassification',
  // Standing and its ledger inputs.
  'standing',
  'standingscore',
  'timesvalidated',
  'timescontradicted',
  'reach',
  // Desired population counts.
  'desiredcount',
  'desiredpopulation',
  'desiredpopulationsize',
  'targetpopulationsize',
  'minimumpopulation',
  'minimumcount',
  'requiredcount',
  'populationtarget',
  // Arm allocation.
  'arm',
  'armid',
  'armallocation',
  'armassignment',
  // Expected results.
  'expectedresult',
  'expectedresults',
  'expectedoutcome',
  'expectedoutcomes',
  'expectedanswer',
  'expectedanswers',
  'predictedresult',
  'observedoutcome',
  // Commercial importance.
  'commercialimportance',
  'commercialvalue',
  'businessvalue',
  'importance',
];

const NORMALISED_BLINDED = new Set(BLINDED_KEYS.map(normaliseKey));

function normaliseKey(key: string): string {
  return key.toLowerCase().replace(/[_-]/g, '');
}

/**
 * Prose that discloses a wanted outcome or a wanted population size.
 *
 * Deliberately narrow and literal. A broad heuristic here would refuse honest
 * packages and get switched off, and a blinding check that gets switched off is
 * worse than none — it leaves the belief that blinding is enforced.
 */
export const BLINDED_PHRASES: readonly RegExp[] = [
  /minimum\s+(eligible\s+)?population/i,
  /desired\s+(population|count|outcome|classification|result)/i,
  /preferred\s+(population|classification|outcome|label)/i,
  /we\s+(need|want|require)\s+at\s+least\s+\d/i,
  /at\s+least\s+\d+\s+(invariants|rows|members|subjects)\s+(must|should|need)/i,
  /target\s+population\s+size/i,
  /expected\s+(result|outcome)\s+(is|:)/i,
  /(should|must)\s+be\s+classified\s+as\s+(independent|domain-adjacent)/i,
  /standing\s*[:=]\s*\d/i,
];

export interface BlindingViolation {
  path: string;
  kind: 'key' | 'phrase';
  detail: string;
}

/**
 * Deep scan. Returns every violation rather than the first, because a package
 * author fixing leaks one error message at a time will stop at the first clean
 * run and ship the rest.
 */
export function findBlindingViolations(value: unknown, path = '$'): BlindingViolation[] {
  const out: BlindingViolation[] = [];
  if (typeof value === 'string') {
    for (const rx of BLINDED_PHRASES) {
      if (rx.test(value)) {
        out.push({ path, kind: 'phrase', detail: rx.source });
      }
    }
    return out;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => out.push(...findBlindingViolations(v, `${path}[${i}]`)));
    return out;
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (NORMALISED_BLINDED.has(normaliseKey(k))) {
        out.push({ path: `${path}.${k}`, kind: 'key', detail: k });
      }
      out.push(...findBlindingViolations(v, `${path}.${k}`));
    }
    return out;
  }
  return out;
}

/** Fail closed: a package that leaks is not sealed, it is refused. */
export function assertBlinded(value: unknown, what: string): void {
  const violations = findBlindingViolations(value);
  if (violations.length === 0) return;
  const detail = violations
    .slice(0, 12)
    .map((v) => `${v.path} (${v.kind}: ${v.detail})`)
    .join('; ');
  throw new ReviewRefusal(
    'blinding-violation',
    `${what} discloses blinded material and cannot be sealed: ${detail}` +
      (violations.length > 12 ? ` … and ${violations.length - 12} more` : ''),
  );
}
