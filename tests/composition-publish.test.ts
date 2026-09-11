/**
 * Studio → Artifact-Runtime publish seam — canary suite (CFS-025/026).
 *
 * Pins the PURE half of the /api/composition/publish route
 * (services/artifact/compositionPublish.ts) without a DB or network:
 *   - the route body coerces into the engine's REAL CompositionRequest (the
 *     interpretation + Bearing Instrument assets the composition canary uses);
 *   - untrusted delta input is coerced into the canon taxonomy;
 *   - the publish projection folds the receipt id in WITHOUT mutating the
 *     engine's result (composeArtifact stays propose-only);
 *   - T0 identifiers are structurally inexpressible — a planted personaId
 *     makes the projection THROW, and a built request is leak-free;
 *   - the receipt summary carries a content-hash prefix, never a subject id.
 *
 * Pure-logic — drills in node. Mirrors tests/composition.test.ts posture.
 */

import { describe, it, expect } from 'vitest';

import { findForbiddenObjectKey } from '@/types/constitutionalObject';
import type { CompositionResult } from '@/types/composition';
import { DEFAULT_INTERPRETATION_ID } from '@/services/representation/interpretations';
import {
  BEARING_INSTRUMENT_ASSET_REF,
  STUDIO_COMPOSITION_DELEGATE,
  STUDIO_COMPOSITION_PROFILE,
  buildStudioCompositionRequest,
  coerceAtlasDelta,
  compositionRecordBody,
  projectPublishedProvenance,
  publishSummaryFor,
} from '@/services/artifact/compositionPublish';

const GOAL = 'Plate for the Constitutional Trinity overview';

/** A minimal, honest CompositionResult fixture (shape-true to types/composition). */
function fixtureResult(): CompositionResult {
  return {
    ok: true,
    target: 'atlas-plate',
    artefact: {
      kind: 'atlas-plate',
      svg: '<svg></svg>',
      bearingProps: { variant: 'atlas' },
      interpretationId: DEFAULT_INTERPRETATION_ID,
      bindings: [],
    },
    validation: {
      interpretation: { valid: true, violations: [] },
      composition: { pass: true, violations: [], recommendations: [] },
      pass: true,
    },
    provenance: {
      contentHash: 'a'.repeat(64),
      publicRef: 'b'.repeat(16),
      receiptId: null,
      retrieved: [],
      grounded: { invariantIds: [], closureRootIds: [] },
      generated: {
        description: 'fixture',
        delta: { activeSector: 'reasoning', standing: 'validated', title: GOAL },
      },
      composedFrom: [],
      canonVersion: 'canon:test',
      composedAt: null,
    },
    recommendations: [],
  };
}

describe('buildStudioCompositionRequest — goal → the engine\'s real input', () => {
  it('mirrors the composition canary request shape (interpretation + bearing assets)', () => {
    const req = buildStudioCompositionRequest({
      goal: GOAL,
      mode: 'propose',
      actorCommitment: 'c'.repeat(16),
    });
    expect(req.target).toBe('atlas-plate');
    expect(req.assets).toEqual([
      { kind: 'interpretation', ref: DEFAULT_INTERPRETATION_ID, minStanding: 'validated' },
      { kind: 'bearing-instrument', ref: BEARING_INSTRUMENT_ASSET_REF, minStanding: 'canonical' },
    ]);
    expect(req.interpretationId).toBe(DEFAULT_INTERPRETATION_ID);
    expect(req.mode).toBe('propose');
    expect(req.actorCommitment).toBe('c'.repeat(16));
    expect(req.delta.title).toBe(GOAL);
    expect(req.grounding.domains).toEqual(['representation', 'constitutional']);
  });

  it('threads a named interpretation + publish mode through', () => {
    const req = buildStudioCompositionRequest({
      goal: GOAL,
      mode: 'publish',
      actorCommitment: 'c'.repeat(16),
      interpretationId: 'constitutional-civic-futurism',
    });
    expect(req.mode).toBe('publish');
    expect(req.interpretationId).toBe('constitutional-civic-futurism');
    expect(req.assets[0]).toEqual({
      kind: 'interpretation',
      ref: 'constitutional-civic-futurism',
      minStanding: 'validated',
    });
  });

  it('a built request is free of T0 keys (tier canary)', () => {
    const req = buildStudioCompositionRequest({ goal: GOAL, mode: 'publish', actorCommitment: 'c'.repeat(16) });
    expect(findForbiddenObjectKey(req)).toBeNull();
  });
});

describe('coerceAtlasDelta — untrusted input lands inside the canon taxonomy', () => {
  it('defaults: title from the goal, reasoning sector, validated standing', () => {
    const d = coerceAtlasDelta(GOAL);
    expect(d.title).toBe(GOAL);
    expect(d.activeSector).toBe('reasoning');
    expect(d.standing).toBe('validated');
    expect(d.relatedSectors).toBeUndefined();
  });

  it('honours legal overrides and filters illegal ones', () => {
    const d = coerceAtlasDelta(GOAL, {
      activeSector: 'order',
      standing: 'canonical',
      relatedSectors: ['action', 'bogus-sector', 'knowledge'],
      title: '  Plate II  ',
      caption: 'A caption',
      readouts: { gs: '12', alt: 7 },
    });
    expect(d.activeSector).toBe('order');
    expect(d.standing).toBe('canonical');
    expect(d.relatedSectors).toEqual(['action', 'knowledge']); // bogus filtered
    expect(d.title).toBe('Plate II');
    expect(d.caption).toBe('A caption');
    expect(d.readouts).toEqual({ gs: '12' }); // non-string alt dropped
  });

  it('an out-of-taxonomy sector/standing falls back to the defaults', () => {
    const d = coerceAtlasDelta(GOAL, { activeSector: 'bogus', standing: 'legendary' });
    expect(d.activeSector).toBe('reasoning');
    expect(d.standing).toBe('validated');
  });
});

describe('projectPublishedProvenance — the route-layer half of the PUBLISH SEAM', () => {
  it('folds the receipt id in WITHOUT mutating the engine result', () => {
    const result = fixtureResult();
    const projected = projectPublishedProvenance(result, 'receipt-123');
    expect(projected.provenance.receiptId).toBe('receipt-123');
    expect(result.provenance.receiptId).toBeNull(); // original untouched
    expect(projected.artefact).toBe(result.artefact); // identity carried through
    expect(projected.provenance.contentHash).toBe(result.provenance.contentHash);
  });

  it('THROWS on a planted T0 identifier — a leak never returns', () => {
    const result = fixtureResult();
    (result.provenance as unknown as Record<string, unknown>).personaId = 'p_123';
    expect(() => projectPublishedProvenance(result, 'receipt-123')).toThrow(/T0 identifier/);
  });
});

describe('record + receipt projections', () => {
  it('publishSummaryFor carries a 16-char content-hash prefix, no subject id', () => {
    const s = publishSummaryFor('f'.repeat(64));
    expect(s).toBe(`studio composition published — ${'f'.repeat(16)}`);
  });

  it('compositionRecordBody round-trips the composed decomposition', () => {
    const result = fixtureResult();
    const parsed = JSON.parse(compositionRecordBody(result));
    expect(parsed.target).toBe('atlas-plate');
    expect(parsed.artefact.interpretationId).toBe(DEFAULT_INTERPRETATION_ID);
    expect(parsed.provenance.publicRef).toBe('b'.repeat(16));
    expect(parsed.validation.pass).toBe(true);
    expect(findForbiddenObjectKey(parsed)).toBeNull();
  });

  it('the record constants are the seam\'s canonical names', () => {
    expect(STUDIO_COMPOSITION_PROFILE).toBe('studio-composition');
    expect(STUDIO_COMPOSITION_DELEGATE).toBe('operator');
  });
});
