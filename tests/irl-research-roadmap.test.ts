/**
 * Research Roadmap Expansion (CFS-019 amendment, 2026-07-07). Pins the
 * machine-readable agenda the Copilot plans against — incorporated into the
 * EXISTING registry, not a parallel framework.
 */
import {
  RESEARCH_PROGRAMMES,
  APPLIED_RESEARCH_CHAIN,
  ROADMAP_PRIORITIZATION_CRITERIA,
  RESEARCH_OUTPUT_KINDS,
  RESEARCH_THEMES,
  OPEN_CONSTITUTIONAL_QUESTIONS,
  CONSTITUTIONAL_DISTINCTIONS,
} from '@/types/research';

describe('IRL Research Roadmap Expansion', () => {
  it('adds the Reasoning Systems programme (D), exploratory, no experiments yet', () => {
    const d = RESEARCH_PROGRAMMES.find(p => p.id === 'D');
    expect(d?.name).toBe('Reasoning Systems');
    expect(d?.exploratory).toBe(true);
    expect(d?.experiments).toEqual([]);
  });

  it('keeps the founding programmes intact and non-exploratory', () => {
    for (const id of ['A', 'B', 'C']) {
      const p = RESEARCH_PROGRAMMES.find(x => x.id === id);
      expect(p).toBeTruthy();
      expect(p?.exploratory).toBe(false);
    }
  });

  it('pins the applied-research chain in order', () => {
    expect(APPLIED_RESEARCH_CHAIN).toEqual([
      'Discovery', 'Compression', 'Implementation', 'Validation', 'Standing', 'Canonical Knowledge',
    ]);
  });

  it('carries all three roadmap prioritization criteria and the output kinds', () => {
    expect(ROADMAP_PRIORITIZATION_CRITERIA).toHaveLength(3);
    expect(RESEARCH_OUTPUT_KINDS).toContain('validated invariants');
    expect(RESEARCH_OUTPUT_KINDS).toContain('implementation guidance');
  });

  it('has the four Reasoning Systems themes, all exploratory, with the representational-artifacts hypothesis', () => {
    expect(RESEARCH_THEMES).toHaveLength(4);
    expect(RESEARCH_THEMES.every(t => t.exploratory)).toBe(true);
    const ra = RESEARCH_THEMES.find(t => t.id === 'representational-artifacts');
    expect(ra?.hypothesis).toMatch(/refine or falsify|shared representational artifacts/i);
  });

  it('keeps the open constitutional questions as explicit questions (each ends with ?)', () => {
    expect(OPEN_CONSTITUTIONAL_QUESTIONS.length).toBeGreaterThanOrEqual(9);
    expect(OPEN_CONSTITUTIONAL_QUESTIONS.every(q => q.trim().endsWith('?'))).toBe(true);
  });

  it('records the method-of-distinctions pairs (guidance, not a law)', () => {
    expect(CONSTITUTIONAL_DISTINCTIONS).toContain('Standing ≠ Truth');
    expect(CONSTITUTIONAL_DISTINCTIONS).toContain('Human reasoning ≠ Machine reasoning');
    expect(CONSTITUTIONAL_DISTINCTIONS.every(d => d.includes('≠'))).toBe(true);
  });
});
