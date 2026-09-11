/**
 * CFS-035 Phase 0 canary — the Invariant Engine seam + the discovery-ranking
 * node in shadow mode.
 *
 * Guarantees:
 *   1. The projector produces a valid ranking (every input present; ordered by
 *      projected total desc; stable tiebreak).
 *   2. The Phase-0 projection is a FAITHFUL re-expression of the incumbent
 *      signals — the four dimensions sum to the same total the incumbent
 *      `scoreCapsule` would produce (so shadow adoption is behaviour-preserving).
 *   3. Shadow is observe-only — `runShadow` NEVER mutates the incumbent order
 *      and never throws.
 *   4. `rankAgreement` is 1.0 for identical order, 0.0 for full reversal.
 *
 * Pure-logic, no DB, no network. Run: `npm test tests/invariant-engine-discovery-shadow.test.ts`.
 */

import { describe, it, expect } from 'vitest';
import type { RuntimeCapsuleRecord } from '@/types/runtimeCapsules';
import { compareShadow, rankAgreement, runShadow } from '@/services/invariants/engine';
import { discoveryRankingProjector, DISCOVERY_RANKING_NODE_ID } from '@/services/invariants/nodes/discoveryRanking';

function capsule(id: string, over: Partial<RuntimeCapsuleRecord> = {}): RuntimeCapsuleRecord {
  return {
    id,
    sourceType: 'codex',
    title: id,
    description: '',
    heroAsset: null,
    thumbnailAsset: null,
    assetStatus: 'missing',
    metadata: { modalityHints: [] },
    launchTarget: { type: 'codex', href: '#' },
    ...over,
  };
}

describe('CFS-035 discovery-ranking node — projection', () => {
  it('ranks every capsule by projected total, highest first', () => {
    const high = capsule('high', { sourceType: 'experience', assetStatus: 'resolved' }); // importance 16
    const mid = capsule('mid', { sourceType: 'smart-content', metadata: { modalityHints: [], codexSlug: 'knyt' } }); // trust 4+3+2=9
    const low = capsule('low');                                                          // 0
    const out = discoveryRankingProjector({ capsules: [low, mid, high], prompt: '', intent: 'be' });
    expect(out.nodeId).toBe(DISCOVERY_RANKING_NODE_ID);
    expect(out.ranked.map((c) => c.id)).toEqual(['high', 'mid', 'low']);
    expect(out.ranked).toHaveLength(3); // nothing dropped
  });

  it('dimensions sum to the total, transparently (the receipt "why")', () => {
    const c = capsule('c', { sourceType: 'experience', assetStatus: 'resolved', metadata: { modalityHints: ['watch'], codexSlug: 'knyt' } });
    const out = discoveryRankingProjector({ capsules: [c], prompt: '', intent: 'watch' });
    const p = out.projection[0];
    // importance 10+6=16 · trust 3(showcase)+2(token 'knyt' in title? no — title is 'c') = 0 · need watch+4
    expect(p.importance).toBe(16);
    expect(p.need).toBe(4);
    expect(p.total).toBe(p.importance + p.novelty + p.trust + p.need);
  });

  it('is a faithful re-expression: total equals the incumbent scoreCapsule formula', () => {
    // experience(+10) resolved(+6) showcase-codex qripto(+3) make×surfaceIntent-make(+8)
    // make×sourceType-experience(+5) = 32 — identical to scoreCapsule for this capsule.
    const c = capsule('c', {
      sourceType: 'experience',
      assetStatus: 'resolved',
      metadata: { modalityHints: [], codexSlug: 'qripto', surfaceIntent: 'make' },
    });
    const out = discoveryRankingProjector({ capsules: [c], prompt: '', intent: 'make' });
    expect(out.projection[0].total).toBe(32);
  });
});

describe('CFS-035 shadow mode — observe-only', () => {
  it('runShadow never mutates the incumbent order and returns a comparison', () => {
    const a = capsule('a', { sourceType: 'experience' });
    const b = capsule('b');
    const incumbent = [a, b];
    const before = incumbent.map((c) => c.id);
    const cmp = runShadow(discoveryRankingProjector, { capsules: [a, b], prompt: '', intent: 'be' }, incumbent, (c) => c.id);
    expect(incumbent.map((c) => c.id)).toEqual(before); // unchanged — observe-only
    expect(cmp).not.toBeNull();
    expect(cmp!.nodeId).toBe(DISCOVERY_RANKING_NODE_ID);
    expect(cmp!.topAgreement).toBe(true); // 'a' (experience) tops both
  });

  it('compareShadow flags disagreement when the top differs', () => {
    const a = capsule('a');                                  // 0
    const b = capsule('b', { sourceType: 'experience' });    // 10
    const projection = discoveryRankingProjector({ capsules: [a, b], prompt: '', intent: 'be' });
    // incumbent (wrong) order puts 'a' first; projection puts 'b' first
    const cmp = compareShadow([a, b], projection, (c) => c.id);
    expect(cmp.topAgreement).toBe(false);
  });
});

describe('CFS-035 rankAgreement', () => {
  const k = (x: string) => x;
  it('is 1.0 for identical order', () => {
    expect(rankAgreement(['a', 'b', 'c'], ['a', 'b', 'c'], k)).toBe(1);
  });
  it('is 0.0 for full reversal', () => {
    expect(rankAgreement(['a', 'b', 'c'], ['c', 'b', 'a'], k)).toBe(0);
  });
  it('is between for a partial swap', () => {
    const v = rankAgreement(['a', 'b', 'c'], ['b', 'a', 'c'], k);
    expect(v).toBeGreaterThan(0);
    expect(v).toBeLessThan(1);
  });
});
