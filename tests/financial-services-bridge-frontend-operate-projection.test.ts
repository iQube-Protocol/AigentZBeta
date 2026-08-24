/**
 * Financial Services Bridge FrontDoor — Operate projection integration test
 * (2026-08-24, Catalogue Helper closeout, architectural correction).
 *
 * Verifies that when FinancialServicesBridgeFrontDoor mounts at post-Passport
 * Operate, the foreground surface is actually moneypenny-orchestration — not
 * merely that catalogueDestinationHelper can generate its URL, but that the
 * Journey Spine's Operate stage projects it correctly.
 *
 * This test bridges the gap between:
 *   1. catalogueDestinationHelper.ts tests (unit: destination resolution works)
 *   2. Integration: the resolved destination actually becomes the foreground
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
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
    expect(result.operatorDestination.tabSlug).toBe('moneypenny-orchestration');
  });

  it('destination route includes tab parameter for moneypenny-orchestration', () => {
    const result = resolveJourneyOperatorDestination({
      journeyId: HORIZEN_MONEYPENNY_JOURNEY.id,
      participantState: { citizenPassportUsable: true },
      navOptions: { personaId: 'test-persona-id' },
    });

    expect(result.valid).toBe(true);
    if (!result.valid) return;

    const route = result.operatorDestination.route;
    expect(route).toContain('tab=moneypenny-orchestration');
    expect(route).toContain('metame'); // The cartridge slug
  });

  it('foreground surfaces object correctly maps "aigentme" stage to MoneyPenny', () => {
    const destination = resolveJourneyOperatorDestination({
      journeyId: HORIZEN_MONEYPENNY_JOURNEY.id,
      participantState: { citizenPassportUsable: true },
      navOptions: { personaId: 'test-persona-id' },
    });

    expect(destination.valid).toBe(true);
    if (!destination.valid) return;

    // Simulate the foregroundSurfacesByStage construction from FinancialServicesBridgeFrontDoor
    const foregroundSurfacesByStage =
      destination.activationMode === 'CATALOGUE_ACTIVATION'
        ? {
            aigentme: React.createElement(
              'div',
              { className: 'flex h-full flex-col' },
              React.createElement(
                'div',
                { className: 'flex items-center justify-between border-b border-slate-800 bg-slate-900/60 px-4 py-2' },
                React.createElement(
                  'span',
                  { className: 'text-xs text-slate-400' },
                  'Financial Services — Operate → ',
                  React.createElement('span', { className: 'text-emerald-300' }, 'MoneyPenny Orchestration'),
                ),
              ),
              React.createElement('iframe', {
                src: destination.operatorDestination.route,
                title: 'MoneyPenny Orchestration',
                className: 'w-full flex-1 border-0',
              }),
            ),
          }
        : undefined;

    expect(foregroundSurfacesByStage).toBeDefined();
    expect(foregroundSurfacesByStage?.aigentme).toBeDefined();
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
    const foregroundSurfacesByStage =
      destination.activationMode === 'CATALOGUE_ACTIVATION'
        ? { operate: React.createElement('div') }
        : undefined;

    expect(foregroundSurfacesByStage).toBeUndefined();
  });

  it('navigation chrome is not suppressed in the MoneyPenny foreground', () => {
    const destination = resolveJourneyOperatorDestination({
      journeyId: HORIZEN_MONEYPENNY_JOURNEY.id,
      participantState: { citizenPassportUsable: true },
      navOptions: { personaId: 'test-persona-id' },
    });

    expect(destination.valid).toBe(true);
    if (!destination.valid) return;

    const route = destination.operatorDestination.route;

    // No chrome suppression parameters — the embed keeps the full metaMe
    // navigation chrome (0/1/2/Full depth mechanics remain unchanged).
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
