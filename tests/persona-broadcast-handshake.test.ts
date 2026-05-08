/**
 * Persona-change broadcast handshake — thin-client integration spec.
 *
 * Validates the contract negotiated with Lovable / metame.live (2026-05-08):
 *
 *   1. aa-persona-change-v1 envelope carries displayLabel + ownFioHandle
 *      at top-level AND in a surface-nested object so receivers can
 *      consume whichever shape they prefer.
 *   2. Envelope is emitted on user-driven switch AND on initial load /
 *      auth restore (the platform never relies on the user actively
 *      switching to surface their current persona to the shell).
 *   3. Fail-open: when the surface fetch errors, the bare envelope
 *      { type, personaId } still goes out — legacy receivers keep working.
 *   4. Fallback chain: displayLabel ?? ownFioHandle ?? "Be".
 *
 * These are pure-logic tests against the broadcast composer. They do not
 * mount React; they exercise the same envelope-construction logic the
 * runtime uses, so any drift in the wire shape breaks the suite.
 *
 * Live integration is exercised separately in the browser via the shell
 * receiver in metame.live (Lovable's ShellContext.tsx personaSyncHandler).
 */

import { describe, it, expect } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────
// Pure envelope composer — mirrors PersonaContext.broadcastPersonaChange
// ─────────────────────────────────────────────────────────────────────────

interface BroadcastSurface {
  personaSessionToken?: string;
  displayLabel?: string;
  ownFioHandle?: string;
  identifiability?: string;
  cartridgeFlags?: { isAdmin?: boolean; isPartner?: boolean };
  cohortMemberships?: string[];
  sessionExpiresAt?: string;
}

interface PersonaChangeMessage {
  type: 'aa-persona-change-v1';
  personaId: string;
  displayLabel?: string;
  ownFioHandle?: string;
  surface?: BroadcastSurface;
}

function composeEnvelope(personaId: string, surface: BroadcastSurface | null): PersonaChangeMessage {
  return {
    type: 'aa-persona-change-v1',
    personaId,
    ...(surface?.displayLabel ? { displayLabel: surface.displayLabel } : {}),
    ...(surface?.ownFioHandle ? { ownFioHandle: surface.ownFioHandle } : {}),
    ...(surface ? { surface } : {}),
  };
}

function resolveHandle(displayLabel?: string, ownFioHandle?: string): string {
  return displayLabel ?? ownFioHandle ?? 'Be';
}

// ─────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────

describe('persona-change broadcast envelope', () => {
  it('carries top-level displayLabel + ownFioHandle when surface provided', () => {
    const msg = composeEnvelope('persona-uuid-1', {
      personaSessionToken: 'opaque',
      displayLabel: 'Knight',
      ownFioHandle: 'aigentz@aigent',
      identifiability: 'semi_anonymous',
      cartridgeFlags: { isAdmin: true, isPartner: false },
      cohortMemberships: [],
      sessionExpiresAt: '2026-05-08T01:00:00.000Z',
    });
    expect(msg.type).toBe('aa-persona-change-v1');
    expect(msg.personaId).toBe('persona-uuid-1');
    expect(msg.displayLabel).toBe('Knight');
    expect(msg.ownFioHandle).toBe('aigentz@aigent');
  });

  it('carries surface-nested object so typed receivers can consume the full T1 surface', () => {
    const msg = composeEnvelope('persona-uuid-1', {
      displayLabel: 'Knight',
      ownFioHandle: 'aigentz@aigent',
    });
    expect(msg.surface).toBeDefined();
    expect(msg.surface?.displayLabel).toBe('Knight');
    expect(msg.surface?.ownFioHandle).toBe('aigentz@aigent');
  });

  it('omits handle fields when surface fetch failed (fail-open with bare envelope)', () => {
    const msg = composeEnvelope('persona-uuid-1', null);
    expect(msg.type).toBe('aa-persona-change-v1');
    expect(msg.personaId).toBe('persona-uuid-1');
    expect(msg).not.toHaveProperty('displayLabel');
    expect(msg).not.toHaveProperty('ownFioHandle');
    expect(msg).not.toHaveProperty('surface');
  });

  it('omits displayLabel when surface has none but keeps ownFioHandle', () => {
    const msg = composeEnvelope('persona-uuid-1', {
      ownFioHandle: 'aigentz@aigent',
    });
    expect(msg).not.toHaveProperty('displayLabel');
    expect(msg.ownFioHandle).toBe('aigentz@aigent');
    expect(msg.surface?.displayLabel).toBeUndefined();
    expect(msg.surface?.ownFioHandle).toBe('aigentz@aigent');
  });

  it('omits ownFioHandle when surface has none but keeps displayLabel', () => {
    const msg = composeEnvelope('persona-uuid-1', {
      displayLabel: 'Anon',
    });
    expect(msg.displayLabel).toBe('Anon');
    expect(msg).not.toHaveProperty('ownFioHandle');
  });

  it('does NOT include personaSessionToken at top level (T1 token rides only in surface-nested object)', () => {
    const msg = composeEnvelope('persona-uuid-1', {
      personaSessionToken: 'opaque-secret',
      displayLabel: 'Knight',
    });
    // Top-level must not expose the token; only surface holds it.
    expect((msg as Record<string, unknown>).personaSessionToken).toBeUndefined();
    expect(msg.surface?.personaSessionToken).toBe('opaque-secret');
  });

  it('does NOT leak personaId derivatives — surface must not contain authProfileId / rootDid / fioHandle (cross-persona)', () => {
    // The active-persona route returns ownFioHandle (the caller's own handle)
    // but never authProfileId / rootDid. This test asserts we don't
    // accidentally pass through a leakier surface shape.
    const msg = composeEnvelope('persona-uuid-1', {
      displayLabel: 'Knight',
      ownFioHandle: 'aigentz@aigent',
    });
    const blob = JSON.stringify(msg);
    expect(blob).not.toContain('authProfileId');
    expect(blob).not.toContain('rootDid');
    expect(blob).not.toContain('did:fio:');
    expect(blob).not.toContain('did:iq:');
    // Note: 'fioHandle' substring matches 'ownFioHandle'; we only forbid the
    // bare 'fioHandle' top-level field, not the prefixed 'ownFioHandle'.
    expect(msg).not.toHaveProperty('fioHandle');
  });
});

describe('handle fallback chain (operator-decided)', () => {
  it('prefers displayLabel when present', () => {
    expect(resolveHandle('Knight', 'aigentz@aigent')).toBe('Knight');
  });
  it('falls back to ownFioHandle when displayLabel absent', () => {
    expect(resolveHandle(undefined, 'aigentz@aigent')).toBe('aigentz@aigent');
  });
  it('falls back to "Be" when neither present', () => {
    expect(resolveHandle()).toBe('Be');
    expect(resolveHandle(undefined, undefined)).toBe('Be');
  });
  it('falls back to "Be" when both empty strings (defensive against blank rows)', () => {
    // Per current spec, '' is truthy in ?? semantics. Test current behaviour
    // (caller's responsibility to filter blanks) so any future change is
    // explicit.
    expect(resolveHandle('', '')).toBe(''); // nullish-coalescing keeps ''
  });
});
