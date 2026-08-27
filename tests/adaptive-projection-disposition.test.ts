/**
 * services/adaptive/projectionValidator.ts checks 6-7 — the three-permission
 * disposition enforcement (operator ruling, 2026-08-27, correcting the
 * earlier "NATIVE_ONLY = never offerable" conflation).
 *
 * Covers:
 *   - NATIVE_ONLY (externalRenderAllowed:false) can never appear as a
 *     directly rendered surface from an EXTERNAL provider's output
 *   - the same for externalExecuteAllowed on primary/secondary actions
 *   - a NATIVE_ONLY capability MAY be offered via `handoffOffered: true`
 *     ONLY when its own disposition permits `nativeHandoffAllowed`
 *   - the native provider's own output is exempt (it crosses no external
 *     boundary) — the deterministic fallback must never be rejected by
 *     these checks
 *   - an unregistered capability fails closed (NOTHING_ALLOWED), never
 *     permissive
 */

import { describe, it, expect } from 'vitest';
import { validateProjection } from '@/services/adaptive/projectionValidator';
import type {
  AdaptiveInteractionContext,
  CapabilityProjectionRef,
  ExperienceProjection,
} from '@/types/adaptiveExperience';

function baseContext(capabilityRefs: CapabilityProjectionRef[]): AdaptiveInteractionContext {
  return {
    contextId: 'ctx-test-1',
    participantRef: 'participant-ref-1',
    capabilityRefs,
    host: { hostId: 'differ', surfaceTypesSupported: ['component', 'route', 'embed'] },
    disclosurePolicy: { fieldClassification: {}, enforced: true },
    constitutionalConstraints: [],
    generatedAt: new Date().toISOString(),
  };
}

function baseProjection(over: Partial<ExperienceProjection> = {}, provider = 'differ-test'): ExperienceProjection {
  return {
    projectionId: 'proj-1',
    contextId: 'ctx-test-1',
    provider,
    layout: { mode: 'linear', density: 'normal' },
    surfaces: [],
    constraintsApplied: [],
    level: 1,
    ...over,
  };
}

const NATIVE_ONLY_NO_HANDOFF: CapabilityProjectionRef = {
  capabilityId: 'passport-issue',
  label: 'Passport issuance',
  surfaceTypes: ['component'],
  hostRefs: { native: 'venture-participate-apply' },
  disposition: { externalRenderAllowed: false, externalExecuteAllowed: false, nativeHandoffAllowed: false },
};

const NATIVE_ONLY_HANDOFF_ALLOWED: CapabilityProjectionRef = {
  capabilityId: 'moneypenny.runtime',
  label: 'MoneyPenny Runtime',
  surfaceTypes: ['cartridge-tab'],
  hostRefs: {},
  disposition: { externalRenderAllowed: false, externalExecuteAllowed: false, nativeHandoffAllowed: true },
};

const EXTERNAL_RENDER_OK: CapabilityProjectionRef = {
  capabilityId: 'moneypenny.advisor',
  label: 'MoneyPenny Advisor',
  surfaceTypes: ['cartridge-tab'],
  hostRefs: {},
  disposition: { externalRenderAllowed: true, externalExecuteAllowed: false, nativeHandoffAllowed: true },
};

describe('projectionValidator checks 6-7 — disposition enforcement (external provider output)', () => {
  it('rejects a NATIVE_ONLY capability rendered directly (no handoffOffered) by an external provider', () => {
    const context = baseContext([NATIVE_ONLY_NO_HANDOFF]);
    const projection = baseProjection({
      surfaces: [{ capabilityId: NATIVE_ONLY_NO_HANDOFF.capabilityId, surfaceType: 'component', emphasis: 'primary' }],
    });
    const result = validateProjection(projection, context);
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.includes('externalRenderAllowed: false'))).toBe(true);
  });

  it('rejects offering a NATIVE_ONLY-render capability as handoffOffered when its OWN disposition forbids nativeHandoffAllowed', () => {
    const context = baseContext([NATIVE_ONLY_NO_HANDOFF]);
    const projection = baseProjection({
      surfaces: [{ capabilityId: NATIVE_ONLY_NO_HANDOFF.capabilityId, surfaceType: 'component', emphasis: 'primary', handoffOffered: true }],
    });
    const result = validateProjection(projection, context);
    expect(result.valid).toBe(false);
  });

  it('ACCEPTS a NATIVE_ONLY capability offered as handoffOffered:true when nativeHandoffAllowed is true — this is the mechanism working as designed', () => {
    const context = baseContext([NATIVE_ONLY_HANDOFF_ALLOWED]);
    const projection = baseProjection({
      surfaces: [{ capabilityId: NATIVE_ONLY_HANDOFF_ALLOWED.capabilityId, surfaceType: 'cartridge-tab', emphasis: 'primary', handoffOffered: true }],
    });
    const result = validateProjection(projection, context);
    expect(result.valid).toBe(true);
  });

  it('rejects the SAME NATIVE_ONLY-handoff-allowed capability if presented WITHOUT handoffOffered:true — allowed does not mean unconditionally offerable', () => {
    const context = baseContext([NATIVE_ONLY_HANDOFF_ALLOWED]);
    const projection = baseProjection({
      surfaces: [{ capabilityId: NATIVE_ONLY_HANDOFF_ALLOWED.capabilityId, surfaceType: 'cartridge-tab', emphasis: 'primary' }],
    });
    const result = validateProjection(projection, context);
    expect(result.valid).toBe(false);
  });

  it('accepts a directly-rendered externalRenderAllowed:true capability with no handoff involved', () => {
    const context = baseContext([EXTERNAL_RENDER_OK]);
    const projection = baseProjection({
      surfaces: [{ capabilityId: EXTERNAL_RENDER_OK.capabilityId, surfaceType: 'cartridge-tab', emphasis: 'primary' }],
    });
    expect(validateProjection(projection, context).valid).toBe(true);
  });

  it('applies the SAME rule to primaryAction/secondaryActions via externalExecuteAllowed', () => {
    const context = baseContext([NATIVE_ONLY_NO_HANDOFF]);
    const projection = baseProjection({
      primaryAction: { capabilityId: NATIVE_ONLY_NO_HANDOFF.capabilityId, label: 'x' },
    });
    const result = validateProjection(projection, context);
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.includes('primaryAction'))).toBe(true);
  });

  it('an unregistered capabilityId fails CLOSED (NOTHING_ALLOWED) — never silently permissive', () => {
    const context = baseContext([]); // no capabilities declared at all
    const projection = baseProjection({
      surfaces: [{ capabilityId: 'never-declared', surfaceType: 'component', emphasis: 'primary' }],
    });
    const result = validateProjection(projection, context);
    expect(result.valid).toBe(false);
  });
});

describe('projectionValidator checks 6-7 — the native provider is EXEMPT (crosses no external boundary)', () => {
  it('a provider:"native" projection selecting a NATIVE_ONLY capability is NEVER rejected by checks 6-7 — the deterministic fallback must always succeed', () => {
    const context = baseContext([NATIVE_ONLY_NO_HANDOFF]);
    const projection = baseProjection(
      { surfaces: [{ capabilityId: NATIVE_ONLY_NO_HANDOFF.capabilityId, surfaceType: 'component', emphasis: 'primary' }] },
      'native',
    );
    const result = validateProjection(projection, context);
    expect(result.valid).toBe(true);
  });
});
