/**
 * reportComposition — canary for the pure grounding builder (CFS-025/CFS-019).
 * The impure gather/compose/persist paths hit the DB + provider and are driven
 * post-deploy; here we pin that the grounding manifest reflects the COLLECTIVE
 * record (all experiments present), so the regenerated narrative can be coherent.
 */

import { describe, it, expect } from 'vitest';
import { buildFindingsGrounding, type FindingsManifest } from '@/services/research/reportComposition';

const manifest: FindingsManifest = {
  scope: 'all',
  experiments: [
    {
      id: 'EXP-001',
      family: 'Semantic Fidelity',
      hypothesis: 'renders faithfully across modalities',
      lifecycle: 'replicated',
      publishedRuns: 1,
      distinctProviders: 1,
      runs: [{ provider: 'venice', model: 'llama-3.3-70b', aggregates: { restraint: '15/15' }, contentHash: 'ff0a442ebbc98a28aa', at: '2026-07-06' }],
    },
    {
      id: 'EXP-004',
      family: 'Platform Sovereignty',
      hypothesis: 'provider-interchangeable constitutional operation',
      lifecycle: 'replicated',
      publishedRuns: 3,
      distinctProviders: 2,
      runs: [{ provider: 'openai', model: 'gpt-4o', aggregates: { groundedPct: 95.8, sovereigntyRung: 's2-substitutable' }, contentHash: '2b67527f75280b4eaa', at: '2026-07-10' }],
    },
  ],
  groundedOn: ['ff0a442ebbc98a28aa', '2b67527f75280b4eaa'],
};

describe('buildFindingsGrounding — the collective record the narrative regenerates FROM', () => {
  it('includes EVERY experiment with published runs (EXP-004 is not omitted)', () => {
    const g = buildFindingsGrounding(manifest);
    expect(g).toContain('EXP-001');
    expect(g).toContain('EXP-004');
    expect(g).toContain('Platform Sovereignty');
  });

  it('states the collective count so the narrative cannot claim "three experiments" wrongly', () => {
    expect(buildFindingsGrounding(manifest)).toContain('2 experiment(s) with published runs');
  });

  it('carries each run’s provider/model + aggregates + content-hash prefix (grounding, not invention)', () => {
    const g = buildFindingsGrounding(manifest);
    expect(g).toContain('openai/gpt-4o');
    expect(g).toContain('sovereigntyRung');
    expect(g).toContain('2b67527f75280b4e');
  });
});
