// @vitest-environment jsdom
/**
 * Item 2 behavioral test (2026-09-07 closure round): the operator's explicit
 * journeyProfile choice must survive both API boundaries (sent on every
 * readiness/advance POST) and a reload boundary (persisted alongside
 * path/caseId in the resume slot, re-hydrated on the next mount) — never
 * silently reset to 'standard'.
 *
 * Exercises the REAL useUseCaseZeroReadiness hook against real
 * window.localStorage, stubbing only personaFetch/usePersonaSpine.
 */
import { renderHook, waitFor, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  personaFetch: vi.fn(),
  usePersonaSpine: vi.fn(),
}));

vi.mock('@/utils/personaSpine', () => ({
  personaFetch: mocks.personaFetch,
  usePersonaSpine: mocks.usePersonaSpine,
}));

import { useUseCaseZeroReadiness } from '@/services/factor/useUseCaseZeroReadiness';

function jsonResponse(body: unknown) {
  return { json: async () => body } as Response;
}

function lastRequestBody() {
  const call = mocks.personaFetch.mock.calls.at(-1);
  return JSON.parse((call?.[1] as { body: string }).body);
}

beforeEach(() => {
  window.localStorage.clear();
  mocks.personaFetch.mockReset();
  mocks.usePersonaSpine.mockReturnValue({ status: 'ready', personaSessionToken: 'persona-A-token' });
  mocks.personaFetch.mockResolvedValue(jsonResponse({ ok: true, readiness: { legs: [], path: 'bring_own_agent' } }));
});
afterEach(() => {
  vi.clearAllMocks();
});

describe('item 2 — journeyProfile survives the API boundary', () => {
  it('choosePath sends journeyProfile in the readiness request body (defaulting to "standard")', async () => {
    const { result } = renderHook(() => useUseCaseZeroReadiness({ agentSlug: 'factor', tenantId: 'tenant-1' }));
    await act(async () => {
      await result.current.choosePath('bring_own_agent');
    });
    expect(lastRequestBody().journeyProfile).toBe('standard');
  });

  it('setJourneyProfile("financial_intelligence") re-fetches readiness with the new profile in the request body', async () => {
    const { result } = renderHook(() => useUseCaseZeroReadiness({ agentSlug: 'factor', tenantId: 'tenant-1' }));
    await act(async () => {
      await result.current.choosePath('bring_own_agent');
    });
    await act(async () => {
      result.current.setJourneyProfile('financial_intelligence');
      await Promise.resolve();
    });
    await waitFor(() => expect(lastRequestBody().journeyProfile).toBe('financial_intelligence'));
    expect(result.current.journeyProfile).toBe('financial_intelligence');
  });

  it('advance() also sends the currently-selected journeyProfile', async () => {
    mocks.personaFetch.mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('/advance')) {
        return Promise.resolve(jsonResponse({ ok: true, result: { stepTaken: 'x', outcome: 'advanced', detail: 'ok', readiness: { legs: [], path: 'bring_own_agent' }, caseId: 'case-1' } }));
      }
      return Promise.resolve(jsonResponse({ ok: true, readiness: { legs: [], path: 'bring_own_agent' } }));
    });
    const { result } = renderHook(() => useUseCaseZeroReadiness({ agentSlug: 'factor', tenantId: 'tenant-1' }));
    await act(async () => {
      await result.current.choosePath('bring_own_agent');
    });
    act(() => {
      result.current.setJourneyProfile('financial_intelligence');
    });
    await act(async () => {
      await result.current.advance();
    });
    expect(lastRequestBody().journeyProfile).toBe('financial_intelligence');
  });
});

describe('item 2 — journeyProfile survives a reload boundary', () => {
  it('a chosen journeyProfile persists in the resume slot and is re-hydrated by a FRESH hook instance (simulating a page reload)', async () => {
    const first = renderHook(() => useUseCaseZeroReadiness({ agentSlug: 'factor', tenantId: 'tenant-1' }));
    await act(async () => {
      await first.result.current.choosePath('bring_own_agent');
    });
    act(() => {
      first.result.current.setJourneyProfile('financial_intelligence');
    });
    await waitFor(() => expect(first.result.current.journeyProfile).toBe('financial_intelligence'));
    first.unmount();

    // A hard reload tears down all React/module state but never touches
    // localStorage — a brand-new hook instance must re-hydrate the SAME
    // journeyProfile, never silently resetting to 'standard'.
    const second = renderHook(() => useUseCaseZeroReadiness({ agentSlug: 'factor', tenantId: 'tenant-1' }));
    await waitFor(() => expect(second.result.current.path).toBe('bring_own_agent'));
    expect(second.result.current.journeyProfile).toBe('financial_intelligence');
  });

  it('"Start over" (reset) clears the persisted journeyProfile back to "standard"', async () => {
    const { result } = renderHook(() => useUseCaseZeroReadiness({ agentSlug: 'factor', tenantId: 'tenant-1' }));
    await act(async () => {
      await result.current.choosePath('bring_own_agent');
    });
    act(() => {
      result.current.setJourneyProfile('financial_intelligence');
    });
    await waitFor(() => expect(result.current.journeyProfile).toBe('financial_intelligence'));

    act(() => {
      result.current.reset();
    });
    expect(result.current.journeyProfile).toBe('standard');

    const stored = window.localStorage.getItem(
      Object.keys(window.localStorage).find((k) => k.startsWith('use-case-zero:')) ?? '',
    );
    expect(stored).toBeNull();
  });
});
