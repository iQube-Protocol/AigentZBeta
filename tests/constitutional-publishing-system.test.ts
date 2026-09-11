/**
 * Constitutional Publishing System (CPS) — data canary.
 * Pins the order-constant publication invariants, the publisher imprint + four-
 * digit numbering, the renderer roster, the document-profile predicate, and the
 * production-guidance builder the Production Runtime applies.
 */

import { describe, it, expect } from 'vitest';
import {
  CPS_VERSION,
  CPS_PUBLISHER,
  CPS_DESIGN_PRINCIPLES,
  CPS_EDITORIAL_HIERARCHY,
  CPS_DOCUMENT_ARC,
  CPS_PRODUCTION_RULES,
  CPS_COVER,
  CPS_RENDERERS,
  CPS_TEMPLATES,
  cpsPaperNumber,
  isDocumentProfile,
  buildCpsProductionGuidance,
} from '@/services/artifact/constitutionalPublishingSystem';

describe('CPS — publication invariants (order is meaning)', () => {
  it('pins the three design principles', () => {
    expect([...CPS_DESIGN_PRINCIPLES]).toEqual(['seriousness', 'constitutional-humanity', 'timelessness']);
  });

  it('pins the editorial hierarchy cover→appendices and problem-first arc', () => {
    expect(CPS_EDITORIAL_HIERARCHY[0]).toBe('cover');
    expect(CPS_EDITORIAL_HIERARCHY.slice(-1)[0]).toBe('appendices');
    expect([...CPS_DOCUMENT_ARC]).toEqual(['problem', 'opportunity', 'constitutional-principle', 'architecture', 'implementation']);
  });

  it('the cover keeps the geometry but omits the human figure (operator refinement)', () => {
    expect(CPS_COVER.keep).toContain('golden-ratio');
    expect(CPS_COVER.keep).toContain('da-vinci-notebook-marks');
    expect(CPS_COVER.omit).toContain('vitruvian-man');
    expect(CPS_COVER.omit).toContain('human-figure');
  });

  it('production rules keep editable-first / PDF-derived / engineering-drawing diagrams', () => {
    const joined = CPS_PRODUCTION_RULES.join(' ');
    expect(joined).toContain('editable format first');
    expect(joined).toContain('PDF is ALWAYS derived');
    expect(joined).toContain('engineering drawings');
    expect(CPS_VERSION).toBe('0.1');
  });
});

describe('CPS — publisher imprint + four-digit numbering', () => {
  it('carries the metaMe / Invariant Research Lab / Foundational Research Series imprint', () => {
    expect(CPS_PUBLISHER.organisation).toBe('metaMe');
    expect(CPS_PUBLISHER.lab).toBe('Invariant Research Lab');
    expect(CPS_PUBLISHER.series).toBe('Foundational Research Series');
  });

  it('numbers publications four-digit (IRL-0001, not IRL-1)', () => {
    expect(cpsPaperNumber('IRL', 1)).toBe('IRL-0001');
    expect(cpsPaperNumber('CCS', 0)).toBe('CCS-0000');
    expect(cpsPaperNumber('IRL', 123)).toBe('IRL-0123');
  });
});

describe('CPS — the renderer model (one renderer inside the Production Runtime)', () => {
  it('CPS is the canonical/first renderer among the pluggable output layer', () => {
    expect(CPS_RENDERERS[0]).toBe('constitutional-publishing-system');
    expect(CPS_RENDERERS).toContain('executive-brief');
    expect(CPS_RENDERERS).toContain('investment-memorandum');
  });

  it('one language, many templates (the Human Civic Futurism layer model)', () => {
    expect(CPS_TEMPLATES).toContain('irl-papers');
    expect(CPS_TEMPLATES).toContain('polity-papers');
    expect(CPS_TEMPLATES).toContain('constitutional-standards');
  });
});

describe('CPS — the factory boundary + production guidance', () => {
  it('document-class profiles are CPS publications; software/multimedia are not', () => {
    expect(isDocumentProfile('standard')).toBe(true);
    expect(isDocumentProfile('policy')).toBe(true);
    expect(isDocumentProfile('software')).toBe(false);
  });

  it('the guidance carries the imprint, arc, and engineering-drawing diagrams', () => {
    const g = buildCpsProductionGuidance();
    expect(g).toContain('Constitutional Publishing System');
    expect(g).toContain('Invariant Research Lab');
    expect(g).toContain('never implementation-first');
    expect(g).toContain('ENGINEERING DRAWINGS');
  });
});
