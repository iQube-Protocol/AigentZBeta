// @vitest-environment jsdom
/**
 * MoneyPenny Home navigation regression — FULL FIX VERIFICATION (2026-09-05).
 *
 * `tests/moneypenny-home-nav-diagnostic.test.tsx` proved step 1 of the
 * event path (button click -> MoneyPennyOverviewPanel.navigate ->
 * MoneyPennyNavigationContext.navigate) already worked correctly for every
 * Home item, primary and nested. This file proves the REST of the path —
 * same-area setActivePanel, cross-area host-tab switch, activePanel
 * update, the PANELS dispatcher, and the destination component actually
 * rendering — end to end, against the REAL fix
 * (CodexHostNavigationContext), in BOTH host contexts that actually differ
 * at this layer:
 *
 *   - 'moneypenny-codex' — the standalone /triad/embed/codex/moneypenny mount.
 *   - 'metame-codex' — metaMe's own MoneyPenny group AND the FS Bridge
 *     embed (both mount MoneyPennyPanelTab through the SAME CodexPanelDynamic
 *     instance, registered under the SAME outer codex id — 'metame-codex' —
 *     so from MoneyPennyPanelTab's own vantage point these two hosting
 *     surfaces are the identical case; there is nothing left for a THIRD
 *     harness to exercise differently here).
 *
 * ROOT CAUSE (confirmed by the now-superseded
 * tests/moneypenny-cross-area-integration-diagnostic.test.tsx, kept for its
 * own historical record): MoneyPennyPanelTab's cross-area navigate() looked
 * up a HARDCODED cartridge id ('moneypenny-codex') in the global
 * CartridgePresenceRegistry. That id only ever matched the registry's real
 * entry for the standalone mount; every other host (metaMe foremost)
 * registers itself under its OWN outer codex id, so the lookup silently
 * missed and every cross-area Home card no-op'd. The FIX
 * (CodexHostNavigationContext.tsx) gives MoneyPennyPanelTab the mounted
 * host's OWN setActiveTab function directly, with no id to get wrong —
 * this file proves it now works identically regardless of that id.
 */
import React, { useState } from 'react';
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/components/smarttriad/copilot/SmartTriadCopilotLayer', () => ({
  SmartTriadCopilotLayer: () => <div data-testid="copilot-stub" />,
}));

// Mutable per-test search params — MoneyPennyPanelTab reads `tab` for the
// legacy-deep-link self-heal path; every other test wants an empty one.
let mockSearchParams = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
}));

const personaFetchMock = vi.fn(async () => ({ ok: false, status: 404, json: async () => ({ ok: false, error: 'not mocked' }) }));
vi.mock('@/utils/personaSpine', () => ({ personaFetch: (...args: unknown[]) => personaFetchMock(...args) }));

import { MoneyPennyPanelTab } from '../app/triad/components/codex/tabs/MoneyPennyPanelTab';
import { CodexHostNavigationProvider } from '../app/components/codex/CodexHostNavigationContext';
import { SmartTriadProvider } from '../app/components/content/SmartTriadProvider';
import { MONEYPENNY_CAPABILITY_GROUPS, MONEYPENNY_SPECIALIST_CARDS } from '../app/(shell)/moneypenny/components/moneypennyCapabilities';

beforeEach(() => {
  mockSearchParams = new URLSearchParams();
  personaFetchMock.mockReset();
  personaFetchMock.mockResolvedValue({ ok: false, status: 404, json: async () => ({ ok: false, error: 'not mocked' }) } as Response);
  // CRMIntegration / MoneyPennyLearnPanel use plain global fetch, not
  // personaFetch — stub it too so neither throws / hangs on a real request.
  global.fetch = vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) })) as unknown as typeof fetch;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  // SpecialistWorkspace persists its thread to sessionStorage keyed by
  // personaId+specialistId+scopeId (services/moneypenny/specialistThreadStore.ts)
  // — without clearing it, a Factor/Aegis consult submitted by an earlier
  // test in this file leaks into a later test's "empty state" render,
  // silently turning the empty-state button into an inert prior-turn bubble.
  window.sessionStorage.clear();
});

/** Stands in for CodexPanelDynamic — provides the SAME CodexHostNavigation
 *  Context value it does (codexId + setActiveTab), for a given outer codex
 *  id. This is the REAL fix's own seam, not a mock of it. */
function Host({ codexId, initialArea = 'home' }: { codexId: string; initialArea?: 'home' | 'my-money' | 'plan' | 'markets' | 'activity' }) {
  const [area, setArea] = useState(initialArea);
  const [client] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={client}>
      <SmartTriadProvider>
        <CodexHostNavigationProvider value={{ codexId, setActiveTab: (t) => setArea(t as typeof area) }}>
          <MoneyPennyPanelTab area={area} />
        </CodexHostNavigationProvider>
      </SmartTriadProvider>
    </QueryClientProvider>
  );
}

const HOME_TEXT = /Where would you like to start\?/;
const UNKNOWN_PANEL_TEXT = /Unknown MoneyPenny panel/;

async function expectLeftHome() {
  await waitFor(() => {
    expect(screen.queryByText(HOME_TEXT)).toBeNull();
  });
  expect(screen.queryByText(UNKNOWN_PANEL_TEXT)).toBeNull();
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Home specialist cards now open a direct-consultation MODAL (specialist-
 *  surfaces separation, 2026-09-05, requirement 4) rather than navigating
 *  straight to a case/assessment workspace — an operator can ask a
 *  question immediately, with no case/assessment required. */

// Every capability item reachable from Home with a real (non-null) panel —
// the same set moneypenny-home-nav-diagnostic.test.tsx already proved
// reaches navigate() correctly. financial-profile/risk-envelope/hft-console
// are the three PRIMARY cards (also reachable via their group entries,
// deduped by id below); market-research/learn intentionally target
// 'overview' (Home's own panel — see moneypennyCapabilities.ts) and are
// EXCLUDED here since "navigates away from Home" does not apply to them.
// 'factor'/'aegis' are ALSO excluded from this generic by-label loop — Home
// renders "Aigent Factor"/"Aegis" TWICE (once as this plain Operate-group
// nested card, once as the Specialists section's modal-opening card), so a
// bare label match is ambiguous; both destinations get their own dedicated,
// unambiguously-scoped coverage below.
const NESTED_ITEMS = MONEYPENNY_CAPABILITY_GROUPS.flatMap((g) => g.items)
  .filter((item) => item.panel !== null && item.panel !== 'overview' && item.id !== 'factor' && item.id !== 'aegis');

// Dedupe by id (financial-profile/risk-envelope/market-console appear both
// as a primary label and inside their own group's item list).
const PRIMARY_LABELS: Record<string, string> = {
  'financial-profile': 'Understand my money',
  'risk-envelope': 'Make a plan',
  'market-console': 'Explore investing',
};
const UNIQUE_ITEMS = Array.from(new Map(NESTED_ITEMS.map((i) => [i.id, i])).values());

/** Scopes a query to the Home Operate group's own <details> section (never
 *  the Specialists section, which renders the SAME "Aigent Factor"/"Aegis"
 *  label for its modal-opening cards) — finds the <details> ancestor of the
 *  <summary> whose text is the group label. */
function withinGroupSection(groupLabel: string) {
  const summary = screen.getByText(groupLabel);
  const details = summary.closest('details');
  if (!details) throw new Error(`no <details> ancestor found for group "${groupLabel}"`);
  return within(details);
}

for (const hostCodexId of ['moneypenny-codex', 'metame-codex'] as const) {
  describe(`Host codexId="${hostCodexId}" — every Home item with a real destination actually renders it`, () => {
    for (const item of UNIQUE_ITEMS) {
      const clickLabel = PRIMARY_LABELS[item.id] ?? item.label;
      it(`"${clickLabel}" (${item.id} -> panel=${item.panel})`, async () => {
        render(<Host codexId={hostCodexId} />);
        expect(await screen.findByText(HOME_TEXT)).toBeTruthy();
        const escaped = escapeRegExp(clickLabel);
        const button = screen.getByRole('button', { name: new RegExp(`^${escaped}`), hidden: true });
        fireEvent.click(button);
        await expectLeftHome();
      });
    }
  });
}

for (const hostCodexId of ['moneypenny-codex', 'metame-codex'] as const) {
  describe(`Host codexId="${hostCodexId}" — the Operate group's own Aigent Factor / Aegis nested cards still navigate directly (plain navigation, not a modal)`, () => {
    it('the Operate group\'s "Aigent Factor" card navigates straight to the Factor panel', async () => {
      render(<Host codexId={hostCodexId} />);
      expect(await screen.findByText(HOME_TEXT)).toBeTruthy();
      const button = withinGroupSection('Operate').getByRole('button', { name: /^Aigent Factor/, hidden: true });
      fireEvent.click(button);
      await expectLeftHome();
    });

    it('the Operate group\'s "Aegis" card navigates straight to the Aegis panel', async () => {
      render(<Host codexId={hostCodexId} />);
      expect(await screen.findByText(HOME_TEXT)).toBeTruthy();
      const button = withinGroupSection('Operate').getByRole('button', { name: /^Aegis/, hidden: true });
      fireEvent.click(button);
      await expectLeftHome();
    });
  });
}

for (const hostCodexId of ['moneypenny-codex', 'metame-codex'] as const) {
  describe(`Host codexId="${hostCodexId}" — specialist cards open a direct-consultation modal for the right specialist`, () => {
    it('"Aigent Factor" opens a modal that can consult Aigent Factor immediately, no case required', async () => {
      render(<Host codexId={hostCodexId} />);
      expect(await screen.findByText(HOME_TEXT)).toBeTruthy();
      fireEvent.click(screen.getByTestId('specialist-card-factor'));
      const modal = await screen.findByRole('dialog', { name: /Aigent Factor/ });
      expect(within(modal).getByText(/What are your capabilities\?/i)).toBeTruthy();
      // Home itself is still mounted underneath — a modal, not a navigation.
      expect(screen.getByText(HOME_TEXT)).toBeTruthy();
    });

    it('"Aegis" opens a modal that can consult Aegis immediately, no assessment required', async () => {
      render(<Host codexId={hostCodexId} />);
      expect(await screen.findByText(HOME_TEXT)).toBeTruthy();
      fireEvent.click(screen.getByTestId('specialist-card-aegis'));
      const modal = await screen.findByRole('dialog', { name: /^Aegis$/ });
      expect(within(modal).getByText(/Ask Aegis about trusted intelligence/i)).toBeTruthy();
      expect(screen.getByText(HOME_TEXT)).toBeTruthy();
    });

    it('"Aigent Factor" modal expands into the full Factor panel and preserves the conversation', async () => {
      render(<Host codexId={hostCodexId} />);
      expect(await screen.findByText(HOME_TEXT)).toBeTruthy();
      fireEvent.click(screen.getByTestId('specialist-card-factor'));
      const modal = await screen.findByRole('dialog', { name: /Aigent Factor/ });
      fireEvent.click(within(modal).getByText(/What are your capabilities\?/i));
      fireEvent.click(within(modal).getByText(/Expand to full panel/i));
      await expectLeftHome();
      // The same empty-state prompt turn is now visible in the full panel —
      // the thread was resumed, not restarted (same personaId+specialistId+
      // scope key on both sides).
      expect(await screen.findByText(/What are your capabilities\?/i)).toBeTruthy();
    });

    it('"Aigent Nakamoto" opens a direct-consultation modal', async () => {
      render(<Host codexId={hostCodexId} />);
      expect(await screen.findByText(HOME_TEXT)).toBeTruthy();
      fireEvent.click(screen.getByTestId('specialist-card-nakamoto'));
      const modal = await screen.findByRole('dialog', { name: /Aigent Nakamoto/ });
      expect(modal).toBeTruthy();
      expect(screen.getByText(HOME_TEXT)).toBeTruthy();
    });

    it('"Aigent Know1" opens a direct-consultation modal', async () => {
      render(<Host codexId={hostCodexId} />);
      expect(await screen.findByText(HOME_TEXT)).toBeTruthy();
      fireEvent.click(screen.getByTestId('specialist-card-kn0w1'));
      const modal = await screen.findByRole('dialog', { name: /Aigent Know1/ });
      expect(modal).toBeTruthy();
      expect(screen.getByText(HOME_TEXT)).toBeTruthy();
    });
  });
}

describe('cross-entry-point consistency — Home modal sends the SAME explicit capability selection FactorPanel\'s own empty state does', () => {
  it('the Home modal\'s default click sends factorCapabilityId="general_orientation"', async () => {
    render(<Host codexId="moneypenny-codex" />);
    expect(await screen.findByText(HOME_TEXT)).toBeTruthy();
    fireEvent.click(screen.getByTestId('specialist-card-factor'));
    const modal = await screen.findByRole('dialog', { name: /Aigent Factor/ });
    fireEvent.click(within(modal).getByText(/What are your capabilities\?/i));
    let askAgentCall: unknown[] | undefined;
    await waitFor(() => {
      askAgentCall = personaFetchMock.mock.calls.find(([url]) => url === '/api/assistant/ask-agent');
      expect(askAgentCall).toBeTruthy();
    });
    const body = JSON.parse((askAgentCall![1] as RequestInit).body as string);
    expect(body.specialistId).toBe('factor');
    expect(body.factorCapabilityId).toBe('general_orientation');
  });
});

describe('Legacy ?tab= deep links still self-heal in both host contexts', () => {
  for (const hostCodexId of ['moneypenny-codex', 'metame-codex'] as const) {
    it(`codexId="${hostCodexId}": a fresh load with ?tab=risk-envelope lands on Home then self-heals to Plan's risk-envelope panel`, async () => {
      mockSearchParams = new URLSearchParams('tab=risk-envelope');
      render(<Host codexId={hostCodexId} />);
      await expectLeftHome();
    });
  }
});

describe('Same-area navigation (no host tab switch needed) still works — the carousel/rail path', () => {
  it('starting directly in the activity area and clicking Portfolio/Performance switches panels without ever touching the host', async () => {
    render(<Host codexId="moneypenny-codex" initialArea="activity" />);
    // Runtime is Activity's own default landing panel; Portfolio/Performance
    // is a sibling same-area destination.
    // Same-area destinations render as capability-carousel TABS here (the
    // Home overview panel's own cards, which use role="button", aren't
    // mounted in the activity area at all).
    const tab = await screen.findByRole('tab', { name: /^Portfolio \/ Performance/, hidden: true });
    fireEvent.click(tab);
    expect(screen.queryByText(UNKNOWN_PANEL_TEXT)).toBeNull();
  });
});

describe('A failed cross-area navigation (no host context, registry fallback also misses) is VISIBLE, never a silent no-op', () => {
  it('renders a dismissible error banner naming the unreachable area, and Home stays on screen', async () => {
    const [client] = [new QueryClient()];
    render(
      <QueryClientProvider client={client}>
        {/* No CodexHostNavigationProvider at all — simulates a mount outside
            any CodexPanelDynamic tree, and the CartridgePresenceRegistry has
            no 'moneypenny-codex' entry registered either. */}
        <MoneyPennyPanelTab area="home" />
      </QueryClientProvider>,
    );
    expect(await screen.findByText(HOME_TEXT)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Understand my money/ }));
    expect(await screen.findByText(/Could not open my-money/)).toBeTruthy();
    // Home itself is untouched — the failure didn't corrupt local state.
    expect(screen.getByText(HOME_TEXT)).toBeTruthy();
    fireEvent.click(screen.getByText('Dismiss'));
    await waitFor(() => {
      expect(screen.queryByText(/Could not open my-money/)).toBeNull();
    });
  });
});
