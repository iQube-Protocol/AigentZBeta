/**
 * Canonical Plates (CP) — the visual ontology canary (CFS-027).
 * Pins the SEVEN plates, their CP numbering, the signature set, and the
 * composition model (publications are compositions of plates, not new diagrams).
 */

import { describe, it, expect } from 'vitest';
import {
  CANONICAL_PLATES_V1,
  CANONICAL_PLATE_COUNT,
  PLATE_COMPOSITIONS,
  plateByNumber,
  signaturePlates,
  platesForPublication,
  buildPlateManifest,
} from '@/services/artifact/canonicalPlates';

describe('CP — seven canonical plates (Euclid, not a sprawl)', () => {
  it('is exactly seven plates, numbered CP-001..CP-007 in order', () => {
    expect(CANONICAL_PLATE_COUNT).toBe(7);
    expect(CANONICAL_PLATES_V1.map((p) => p.number)).toEqual([
      'CP-001',
      'CP-002',
      'CP-003',
      'CP-004',
      'CP-005',
      'CP-006',
      'CP-007',
    ]);
    expect(CANONICAL_PLATES_V1.map((p) => p.roman)).toEqual(['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']);
  });

  it('CP-002 is the periodic table — two invariant families synthesising to hybrid', () => {
    const p = plateByNumber('CP-002');
    expect(p?.title).toContain('First Principles');
    expect(p?.structure.structuralInvariants).toContain('Compression');
    expect(p?.structure.constitutionalInvariants).toContain('Standing');
    expect(p?.structure.synthesis).toBe('Hybrid Intelligence');
    expect(p?.signature).toBe(true);
  });

  it('CP-003 puts Human Agency at the centre with constitutional mechanisms around it', () => {
    const p = plateByNumber('CP-003');
    expect(p?.structure.centre).toBe('Human Agency');
    expect(p?.structure.mechanisms).toContain('Knowledge');
    expect(p?.structure.mechanisms).toContain('Delegation');
  });

  it('plateByNumber returns undefined for an unknown plate', () => {
    expect(plateByNumber('CP-099')).toBeUndefined();
  });
});

describe('CP — compositions (no new diagrams, only new compositions)', () => {
  it('IRL-001 composes all seven plates', () => {
    expect(PLATE_COMPOSITIONS['IRL-001']).toHaveLength(7);
    expect(platesForPublication('IRL-001').map((p) => p.number)).toEqual([
      'CP-001',
      'CP-002',
      'CP-003',
      'CP-004',
      'CP-005',
      'CP-006',
      'CP-007',
    ]);
  });

  it('a memorandum composes a subset; an unmapped publication defaults to all', () => {
    expect(platesForPublication('investment-memorandum').map((p) => p.number)).toEqual(['CP-006', 'CP-007']);
    expect(platesForPublication('some-unmapped-doc')).toHaveLength(7);
  });

  it('the manifest cites plates by CP number for reference in prose', () => {
    const m = buildPlateManifest();
    expect(m).toContain('CP-001');
    expect(m).toContain('CP-007');
    expect(signaturePlates().length).toBeGreaterThanOrEqual(4);
  });
});
