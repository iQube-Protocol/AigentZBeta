// @vitest-environment jsdom
/**
 * RegisterAgentPanel — stale-subject-agent race (surgical repair, 2026-09-06).
 *
 * ── THE DEFECT ───────────────────────────────────────────────────────────
 *
 * `agentSlug: initialAgentSlug` used to be copied into `useState(initialAgentSlug
 * ?? PILOT_AGENTS[0].slug)` on first mount — a parent (PilotJourneyTab)
 * correcting its OWN selection in a post-paint effect (a persisted-selection
 * restore) never reached this panel's already-initialized copy. Combined with
 * JourneyRunSurface never remounting this surface on an agent switch, a
 * Factor-scoped Journey observer could permanently render Nakamoto's Agent
 * Card, status checks and receipts.
 *
 * ── THE FIX ──────────────────────────────────────────────────────────────
 *
 * `agentSlug` is now read directly from props every render (no local copy).
 * Every agent-scoped async function (`readProgress`, `pollStatus`, `prepare`)
 * captures the agentSlug it was called with and compares it against an
 * always-current `agentSlugRef` before applying any result. A dedicated
 * effect clears all agent-scoped local state and cancels any pending poll
 * timer the instant `agentSlug` changes.
 *
 * These tests drive the REAL RegisterAgentPanel with deferred, manually-
 * resolvable fetches (mirroring tests/stage-receipts-drawer-stale-response.test.tsx's
 * own pattern) to reproduce the exact race, and assert the panel every time.
 */
import React from 'react';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function fakeJsonResponse(body: Record<string, unknown>, status = 200) {
  const raw = JSON.stringify(body);
  return { ok: status < 400, status, json: async () => body, text: async () => raw } as unknown as Response;
}

vi.mock('@/services/wallet/walletSurfaceRequest', () => ({
  requestWalletSurface: vi.fn(() => 1),
  subscribeWalletSurfaceCompletion: vi.fn(() => () => {}),
  subscribeWalletSurfaceAck: vi.fn(() => () => {}),
}));

vi.mock('@/components/journey/AgentCardSurface', () => ({
  AgentCardSurface: ({ route }: { route: string }) => <div data-testid="agent-card-surface">{route}</div>,
}));

const personaFetchMock = vi.fn(async (url: string) => {
  const u = String(url);
  if (u.includes('/api/wallet/signing-requests')) return fakeJsonResponse({ ok: true, requests: [] });
  if (u.includes('/api/assistant/receipts')) return fakeJsonResponse({ ok: true, receipts: [] });
  if (u.includes('/api/wallet/principal/status')) {
    return fakeJsonResponse({ ok: true, ready: false, capability: 'LEGACY_EVIDENCE_ONLY', controlProven: false });
  }
  if (u.includes('/api/persona/sponsored-agents')) return fakeJsonResponse({ ok: true, agents: [] });
  return fakeJsonResponse({ ok: true });
});
vi.mock('@/utils/personaSpine', () => ({
  personaFetch: (url: string, init?: unknown) => personaFetchMock(url, init),
}));

import { RegisterAgentPanel } from '@/components/journey/RegisterAgentPanel';

afterEach(() => {
  cleanup();
  personaFetchMock.mockClear();
});

describe('RegisterAgentPanel — agentSlug is a genuinely controlled prop', () => {
  it('renders a neutral loading state, never any particular agent, while agentSlug is unresolved (undefined)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => fakeJsonResponse({})));
    render(<RegisterAgentPanel personaId="persona-1" agentSlug={undefined} />);

    expect(screen.getByText(/Resolving agent selection/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Agent to register/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Aigent Nakamoto/i)).not.toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it('switching Nakamoto -> Factor updates the rendered selection to Factor, never staying stuck on Nakamoto', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => fakeJsonResponse({ metadata: { horizen: { tokenId: null, network: null } } })));
    const { rerender } = render(<RegisterAgentPanel personaId="persona-1" agentSlug="nakamoto" />);
    const select = (await screen.findByLabelText(/Agent to register/i)) as HTMLSelectElement;
    expect(select.value).toBe('nakamoto');

    rerender(<RegisterAgentPanel personaId="persona-1" agentSlug="factor" />);
    await waitFor(() => expect(select.value).toBe('factor'));
    vi.unstubAllGlobals();
  });

  it('switching Factor -> Nakamoto updates the rendered selection to Nakamoto, never staying stuck on Factor', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => fakeJsonResponse({ metadata: { horizen: { tokenId: null, network: null } } })));
    const { rerender } = render(<RegisterAgentPanel personaId="persona-1" agentSlug="factor" />);
    const select = (await screen.findByLabelText(/Agent to register/i)) as HTMLSelectElement;
    expect(select.value).toBe('factor');

    rerender(<RegisterAgentPanel personaId="persona-1" agentSlug="nakamoto" />);
    await waitFor(() => expect(select.value).toBe('nakamoto'));
    vi.unstubAllGlobals();
  });

  it('an old (Nakamoto) agent-card response resolving AFTER a newer (Factor) one never overwrites Factor\'s own tokenId', async () => {
    const nakamotoCard = deferred<Response>();
    const factorCard = deferred<Response>();
    let callIndex = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: RequestInfo | URL) => {
        const u = String(url);
        if (u.includes('/agent-card.json')) {
          callIndex += 1;
          return callIndex === 1 ? nakamotoCard.promise : factorCard.promise;
        }
        return fakeJsonResponse({});
      }),
    );

    const { rerender } = render(<RegisterAgentPanel personaId="persona-1" agentSlug="nakamoto" />);
    await waitFor(() => expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(0));

    // Switch to Factor mid-flight — Nakamoto's card request is still pending.
    rerender(<RegisterAgentPanel personaId="persona-1" agentSlug="factor" />);
    await waitFor(() => expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(2));

    // Factor's (newer) request resolves FIRST, with Factor's own tokenId.
    factorCard.resolve(fakeJsonResponse({ metadata: { horizen: { tokenId: 'factor-token-1', network: 'base-sepolia' } } }));
    await waitFor(() => expect(screen.getByText(/factor-token-1/i)).toBeInTheDocument());

    // Nakamoto's (older, superseded) request resolves AFTER Factor's, with a
    // DIFFERENT tokenId — it must never overwrite Factor's own value.
    nakamotoCard.resolve(fakeJsonResponse({ metadata: { horizen: { tokenId: 'nakamoto-token-STALE', network: 'base-sepolia' } } }));
    await new Promise((r) => setTimeout(r, 20));

    expect(screen.getByText(/factor-token-1/i)).toBeInTheDocument();
    expect(screen.queryByText(/nakamoto-token-STALE/i)).not.toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it('one screen never contains two subject agents — the rendered Agent Card route always names the CURRENTLY selected agent only', async () => {
    // The <select> legitimately lists every agent as a CHOICE — that is not
    // the "two agents on screen" defect. The actual bug shape is the ACTIVE
    // content (here, the Agent Card surface's own route) naming a different
    // agent than the one currently selected.
    vi.stubGlobal('fetch', vi.fn(async () => fakeJsonResponse({ metadata: { horizen: { tokenId: null, network: null } } })));
    render(<RegisterAgentPanel personaId="persona-1" agentSlug="nakamoto" />);
    const card = await screen.findByTestId('agent-card-surface');
    expect(card.textContent).toBe('/api/agents/nakamoto/agent-card.json');
    vi.unstubAllGlobals();
  });

  it('one screen never contains two subject agents — after a switch, the Agent Card route follows to the NEW agent only', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => fakeJsonResponse({ metadata: { horizen: { tokenId: null, network: null } } })));
    const { rerender } = render(<RegisterAgentPanel personaId="persona-1" agentSlug="nakamoto" />);
    await screen.findByTestId('agent-card-surface');

    rerender(<RegisterAgentPanel personaId="persona-1" agentSlug="factor" />);
    await waitFor(() => expect(screen.getByTestId('agent-card-surface').textContent).toBe('/api/agents/factor/agent-card.json'));
    vi.unstubAllGlobals();
  });
});
