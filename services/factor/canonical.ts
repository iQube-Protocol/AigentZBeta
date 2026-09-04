/**
 * Deterministic canonicalization + commitment hashing for Factor/Aegis
 * (PRD §7: "Assessment and receipt hashes must be derived from
 * canonicalized payloads, not unstable JSON serialization").
 *
 * This worktree predates `services/simulation/journal.ts`'s `canonicalJson`
 * and `services/research/review/deterministic.ts`'s `commit()` (neither
 * exists here — see the Phase 0 implementation-map doc). This module
 * mirrors their exact contract (recursive key-sorted JSON, sha256 hex
 * digest) so a later reconciliation can replace this file's body with a
 * re-export of the canonical one without changing any hash a caller has
 * already computed and stored.
 *
 * No `Date.now()` / `Math.random()` anywhere in this file — every
 * timestamp is a caller-supplied parameter, matching the same house rule
 * documented on the more current `deterministic.ts`.
 */

import { createHash } from 'crypto';

/** Recursively sort object keys so two structurally-equal payloads that
 *  differ only in property insertion order serialize identically. Arrays
 *  keep their order (order is meaningful for arrays; callers that want
 *  order-independence must pre-sort the array themselves). */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortForCanonical(value));
}

function sortForCanonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortForCanonical);
  if (value && typeof value === 'object') {
    const rec = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(rec).sort()) {
      sorted[key] = sortForCanonical(rec[key]);
    }
    return sorted;
  }
  return value;
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Deterministic commitment over any structure. Key order cannot change it. */
export function commit(value: unknown): string {
  return sha256Hex(canonicalJson(value));
}
