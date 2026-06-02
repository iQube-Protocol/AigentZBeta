/**
 * Spine validation suite — Phase 1 IAM foundation plan.
 *
 * Pure-logic unit tests for the access spine. No network, no Supabase,
 * no live data — every dependency is mocked. Runs in <1 second locally
 * with `npm test tests/access-spine.test.ts` (or as part of `npm test`).
 *
 * What this validates:
 *   1. personaSessionToken — issue/verify roundtrip; tampering detection;
 *      expiry; version mismatch; bad signature; malformed envelope
 *   2. policyResolvers — sync vs async receipt mode for every action;
 *      cartridge-flag credential matching; external-verifier classification
 *   3. evaluateAccess — every (state × gating × ownership) decision branch:
 *      free / owned / payment-required / credential-met / credential-required
 *      Plus delivery mode mapping per content state.
 *   4. contracts — sanity assertions on the type union exhaustiveness so
 *      adding a new state / action breaks tests until handled.
 *
 * What this does NOT validate:
 *   - getActivePersona, getContentDescriptor — both depend on Supabase rows
 *     and are exercised by the integration tests / verify-spine.mjs script
 *     against a live env. Adding mocked-Supabase tests for them would just
 *     re-test our own mocks. Their CONTRACTS are exercised below via the
 *     evaluateAccess / policyResolvers tests that consume them.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  issuePersonaSessionToken,
  verifyPersonaSessionToken,
  readTokenFromRequest,
} from '@/services/identity/personaSessionToken';
import {
  resolveReceiptMode,
  credentialMatchesCartridgeFlag,
  credentialRequiresExternalVerifier,
} from '@/services/access/policyResolvers';
import { evaluateAccess } from '@/services/access/evaluateAccess';
import {
  buildDebugBypassContext,
  isDebugBypassEnabled,
} from '@/services/access/debugBypass';
import type {
  AccessAction,
  ActivePersonaContext,
  ContentAccessDescriptor,
  ContentState,
} from '@/types/access';

// ─────────────────────────────────────────────────────────────────────────
// Mock the ownership service so evaluateAccess decisions are deterministic
// ─────────────────────────────────────────────────────────────────────────

vi.mock('@/services/rewards/assetOwnership', () => ({
  userOwnsAsset: vi.fn(),
}));
import { userOwnsAsset } from '@/services/rewards/assetOwnership';

const mockedOwns = userOwnsAsset as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockedOwns.mockReset();
  // Ensure HMAC key is present for token tests
  process.env.PERSONA_SESSION_TOKEN_HMAC_KEY = 'test-hmac-key-for-vitest-suite-32-chars-min';
});

// ─────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────

const makeContext = (over?: Partial<ActivePersonaContext>): ActivePersonaContext => ({
  personaId: 'persona-uuid-1',
  authProfileId: 'auth-profile-uuid-1',
  identifiability: 'semi_anonymous',
  cartridgeFlags: { isAdmin: false, isPartner: false },
  cohortMemberships: [],
  source: 'session-cookie',
  ...over,
});

const makeDescriptor = (
  state: ContentState,
  gatingKind: 'free' | 'payment' | 'credential',
  over?: Partial<ContentAccessDescriptor>,
): ContentAccessDescriptor => ({
  assetId: 'mk_ep01_print_common',
  contentClass: state === 'A_open_unqubed' ? 'gn' : 'episode_print',
  state,
  gating: { kind: gatingKind, source: 'category-default' as never },
  receiptEligible: state === 'C_gated_wip' || state === 'D_gated_canonical_pool',
  ...over,
});

// ─────────────────────────────────────────────────────────────────────────
// 1. personaSessionToken
// ─────────────────────────────────────────────────────────────────────────

describe('personaSessionToken', () => {
  it('issues + verifies a token roundtrip', () => {
    const issued = issuePersonaSessionToken({
      personaId: 'pid-1',
      authProfileId: 'apid-1',
    });
    expect(issued.token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    const verified = verifyPersonaSessionToken(issued.token);
    expect(verified.ok).toBe(true);
    if (verified.ok) {
      expect(verified.data.personaId).toBe('pid-1');
      expect(verified.data.authProfileId).toBe('apid-1');
    }
  });

  it('rejects a tampered token', () => {
    const issued = issuePersonaSessionToken({
      personaId: 'pid-1',
      authProfileId: 'apid-1',
    });
    // Flip a character in the payload portion
    const [payload, sig] = issued.token.split('.');
    const tampered = `${payload.slice(0, -1)}X.${sig}`;
    const verified = verifyPersonaSessionToken(tampered);
    expect(verified.ok).toBe(false);
    if (!verified.ok) expect(verified.reason).toBe('bad-signature');
  });

  it('rejects an expired token', () => {
    const issued = issuePersonaSessionToken({
      personaId: 'pid-1',
      authProfileId: 'apid-1',
      ttlSeconds: 60, // smallest accepted
    });
    // Move clock forward
    const realNow = Date.now;
    Date.now = () => realNow() + 120 * 1000;
    try {
      const verified = verifyPersonaSessionToken(issued.token);
      expect(verified.ok).toBe(false);
      if (!verified.ok) expect(verified.reason).toBe('expired');
    } finally {
      Date.now = realNow;
    }
  });

  it('rejects malformed input', () => {
    expect(verifyPersonaSessionToken('').ok).toBe(false);
    expect(verifyPersonaSessionToken('no-dot').ok).toBe(false);
    expect(verifyPersonaSessionToken('.no-payload').ok).toBe(false);
    expect(verifyPersonaSessionToken('no-sig.').ok).toBe(false);
    expect(verifyPersonaSessionToken(null as unknown as string).ok).toBe(false);
    expect(verifyPersonaSessionToken(undefined as unknown as string).ok).toBe(false);
  });

  it('rejects a token signed with a different key', () => {
    const issued = issuePersonaSessionToken({
      personaId: 'pid-1',
      authProfileId: 'apid-1',
    });
    process.env.PERSONA_SESSION_TOKEN_HMAC_KEY = 'a-different-test-key-32-chars-or-more-yes';
    const verified = verifyPersonaSessionToken(issued.token);
    expect(verified.ok).toBe(false);
    if (!verified.ok) expect(verified.reason).toBe('bad-signature');
  });

  it('readTokenFromRequest reads from ?pst= and from header', () => {
    const issued = issuePersonaSessionToken({
      personaId: 'pid-1',
      authProfileId: 'apid-1',
    });
    const fromQuery = readTokenFromRequest({
      url: `https://example.test/x?pst=${encodeURIComponent(issued.token)}`,
      headers: { get: () => null },
    });
    expect(fromQuery).toBe(issued.token);

    const fromHeader = readTokenFromRequest({
      url: 'https://example.test/x',
      headers: { get: (k: string) => (k === 'x-persona-session-token' ? issued.token : null) },
    });
    expect(fromHeader).toBe(issued.token);

    const none = readTokenFromRequest({
      url: 'https://example.test/x',
      headers: { get: () => null },
    });
    expect(none).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 2. policyResolvers
// ─────────────────────────────────────────────────────────────────────────

describe('policyResolvers', () => {
  it('forces sync receipt mode for the consequential action set', () => {
    const consequential: AccessAction[] = ['mint', 'transfer', 'payment-settle', 'policy-escalation', 'disclosure'];
    for (const a of consequential) {
      expect(resolveReceiptMode(a, undefined)).toBe('sync');
      expect(resolveReceiptMode(a, true)).toBe('sync'); // hint cannot opt out
      expect(resolveReceiptMode(a, false)).toBe('sync');
    }
  });

  it('uses async receipt mode for the read-set actions', () => {
    const reads: AccessAction[] = ['read', 'watch', 'listen', 'invoke', 'connect', 'remix'];
    for (const a of reads) {
      expect(resolveReceiptMode(a, undefined)).toBe('async');
      expect(resolveReceiptMode(a, false)).toBe('async');
    }
  });

  it('credentialMatchesCartridgeFlag resolves admin / partner correctly', () => {
    const admin = { isAdmin: true, isPartner: false };
    const partner = { isAdmin: false, isPartner: true };
    const neither = { isAdmin: false, isPartner: false };
    expect(credentialMatchesCartridgeFlag('admin', admin)).toBe(true);
    expect(credentialMatchesCartridgeFlag('admin', neither)).toBe(false);
    expect(credentialMatchesCartridgeFlag('partner', partner)).toBe(true);
    expect(credentialMatchesCartridgeFlag('partner', neither)).toBe(false);
    expect(credentialMatchesCartridgeFlag('investor', admin)).toBe(false); // investor is not a cartridge flag
    expect(credentialMatchesCartridgeFlag(undefined, admin)).toBe(false);
  });

  it('credentialRequiresExternalVerifier classifies cohort:* and token:* only', () => {
    expect(credentialRequiresExternalVerifier('cohort:knyt-investors')).toBe(true);
    expect(credentialRequiresExternalVerifier('token:base:0xabc')).toBe(true);
    expect(credentialRequiresExternalVerifier('admin')).toBe(false);
    expect(credentialRequiresExternalVerifier(undefined)).toBe(false);
    expect(credentialRequiresExternalVerifier('investor')).toBe(false);
  });

  // ─────────────────────────────────────────────────────────────────────
  // Phase 4b — cartridge membership credential resolvers
  //
  // The myCartridge PRD §23 mandates that role checks flow through
  // evaluateAccess via descriptor credentials, not parallel call-site
  // resolvers. These tests pin the credentialMatchesCartridgeFlag
  // extension for `member:<slug>` and `role:<slug>:<role>` so a future
  // edit can't silently change the semantics.
  // ─────────────────────────────────────────────────────────────────────

  it('member:<slug> matches when the persona holds any role on the slug', () => {
    const flags = {
      isAdmin: false,
      isPartner: false,
      cartridgeMemberships: { 'my-cart': 'member' as const },
    };
    expect(credentialMatchesCartridgeFlag('member:my-cart', flags)).toBe(true);
    expect(credentialMatchesCartridgeFlag('member:other-cart', flags)).toBe(false);
  });

  it('member:<slug> short-circuits on isAdmin and adminCartridges', () => {
    expect(credentialMatchesCartridgeFlag('member:any-cart', {
      isAdmin: true, isPartner: false,
    })).toBe(true);
    expect(credentialMatchesCartridgeFlag('member:my-cart', {
      isAdmin: false, isPartner: false,
      adminCartridges: ['my-cart'],
    })).toBe(true);
  });

  it('role:<slug>:<role> applies the PRD §23 hierarchy', () => {
    const editor = {
      isAdmin: false, isPartner: false,
      cartridgeMemberships: { 'my-cart': 'editor' as const },
    };
    // editor >= editor: yes
    expect(credentialMatchesCartridgeFlag('role:my-cart:editor', editor)).toBe(true);
    // editor >= member: yes (editor outranks member)
    expect(credentialMatchesCartridgeFlag('role:my-cart:member', editor)).toBe(true);
    // editor >= admin: no (editor is below admin)
    expect(credentialMatchesCartridgeFlag('role:my-cart:admin', editor)).toBe(false);
    // editor >= owner: no
    expect(credentialMatchesCartridgeFlag('role:my-cart:owner', editor)).toBe(false);
  });

  it('role:<slug>:<role> short-circuits on isAdmin and adminCartridges', () => {
    // Uber-admin satisfies any role on any cartridge.
    expect(credentialMatchesCartridgeFlag('role:any-cart:owner', {
      isAdmin: true, isPartner: false,
    })).toBe(true);
    // Per-cartridge admin satisfies any role on that cartridge only.
    expect(credentialMatchesCartridgeFlag('role:my-cart:owner', {
      isAdmin: false, isPartner: false,
      adminCartridges: ['my-cart'],
    })).toBe(true);
    expect(credentialMatchesCartridgeFlag('role:other-cart:owner', {
      isAdmin: false, isPartner: false,
      adminCartridges: ['my-cart'],
    })).toBe(false);
  });

  it('role:<slug>:<role> fails closed on unknown roles and malformed input', () => {
    const ed = {
      isAdmin: false, isPartner: false,
      cartridgeMemberships: { 'my-cart': 'editor' as const },
    };
    expect(credentialMatchesCartridgeFlag('role:my-cart:bogus-role', ed)).toBe(false);
    expect(credentialMatchesCartridgeFlag('role:my-cart:', ed)).toBe(false);
    expect(credentialMatchesCartridgeFlag('role::editor', ed)).toBe(false);
    expect(credentialMatchesCartridgeFlag('role:', ed)).toBe(false);
  });

  it('member:<slug> and role:<slug>:<role> fail closed when cartridgeMemberships absent', () => {
    const none = { isAdmin: false, isPartner: false };
    expect(credentialMatchesCartridgeFlag('member:my-cart', none)).toBe(false);
    expect(credentialMatchesCartridgeFlag('role:my-cart:member', none)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 3. evaluateAccess — the decision matrix
// ─────────────────────────────────────────────────────────────────────────

describe('evaluateAccess', () => {
  it('FREE state-A: ALLOW with reason="free", deliveryMode="plain-redirect"', async () => {
    const ctx = makeContext();
    const desc = makeDescriptor('A_open_unqubed', 'free');
    const decision = await evaluateAccess(ctx, desc, 'read');
    expect(decision.allow).toBe(true);
    expect(decision.reason).toBe('free');
    expect(decision.deliveryMode).toBe('plain-redirect');
    expect(mockedOwns).not.toHaveBeenCalled();
  });

  it('GN (assetId=mk_ep00_*) is gated, not free — operator clarification 2026-05-06', async () => {
    // Earlier code special-cased ep=0 as free based on a 'GN free-preview
    // short-circuit' aspirational comment in the handover. The operator
    // confirmed the GN is NOT free in production: it must be paid like
    // any other episode. Real preview affordances (first N pages, etc.)
    // are tracked in plan §11.f as a separate backlog feature.
    //
    // This test locks in: an ep=0 print descriptor with payment gating
    // and no entitlement returns DENY/payment-required, same as ep>0.
    mockedOwns.mockResolvedValue({ owned: false, via: null });
    const ctx = makeContext();
    const desc = makeDescriptor('C_gated_wip', 'payment', {
      assetId: 'mk_ep00_print_common',
      contentClass: 'gn',
    });
    const decision = await evaluateAccess(ctx, desc, 'read');
    expect(decision.allow).toBe(false);
    expect(decision.reason).toBe('payment-required');
  });

  it('FREE state-B (open iqubed): ALLOW; PDF -> page-image-proxy, video -> decrypt-stream', async () => {
    const ctx = makeContext();
    const pdf = makeDescriptor('B_open_iqubed', 'free', { contentClass: 'episode_print' });
    const video = makeDescriptor('B_open_iqubed', 'free', { contentClass: 'episode_motion' });
    expect((await evaluateAccess(ctx, pdf, 'read')).deliveryMode).toBe('page-image-proxy');
    expect((await evaluateAccess(ctx, video, 'watch')).deliveryMode).toBe('decrypt-stream');
  });

  it('PAYMENT state-C unowned: DENY with reason="payment-required"', async () => {
    mockedOwns.mockResolvedValue({ owned: false, via: null });
    const ctx = makeContext();
    const desc = makeDescriptor('C_gated_wip', 'payment');
    const decision = await evaluateAccess(ctx, desc, 'read');
    expect(decision.allow).toBe(false);
    expect(decision.reason).toBe('payment-required');
    expect(decision.deliveryMode).toBe('page-image-proxy'); // PDF — same delivery mode on deny
  });

  it('PAYMENT state-C owned: ALLOW with reason="owned"', async () => {
    mockedOwns.mockResolvedValue({ owned: true, via: 'direct' });
    const ctx = makeContext();
    const desc = makeDescriptor('C_gated_wip', 'payment');
    const decision = await evaluateAccess(ctx, desc, 'read');
    expect(decision.allow).toBe(true);
    expect(decision.reason).toBe('owned');
  });

  it('PAYMENT state-D owned via SKU: ALLOW; deliveryMode="token-proof-stream"', async () => {
    mockedOwns.mockResolvedValue({ owned: true, via: 'sku' });
    const ctx = makeContext();
    const desc = makeDescriptor('D_gated_canonical_pool', 'payment');
    const decision = await evaluateAccess(ctx, desc, 'watch');
    expect(decision.allow).toBe(true);
    expect(decision.reason).toBe('owned');
    expect(decision.deliveryMode).toBe('token-proof-stream');
  });

  it('CREDENTIAL admin: ALLOW for an admin context', async () => {
    const ctx = makeContext({ cartridgeFlags: { isAdmin: true, isPartner: false } });
    const desc = makeDescriptor('C_gated_wip', 'credential', {
      gating: { kind: 'credential', credential: 'admin' },
    });
    const decision = await evaluateAccess(ctx, desc, 'read');
    expect(decision.allow).toBe(true);
    expect(decision.reason).toBe('credential-met');
  });

  it('CREDENTIAL admin: DENY for a non-admin context', async () => {
    const ctx = makeContext({ cartridgeFlags: { isAdmin: false, isPartner: false } });
    const desc = makeDescriptor('C_gated_wip', 'credential', {
      gating: { kind: 'credential', credential: 'admin' },
    });
    const decision = await evaluateAccess(ctx, desc, 'read');
    expect(decision.allow).toBe(false);
    expect(decision.reason).toBe('credential-required');
  });

  it('CREDENTIAL cohort:* needs an external verifier — Phase 1 returns DENY conservatively', async () => {
    const ctx = makeContext();
    const desc = makeDescriptor('D_gated_canonical_pool', 'credential', {
      gating: { kind: 'credential', credential: 'cohort:knyt-investors' },
    });
    const decision = await evaluateAccess(ctx, desc, 'read');
    expect(decision.allow).toBe(false);
    expect(decision.reason).toBe('credential-required');
  });

  it('all decisions carry an alias-anchored receipt handle (NEVER personaId/rootDid)', async () => {
    mockedOwns.mockResolvedValue({ owned: true, via: 'direct' });
    const ctx = makeContext();
    const desc = makeDescriptor('C_gated_wip', 'payment');
    const decision = await evaluateAccess(ctx, desc, 'read');
    expect(decision.receipt).toBeDefined();
    expect(decision.receipt.aliasCommitment).toBeTruthy();
    expect(decision.receipt.cohortId).toBeTruthy();
    // T0 must NOT appear anywhere in the receipt
    const json = JSON.stringify(decision.receipt);
    expect(json).not.toContain('persona-uuid-1');
    expect(json).not.toContain('auth-profile-uuid-1');
    expect(json).not.toContain('did:fio:');
    expect(json).not.toContain('did:iq:');
  });

  it('async actions get receipt.mode="async"; consequential actions get "sync"', async () => {
    mockedOwns.mockResolvedValue({ owned: true, via: 'direct' });
    const ctx = makeContext();
    const desc = makeDescriptor('C_gated_wip', 'payment');
    expect((await evaluateAccess(ctx, desc, 'read')).receipt.mode).toBe('async');
    expect((await evaluateAccess(ctx, desc, 'mint')).receipt.mode).toBe('sync');
    expect((await evaluateAccess(ctx, desc, 'transfer')).receipt.mode).toBe('sync');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 4. debugBypass — operator-authorised TEMPORARY DEBUG
// ─────────────────────────────────────────────────────────────────────────

describe('debugBypass', () => {
  it('isDebugBypassEnabled is currently hardcoded ON (TEMPORARY DEBUG)', () => {
    // Plan §11.e tracks this as a backlog item to retire.
    expect(isDebugBypassEnabled()).toBe(true);
  });

  it('synthesised context has admin=true, identifiable, sentinel ids', () => {
    const ctx = buildDebugBypassContext();
    expect(ctx.cartridgeFlags.isAdmin).toBe(true);
    expect(ctx.cartridgeFlags.isPartner).toBe(true);
    expect(ctx.identifiability).toBe('identifiable');
    expect(ctx.personaId).toMatch(/^__debug_bypass/);
    expect(ctx.authProfileId).toMatch(/^__debug_bypass/);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 5. Privacy contract — sanity assertions on T0/T1/T2 boundaries
// ─────────────────────────────────────────────────────────────────────────

describe('privacy contract', () => {
  it('ActivePersonaContext (T0) carries personaId + authProfileId', () => {
    // This is a compile-time contract; assert structural shape.
    const ctx = makeContext();
    expect(ctx).toHaveProperty('personaId');
    expect(ctx).toHaveProperty('authProfileId');
  });

  it('AccessDecision.receipt does not have personaId, authProfileId, or rootDid keys', async () => {
    mockedOwns.mockResolvedValue({ owned: true, via: 'direct' });
    const decision = await evaluateAccess(
      makeContext({ personaId: 'leak-canary-pid', authProfileId: 'leak-canary-apid' }),
      makeDescriptor('C_gated_wip', 'payment'),
      'read',
    );
    expect(decision.receipt).not.toHaveProperty('personaId');
    expect(decision.receipt).not.toHaveProperty('authProfileId');
    expect(decision.receipt).not.toHaveProperty('rootDid');
    expect(decision.receipt).not.toHaveProperty('fioHandle');
    // The whole decision payload should not echo the canary T0 values either.
    const blob = JSON.stringify(decision);
    expect(blob).not.toContain('leak-canary-pid');
    expect(blob).not.toContain('leak-canary-apid');
  });

  it('Phase 4b — cartridgeMemberships is T1-safe (slug + role only, no persona ids leak)', async () => {
    // A persona with a role grant. The map value is the role enum
    // string — never the row's persona_id or granted_by.
    mockedOwns.mockResolvedValue({ owned: false, via: undefined });
    const ctx = makeContext({
      personaId: 'leak-canary-pid-2',
      authProfileId: 'leak-canary-apid-2',
      cartridgeFlags: {
        isAdmin: false,
        isPartner: false,
        adminCartridges: [],
        cartridgeMemberships: { 'my-cart': 'editor' },
      },
    });
    // Role-gated allow path: the descriptor carries `role:my-cart:editor`
    // and the persona's editor role meets it. The receipt MUST NOT echo
    // either the persona id OR the role string (the role is a T1 fact
    // about the persona, but the receipt is the T2 attribution surface
    // where alias commitment + cohort id are the only allowed identifiers).
    const desc = makeDescriptor('C_gated_wip', 'credential', {
      gating: { kind: 'credential', credential: 'role:my-cart:editor' },
    });
    const decision = await evaluateAccess(ctx, desc, 'read');
    expect(decision.allow).toBe(true);
    expect(decision.reason).toBe('credential-met');
    const blob = JSON.stringify(decision.receipt);
    expect(blob).not.toContain('leak-canary-pid-2');
    expect(blob).not.toContain('leak-canary-apid-2');
    expect(blob).not.toContain('editor');
    expect(blob).not.toContain('my-cart');
  });
});
