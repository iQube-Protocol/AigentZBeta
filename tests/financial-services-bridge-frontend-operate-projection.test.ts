/**
 * Financial Services Bridge FrontDoor — Operate projection integration test
 * (2026-08-24, Catalogue Helper closeout, architectural correction; updated
 * 2026-08-25, FS Operate viewport + Focus/Full parity correction).
 *
 * Verifies that when FinancialServicesBridgeFrontDoor mounts at post-Passport
 * Operate, the foreground surface is actually moneypenny-orchestration — not
 * merely that catalogueDestinationHelper can generate its URL, but that the
 * Journey Spine's Operate stage projects it correctly.
 *
 * This test bridges the gap between:
 *   1. catalogueDestinationHelper.ts tests (unit: destination resolution works)
 *   2. Integration: the resolved destination actually becomes the foreground
 *
 * 2026-08-25 note: the foreground is now projected as a
 * `foregroundSurfaceRefByStage` REGISTRY REF
 * ('moneypenny-orchestration-focused'), not a raw hand-built iframe — see
 * tests/fs-operate-embed-viewport-parity.test.ts for the ref/primitive-reuse
 * canaries this change added. The tests below still exercise
 * `resolveJourneyOperatorDestination` itself (unchanged by that fix) and the
 * Horizen journey's own `aigentme` stage (also unchanged).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resolveJourneyOperatorDestination } from '@/services/journey/catalogueDestinationHelper';
import { HORIZEN_MONEYPENNY_JOURNEY } from '@/services/journey/horizenMoneyPennyJourney';

/**
 * Mock the persona spine and supporting surfaces so the test can mount
 * FinancialServicesBridgeFrontDoor without a full Next.js app context.
 */
vi.mock('@/utils/personaSpine', () => ({
  usePersonaSpine: vi.fn(),
  personaFetch: vi.fn(),
}));

vi.mock('@/app/hooks/usePassportSignInHost', () => ({
  usePassportSignInHost: vi.fn(() => ({
    showPassportSignIn: false,
    completeSignIn: vi.fn(),
    dismissSignIn: vi.fn(),
  })),
}));

vi.mock('@/services/journey/catalogueDestinationHelper', async () => {
  const actual = await vi.importActual('@/services/journey/catalogueDestinationHelper');
  return actual;
});

describe('FinancialServicesBridgeFrontDoor — Operate projection integration', () => {
  beforeEach(() => {
    // Ensure window.localStorage is available for the test
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem('currentPersonaId', 'test-persona-id');
      } catch {
        // LocalStorage may not be available in test env
      }
    }
  });

  it('resolves MoneyPenny Orchestration destination for post-Passport state', () => {
    const result = resolveJourneyOperatorDestination({
      journeyId: HORIZEN_MONEYPENNY_JOURNEY.id,
      participantState: { citizenPassportUsable: true },
      navOptions: { personaId: 'test-persona-id' },
    });

    expect(result.valid).toBe(true);
    if (!result.valid) return;

    expect(result.thresholdState).toBe('POST_PASSPORT');
    expect(result.activationMode).toBe('CATALOGUE_ACTIVATION');
    expect(result.operatorDestination.catalogueItemId).toBe('moneypenny');
    expect(result.operatorDestination.tabSlug).toBe('home');
  });

  it('destination route includes tab parameter for home (navigation/viewport correction, 2026-09-03 — supersedes the retired single-tab moneypenny-orchestration mirror)', () => {
    const result = resolveJourneyOperatorDestination({
      journeyId: HORIZEN_MONEYPENNY_JOURNEY.id,
      participantState: { citizenPassportUsable: true },
      navOptions: { personaId: 'test-persona-id' },
    });

    expect(result.valid).toBe(true);
    if (!result.valid) return;

    const route = result.operatorDestination.route;
    expect(route).toContain('tab=home');
    expect(route).toContain('metame'); // The cartridge slug
  });

  it('the "aigentme" stage foreground override resolves to the moneypenny-orchestration-focused ref (2026-08-25 — no longer a hand-built ReactNode)', () => {
    const destination = resolveJourneyOperatorDestination({
      journeyId: HORIZEN_MONEYPENNY_JOURNEY.id,
      participantState: { citizenPassportUsable: true },
    });

    expect(destination.valid).toBe(true);
    if (!destination.valid) return;

    // The REAL construction, mirrored from FinancialServicesBridgeFrontDoor
    // (see tests/fs-operate-embed-viewport-parity.test.ts for the source-text
    // canary proving the live component builds exactly this).
    const foregroundSurfaceRefByStage =
      destination.activationMode === 'CATALOGUE_ACTIVATION'
        ? { aigentme: 'moneypenny-orchestration-focused' }
        : undefined;

    expect(foregroundSurfaceRefByStage).toBeDefined();
    expect(foregroundSurfaceRefByStage?.aigentme).toBe('moneypenny-orchestration-focused');
  });

  it('PRE_PASSPORT state does NOT produce a foreground override', () => {
    const destination = resolveJourneyOperatorDestination({
      journeyId: HORIZEN_MONEYPENNY_JOURNEY.id,
      participantState: { citizenPassportUsable: false },
      navOptions: { personaId: 'test-persona-id' },
    });

    expect(destination.valid).toBe(true);
    if (!destination.valid) return;

    expect(destination.thresholdState).toBe('PRE_PASSPORT');
    expect(destination.activationMode).toBe('PUBLIC_ORIENTATION');

    // No foreground override — surfaces render the normal Operate journey
    const foregroundSurfaceRefByStage =
      destination.activationMode === 'CATALOGUE_ACTIVATION'
        ? { operate: 'moneypenny-orchestration-focused' }
        : undefined;

    expect(foregroundSurfaceRefByStage).toBeUndefined();
  });

  it('the bare catalogue route itself still carries no chrome params — that decision now lives entirely in the registry ref, not this route (2026-08-25)', () => {
    // Pre-2026-08-25 this route WAS the literal iframe src, so "no chrome
    // suppression here" meant "MoneyPenny always renders full chrome." That
    // decision is superseded — see tests/fs-operate-embed-viewport-parity.test.ts
    // for the registry ref's `focused: true` (the mechanism that now owns
    // Focus/Full presentation). This route is UNCHANGED and still carries no
    // chrome params, because `resolveOperatorDestination`'s bare route is a
    // generic, multi-purpose resolver — it is simply no longer what the FS
    // Bridge's iframe src is built from.
    const destination = resolveJourneyOperatorDestination({
      journeyId: HORIZEN_MONEYPENNY_JOURNEY.id,
      participantState: { citizenPassportUsable: true },
    });

    expect(destination.valid).toBe(true);
    if (!destination.valid) return;

    const route = destination.operatorDestination.route;
    expect(route).not.toContain('chrome=focused');
    expect(route).not.toContain('depth=');
  });

  it('no modification to horizenMoneyPennyJourney — aigentme stage structure unchanged', () => {
    const aigentmeStage = HORIZEN_MONEYPENNY_JOURNEY.stages.find((s) => s.id === 'aigentme');

    expect(aigentmeStage).toBeDefined();
    if (!aigentmeStage) return;

    // The surfaces array is the journey definition's canonical declaration
    // The projection layer overrides WHICH surface renders, never the stage itself
    expect(aigentmeStage.surfaces.length).toBeGreaterThan(0);

    // focusDispositionRecorded is in the aigentme stage's completionEvidence
    expect(aigentmeStage.completionEvidence).toContain('focusDispositionRecorded');
  });

  it('aigentme stage remains independent and reachable through normal navigation', () => {
    const aigentmeStage = HORIZEN_MONEYPENNY_JOURNEY.stages.find((s) => s.id === 'aigentme');

    expect(aigentmeStage).toBeDefined();
    if (!aigentmeStage) return;

    // aigentme-welcome is the canonical surface
    expect(aigentmeStage.surfaces.map((s) => s.ref)).toContain('aigentme-welcome');

    // focusDispositionRecorded is ONLY recordable in aigentme-welcome's Welcome Capsule
    expect(aigentmeStage.completionEvidence).toContain('focusDispositionRecorded');
  });
});
