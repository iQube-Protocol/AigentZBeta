/**
 * requireCartridgeAdmin — canary suite
 *
 * Locks the per-cartridge gate's semantics so future refactors of the
 * helper, or of evaluateAccess / cartridgeFlags, can't silently break
 * endpoint authorization for admin-tier surfaces.
 *
 * Pure unit tests on isCartridgeAdmin (the predicate the async route
 * guard delegates to). The async wrapper's HTTP semantics are tested
 * in route-level integration suites that mount real requests.
 */
import { describe, it, expect } from 'vitest';

import { isCartridgeAdmin } from '@/services/access/requireCartridgeAdmin';
import type { ActivePersonaContext } from '@/types/access';

const makeContext = (over?: Partial<ActivePersonaContext>): ActivePersonaContext => ({
  personaId: 'persona-uuid',
  authProfileId: 'auth-profile-uuid',
  identifiability: 'semi_anonymous',
  cartridgeFlags: { isAdmin: false, isPartner: false, adminCartridges: [] },
  cohortMemberships: [],
  source: 'session-cookie',
  ...over,
});

describe('isCartridgeAdmin', () => {
  it('global isAdmin satisfies any cartridge slug (uber/platform override)', () => {
    const ctx = makeContext({
      cartridgeFlags: { isAdmin: true, isPartner: false, adminCartridges: [] },
    });
    expect(isCartridgeAdmin(ctx, 'knyt-codex')).toBe(true);
    expect(isCartridgeAdmin(ctx, 'qripto')).toBe(true);
    expect(isCartridgeAdmin(ctx, 'never-heard-of-it')).toBe(true);
  });

  it('explicit per-cartridge grant matches the named slug only', () => {
    const ctx = makeContext({
      cartridgeFlags: {
        isAdmin: false,
        isPartner: false,
        adminCartridges: ['knyt-codex'],
      },
    });
    expect(isCartridgeAdmin(ctx, 'knyt-codex')).toBe(true);
    // Sibling cartridge — not granted, deny.
    expect(isCartridgeAdmin(ctx, 'qripto')).toBe(false);
    expect(isCartridgeAdmin(ctx, 'marketa')).toBe(false);
  });

  it('non-admin persona is denied for every cartridge', () => {
    const ctx = makeContext();
    expect(isCartridgeAdmin(ctx, 'knyt-codex')).toBe(false);
    expect(isCartridgeAdmin(ctx, 'qripto')).toBe(false);
    expect(isCartridgeAdmin(ctx, 'marketa')).toBe(false);
  });

  it('partner flag does NOT satisfy a cartridge admin gate', () => {
    const ctx = makeContext({
      cartridgeFlags: { isAdmin: false, isPartner: true, adminCartridges: [] },
    });
    expect(isCartridgeAdmin(ctx, 'knyt-codex')).toBe(false);
  });

  it('empty cartridge slug is always denied — fail-closed', () => {
    const ctx = makeContext({
      cartridgeFlags: { isAdmin: true, isPartner: false, adminCartridges: [] },
    });
    // Even global isAdmin doesn't satisfy an empty slug — guards
    // against accidental calls like requireCartridgeAdmin(req, '').
    expect(isCartridgeAdmin(ctx, '')).toBe(false);
  });
});
