/**
 * Invariant Service — comparison (CFS-003a §2.3).
 *
 * Semantic comparison v1: normalized-form equality + token Jaccard
 * similarity. Powers duplicate detection ("does this already exist?"),
 * merge candidates, and retrieval dedup. Embedding-based comparison can
 * replace the internals later without changing the contract.
 *
 * Server-only.
 */

import type { InvariantNamespace, InvariantRecord } from '@/types/invariants';
import { listInvariants } from './store';

const STOPWORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'be', 'to', 'of', 'and', 'or', 'not',
  'should', 'must', 'may', 'never', 'always', 'by', 'in', 'on', 'for',
  'its', 'it', 'their', 'that', 'this', 'through', 'over', 'with',
]);

export function normalizeStatement(statement: string): string {
  return statement
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenSet(statement: string, keepStopwords = false): Set<string> {
  const tokens = normalizeStatement(statement).split(' ').filter(Boolean);
  return new Set(keepStopwords ? tokens : tokens.filter((t) => !STOPWORDS.has(t)));
}

/** Token Jaccard similarity in [0, 1]. */
export function similarity(a: string, b: string): number {
  if (normalizeStatement(a) === normalizeStatement(b)) return 1;
  const setA = tokenSet(a);
  const setB = tokenSet(b);
  if (setA.size === 0 || setB.size === 0) {
    // All-stopword statements: fall back to full-token comparison.
    const fullA = tokenSet(a, true);
    const fullB = tokenSet(b, true);
    if (fullA.size === 0 || fullB.size === 0) return 0;
    const inter = [...fullA].filter((t) => fullB.has(t)).length;
    return inter / (fullA.size + fullB.size - inter);
  }
  const intersection = [...setA].filter((t) => setB.has(t)).length;
  return intersection / (setA.size + setB.size - intersection);
}

export interface DuplicateCandidate {
  invariant: InvariantRecord;
  similarity: number;
  exact: boolean;
}

/**
 * Find existing invariants that likely state the same thing. Scans the
 * candidate namespace (or all) among non-retired statuses.
 */
export async function findDuplicates(
  statement: string,
  options: { namespace?: InvariantNamespace; threshold?: number } = {},
): Promise<DuplicateCandidate[]> {
  const threshold = options.threshold ?? 0.75;
  const candidates = await listInvariants({
    namespace: options.namespace,
    status: ['draft', 'proposed', 'validated', 'canonical'],
    limit: 500,
  });
  return candidates
    .map((invariant) => {
      const score = similarity(statement, invariant.statement);
      return { invariant, similarity: score, exact: score === 1 };
    })
    .filter((c) => c.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity);
}
