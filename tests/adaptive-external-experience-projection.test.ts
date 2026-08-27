/**
 * services/adaptive/externalExperienceProjection.ts — composition-seam
 * canaries, plus source-authority checks on the two AEE-namespaced routes
 * (operator ruling, 2026-08-27, Differ FS pilot reconciliation).
 *
 * Covers:
 *   - manifest topology (MoneyPenny services) is NOT duplicated by this
 *     seam — it is read verbatim from applicationProjectionManifest.ts
 *   - manifest dispositions override the generic journeySpineAdapter default
 *     for journey-stage capabilities
 *   - Runtime appears in the composed CONTEXT (nativeHandoffAllowed: true,
 *     matching the manifest's "potentially yes in the general AEE model")
 *     — its exclusion from THIS PILOT happens one layer up, at the
 *     integration allowlist (see adaptive-external-integration-registry.test.ts)
 *   - the projection/handoff routes fail closed while the integration is
 *     disabled, and build their responses through an explicit allowlist
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockReadJourneyResolution = vi.fn();
vi.mock('@/services/journey/stageResolution', () => ({
  readJourneyResolution: (...args: unknown[]) => mockReadJourneyResolution(...args),
}));

const mockResolveDestination = vi.fn();
vi.mock('@/services/journey/catalogueDestinationHelper', () => ({
  resolveJourneyOperatorDestination: (...args: unknown[]) => mockResolveDestination(...args),
}));

import { buildExternalExperienceProjection } from '@/services/adaptive/externalExperienceProjection';
import {
  FINANCIAL_SERVICES_APPLICATION_PROJECTION_MANIFEST,
  MONEYPENNY_SERVICE_ROUTES,
} from '@/services/adaptive/applicationProjectionManifest';
import { HORIZEN_MONEYPENNY_JOURNEY } from '@/services/journey/horizenMoneyPennyJourney';

beforeEach(() => {
  vi.clearAllMocks();
  mockReadJourneyResolution.mockResolvedValue(null);
  mockResolveDestination.mockReturnValue({
    valid: true,
    journeyId: HORIZEN_MONEYPENNY_JOURNEY.id,
    thresholdState: 'POST_PASSPORT',
    activationMode: 'CATALOGUE_ACTIVATION',
    operatorDestination: {
      catalogueItemId: 'moneypenny',
      catalogueSourceCartridge: 'metame',
      cartridgeRef: 'metame-codex',
      cartridgeSlug: 'metame-codex',
      tabId: 'moneypenny-orchestration',
      tabSlug: 'moneypenny-orchestration',
      route: 'https://example.test/embed',
      activationIntent: 'self-activate',
    },
  });
});

function admin() {
  return { from: vi.fn(() => ({ insert: vi.fn(), update: vi.fn(), select: vi.fn().mockReturnThis() })) } as unknown as import('@supabase/supabase-js').SupabaseClient;
}

describe('buildExternalExperienceProjection — manifest composition', () => {
  it('includes every MONEYPENNY_SERVICE_ROUTES entry as a capability, verbatim, never restated', async () => {
    const result = await buildExternalExperienceProjection(admin(), {
      journeyDefinition: HORIZEN_MONEYPENNY_JOURNEY,
      aigentQubeId: 'aigentqube-1',
      participantRef: 'participant-1',
      participantState: { citizenPassportUsable: true },
      manifest: FINANCIAL_SERVICES_APPLICATION_PROJECTION_MANIFEST,
      hostId: 'differ',
      generatedAt: new Date().toISOString(),
    });

    for (const service of MONEYPENNY_SERVICE_ROUTES) {
      const ref = result.context.capabilityRefs.find((c) => c.capabilityId === service.serviceId);
      expect(ref, `expected ${service.serviceId} to be present`).toBeDefined();
      expect(ref?.disposition).toEqual(service.disposition);
    }
  });

  it('Runtime is present in the CONTEXT with nativeHandoffAllowed:true (the general-model truth) — its pilot exclusion is a separate, later decision', async () => {
    const result = await buildExternalExperienceProjection(admin(), {
      journeyDefinition: HORIZEN_MONEYPENNY_JOURNEY,
      aigentQubeId: 'aigentqube-1',
      participantRef: 'participant-1',
      participantState: { citizenPassportUsable: true },
      manifest: FINANCIAL_SERVICES_APPLICATION_PROJECTION_MANIFEST,
      hostId: 'differ',
      generatedAt: new Date().toISOString(),
    });
    const runtime = result.context.capabilityRefs.find((c) => c.capabilityId === 'moneypenny.runtime');
    expect(runtime?.disposition.nativeHandoffAllowed).toBe(true);
    expect(runtime?.disposition.externalRenderAllowed).toBe(false);
    expect(runtime?.disposition.externalExecuteAllowed).toBe(false);
  });

  it('journey-stage capability dispositions are OVERRIDDEN by the manifest, not left at journeySpineAdapter\'s generic default', async () => {
    const result = await buildExternalExperienceProjection(admin(), {
      journeyDefinition: HORIZEN_MONEYPENNY_JOURNEY,
      aigentQubeId: 'aigentqube-1',
      participantRef: 'participant-1',
      participantState: { citizenPassportUsable: true },
      manifest: FINANCIAL_SERVICES_APPLICATION_PROJECTION_MANIFEST,
      hostId: 'differ',
      generatedAt: new Date().toISOString(),
    });
    const standing = result.context.capabilityRefs.find((c) => c.capabilityId === 'standing');
    const route = FINANCIAL_SERVICES_APPLICATION_PROJECTION_MANIFEST.routes.find((r) => r.stageId === 'standing');
    expect(standing?.disposition).toEqual(route?.disposition);
  });

  it('the composed context carries no T0 identifier', async () => {
    const result = await buildExternalExperienceProjection(admin(), {
      journeyDefinition: HORIZEN_MONEYPENNY_JOURNEY,
      aigentQubeId: 'aigentqube-1',
      participantRef: 'participant-1',
      participantState: { citizenPassportUsable: true },
      manifest: FINANCIAL_SERVICES_APPLICATION_PROJECTION_MANIFEST,
      hostId: 'differ',
      generatedAt: new Date().toISOString(),
    });
    expect(JSON.stringify(result.context)).not.toMatch(/personaId|authProfileId/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Route source-authority checks — mirrors the technique
// tests/moneypenny-catalogue-operate-destination.test.ts uses.
// ─────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('AEE-namespaced routes — fail-closed auth, explicit allowlist', () => {
  const projectionRoute = readFileSync(join(process.cwd(), 'app/api/adaptive/financial-services/projection/route.ts'), 'utf-8');
  const handoffIssueRoute = readFileSync(join(process.cwd(), 'app/api/adaptive/financial-services/handoffs/route.ts'), 'utf-8');
  const handoffRedeemRoute = readFileSync(
    join(process.cwd(), 'app/api/adaptive/financial-services/handoffs/[handoffId]/redeem/route.ts'),
    'utf-8',
  );

  it('the projection route no longer references DIFFER_INTEGRATION_API_KEY — auth is the integration registry, not a shared secret', () => {
    expect(projectionRoute).not.toContain('DIFFER_INTEGRATION_API_KEY');
    expect(handoffIssueRoute).not.toContain('DIFFER_INTEGRATION_API_KEY');
  });

  it('the projection route checks the integration registry and fails closed on !enabled', () => {
    expect(projectionRoute).toContain('resolveExternalExperienceIntegration');
    expect(projectionRoute).toMatch(/!integration\s*\|\|\s*!integration\.enabled/);
  });

  it('the projection route resolves the principal via the identity spine (getActivePersona) — never a client-asserted personaId', () => {
    expect(projectionRoute).toContain('getActivePersona(req)');
    expect(projectionRoute).not.toMatch(/body\.personaId|params\.personaId|searchParams\.get\(['"]personaId['"]\)/);
  });

  it('the projection route filters the outgoing projection through filterProjectionForIntegration — never the raw internal projection', () => {
    expect(projectionRoute).toContain('filterProjectionForIntegration');
  });

  it('the projection route builds its JSON response through an explicit field list, never a spread of the internal projection', () => {
    const code = projectionRoute.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/\.\.\.projection\b/);
    expect(code).not.toMatch(/\.\.\.result\b/);
    for (const field of ['projectionId', 'provider', 'level', 'surfaces']) {
      expect(code).toContain(`${field}:`);
    }
  });

  it('the projection route always responds Cache-Control: no-store', () => {
    const noStoreCount = (projectionRoute.match(/'Cache-Control':\s*'no-store'/g) ?? []).length;
    expect(noStoreCount).toBeGreaterThanOrEqual(4);
  });

  it('the handoff issue route accepts only capabilityId + returnUrl from the client body', () => {
    expect(handoffIssueRoute).toMatch(/capabilityId\?:\s*unknown/);
    expect(handoffIssueRoute).toMatch(/returnUrl\?:\s*unknown/);
    expect(handoffIssueRoute).not.toMatch(/body\.nativeSurfaceRef|body\.journeyId|body\.principalPublicRef/);
  });

  it('the redeem route never asserts an "executed"/"outcome" field on its own response — only a navigation destination', () => {
    const code = handoffRedeemRoute.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/executed:\s*true/);
    expect(code).toContain('route,');
  });
});
