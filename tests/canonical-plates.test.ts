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
import { canonicalPlateAssets, listCanonicalAssets } from '@/services/composition/canonicalAssets';
import { findForbiddenObjectKey } from '@/types/constitutionalObject';
import {
  PUBLICATION_REGISTER,
  nextPublicationNumber,
  publicationByNumber,
  seriesByCode,
} from '@/services/artifact/publicationRegistry';
import { PROFILE_RENDERER, profileRendererFor } from '@/services/artifact/constitutionalPublishingSystem';

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

describe('CP — plates as canonical assets (ecosystem assets, not per-document art)', () => {
  it('all seven plates register as RATIFIED canonical assets (CFS-027, 2026-07-12)', () => {
    const assets = canonicalPlateAssets();
    expect(assets).toHaveLength(7);
    for (const a of assets) {
      expect(a.identity.kind).toBe('canonical_asset');
      // Ratified — canonical band, canonized state (same as the other ratified assets).
      expect(a.standing.band).toBe('canonical');
      expect(a.lifecycle.state).toBe('canonized');
      expect(a.authority.ratificationRequired).toBe(true);
      expect(findForbiddenObjectKey(a)).toBeNull(); // no T0 leak
    }
    expect(assets[1].identity.displayLabel).toContain('CP-002');
  });

  it('the plates appear in the Canonical Asset Registry projection', () => {
    const ids = listCanonicalAssets().map((a) => a.identity.id);
    expect(ids).toContain('plate:cp-001');
    expect(ids).toContain('plate:cp-007');
  });
});

describe('Publication registry — series + canonical numbering', () => {
  it('IRL-0001 is reserved, composing all seven plates', () => {
    const p = publicationByNumber('IRL-0001');
    expect(p?.state).toBe('reserved');
    expect(p?.plates).toHaveLength(7);
    expect(seriesByCode('IRL')?.imprint).toContain('Invariant Research Lab');
  });

  it('numbering is monotonic within a series and fresh for an unused series', () => {
    expect(PUBLICATION_REGISTER.length).toBeGreaterThanOrEqual(1);
    expect(nextPublicationNumber('IRL')).toBe('IRL-0002');
    expect(nextPublicationNumber('CCS')).toBe('CCS-0001');
  });
});

describe('CPS — profile → renderer wiring (composition over the AR contract)', () => {
  it('document profiles render through the CPS family; software/multimedia do not', () => {
    expect(profileRendererFor('documentation')).toBe('constitutional-publishing-system');
    expect(profileRendererFor('research')).toBe('research-report');
    expect(profileRendererFor('standard')).toBe('standards-document');
    expect(profileRendererFor('software')).toBeNull();
    expect(profileRendererFor('multimedia')).toBeNull();
    // every AR profile has an explicit entry (no silent default)
    expect(Object.keys(PROFILE_RENDERER)).toHaveLength(12);
  });
});
