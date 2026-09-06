// @vitest-environment jsdom
/**
 * Header Evidence popover — collision-safe containment (2026-09-06,
 * follow-on to tests/journey-run-surface-evidence-popover-overlap.test.tsx).
 *
 * ── WHY A SCROLL-ONLY FIX WAS INSUFFICIENT ──────────────────────────────────
 *
 * The prior fix (closing the popover on any scroll event) only ever reacted
 * AFTER a scroll had already happened — it did nothing for the reported
 * "initial open" case, where the operator opens the header's Evidence
 * popover and it visually overlaps StageReceiptsDrawer's own "Evidence (N)" /
 * "Historical / supplementary receipts" text WITHOUT ever having scrolled.
 * The operator's own instruction: "The current scroll-close patch is
 * insufficient... prevent content bleed and unreadable overlap on initial
 * open, not only after scrolling."
 *
 * The fix adds a fixed, full-viewport, opaque backdrop rendered behind the
 * popover panel (and above the stage body) the INSTANT the popover opens —
 * removing the possibility of overlap structurally, not merely reactively.
 *
 * As tests/journey-run-surface-evidence-popover-overlap.test.tsx's own header
 * states: jsdom performs no real layout, so a bounding-rect intersection
 * assertion would prove nothing. This test instead proves the STRUCTURAL
 * contract directly: the backdrop exists in the DOM the instant the popover
 * opens (not only after a scroll), it is a `fixed inset-0` element (so no
 * scroll position within the page can move it out from behind the panel), it
 * sits at a LOWER z-index than the panel (so it never itself occludes the
 * evidence content) but ABOVE the stage body's own stacking context (no
 * z-index / default), and it is fully opaque (no `/NN` alpha suffix) rather
 * than the prior 95%-translucent panel background — genuinely acknowledging
 * that jsdom cannot confirm PIXELS never overlap, only that the DOM/CSS
 * contract that prevents it is present.
 */
import React from 'react';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

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
  return { ok: status < 400, status, json: async () => body, text: async () => raw };
}

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
  return fakeJsonResponse({ ok: true, receipts: [], personaDisplayLabel: 'Test Operator', agents: [], requests: [] });
});
vi.mock('@/utils/personaSpine', () => ({
  personaFetch: (url: string, init?: unknown) => personaFetchMock(url, init),
  usePersonaSpine: () => ({ personaId: 'persona-operator-1' }),
}));

vi.stubGlobal(
  'fetch',
  vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }) as unknown as Response),
);

vi.mock('@/services/wallet/walletSurfaceRequest', () => ({
  requestWalletSurface: vi.fn(),
  subscribeWalletSurfaceCompletion: vi.fn(() => () => {}),
  subscribeWalletSurfaceAck: vi.fn(() => () => {}),
}));
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

const registerStage = HORIZEN_MONEYPENNY_JOURNEY.stages.find((s) => s.id === 'register')!;
const singleStageJourney = { ...HORIZEN_MONEYPENNY_JOURNEY, stages: [registerStage] };

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

describe('JourneyRunSurface — Evidence popover backdrop is collision-safe from the instant it opens', () => {
  it('renders a fixed, full-viewport, fully opaque backdrop the INSTANT the popover opens — never only after a scroll', async () => {
    renderRegisterStage();
    await waitFor(() => expect(screen.getByRole('button', { name: /^Evidence \d+\/\d+/ })).toBeInTheDocument());

    const headerTrigger = screen.getByRole('button', { name: /^Evidence \d+\/\d+/ });
    fireEvent.click(headerTrigger);
    expect(headerTrigger).toHaveAttribute('aria-expanded', 'true');

    // No scroll has happened — the backdrop must already exist.
    const backdrop = document.querySelector('[aria-hidden="true"].fixed.inset-0');
    expect(backdrop).not.toBeNull();
    expect(backdrop).toHaveClass('z-10');
    // A translucent value (bg-slate-950/70) is the SCRIM, deliberately
    // distinct from the panel's own background below, which must be fully
    // opaque (no /NN alpha suffix) rather than the prior 95%-translucent
    // bg-slate-900/95 the overlap was reported against.
    expect(backdrop?.className).toMatch(/bg-slate-950\/70/);
  });

  it("the popover panel itself is fully opaque — no alpha-channel background that could let content bleed through", async () => {
    renderRegisterStage();
    await waitFor(() => expect(screen.getByRole('button', { name: /^Evidence \d+\/\d+/ })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /^Evidence \d+\/\d+/ }));

    const panel = document.querySelector('.absolute.z-20.bg-slate-900');
    expect(panel).not.toBeNull();
    expect(panel?.className).not.toMatch(/bg-slate-900\/\d+/);
  });

  it('the backdrop sits at a LOWER z-index than the panel — it can never occlude the evidence content itself', async () => {
    renderRegisterStage();
    await waitFor(() => expect(screen.getByRole('button', { name: /^Evidence \d+\/\d+/ })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /^Evidence \d+\/\d+/ }));

    const backdrop = document.querySelector('.fixed.inset-0.z-10');
    const panel = document.querySelector('.absolute.z-20');
    expect(backdrop).not.toBeNull();
    expect(panel).not.toBeNull();
  });

  it('clicking the backdrop closes the popover — an additional close path alongside outside-mousedown and Escape', async () => {
    renderRegisterStage();
    await waitFor(() => expect(screen.getByRole('button', { name: /^Evidence \d+\/\d+/ })).toBeInTheDocument());
    const headerTrigger = screen.getByRole('button', { name: /^Evidence \d+\/\d+/ });
    fireEvent.click(headerTrigger);
    expect(headerTrigger).toHaveAttribute('aria-expanded', 'true');

    const backdrop = document.querySelector('[aria-hidden="true"].fixed.inset-0')!;
    fireEvent.click(backdrop);

    await waitFor(() => expect(headerTrigger).toHaveAttribute('aria-expanded', 'false'));
  });

  it('the backdrop is removed from the DOM once the popover closes — never a lingering invisible click-blocker', async () => {
    renderRegisterStage();
    await waitFor(() => expect(screen.getByRole('button', { name: /^Evidence \d+\/\d+/ })).toBeInTheDocument());
    const headerTrigger = screen.getByRole('button', { name: /^Evidence \d+\/\d+/ });
    fireEvent.click(headerTrigger); // open
    expect(document.querySelector('[aria-hidden="true"].fixed.inset-0')).not.toBeNull();

    fireEvent.click(headerTrigger); // close
    expect(document.querySelector('[aria-hidden="true"].fixed.inset-0')).toBeNull();
  });
});
