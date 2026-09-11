/**
 * The ONE hash-covered per-invariant projection every crystal content
 * commitment must use (2026-08-30, EXP-P1 legacy-verification work).
 *
 * Before this file existed, `crystalStatistics.ts`'s `frozenHash` and
 * `crystalFrozenManifest.ts`'s `recomputedLiveHash` each built an
 * independently-typed `{id, statement, namespace, semanticType, status,
 * evidenceProvenance, provenance}` object literal, sorted it, and hashed it —
 * two copies of the same commitment shape (inv.engineering.036). Extracted
 * here so there is exactly one place that defines what a crystal's content
 * hash covers.
 *
 * `HASH_COVERED_FIELD_NAMES` and `SCIENTIFICALLY_MATERIAL_FIELD_NAMES` are
 * DERIVED from `HashCoveredMember` itself (via a literal that must satisfy
 * the type), never hand-maintained as a second list — if a future change
 * to the hash-covered shape adds or removes a field, both derived lists move
 * with it automatically, and nothing needs to be duplicated in a second file
 * (the failure mode services/research/crystalLegacyContentVerification.ts's
 * "scientifically material" classification exists to never reproduce).
 */

import { readEvidenceProvenance } from '@/services/research/experimentalPopulations';
import { commit } from '@/services/research/review/deterministic';
import type { InvariantRecord } from '@/types/invariants';

export interface HashCoveredMember {
  id: string;
  statement: string;
  namespace: string;
  semanticType: string | null;
  status: string;
  evidenceProvenance: string | null;
  provenance: Record<string, unknown> | null;
}

export function toHashCoveredProjection(inv: InvariantRecord): HashCoveredMember {
  return {
    id: inv.id,
    statement: inv.statement,
    namespace: inv.namespace,
    semanticType: inv.semanticType,
    status: inv.status,
    evidenceProvenance: readEvidenceProvenance(inv.provenance),
    provenance: inv.provenance,
  };
}

/** Sorted by id — the SAME deterministic order both prior call sites used,
 *  preserved here so refactoring onto this module changes no hash value. */
export function sortedHashCoveredProjection(invariants: readonly InvariantRecord[]): HashCoveredMember[] {
  return invariants.map(toHashCoveredProjection).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** `commit()`'s `canonicalJson` is key-order-independent (see
 *  services/research/review/deterministic.ts) — only the VALUES below can
 *  move this hash, never property order. */
export function computeCrystalContentHash(input: {
  crystalDomain: string;
  invariantCount: number;
  invariants: readonly InvariantRecord[];
}): string {
  return commit({
    crystalDomain: input.crystalDomain,
    invariantCount: input.invariantCount,
    members: sortedHashCoveredProjection(input.invariants),
  });
}

/** A literal that must satisfy `HashCoveredMember` — the type checker forces
 *  this to include every field the interface declares, so `Object.keys`
 *  below is a live derivation, not an independently-typed second list. */
const SAMPLE_HASH_COVERED_MEMBER: HashCoveredMember = {
  id: '',
  statement: '',
  namespace: '',
  semanticType: null,
  status: '',
  evidenceProvenance: null,
  provenance: null,
};

export const HASH_COVERED_FIELD_NAMES = Object.keys(SAMPLE_HASH_COVERED_MEMBER) as readonly (keyof HashCoveredMember)[];

/**
 * Every hash-covered field EXCEPT `status` — the one field the freeze
 * commitment covers that NO check in `CRYSTAL_READINESS_CHECK_CONTRACT`
 * reads as a measured value (verified exhaustively against all ten checks,
 * 2026-08-30: `status` functions only as the corpus-membership filter
 * `buildFrozenCrystalManifest` already recovers independently of it — see
 * that module's own doc comment). Derived from `HASH_COVERED_FIELD_NAMES`,
 * never a second hand-maintained array — if the hash-covered shape ever
 * changes, this list changes with it, so a legacy-verification claim built
 * on it cannot silently go stale.
 */
export const SCIENTIFICALLY_MATERIAL_FIELD_NAMES = HASH_COVERED_FIELD_NAMES.filter(
  (f): f is Exclude<keyof HashCoveredMember, 'status'> => f !== 'status',
);
