/**
 * services/adaptive/nativeHandoff.ts — canaries (operator ruling,
 * 2026-08-27, Differ FS pilot reconciliation).
 *
 * Mocks `externalIntegrationRegistry.ts` to exercise an ENABLED integration
 * fixture — the real, shipped `differ-fs-pilot` registration is disabled by
 * design (Q7 unresolved), so a test suite that only ever saw `disabled`
 * would never exercise the issuance/redemption logic at all. Real-registry
 * behavior (disabled today) is covered separately in
 * tests/adaptive-external-integration-registry.test.ts.
 *
 * Covers:
 *   - Differ cannot choose an arbitrary capability (issuance re-derives
 *     eligibility from the SUPPLIED projection/context, never trusts a
 *     caller-asserted capabilityId alone)
 *   - a handoff is principal-, projection-, journey/stage-, and
 *     capability-bound
 *   - expired / reused / wrong-principal / no-longer-eligible handoffs all
 *     fail redemption
 *   - redemption is atomic (a lost race never succeeds twice)
 *   - a successful redemption never executes the underlying act — only a
 *     navigation destination is returned
 *   - the Differ adapter's completion callback carries nothing beyond the
 *     bare outcome enum — never trusted as completion evidence
 */

import { describe, it, expect, vi } from 'vitest';

const FIXTURE_INTEGRATION = {
  integrationId: 'test-integration',
  providerId: 'test-provider',
  applicationId: 'financial-services-journey-spine',
  enabled: true,
  allowedReturnOrigins: ['https://differ.example'],
  allowedJourneys: ['horizen-moneypenny-admission'],
  allowedCapabilities: ['moneypenny.architect'],
  transportMode: 'hosted-browser' as const,
};

vi.mock('@/services/adaptive/externalIntegrationRegistry', () => ({
  resolveExternalExperienceIntegration: (id: string) => (id === FIXTURE_INTEGRATION.integrationId ? FIXTURE_INTEGRATION : null),
  isReturnUrlAllowedForIntegration: (id: string, url: string) => {
    if (id !== FIXTURE_INTEGRATION.integrationId) return false;
    try {
      return FIXTURE_INTEGRATION.allowedReturnOrigins.includes(new URL(url).origin);
    } catch {
      return false;
    }
  },
  isJourneyAllowedForIntegration: (id: string, journeyId: string) =>
    id === FIXTURE_INTEGRATION.integrationId && FIXTURE_INTEGRATION.allowedJourneys.includes(journeyId),
  isCapabilityAllowedForIntegration: (id: string, capabilityId: string) =>
    id === FIXTURE_INTEGRATION.integrationId && FIXTURE_INTEGRATION.allowedCapabilities.includes(capabilityId),
}));

process.env.PERSONA_SESSION_TOKEN_HMAC_KEY = 'test-hmac-key-for-vitest-suite-32-chars-min';

import { issueNativeActionHandoff, isCapabilityHandoffEligible, redeemNativeActionHandoff } from '@/services/adaptive/nativeHandoff';
import { parseNativeActionCallback } from '@/services/differAdapter/financialServicesClient';
import type { AdaptiveInteractionContext, ExperienceProjection } from '@/types/adaptiveExperience';

const PRINCIPAL_REF = 'polity-pub-ref-1';

function eligibleContextAndProjection(): { context: AdaptiveInteractionContext; projection: ExperienceProjection } {
  const context: AdaptiveInteractionContext = {
    contextId: 'ctx-1',
    participantRef: PRINCIPAL_REF,
    journey: {
      journeyId: 'horizen-moneypenny-admission',
      journeyVersion: '1.0.0',
      currentStageId: 'aigentme',
      completedStageIds: [],
      readyStageIds: [],
      optionalStageIds: [],
      waitingStageIds: [],
      blockedStageIds: [],
    },
    capabilityRefs: [
      {
        capabilityId: 'moneypenny.architect',
        label: 'MoneyPenny Architect',
        surfaceTypes: ['cartridge-tab'],
        hostRefs: { native: 'moneypenny-orchestration' },
        disposition: { externalRenderAllowed: true, externalExecuteAllowed: false, nativeHandoffAllowed: true },
      },
    ],
    host: { hostId: 'differ', surfaceTypesSupported: ['cartridge-tab'] },
    disclosurePolicy: { fieldClassification: {}, enforced: true },
    constitutionalConstraints: [],
    generatedAt: new Date().toISOString(),
  };
  const projection: ExperienceProjection = {
    projectionId: 'proj-eligible-1',
    contextId: context.contextId,
    provider: 'native',
    layout: { mode: 'linear', density: 'normal' },
    surfaces: [
      { capabilityId: 'moneypenny.architect', surfaceType: 'cartridge-tab', hostRef: 'moneypenny-orchestration', emphasis: 'primary', handoffOffered: true },
    ],
    constraintsApplied: [],
    level: 1,
  };
  return { context, projection };
}

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
    calls: { insert },
  } as unknown as import('@supabase/supabase-js').SupabaseClient & { calls: { insert: ReturnType<typeof vi.fn> } };
}

describe('isCapabilityHandoffEligible — pure', () => {
  it('requires BOTH the capability disposition AND the projection to offer it', () => {
    const { context, projection } = eligibleContextAndProjection();
    expect(isCapabilityHandoffEligible(context, projection, 'moneypenny.architect')).toBe(true);
    expect(isCapabilityHandoffEligible(context, projection, 'moneypenny.runtime')).toBe(false);
  });

  it('rejects a capability the projection claims handoffOffered for but whose disposition forbids it', () => {
    const { context, projection } = eligibleContextAndProjection();
    context.capabilityRefs[0].disposition.nativeHandoffAllowed = false;
    expect(isCapabilityHandoffEligible(context, projection, 'moneypenny.architect')).toBe(false);
  });
});

describe('nativeHandoff — issuance', () => {
  it('refuses a capability not present/offered in the supplied projection (no arbitrary capability selection)', async () => {
    const { context, projection } = eligibleContextAndProjection();
    const admin = makeHandoffAdmin({});
    const result = await issueNativeActionHandoff(admin, {
      integrationId: FIXTURE_INTEGRATION.integrationId,
      applicationId: FIXTURE_INTEGRATION.applicationId,
      context,
      projection,
      capabilityId: 'moneypenny.runtime',
      principalPublicRef: PRINCIPAL_REF,
      nativeSurfaceRef: 'moneypenny-orchestration',
      returnUrl: 'https://differ.example/return',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('capability-not-allowlisted');
    expect(admin.calls.insert).not.toHaveBeenCalled();
  });

  it('refuses a capability not on the INTEGRATION allowlist even if eligible in the projection', async () => {
    const { context, projection } = eligibleContextAndProjection();
    context.capabilityRefs.push({
      capabilityId: 'moneypenny.advisor',
      label: 'Advisor',
      surfaceTypes: ['cartridge-tab'],
      hostRefs: {},
      disposition: { externalRenderAllowed: true, externalExecuteAllowed: false, nativeHandoffAllowed: true },
    });
    projection.surfaces.push({ capabilityId: 'moneypenny.advisor', surfaceType: 'cartridge-tab', handoffOffered: true });
    const admin = makeHandoffAdmin({});
    const result = await issueNativeActionHandoff(admin, {
      integrationId: FIXTURE_INTEGRATION.integrationId,
      applicationId: FIXTURE_INTEGRATION.applicationId,
      context,
      projection,
      capabilityId: 'moneypenny.advisor', // eligible, but not on FIXTURE_INTEGRATION.allowedCapabilities
      principalPublicRef: PRINCIPAL_REF,
      nativeSurfaceRef: 'moneypenny-orchestration',
      returnUrl: 'https://differ.example/return',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('capability-not-allowlisted');
  });

  it('refuses an invalid returnUrl', async () => {
    const { context, projection } = eligibleContextAndProjection();
    const admin = makeHandoffAdmin({});
    const result = await issueNativeActionHandoff(admin, {
      integrationId: FIXTURE_INTEGRATION.integrationId,
      applicationId: FIXTURE_INTEGRATION.applicationId,
      context,
      projection,
      capabilityId: 'moneypenny.architect',
      principalPublicRef: PRINCIPAL_REF,
      nativeSurfaceRef: 'moneypenny-orchestration',
      returnUrl: 'not-a-url',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('invalid-return-url');
  });

  it('refuses a returnUrl origin not on the integration allowlist', async () => {
    const { context, projection } = eligibleContextAndProjection();
    const admin = makeHandoffAdmin({});
    const result = await issueNativeActionHandoff(admin, {
      integrationId: FIXTURE_INTEGRATION.integrationId,
      applicationId: FIXTURE_INTEGRATION.applicationId,
      context,
      projection,
      capabilityId: 'moneypenny.architect',
      principalPublicRef: PRINCIPAL_REF,
      nativeSurfaceRef: 'moneypenny-orchestration',
      returnUrl: 'https://evil.example/phish',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('return-url-not-allowlisted');
  });

  it('refuses an unregistered/disabled integration outright', async () => {
    const { context, projection } = eligibleContextAndProjection();
    const admin = makeHandoffAdmin({});
    const result = await issueNativeActionHandoff(admin, {
      integrationId: 'not-registered',
      applicationId: FIXTURE_INTEGRATION.applicationId,
      context,
      projection,
      capabilityId: 'moneypenny.architect',
      principalPublicRef: PRINCIPAL_REF,
      nativeSurfaceRef: 'moneypenny-orchestration',
      returnUrl: 'https://differ.example/return',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('integration-not-registered');
  });

  it('issues a handoff for an eligible, allowlisted capability and returns an opaque id + expiry', async () => {
    const { context, projection } = eligibleContextAndProjection();
    const admin = makeHandoffAdmin({});
    const result = await issueNativeActionHandoff(admin, {
      integrationId: FIXTURE_INTEGRATION.integrationId,
      applicationId: FIXTURE_INTEGRATION.applicationId,
      context,
      projection,
      capabilityId: 'moneypenny.architect',
      principalPublicRef: PRINCIPAL_REF,
      nativeSurfaceRef: 'moneypenny-orchestration',
      returnUrl: 'https://differ.example/return',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.handoffId).toMatch(/^aeehoff_/);
      expect(new Date(result.expiresAt).getTime()).toBeGreaterThan(Date.now());
    }
  });
});

describe('nativeHandoff — redemption', () => {
  const baseRow = {
    id: 'row-1',
    status: 'pending',
    integration_id: FIXTURE_INTEGRATION.integrationId,
    application_id: FIXTURE_INTEGRATION.applicationId,
    principal_public_ref: PRINCIPAL_REF,
    journey_id: 'horizen-moneypenny-admission',
    stage_id: 'aigentme',
    capability_id: 'moneypenny.architect',
    native_surface_ref: 'moneypenny-orchestration',
    return_url: 'https://differ.example/return',
    expires_at: new Date(Date.now() + 60_000).toISOString(),
  };
  const alwaysEligible = async () => true;
  const neverEligible = async () => false;

  it('fails redemption for a handoff that does not exist', async () => {
    const admin = makeHandoffAdmin({ row: null });
    const result = await redeemNativeActionHandoff(admin, 'aeehoff_doesnotexist', PRINCIPAL_REF, alwaysEligible);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not-found');
  });

  it('fails redemption for an expired handoff', async () => {
    const admin = makeHandoffAdmin({ row: { ...baseRow, expires_at: new Date(Date.now() - 1000).toISOString() } });
    const result = await redeemNativeActionHandoff(admin, 'aeehoff_expired', PRINCIPAL_REF, alwaysEligible);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('expired');
  });

  it('fails redemption for an already-consumed (replayed) handoff', async () => {
    const admin = makeHandoffAdmin({ row: { ...baseRow, status: 'consumed' } });
    const result = await redeemNativeActionHandoff(admin, 'aeehoff_used', PRINCIPAL_REF, alwaysEligible);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('already-used');
  });

  it('fails redemption when the signed-in principal has changed since issuance', async () => {
    const admin = makeHandoffAdmin({ row: { ...baseRow, principal_public_ref: 'a-totally-different-principal' } });
    const result = await redeemNativeActionHandoff(admin, 'aeehoff_switched', PRINCIPAL_REF, alwaysEligible);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('principal-mismatch');
  });

  it('fails redemption when the capability is no longer eligible (authoritative state advanced)', async () => {
    const admin = makeHandoffAdmin({ row: baseRow });
    const result = await redeemNativeActionHandoff(admin, 'aeehoff_stale', PRINCIPAL_REF, neverEligible);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('capability-no-longer-eligible');
  });

  it('a concurrent second redemption of the same handoff loses the race — consumption is atomic, never a second success', async () => {
    const admin = makeHandoffAdmin({ row: baseRow, updateAffectedRows: 0 });
    const result = await redeemNativeActionHandoff(admin, 'aeehoff_race', PRINCIPAL_REF, alwaysEligible);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('consume-race-lost');
  });

  it('a valid, unexpired, correctly-bound handoff redeems successfully and names only a navigation destination — never executing the act', async () => {
    const admin = makeHandoffAdmin({ row: baseRow, updateAffectedRows: 1 });
    const result = await redeemNativeActionHandoff(admin, 'aeehoff_valid', PRINCIPAL_REF, alwaysEligible);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.capabilityId).toBe('moneypenny.architect');
      expect(result.nativeSurfaceRef).toBe('moneypenny-orchestration');
      expect(result.returnUrl).toBe('https://differ.example/return');
      expect(Object.keys(result)).not.toContain('executed');
      expect(Object.keys(result)).not.toContain('outcome');
    }
  });
});

describe('Differ adapter — completion callback is navigation only', () => {
  it('parses a well-formed callback', () => {
    const params = new URLSearchParams({ handoffId: 'aeehoff_abc', outcome: 'native-act-finished' });
    expect(parseNativeActionCallback(params)).toEqual({ handoffId: 'aeehoff_abc', outcome: 'native-act-finished' });
  });

  it('rejects a callback with an unrecognised outcome value', () => {
    const params = new URLSearchParams({ handoffId: 'aeehoff_abc', outcome: 'success' });
    expect(parseNativeActionCallback(params)).toBeNull();
  });

  it('rejects a callback missing handoffId', () => {
    const params = new URLSearchParams({ outcome: 'native-act-finished' });
    expect(parseNativeActionCallback(params)).toBeNull();
  });

  it('the parsed callback carries no field beyond the bare outcome enum — nothing that could assert completion', () => {
    const params = new URLSearchParams({ handoffId: 'aeehoff_abc', outcome: 'native-act-finished' });
    const parsed = parseNativeActionCallback(params);
    expect(parsed && Object.keys(parsed).sort()).toEqual(['handoffId', 'outcome']);
  });
});
