/**
 * Canary — PRD-EPI-001 §10 Readiness Dashboard contract.
 *
 * Pins the reconciliation Aletheon's review forced: Execution and Publication
 * are EXPECTED red before the run and must NOT gate protocol-ratified; only
 * Infrastructure/Crystal/Coverage/Freeze/Review do. An empty experiment (no
 * artifacts) must report protocol-ratified NOT ready — never silently green.
 */

import { describe, it, expect } from 'vitest';
import { buildReadinessDashboard } from '../services/research/readinessDashboard';

describe('PRD-EPI-001 §10 — readiness dashboard', () => {
  it('marks Execution and Publication as not gating protocol-ratified (expected red pre-run)', async () => {
    const d = await buildReadinessDashboard('EXP-TEST-EMPTY-DASHBOARD');
    const byName = Object.fromEntries(d.sections.map((s) => [s.section, s]));
    expect(byName['Execution'].gatesProtocolRatified).toBe(false);
    expect(byName['Publication'].gatesProtocolRatified).toBe(false);
    expect(d.expectedRedPreRun).toEqual(['Execution', 'Publication']);
  });

  it('gates protocol-ratified only on Infrastructure/Crystal/Coverage/Freeze/Review', async () => {
    const d = await buildReadinessDashboard('EXP-TEST-EMPTY-DASHBOARD');
    const gating = d.sections.filter((s) => s.gatesProtocolRatified).map((s) => s.section).sort();
    expect(gating).toEqual(['Coverage', 'Crystal', 'Freeze', 'Infrastructure', 'Review']);
  });

  it('reports protocol-ratified NOT ready for an experiment with no artifacts', async () => {
    const d = await buildReadinessDashboard('EXP-TEST-EMPTY-DASHBOARD');
    expect(d.protocolRatifiedReady).toBe(false);
    // Crystal/Coverage/Freeze/Review are red with no artifacts; only
    // Infrastructure is green (build-completion signal).
    const green = d.sections.filter((s) => s.status === 'green').map((s) => s.section);
    expect(green).toEqual(['Infrastructure']);
  });

  it('always returns all seven sections', async () => {
    const d = await buildReadinessDashboard('EXP-TEST-EMPTY-DASHBOARD');
    expect(d.sections.map((s) => s.section)).toEqual([
      'Infrastructure',
      'Crystal',
      'Coverage',
      'Freeze',
      'Review',
      'Execution',
      'Publication',
    ]);
  });
});
