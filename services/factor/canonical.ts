/**
 * Deterministic canonicalization + commitment hashing for Factor/Aegis
 * (PRD §7: "Assessment and receipt hashes must be derived from
 * canonicalized payloads, not unstable JSON serialization").
 *
 * Kept self-contained rather than importing `services/research/review/
 * deterministic.ts`'s `commit()` — that module lives under
 * `services/research/*` (the Crystal/Track2 invariant substrate), which is
 * explicitly out of scope for this workstream (operator directive,
 * 2026-09-04: "Crystal is a separate, existing scientific pipeline... this
 * dispatch must not touch, extend, or mutate it"). Even a read-only import
 * couples Factor/Aegis's deploy surface to Crystal's; a 12-line hash helper
 * is cheap enough that the honest move is to keep Aegis's own copy rather
 * than create that coupling. If a genuinely shared canonicalization utility
 * is ever extracted to a neutral location (e.g. `services/shared/`), this
 * file should re-export it — never the reverse.
 *
 * No `Date.now()` / `Math.random()` anywhere in this file — every
 * timestamp is a caller-supplied parameter.
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
