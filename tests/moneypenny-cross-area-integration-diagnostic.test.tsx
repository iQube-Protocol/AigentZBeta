// @vitest-environment jsdom
/**
 * DIAGNOSTIC PART 2 — HISTORICAL RECORD (2026-09-05).
 *
 * This file originally proved the ROOT CAUSE of the Home cross-area
 * navigation regression: `MoneyPennyPanelTab`'s cross-area `navigate()`
 * called `tryOpenInMountedCartridge({ cartridgeId: MONEYPENNY_CODEX_ID, ... })`
 * — a lookup by the HARDCODED id `'moneypenny-codex'` in the global
 * `CartridgePresenceRegistry`. That id only matched the registry's real
 * entry for the standalone mount; every other host (metaMe's `metame-codex`
 * foremost) registers itself under its OWN outer codex id, so the lookup
 * silently missed and cross-area Home clicks no-op'd. The two describe
 * blocks below still demonstrate exactly that mechanism.
 *
 * THE DEFECT IS NOW FIXED (`CodexHostNavigationContext.tsx` — the mounted
 * host's own `setActiveTab`, provided directly by `CodexPanelDynamic`, with
 * no cartridge id to get wrong) and `MoneyPennyPanelTab.tsx`'s `navigate()`
 * now tries THAT path first. The "metaMe-hosted... silently no-op" block
 * below still passes, but it no longer represents real production
 * behaviour — it only exercises the LEGACY FALLBACK path (a
 * `MoneyPennyPanelTab` mount with no `CodexHostNavigationProvider`
 * ancestor at all, which cannot occur via the real `TabRenderer`
 * component registry). The real, current fix is proved by
 * `tests/moneypenny-home-cross-area-navigation.test.tsx`, which wraps
 * BOTH a `'moneypenny-codex'` and a `'metame-codex'` host in the REAL
 * `CodexHostNavigationProvider` and shows cross-area navigation succeeding
 * identically in both — kept here only as the dated record of the original
 * root-cause diagnosis, not as the current regression suite for this area.
 */
import React, { useState } from 'react';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/components/smarttriad/copilot/SmartTriadCopilotLayer', () => ({
  SmartTriadCopilotLayer: () => <div data-testid="copilot-stub" />,
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));

import { MoneyPennyPanelTab } from '../app/triad/components/codex/tabs/MoneyPennyPanelTab';
import { MONEYPENNY_CODEX_ID } from '../app/(shell)/moneypenny/components/moneyPennyNavigation';
import type { MoneyPennyAreaId } from '../app/(shell)/moneypenny/components/moneypennyCapabilities';
import { registerCartridge, deregisterCartridge } from '../services/cartridge/CartridgePresenceRegistry';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

/** Stands in for CodexPanelDynamic: registers 'moneypenny-codex' with a REAL
 *  setTab that flips which area's MoneyPennyPanelTab is mounted — exactly
 *  the registration CodexPanelDynamic performs via useCartridgePresence
 *  (cartridgeId: codexId, onSetTab: setActiveTabSlug). */
function StandaloneHost() {
  const [area, setArea] = useState<MoneyPennyAreaId>('home');
  React.useEffect(() => {
    registerCartridge({
      cartridgeId: MONEYPENNY_CODEX_ID,
      displayLabel: 'Aigent MoneyPenny',
      tab: area,
      setTab: (t: string) => setArea(t as MoneyPennyAreaId),
    });
    return () => deregisterCartridge(MONEYPENNY_CODEX_ID);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [client] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={client}>
      <MoneyPennyPanelTab area={area} />
    </QueryClientProvider>
  );
}

/** Stands in for CodexPanelDynamic when MoneyPenny is hosted INSIDE metaMe
 *  (METAME_CODEX's own 'moneypenny' tab group, data/codex-configs.ts) —
 *  registers 'metame-codex' (the OUTER cartridge CodexPanelDynamic actually
 *  registers itself as — codexId comes from the top-level mounted codex,
 *  not from the nested tab group), never 'moneypenny-codex'. */
function MetaMeHost() {
  const [area, setArea] = useState<MoneyPennyAreaId>('home');
  React.useEffect(() => {
    registerCartridge({
      cartridgeId: 'metame-codex',
      displayLabel: 'metaMe',
      tab: area,
      setTab: (t: string) => setArea(t as MoneyPennyAreaId),
    });
    return () => deregisterCartridge('metame-codex');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [client] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={client}>
      <MoneyPennyPanelTab area={area} />
    </QueryClientProvider>
  );
}

describe('LEGACY FALLBACK ONLY (no longer the real production path — see file header) — a mount with no CodexHostNavigationProvider ancestor still falls back to the id-keyed registry lookup, and that lookup still misses when the registered id differs', () => {
  it('clicking "Understand my money" does NOT navigate away from Home — tryOpenInMountedCartridge looks up "moneypenny-codex", but the registered host is "metame-codex"', async () => {
    render(<MetaMeHost />);
    expect(await screen.findByText(/Where would you like to start\?/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Understand my money/ }));
    // Give any async effects a tick, then assert we are STILL on Home —
    // this is the defect, reproduced, not a false negative from timing.
    await new Promise((r) => setTimeout(r, 10));
    expect(screen.queryByText(/Where would you like to start\?/)).toBeTruthy();
  });

  it('clicking "Make a plan" does NOT navigate away from Home', async () => {
    render(<MetaMeHost />);
    expect(await screen.findByText(/Where would you like to start\?/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Make a plan/ }));
    await new Promise((r) => setTimeout(r, 10));
    expect(screen.queryByText(/Where would you like to start\?/)).toBeTruthy();
  });

  it('clicking "Explore investing" does NOT navigate away from Home', async () => {
    render(<MetaMeHost />);
    expect(await screen.findByText(/Where would you like to start\?/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Explore investing/ }));
    await new Promise((r) => setTimeout(r, 10));
    expect(screen.queryByText(/Where would you like to start\?/)).toBeTruthy();
  });
});

describe('Standalone MoneyPenny — a Home cross-area click actually mounts the destination panel', () => {
  it('clicking "Understand my money" (financial-profile, area my-money) ends with FinancialProfilePanel rendered', async () => {
    render(<StandaloneHost />);
    // Home renders first — confirm we start there via its own copy.
    expect(await screen.findByText(/Where would you like to start\?/)).toBeTruthy();
    const button = screen.getByRole('button', { name: /Understand my money/ });
    fireEvent.click(button);
    await waitFor(() => {
      expect(screen.queryByText(/Where would you like to start\?/)).toBeNull();
    });
    // FinancialProfilePanel's own distinguishing content — proven by it no
    // longer showing Home's copy and no "Unknown MoneyPenny panel" fallback.
    expect(screen.queryByText(/Unknown MoneyPenny panel/)).toBeNull();
  });

  it('clicking "Make a plan" (risk-envelope, area plan) navigates away from Home', async () => {
    render(<StandaloneHost />);
    expect(await screen.findByText(/Where would you like to start\?/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Make a plan/ }));
    await waitFor(() => {
      expect(screen.queryByText(/Where would you like to start\?/)).toBeNull();
    });
    expect(screen.queryByText(/Unknown MoneyPenny panel/)).toBeNull();
  });

  it('clicking "Explore investing" (hft-console, area markets) navigates away from Home', async () => {
    render(<StandaloneHost />);
    expect(await screen.findByText(/Where would you like to start\?/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Explore investing/ }));
    await waitFor(() => {
      expect(screen.queryByText(/Where would you like to start\?/)).toBeNull();
    });
    expect(screen.queryByText(/Unknown MoneyPenny panel/)).toBeNull();
  });
});
