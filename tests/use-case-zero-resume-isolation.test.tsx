// @vitest-environment jsdom
/**
 * Item 6 behavioral test (2026-09-06 closure round): resume state must be
 * scoped by tenant + authenticated persona + agent — a persona (or tenant)
 * switch on the SAME mounted component must never resume a DIFFERENT
 * identity's in-progress case, and must do so WITHOUT a remount (the fix
 * reacts to usePersonaSpine's own personaSessionToken changing).
 *
 * Exercises the REAL useUseCaseZeroReadiness hook against a real
 * window.localStorage, stubbing only personaFetch/usePersonaSpine (the
 * identity-spine seam) and fetch responses.
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

beforeEach(() => {
  window.localStorage.clear();
  mocks.personaFetch.mockReset();
  mocks.usePersonaSpine.mockReset();
});
afterEach(() => {
  vi.clearAllMocks();
});

describe('item 6 — resume state is scoped by tenant + persona + agent, and reacts to a persona switch without remounting', () => {
  it('writing a resume under persona A does not resume under persona B (same tenant/agent) — no cross-persona leak', async () => {
    mocks.usePersonaSpine.mockReturnValue({ status: 'ready', personaSessionToken: 'persona-A-token' });
    mocks.personaFetch.mockResolvedValue(jsonResponse({ ok: true, readiness: { legs: [], path: 'bring_own_agent' } }));

    const { result, rerender } = renderHook(
      ({ personaToken }: { personaToken: string }) => {
        mocks.usePersonaSpine.mockReturnValue({ status: 'ready', personaSessionToken: personaToken });
        return useUseCaseZeroReadiness({ agentSlug: 'factor', tenantId: 'tenant-1' });
      },
      { initialProps: { personaToken: 'persona-A-token' } },
    );

    // Persona A chooses a path — this writes a persona-A-scoped resume slot.
    await act(async () => {
      await result.current.choosePath('bring_own_agent');
    });
    await waitFor(() => expect(result.current.path).toBe('bring_own_agent'));

    const personaAKeys = Object.keys(window.localStorage).filter((k) => k.startsWith('use-case-zero:'));
    expect(personaAKeys.some((k) => k.includes('persona-A-token'))).toBe(true);

    // SAME mounted hook instance, persona switches to B — must reset,
    // never carry persona A's path/readiness forward, and must NOT read
    // persona A's storage slot (no stored resume exists yet for B).
    act(() => {
      rerender({ personaToken: 'persona-B-token' });
    });

    await waitFor(() => expect(result.current.path).toBeNull());
    expect(result.current.readiness).toBeNull();
    expect(result.current.caseId).toBeUndefined();

    // Persona A's own storage slot is untouched — the switch reset only
    // this hook's in-memory state, never the other identity's stored data.
    expect(window.localStorage.getItem(personaAKeys[0]!)).not.toBeNull();
  });

  it('switching back to a persona with an existing stored resume DOES resume it — proves the effect is keyed on identity, not just "reset on any change"', async () => {
    // Pre-seed a stored resume for persona B directly (as choosePath would).
    window.localStorage.setItem('use-case-zero:tenant-1:persona-B-token:factor', JSON.stringify({ path: 'bring_own_agent', caseId: 'case-b' }));
    mocks.personaFetch.mockResolvedValue(jsonResponse({ ok: true, readiness: { legs: [], path: 'bring_own_agent' } }));

    const { result, rerender } = renderHook(
      ({ personaToken }: { personaToken: string }) => {
        mocks.usePersonaSpine.mockReturnValue({ status: 'ready', personaSessionToken: personaToken });
        return useUseCaseZeroReadiness({ agentSlug: 'factor', tenantId: 'tenant-1' });
      },
      { initialProps: { personaToken: 'persona-A-token' } },
    );

    // Persona A has nothing stored — starts null.
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.path).toBeNull();

    // Switch to persona B (same component instance, no remount) — B's own
    // stored resume must now hydrate.
    act(() => {
      rerender({ personaToken: 'persona-B-token' });
    });
    await waitFor(() => expect(result.current.path).toBe('bring_own_agent'));
    expect(result.current.caseId).toBe('case-b');
  });
});
