/**
 * Invariant Decision Node — Standing Score (CFS-035 §6, Phase-2 frontier node).
 *
 * The incumbent Standing composite (services/standing/standingScore.ts) is the
 * magic-number form of embedded compressed reasoning: `score = veracity*0.7 +
 * contribution*0.3` (or contribution alone when veracity is absent). This node
 * re-expresses that composite as a transparent value projection over two named
 * dimensions — **veracity** and **contribution** — each with its explicit
 * weight, so the standing score carries a "why".
 *
 * Faithful by construction — the same 0.7/0.3 blend + the same clamp — so shadow
 * adoption is behaviour-preserving. The weights become genuine `inv.standing.*`
 * projections once those invariants are discovered and earn standing.
 *
 * Pure + deterministic. Server-safe. NOTE (operator direction 2026-07-18):
 * standing is slated to move to a standalone Standing canister, managed
 * independently of reputation and correlated as needed — see
 * `services/standing/standingCanister.ts` (stub) + the backlog. This node's
 * projection is canister-agnostic: it consumes the sub-scores, wherever they
 * are computed.
 */

import type { FieldSnapshot, ValueProjection } from '../engine';

export const STANDING_SCORE_NODE_ID = 'standing.score';

/** Match the incumbent clamp exactly (0..100, rounded) — keeps the projection faithful. */
const clamp = (n: number): number => Math.max(0, Math.min(100, Math.round(n)));

export interface StandingScoreInput {
  /** Veracity sub-score 0..100 (verified-fact quality/coverage/volume blend). */
  veracityScore: number;
  /** Contribution sub-score 0..100 (reputation accrual). */
  contributionScore: number;
}

export function standingScoreProjector(
  input: StandingScoreInput,
  snapshot?: FieldSnapshot | null,
): ValueProjection {
  const { veracityScore, contributionScore } = input;
  const veracityWeight = veracityScore > 0 ? 0.7 : 0;
  const contributionWeight = veracityScore > 0 ? 0.3 : 1;
  const value =
    veracityScore > 0
      ? clamp(veracityScore * 0.7 + contributionScore * 0.3)
      : clamp(contributionScore);
  return {
    nodeId: STANDING_SCORE_NODE_ID,
    value,
    projection: { veracity: veracityScore, contribution: contributionScore, veracityWeight, contributionWeight },
    citedIds: snapshot?.citedIds ?? [],
  };
}
