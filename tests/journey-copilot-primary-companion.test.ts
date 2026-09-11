/**
 * resolvePrimaryCompanionForJourney (services/journey/primaryCompanionResolver.ts)
 * — AEE-XP-001 §10/XP-5 additive resolver (2026-09-01): "the current role
 * occupant is resolved from canonical persona assignment, never guessed from
 * surface-local configuration." Pins that it (1) never touches
 * `resolveJourneyCopilot`'s existing pure/sync contract, (2) overrides the
 * static cartridge default only when a REAL assignment resolves, and (3)
 * fails open to the static default on any resolution gap/error.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';
import type { JourneyDefinition } from '@/types/journey';

vi.mock('@/services/agents/aigentMeRoleResolution', () => ({
  resolveAigentMeIdentity: vi.fn(),
  DEFAULT_AIGENT_ME_IDENTITY: { personaKey: 'aigent-me', specialistId: null, displayLabel: 'aigentMe', agentRootId: null },
}));

import { resolveAigentMeIdentity } from '@/services/agents/aigentMeRoleResolution';
import { resolveJourneyCopilot } from '@/services/journey/journeyCopilotResolver';
import { resolvePrimaryCompanionForJourney } from '@/services/journey/primaryCompanionResolver';
import { KNYTS_BRIDGE_CROSSING_JOURNEY } from '@/services/journey/knytsBridgeCrossingJourney';
import { CONSTITUTIONAL_INTERNET_BRIDGE_JOURNEY } from '@/services/journey/constitutionalInternetBridgeJourney';
import { HORIZEN_MONEYPENNY_JOURNEY } from '@/services/journey/horizenMoneyPennyJourney';

const mockResolveAigentMeIdentity = vi.mocked(resolveAigentMeIdentity);

const CI_JOURNEY: JourneyDefinition = {
  id: 'constitutional-internet-bridge',
  version: '1.0.0',
  label: 'test',
  subjectRef: 'visitor',
  copilot: { cartridgeSlug: 'metame' },
  stages: [],
};

function fakeRequest(): NextRequest {
  return {} as NextRequest;
}

describe('resolvePrimaryCompanionForJourney', () => {
  beforeEach(() => {
    mockResolveAigentMeIdentity.mockReset();
  });

  it('falls back to the static cartridge default when no real assignment resolves (default identity)', async () => {
    mockResolveAigentMeIdentity.mockResolvedValue({
      personaKey: 'aigent-me',
      specialistId: null,
      displayLabel: 'aigentMe',
      agentRootId: null,
    });
    const fallback = resolveJourneyCopilot(CI_JOURNEY);
    const resolved = await resolvePrimaryCompanionForJourney(fakeRequest(), CI_JOURNEY);
    expect(resolved).toEqual(fallback);
  });

  it('overrides with the real assigned companion identity when one resolves', async () => {
    mockResolveAigentMeIdentity.mockResolvedValue({
      personaKey: 'aigent-aletheon',
      specialistId: null,
      displayLabel: 'Aletheon',
      agentRootId: 'agent-root-123',
    });
    const resolved = await resolvePrimaryCompanionForJourney(fakeRequest(), CI_JOURNEY);
    expect(resolved.agent).toEqual({ id: 'aigent-aletheon', name: 'Aletheon' });
    // accent/prompt/quickPrompts still come from the journey's own cartridge
    // config — overriding the companion identity never invents a new accent.
    const fallback = resolveJourneyCopilot(CI_JOURNEY);
    expect(resolved.accentColor).toBe(fallback.accentColor);
  });

  it('fails open to the static default when resolution throws', async () => {
    mockResolveAigentMeIdentity.mockRejectedValue(new Error('boom'));
    const fallback = resolveJourneyCopilot(CI_JOURNEY);
    const resolved = await resolvePrimaryCompanionForJourney(fakeRequest(), CI_JOURNEY);
    expect(resolved).toEqual(fallback);
  });

  it('never changes resolveJourneyCopilot itself — still pure/sync, still throws on an unresolvable cartridge', () => {
    expect(() =>
      resolveJourneyCopilot({ ...CI_JOURNEY, copilot: { cartridgeSlug: 'no-such-cartridge' } }),
    ).toThrow();
  });
});

describe('resolvePrimaryCompanionForJourney — real KNYTS/CI/FS journey integration (AEE-XP-001 §10/XP-5)', () => {
  beforeEach(() => {
    mockResolveAigentMeIdentity.mockReset();
  });

  const REAL_JOURNEYS = [
    ['KNYTS Bridge', KNYTS_BRIDGE_CROSSING_JOURNEY],
    ['Constitutional Internet Bridge', CONSTITUTIONAL_INTERNET_BRIDGE_JOURNEY],
    ['Horizen MoneyPenny (Financial Services Bridge)', HORIZEN_MONEYPENNY_JOURNEY],
  ] as const;

  it.each(REAL_JOURNEYS)(
    '%s: shows the canonical assigned aigentMe occupant when resolveAigentMeIdentity resolves a real assignment',
    async (_label, journey) => {
      mockResolveAigentMeIdentity.mockResolvedValue({
        personaKey: 'aigent-aletheon',
        specialistId: null,
        displayLabel: 'Aletheon',
        agentRootId: 'agent-root-real-assignment',
      });
      const staticDefault = resolveJourneyCopilot(journey);
      const resolved = await resolvePrimaryCompanionForJourney(fakeRequest(), journey);
      expect(resolved.agent).toEqual({ id: 'aigent-aletheon', name: 'Aletheon' });
      // The journey's own accent/prompt/quickPrompts never change — only WHO
      // is shown as speaking changes (specialist agents remain distinct).
      expect(resolved.accentColor).toBe(staticDefault.accentColor);
      expect(resolved.promptPlaceholder).toBe(staticDefault.promptPlaceholder);
      expect(resolved.quickPrompts).toBe(staticDefault.quickPrompts);
    },
  );

  it.each(REAL_JOURNEYS)(
    '%s: remains UNCHANGED (the journey\'s own static specialist copilot) when no real assignment resolves',
    async (_label, journey) => {
      mockResolveAigentMeIdentity.mockResolvedValue({
        personaKey: 'aigent-me',
        specialistId: null,
        displayLabel: 'aigentMe',
        agentRootId: null,
      });
      const staticDefault = resolveJourneyCopilot(journey);
      const resolved = await resolvePrimaryCompanionForJourney(fakeRequest(), journey);
      expect(resolved).toEqual(staticDefault);
    },
  );
});
