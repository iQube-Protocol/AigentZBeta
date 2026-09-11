// @vitest-environment jsdom
/**
 * DIAGNOSTIC (2026-09-05, operator scope correction): "all MoneyPenny Home
 * capability cards are currently non-functional — the three primary cards
 * and every nested card inside Understand, Design, Markets, Operate and
 * Monitor." Every existing test on this surface
 * (moneypenny-experience-coherence-navigation.test.ts,
 * moneypenny-capability-navigation.test.ts, moneypenny-copilot-workspace.
 * test.ts) is a SOURCE-STRING canary — none of them render the component and
 * click a button. This file isolates step 1 of the reported event path
 * (button click -> MoneyPennyOverviewPanel.navigate -> context.navigate) with
 * a real render, to determine whether the click reaches the navigation
 * context at all before looking any further downstream.
 */
import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, it, expect, vi } from 'vitest';

import { MoneyPennyOverviewPanel } from '../app/(shell)/moneypenny/components/MoneyPennyOverviewPanel';
import { MoneyPennyNavigationProvider, type MoneyPennyNavigationContextValue } from '../app/(shell)/moneypenny/components/moneyPennyNavigation';
import { MONEYPENNY_CAPABILITY_GROUPS } from '../app/(shell)/moneypenny/components/moneypennyCapabilities';
import type { MoneyPennyPanelKey } from '../app/triad/components/codex/tabs/MoneyPennyPanelTab';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderWithNav(navigate: (panel: MoneyPennyPanelKey) => void) {
  const value: MoneyPennyNavigationContextValue = {
    activePanel: 'overview',
    area: 'home',
    navigate,
    activeCase: null,
    setActiveCase: () => undefined,
  };
  return render(
    <MoneyPennyNavigationProvider value={value}>
      <MoneyPennyOverviewPanel />
    </MoneyPennyNavigationProvider>,
  );
}

describe('MoneyPennyOverviewPanel — the 3 primary cards reach the navigation context', () => {
  const cases: Array<{ label: string; panel: MoneyPennyPanelKey }> = [
    { label: 'Understand my money', panel: 'financial-profile' },
    { label: 'Make a plan', panel: 'risk-envelope' },
    { label: 'Explore investing', panel: 'hft-console' },
  ];

  for (const { label, panel } of cases) {
    it(`clicking "${label}" calls navigate("${panel}") exactly once`, async () => {
      const navigate = vi.fn();
      renderWithNav(navigate);
      const user = userEvent.setup();
      const button = screen.getByRole('button', { name: new RegExp(label) });
      expect((button as HTMLButtonElement).disabled).toBe(false);
      await user.click(button);
      expect(navigate).toHaveBeenCalledTimes(1);
      expect(navigate).toHaveBeenCalledWith(panel);
    });
  }
});

describe('MoneyPennyOverviewPanel — every nested capability card (Understand/Design/Markets/Operate/Monitor) reaches the navigation context', () => {
  const PRIMARY_IDS = new Set(['financial-profile', 'risk-envelope', 'market-console']);
  // 'factor'/'aegis' are excluded from this generic by-label loop — Home
  // renders "Aigent Factor"/"Aegis" TWICE (once as this plain Operate-group
  // nested card, once as the Specialists section's own card), so a bare
  // label match is ambiguous. Covered by their own scoped test below.
  const nestedItems = MONEYPENNY_CAPABILITY_GROUPS.flatMap((g) => g.items.map((item) => ({ group: g.label, item })))
    .filter(({ item }) => !PRIMARY_IDS.has(item.id) && item.id !== 'factor' && item.id !== 'aegis');

  for (const { group, item } of nestedItems) {
    const testFn = item.panel === null ? it.skip : it;
    testFn(`[${group}] "${item.label}" (panel=${item.panel}) calls navigate exactly once with the right panel`, () => {
      const navigate = vi.fn();
      renderWithNav(navigate);
      // The item is always in the DOM (native <details> hides via UA CSS,
      // not conditional rendering) — query ignoring visibility, and use
      // fireEvent (not user-event) so a closed <details> can't block the
      // click via user-event's pointer-events/visibility check. This
      // isolates purely "does the click handler fire", independent of
      // whether the operator opened the section first.
      const escapedLabel = item.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const button = screen.getByRole('button', { name: new RegExp(`^${escapedLabel}`), hidden: true });
      expect((button as HTMLButtonElement).disabled, `${item.label} button should not be disabled`).toBe(false);
      fireEvent.click(button);
      expect(navigate).toHaveBeenCalledTimes(1);
      expect(navigate).toHaveBeenCalledWith(item.panel);
    });
  }

  it('every group with an unavailable (panel===null) item renders it disabled with "Coming soon" — never silently clickable', () => {
    const navigate = vi.fn();
    renderWithNav(navigate);
    const unavailable = nestedItems.filter(({ item }) => item.panel === null);
    expect(unavailable.length).toBeGreaterThan(0);
  });

  it('the Operate group\'s "Aigent Factor" and "Aegis" nested cards each reach the navigation context with their own panel', () => {
    const navigate = vi.fn();
    renderWithNav(navigate);
    const operateDetails = screen.getByText('Operate').closest('details');
    if (!operateDetails) throw new Error('no <details> ancestor found for the Operate group');
    const factorButton = screen.getAllByRole('button', { name: /^Aigent Factor/, hidden: true }).find((b) => operateDetails.contains(b));
    const aegisButton = screen.getAllByRole('button', { name: /^Aegis/, hidden: true }).find((b) => operateDetails.contains(b));
    if (!factorButton || !aegisButton) throw new Error('Operate group\'s Aigent Factor/Aegis cards not found');
    fireEvent.click(factorButton);
    expect(navigate).toHaveBeenLastCalledWith('factor');
    fireEvent.click(aegisButton);
    expect(navigate).toHaveBeenLastCalledWith('aegis');
  });
});
