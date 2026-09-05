// @vitest-environment jsdom
/**
 * Register layout diagnosis — the header's Evidence popover vs. the
 * scrollable stage body (GJR audit, 2026-09-05).
 *
 * Ground truth (reported by the operator via screenshot, reasoned about
 * here since live re-viewing isn't available): with the header's "Evidence
 * N/M" popover open on the Register stage, and the body scrolled,
 * RegisterAgentPanel's "This wallet is quarantined and cannot become your
 * principal" warning visually overlapped StageReceiptsDrawer's own inline
 * "Evidence (N)" / "Historical / supplementary receipts" text.
 *
 * Root cause (confirmed by direct read of JourneyRunSurface.tsx): the
 * header — including the Evidence popover's positioned ancestor — sits
 * OUTSIDE and ABOVE the stage body's own `overflow-y-auto` scroll
 * container. The popover is `position: absolute` with no clipping
 * ancestor and `z-20`, so once open it renders at a fixed screen position
 * regardless of how far the body underneath has scrolled — exactly what
 * produces the reported overlap.
 *
 * jsdom does not perform real layout — `getBoundingClientRect()` returns
 * all-zero rects for every element here, so a bounding-rect "do these two
 * rects intersect" assertion would always trivially pass/fail without
 * proving anything about actual visual overlap. That is stated explicitly
 * rather than fabricated: this test instead proves the BEHAVIORAL fix
 * directly — the exact mechanism that prevents the two from ever being
 * simultaneously visible — using the REAL components (JourneyRunSurface,
 * RegisterAgentPanel, AgentCardSurface, StageReceiptsDrawer, the real
 * Register JourneyStageDefinition and JOURNEY_SURFACES registry entry).
 */
import React from 'react';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

// jsdom has no ResizeObserver — JourneyRunSurface's carousel-overflow
// measurement uses one purely for layout bookkeeping, irrelevant here.
(global as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
// jsdom has no real layout, so it also has no scrollIntoView.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}

// Every fake response needs BOTH `.json()` and `.text()` — readJsonOrExplain
// (used by JourneyRunSurface's own state fetch and RegisterAgentPanel's
// receipt reads) always reads the body via `.text()` first.
function fakeJsonResponse(body: Record<string, unknown>, status = 200) {
  const raw = JSON.stringify(body);
  return { ok: status < 400, status, json: async () => body, text: async () => raw };
}

// ── personaFetch: one router covering every call this render tree makes ──
const personaFetchMock = vi.fn(async (url: string) => {
  const u = String(url);
  if (u.includes('/api/journey/') && u.includes('/state')) {
    return fakeJsonResponse({
      state: {
        journeyId: 'horizen-moneypenny',
        journeyVersion: '1',
        subjectRef: 'moneypenny',
        currentStageId: 'register',
        complete: false,
        stages: [
          {
            stageId: 'register',
            state: 'READY',
            evidencePresent: ['aigentQubeResolved'],
            evidenceMissing: ['tokenId', 'registryRereadOk'],
            receiptRefs: ['receipt-register-1'],
          },
        ],
      },
    });
  }
  if (u.includes('/api/wallet/principal/status')) {
    return fakeJsonResponse({
      ok: true,
      ready: false,
      capability: 'LEGACY_EVIDENCE_ONLY',
      controlProven: false,
      detail: 'A legacy address on file cannot serve as a principal signer.',
      personaLabel: 'Test Operator',
    });
  }
  if (u.includes('/api/wallet/signing-requests')) {
    return fakeJsonResponse({ ok: true, requests: [] });
  }
  if (u.includes('/api/assistant/receipts')) {
    return fakeJsonResponse({ ok: true, receipts: [], personaDisplayLabel: 'Test Operator' });
  }
  if (u.includes('/api/persona/sponsored-agents')) {
    return fakeJsonResponse({ ok: true, agents: [] });
  }
  return fakeJsonResponse({ ok: true });
});
vi.mock('@/utils/personaSpine', () => ({
  personaFetch: (url: string, init?: unknown) => personaFetchMock(url, init),
  usePersonaSpine: () => ({ personaId: 'persona-operator-1' }),
}));

// Raw `fetch` — RegisterAgentPanel reads the Agent Card via plain fetch(),
// not personaFetch (it's a public GET). `vi.stubGlobal` is used rather than
// a bare `global.fetch =` assignment, which was observed NOT to reliably
// intercept calls in this jsdom environment (the real network fetch fired
// instead, surfacing as a rendered "Failed to parse URL from /api/..."
// error inside RegisterAgentPanel's own error handling — itself informative
// evidence that the component's error paths work, but not what this test
// is trying to prove).
vi.stubGlobal(
  'fetch',
  vi.fn(async (url: RequestInfo | URL) => {
    const u = String(url);
    if (u.includes('/agent-card.json')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ metadata: { horizen: { tokenId: null, network: null } } }),
      } as unknown as Response;
    }
    return { ok: true, status: 200, json: async () => ({}) } as unknown as Response;
  }),
);

// Wallet surface request/ack plumbing — RegisterAgentPanel subscribes to
// these; no real wallet UI exists in this harness, so they're no-ops.
vi.mock('@/services/wallet/walletSurfaceRequest', () => ({
  requestWalletSurface: vi.fn(),
  subscribeWalletSurfaceCompletion: vi.fn(() => () => {}),
  subscribeWalletSurfaceAck: vi.fn(() => () => {}),
}));

// JourneyCopilotHost pulls in the full copilot stack — irrelevant to this
// layout question and heavy; stub it, same spirit as other tests in this
// repo stubbing SmartTriadCopilotLayer.
vi.mock('@/components/journey/JourneyCopilotHost', () => ({
  JourneyCopilotHost: () => null,
}));

vi.mock('@/components/persona/ActivePersonaControl', () => ({
  ActivePersonaControl: () => <div data-testid="active-persona-control" />,
}));

import { JourneyRunSurface } from '@/components/journey/JourneyRunSurface';
import { RegisterAgentPanel } from '@/components/journey/RegisterAgentPanel';
import { HORIZEN_MONEYPENNY_JOURNEY } from '@/services/journey/horizenMoneyPennyJourney';

afterEach(() => {
  cleanup();
  personaFetchMock.mockClear();
});

// Real Register stage definition, isolated into a single-stage journey so
// the harness renders exactly one real stage's real surfaces — never a
// hand-invented replica of Register.
const registerStage = HORIZEN_MONEYPENNY_JOURNEY.stages.find((s) => s.id === 'register')!;
const singleStageJourney = {
  ...HORIZEN_MONEYPENNY_JOURNEY,
  stages: [registerStage],
};

function renderRegisterStage() {
  return render(
    <JourneyRunSurface
      journey={singleStageJourney}
      stateUrl="/api/journey/moneypenny-horizen/state"
      personaId="persona-operator-1"
      headerLabel="Horizen"
      components={{ RegisterAgentPanel }}
    />,
  );
}

describe('JourneyRunSurface — Register stage: header Evidence popover vs. RegisterAgentPanel quarantine warning', () => {
  it('renders the REAL quarantine warning and the REAL StageReceiptsDrawer together (reproduces the co-existing content the bug overlapped)', async () => {
    renderRegisterStage();

    // RegisterAgentPanel's real quarantine copy — proves this is the actual
    // component, not a stand-in, and that the exact reported text is present
    // in the same render tree as the header's Evidence trigger.
    await waitFor(() =>
      expect(screen.getByText(/This wallet is quarantined and cannot become your principal/i)).toBeInTheDocument(),
    );
    // StageReceiptsDrawer's own header — collapsed by default, matching
    // production (never auto-opened).
    expect(screen.getByText(/^Evidence(\s\(\d+\))?$/)).toBeInTheDocument();
  });

  it('closes the header Evidence popover the instant the page scrolls — it can never remain open while the body scrolls underneath it', async () => {
    renderRegisterStage();
    await waitFor(() =>
      expect(screen.getByText(/This wallet is quarantined and cannot become your principal/i)).toBeInTheDocument(),
    );

    // Open the HEADER popover (the "Evidence N/M" trigger — distinct from
    // StageReceiptsDrawer's own "Evidence (N)" toggle rendered further down).
    const headerTrigger = screen.getByRole('button', { name: /^Evidence \d+\/\d+/ });
    fireEvent.click(headerTrigger);
    expect(headerTrigger).toHaveAttribute('aria-expanded', 'true');

    // Any scroll, anywhere in the document — this is what the fix listens
    // for (capture-phase, since `scroll` does not bubble) — closes it.
    act(() => {
      document.dispatchEvent(new Event('scroll', { bubbles: false }));
    });

    await waitFor(() => expect(headerTrigger).toHaveAttribute('aria-expanded', 'false'));
  });

  it("does not close StageReceiptsDrawer's OWN inline Evidence block on scroll — the two Evidence concepts stay independent", async () => {
    renderRegisterStage();
    await waitFor(() =>
      expect(screen.getByText(/This wallet is quarantined and cannot become your principal/i)).toBeInTheDocument(),
    );

    const drawerToggle = screen.getByText(/^Evidence(\s\(\d+\))?$/).closest('button')!;
    fireEvent.click(drawerToggle);
    // The drawer's own fetch-on-first-expand is in flight; let it settle
    // before asserting, so React's state update lands inside `act`.
    await act(async () => {
      await Promise.resolve();
    });
    expect(drawerToggle).toHaveAttribute('aria-expanded', 'true');

    act(() => {
      document.dispatchEvent(new Event('scroll', { bubbles: false }));
    });

    // StageReceiptsDrawer has no scroll-close behavior (nor should it — it's
    // in normal flow, not an absolutely-positioned overlay) — it stays open.
    expect(drawerToggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('opening/closing the header Evidence popover never unmounts or remounts RegisterAgentPanel (stage body is not collapsed)', async () => {
    renderRegisterStage();
    await waitFor(() =>
      expect(screen.getByText(/This wallet is quarantined and cannot become your principal/i)).toBeInTheDocument(),
    );

    const headerTrigger = screen.getByRole('button', { name: /^Evidence \d+\/\d+/ });
    fireEvent.click(headerTrigger); // open
    fireEvent.click(headerTrigger); // close

    // Still present, unaffected — the popover is a pure overlay toggle.
    expect(screen.getByText(/This wallet is quarantined and cannot become your principal/i)).toBeInTheDocument();
  });
});
