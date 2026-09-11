/**
 * Standalone Standing Canister — STUB (operator direction 2026-07-18).
 *
 * The intent: manage Standing on its OWN canister, independently of reputation,
 * so the two are decoupled primitives that can be correlated as needed (rather
 * than reputation accrual and standing veracity being entangled in one store).
 * This mirrors the DVN / cross-chain canister pattern already in the codebase.
 *
 * STATUS: stub only. No canister is deployed. The functions below define the
 * intended surface and currently fall through to the local computation
 * (`services/standing/standingScore.ts`) so callers can adopt the interface now
 * and the backing implementation can be swapped in without a call-site change.
 * The full build — deploy the canister, wire the IC actor (mirror
 * `services/ops/icAgent.ts` + an IDL), migrate reads/writes, add the
 * reputation-correlation view — is tracked in the backlog:
 *   codexes/packs/agentiq/updates/2026-07-18_standalone-standing-canister-backlog.md
 *
 * T-tier discipline: standing values are T1 (browser-safe scores); the canister
 * anchors commitments, never raw personaId (same rule as the DVN pipeline).
 */

import type { StandingScoreBreakdown } from './standingScore';

/** A standing record as it would live on the standalone canister. */
export interface CanisterStandingRecord {
  /** T2-safe commitment reference — NEVER the raw personaId (see CLAUDE.md). */
  standingRef: string;
  /** The composite standing score 0..100. */
  score: number;
  /** Veracity / contribution sub-scores (the projection dimensions). */
  veracityScore: number;
  contributionScore: number;
  /** When this record was last recomputed (ISO). */
  updatedAt: string;
}

/** Whether the standalone standing canister is live (always false in the stub). */
export function isStandingCanisterEnabled(): boolean {
  return process.env.STANDING_CANISTER_ID != null && process.env.STANDING_CANISTER_ID !== '';
}

/**
 * Submit a recomputed standing to the canister. STUB: no-op until the canister
 * is deployed. Returns whether the submission was accepted (false = stubbed).
 */
export async function submitStandingToCanister(_record: CanisterStandingRecord): Promise<boolean> {
  if (!isStandingCanisterEnabled()) return false; // stubbed — reputation store remains source of truth
  // TODO(backlog): wire the IC actor (mirror services/ops/icAgent.ts) + IDL, submit the record.
  return false;
}

/**
 * Read a standing from the canister. STUB: returns null until deployed, so
 * callers fall back to the local computation.
 */
export async function readStandingFromCanister(_standingRef: string): Promise<CanisterStandingRecord | null> {
  if (!isStandingCanisterEnabled()) return null;
  // TODO(backlog): query the canister by standingRef.
  return null;
}

/**
 * Correlate a standing record with a reputation snapshot — the whole point of
 * the split: standing (veracity of declarations) and reputation (accrued
 * adoption) become independently managed and correlated on demand. STUB shape.
 */
export interface StandingReputationCorrelation {
  standingRef: string;
  standingScore: number;
  reputationScore: number | null;
  /** Simple divergence signal for later analysis. */
  delta: number | null;
}

export function correlateStandingWithReputation(
  breakdown: Pick<StandingScoreBreakdown, 'score'>,
  reputationScore: number | null,
  standingRef: string,
): StandingReputationCorrelation {
  return {
    standingRef,
    standingScore: breakdown.score,
    reputationScore,
    delta: reputationScore == null ? null : breakdown.score - reputationScore,
  };
}
