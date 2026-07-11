/**
 * Constitutional Design System (CDS) — data canary.
 * Pins the order-constant design invariants + the document-profile predicate +
 * the production-guidance builder that the Publishing Factory applies.
 */

import { describe, it, expect } from 'vitest';
import {
  CDS_VERSION,
  CDS_DESIGN_PRINCIPLES,
  CDS_EDITORIAL_HIERARCHY,
  CDS_DOCUMENT_ARC,
  CDS_PRODUCTION_RULES,
  isDocumentProfile,
  buildCdsProductionGuidance,
} from '@/services/artifact/constitutionalDesignSystem';

describe('CDS — design invariants (order is meaning)', () => {
  it('pins the three design principles', () => {
    expect([...CDS_DESIGN_PRINCIPLES]).toEqual(['seriousness', 'constitutional-humanity', 'timelessness']);
  });

  it('pins the editorial hierarchy cover→appendices', () => {
    expect([...CDS_EDITORIAL_HIERARCHY]).toEqual([
      'cover',
      'executive-summary',
      'concept',
      'architecture',
      'implementation',
      'governance',
      'future-work',
      'appendices',
    ]);
  });

  it('reasons problem-first, never implementation-first', () => {
    expect([...CDS_DOCUMENT_ARC]).toEqual(['problem', 'opportunity', 'constitutional-principle', 'architecture', 'implementation']);
    expect(CDS_DOCUMENT_ARC.indexOf('implementation')).toBe(CDS_DOCUMENT_ARC.length - 1);
  });

  it('production rules include editable-first / PDF-derived and SVG diagrams', () => {
    const joined = CDS_PRODUCTION_RULES.join(' ');
    expect(joined).toContain('editable format first');
    expect(joined).toContain('PDF is ALWAYS derived');
    expect(joined).toContain('SVG');
    expect(CDS_VERSION).toBe('0.1');
  });
});

describe('CDS — the factory boundary (which profiles are CDS publications)', () => {
  it('document-class profiles are governed; software/multimedia are not', () => {
    expect(isDocumentProfile('standard')).toBe(true);
    expect(isDocumentProfile('white-paper')).toBe(true);
    expect(isDocumentProfile('policy')).toBe(true);
    expect(isDocumentProfile('software')).toBe(false);
    expect(isDocumentProfile('multimedia')).toBe(false);
  });

  it('the production guidance carries the editorial arc + production rules', () => {
    const g = buildCdsProductionGuidance();
    expect(g).toContain('Constitutional Design System');
    expect(g).toContain('never implementation-first');
    expect(g).toContain('PDF is ALWAYS derived');
  });
});
