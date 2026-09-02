/**
 * MoneyPennyFullScreenContext — C-01 full-screen trading/analysis takeover
 * (2026-09-02): "Full-screen trading or analysis is an in-place takeover.
 * Escape/back restores the earlier layout, selection, scroll position, and
 * conversation. Operational controls, environment, acting agent, and
 * stop/pause remain accessible."
 *
 * Provided by `MoneyPennyCopilotWorkspace.tsx` (the one component that owns
 * the copilot/workspace pane layout), consumed by any panel that wants an
 * in-frame full-screen expansion — today, `HFTConsole.tsx`'s existing
 * disclosed simulation is the first (and only) consumer, per the operator's
 * direction that it "is a suitable surface" rather than building a new one.
 *
 * `HFTConsole.tsx` is ALSO rendered by two surfaces this context does NOT
 * wrap — the standalone `/moneypenny` route (`MoneyPennyCartridge.tsx`,
 * deliberately untouched) and `SmartTriadSurfaces.tsx`. `useMoneyPennyFullScreen()`
 * therefore returns a safe no-op default outside the provider rather than
 * throwing, and `agentName` is `null` in that default specifically so a
 * consumer can tell "no real workspace is hosting me" apart from "hosted,
 * but not yet full-screen" and skip rendering the Expand affordance there —
 * those two other surfaces are completely unaffected by this feature.
 */

'use client';

import { createContext, useContext } from 'react';
import type { MoneyPennyEnvironment } from '@/services/moneypenny/contextVersioning';

export interface MoneyPennyFullScreenValue {
  isFullScreen: boolean;
  enterFullScreen: () => void;
  exitFullScreen: () => void;
  /** SC-04's execution-environment axis — real, not cosmetic (C-01: "environment... remain accessible"). */
  environment: MoneyPennyEnvironment | null;
  /** The acting agent's display name (C-01: "acting agent... remain accessible"). Null outside a real workspace. */
  agentName: string | null;
}

const DEFAULT_VALUE: MoneyPennyFullScreenValue = {
  isFullScreen: false,
  enterFullScreen: () => undefined,
  exitFullScreen: () => undefined,
  environment: null,
  agentName: null,
};

const MoneyPennyFullScreenContext = createContext<MoneyPennyFullScreenValue>(DEFAULT_VALUE);

export const MoneyPennyFullScreenProvider = MoneyPennyFullScreenContext.Provider;

export function useMoneyPennyFullScreen(): MoneyPennyFullScreenValue {
  return useContext(MoneyPennyFullScreenContext);
}
