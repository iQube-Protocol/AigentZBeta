/**
 * HistorySurface — atomic SmartTriad surface (kind: 'market.history').
 * Harvested UI shape from MoneyPenny002's `src/components/CaptureSparkline.tsx`
 * (bucketed bar-chart layout) — explicitly NOT its fabricated sine+
 * Math.random() fallback or hardcoded `1247.83` Q¢ total (confirmed present
 * in the donor at `CaptureSparkline.tsx:107-125`). Every point here comes
 * from services/moneypenny/marketSimulation.ts's `simulateCaptureHistory`,
 * honestly source-classified.
 */

import { SmartTriadSourceBadge } from './SmartTriadSourceBadge';
import type { SmartTriadHistoryPayload } from '@/types/smarttriad/richBlocks';

export function HistorySurface({ payload, compact = false }: { payload: SmartTriadHistoryPayload; compact?: boolean }) {
  const { points, mode, source } = payload;
  const captures = points.map((p) => p.captureBps);
  const maxCapture = Math.max(...captures, 1);
  const minCapture = Math.min(...captures, 0);
  const range = maxCapture - minCapture || 1;

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 backdrop-blur-xl" role="group" aria-label="24-hour trade history">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-400">24-Hour Trade History</span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500">{points.length} periods</span>
          <SmartTriadSourceBadge mode={mode} source={source} />
        </div>
      </div>
      <div className={`flex items-end gap-px ${compact ? 'h-16' : 'h-32'}`} role="img" aria-label="Bucketed capture history bar chart">
        {points.map((point, idx) => {
          const heightPercent = ((point.captureBps - minCapture) / range) * 100;
          return (
            <div
              key={idx}
              className="flex-1 rounded-t bg-cyan-500/60 transition-all hover:bg-cyan-400"
              style={{ height: `${Math.max(heightPercent, 3)}%` }}
              title={`${point.captureBps.toFixed(2)} bps at ${new Date(point.timestamp).toLocaleTimeString()}`}
            />
          );
        })}
      </div>
    </div>
  );
}
