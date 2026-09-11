/**
 * Determinism primitives for package construction, hashing and sampling.
 *
 * CLAUDE.md house rule for this build: no `Date.now()` and no `Math.random()`
 * anywhere in package construction or hashing. Both are here as an absence —
 * every time comes in as a parameter and every "random" choice is a hash of a
 * committed seed.
 *
 * The sampling matters more than it looks. A sample chosen with `Math.random()`
 * cannot be re-derived from the manifest, so a reader cannot check that the
 * sample was drawn before the results were seen rather than after. A seeded
 * hash sample can be recomputed by anyone holding the seed and the population,
 * which turns "we sampled fairly" from an assurance into a verifiable fact.
 *
 * `canonicalJson` is imported rather than redefined — it already exists as the
 * repo's stable stringify (`inv.engineering.036`: one authoritative location
 * per concern).
 */

import { createHash } from 'crypto';
import { canonicalJson } from '@/services/simulation/journal';

export { canonicalJson };

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Deterministic commitment over any structure. Key order cannot change it. */
export function commit(value: unknown): string {
  return sha256Hex(canonicalJson(value));
}

/**
 * A stable [0,1) score for one key under one seed. Same inputs, same score,
 * forever — on any machine, in any process, in any order.
 */
export function seededScore(seed: string, key: string): number {
  const hex = sha256Hex(`${seed}::${key}`).slice(0, 13);
  return parseInt(hex, 16) / 2 ** 52;
}

/** Sort a population into a stable, seed-dependent order. Ties break on key. */
export function seededOrder(seed: string, keys: readonly string[]): string[] {
  return [...keys].sort((a, b) => {
    const d = seededScore(seed, a) - seededScore(seed, b);
    return d !== 0 ? d : a < b ? -1 : a > b ? 1 : 0;
  });
}

/**
 * Take `n` from a population deterministically. `n` larger than the population
 * returns the whole population — a sample can be a census, and silently
 * returning fewer than asked is the correct behaviour rather than an error.
 */
export function seededTake(seed: string, keys: readonly string[], n: number): string[] {
  if (n <= 0) return [];
  return seededOrder(seed, keys).slice(0, n);
}

/**
 * Stratified sample: `n` per stratum, strata in sorted order so the result is
 * order-independent with respect to the input array.
 */
export function stratifiedSample(
  seed: string,
  items: readonly { key: string; stratum: string }[],
  perStratum: number,
): string[] {
  const byStratum = new Map<string, string[]>();
  for (const it of items) {
    const list = byStratum.get(it.stratum) ?? [];
    list.push(it.key);
    byStratum.set(it.stratum, list);
  }
  const out: string[] = [];
  for (const stratum of [...byStratum.keys()].sort()) {
    out.push(...seededTake(`${seed}::${stratum}`, byStratum.get(stratum)!, perStratum));
  }
  return out;
}

/**
 * Proportional stratified sample: a fraction of each stratum, with a floor of
 * one so a small stratum is never sampled out of existence. A stratified sample
 * that skips every small stratum is a sample of the large strata wearing the
 * word "stratified".
 */
export function proportionalStratifiedSample(
  seed: string,
  items: readonly { key: string; stratum: string }[],
  rate: number,
  minPerStratum = 1,
): string[] {
  // A rate of zero means zero. The floor exists so a POSITIVE rate cannot round
  // a small stratum away; it must not resurrect a sample the caller declined.
  if (rate <= 0) return [];
  const byStratum = new Map<string, string[]>();
  for (const it of items) {
    const list = byStratum.get(it.stratum) ?? [];
    list.push(it.key);
    byStratum.set(it.stratum, list);
  }
  const out: string[] = [];
  for (const stratum of [...byStratum.keys()].sort()) {
    const pool = byStratum.get(stratum)!;
    const n = Math.max(Math.min(minPerStratum, pool.length), Math.ceil(pool.length * rate));
    out.push(...seededTake(`${seed}::${stratum}`, pool, n));
  }
  return out;
}
