/**
 * findingsReportComposer — pins the deterministic, sequential, coherent
 * composition shared by the live-draft tab AND the canonical server regenerate.
 * Guards the operator's requirements: experiments in canonical series order,
 * EXP-005 shown in-slot as publication-pending (never a silent gap), no appended
 * "additional experiments" tail, and published runs outside the registry
 * preserved under "Further experiments".
 */
import { describe, it, expect } from 'vitest';
import { composeFindingsReport, type ReportRun } from '@/services/research/findingsReportComposer';

const run = (over: Partial<ReportRun> = {}): ReportRun => ({
  provider: 'openai',
  model: 'gpt-4o',
  aggregates: { note: 'x', groundedPct: 96 },
  contentHash: 'abcdef0123456789aa',
  receiptStatus: 'local',
  createdAt: '2026-07-20T00:00:00Z',
  ...over,
});

const now = new Date('2026-07-21T00:00:00Z');

describe('composeFindingsReport — sequential + coherent, single ordered spine', () => {
  // Operator's real shape: 001/002/003/004/006 + IPV-001 + IRV-001 published;
  // EXP-005 has no runs (authored → publication pending); plus an orphan id.
  const md = composeFindingsReport({
    now,
    runsByExp: {
      'EXP-001': [run()],
      'EXP-002': [run()],
      'EXP-003': [run()],
      'EXP-004': [run(), run()],
      'EXP-006': [run({ aggregates: { meanPrecision: 0.48, meanRecall: 0.36 } })],
      'IRV-001': [run()],
      'IPV-001': [run()],
      'EXP-099': [run()], // outside the pinned registry
    },
  });

  it('titles it the metaMe Invariant Research Lab report', () => {
    expect(md).toContain('# The metaMe Invariant Research Lab — Findings Report');
  });

  it('places EXP-005 in-slot (publication pending) between EXP-004 and EXP-006 — never a silent gap', () => {
    const i4 = md.indexOf('EXP-004 — Constitutional Sovereignty');
    const i5 = md.indexOf('EXP-005 — Provider Choice');
    const i6 = md.indexOf('EXP-006 → EXP-006A');
    expect(i4).toBeGreaterThan(-1);
    expect(i5).toBeGreaterThan(-1);
    expect(i6).toBeGreaterThan(-1);
    expect(i4).toBeLessThan(i5);
    expect(i5).toBeLessThan(i6);
    // EXP-005 has no runs → its section says publication pending, not a fabricated result.
    expect(md).toMatch(/EXP-005 — Provider Choice[\s\S]*publication pending/);
  });

  it('emits series in canonical order (Foundational → Sovereignty → Invariant Intelligence → Instrument Validation)', () => {
    const fvs = md.indexOf('### Foundational Validation Series');
    const pse = md.indexOf('### Platform Sovereignty');
    const iivs = md.indexOf('### Invariant Intelligence Validation Series');
    const iv0 = md.indexOf('### Instrument Validation');
    expect(fvs).toBeGreaterThan(-1);
    expect(fvs).toBeLessThan(pse);
    expect(pse).toBeLessThan(iivs);
    expect(iivs).toBeLessThan(iv0);
  });

  it('has NO appended "Additional experiments" tail — the anti-pattern the fix removed', () => {
    expect(md).not.toContain('Additional experiments');
  });

  it('preserves a published run outside the registry under "Further experiments" (no data loss)', () => {
    expect(md).toContain('### Further experiments');
    expect(md).toContain('## ');
    expect(md).toContain('EXP-099');
  });

  it('numbers sections sequentially with no gaps', () => {
    const nums = Array.from(md.matchAll(/^## (\d+)\. /gm)).map((m) => Number(m[1]));
    expect(nums.length).toBeGreaterThan(5);
    expect(nums).toEqual(nums.map((_, i) => i + 1)); // 1..N, contiguous
  });

  it('introduction is a live programme map (not a frozen "three experiments" preamble)', () => {
    expect(md).toContain('The research programme is organised into **series**');
    expect(md).toContain('**Platform Sovereignty Experiment Series.**');
  });

  it('an empty record still composes (header + no runs), never throws', () => {
    const empty = composeFindingsReport({ now, runsByExp: {} });
    expect(empty).toContain('Findings Report');
    // EXP-005 (authored) still shows as pending even with zero published runs.
    expect(empty).toContain('EXP-005 — Provider Choice');
  });
});
