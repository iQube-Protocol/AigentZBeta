/**
 * QuotesSurface — atomic SmartTriad surface (kind: 'market.quotes').
 * Harvested from MoneyPenny002's `src/components/QuotesTable.tsx` (row
 * layout, chain/edge/price/qty/time columns) — same harvest ruling as
 * EdgeGaugeSurface: UI/interaction pattern only, governed data via
 * services/moneypenny/marketSimulation.ts.
 *
 * `compact` shows the 3 most recent rows (inline-message depth); the full
 * list scrolls in `panel`/`expanded` depth — presentation depth only, never
 * a second data path.
 */

import { SmartTriadSourceBadge } from './SmartTriadSourceBadge';
import { ChainChipSurface } from './ChainChipSurface';
import type { SmartTriadQuotesPayload } from '@/types/smarttriad/richBlocks';

export function QuotesSurface({ payload, compact = false }: { payload: SmartTriadQuotesPayload; compact?: boolean }) {
  const { quotes, mode, source } = payload;
  const rows = compact ? quotes.slice(0, 3) : quotes;

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 backdrop-blur-xl" role="table" aria-label="Live quotes">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-400">Live Quotes</span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500">{quotes.length} recent</span>
          <SmartTriadSourceBadge mode={mode} source={source} />
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="py-4 text-center text-xs text-slate-500">Waiting for quotes…</div>
      ) : (
        <div className={compact ? 'space-y-1' : 'max-h-64 space-y-1 overflow-y-auto'}>
          {rows.map((quote, idx) => (
            <div
              key={`${quote.chain}-${quote.timestamp}-${idx}`}
              className="flex items-center justify-between rounded bg-slate-800/40 px-2 py-1.5"
              role="row"
            >
              <div className="flex items-center gap-2">
                <ChainChipSurface chain={quote.chain} />
                <span className="font-mono text-xs text-slate-400">{quote.qtyQc.toFixed(0)} Q¢</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-slate-500">${quote.priceUsdc.toFixed(5)}</span>
                <span className={`font-mono text-xs font-semibold ${quote.edgeBps > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {quote.edgeBps > 0 ? '+' : ''}
                  {quote.edgeBps.toFixed(2)} bps
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
