// @vitest-environment jsdom
/**
 * Register layout diagnosis — the header's Evidence control vs. the
 * scrollable stage body (GJR audit, 2026-09-05; surgical repair, 2026-09-06).
 *
 * ── HISTORY ─────────────────────────────────────────────────────────────
 *
 * The header's "Evidence N/M" trigger used to open its OWN floating
 * popover, `position: absolute` with no clipping ancestor between it and
 * the page, `z-20`. It visually overlapped StageReceiptsDrawer's own
 * inline "Evidence (N)" / "Historical / supplementary receipts" text
 * underneath. A first fix (commit 3ba5ef913) added a `fixed inset-0`
 * translucent backdrop behind the popover — this made the regression
 * WORSE, combining with StageReceiptsDrawer's own visible section to make
 * the whole Journey read as one broken, translucent modal (operator
 * report, 2026-09-06 screenshots).
 *
 * ── THE ACTUAL FIX ──────────────────────────────────────────────────────
 *
 * The defect was never a z-index or opacity value — it was having TWO
 * independent, simultaneously-openable Evidence surfaces on one screen.
 * The header's own floating popover is REMOVED entirely; "Evidence N/M"
 * now controls StageReceiptsDrawer DIRECTLY via its `open`/`onOpenChange`
 * props, and clicking it scrolls that ONE canonical drawer into view. There
 * is exactly one Evidence surface, in normal document flow, never an
 * absolutely/fixed-positioned overlay — so there is nothing left that COULD
 * overlap the stage body, at any scroll position, with no reactive
 * scroll-close mechanism needed at all.
 *
 * jsdom does not perform real layout — a genuine geometric/visual
 * regression test lives separately in
 * tests/journey-evidence-layout-browser-regression.test.tsx, which drives
 * real Chromium (via playwright-core) against the REAL rendered DOM from
 * this same component tree. This file proves the BEHAVIORAL contract:
 * there is one control, one drawer, no second popover, no backdrop.
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
      // RegisterAgentPanel now requires a real, controlled agentSlug (fixed
      // 2026-09-06: stale-subject-agent race) — without this it renders its
      // own neutral "Resolving agent selection…" loading state rather than
      // the quarantine warning this test exercises.
      resolveSurfaceProps={() => ({ agentSlug: 'nakamoto' })}
    />,
  );
}

describe('JourneyRunSurface — Register stage: header Evidence control drives StageReceiptsDrawer directly', () => {
  it('renders the REAL quarantine warning and the REAL StageReceiptsDrawer together, with no second floating popover', async () => {
    renderRegisterStage();

    await waitFor(() =>
      expect(screen.getByText(/This wallet is quarantined and cannot become your principal/i)).toBeInTheDocument(),
    );
    // StageReceiptsDrawer's own header — collapsed by default, matching
    // production (never auto-opened).
    expect(screen.getByText(/^Evidence(\s\([\d/]+(\s·\s\d+\s\w+)?\))?$/)).toBeInTheDocument();
    // There is exactly ONE evidence toggle button — the drawer's own. The
    // header's former separate popover trigger rendered a SECOND button
    // with the same "Evidence N/M" text; that mechanism no longer exists.
    expect(screen.queryAllByRole('button', { name: /^Evidence \d+\/\d+/ })).toHaveLength(1);
  });

  it('there is no fixed/full-viewport backdrop anywhere in the tree, open or closed', async () => {
    const { container } = renderRegisterStage();
    await waitFor(() =>
      expect(screen.getByText(/This wallet is quarantined and cannot become your principal/i)).toBeInTheDocument(),
    );

    expect(container.querySelector('.fixed.inset-0')).toBeNull();

    const evidenceButton = screen.getByRole('button', { name: /^Evidence \d+\/\d+/ });
    fireEvent.click(evidenceButton);
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.querySelector('.fixed.inset-0')).toBeNull();
  });

  it('the header "Evidence N/M" button opens/focuses StageReceiptsDrawer directly — one shared open state, not two', async () => {
    renderRegisterStage();
    await waitFor(() =>
      expect(screen.getByText(/This wallet is quarantined and cannot become your principal/i)).toBeInTheDocument(),
    );

    const evidenceButton = screen.getByRole('button', { name: /^Evidence \d+\/\d+/ });
    expect(evidenceButton).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(evidenceButton);
    await act(async () => {
      await Promise.resolve();
    });
    expect(evidenceButton).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(evidenceButton);
    expect(evidenceButton).toHaveAttribute('aria-expanded', 'false');
  });

  it('Escape collapses the drawer while it is open — keyboard parity with the removed popover', async () => {
    renderRegisterStage();
    await waitFor(() =>
      expect(screen.getByText(/This wallet is quarantined and cannot become your principal/i)).toBeInTheDocument(),
    );

    const evidenceButton = screen.getByRole('button', { name: /^Evidence \d+\/\d+/ });
    fireEvent.click(evidenceButton);
    await act(async () => {
      await Promise.resolve();
    });
    expect(evidenceButton).toHaveAttribute('aria-expanded', 'true');

    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(evidenceButton).toHaveAttribute('aria-expanded', 'false'));
  });

  it('opening/closing Evidence never unmounts or remounts RegisterAgentPanel (stage body is not collapsed)', async () => {
    renderRegisterStage();
    await waitFor(() =>
      expect(screen.getByText(/This wallet is quarantined and cannot become your principal/i)).toBeInTheDocument(),
    );

    const evidenceButton = screen.getByRole('button', { name: /^Evidence \d+\/\d+/ });
    fireEvent.click(evidenceButton); // open
    fireEvent.click(evidenceButton); // close

    // Still present, unaffected — the drawer expanding/collapsing is a pure
    // in-flow toggle, never a remount of the stage's own surfaces.
    expect(screen.getByText(/This wallet is quarantined and cannot become your principal/i)).toBeInTheDocument();
  });
});
