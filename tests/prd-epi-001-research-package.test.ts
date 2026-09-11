/**
 * Canary — PRD-EPI-001 §4 Research Package exporter.
 *
 * Runs offline (no Supabase env in this sandbox): getSupabaseServer() returns
 * null without credentials, so listArtifacts/deriveOverview/listPublishedRuns
 * all degrade to empty results rather than throwing — this suite pins that
 * degrade-gracefully contract plus the unknown-experiment-id error path.
 */

import { describe, it, expect } from 'vitest';
import { buildResearchPackage } from '../services/research/researchPackage';
import { EXPERIMENT_REGISTRY } from '../types/research';

describe('PRD-EPI-001 §4 — Research Package exporter', () => {
  it('returns a clear error (never throws) for an unknown experiment id', async () => {
    const result = await buildResearchPackage('EXP-DOES-NOT-EXIST');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/unknown experiment/i);
    expect(result.package).toBeUndefined();
  });

  it('assembles a package for a known registry experiment id', async () => {
    const knownId = EXPERIMENT_REGISTRY[0].id;
    const result = await buildResearchPackage(knownId);
    expect(result.ok).toBe(true);
    expect(result.package).toBeDefined();
    expect(result.package?.experimentId).toBe(knownId);
    expect(result.package?.protocol.id).toBe(knownId);
    expect(result.package?.hypothesis).toBe(EXPERIMENT_REGISTRY[0].hypothesis);
    expect(Array.isArray(result.package?.frozenArtifacts)).toBe(true);
    expect(Array.isArray(result.package?.executionReceipts)).toBe(true);
    expect(Array.isArray(result.package?.rawOutputs)).toBe(true);
  });

  it('interpretationTable is null (never fabricated) when no interpretation-table artifact exists', async () => {
    const knownId = EXPERIMENT_REGISTRY[0].id;
    const result = await buildResearchPackage(knownId);
    expect(result.package?.interpretationTable).toBeNull();
  });

  it('EXP-P1 (the PRD-EPI-001 subject experiment) is present in the registry and packages cleanly', async () => {
    const result = await buildResearchPackage('EXP-P1');
    expect(result.ok).toBe(true);
    expect(result.package?.protocol.family).toMatch(/Representation & Runtime Gauntlet/);
  });
});
