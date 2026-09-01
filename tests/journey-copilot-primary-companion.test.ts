/**
 * resolvePrimaryCompanionForJourney (services/journey/journeyCopilotResolver.ts)
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
import { resolveJourneyCopilot, resolvePrimaryCompanionForJourney } from '@/services/journey/journeyCopilotResolver';

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
