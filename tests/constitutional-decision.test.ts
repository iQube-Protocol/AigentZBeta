/**
 * Constitutional Decision canary (CFS-029, operator direction 2026-07-13).
 *
 * Pins the PURE decision floor: the pipeline explicitly decides HOW a
 * capability is realized — nine mechanisms + 'none' — BEFORE a pack is
 * drafted. The heuristic never fabricates: full use_directly coverage with
 * nothing missing → 'none' (compose, build nothing — duplicating existing
 * capability is constitutional drift); real gaps → 'code' at the named
 * paths; no evidence → the honest 'code' default that says it's a default.
 */

import { describe, it, expect } from 'vitest';
import {
  heuristicDecision,
  isRealizationMechanism,
} from '@/services/constitutional/constitutionalDecision';
import { IMPLEMENTATION_MECHANISMS } from '@/services/constitutional/capabilityEvidence';

describe('the decision vocabulary', () => {
  it('accepts the nine mechanisms plus none; rejects inventions', () => {
    for (const m of IMPLEMENTATION_MECHANISMS) expect(isRealizationMechanism(m)).toBe(true);
    expect(isRealizationMechanism('none')).toBe(true);
    expect(isRealizationMechanism('vibes')).toBe(false);
    expect(isRealizationMechanism(undefined)).toBe(false);
  });
});

describe('heuristicDecision — the pure floor', () => {
  it("full use_directly coverage + nothing missing → 'none' (no build required)", () => {
    const d = heuristicDecision({
      existing: [
        { name: 'Video Gen', path: 'registry_assets/video', disposition: 'use_directly' },
        { name: 'Article Gen', path: 'registry_assets/article', disposition: 'use_directly' },
      ],
      missing: [],
    });
    expect(d.mechanism).toBe('none');
    expect(d.noBuildRequired).toBe(true);
    expect(d.decidedBy).toBe('heuristic');
    expect(d.alternatives.some((a) => a.reason.includes('constitutional drift'))).toBe(true);
  });

  it("coverage that needs extension → 'code' (a delta on named targets)", () => {
    const d = heuristicDecision({
      existing: [{ name: 'Bundle', path: 'registry_assets/bundle', disposition: 'extend' }],
      missing: [],
    });
    expect(d.mechanism).toBe('code');
    expect(d.noBuildRequired).toBe(false);
  });

  it("genuinely missing capabilities → 'code' with the gap count in the rationale", () => {
    const d = heuristicDecision({
      existing: [{ name: 'x', disposition: 'use_directly' }],
      missing: [{ name: 'Alignment', path: 'services/content/alignmentService.ts' }],
    });
    expect(d.mechanism).toBe('code');
    expect(d.rationale).toContain('1 genuinely missing');
  });

  it('no evidence → honest default, labelled as a default', () => {
    const d = heuristicDecision(undefined);
    expect(d.mechanism).toBe('code');
    expect(d.rationale).toContain('honest default');
  });
});
