// @vitest-environment jsdom
/**
 * journeyStateRefreshRequest — the cross-frame "please re-read canonical
 * Journey state now" bridge (Factor Operate blocker, 2026-09-06).
 *
 * `aigentme-welcome` is a `kind: 'embed'` surface (journeySurfaceRegistry.ts)
 * — AigentMeWelcomeSplitTab runs in its own iframe, a genuinely different
 * realm from JourneyRunSurface, so the in-process `requestStateRefresh` prop
 * RegisterAgentPanel/AgreementRatifyPanel use cannot reach it. These tests
 * prove both ends of the replacement mechanism:
 *
 *   1. AigentMeFocusDispositionPrompt (the real ceremony component) posts
 *      the refresh request ONLY after a real, server-confirmed POST success
 *      — never on error, never before the response resolves.
 *   2. JourneyRunSurface (the real component) re-reads canonical state the
 *      instant it receives that request — the SAME `refresh()` every other
 *      trigger (mount, manual button, personaSpine transition) already uses.
 */
import React from 'react';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

// jsdom has no ResizeObserver — JourneyRunSurface's carousel-overflow
// measurement uses one purely for layout bookkeeping, irrelevant here.
(global as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}

function fakeJsonResponse(body: Record<string, unknown>, status = 200) {
  const raw = JSON.stringify(body);
  return { ok: status < 400, status, json: async () => body, text: async () => raw } as unknown as Response;
}

// Shared, controllable router — one mock covers both the disposition prompt
// tests and the JourneyRunSurface state-fetch test, since they hit disjoint
// endpoints; a single static `vi.mock` avoids the module-cache fragility of
// re-mocking a shared dependency mid-file.
let dispositionPostShouldSucceed = true;
const stateFetchCalls: string[] = [];

const personaFetchMock = vi.fn(async (url: string, init?: RequestInit) => {
  const u = String(url);
  if (u.includes('/api/journey/') && u.includes('/state')) {
    stateFetchCalls.push(u);
    return fakeJsonResponse({
      state: {
        journeyId: 'horizen-moneypenny',
        journeyVersion: '1',
        subjectRef: 'factor',
        currentStageId: 'aigentme',
        complete: false,
        stages: [
          {
            stageId: 'aigentme',
            state: 'IN_PROGRESS',
            evidencePresent: [],
            evidenceMissing: ['aigentMeActive', 'focusDispositionRecorded'],
            receiptRefs: [],
          },
        ],
      },
    });
  }
  if (u.includes('/aigentme/disposition')) {
    if (!init?.method) return fakeJsonResponse({ ok: true, disposition: null });
    if (init.method === 'POST') {
      return dispositionPostShouldSucceed
        ? fakeJsonResponse({ ok: true, disposition: 'central', receiptId: 'receipt-1' })
        : fakeJsonResponse({ ok: false, error: 'write failed' }, 500);
    }
  }
  return fakeJsonResponse({ ok: true });
});

vi.mock('@/utils/personaSpine', () => ({
  personaFetch: (url: string, init?: RequestInit) => personaFetchMock(url, init),
  usePersonaSpine: () => ({ personaId: 'persona-operator-1' }),
}));

vi.mock('@/components/journey/JourneyCopilotHost', () => ({ JourneyCopilotHost: () => null }));
vi.mock('@/components/persona/ActivePersonaControl', () => ({
  ActivePersonaControl: () => <div data-testid="active-persona-control" />,
}));

import { AigentMeFocusDispositionPrompt } from '@/components/journey/AigentMeFocusDispositionPrompt';
import { subscribeJourneyStateRefreshRequest, requestJourneyStateRefresh } from '@/services/journey/journeyStateRefreshRequest';
import { JourneyRunSurface } from '@/components/journey/JourneyRunSurface';
import { HORIZEN_MONEYPENNY_JOURNEY } from '@/services/journey/horizenMoneyPennyJourney';

beforeEach(() => {
  dispositionPostShouldSucceed = true;
  stateFetchCalls.length = 0;
  personaFetchMock.mockClear();
});

afterEach(() => {
  cleanup();
});

describe('AigentMeFocusDispositionPrompt — requests a refresh only after a server-CONFIRMED write', () => {
  it('posts the refresh request after a successful disposition POST, carrying the agentSlug', async () => {
    const received: { reason: string; agentSlug?: string }[] = [];
    const unsubscribe = subscribeJourneyStateRefreshRequest((req) => received.push(req));

    render(<AigentMeFocusDispositionPrompt agentSlug="factor" agentLabel="Aigent Factor" />);
    await waitFor(() => expect(screen.getByText(/Central to my ExperienceQube/i)).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByText(/Central to my ExperienceQube/i));
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => expect(received.length).toBeGreaterThan(0));
    expect(received[0].reason).toBe('aigentme-disposition-recorded');
    expect(received[0].agentSlug).toBe('factor');

    unsubscribe();
  });

  it('does NOT request a refresh when the write fails — never on an unconfirmed attempt', async () => {
    dispositionPostShouldSucceed = false;
    const received: unknown[] = [];
    const unsubscribe = subscribeJourneyStateRefreshRequest((req) => received.push(req));

    render(<AigentMeFocusDispositionPrompt agentSlug="factor" agentLabel="Aigent Factor" />);
    await waitFor(() => expect(screen.getByText(/Central to my ExperienceQube/i)).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByText(/Central to my ExperienceQube/i));
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => expect(screen.getByText(/write failed/i)).toBeInTheDocument());
    expect(received).toHaveLength(0);

    unsubscribe();
  });
});

describe('JourneyRunSurface — re-reads canonical state the instant an embedded surface requests it', () => {
  it('a journeyStateRefreshRequest triggers the SAME refresh() as every other trigger — an extra state fetch, no remount required', async () => {
    const aigentmeStage = HORIZEN_MONEYPENNY_JOURNEY.stages.find((s) => s.id === 'aigentme')!;
    const singleStageJourney = { ...HORIZEN_MONEYPENNY_JOURNEY, stages: [aigentmeStage] };

    render(
      <JourneyRunSurface
        journey={singleStageJourney}
        stateUrl="/api/journey/moneypenny-horizen/state"
        personaId="persona-operator-1"
        headerLabel="Horizen"
        components={{}}
      />,
    );

    await waitFor(() => expect(stateFetchCalls.length).toBeGreaterThanOrEqual(1));
    const callsBeforeRequest = stateFetchCalls.length;

    act(() => {
      requestJourneyStateRefresh('aigentme-disposition-recorded', 'factor');
    });

    await waitFor(() => expect(stateFetchCalls.length).toBeGreaterThan(callsBeforeRequest));
  });
});
