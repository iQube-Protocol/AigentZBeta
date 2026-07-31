/**
 * Constitutional Composition engine — canary suite (CFS-022b, gap G3).
 *
 * Pins the compose-not-generate discipline without a DB or DOM:
 *   - compose-not-generate is enforced STRUCTURALLY (a retrieved field carrying
 *     a raw literal with no asset ref FAILS validation);
 *   - the provenance decomposition round-trips (composedFrom names the real
 *     assets: Bearing v1 + palette + typography);
 *   - validation is fail-closed;
 *   - mode defaults to 'propose' (no receipt written — receiptId null);
 *   - T0 identifiers are structurally inexpressible in the result.
 *
 * Pure-logic — drills in node. Mirrors tests/constitutional-object.test.ts +
 * tests/representation-system.test.ts canary posture.
 */

import { describe, it, expect } from 'vitest';

import { findForbiddenObjectKey } from '@/types/constitutionalObject';
import { getInterpretation } from '@/services/representation/interpretations';
import type { CompositionRequest } from '@/types/composition';
import { InSituAssetResolver } from '@/services/composition/assetResolver';
import { composeAtlasPlate } from '@/services/composition/composeArtifact';
import { validateComposition, isRawLiteral } from '@/services/composition/validateComposition';

const CCF_ID = 'constitutional-civic-futurism';

function plateRequest(overrides: Partial<CompositionRequest> = {}): CompositionRequest {
  return {
    target: 'atlas-plate',
    assets: [
      { kind: 'interpretation', ref: CCF_ID, minStanding: 'validated' },
      { kind: 'bearing-instrument', ref: 'bearing-instrument@1', minStanding: 'canonical' },
    ],
    grounding: {
      domains: ['representation', 'constitutional'],
      invariantRefs: ['inv.experience.072', 'inv.representation.128'],
    },
    delta: {
      activeSector: 'reasoning',
      standing: 'canonical',
      relatedSectors: ['order', 'action'],
      title: 'Plate I · The Constitutional Trinity',
      caption: 'Order, Reasoning, and Action as the primary octants of the field.',
      readouts: { gs: '—', alt: '—' },
    },
    interpretationId: CCF_ID,
    ...overrides,
  };
}

async function compose(request: CompositionRequest) {
  const resolver = new InSituAssetResolver();
  const resolved = await resolver.resolve(request.assets);
  return composeAtlasPlate({
    request,
    interpretation: getInterpretation(request.interpretationId ?? CCF_ID),
    resolved,
    grounded: { invariantIds: [], closureRootIds: [] },
    canonVersion: 'canon:test',
  });
}

describe('composeAtlasPlate — the first vertical', () => {
  it('returns a self-contained SVG artefact + BearingInstrument props', async () => {
    const result = await compose(plateRequest());
    expect(result.ok).toBe(true);
    expect(result.artefact).not.toBeNull();
    expect(typeof result.artefact!.svg).toBe('string');
    expect(result.artefact!.svg.startsWith('<svg')).toBe(true);
    expect(result.artefact!.svg).toContain('</svg>');
    expect(result.artefact!.bearingProps.variant).toBe('atlas');
    expect(result.artefact!.bearingProps.activeSector).toBe('reasoning');
    expect(result.artefact!.interpretationId).toBe(CCF_ID);
  });

  it('provenance decomposition round-trips — composedFrom names the real assets', async () => {
    const result = await compose(plateRequest());
    const ids = result.provenance.composedFrom.map((r) => r.id);
    expect(ids).toContain('bearing-instrument'); // Bearing Instrument v1
    expect(ids).toContain(`palette:${CCF_ID}`); // CCF palette view
    expect(ids).toContain(`typography:${CCF_ID}`); // CCF typography view

    // retrieved ∪ grounded ∪ generated covers the artefact bindings.
    const classes = new Set(result.artefact!.bindings.map((b) => b.class));
    expect(classes.has('retrieved')).toBe(true);
    expect(classes.has('generated')).toBe(true);
    expect(result.provenance.generated.delta.title).toBe('Plate I · The Constitutional Trinity');
  });

  it('every retrieved colour/type binding carries an asset sourceRef (no literals leak)', async () => {
    const result = await compose(plateRequest());
    const retrieved = result.artefact!.bindings.filter((b) => b.class === 'retrieved');
    expect(retrieved.length).toBeGreaterThan(0);
    for (const b of retrieved) {
      expect(b.sourceRef, `retrieved binding ${b.key} must name an asset`).toBeTruthy();
    }
  });

  it('reskins coherently under a different interpretation (same request, role-driven)', async () => {
    const ccf = await compose(plateRequest());
    const glass = await compose(plateRequest({ interpretationId: 'agentiq-liquid-glass' }));
    expect(glass.ok).toBe(true);
    expect(glass.artefact!.interpretationId).toBe('agentiq-liquid-glass');
    // Same structure, different resolved values → different content hash.
    expect(glass.provenance.contentHash).not.toBe(ccf.provenance.contentHash);
  });
});

describe('compose-not-generate — enforced structurally', () => {
  it('isRawLiteral flags hex / font / geometry literals', () => {
    expect(isRawLiteral('#B08D3E')).toBe(true);
    expect(isRawLiteral("Georgia, 'Times New Roman', serif")).toBe(true);
    expect(isRawLiteral('440')).toBe(true);
    expect(isRawLiteral('12px')).toBe(true);
    expect(isRawLiteral('Plate I · The Constitutional Trinity')).toBe(false);
  });

  it('a RETRIEVED field carrying a raw literal (no asset ref) FAILS validation', async () => {
    const result = await compose(plateRequest());
    // Inject the violation: a retrieved field with a raw hex literal and NO sourceRef.
    const tampered = {
      ...result.artefact!,
      bindings: [
        ...result.artefact!.bindings,
        { class: 'retrieved' as const, key: 'field.reasoning', value: '#3B3A66' },
      ],
    };
    const v = validateComposition({
      artefact: tampered,
      retrieved: result.provenance.retrieved,
      grounded: { invariantIds: [], closureRootIds: [] },
      delta: plateRequest().delta,
    });
    expect(v.pass).toBe(false);
    expect(v.violations.some((x) => x.law === 'law.compose.no-literal')).toBe(true);
  });
});

describe('validation is fail-closed', () => {
  it('a delta outside the canon taxonomy blocks the composition', async () => {
    const bad = plateRequest();
    // A sector that is not a canonical field sector.
    (bad.delta as { activeSector: string }).activeSector = 'bogus-sector';
    const result = await compose(bad);
    expect(result.ok).toBe(false);
    expect(result.validation.pass).toBe(false);
    expect(
      result.validation.composition.violations.some((v) => v.law === 'law.compose.delta-in-taxonomy'),
    ).toBe(true);
  });
});

describe('observe-mode — propose is the default, no receipt is written', () => {
  it('receiptId is null when mode is unset (propose)', async () => {
    const req = plateRequest();
    expect(req.mode).toBeUndefined(); // default = propose
    const result = await compose(req);
    expect(result.provenance.receiptId).toBeNull();
  });

  it('receiptId stays null even when mode is explicitly publish (gated seam, this slice)', async () => {
    const result = await compose(plateRequest({ mode: 'publish' }));
    // The publish path is a route-layer seam; the engine never writes a receipt.
    expect(result.provenance.receiptId).toBeNull();
  });
});

describe('T0 inexpressibility — no forbidden identifier in any output', () => {
  it('the whole CompositionResult is free of T0 keys', async () => {
    const result = await compose(plateRequest());
    expect(findForbiddenObjectKey(result)).toBeNull();
  });

  it('a planted personaId would be caught (canary sanity)', async () => {
    const result = await compose(plateRequest());
    const leaked = { ...result, provenance: { ...result.provenance, personaId: 'p_123' } };
    expect(findForbiddenObjectKey(leaked)).toBe('provenance.personaId');
  });
});
