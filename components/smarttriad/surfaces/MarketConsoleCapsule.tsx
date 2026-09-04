/**
 * MarketConsoleCapsule — the ONE composable Market Status capsule, backed by
 * the shared `useMoneyPennyMarketSession()` controller, rendered at one of
 * three presentation depths (`compact | expanded | panel`) without ever
 * re-subscribing or resetting state when the depth changes (2026-09-04
 * tranche, requirements 5-8: shared controller, presentation variants,
 * in-place expand/collapse, no second stream on expand).
 *
 * `compact` — inline in a copilot message: Edge + Inventory only, plus an
 *   Expand affordance that toggles THIS component's own local depth state
 *   (no navigation, no remount, no new subscription — the `useMoneyPennyMarketSession()`
 *   call above the conditional render never unmounts across the toggle).
 * `expanded` — the full quality bar: Edge, Inventory, Performance, History,
 *   Quotes, Fills, plus a Collapse affordance back to `compact`.
 * `panel` — identical content to `expanded`, sized for a workspace/right-pane
 *   host (a CSS-only difference, per the "presentation depth via variants,
 *   not conditional business logic" ruling) — used inside `HFTConsole.tsx`.
 */

'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { useMoneyPennyMarketSession, restartMarketSession } from '@/services/moneypenny/marketSessionController';
import { simulationSource } from '@/services/moneypenny/marketSimulation';
import { EdgeGaugeSurface } from './EdgeGaugeSurface';
import { InventoryGaugeSurface } from './InventoryGaugeSurface';
import { QuotesSurface } from './QuotesSurface';
import { FillsSurface } from './FillsSurface';
import { PerformanceSurface } from './PerformanceSurface';
import { HistorySurface } from './HistorySurface';

const CAPABILITY_ID = 'moneypenny.market-console';

export type MarketConsolePresentation = 'compact' | 'expanded' | 'panel';

export interface MarketConsoleCapsuleProps {
  /** Initial depth. 'compact' is the copilot-message default; a host that
   *  always wants the full view (e.g. HFTConsole.tsx) passes 'panel'. */
  initialPresentation?: MarketConsolePresentation;
  /** Hides the Expand/Collapse toggle — used by 'panel' hosts that already
   *  show the full view and have their own chrome. */
  hideToggle?: boolean;
}

export function MarketConsoleCapsule({ initialPresentation = 'compact', hideToggle = false }: MarketConsoleCapsuleProps) {
  // ONE subscription for the lifetime of this component — toggling
  // `presentation` below only changes what this same session's data is
  // rendered AS, never re-subscribes or restarts the session.
  const session = useMoneyPennyMarketSession();
  const [presentation, setPresentation] = useState<MarketConsolePresentation>(initialPresentation);
  const observedAt = new Date().toISOString();
  const source = simulationSource(observedAt);
  const base = { capabilityId: CAPABILITY_ID, mode: 'simulation' as const, source };

  const isFull = presentation !== 'compact';

  return (
    <div
      className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/30 p-2.5"
      role="group"
      aria-label="Market Status"
      data-market-console-presentation={presentation}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-300">
          Market Status {session.connected ? '' : '(disconnected)'}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => restartMarketSession()}
            className="flex items-center gap-1 rounded border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-400 hover:bg-slate-800/60"
            aria-label="Restart session"
          >
            <RefreshCw className="h-3 w-3" />
            Restart
          </button>
          {!hideToggle && (
            <button
              type="button"
              onClick={() => setPresentation(isFull ? 'compact' : 'expanded')}
              className="flex items-center gap-1 rounded border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-slate-800/60"
              aria-expanded={isFull}
            >
              {isFull ? (
                <>
                  <ChevronUp className="h-3 w-3" />
                  Collapse
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3" />
                  Expand console
                </>
              )}
            </button>
          )}
        </div>
      </div>

      <div className={presentation === 'panel' ? 'grid grid-cols-1 gap-2 md:grid-cols-2' : 'space-y-2'}>
        <EdgeGaugeSurface
          compact={!isFull}
          payload={{ ...base, floorBps: session.edge.floorBps, minEdgeBps: session.edge.minEdgeBps, liveEdgeBps: session.edge.liveEdgeBps }}
        />
        <InventoryGaugeSurface
          compact={!isFull}
          payload={{
            ...base,
            inventoryMin: session.inventory.inventoryMin,
            inventoryMax: session.inventory.inventoryMax,
            currentInventory: session.inventory.currentInventory,
            workingQc: session.inventory.workingQc,
          }}
        />
        {isFull && (
          <>
            <PerformanceSurface
              compact={false}
              payload={{
                ...base,
                accumulatedQc: session.accumulatedQc,
                lastCaptureBps: session.captureHistory[session.captureHistory.length - 1] ?? 0,
                avgCaptureBps:
                  session.captureHistory.reduce((sum, c) => sum + c, 0) / Math.max(1, session.captureHistory.length),
                recentCaptureBps: session.captureHistory,
              }}
            />
            <HistorySurface
              compact={false}
              payload={{
                ...base,
                points: session.captureHistory.map((captureBps, i) => ({
                  timestamp: new Date(Date.now() - (session.captureHistory.length - 1 - i) * 20 * 60 * 1000).toISOString(),
                  captureBps,
                })),
              }}
            />
            <QuotesSurface compact={false} payload={{ ...base, quotes: session.quotes }} />
            <FillsSurface compact={false} payload={{ ...base, fills: session.fills }} />
          </>
        )}
      </div>
    </div>
  );
}
