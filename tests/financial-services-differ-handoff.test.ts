/**
 * Differ x Financial Services Bridge pilot — handoff issuance/redemption +
 * Differ adapter canaries.
 *
 * Mocks the OBSERVER MODULE ITSELF (`financialServicesObserver`) so these
 * tests isolate handoff binding/expiry/replay logic from projection-
 * composition logic — the latter is covered in full by
 * tests/financial-services-differ-observer.test.ts, which exercises the real
 * observer against mocked lower-level reads. One file cannot do both: vi.mock
 * is hoisted and module-wide, so a file that mocks financialServicesObserver
 * cannot also exercise its real implementation.
 *
 * Covers:
 *   6. Differ cannot choose an arbitrary action/capability/surface at
 *      issuance
 *   7. a handoff is principal-, action-, and eligibility-bound
 *   8. expired / reused / wrong-principal / no-longer-eligible handoffs all
 *      fail redemption
 *   9. redemption is atomic (a lost race never succeeds twice)
 *  10. a successful redemption never executes the underlying act — only a
 *      navigation destination is returned
 *  11. the Differ adapter's completion callback contract is parsed but
 *      carries nothing beyond the bare outcome enum — never trusted as
 *      completion evidence
 */

import { describe, it, expect, vi } from 'vitest';

const mockResolveProjection = vi.fn();
vi.mock('@/services/financialServices/financialServicesObserver', async () => {
  const actual = await vi.importActual<typeof import('@/services/financialServices/financialServicesObserver')>(
    '@/services/financialServices/financialServicesObserver',
  );
  return {
    ...actual,
    resolveFinancialServicesProjection: (...args: unknown[]) => mockResolveProjection(...args),
  };
});

vi.mock('@/services/journey/catalogueDestinationHelper', () => ({
  resolveJourneyOperatorDestination: vi.fn(() => ({ valid: false, journeyId: 'x', failedLookup: 'journey-not-registered', reason: 'test' })),
}));

process.env.PERSONA_SESSION_TOKEN_HMAC_KEY = 'test-hmac-key-for-vitest-suite-32-chars-min';

import { issueNativeActionHandoff, redeemNativeActionHandoff } from '@/services/handoffs/nativeActionHandoff';
import { personaPublicRef } from '@/services/identity/personaReferences';
import { HORIZEN_MONEYPENNY_JOURNEY } from '@/services/journey/horizenMoneyPennyJourney';
import { parseNativeActionCallback } from '@/services/differAdapter/financialServicesClient';

const PRINCIPAL = { personaId: 'persona-aaaa-1111', authProfileId: 'authprofile-bbbb-2222' };

function eligibleProjectionFixture() {
  return {
    schemaVersion: 'fs-differ-projection/v1' as const,
    projectionId: 'fsproj-test-1',
    generatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 90_000).toISOString(),
    journey: { id: HORIZEN_MONEYPENNY_JOURNEY.id, currentStageId: 'aigentme', stages: [] },
    services: [],
    nextActions: [
      {
        actionRef: 'moneypenny.architect',
        label: 'MoneyPenny Architect',
        capabilityRef: 'financial_structure_design',
        nativeSurfaceRef: 'moneypenny-orchestration',
        handoffEligible: true,
      },
    ],
  };
}

// Chainable fake Supabase builder for the handoffs table.
function makeHandoffAdmin(opts: {
  row?: Record<string, unknown> | null;
  insertError?: { message: string } | null;
  updateAffectedRows?: number;
}) {
  const insert = vi.fn().mockResolvedValue({ error: opts.insertError ?? null });
  const maybeSingle = vi.fn().mockResolvedValue({ data: opts.row ?? null, error: null });
  const eqForSelect = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq: eqForSelect }));

  const updateSelect = vi.fn().mockResolvedValue({
    data: Array.from({ length: opts.updateAffectedRows ?? 1 }, () => ({ id: (opts.row as { id?: string })?.id ?? 'row-1' })),
    error: null,
  });
  const updateEq2 = vi.fn(() => ({ select: updateSelect }));
  const updateEq1 = vi.fn(() => ({ eq: updateEq2 }));
  const update = vi.fn(() => ({ eq: updateEq1 }));

  return {
    from: vi.fn(() => ({ insert, select, update })),
  } as unknown as import('@supabase/supabase-js').SupabaseClient;
}

describe('nativeActionHandoff — issuance', () => {
  it('refuses to issue a handoff for an actionRef not currently in nextActions (no arbitrary capability/surface selection)', async () => {
    mockResolveProjection.mockResolvedValue(eligibleProjectionFixture());
    const admin = makeHandoffAdmin({});
    const result = await issueNativeActionHandoff(admin, PRINCIPAL, {
      actionRef: 'moneypenny.runtime', // not eligible in the fixture
      returnUrl: 'https://differ.example/return',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('action-not-eligible');
  });

  it('refuses an invalid returnUrl', async () => {
    mockResolveProjection.mockResolvedValue(eligibleProjectionFixture());
    const admin = makeHandoffAdmin({});
    const result = await issueNativeActionHandoff(admin, PRINCIPAL, {
      actionRef: 'moneypenny.architect',
      returnUrl: 'not-a-url',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('invalid-return-url');
  });

  it('issues a handoff for an eligible actionRef and returns an opaque id + expiry (never a client-echoed capability)', async () => {
    mockResolveProjection.mockResolvedValue(eligibleProjectionFixture());
    const admin = makeHandoffAdmin({});
    const result = await issueNativeActionHandoff(admin, PRINCIPAL, {
      actionRef: 'moneypenny.architect',
      returnUrl: 'https://differ.example/return',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.handoffId).toMatch(/^fshoff_/);
      expect(new Date(result.expiresAt).getTime()).toBeGreaterThan(Date.now());
    }
  });
});

describe('nativeActionHandoff — redemption', () => {
  const baseRow = {
    id: 'row-1',
    status: 'pending',
    principal_public_ref: personaPublicRef(PRINCIPAL.personaId),
    journey_id: HORIZEN_MONEYPENNY_JOURNEY.id,
    stage_id: 'aigentme',
    action_ref: 'moneypenny.architect',
    capability_ref: 'financial_structure_design',
    native_surface_ref: 'moneypenny-orchestration',
    return_url: 'https://differ.example/return',
    expires_at: new Date(Date.now() + 60_000).toISOString(),
  };

  it('fails redemption for a handoff that does not exist', async () => {
    mockResolveProjection.mockResolvedValue(eligibleProjectionFixture());
    const admin = makeHandoffAdmin({ row: null });
    const result = await redeemNativeActionHandoff(admin, 'fshoff_doesnotexist', PRINCIPAL);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not-found');
  });

  it('fails redemption for an expired handoff', async () => {
    mockResolveProjection.mockResolvedValue(eligibleProjectionFixture());
    const admin = makeHandoffAdmin({ row: { ...baseRow, expires_at: new Date(Date.now() - 1000).toISOString() } });
    const result = await redeemNativeActionHandoff(admin, 'fshoff_expired', PRINCIPAL);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('expired');
  });

  it('fails redemption for an already-consumed (replayed) handoff', async () => {
    mockResolveProjection.mockResolvedValue(eligibleProjectionFixture());
    const admin = makeHandoffAdmin({ row: { ...baseRow, status: 'consumed' } });
    const result = await redeemNativeActionHandoff(admin, 'fshoff_used', PRINCIPAL);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('already-used');
  });

  it('fails redemption when the signed-in principal has changed since issuance', async () => {
    mockResolveProjection.mockResolvedValue(eligibleProjectionFixture());
    const admin = makeHandoffAdmin({ row: { ...baseRow, principal_public_ref: personaPublicRef('a-totally-different-persona') } });
    const result = await redeemNativeActionHandoff(admin, 'fshoff_switched', PRINCIPAL);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('principal-mismatch');
  });

  it('fails redemption when the action is no longer eligible (authoritative state advanced)', async () => {
    mockResolveProjection.mockResolvedValue({ ...eligibleProjectionFixture(), nextActions: [] }); // nothing eligible anymore
    const admin = makeHandoffAdmin({ row: baseRow });
    const result = await redeemNativeActionHandoff(admin, 'fshoff_stale', PRINCIPAL);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('action-no-longer-eligible');
  });

  it('a concurrent second redemption of the same handoff loses the race — consumption is atomic, never a second success', async () => {
    mockResolveProjection.mockResolvedValue(eligibleProjectionFixture());
    const admin = makeHandoffAdmin({ row: baseRow, updateAffectedRows: 0 }); // simulates "already flipped by the first request"
    const result = await redeemNativeActionHandoff(admin, 'fshoff_race', PRINCIPAL);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('consume-race-lost');
  });

  it('a valid, unexpired, correctly-bound handoff redeems successfully and names the exact native surface — never executing the act itself', async () => {
    mockResolveProjection.mockResolvedValue(eligibleProjectionFixture());
    const admin = makeHandoffAdmin({ row: baseRow, updateAffectedRows: 1 });
    const result = await redeemNativeActionHandoff(admin, 'fshoff_valid', PRINCIPAL);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.actionRef).toBe('moneypenny.architect');
      expect(result.nativeSurfaceRef).toBe('moneypenny-orchestration');
      expect(result.returnUrl).toBe('https://differ.example/return');
      // The result carries only a navigation destination, never any
      // "executed"/"result"/"delivered" style field — this function never
      // dispatches the underlying MoneyPenny act.
      expect(Object.keys(result)).not.toContain('executed');
      expect(Object.keys(result)).not.toContain('outcome');
    }
  });
});

describe('Differ adapter — completion callback is navigation only', () => {
  it('parses a well-formed callback', () => {
    const params = new URLSearchParams({ handoffId: 'fshoff_abc', outcome: 'native-act-finished' });
    expect(parseNativeActionCallback(params)).toEqual({ handoffId: 'fshoff_abc', outcome: 'native-act-finished' });
  });

  it('rejects a callback with an unrecognised outcome value', () => {
    const params = new URLSearchParams({ handoffId: 'fshoff_abc', outcome: 'success' });
    expect(parseNativeActionCallback(params)).toBeNull();
  });

  it('rejects a callback missing handoffId', () => {
    const params = new URLSearchParams({ outcome: 'native-act-finished' });
    expect(parseNativeActionCallback(params)).toBeNull();
  });

  it('the parsed callback type carries no field that could assert completion beyond the bare outcome enum', () => {
    const params = new URLSearchParams({ handoffId: 'fshoff_abc', outcome: 'native-act-finished' });
    const parsed = parseNativeActionCallback(params);
    expect(parsed && Object.keys(parsed).sort()).toEqual(['handoffId', 'outcome']);
  });
});
