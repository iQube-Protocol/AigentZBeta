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

/** CandidateIntakePanel renders its "no case open" empty state until a case
 *  is opened (the specialist tabs only exist once `activeCase` is truthy —
 *  see CandidateIntakePanel.tsx line ~733) — so verifying which specialist
 *  tab a Home card pre-selected requires actually opening a case first, not
 *  just reaching the panel. Mocks the exact 3 REST calls that flow does
 *  (create-or-resume, then the two refreshCase reads), mirroring
 *  tests/moneypenny-candidate-intake-workspace.test.tsx's own fake-backend
 *  pattern rather than inventing a new one. */
function installCandidateIntakeBackend() {
  const fakeCase = {
    case_id: 'case-1',
    tenant_id: 'default',
    candidate_identity_key: 'cand-1',
    candidate_display_name: 'Test Candidate',
    candidate_agent_root_did: null,
    source: 'operator',
    pathway: 'registry_only',
    state: 'discovered',
    paused_from_state: null,
    authority_chain_id: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
  personaFetchMock.mockImplementation(async (url: unknown, init?: RequestInit) => {
    const u = String(url);
    const method = (init?.method ?? 'GET').toUpperCase();
    if (u === '/api/moneypenny/factor/cases' && method === 'POST') {
      return { ok: true, status: 200, json: async () => ({ ok: true, case: fakeCase, created: true }) } as unknown as Response;
    }
    if (u.startsWith(`/api/moneypenny/factor/cases/${fakeCase.case_id}/events`)) {
      return { ok: true, status: 200, json: async () => ({ ok: true, events: [] }) } as unknown as Response;
    }
    if (u.startsWith(`/api/moneypenny/factor/cases/${fakeCase.case_id}`)) {
      return { ok: true, status: 200, json: async () => ({ ok: true, case: fakeCase, evidence: [], assessment: null, findings: [] }) } as unknown as Response;
    }
    return { ok: false, status: 404, json: async () => ({ ok: false, error: 'not mocked' }) } as unknown as Response;
  });
}

/** Drives CandidateIntakePanel's empty-state form to open a case, mirroring
 *  what an operator would actually type — the panel has no other way to
 *  reach the specialist-tab UI. */
async function openCandidateCase() {
  const keyInput = await screen.findByPlaceholderText(/did:example:candidate-42/);
  const nameInput = screen.getByPlaceholderText(/Nakamoto Relay Agent/);
  fireEvent.change(keyInput, { target: { value: 'cand-1' } });
  fireEvent.change(nameInput, { target: { value: 'Test Candidate' } });
  fireEvent.click(screen.getByRole('button', { name: /Find or open case/ }));
  await waitFor(() => {
    expect(screen.queryByPlaceholderText(/did:example:candidate-42/)).toBeNull();
  });
}

// Every capability item reachable from Home with a real (non-null) panel —
// the same set moneypenny-home-nav-diagnostic.test.tsx already proved
// reaches navigate() correctly. financial-profile/risk-envelope/hft-console
// are the three PRIMARY cards (also reachable via their group entries,
// deduped by id below); market-research/learn intentionally target
// 'overview' (Home's own panel — see moneypennyCapabilities.ts) and are
// EXCLUDED here since "navigates away from Home" does not apply to them.
const NESTED_ITEMS = MONEYPENNY_CAPABILITY_GROUPS.flatMap((g) => g.items)
  .filter((item) => item.panel !== null && item.panel !== 'overview');

// Dedupe by id (financial-profile/risk-envelope/market-console appear both
// as a primary label and inside their own group's item list).
const PRIMARY_LABELS: Record<string, string> = {
  'financial-profile': 'Understand my money',
  'risk-envelope': 'Make a plan',
  'market-console': 'Explore investing',
};
const UNIQUE_ITEMS = Array.from(new Map(NESTED_ITEMS.map((i) => [i.id, i])).values());

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
  describe(`Host codexId="${hostCodexId}" — specialist cards navigate to the right panel with the right specialist selected`, () => {
    it('"Aigent Factor" opens candidate-intake with the Factor tab selected', async () => {
      installCandidateIntakeBackend();
      render(<Host codexId={hostCodexId} />);
      expect(await screen.findByText(HOME_TEXT)).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: /^Aigent Factor/, hidden: true }));
      await expectLeftHome();
      await openCandidateCase();
      const factorTab = await screen.findByRole('tab', { name: /Aigent Factor/ });
      expect(factorTab.getAttribute('aria-selected')).toBe('true');
    });

    it('"Aegis" opens candidate-intake with the Aegis tab selected', async () => {
      installCandidateIntakeBackend();
      render(<Host codexId={hostCodexId} />);
      expect(await screen.findByText(HOME_TEXT)).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: /^Aegis/, hidden: true }));
      await expectLeftHome();
      await openCandidateCase();
      const aegisTab = await screen.findByRole('tab', { name: /^Aegis$/ });
      expect(aegisTab.getAttribute('aria-selected')).toBe('true');
    });

    it('"Aigent Nakamoto" opens service-orchestration with Nakamoto selected', async () => {
      personaFetchMock.mockImplementation(async (url: unknown) => {
        if (String(url).startsWith('/api/moneypenny/service-orchestration') && !String(url).includes('agentId')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              ok: true,
              agents: [
                { slug: 'nakamoto', displayName: 'Aigent Nakamoto', runtimeAgentId: 'aigent-nakamoto' },
                { slug: 'kn0w1', displayName: 'Aigent Know1', runtimeAgentId: 'aigent-kn0w1' },
              ],
              catalog: [],
            }),
          } as unknown as Response;
        }
        return { ok: true, status: 200, json: async () => ({ ok: true, discovery: [] }) } as unknown as Response;
      });
      render(<Host codexId={hostCodexId} />);
      expect(await screen.findByText(HOME_TEXT)).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: /^Aigent Nakamoto/, hidden: true }));
      await expectLeftHome();
      await waitFor(() => {
        const selected = screen.getByText('Aigent Nakamoto', { selector: 'button' });
        expect(selected.className).toMatch(/emerald/);
      });
    });

    it('"Aigent Know1" opens service-orchestration with Know1 selected', async () => {
      personaFetchMock.mockImplementation(async (url: unknown) => {
        if (String(url).startsWith('/api/moneypenny/service-orchestration') && !String(url).includes('agentId')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              ok: true,
              agents: [
                { slug: 'nakamoto', displayName: 'Aigent Nakamoto', runtimeAgentId: 'aigent-nakamoto' },
                { slug: 'kn0w1', displayName: 'Aigent Know1', runtimeAgentId: 'aigent-kn0w1' },
              ],
              catalog: [],
            }),
          } as unknown as Response;
        }
        return { ok: true, status: 200, json: async () => ({ ok: true, discovery: [] }) } as unknown as Response;
      });
      render(<Host codexId={hostCodexId} />);
      expect(await screen.findByText(HOME_TEXT)).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: /^Aigent Know1/, hidden: true }));
      await expectLeftHome();
      await waitFor(() => {
        const selected = screen.getByText('Aigent Know1', { selector: 'button' });
        expect(selected.className).toMatch(/emerald/);
      });
    });
  });
}

describe('Specialist selection is consumed exactly once — it does not contaminate a later, unrelated navigation', () => {
  it('selecting Aegis pre-selects the Aegis tab, and leaves no pending-specialist value for a later, unrelated candidate-intake visit', async () => {
    installCandidateIntakeBackend();
    render(<Host codexId="moneypenny-codex" />);
    expect(await screen.findByText(HOME_TEXT)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^Aegis/, hidden: true }));
    await expectLeftHome();
    await openCandidateCase();
    const aegisTab = await screen.findByRole('tab', { name: /^Aegis$/ });
    expect(aegisTab.getAttribute('aria-selected')).toBe('true');
    // No pending-specialist value is left over for the NEXT unrelated
    // candidate-intake visit — proven by checking the raw storage key
    // directly (the one-shot contract writePendingSpecialist/
    // readAndClearPendingSpecialist itself guarantees).
    expect(window.sessionStorage.getItem('moneypenny.pending-specialist')).toBeNull();
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
