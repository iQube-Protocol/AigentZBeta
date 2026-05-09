/**
 * cohortAliasService — Phase 3.1 of the unified IAM foundation plan.
 *
 * Replaces the deterministic placeholder `aliasCommitment` from Phase 1
 * with a real, unforgeable, non-correlatable T2 commitment value. Every
 * receipt-eligible decision attributes via this commitment instead of
 * personaId/rootDid (the privacy contract).
 *
 * Scheme (locked 2026-05-09):
 *
 *   commitment = HMAC-SHA256(
 *     escrow_secret,
 *     `${cohortId}|${personaId}|${epoch}`,
 *   )
 *
 * Properties:
 *   - Deterministic: same (cohort, persona, epoch) → same commitment.
 *     Allows downstream verifiers to recompute and match without
 *     storing a separate lookup table.
 *   - Non-invertible: only the holder of `escrow_secret` (the spine
 *     server, today; the escrow canister, post-Phase 4) can compute it.
 *     A third party seeing the commitment on-chain cannot derive the
 *     personaId.
 *   - Per-cohort isolation: same persona produces different commitments
 *     across cohorts, so cross-cohort linkage is unforgeable.
 *   - Rotatable via epoch: the operator can advance the epoch counter
 *     to force regeneration of all commitments without rotating the
 *     master secret. Useful when a cohort needs fresh anonymity.
 *
 * Future migration to Pedersen / Merkle commitments lands in Phase 5
 * if zero-knowledge proofs become a requirement. The function signature
 * stays the same; only the internal implementation changes.
 */

import { createHmac } from 'node:crypto';

const DEFAULT_EPOCH = 'v1';

/**
 * Compute a cohort alias commitment for the given persona + cohort.
 * Returns a 64-char hex string (32 bytes — full HMAC-SHA256 digest).
 */
export function computeAliasCommitment(
  personaId: string,
  cohortId: string,
  epoch: string = DEFAULT_EPOCH,
): string {
  if (!personaId || !cohortId) {
    throw new Error('cohortAliasService: personaId and cohortId required');
  }
  const secret = getEscrowSecret();
  const payload = `${cohortId}|${personaId}|${epoch}`;
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Probe — used by the receipt scaffolding to fail open with a clear
 * 500 hint when the env isn't configured rather than emitting a
 * placeholder commitment.
 */
export function isAliasServiceConfigured(): boolean {
  try {
    const s = getEscrowSecret();
    return s.length >= 16;
  } catch {
    return false;
  }
}

/**
 * The current epoch. Increments only when the operator forces cohort
 * rotation. Read from env so a deploy can change it without code change.
 */
export function getCurrentEpoch(): string {
  return process.env.COHORT_ALIAS_EPOCH || DEFAULT_EPOCH;
}

function getEscrowSecret(): Buffer {
  const raw = process.env.COHORT_ESCROW_SECRET || '';
  if (!raw) {
    throw new Error(
      'COHORT_ESCROW_SECRET is not set. Generate with: openssl rand -base64 32',
    );
  }
  let buf = Buffer.from(raw, 'base64');
  if (buf.length < 16) buf = Buffer.from(raw, 'hex');
  if (buf.length < 16) {
    throw new Error(
      `COHORT_ESCROW_SECRET too short (${buf.length} bytes). Need ≥16 (recommended 32).`,
    );
  }
  return buf;
}
