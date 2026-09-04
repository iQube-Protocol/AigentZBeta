/**
 * FillsSurface — atomic SmartTriad surface (kind: 'market.fills').
 * Harvested from MoneyPenny002's `src/components/FillsTicker.tsx` (BUY/SELL
 * icon, chain chip, qty/price/capture layout) — governed data, not the
 * donor's fake-fill generator (services/moneypenny/marketSimulation.ts).
 */

import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { SmartTriadSourceBadge } from './SmartTriadSourceBadge';
import { ChainChipSurface } from './ChainChipSurface';
import type { SmartTriadFillsPayload } from '@/types/smarttriad/richBlocks';

export function FillsSurface({ payload, compact = false }: { payload: SmartTriadFillsPayload; compact?: boolean }) {
  const { fills, mode, source } = payload;
  const rows = compact ? fills.slice(0, 3) : fills;

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 backdrop-blur-xl" role="table" aria-label="Recent fills">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-400">Recent Fills</span>
        <SmartTriadSourceBadge mode={mode} source={source} />
      </div>
      {rows.length === 0 ? (
        <div className="py-4 text-center text-xs text-slate-500">No fills yet…</div>
      ) : (
        <div className={compact ? 'space-y-1' : 'max-h-64 space-y-1 overflow-y-auto'}>
          {rows.map((fill, idx) => (
            <div
              key={`${fill.chain}-${fill.timestamp}-${idx}`}
              className="flex items-center justify-between rounded bg-slate-800/40 px-2 py-1.5"
              role="row"
            >
              <div className="flex items-center gap-2">
                {fill.side === 'BUY' ? (
                  <ArrowUpRight className="h-3.5 w-3.5 text-emerald-400" aria-label="Buy" />
                ) : (
                  <ArrowDownRight className="h-3.5 w-3.5 text-rose-400" aria-label="Sell" />
                )}
                <ChainChipSurface chain={fill.chain} />
                <span className="font-mono text-xs text-slate-400">{fill.qtyQc.toFixed(2)} Q¢</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-slate-500">${fill.priceUsdc.toFixed(4)}</span>
                <span className="font-mono text-xs font-semibold text-emerald-300">{fill.captureBps.toFixed(2)} bps</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
