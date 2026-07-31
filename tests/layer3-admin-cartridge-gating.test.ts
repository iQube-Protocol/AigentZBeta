/**
 * Layer 3 — ContentQube admin descriptors via evaluateAccess.
 *
 * Locks the protocol that admin-tier content can be expressed via
 * `gating.credential: 'admin-cartridge:<slug>'` and that evaluateAccess
 * routes the decision through the spine's cartridgeFlags.adminCartridges
 * field. Once a ContentAccessDescriptor carries this credential, the
 * same single decision function gates both UI tabs (via getEnabledTabs)
 * and content reads (via getContentDescriptor → evaluateAccess).
 *
 * Why this canary
 * ---------------
 * Without these assertions, a future refactor of either the descriptor
 * shape OR the policy resolver could quietly drop admin-cartridge
 * matching — admin-tier content would unexpectedly become accessible
 * to non-admin personas, or vice versa, with no compile-time signal.
 */
import { describe, it, expect } from 'vitest';

import { evaluateAccess } from '@/services/access/evaluateAccess';
import type {
  ActivePersonaContext,
  ContentAccessDescriptor,
  ContentState,
} from '@/types/access';

const makeContext = (over?: Partial<ActivePersonaContext>): ActivePersonaContext => ({
  personaId: 'persona-uuid-1',
  authProfileId: 'auth-profile-uuid-1',
  identifiability: 'semi_anonymous',
  cartridgeFlags: { isAdmin: false, isPartner: false, adminCartridges: [] },
  cohortMemberships: [],
  source: 'session-cookie',
  ...over,
});

const makeAdminCartridgeDescriptor = (
  cartridgeSlug: string,
  over?: Partial<ContentAccessDescriptor>,
): ContentAccessDescriptor => ({
  assetId: `admin-tier-${cartridgeSlug}-001`,
  contentClass: 'episode_print',
  state: 'C_gated_wip' as ContentState,
  gating: {
    kind: 'credential',
    credential: `admin-cartridge:${cartridgeSlug}`,
    source: 'category-default' as never,
  },
  receiptEligible: true,
  ...over,
});

describe('Layer 3 — admin-cartridge gating end-to-end through evaluateAccess', () => {
  it('per-cartridge admin of KNYT reads admin-cartridge:knyt-codex content → allow', async () => {
    const ctx = makeContext({
      cartridgeFlags: {
        isAdmin: false,
        isPartner: false,
        adminCartridges: ['knyt-codex'],
      },
    });
    const descriptor = makeAdminCartridgeDescriptor('knyt-codex');
    const decision = await evaluateAccess(ctx, descriptor, 'read');
    expect(decision.allow).toBe(true);
    expect(decision.reason).toBe('credential-met');
  });

  it('global uber-admin reads admin-cartridge:<any> content → allow (uber override)', async () => {
    const ctx = makeContext({
      cartridgeFlags: { isAdmin: true, isPartner: false, adminCartridges: [] },
    });
    const descriptor = makeAdminCartridgeDescriptor('marketa');
    const decision = await evaluateAccess(ctx, descriptor, 'read');
    expect(decision.allow).toBe(true);
    expect(decision.reason).toBe('credential-met');
  });

  it('persona without grant on the named cartridge → deny', async () => {
    const ctx = makeContext({
      cartridgeFlags: {
        isAdmin: false,
        isPartner: false,
        adminCartridges: ['knyt-codex'],
      },
    });
    // Persona admins KNYT but the content gates on Marketa.
    const descriptor = makeAdminCartridgeDescriptor('marketa');
    const decision = await evaluateAccess(ctx, descriptor, 'read');
    expect(decision.allow).toBe(false);
  });

  it('non-admin persona reading admin-cartridge:<any> content → deny', async () => {
    const ctx = makeContext();
    const descriptor = makeAdminCartridgeDescriptor('knyt-codex');
    const decision = await evaluateAccess(ctx, descriptor, 'read');
    expect(decision.allow).toBe(false);
  });

  it('partner credential is NOT satisfied by admin-cartridge grants', async () => {
    // Defense-in-depth: a persona who's a KNYT admin but not a partner
    // must still be denied 'partner'-gated content. Validates the
    // credential namespaces don't bleed.
    const ctx = makeContext({
      cartridgeFlags: {
        isAdmin: false,
        isPartner: false,
        adminCartridges: ['knyt-codex'],
      },
    });
    const descriptor: ContentAccessDescriptor = {
      assetId: 'partner-content-001',
      contentClass: 'episode_print',
      state: 'C_gated_wip',
      gating: {
        kind: 'credential',
        credential: 'partner',
        source: 'category-default' as never,
      },
      receiptEligible: true,
    };
    const decision = await evaluateAccess(ctx, descriptor, 'read');
    expect(decision.allow).toBe(false);
  });

  it('malformed admin-cartridge credential (empty slug) → deny', async () => {
    const ctx = makeContext({
      cartridgeFlags: {
        isAdmin: true,
        isPartner: false,
        adminCartridges: ['knyt-codex'],
      },
    });
    const descriptor = makeAdminCartridgeDescriptor('', {
      gating: {
        kind: 'credential',
        credential: 'admin-cartridge:',
        source: 'category-default' as never,
      },
    });
    const decision = await evaluateAccess(ctx, descriptor, 'read');
    // Even though global isAdmin is true, the malformed credential
    // doesn't match — fail-closed at the credential parser. Future
    // content rows mis-seeded with an empty slug stay locked rather
    // than silently elevating to global-admin-allowed.
    expect(decision.allow).toBe(false);
  });
});
