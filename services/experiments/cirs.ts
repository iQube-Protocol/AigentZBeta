/**
 * CIRS-v0.1 — the Canonical Invariant Reference Set, v0.1 (CRP-002 / metaMe IRL).
 *
 * EXPERIMENTAL, NOT NORMATIVE. This is a scientific INSTRUMENT, not a gold set —
 * it is the reference IRL-EXP-001 Stage A judges predictions against, and every
 * entry is `confidence: 'experimental'`, `ratified: false`. Under Option 1A
 * (Experimental Theory Formation) it exists to be DISAGREED WITH: each mismatch
 * between a predicted invariant set and a CIRS entry is an Invariant Delta —
 * first-class data the emergent WP0 synthesises. The CIRS is never static; every
 * experiment may propose a mutation (propose/merge/split/retire, Law XI) that
 * evolves it toward a ratified v1.0.
 *
 * v0.1 draft basis: the CRP-002 §1 worked examples plus a spread across intent
 * primitives. Candidate invariants are drawn from INVARIANT_CONCERN_CLASSES
 * (types/invariantIntelligence.ts) so Stage A scoring is clean; richer invariant
 * refs are a CIRS-mutation follow-on. Pure data — no clock, no DB, no network.
 */

import type { CanonicalInvariantReference } from '@/types/invariantIntelligence';

/** The current CIRS version label — experimental until operator-ratified. */
export const CIRS_VERSION = 'v0.1';

/**
 * CIRS-v0.1 — a drafted, EXPERIMENTAL reference. Do not read as truth; read as
 * the current best hypothesis, awaiting the deltas that will revise it.
 */
export const CIRS_V0_1: CanonicalInvariantReference[] = [
  {
    intent: 'Design a constitutional onboarding experience',
    candidateInvariants: ['disclosure', 'agency', 'standing', 'human-primacy', 'explainability'],
    confidence: 'experimental',
    version: CIRS_VERSION,
    ratified: false,
  },
  {
    intent: 'Explain a difficult concept to a child',
    candidateInvariants: ['explainability', 'human-primacy', 'fairness', 'safety'],
    confidence: 'experimental',
    version: CIRS_VERSION,
    ratified: false,
  },
  {
    intent: 'Design an authenticated delegation API',
    candidateInvariants: ['verification', 'agency', 'disclosure', 'accountability'],
    confidence: 'experimental',
    version: CIRS_VERSION,
    ratified: false,
  },
  {
    intent: 'Analyse a public policy',
    candidateInvariants: ['governance', 'accountability', 'fairness', 'standing'],
    confidence: 'experimental',
    version: CIRS_VERSION,
    ratified: false,
  },
  {
    intent: 'Diagnose a system failure',
    candidateInvariants: ['verification', 'explainability', 'accountability', 'coherence'],
    confidence: 'experimental',
    version: CIRS_VERSION,
    ratified: false,
  },
  {
    intent: 'Negotiate an agreement between two parties',
    candidateInvariants: ['value', 'agency', 'fairness'],
    confidence: 'experimental',
    version: CIRS_VERSION,
    ratified: false,
  },
  {
    intent: 'Verify a factual claim',
    candidateInvariants: ['verification', 'accountability', 'coherence'],
    confidence: 'experimental',
    version: CIRS_VERSION,
    ratified: false,
  },
];
