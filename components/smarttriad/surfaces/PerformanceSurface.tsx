/**
 * PerformanceSurface — atomic SmartTriad surface (kind: 'market.performance').
 * Harvested from MoneyPenny002's `LiveMarketFeed.tsx` "Capture Performance"
 * panel (bar chart of recent capture bps + last/avg stat row) and its
 * "Q¢ Accumulated" card — governed data via marketSimulation.ts, never a
 * hardcoded total.
 */

import { SmartTriadSourceBadge } from './SmartTriadSourceBadge';
import type { SmartTriadPerformancePayload } from '@/types/smarttriad/richBlocks';

export function PerformanceSurface({ payload, compact = false }: { payload: SmartTriadPerformancePayload; compact?: boolean }) {
  const { accumulatedQc, lastCaptureBps, avgCaptureBps, recentCaptureBps, mode, source } = payload;
  const bars = compact ? recentCaptureBps.slice(-12) : recentCaptureBps.slice(-30);
  const maxAbs = Math.max(...bars.map((c) => Math.abs(c)), 1);

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 backdrop-blur-xl" role="group" aria-label="Capture performance">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-400">Capture Performance</span>
        <SmartTriadSourceBadge mode={mode} source={source} />
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-emerald-300">{accumulatedQc.toFixed(2)} Q¢</div>
        <div className="mt-0.5 text-[10px] text-slate-500">Accumulated this session</div>
      </div>
      <div className="mt-3 flex h-14 items-end gap-0.5" role="img" aria-label="Recent capture history bar chart">
        {bars.map((capture, idx) => {
          const heightPercent = Math.max((Math.abs(capture) / maxAbs) * 100, 5);
          return (
            <div
              key={idx}
              className={`flex-1 rounded-t transition-all ${capture > 0 ? 'bg-emerald-500/70' : 'bg-rose-500/70'}`}
              style={{ height: `${heightPercent}%` }}
              title={`${capture.toFixed(2)} bps`}
            />
          );
        })}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
        <div>
          <span className="text-slate-500">Last:</span>
          <span className="ml-1 font-mono font-semibold text-slate-200">{lastCaptureBps.toFixed(2)} bps</span>
        </div>
        <div>
          <span className="text-slate-500">Avg:</span>
          <span className="ml-1 font-mono font-semibold text-slate-200">{avgCaptureBps.toFixed(2)} bps</span>
        </div>
      </div>
    </div>
  );
}
