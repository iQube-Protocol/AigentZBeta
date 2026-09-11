/**
 * CFS-028 Capability Graph canary (RATIFIED 2026-07-12).
 *
 * Pins the contract invariants over the PURE half of
 * services/capability/capabilityGraph.ts:
 *   1. every edge's capability is a real ArtifactProfileId or 'deployment-execution'
 *   2. seeded fitness ∈ [0,1]; evidence counters all zero at seed
 *   3. costs are stubbed ordinals only
 *   4. deployment-execution edges are DORMANT (D2 unratified)
 *   5. every edge's producer resolves — no invented nodes
 * plus the pure ranking core: eligible-first ordering, the constitutional
 * standing bar on delegates, dormant exclusion, and the Law XI shape
 * (ineligible producers are LISTED with reasons, never silently dropped).
 */

import { describe, it, expect } from 'vitest';
import {
  buildCapabilityGraph,
  rankProducersForCapability,
  CONSTITUTIONAL_MIN_CEILING,
  DOCUMENT_PROFILES,
} from '@/services/capability/capabilityGraph';
import { ARTIFACT_PROFILES } from '@/types/artifactRuntime';
import { COST_BANDS } from '@/types/capabilityGraph';

const graph = buildCapabilityGraph();

describe('seed integrity (contract invariants 1–5)', () => {
  it('every edge capability is a real profile or deployment-execution', () => {
    const valid = new Set<string>([...ARTIFACT_PROFILES, 'deployment-execution']);
    for (const e of graph.edges) expect(valid.has(e.capability)).toBe(true);
  });

  it('fitness ∈ [0,1], evidence zeroed, costs stubbed ordinals, reasons stated', () => {
    for (const e of graph.edges) {
      expect(e.fitness).toBeGreaterThanOrEqual(0);
      expect(e.fitness).toBeLessThanOrEqual(1);
      expect(e.evidence).toEqual({ productions: 0, promotions: 0, failures: 0 });
      expect(COST_BANDS).toContain(e.cost);
      expect(e.seedReason.length).toBeGreaterThan(10);
    }
  });

  it('deployment-execution edges are dormant until D2 ratification', () => {
    const execEdges = graph.edges.filter((e) => e.capability === 'deployment-execution');
    expect(execEdges.length).toBeGreaterThan(0);
    for (const e of execEdges) expect(e.dormant).toBe(true);
  });

  it('every edge traces to a producer — no invented nodes', () => {
    const ids = new Set(graph.producers.map((p) => p.id));
    for (const e of graph.edges) expect(ids.has(e.producerId)).toBe(true);
  });

  it('model producers derive from the ModelQube registry (stubbed entries excluded)', () => {
    const models = graph.producers.filter((p) => p.kind === 'model');
    expect(models.length).toBeGreaterThan(0);
    for (const m of models) expect(m.ref.startsWith('modelqube:')).toBe(true);
    // Every model seeds against the document-class profiles.
    const firstModel = models[0];
    const caps = graph.edges.filter((e) => e.producerId === firstModel.id).map((e) => e.capability);
    expect(new Set(caps)).toEqual(new Set(DOCUMENT_PROFILES));
  });
});

describe('rankProducersForCapability — the Law XI ranking core', () => {
  it('software at operational tier: Claude Code leads, eligible', () => {
    const recs = rankProducersForCapability('software', 'operational', graph, {});
    expect(recs.length).toBeGreaterThan(0);
    expect(recs[0].producer.id).toBe('harness:claude-code');
    expect(recs[0].eligible).toBe(true);
  });

  it('deployment-execution is listed but ineligible (dormant), with the reason stated', () => {
    const recs = rankProducersForCapability('deployment-execution', 'operational', graph, {});
    expect(recs.length).toBeGreaterThan(0);
    for (const r of recs) {
      expect(r.eligible).toBe(false);
      expect(r.ineligibleReason).toContain('D2');
    }
  });

  it('constitutional tier gates DELEGATES on the earned ceiling — listed, not dropped', () => {
    const noStanding = rankProducersForCapability('research', 'constitutional', graph, {
      aletheon: null,
      moneypenny: null,
      nakamoto: null,
      'aigent-z': null,
      marketa: null,
      kn0w1: null,
    });
    const aletheon = noStanding.find((r) => r.producer.ref === 'aletheon');
    expect(aletheon).toBeDefined();
    expect(aletheon!.eligible).toBe(false);
    expect(aletheon!.ineligibleReason).toContain(CONSTITUTIONAL_MIN_CEILING.split('_')[0]);

    const earned = rankProducersForCapability('research', 'constitutional', graph, {
      aletheon: { overall: 60, trustBandCeiling: 'L3_PRODUCTION_CANDIDATE' },
    });
    const aletheonEarned = earned.find((r) => r.producer.ref === 'aletheon');
    expect(aletheonEarned!.eligible).toBe(true);
    expect(aletheonEarned!.reasons.join(' ')).toContain('clears the constitutional bar');
  });

  it('eligible producers always rank above ineligible ones; fitness descends within each', () => {
    const recs = rankProducersForCapability('research', 'constitutional', graph, {});
    let seenIneligible = false;
    let lastFitness = Infinity;
    for (const r of recs) {
      if (!r.eligible) seenIneligible = true;
      if (r.eligible) expect(seenIneligible).toBe(false);
      if (r.eligible) {
        expect(r.fitness).toBeLessThanOrEqual(lastFitness);
        lastFitness = r.fitness;
      }
    }
  });
});
