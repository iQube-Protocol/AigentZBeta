/**
 * EXP-006A topology scorer canary (Aletheon 2026-07-20).
 *
 * The classifier is pure — it takes a relation function `{sim, graphSubsumes}` —
 * so it is testable without an embedding provider or the invariant graph. Pins:
 *   - graph subsumption is ground truth and is preferred over the cosine proxy;
 *   - abstraction pairs carry their source (graph vs embedding), never conflated;
 *   - genuine omissions/redundancies survive; composite fidelity ∈ [0,1].
 */

import { describe, it, expect } from 'vitest';
import { classifyProjection, topologyAggregate, type RelationFn } from '@/services/experiments/topologyProjectionScore';

describe('classifyProjection (graph-truth subsumption + embedding fallback)', () => {
  it('uses the graph as ground truth for abstraction; keeps genuine deltas', () => {
    const predicted = ['authentication', 'delegation', 'scalability'];
    const reference = ['token-validation', 'delegation', 'audit-logging'];
    // authentication SUBSUMES token-validation in the graph; nothing else related.
    const rel: RelationFn = (p, r) =>
      p === 'authentication' && r === 'token-validation'
        ? { sim: 0.5, graphSubsumes: true }
        : { sim: 0, graphSubsumes: false };

    const s = classifyProjection('t', predicted, reference, rel);

    expect(s.lexicalMatches).toBe(1); // delegation ≡ delegation
    expect(s.abstractionPairs).toHaveLength(1);
    expect(s.abstractionPairs[0]).toMatchObject({ predicted: 'authentication', reference: 'token-validation', source: 'graph' });
    expect(s.omissions).toContain('audit-logging');    // genuine gap
    expect(s.redundancies).toContain('scalability');   // genuine extra
    expect(s.projectionFidelity).toBeGreaterThan(0);
    expect(s.projectionFidelity).toBeLessThanOrEqual(1);
  });

  it('falls back to the embedding band when the graph has no relation', () => {
    // No graph edge, but cosine in the family band [0.62, 0.82) → abstraction (embedding).
    const rel: RelationFn = () => ({ sim: 0.7, graphSubsumes: false });
    const s = classifyProjection('t', ['authn'], ['authentication'], rel);
    expect(s.abstractionPairs).toHaveLength(1);
    expect(s.abstractionPairs[0].source).toBe('embedding');
    expect(s.omissions).toHaveLength(0);
  });

  it('a high cosine (≥ MATCH) is a full semantic match, not an abstraction', () => {
    const rel: RelationFn = () => ({ sim: 0.9, graphSubsumes: false });
    const s = classifyProjection('t', ['secure access'], ['secure-access-control'], rel);
    // canonical forms differ, but cosine ≥ 0.82 → recovered as a semantic match.
    expect(s.semanticMatches).toBe(1);
    expect(s.abstractionPairs).toHaveLength(0);
    expect(s.omissions).toHaveLength(0);
  });
});

describe('topologyAggregate (graph vs embedding never conflated)', () => {
  it('reports graph-confirmed and embedding abstraction counts separately', () => {
    const graphScore = classifyProjection('a', ['authentication'], ['token-validation'],
      (p, r) => (p === 'authentication' && r === 'token-validation' ? { sim: 0.4, graphSubsumes: true } : { sim: 0, graphSubsumes: false }));
    const embScore = classifyProjection('b', ['authn'], ['authentication'], () => ({ sim: 0.7, graphSubsumes: false }));
    const agg = topologyAggregate([graphScore, embScore]);
    expect(agg.graphConfirmedAbstractions).toBe(1);
    expect(agg.embeddingAbstractions).toBe(1);
    expect(agg.deltaClasses.abstraction).toBe(2);
  });
});
