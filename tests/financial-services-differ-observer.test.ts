/**
 * Differ x Financial Services Bridge pilot — observer + external-endpoint
 * canaries.
 *
 * Pure-logic / mocked-Supabase unit tests, same discipline as
 * tests/access-spine.test.ts: no network, no live Supabase, every read
 * boundary the observer composes is mocked so behaviour is deterministic.
 * Split from tests/financial-services-differ-handoff.test.ts because that
 * file mocks the OBSERVER MODULE ITSELF (to isolate handoff binding/replay
 * logic) — one file cannot both exercise the real observer and mock it.
 *
 * Covers:
 *   1. projection reads perform zero writes
 *   2. no T0 identifiers appear anywhere in serialized projection output
 *   3. observing an incomplete/never-resolved journey never fabricates
 *      completion, and performs no writes
 *   4. unavailable signals (a failed passport read) degrade to `false`,
 *      never a guessed `true`
 *   5. Runtime/consequential actions are listed for honesty but are NEVER
 *      offered as handoff-eligible next actions
 *   6. the external projection/handoff-issue endpoints build their response
 *      through an explicit allowlist and resolve the principal via the
 *      identity spine, never a client-asserted personaId
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock every I/O boundary the observer composes ───────────────────────────

const mockReadJourneyResolution = vi.fn();
vi.mock('@/services/journey/stageResolution', () => ({
  readJourneyResolution: (...args: unknown[]) => mockReadJourneyResolution(...args),
}));

const mockLoadPassport = vi.fn();
vi.mock('@/services/identity/passportPrincipal', () => ({
  loadUsableCitizenPassportForAuthProfile: (...args: unknown[]) => mockLoadPassport(...args),
}));

const mockResolveDestination = vi.fn();
vi.mock('@/services/journey/catalogueDestinationHelper', () => ({
  resolveJourneyOperatorDestination: (...args: unknown[]) => mockResolveDestination(...args),
}));

const mockListReceipts = vi.fn();
vi.mock('@/services/receipts/activityReceiptService', () => ({
  listActivityReceiptsForPersona: (...args: unknown[]) => mockListReceipts(...args),
}));

import { resolveFinancialServicesProjection, FS_DIFFER_PROJECTION_SCHEMA_VERSION } from '@/services/financialServices/financialServicesObserver';
import { HORIZEN_MONEYPENNY_JOURNEY } from '@/services/journey/horizenMoneyPennyJourney';

// A fake Supabase admin whose every write-capable method spies on itself —
// used to assert "the observer never writes" directly, not by inference.
function makeSpyAdmin() {
  const insert = vi.fn();
  const update = vi.fn();
  const del = vi.fn();
  const upsert = vi.fn();
  return {
    calls: { insert, update, delete: del, upsert },
    from: vi.fn(() => ({ insert, update, delete: del, upsert, select: vi.fn().mockReturnThis() })),
  } as unknown as import('@supabase/supabase-js').SupabaseClient & {
    calls: { insert: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn>; upsert: ReturnType<typeof vi.fn> };
  };
}

const PRINCIPAL = { personaId: 'persona-aaaa-1111', authProfileId: 'authprofile-bbbb-2222' };

const OPEN_DESTINATION = {
  valid: true as const,
  journeyId: HORIZEN_MONEYPENNY_JOURNEY.id,
  thresholdState: 'POST_PASSPORT' as const,
  activationMode: 'CATALOGUE_ACTIVATION' as const,
  operatorDestination: {
    catalogueItemId: 'moneypenny',
    catalogueSourceCartridge: 'metame',
    cartridgeRef: 'metame-codex',
    cartridgeSlug: 'metame-codex',
    tabId: 'moneypenny-orchestration',
    tabSlug: 'moneypenny-orchestration',
    route: 'https://example.test/embed',
    activationIntent: 'self-activate' as const,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('financialServicesObserver — pure read, no writes', () => {
  it('never calls a write-capable method on the Supabase client it is handed', async () => {
    mockLoadPassport.mockResolvedValue({ ok: false, reason: 'no_passport' });
    mockReadJourneyResolution.mockResolvedValue(null);
    mockResolveDestination.mockReturnValue({
      valid: false,
      journeyId: HORIZEN_MONEYPENNY_JOURNEY.id,
      failedLookup: 'journey-not-registered',
      reason: 'not registered in this fixture',
    });
    mockListReceipts.mockResolvedValue([]);

    const admin = makeSpyAdmin();
    await resolveFinancialServicesProjection(admin, PRINCIPAL);

    expect(admin.calls.insert).not.toHaveBeenCalled();
    expect(admin.calls.update).not.toHaveBeenCalled();
    expect(admin.calls.delete).not.toHaveBeenCalled();
    expect(admin.calls.upsert).not.toHaveBeenCalled();
  });

  it('observing an incomplete/never-resolved journey returns unknown stages, never fabricated completion, and still performs no writes', async () => {
    mockLoadPassport.mockResolvedValue({ ok: false, reason: 'no_passport' });
    mockReadJourneyResolution.mockResolvedValue(null); // never resolved before
    mockResolveDestination.mockReturnValue({
      valid: true,
      journeyId: HORIZEN_MONEYPENNY_JOURNEY.id,
      thresholdState: 'PRE_PASSPORT',
      activationMode: 'PUBLIC_ORIENTATION',
      operatorDestination: OPEN_DESTINATION.operatorDestination,
    });
    mockListReceipts.mockResolvedValue([]);

    const admin = makeSpyAdmin();
    const projection = await resolveFinancialServicesProjection(admin, PRINCIPAL);

    expect(projection.journey.currentStageId).toBeNull();
    for (const stage of projection.journey.stages) {
      expect(stage.status).toBe('unknown');
    }
    // PUBLIC_ORIENTATION (pre-Passport) — no action may be handoff-eligible.
    expect(projection.nextActions.every((a) => a.handoffEligible === false)).toBe(true);

    expect(admin.calls.insert).not.toHaveBeenCalled();
    expect(admin.calls.update).not.toHaveBeenCalled();
  });

  it('an unavailable/failing passport read degrades to false, never a guessed true', async () => {
    mockLoadPassport.mockRejectedValue(new Error('db unreachable'));
    mockReadJourneyResolution.mockResolvedValue(null);
    mockResolveDestination.mockImplementation((input: { participantState: { citizenPassportUsable: boolean } }) => ({
      valid: true,
      journeyId: HORIZEN_MONEYPENNY_JOURNEY.id,
      thresholdState: input.participantState.citizenPassportUsable ? 'POST_PASSPORT' : 'PRE_PASSPORT',
      activationMode: input.participantState.citizenPassportUsable ? 'CATALOGUE_ACTIVATION' : 'PUBLIC_ORIENTATION',
      operatorDestination: OPEN_DESTINATION.operatorDestination,
    }));
    mockListReceipts.mockResolvedValue([]);

    const admin = makeSpyAdmin();
    const projection = await resolveFinancialServicesProjection(admin, PRINCIPAL);
    expect(mockResolveDestination).toHaveBeenCalledWith(
      expect.objectContaining({ participantState: { citizenPassportUsable: false } }),
    );
    expect(projection.nextActions.every((a) => a.handoffEligible === false)).toBe(true);
  });

  it('no T0 identifier (personaId, authProfileId) appears anywhere in the serialized projection', async () => {
    mockLoadPassport.mockResolvedValue({ ok: true, passport: { passportClass: 'citizen', citizenStatus: 'active', participantStatus: 'active', passportGrade: 'standard', revoked: false, expiresAt: null } });
    mockReadJourneyResolution.mockResolvedValue({
      journeyId: HORIZEN_MONEYPENNY_JOURNEY.id,
      journeyVersion: '1.0.0',
      subjectRef: 'moneypenny',
      canonicalStages: ['register', 'claim', 'orient', 'passport'],
      milestones: [],
      highestMilestone: null,
      recordedAt: new Date().toISOString(),
    });
    mockResolveDestination.mockReturnValue(OPEN_DESTINATION);
    mockListReceipts.mockResolvedValue([]);

    const admin = makeSpyAdmin();
    const projection = await resolveFinancialServicesProjection(admin, PRINCIPAL);

    const serialized = JSON.stringify(projection);
    expect(serialized).not.toContain(PRINCIPAL.personaId);
    expect(serialized).not.toContain(PRINCIPAL.authProfileId);
    expect(serialized).not.toMatch(/personaId|authProfileId/i);
    expect(projection.schemaVersion).toBe(FS_DIFFER_PROJECTION_SCHEMA_VERSION);
  });

  it('Runtime services are listed for honesty but are NEVER offered in nextActions', async () => {
    mockLoadPassport.mockResolvedValue({ ok: true, passport: { passportClass: 'citizen', citizenStatus: 'active', participantStatus: 'active', passportGrade: 'standard', revoked: false, expiresAt: null } });
    mockReadJourneyResolution.mockResolvedValue(null);
    mockResolveDestination.mockReturnValue(OPEN_DESTINATION);
    mockListReceipts.mockResolvedValue([]);

    const admin = makeSpyAdmin();
    const projection = await resolveFinancialServicesProjection(admin, PRINCIPAL);

    const runtimeServices = projection.services.filter((s) => s.mode === 'RUNTIME');
    expect(runtimeServices.length).toBeGreaterThan(0); // listed, for honesty
    const runtimeServiceRefs = new Set(runtimeServices.map((s) => s.serviceRef));
    expect(projection.nextActions.some((a) => runtimeServiceRefs.has(a.actionRef))).toBe(false);
    expect(projection.nextActions.every((a) => ['moneypenny.advisor', 'moneypenny.architect'].includes(a.actionRef))).toBe(true);
    // Even with the destination open, every nextAction should be eligible here.
    expect(projection.nextActions.every((a) => a.handoffEligible === true)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Endpoint source discipline — the projection/issue routes must build their
// JSON responses through an explicit allowlist, never `...spread` a broader
// internal object across the external boundary. A source-text scan is the
// same technique tests/moneypenny-catalogue-operate-destination.test.ts uses
// for this class of rule.
// ─────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('external endpoints — explicit allowlist, never a spread pass-through', () => {
  const projectionRoute = readFileSync(
    join(process.cwd(), 'app/api/public/financial-services/projection/route.ts'),
    'utf-8',
  );
  const handoffIssueRoute = readFileSync(
    join(process.cwd(), 'app/api/financial-services/handoffs/route.ts'),
    'utf-8',
  );

  it('the projection endpoint never spreads the observer result directly into the response', () => {
    // Strip comments/doc-blocks first — this file's OWN header prose
    // discusses the forbidden `...projection` pattern as documentation, and
    // a naive scan of the raw source would false-positive on its own
    // explanation. Only actual code is checked.
    const code = projectionRoute.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/\.\.\.projection\b/);
    expect(code).not.toMatch(/\.\.\.result\b/);
    // Every top-level field is assigned explicitly.
    for (const field of ['schemaVersion', 'projectionId', 'generatedAt', 'expiresAt', 'journey', 'services', 'nextActions']) {
      expect(code).toContain(`${field}:`);
    }
  });

  it('the projection endpoint requires the Differ integration key AND resolves the principal via the identity spine (getActivePersona) — never a client-asserted personaId', () => {
    expect(projectionRoute).toContain('DIFFER_INTEGRATION_API_KEY');
    expect(projectionRoute).toContain('getActivePersona(req)');
    expect(projectionRoute).not.toMatch(/body\.personaId|params\.personaId|searchParams\.get\(['"]personaId['"]\)/);
  });

  it('the handoff issuance endpoint accepts only actionRef + returnUrl from the client body — never capabilityRef/nativeSurfaceRef/journeyId', () => {
    expect(handoffIssueRoute).toMatch(/actionRef\?:\s*string/);
    expect(handoffIssueRoute).toMatch(/returnUrl\?:\s*string/);
    expect(handoffIssueRoute).not.toMatch(/body\.capabilityRef|body\.nativeSurfaceRef|body\.journeyId/);
  });

  it('the projection endpoint always responds Cache-Control: no-store', () => {
    const noStoreCount = (projectionRoute.match(/'Cache-Control':\s*'no-store'/g) ?? []).length;
    expect(noStoreCount).toBeGreaterThanOrEqual(4); // every response branch (401 x2, 503, 500, 200)
  });
});
